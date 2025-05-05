// src/utils/gemini.js
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

// Funzione initGeminiAI (invariata, usa chiave diretta o process.env)
function initGeminiAI() {
  try {
    const apiKey = "AIzaSyCkw0bYs0jEa5La26hcWWQyGhBFSxhbdVU"; // O process.env.REACT_APP_GEMINI_API_KEY
    if (!apiKey || apiKey.includes("INCOLLA_QUI") || apiKey.length < 10) {
      console.error("*********************************************************************");
      console.error("ERRORE: Chiave API Gemini mancante o non valida in src/utils/gemini.js!");
      console.error("*********************************************************************");
      return null;
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" /* ... opzioni ... */ });
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
 * @param {object} pageMapping Oggetto { globalPageMarker: {fileIndex, fileName, originalPageNum} }.
 * @returns {Promise<object>} Risolve con l'indice JSON { tableOfContents: [...] }.
 * @throws {Error} Se l'API fallisce o il parsing JSON fallisce.
 */
export const generateContentIndex = async (examName, pdfFullText, pageMapping) => {
  if (!model) throw new Error("Servizio AI non disponibile (Gemini non inizializzato).");

  // Prepara contesto strutturato (come prima)
  let structuredContext = '';
  let currentPageMarker = 1;
  const totalSourcePages = Object.keys(pageMapping).length;
  Object.values(pageMapping).forEach(pageData => {
       const marker = `[PAGINA ${currentPageMarker} - File: ${pageData.fileName} - PagOrig: ${pageData.pageNum}]`;
       structuredContext += `\n\n${marker}\n${pageData.text}`; // Usa il testo originale mappato
       currentPageMarker++;
   });

  const MAX_CONTEXT_LENGTH = 150000;
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
            // ... altri sotto-argomenti opzionali ...
          ]
        },
        {
          "title": "Titolo Argomento Principale 2",
          "startPageMarker": B,
          "subTopics": [ /* ... */ ]
        }
        // ... altri argomenti principali fino alla fine del materiale ...
      ]
    }

    IMPORTANTE: Assicurati di coprire TUTTI gli argomenti fino alla fine del contesto fornito. 'startPageMarker' è fondamentale.

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
    // Estrai JSON (usa la stessa logica robusta di prima)
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
      return parsedIndex; // Restituisce l'indice { tableOfContents: [...] }
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

    // Calcola giorni studio/ripasso
    const studyDays = Math.max(1, totalDays - (totalDays > 5 ? 2 : (totalDays > 2 ? 1 : 0)));
    const reviewDays = totalDays - studyDays;

    // Prepara una rappresentazione testuale semplice dell'indice per il prompt
    const topicListText = tableOfContents.map((topic, index) =>
        `${index + 1}. ${topic.title}${topic.subTopics && topic.subTopics.length > 0 ? ` (include: ${topic.subTopics.map(st => st.title).join(', ')})` : ''}`
    ).join('\n');

    // Stima "lunghezza" approssimativa di ogni topic principale (distanza tra startPageMarker)
    const topicLengths = tableOfContents.map((topic, index, arr) => {
        const start = topic.startPageMarker || 0;
        const nextStart = (index + 1 < arr.length) ? (arr[index + 1].startPageMarker || start) : Infinity; // Stima fine basata sul successivo
        const length = Math.max(1, nextStart - start); // Almeno 1 pagina
        return { title: topic.title, estimatedLength: length };
    });
    // console.log("Estimated Topic Lengths:", topicLengths); // Debug

    const prompt = `
        Sei un pianificatore di studi logico ed efficiente.
        Hai a disposizione il seguente elenco di argomenti principali identificati per l'esame di "${examName}":

        --- ELENCO ARGOMENTI ---
        ${topicListText}
        --- FINE ELENCO ---

        Il tuo compito è distribuire lo studio di questi ${tableOfContents.length} argomenti principali sui primi ${studyDays} giorni di un piano di ${totalDays} giorni totali.
        Gli ultimi ${reviewDays} giorni (${reviewDays > 0 ? `giorni ${studyDays + 1}-${totalDays}` : 'Nessun giorno dedicato'}) sono esclusivamente per il ripasso generale.

        **REGOLE DI DISTRIBUZIONE:**
        1.  **Bilanciamento:** Distribuisci gli argomenti in modo che il carico di lavoro sia il più possibile BILANCIATO tra i ${studyDays} giorni di studio. Considera che alcuni argomenti potrebbero essere più lunghi o complessi di altri (puoi usare l'ordine come indicazione approssimativa). Evita di sovraccaricare gli ultimi giorni di studio.
        2.  **Ordine Logico:** Mantieni per quanto possibile l'ordine logico degli argomenti presentato nell'elenco.
        3.  **Copertura:** Assicurati che TUTTI gli argomenti dell'elenco siano assegnati a uno dei ${studyDays} giorni di studio.
        4.  **Note Utente:** Considera questa nota: "${userDescription}".

        **Formato di Output Richiesto (JSON ESCLUSIVO):**
        {
          "dailyPlan": [
            // Oggetti per giorni di studio (1 a ${studyDays})
            {
              "day": 1,
              "assignedTopics": [
                { "title": "Titolo Argomento Principale Assegnato" }, // Solo il titolo come riferimento
                { "title": "Altro Titolo Argomento Assegnato" }
              ]
            },
            // ... altri giorni di studio ...
            // Oggetti per giorni di ripasso (${studyDays + 1} a ${totalDays}, se reviewDays > 0)
            ${reviewDays > 0 ? `
            {
              "day": ${studyDays + 1},
              "assignedTopics": [ { "title": "Ripasso Generale Giorno ${studyDays + 1}" } ]
            }`.repeat(reviewDays).replace(/,\s*$/, '') : ''}
          ]
        }

        Genera ora l'oggetto JSON della distribuzione giornaliera:
    `;

    console.log(`GeminiService: Distributing ${tableOfContents.length} topics over ${studyDays} study days...`);
    try {
        const result = await model.generateContent(prompt);
        const response = result.response;

         if (!response || response.promptFeedback?.blockReason) {
           const blockReason = response?.promptFeedback?.blockReason || 'Ragione sconosciuta';
           throw new Error(`Distribuzione argomenti bloccata per sicurezza (${blockReason}).`);
         }

        const responseText = response.text();
        // Estrai JSON
        let jsonString = responseText.trim();
        const jsonMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) { jsonString = jsonMatch[1]; }
         else {
             const firstBracket = jsonString.indexOf('{');
             if (firstBracket !== -1) { const lastBracket = jsonString.lastIndexOf('}'); jsonString = jsonString.substring(firstBracket, lastBracket > firstBracket ? lastBracket + 1 : undefined); }
             else { throw new Error("Risposta AI per distribuzione non è JSON riconoscibile."); }
         }

        try {
            const parsedDistribution = JSON.parse(jsonString);
            if (!parsedDistribution.dailyPlan || !Array.isArray(parsedDistribution.dailyPlan)) {
                throw new Error("JSON distribuzione non contiene 'dailyPlan' array.");
            }
            // Validazione aggiuntiva: controlla se tutti i topic originali sono stati assegnati
            const assignedTitles = new Set(parsedDistribution.dailyPlan.flatMap(d => d.assignedTopics?.map(t => t.title) || []));
            const originalTitles = new Set(tableOfContents.map(t => t.title));
            let allAssigned = true;
            originalTitles.forEach(title => {
                if (!assignedTitles.has(title) && !title.toLowerCase().includes("ripasso")) { // Ignora i titoli di ripasso
                    console.warn(`GeminiService: Topic "${title}" dall'indice non trovato nel piano distribuito!`);
                    allAssigned = false;
                }
            });
             if (!allAssigned) {
                console.error("GeminiService: Non tutti gli argomenti dell'indice sono stati assegnati ai giorni di studio nel piano generato.");
                 // Potresti lanciare un errore o solo avvisare
                 // throw new Error("L'AI non ha assegnato tutti gli argomenti ai giorni di studio.");
             }

            console.log("GeminiService: Topic distribution generated successfully.");
            return parsedDistribution; // Restituisce { dailyPlan: [...] } con assignedTopics
        } catch (parseError) {
            console.error("GeminiService: Errore parsing JSON distribuzione:", parseError, "Stringa:", jsonString);
            throw new Error("Impossibile interpretare risposta AI per distribuzione come JSON.");
        }
    } catch (error) {
        console.error("GeminiService: Errore distribuzione argomenti AI:", error);
        throw new Error("Errore durante distribuzione argomenti AI: " + error.message);
    }
};