// src/utils/gemini.js
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

// Funzione di inizializzazione
function initGeminiAI() {
  try {
    // --- CHIAVE API GEMINI ---
    // !!! SOSTITUISCI CON LA TUA CHIAVE API REALE OTTENUTA DA GOOGLE AI STUDIO O GOOGLE CLOUD !!!
    const apiKey = "AIzaSyCkw0bYs0jEa5La26hcWWQyGhBFSxhbdVU"; // <-- OBBLIGATORIO!
    // --------------------------

    if (!apiKey || apiKey.includes("INCOLLA_QUI") || apiKey.length < 10) {
        console.error("*********************************************************************");
        console.error("ERRORE: Chiave API Gemini mancante o non valida in src/utils/gemini.js!");
        console.error("Inserisci la tua chiave API valida ottenuta da Google AI o Google Cloud.");
        console.error("*********************************************************************");
        return null;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash-latest", // o gemini-1.5-pro-latest se hai accesso/necessità
        // safetySettings: [ Imposta se necessario ]
    });
    console.log("Modello Gemini inizializzato con successo:", "gemini-1.5-flash-latest");
    return { genAI, model };
  } catch (error) {
    console.error("Errore critico durante l'inizializzazione del client Gemini:", error);
    return null;
  }
}

const geminiClient = initGeminiAI();
export const genAI = geminiClient?.genAI || null;
export const model = geminiClient?.model || null;

// Cache per memorizzare i PDF convertiti
const pdfCache = new Map();

// Funzione per convertire un file PDF in un oggetto Part per Gemini
export const createFilePartFromPDF = async (file) => {
  try {
    const buffer = await file.arrayBuffer();
    const mimeType = file.type || 'application/pdf';
    
    // Converte ArrayBuffer in Base64 usando le API del browser
    const uInt8Array = new Uint8Array(buffer);
    let binaryString = '';
    for (let i = 0; i < uInt8Array.length; i++) {
      binaryString += String.fromCharCode(uInt8Array[i]);
    }
    const base64String = btoa(binaryString);
    
    return {
      inlineData: {
        data: base64String,
        mimeType: mimeType
      }
    };
  } catch (error) {
    console.error("Errore durante la creazione della parte file per Gemini:", error);
    throw new Error(`Impossibile preparare il file ${file.name} per Gemini: ${error.message}`);
  }
};

// Funzione per preparare i file una sola volta e memorizzarli in cache
export const prepareFilesOnce = async (pdfFiles) => {
  console.log(`GeminiService: Preparazione iniziale di ${pdfFiles.length} file PDF...`);
  const fileParts = [];
  
  // Per ogni file...
  for (const file of pdfFiles) {
    const fileId = `${file.name}-${file.size}`; // Identificatore unico per il file
    
    // Controlla se il file è già in cache
    if (pdfCache.has(fileId)) {
      console.log(`GeminiService: File "${file.name}" già presente in cache, riutilizzo.`);
      fileParts.push(pdfCache.get(fileId));
      continue;
    }
    
    // Se non è in cache, converti in base64
    console.log(`GeminiService: Conversione file "${file.name}" in base64...`);
    try {
      const filePart = await createFilePartFromPDF(file);
      
      // Memorizza in cache
      pdfCache.set(fileId, filePart);
      
      // Aggiungi all'array di parti
      fileParts.push(filePart);
      console.log(`GeminiService: File "${file.name}" convertito e memorizzato in cache.`);
    } catch (error) {
      console.error(`GeminiService: Errore durante la conversione di "${file.name}":`, error);
      throw error;
    }
  }
  
  console.log(`GeminiService: Preparazione completata, ${fileParts.length} file pronti.`);
  return fileParts;
};

// Funzione ausiliaria per riparare JSON malformato
const attemptToFixJSON = (jsonString) => {
  // Rimuove eventuali caratteri non validi alla fine degli array
  let fixedString = jsonString.replace(/,\s*\]/g, ']');
  
  // Rimuove eventuali virgole extra tra gli oggetti in un array
  fixedString = fixedString.replace(/}\s*,\s*,\s*{/g, "}, {");
  
  // Corregge chiavi non quotate
  fixedString = fixedString.replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3');
  
  // Trova l'ultima parentesi graffa chiusa seguita da una virgola
  const lastBraceIndex = fixedString.lastIndexOf('}');
  const lastBracketIndex = fixedString.lastIndexOf(']');
  const lastValidIndex = Math.max(lastBraceIndex, lastBracketIndex);
  
  if (lastValidIndex > 0) {
    // Rimuovi tutto dopo l'ultima parentesi valida e aggiungi le necessarie chiusure
    const prefix = fixedString.substring(0, lastValidIndex + 1);
    
    // Conta le parentesi aperte e chiuse
    const openBraces = (prefix.match(/\{/g) || []).length;
    const closedBraces = (prefix.match(/\}/g) || []).length;
    const openBrackets = (prefix.match(/\[/g) || []).length;
    const closedBrackets = (prefix.match(/\]/g) || []).length;
    
    // Aggiungi le parentesi mancanti
    let suffix = '';
    for (let i = 0; i < openBrackets - closedBrackets; i++) {
      suffix += ']';
    }
    for (let i = 0; i < openBraces - closedBraces; i++) {
      suffix += '}';
    }
    
    return prefix + suffix;
  }
  
  return fixedString;
};

// --- NUOVO APPROCCIO: Estrazione Indice in passaggi multipli ---
/**
 * Analizza i PDF per estrarre solo la struttura degli argomenti principali
 * @param {string} examName Nome dell'esame
 * @param {File[]} pdfFiles Array di oggetti File PDF
 * @returns {Promise<Array>} Array di titoli degli argomenti principali
 */
const extractMainTopics = async (examName, pdfFiles) => {
  if (!model) throw new Error("Servizio AI non disponibile (Gemini non inizializzato).");
  
  console.log(`GeminiService: Extracting main topics for "${examName}" from ${pdfFiles.length} PDF files...`);
  
  try {
    // Usa i file già preparati in cache se possibile
    const fileParts = [];
    for (const file of pdfFiles) {
      const fileId = `${file.name}-${file.size}`;
      if (pdfCache.has(fileId)) {
        fileParts.push(pdfCache.get(fileId));
      } else {
        console.log(`Processing file for topic extraction: ${file.name}`);
        const filePart = await createFilePartFromPDF(file);
        pdfCache.set(fileId, filePart); // Memorizza in cache
        fileParts.push(filePart);
      }
    }
    
    // Prompt semplificato per estrarre solo i titoli principali
    const textPart = {
      text: `
      Sei un assistente specializzato nell'analisi di materiale didattico.
      Analizza i PDF allegati relativi all'esame di "${examName}".
      
      Identifica SOLO gli argomenti PRINCIPALI trattati nei PDF. Crea un elenco di titoli senza gerarchie o sottotitoli.
      
      Rispondi SOLO con un array JSON di titoli nel seguente formato:
      ["Argomento 1", "Argomento 2", "Argomento 3", ...]
      
      Non aggiungere spiegazioni o altri dettagli. Rispondi SOLO con l'array JSON.
      `
    };
    
    const parts = [textPart, ...fileParts];
    const result = await model.generateContent({
      contents: [{ role: "user", parts: parts }],
      generationConfig: {
        temperature: 0.1, // Temperatura più bassa per risposte più deterministiche
        maxOutputTokens: 2048,
      }
    });
    
    const responseText = result.response.text().trim();
    console.log("RISPOSTA ESTRAZIONE TITOLI:", responseText);
    
    // Estrai l'array JSON
    let jsonString = responseText;
    
    // Rimuovi backticks se presenti
    const jsonMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      jsonString = jsonMatch[1];
    }
    
    // Trova e estrai l'array
    const arrayMatch = jsonString.match(/\[\s*".*"\s*(?:,\s*".*"\s*)*\]/);
    if (arrayMatch) {
      jsonString = arrayMatch[0];
    }
    
    try {
      const topics = JSON.parse(jsonString);
      if (Array.isArray(topics) && topics.length > 0) {
        console.log(`GeminiService: Successfully extracted ${topics.length} main topics`);
        return topics;
      } else {
        throw new Error("Risultato non è un array valido");
      }
    } catch (parseError) {
      console.error("GeminiService: Errore parsing elenco argomenti:", parseError);
      
      // Tentativo di riparazione
      try {
        const fixedJsonString = attemptToFixJSON(jsonString);
        const topics = JSON.parse(fixedJsonString);
        if (Array.isArray(topics) && topics.length > 0) {
          console.warn("GeminiService: Array argomenti riparato con successo");
          return topics;
        }
      } catch (repairError) {
        console.error("GeminiService: Impossibile riparare JSON:", repairError);
      }
      
      // Fallback: estrazione manuale dei titoli
      const manualTopics = responseText
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => {
          // Rimuovi numeri, trattini, asterischi e altri caratteri di elenco all'inizio
          return line.replace(/^[\d\-\*\.\s"]+/, '').replace(/["\s]+$/, '').trim();
        })
        .filter(title => title.length > 0);
      
      if (manualTopics.length > 0) {
        console.warn("GeminiService: Fallback a estrazione manuale, trovati", manualTopics.length, "argomenti");
        return manualTopics;
      }
      
      throw new Error("Impossibile estrarre argomenti principali dal materiale");
    }
  } catch (error) {
    console.error("GeminiService: Errore estrazione argomenti principali:", error);
    throw new Error("Errore durante estrazione argomenti: " + error.message);
  }
};

/**
 * Ottiene informazioni dettagliate su un argomento specifico
 * @param {string} topicTitle Titolo dell'argomento
 * @param {string} examName Nome dell'esame
 * @param {File[]} pdfFiles Array di oggetti File PDF
 * @returns {Promise<Object>} Informazioni dettagliate sull'argomento
 */
const getTopicDetails = async (topicTitle, examName, pdfFiles) => {
  if (!model) throw new Error("Servizio AI non disponibile (Gemini non inizializzato).");
  
  console.log(`GeminiService: Getting details for topic "${topicTitle}"...`);
  
  try {
    // Usa i file già preparati in cache se possibile
    const fileParts = [];
    for (const file of pdfFiles) {
      const fileId = `${file.name}-${file.size}`;
      if (pdfCache.has(fileId)) {
        fileParts.push(pdfCache.get(fileId));
      } else {
        const filePart = await createFilePartFromPDF(file);
        pdfCache.set(fileId, filePart); // Memorizza in cache
        fileParts.push(filePart);
      }
    }
    
    // Prompt specifico per ottenere dettagli su questo argomento
    const textPart = {
      text: `
      Analizza i PDF allegati relativi all'esame di "${examName}".
      
      Concentrati ESCLUSIVAMENTE sull'argomento: "${topicTitle}"
      
      Determina:
      1. In quale file PDF specifico si trova questo argomento (nome esatto del file)
      2. A quale numero di pagina inizia la trattazione di questo argomento
      3. Quali sono i sotto-argomenti associati a questo argomento principale
      
      Rispondi ESCLUSIVAMENTE in questo formato JSON:
      {
        "sourceFile": "nome_preciso_del_file.pdf",
        "startPage": 42,
        "subTopics": ["Sotto-argomento 1", "Sotto-argomento 2"]
      }
      
      Assicurati che:
      - "sourceFile" sia il nome ESATTO di uno dei file PDF forniti
      - "startPage" sia un numero intero che indica la pagina di inizio dell'argomento
      - "subTopics" sia un array di stringhe con i sotto-argomenti (anche vuoto se non ci sono sotto-argomenti)
      `
    };
    
    const parts = [textPart, ...fileParts];
    const result = await model.generateContent({
      contents: [{ role: "user", parts: parts }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
      }
    });
    
    const responseText = result.response.text().trim();
    console.log(`RISPOSTA DETTAGLI "${topicTitle}":`, responseText);
    
    // Estrai il JSON
    let jsonString = responseText;
    
    // Rimuovi backticks se presenti
    const jsonMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      jsonString = jsonMatch[1];
    } else {
      // Trova l'oggetto JSON nel testo
      const firstBracket = jsonString.indexOf('{');
      const lastBracket = jsonString.lastIndexOf('}');
      if (firstBracket !== -1 && lastBracket > firstBracket) {
        jsonString = jsonString.substring(firstBracket, lastBracket + 1);
      }
    }
    
    try {
      const topicDetails = JSON.parse(jsonString);
      
      // Validazione dei campi necessari
      if (!topicDetails.sourceFile) {
        console.warn(`GeminiService: Manca sourceFile per "${topicTitle}"`);
        // Assegna un file di default (primo file)
        if (pdfFiles.length > 0) {
          topicDetails.sourceFile = pdfFiles[0].name;
        }
      }
      
      if (!topicDetails.startPage || typeof topicDetails.startPage !== 'number') {
        console.warn(`GeminiService: Manca startPage valida per "${topicTitle}"`);
        // Assegna una pagina di default
        topicDetails.startPage = 1;
      }
      
      if (!topicDetails.subTopics || !Array.isArray(topicDetails.subTopics)) {
        topicDetails.subTopics = [];
      }
      
      // Formato il risultato in modo consistente
      return {
        title: topicTitle,
        sourceFile: topicDetails.sourceFile,
        startPage: topicDetails.startPage,
        subTopics: topicDetails.subTopics.map(sub => ({ title: sub }))
      };
      
    } catch (parseError) {
      console.error(`GeminiService: Errore parsing dettagli per "${topicTitle}":`, parseError);
      
      // Tentativo di riparazione
      try {
        const fixedJsonString = attemptToFixJSON(jsonString);
        const repaired = JSON.parse(fixedJsonString);
        
        return {
          title: topicTitle,
          sourceFile: repaired.sourceFile || (pdfFiles.length > 0 ? pdfFiles[0].name : "sconosciuto.pdf"),
          startPage: repaired.startPage || 1,
          subTopics: (repaired.subTopics || []).map(sub => ({ title: sub }))
        };
      } catch (repairError) {
        // Fallback con valori di default
        return {
          title: topicTitle,
          sourceFile: pdfFiles.length > 0 ? pdfFiles[0].name : "sconosciuto.pdf",
          startPage: 1,
          subTopics: []
        };
      }
    }
  } catch (error) {
    console.error(`GeminiService: Errore ottenimento dettagli per "${topicTitle}":`, error);
    
    // Fallback con valori di default
    return {
      title: topicTitle,
      sourceFile: pdfFiles.length > 0 ? pdfFiles[0].name : "sconosciuto.pdf",
      startPage: 1,
      subTopics: []
    };
  }
};

// --- Funzione Principal: Genera Indice Contenuti con Approccio Multi-Step ---
/**
 * Chiede all'AI di generare un indice strutturato degli argomenti dai file PDF forniti.
 * Usa un approccio multi-step per maggiore affidabilità.
 * @param {string} examName Nome dell'esame.
 * @param {File[]} pdfFiles Array di oggetti File PDF.
 * @returns {Promise<object>} Risolve con l'indice JSON { tableOfContents: [...] }.
 * @throws {Error} Se l'API fallisce o il parsing JSON fallisce.
 */
export const generateContentIndexFromPDFs = async (examName, pdfFiles) => {
  if (!model) throw new Error("Servizio AI non disponibile (Gemini non inizializzato).");
  if (!pdfFiles || pdfFiles.length === 0) throw new Error("Nessun file PDF fornito.");

  console.log(`GeminiService: Generating content index for "${examName}" using multi-step approach...`);

  try {
    // Prima prepara i file PDF una sola volta
    await prepareFilesOnce(pdfFiles);
    
    // Step 1: Ottieni i titoli degli argomenti principali
    const mainTopics = await extractMainTopics(examName, pdfFiles);
    console.log(`GeminiService: Step 1 - Extracted ${mainTopics.length} main topics`);
    
    // Step 2: Per ogni argomento, ottieni i dettagli (file, pagina, sotto-argomenti)
    const tableOfContents = [];
    for (const topicTitle of mainTopics) {
      console.log(`GeminiService: Step 2 - Getting details for topic "${topicTitle}"`);
      try {
        const topicDetails = await getTopicDetails(topicTitle, examName, pdfFiles);
        tableOfContents.push(topicDetails);
        console.log(`GeminiService: Details for "${topicTitle}" - File: ${topicDetails.sourceFile}, Page: ${topicDetails.startPage}, SubTopics: ${topicDetails.subTopics.length}`);
      } catch (detailError) {
        console.error(`GeminiService: Error getting details for "${topicTitle}":`, detailError);
        // Aggiungi comunque l'argomento con informazioni limitate
        tableOfContents.push({
          title: topicTitle,
          sourceFile: pdfFiles[0].name, // Usa il primo file come fallback
          startPage: 1,
          subTopics: []
        });
      }
    }
    
    console.log(`GeminiService: Content index generated successfully with ${tableOfContents.length} topics`);
    return { tableOfContents };
    
  } catch (error) {
    console.error("GeminiService: Errore durante la generazione dell'indice dei contenuti:", error);
    
    // Gestione errore JSON malformato
    if (error.message && error.message.includes('JSON')) {
      try {
        console.log("GeminiService: Tentativo recupero di emergenza per JSON malformato...");
        // Crea un indice fallback basilare per consentire all'app di continuare
        return {
          tableOfContents: pdfFiles.map((file, index) => ({
            title: `Argomento ${index + 1}: ${file.name.replace('.pdf', '')}`,
            sourceFile: file.name,
            startPage: 1,
            subTopics: []
          }))
        };
      } catch (fallbackError) {
        console.error("GeminiService: Anche il fallback è fallito:", fallbackError);
      }
    }
    
    throw new Error("Errore durante generazione indice AI: " + error.message);
  }
};

// --- Funzione 2: Distribuire Argomenti dell'Indice ---
/**
 * Chiede all'AI di distribuire gli argomenti (forniti da un indice) sui giorni di studio.
 * @param {string} examName Nome esame.
 * @param {number} totalDays Giorni totali.
 * @param {Array} tableOfContents Indice generato da generateContentIndexFromPDFs.
 * @param {string} userDescription Note utente.
 * @returns {Promise<object>} Risolve con il piano giornaliero JSON { dailyPlan: [...] }.
 * @throws {Error} Se l'API fallisce o il parsing JSON fallisce.
 */
export const distributeTopicsToDays = async (examName, totalDays, tableOfContents, userDescription = '') => {
    if (!model) throw new Error("Servizio AI non disponibile (Gemini non inizializzato).");
    if (!tableOfContents || tableOfContents.length === 0) {
        throw new Error("Nessun argomento fornito dall'indice da distribuire.");
    }

    const studyDays = Math.max(1, totalDays - (totalDays > 5 ? 2 : (totalDays > 2 ? 1 : 0)));
    const reviewDays = totalDays - studyDays;
    const topicListText = tableOfContents.map((topic, index) => `${index + 1}. ${topic.title}${topic.subTopics && topic.subTopics.length > 0 ? ` (...)` : ''}`).join('\n'); // Meno verboso per il prompt

    const prompt = `
        Sei un pianificatore di studi logico. Hai questo elenco di argomenti principali per l'esame di "${examName}":

        --- ELENCO ARGOMENTI ---
        ${topicListText}
        --- FINE ELENCO ---

        Distribuisci lo studio di questi ${tableOfContents.length} argomenti sui primi ${studyDays} giorni di un piano di ${totalDays} giorni totali. Gli ultimi ${reviewDays} giorni sono per ripasso generale.

        REGOLE:
        1.  Bilancia il numero di argomenti principali per giorno di studio. Se gli argomenti sono facili assegnane di più nello stesso giorno. Se sono più difficili assegnane di meno.
        2.  Mantieni per quanto possibile l'ordine logico dell'elenco.
        3.  TUTTI gli argomenti dell'elenco devono essere assegnati a uno dei ${studyDays} giorni di studio.
        4.  Considera questa nota utente: "${userDescription}".

        Formato di Output Richiesto (JSON ESCLUSIVO):
        {
          "dailyPlan": [
            // Oggetti per giorni di studio (1 a ${studyDays})
            { "day": 1, "assignedTopics": [ { "title": "Titolo Argomento Principale Assegnato" } ] },
            // ... altri giorni studio ...
            // Oggetti per giorni ripasso (${studyDays + 1} a ${totalDays})
            ${reviewDays > 0 ? `
            { "day": ${studyDays + 1}, "assignedTopics": [ { "title": "Ripasso Generale Giorno ${studyDays + 1}" } ] }`
            // Genera gli altri giorni di ripasso se necessario
            .concat(
                 Array.from({ length: reviewDays - 1 }, (_, i) =>
                    `,{ "day": ${studyDays + 2 + i}, "assignedTopics": [ { "title": "Ripasso Generale Giorno ${studyDays + 2 + i}" } ] }`
                 ).join('')
            )
            : ''}
          ]
        }

        Genera ora l'oggetto JSON della distribuzione giornaliera:
    `;

    console.log(`GeminiService: Distributing ${tableOfContents.length} topics over ${studyDays} study days...`);
    console.log(`NUMERO DI GIORNI DI STUDIO " ${studyDays}"`);
    try {
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 4096,
            }
        });
        
        const response = result.response;
        if (!response || response.promptFeedback?.blockReason) { 
           const blockReason = response?.promptFeedback?.blockReason || 'Ragione sconosciuta';
           throw new Error(`Generazione distribuzione bloccata per sicurezza (${blockReason}).`);
        }

        const responseText = response.text();
        console.log("RISPOSTA DISTRIBUZIONE:", responseText);
        
        // Estrai JSON
        let jsonString = responseText.trim();
        const jsonMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) { jsonString = jsonMatch[1]; }
        else {
            const firstBracket = jsonString.indexOf('{');
            if (firstBracket !== -1) { 
                const lastBracket = jsonString.lastIndexOf('}'); 
                jsonString = jsonString.substring(firstBracket, lastBracket > firstBracket ? lastBracket + 1 : undefined); 
            }
            else { 
                throw new Error("Risposta AI per distribuzione non è JSON riconoscibile."); 
            }
        }

        try {
            // Tentativo di parsing normale
            let parsedDistribution;
            try {
                parsedDistribution = JSON.parse(jsonString);
            } catch (initialParseError) {
                console.warn("GeminiService: Errore nel parsing JSON iniziale, tentativo di riparazione...");
                // Tenta di riparare JSON malformato
                const fixedJson = attemptToFixJSON(jsonString);
                parsedDistribution = JSON.parse(fixedJson);
                console.log("GeminiService: JSON riparato con successo.");
            }
            
            if (!parsedDistribution.dailyPlan || !Array.isArray(parsedDistribution.dailyPlan)) {
                throw new Error("JSON distribuzione non contiene 'dailyPlan' array.");
            }
            
            // Aggiungi validazione assegnazione
            const assignedTitles = new Set(parsedDistribution.dailyPlan.flatMap(d => d.assignedTopics?.map(t => t.title?.trim()) || []).filter(Boolean));
            const originalTitles = new Set(tableOfContents.map(t => t.title?.trim()).filter(Boolean));
            let allAssigned = true;
            const unassignedTopics = [];
            
            originalTitles.forEach(title => {
                if (!assignedTitles.has(title)) {
                    console.error(`GeminiService: Argomento "${title}" non assegnato!`);
                    unassignedTopics.push(title);
                    allAssigned = false;
                }
            });
            
            if (!allAssigned) {
                console.error(`GeminiService: ${unassignedTopics.length} argomenti non assegnati!`);
                
                // Correzione automatica: distribuisci argomenti non assegnati
                if (unassignedTopics.length > 0) {
                    console.log("GeminiService: Correzione automatica della distribuzione...");
                    
                    // Distribuisci gli argomenti mancanti sui giorni in modo bilanciato
                    const topicsPerDay = Math.ceil(unassignedTopics.length / studyDays);
                    let topicIndex = 0;
                    
                    for (let day = 1; day <= studyDays && topicIndex < unassignedTopics.length; day++) {
                        const dayPlan = parsedDistribution.dailyPlan.find(d => d.day === day);
                        
                        if (dayPlan) {
                            if (!dayPlan.assignedTopics) dayPlan.assignedTopics = [];
                            
                            // Aggiungi fino a topicsPerDay argomenti a questo giorno
                            for (let i = 0; i < topicsPerDay && topicIndex < unassignedTopics.length; i++) {
                                dayPlan.assignedTopics.push({ title: unassignedTopics[topicIndex] });
                                topicIndex++;
                            }
                        }
                    }
                    
                    console.log("GeminiService: Distribuzione corretta automaticamente");
                }
            }

            console.log("GeminiService: Topic distribution generated successfully.");
            return parsedDistribution;
            
        } catch (parseError) {
            console.error("GeminiService: Errore parsing JSON distribuzione:", parseError, "Stringa:", jsonString);
            
            // Tentativo di riparazione JSON
            try {
                const fixedJsonString = attemptToFixJSON(jsonString);
                const repairedDistribution = JSON.parse(fixedJsonString);
                
                if (!repairedDistribution.dailyPlan || !Array.isArray(repairedDistribution.dailyPlan)) {
                    throw new Error("JSON riparato non contiene 'dailyPlan' array.");
                }
                
                console.log("GeminiService: JSON distribuzione riparato con successo");
                return repairedDistribution;
                
            } catch (repairError) {
                console.error("GeminiService: Impossibile riparare JSON distribuzione:", repairError);
                
                // Generazione fallback manuale della distribuzione
                console.log("GeminiService: Generazione distribuzione fallback...");
                const fallbackDistribution = { dailyPlan: [] };
                
                // Calcola quanti argomenti per giorno
                const topicsPerDay = Math.ceil(tableOfContents.length / studyDays);
                
                // Distribuisci gli argomenti in modo uniforme
                let topicIndex = 0;
                for (let day = 1; day <= studyDays; day++) {
                    const assignedTopics = [];
                    
                    // Aggiungi argomenti a questo giorno
                    for (let i = 0; i < topicsPerDay && topicIndex < tableOfContents.length; i++) {
                        assignedTopics.push({ title: tableOfContents[topicIndex].title });
                        topicIndex++;
                    }
                    
                    fallbackDistribution.dailyPlan.push({ day, assignedTopics });
                }
                
                // Aggiungi giorni di ripasso
                for (let i = 0; i < reviewDays; i++) {
                    fallbackDistribution.dailyPlan.push({
                        day: studyDays + i + 1,
                        assignedTopics: [{ title: `Ripasso Generale Giorno ${studyDays + i + 1}` }]
                    });
                }
                
                console.log("GeminiService: Distribuzione fallback generata");
                return fallbackDistribution;
            }
        }
    } catch (error) {
        console.error("GeminiService: Errore generazione distribuzione AI:", error);
        throw new Error("Errore durante generazione distribuzione AI: " + error.message);
    }
};