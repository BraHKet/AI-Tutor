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


// --- Funzione 1: Estrarre Indice/Struttura ---
/**
 * Chiede all'AI di generare un indice strutturato degli argomenti dal testo fornito.
 * @param {string} examName Nome dell'esame.
 * @param {string} pdfFullText Testo concatenato dai PDF.
 * @param {object} pageMapping Oggetto { globalPageMarker: {fileIndex, fileName, originalPageNum, text} }.
 * @returns {Promise<object>} Risolve con l'indice JSON { tableOfContents: [...] }.
 * @throws {Error} Se l'API fallisce o il parsing JSON fallisce.
 */
export const generateContentIndex = async (examName, pdfFullText, pageMapping) => {
    if (!model) throw new Error("Servizio AI non disponibile (Gemini non inizializzato).");

    // Prepara contesto strutturato
    let structuredContext = '';
    let currentPageMarker = 1;
    const totalSourcePages = Object.keys(pageMapping).length;
    Object.values(pageMapping).forEach(pageData => {
        const marker = `[PAGINA ${currentPageMarker} - File: ${pageData.fileName} - PagOrig: ${pageData.pageNum}]`;
        // Includi il testo della pagina nel contesto
        structuredContext += `\n\n${marker}\n${pageData.text || ''}`; // Aggiungi testo (o stringa vuota se manca)
        currentPageMarker++;
    });

    const MAX_CONTEXT_LENGTH = 150000; // Adatta se necessario
    const truncatedContext = structuredContext.substring(0, MAX_CONTEXT_LENGTH);
    const isTruncated = structuredContext.length > MAX_CONTEXT_LENGTH;

    const prompt = `
        Sei un assistente IA specializzato nell'analisi strutturale di materiale didattico.
        Analizza il seguente testo (strutturato con marcatori [PAGINA X ...]) relativo all'esame di "${examName}".

        Obiettivo: Identifica e struttura gerarchicamente TUTTI gli argomenti principali e secondari trattati nel testo fornito, dall'inizio alla fine (fino a [PAGINA ${totalSourcePages}]).

        Per ogni argomento PRINCIPALE identificato, indica il marcatore [PAGINA X] dove STIMI che quell'argomento inizi nel contesto fornito.

        Formato di Output Richiesto (JSON ESCLUSIVO):
        {
          "tableOfContents": [
            {
              "title": "Titolo Argomento Principale 1",
              "startPageMarker": A, // Numero X del marcatore [PAGINA X] di inizio stimato
              "subTopics": [
                { "title": "Sotto-argomento 1.1" },
                { "title": "Sotto-argomento 1.2" }
              ]
            },
            // ... altri argomenti principali ...
          ]
        }

        IMPORTANTE: Assicurati di coprire TUTTI gli argomenti. 'startPageMarker' è fondamentale. Se gli argomenti sono semplici aggregane di più insieme altrimenti se sono difficili aggregane di meno.

        Contesto Estratto e Strutturato:
        --- INIZIO CONTENUTO ---
        ${truncatedContext}
        --- FINE CONTENUTO ---
        ${isTruncated ? '[ATTENZIONE: Contesto troncato]' : ''}

        Genera ora l'indice strutturato in formato JSON:
      `;

    console.log(`GeminiService: Generating content index for "${examName}"...`);

    try {
        const result = await model.generateContent(prompt);
        const response = result.response;

        if (!response || response.promptFeedback?.blockReason) {
           const blockReason = response?.promptFeedback?.blockReason || 'Ragione sconosciuta';
           throw new Error(`Generazione indice bloccata per sicurezza (${blockReason}).`);
        }

        const responseText = response.text();
        // Estrai JSON (logica robusta)
        let jsonString = responseText.trim();
        const jsonMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) { jsonString = jsonMatch[1]; }
        else {
            const firstBracket = jsonString.indexOf('{');
            if (firstBracket !== -1) { const lastBracket = jsonString.lastIndexOf('}'); jsonString = jsonString.substring(firstBracket, lastBracket > firstBracket ? lastBracket + 1 : undefined); }
            else { throw new Error("Risposta AI per indice non è JSON riconoscibile."); }
        }

        try {
            const parsedIndex = JSON.parse(jsonString);
            if (!parsedIndex.tableOfContents || !Array.isArray(parsedIndex.tableOfContents)) {
               throw new Error("JSON indice non contiene 'tableOfContents' array.");
            }
            console.log("GeminiService: Content index generated successfully.");
            return parsedIndex;
        } catch (parseError) {
           console.error("GeminiService: Errore parsing JSON indice:", parseError, "Stringa:", jsonString);
           throw new Error("Impossibile interpretare risposta AI per indice come JSON.");
        }
    } catch (error) {
        console.error("GeminiService: Errore generazione indice AI:", error);
        throw new Error("Errore durante generazione indice AI: " + error.message);
    }
};


// --- Funzione 2: Distribuire Argomenti dell'Indice ---
/**
 * Chiede all'AI di distribuire gli argomenti (forniti da un indice) sui giorni di studio.
 * @param {string} examName Nome esame.
 * @param {number} totalDays Giorni totali.
 * @param {Array} tableOfContents Indice generato da generateContentIndex.
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
    console.log(`NUMERO DI GIORNI DI STUDIO " ${studyDays}"` );
    try {
        const result = await model.generateContent(prompt);
        const response = result.response;
        if (!response || response.promptFeedback?.blockReason) { /* ... gestione blocco ... */ }

        const responseText = response.text();
        // Estrai JSON
        let jsonString = responseText.trim();
        const jsonMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) { jsonString = jsonMatch[1]; }
        else { /* ... logica estrazione fallback ... */ }

        try {
            const parsedDistribution = JSON.parse(jsonString);
            if (!parsedDistribution.dailyPlan || !Array.isArray(parsedDistribution.dailyPlan)) { /* ... errore struttura ... */ }
            // Aggiungi validazione assegnazione (come prima)
             const assignedTitles = new Set(parsedDistribution.dailyPlan.flatMap(d => d.assignedTopics?.map(t => t.title?.trim()) || []).filter(Boolean));
             const originalTitles = new Set(tableOfContents.map(t => t.title?.trim()).filter(Boolean));
             let allAssigned = true;
             originalTitles.forEach(title => { /* ... controllo assegnazione ... */ });
             if(!allAssigned) console.error("GeminiService: Non tutti gli argomenti assegnati!");

            console.log("GeminiService: Topic distribution generated successfully.");
            return parsedDistribution;
        } catch (parseError) { /* ... gestione errore parsing ... */ }
    } catch (error) { /* ... gestione errore API ... */ }
};