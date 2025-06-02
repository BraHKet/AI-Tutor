// src/utils/gemini/geminiCore.js - Core utilities, caching, and file processing
import { genAI, model as geminiDefaultModel } from '../geminiSetup';

// ===== CACHE SEMPLIFICATA =====
const PDF_CACHE = new Map();
const PHASE_CACHE = new Map();

// Configurazioni essenziali
export const CONFIG = {
  AI_GENERATION: {
    responseMimeType: "application/json",
    temperature: 0.1,
    maxOutputTokens: 8192,
  },
  CONTENT_ANALYSIS: {
    minTopicPages: 5,
    maxTopicPages: 20,
    idealTopicPages: 12,
    maxTopicsTotal: 15,
    minTopicsTotal: 5
  },
  DISTRIBUTION: {
    maxTopicsPerDay: 3,
    reserveReviewDays: true
  },
  CACHE: {
    maxEntries: 50,
    ttlHours: 24
  }
};

// ===== UTILITY FUNCTIONS =====

export function generateFileHash(files) {
  return files.map(f => `${f.name}-${f.size}-${f.lastModified || 'unknown'}`).join('|');
}

export function generatePhaseHash(phase, examName, files, additionalParams = '') {
  const baseHash = generateFileHash(files);
  return `${phase}_${examName}_${baseHash}_${additionalParams}`;
}

export function cleanupCache(cache, maxEntries = CONFIG.CACHE.maxEntries) {
  if (cache.size > maxEntries) {
    const entries = Array.from(cache.entries());
    const entriesToRemove = entries.slice(0, Math.floor(maxEntries / 2));
    entriesToRemove.forEach(([key]) => cache.delete(key));
    console.log(`Cache cleanup: removed ${entriesToRemove.length} entries`);
  }
}

/**
 * Converte un oggetto File JavaScript in una "parte" per l'API Gemini con caching
 */
export async function fileToGenerativePart(file) {
  const fileKey = `${file.name}-${file.size}-${file.lastModified || 'unknown'}`;
  
  if (PDF_CACHE.has(fileKey)) {
    console.log(`GeminiCore: Using cached PDF conversion for ${file.name}`);
    return PDF_CACHE.get(fileKey);
  }

  console.log(`GeminiCore: Converting PDF to base64 for ${file.name}...`);
  
  // Validazione file
  if (!file || !(file instanceof File)) {
    throw new Error(`Invalid file object for ${file?.name || 'unknown'}`);
  }
  
  if (file.type !== 'application/pdf') {
    throw new Error(`File ${file.name} is not a PDF`);
  }
  
  if (file.size > 50 * 1024 * 1024) { // 50MB limit
    throw new Error(`File ${file.name} is too large (${Math.round(file.size / 1024 / 1024)}MB > 50MB)`);
  }

  try {
    const base64EncodedData = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      const timeout = setTimeout(() => {
        reader.abort();
        reject(new Error(`Timeout reading file ${file.name}`));
      }, 60000);
      
      reader.onloadend = () => {
        clearTimeout(timeout);
        if (reader.result && typeof reader.result === 'string') {
          const base64Data = reader.result.split(',')[1];
          if (!base64Data) {
            reject(new Error(`Failed to extract base64 data from ${file.name}`));
          } else {
            resolve(base64Data);
          }
        } else {
          reject(new Error(`FileReader result is null for ${file.name}`));
        }
      };
      
      reader.onerror = (error) => {
        clearTimeout(timeout);
        reject(new Error(`FileReader error for ${file.name}: ${error.message || 'Unknown error'}`));
      };
      
      reader.readAsDataURL(file);
    });

    const generativePart = {
      inlineData: {
        data: base64EncodedData,
        mimeType: file.type || 'application/pdf',
      },
    };

    PDF_CACHE.set(fileKey, generativePart);
    cleanupCache(PDF_CACHE);
    return generativePart;
    
  } catch (error) {
    console.error(`GeminiCore: Error converting ${file.name}:`, error);
    throw new Error(`Failed to convert ${file.name}: ${error.message}`);
  }
}

/**
 * Prepara i file PDF per l'analisi AI
 */
export async function prepareFilesForAI(filesArray, originalFilesDriveInfo, progressCallback) {
  const fileHash = generateFileHash(filesArray);
  
  if (PDF_CACHE.has(fileHash + '_prepared')) {
    progressCallback?.({ type: 'processing', message: 'Riutilizzo file già processati...' });
    return PDF_CACHE.get(fileHash + '_prepared');
  }

  progressCallback?.({ type: 'processing', message: 'Preparazione file per analisi AI...' });

  const partsArray = [];
  let validPdfFilesSent = 0;

  for (let i = 0; i < filesArray.length; i++) {
    const file = filesArray[i];
    const driveInfo = originalFilesDriveInfo.find(df => df.originalFileIndex === i);

    if (file.type === "application/pdf" && driveInfo && driveInfo.name === file.name) {
      progressCallback?.({ type: 'processing', message: `Conversione file ${i + 1}/${filesArray.length}: ${file.name}...` });
      
      try {
        const filePart = await fileToGenerativePart(file);
        partsArray.push(filePart);
        validPdfFilesSent++;
        progressCallback?.({ type: 'processing', message: `File ${file.name} preparato.` });
      } catch (fileConvError) {
        console.error(`GeminiCore: Error converting file ${file.name}:`, fileConvError);
        progressCallback?.({ type: 'warning', message: `Errore file ${file.name}: ${fileConvError.message}` });
      }
    }
  }

  if (validPdfFilesSent === 0) {
    throw new Error('Nessun file PDF valido è stato preparato per l\'analisi AI.');
  }

  const result = { 
    partsArray, 
    validPdfFilesSent, 
    totalExpected: filesArray.length
  };
  
  PDF_CACHE.set(fileHash + '_prepared', result);
  cleanupCache(PDF_CACHE);
  
  return result;
}

/**
 * Esegue una singola fase AI con caching e retry
 */
export async function executeAIPhase(phaseName, promptText, filesArray, originalFilesDriveInfo, progressCallback, useFiles = true) {
  const phaseHash = generatePhaseHash(phaseName, promptText.substring(0, 100), filesArray);
  
  if (PHASE_CACHE.has(phaseHash)) {
    console.log(`GeminiCore: Using cached result for phase ${phaseName}`);
    progressCallback?.({ type: 'processing', message: `Utilizzo cache per fase ${phaseName}...` });
    return PHASE_CACHE.get(phaseHash);
  }

  console.log(`GeminiCore: Executing phase ${phaseName}...`);
  progressCallback?.({ type: 'processing', message: `Esecuzione fase ${phaseName}...` });

  if (!genAI || !geminiDefaultModel) {
    throw new Error('Servizio AI Gemini non inizializzato correttamente.');
  }

  const parts = [{ text: promptText.trim() }];
  
  if (useFiles && filesArray && filesArray.length > 0) {
    const { partsArray } = await prepareFilesForAI(filesArray, originalFilesDriveInfo, progressCallback);
    parts.push(...partsArray);
  }

  const requestPayload = {
    contents: [{
      role: "user",
      parts: parts
    }],
    generationConfig: CONFIG.AI_GENERATION
  };

  // Retry logic semplice
  const maxRetries = 2;
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const aiResult = await geminiDefaultModel.generateContent(requestPayload);
      const response = aiResult.response;

      let textResponse;
      if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
        textResponse = response.candidates[0].content.parts[0].text;
      } else {
        textResponse = response.text();
      }

      const cleanedResponse = textResponse
        .replace(/^```json\s*/gi, '')
        .replace(/```\s*$/g, '')
        .trim();
        
      if (!cleanedResponse) {
        throw new Error('Risposta vuota dall\'AI');
      }
      
      const parsedResponse = JSON.parse(cleanedResponse);
      
      PHASE_CACHE.set(phaseHash, parsedResponse);
      cleanupCache(PHASE_CACHE);

      progressCallback?.({ type: 'processing', message: `Fase ${phaseName} completata.` });
      return parsedResponse;

    } catch (error) {
      lastError = error;
      console.error(`GeminiCore: Error in phase ${phaseName} (attempt ${attempt}):`, error);
      
      if (attempt < maxRetries) {
        const delayMs = 2000 * attempt;
        progressCallback?.({ type: 'processing', message: `Errore fase ${phaseName}, nuovo tentativo...` });
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  throw new Error(`Errore nella fase ${phaseName}: ${lastError?.message || 'Errore sconosciuto'}`);
}

// ===== CACHE MANAGEMENT =====

export function getCacheStats() {
  return {
    pdfCache: PDF_CACHE.size,
    phaseCache: PHASE_CACHE.size,
    maxEntries: CONFIG.CACHE.maxEntries
  };
}

export function clearAllCaches() {
  const totalSize = PDF_CACHE.size + PHASE_CACHE.size;
  PDF_CACHE.clear();
  PHASE_CACHE.clear();
  console.log(`GeminiCore: Cleared all caches (${totalSize} entries)`);
  return totalSize;
}

export { PDF_CACHE, PHASE_CACHE };