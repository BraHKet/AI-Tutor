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

// --- Funzione 1: Estrarre Indice/Struttura direttamente dai PDF ---
/**
 * Chiede all'AI di generare un indice strutturato degli argomenti dai file PDF forniti.
 * @param {string} examName Nome dell'esame.
 * @param {File[]} pdfFiles Array di oggetti File PDF.
 * @returns {Promise<object>} Risolve con l'indice JSON { tableOfContents: [...] }.
 * @throws {Error} Se l'API fallisce o il parsing JSON fallisce.
 */
export const generateContentIndexFromPDFs = async (examName, pdfFiles) => {
    if (!model) throw new Error("Servizio AI non disponibile (Gemini non inizializzato).");
    if (!pdfFiles || pdfFiles.length === 0) throw new Error("Nessun file PDF fornito.");

    console.log(`GeminiService: Generating content index for "${examName}" from ${pdfFiles.length} direct PDF files...`);

    try {
        // Prepara i files come parts di contenuto per Gemini
        const fileParts = [];
        for (const file of pdfFiles) {
            console.log(`Processing file for Gemini: ${file.name}`);
            const filePart = await createFilePartFromPDF(file);
            fileParts.push(filePart);
        }

        // Prepara il prompt testuale
        const textPart = {
            text: `
            Sei un assistente IA specializzato nell'analisi strutturale di materiale didattico.
            Analizza i PDF allegati relativi all'esame di "${examName}".

            Obiettivo: Identifica e struttura gerarchicamente TUTTI gli argomenti principali e secondari trattati nei PDF forniti.

            Per ogni argomento PRINCIPALE identificato, indica il nome del file PDF e il numero di pagina stimato dove quell'argomento inizia.

            Formato di Output Richiesto (JSON ESCLUSIVO):
            {
              "tableOfContents": [
                {
                  "title": "Titolo Argomento Principale 1",
                  "sourceFile": "Nome del file PDF", 
                  "startPage": X, // Numero di pagina stimato dell'inizio dell'argomento
                  "subTopics": [
                    { "title": "Sotto-argomento 1.1" },
                    { "title": "Sotto-argomento 1.2" }
                  ]
                },
                // ... altri argomenti principali ...
              ]
            }

            IMPORTANTE: Assicurati di coprire TUTTI gli argomenti. 'startPage' e 'sourceFile' sono fondamentali. Se gli argomenti sono semplici aggregane di più insieme altrimenti se sono difficili aggregane di meno.

            Genera ora l'indice strutturato in formato JSON:
            `
        };

        // Combina il prompt testuale con i file PDF
        const parts = [textPart, ...fileParts];
        
        // Invia la richiesta a Gemini
        const result = await model.generateContent({
            contents: [{ role: "user", parts: parts }],
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 4096,
            }
        });

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
        const result = await model.generateContent(prompt);
        const response = result.response;
        if (!response || response.promptFeedback?.blockReason) { 
           const blockReason = response?.promptFeedback?.blockReason || 'Ragione sconosciuta';
           throw new Error(`Generazione distribuzione bloccata per sicurezza (${blockReason}).`);
        }

        const responseText = response.text();
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
            const parsedDistribution = JSON.parse(jsonString);
            if (!parsedDistribution.dailyPlan || !Array.isArray(parsedDistribution.dailyPlan)) {
                throw new Error("JSON distribuzione non contiene 'dailyPlan' array.");
            }
            // Aggiungi validazione assegnazione
            const assignedTitles = new Set(parsedDistribution.dailyPlan.flatMap(d => d.assignedTopics?.map(t => t.title?.trim()) || []).filter(Boolean));
            const originalTitles = new Set(tableOfContents.map(t => t.title?.trim()).filter(Boolean));
            let allAssigned = true;
            originalTitles.forEach(title => {
                if (!assignedTitles.has(title)) {
                    console.error(`GeminiService: Argomento "${title}" non assegnato!`);
                    allAssigned = false;
                }
            });
            if(!allAssigned) console.error("GeminiService: Non tutti gli argomenti assegnati!");

            console.log("GeminiService: Topic distribution generated successfully.");
            return parsedDistribution;
        } catch (parseError) {
            console.error("GeminiService: Errore parsing JSON distribuzione:", parseError, "Stringa:", jsonString);
            throw new Error("Impossibile interpretare risposta AI per distribuzione come JSON.");
        }
    } catch (error) {
        console.error("GeminiService: Errore generazione distribuzione AI:", error);
        throw new Error("Errore durante generazione distribuzione AI: " + error.message);
    }
};