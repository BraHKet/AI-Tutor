// src/utils/gemini/shared/geminiShared.js - UTILITÀ CONDIVISE SENZA LIMITI

// ===== CONFIGURAZIONE GLOBALE - NESSUN LIMITE =====
export const SHARED_CONFIG = {
  AI_GENERATION: {
    responseMimeType: "application/json",
    temperature: 0.1,
    maxOutputTokens: 1048576, // MASSIMO POSSIBILE (1M tokens)
  },
  TEXT_LIMITS: {
    maxCharsForPdf: 10000000, // 10M caratteri - NESSUN LIMITE PRATICO
    maxCharsForText: 10000000, // 10M caratteri - NESSUN LIMITE PRATICO
    chunkSize: 100000, // Chunk molto più grandi
    overlapSize: 5000 // Overlap maggiore per continuità
  },
  CACHE: {
    maxEntries: 1000, // Cache molto più grande
    ttlHours: 24
  }
};

// ===== CACHE SEMPLIFICATA =====
const SHARED_CACHES = {
  pdf: new Map(),
  text: new Map(),
  phase: new Map()
};

// ===== UTILITY FUNCTIONS =====

/**
 * Genera hash univoco per i file
 */
export function generateFileHash(files) {
  if (!Array.isArray(files)) return 'no-files';
  return files.map(f => `${f.name}-${f.size}-${f.lastModified || 'unknown'}`).join('|');
}

/**
 * Genera hash per una fase specifica
 */
export function generatePhaseHash(phase, examName, files, additionalParams = '') {
  const baseHash = generateFileHash(files);
  return `${phase}_${examName}_${baseHash}_${additionalParams}`;
}

/**
 * Pulisce cache quando supera il limite
 */
export function cleanupCache(cache, maxEntries = SHARED_CONFIG.CACHE.maxEntries) {
  if (cache.size > maxEntries) {
    const entries = Array.from(cache.entries());
    const entriesToRemove = entries.slice(0, Math.floor(maxEntries / 2));
    entriesToRemove.forEach(([key]) => cache.delete(key));
  }
}

/**
 * Suddivide testo in chunk intelligenti - NESSUN LIMITE
 */
export function splitTextIntelligently(text, maxChars = SHARED_CONFIG.TEXT_LIMITS.chunkSize, overlapChars = SHARED_CONFIG.TEXT_LIMITS.overlapSize) {
  // Se il testo è entro i limiti, restituiscilo intero
  if (text.length <= maxChars) {
    return [text];
  }

  const chunks = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    let endIndex = Math.min(startIndex + maxChars, text.length);
    
    if (endIndex < text.length) {
      const lastSpaceIndex = text.lastIndexOf(' ', endIndex);
      const lastPeriodIndex = text.lastIndexOf('.', endIndex);
      const lastNewlineIndex = text.lastIndexOf('\n', endIndex);
      
      const bestBreakPoint = Math.max(lastSpaceIndex, lastPeriodIndex, lastNewlineIndex);
      
      if (bestBreakPoint > startIndex + (maxChars * 0.7)) {
        endIndex = bestBreakPoint + 1;
      }
    }

    const chunk = text.substring(startIndex, endIndex).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    startIndex = Math.max(endIndex - overlapChars, endIndex);
    
    if (startIndex === endIndex) {
      startIndex = endIndex;
    }
  }

  return chunks;
}

/**
 * Pulisce e corregge JSON malformato
 */
export function cleanAndParseJSON(jsonString) {
  try {
    let cleaned = jsonString
      .replace(/^```json\s*/gi, '')
      .replace(/```\s*$/g, '')
      .trim();
    
    return JSON.parse(cleaned);
  } catch (error) {
    console.warn('⚠️ JSON malformato, tentando riparazione...');
    
    try {
      let repaired = jsonString
        .replace(/^```json\s*/gi, '')
        .replace(/```\s*$/g, '')
        .trim();
      
      let lastValidIndex = repaired.length;
      let braceCount = 0;
      let inString = false;
      let escaped = false;
      
      for (let i = 0; i < repaired.length; i++) {
        const char = repaired[i];
        
        if (escaped) {
          escaped = false;
          continue;
        }
        
        if (char === '\\') {
          escaped = true;
          continue;
        }
        
        if (char === '"' && !escaped) {
          inString = !inString;
          continue;
        }
        
        if (!inString) {
          if (char === '{') braceCount++;
          if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
              lastValidIndex = i + 1;
              break;
            }
          }
        }
      }
      
      repaired = repaired.substring(0, lastValidIndex);
      
      if (inString) {
        repaired += '"';
      }
      
      while (braceCount > 0) {
        repaired += '}';
        braceCount--;
      }
      
      console.log('✅ JSON riparato con successo');
      return JSON.parse(repaired);
    } catch (repairError) {
      console.error('❌ Riparazione JSON fallita:', repairError);
      throw new Error(`JSON parsing failed: ${error.message}. Response was likely truncated.`);
    }
  }
}

/**
 * Logger centralizzato per debug
 */
export function logPhase(phaseName, message, data = null) {
  console.log(`🔍 [${phaseName.toUpperCase()}] ${message}`);
  if (data) {
    console.log('📊 Data:', data);
  }
}

// ===== CACHE MANAGEMENT =====

/**
 * Ottiene un elemento dalla cache
 */
export function getCacheItem(cacheType, key) {
  const cache = SHARED_CACHES[cacheType];
  if (!cache) return null;
  return cache.get(key) || null;
}

/**
 * Salva un elemento nella cache
 */
export function setCacheItem(cacheType, key, value) {
  const cache = SHARED_CACHES[cacheType];
  if (!cache) return false;
  
  cache.set(key, value);
  cleanupCache(cache);
  return true;
}

/**
 * Statistiche cache
 */
export function getCacheStats() {
  return {
    pdf: SHARED_CACHES.pdf.size,
    text: SHARED_CACHES.text.size,
    phase: SHARED_CACHES.phase.size,
    maxEntries: SHARED_CONFIG.CACHE.maxEntries
  };
}

/**
 * Pulisce tutte le cache
 */
export function clearAllCaches() {
  const totalSize = Object.values(SHARED_CACHES).reduce((sum, cache) => sum + cache.size, 0);
  Object.values(SHARED_CACHES).forEach(cache => cache.clear());
  console.log(`🗑️ Cache pulite (${totalSize} elementi)`);
  return totalSize;
}

// ===== VALIDAZIONE INPUT/OUTPUT =====

/**
 * Valida parametri base per le fasi
 */
export function validatePhaseInput(phaseName, examName, files, additionalParams = {}) {
  const errors = [];
  
  if (!phaseName || typeof phaseName !== 'string') {
    errors.push('phaseName deve essere una stringa non vuota');
  }
  
  if (!examName || typeof examName !== 'string') {
    errors.push('examName deve essere una stringa non vuota');
  }
  
  if (files && !Array.isArray(files)) {
    errors.push('files deve essere un array');
  }
  
  if (errors.length > 0) {
    throw new Error(`Validazione input fallita per ${phaseName}: ${errors.join(', ')}`);
  }
  
  return true;
}

/**
 * Valida output di una fase
 */
export function validatePhaseOutput(phaseName, output, requiredFields = []) {
  if (!output || typeof output !== 'object') {
    throw new Error(`Output ${phaseName} deve essere un oggetto`);
  }
  
  const missingFields = requiredFields.filter(field => !(field in output));
  if (missingFields.length > 0) {
    throw new Error(`Output ${phaseName} manca campi: ${missingFields.join(', ')}`);
  }
  
  return true;
}

// ===== TIMER E PERFORMANCE =====

/**
 * Timer semplice per misurare performance
 */
export function createTimer(label) {
  const startTime = Date.now();
  
  return {
    elapsed: () => Date.now() - startTime,
    log: (message = '') => {
      const duration = Date.now() - startTime;
      console.log(`⏱️ [${label}] ${message} - ${duration}ms`);
      return duration;
    }
  };
}

// ===== INTERFACCE STANDARD =====

/**
 * Struttura standard per input delle fasi di analisi contenuti
 */
export function createContentPhaseInput(examName, files, userDescription = '', analysisMode = 'pdf', additionalData = {}) {
  return {
    examName: examName.trim(),
    files: Array.isArray(files) ? files : [],
    userDescription: userDescription.trim(),
    analysisMode: ['pdf', 'text'].includes(analysisMode) ? analysisMode : 'pdf',
    timestamp: Date.now(),
    ...additionalData
  };
}

/**
 * Struttura standard per output delle fasi di analisi contenuti
 */
export function createContentPhaseOutput(phaseName, data, metadata = {}) {
  return {
    phaseName,
    data,
    metadata: {
      timestamp: Date.now(),
      version: '2.0',
      ...metadata
    },
    success: true
  };
}

/**
 * Struttura standard per input delle fasi di distribuzione
 */
export function createDistributionPhaseInput(examName, topics, totalDays, userDescription = '', additionalData = {}) {
  return {
    examName: examName.trim(),
    topics: Array.isArray(topics) ? topics : [],
    totalDays: parseInt(totalDays) || 7,
    userDescription: userDescription.trim(),
    timestamp: Date.now(),
    ...additionalData
  };
}

/**
 * Struttura standard per output delle fasi di distribuzione
 */
export function createDistributionPhaseOutput(phaseName, data, statistics = {}) {
  return {
    phaseName,
    data,
    statistics: {
      timestamp: Date.now(),
      version: '2.0',
      ...statistics
    },
    success: true
  };
}

// ===== GESTIONE ERRORI =====

/**
 * Crea errore standardizzato per le fasi
 */
export function createPhaseError(phaseName, message, originalError = null) {
  const error = new Error(`[${phaseName}] ${message}`);
  error.phaseName = phaseName;
  error.timestamp = Date.now();
  error.originalError = originalError;
  return error;
}

/**
 * Wrapper per esecuzione sicura delle fasi
 */
export async function executePhaseWithErrorHandling(phaseName, phaseFunction, input, maxRetries = 3) {
  const timer = createTimer(phaseName);
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logPhase(phaseName, `Tentativo ${attempt}/${maxRetries} avviato`);
      
      const result = await phaseFunction(input);
      
      timer.log(`Completato con successo`);
      return result;
      
    } catch (error) {
      lastError = error;
      logPhase(phaseName, `Tentativo ${attempt} fallito: ${error.message}`);
      
      if (attempt < maxRetries) {
        const delayMs = 1000 * attempt;
        logPhase(phaseName, `Ritento tra ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  timer.log(`Fallito dopo ${maxRetries} tentativi`);
  throw createPhaseError(phaseName, `Fallito dopo ${maxRetries} tentativi`, lastError);
}

// ===== EXPORT DEFAULT =====
export default {
  // Configurazione
  SHARED_CONFIG,
  
  // Utility core
  generateFileHash,
  generatePhaseHash,
  cleanupCache,
  splitTextIntelligently,
  cleanAndParseJSON,
  logPhase,
  
  // Cache
  getCacheItem,
  setCacheItem,
  getCacheStats,
  clearAllCaches,
  
  // Validazione
  validatePhaseInput,
  validatePhaseOutput,
  
  // Performance
  createTimer,
  
  // Interfacce standard
  createContentPhaseInput,
  createContentPhaseOutput,
  createDistributionPhaseInput,
  createDistributionPhaseOutput,
  
  // Gestione errori
  createPhaseError,
  executePhaseWithErrorHandling
};