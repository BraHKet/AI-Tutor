// src/utils/gemini.js
import { genAI, model as geminiDefaultModel } from './geminiSetup'; // Assicurati che geminiSetup.js sia corretto

/**
 * Converte un oggetto File JavaScript in una "parte" per l'API Gemini,
 * includendo i dati del file codificati in base64.
 * @param {File} file L'oggetto File da convertire.
 * @returns {Promise<object>} Una promessa che risolve con l'oggetto "parte" per Gemini.
 */
async function fileToGenerativePart(file) {
  const base64EncodedData = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result && typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]); // Estrai solo la parte base64
      } else {
        reject(new Error('FileReader result is null or not a string'));
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: {
      data: base64EncodedData,
      mimeType: file.type || 'application/pdf',
    },
  };
}

/**
 * Migliora il prompt per la generazione dell'indice di contenuti per evitare sovrapposizioni di pagine.
 * @param {string} examName Il nome dell'esame.
 * @param {File[]} filesArray Array di oggetti File (i PDF da analizzare).
 * @param {object[]} originalFilesDriveInfo Array di oggetti con info sui file caricati su Drive (name, driveFileId, type, originalFileIndex).
 * @param {string} [userDescription=""] Note aggiuntive dall'utente.
 * @returns {Promise<object>} Un oggetto contenente { tableOfContents: [], pageMapping: {} }
 */
export const generateContentIndex = async (examName, filesArray, originalFilesDriveInfo, userDescription = "") => {
  console.log('generateContentIndex: Analyzing PDF files directly with Gemini...', { examName, numFiles: filesArray.length });

  if (!genAI || !geminiDefaultModel) {
    console.error('generateContentIndex: Gemini AI service (genAI or model) is not initialized.');
    throw new Error('Servizio AI Gemini non inizializzato correttamente.');
  }
  if (!filesArray || filesArray.length === 0) {
    console.error('generateContentIndex: No PDF files provided for AI analysis.');
    throw new Error('Nessun file PDF fornito per l\'analisi AI.');
  }

  try {
    const textForPrompt = `Sei un assistente AI esperto nell'analisi di materiale didattico PDF e nella creazione di piani di studio efficaci.
Il nome dell'esame è: "${examName}".

COMPITO: Analizza approfonditamente il contenuto dei seguenti documenti PDF forniti per estrarre un indice dettagliato degli argomenti principali, evitando sovrapposizioni tra argomenti e assicurando una suddivisione logica delle pagine.

REGOLE IMPORTANTI PER LA SUDDIVISIONE DEGLI ARGOMENTI:
1. Ogni argomento deve corrispondere a una sezione logica e distinta del materiale.
2. Gli argomenti devono essere MUTUAMENTE ESCLUSIVI - le pagine assegnate a un argomento non devono sovrapporsi con quelle assegnate ad altri argomenti.
3. Evita di duplicare gli stessi argomenti con nomi diversi.
4. Ogni pagina del PDF deve essere assegnata al massimo a UN SOLO argomento.
5. Gli intervalli di pagine devono essere contigui per ogni argomento (es. pagine 1-5, non 1,3,5).

REGOLE SPECIFICHE PER LA DIMENSIONE E COERENZA DEGLI ARGOMENTI:
1. DIMENSIONE IDEALE: Ogni argomento dovrebbe idealmente comprendere tra 8 e 15 pagine.
2. DIMENSIONE MINIMA: Evita argomenti troppo piccoli (meno di 5 pagine), a meno che non si tratti di sezioni chiaramente distinte come introduzioni o appendici.
3. DIMENSIONE MASSIMA: Evita argomenti troppo grandi (più di 20 pagine). Se una sezione è più lunga, suddividila in sotto-argomenti logici.
4. COERENZA CONCETTUALE: Ogni argomento deve rappresentare un'unità concettuale coerente, non solo una suddivisione arbitraria di pagine.
5. RICONOSCIMENTO DELLA STRUTTURA: Utilizza titoli di capitoli, sezioni e sottosezioni presenti nei PDF per guidare la suddivisione.
6. NUMERO TOTALE DI ARGOMENTI: Mira a creare tra 5 e 15 argomenti totali, per rendere il piano di studio gestibile.

Per CIASCUN argomento identificato, devi indicare:
1. Un titolo conciso e specifico per l'argomento (max 100 caratteri).
2. Una breve descrizione o una lista di sotto-punti chiave dell'argomento (massimo 150 caratteri).
3. Un array "pages_info" che specifichi, per ogni sezione di PDF che copre l'argomento:
   - "original_filename": il nome del file PDF originale.
   - "pdf_index": l'indice (0-based) del file PDF nell'array di input.
   - "start_page": il numero di pagina (1-based) dove inizia l'argomento.
   - "end_page": il numero di pagina (1-based) dove termina l'argomento.

Elenco dei documenti PDF forniti (corrispondono alle parti file che riceverai dopo questo testo):
${originalFilesDriveInfo.map((fInfo, index) => `- PDF Indice ${index}: ${fInfo.name}`).join('\n      ')}

${userDescription ? `QUESTE SONO LE NOTE DELL'UTENTE.. DEVONO ESSERE MESSE AL PRIMO POSTO COME RICHIESTE: "${userDescription}"` : ''}

Restituisci il risultato ESCLUSIVAMENTE in formato JSON. L'oggetto JSON radice deve contenere una chiave "tableOfContents".
"tableOfContents" deve essere un array di oggetti, dove ogni oggetto rappresenta un argomento principale e ha la seguente struttura:
{
  "title": "Titolo Argomento",
  "description": "Descrizione o sotto-punti.",
  "pages_info": [
    { "original_filename": "nome_del_file_originale.pdf", "pdf_index": 0, "start_page": 10, "end_page": 15 }
  ]
}

NOTA FINALE: L'analisi deve produrre argomenti ben separati senza sovrapposizioni di pagine. Se un argomento termina alla pagina 15, il successivo dovrebbe iniziare dalla pagina 16. Questo è CRUCIALE per una corretta suddivisione del materiale di studio.
`;

    // Inizializza l'array `partsArray` con la parte testuale
    const partsArray = [
      { text: textForPrompt } // Oggetto Part per il testo
    ];

    // Aggiungi ogni file PDF come un oggetto Part separato
    for (let i = 0; i < filesArray.length; i++) {
      const file = filesArray[i];
      const driveInfo = originalFilesDriveInfo.find(df => df.originalFileIndex === i);

      // Assicurati che il file sia un PDF e che ci siano informazioni corrispondenti da Drive
      if (file.type === "application/pdf" && driveInfo && driveInfo.name === file.name) {
        console.log(`generateContentIndex: Preparing file part for ${file.name} (index ${i})`);
        try {
          const filePart = await fileToGenerativePart(file); // Restituisce {inlineData: {...}}
          partsArray.push(filePart);
        } catch (fileConvError) {
          console.error(`Errore durante la conversione del file ${file.name} in GenerativePart:`, fileConvError);
          // Considera se vuoi interrompere o solo loggare e continuare senza questo file
        }
      } else {
        console.warn(`generateContentIndex: File ${file.name} (index ${i}) non è un PDF valido o info non corrispondenti, verrà saltato. File type: ${file.type}. DriveInfo: ${JSON.stringify(driveInfo)}`);
      }
    }

    // Verifica che ci siano parti da inviare oltre al testo, se dei PDF erano previsti
    const validPdfFilesSent = partsArray.length - 1; // -1 per la parte testuale
    const expectedPdfFiles = filesArray.filter(f => f.type === "application/pdf").length;

    if (expectedPdfFiles > 0 && validPdfFilesSent < expectedPdfFiles) {
        console.warn(`generateContentIndex: Attesi ${expectedPdfFiles} PDF, ma solo ${validPdfFilesSent} sono stati preparati per l'invio. Controllare errori di conversione file.`);
        // Potrebbe essere necessario lanciare un errore se nessun PDF valido è stato aggiunto
        if (validPdfFilesSent === 0) {
            throw new Error('Nessun file PDF valido è stato preparato per l\'analisi AI, nonostante fossero presenti.');
        }
    }
    if (expectedPdfFiles === 0 && partsArray.length === 1) {
        console.warn("generateContentIndex: Nessun PDF fornito, si invierà solo il testo del prompt (improbabile per questo caso d'uso).");
    }

    console.log(`generateContentIndex: Sending prompt to Gemini with ${partsArray.length} parts. First part text length: ${partsArray[0].text?.length}. File parts: ${validPdfFilesSent}`);
    if (partsArray.length > 1 && partsArray[1] && partsArray[1].inlineData) {
        console.log(`generateContentIndex: Second part (first file) mimeType: ${partsArray[1].inlineData.mimeType}, data length: ${partsArray[1].inlineData.data?.length}`);
    }

    const generationConfig = {
        responseMimeType: "application/json", // Richiedi esplicitamente JSON come output
        temperature: 0.1, // Temperatura bassa per risposte più deterministiche
        maxOutputTokens: 8192, // Aumenta per garantire output completo
    };

    // Struttura corretta per la richiesta a generateContent
    const requestPayload = {
      contents: [
        {
          role: "user", // o "model" se stai continuando una conversazione
          parts: partsArray // L'array di oggetti Part (testo, file, file, ...)
        }
      ],
      generationConfig
    };

    const result = await geminiDefaultModel.generateContent(requestPayload);
    const response = result.response;

    let textResponse;
    // L'SDK con responseMimeType: "application/json" dovrebbe popolare response.text() con l'oggetto JSON parsato
    // o response.candidates[0].content.parts[0].text con la stringa JSON.
    if (response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts && response.candidates[0].content.parts[0] && response.candidates[0].content.parts[0].text) {
        textResponse = response.candidates[0].content.parts[0].text; // Dovrebbe essere una stringa JSON
        console.log('generateContentIndex: AI Response Text (from candidate part):', textResponse);
    } else {
        // Fallback, o se l'SDK ha un comportamento leggermente diverso
        textResponse = response.text(); // Questo potrebbe essere già l'oggetto se l'SDK ha parsato per te
        console.log('generateContentIndex: AI Response (from response.text()):', typeof textResponse === 'string' ? textResponse.substring(0, 200) + "..." : textResponse);
    }

    let parsedResponse;
    try {
      if (typeof textResponse === 'string') {
        const cleanedTextResponse = textResponse.replace(/^```json\s*|```\s*$/g, '').trim();
        if (!cleanedTextResponse) {
            throw new Error("L'AI ha restituito una stringa vuota dopo la pulizia del JSON.");
        }
        parsedResponse = JSON.parse(cleanedTextResponse);
      } else if (typeof textResponse === 'object' && textResponse !== null) { // Assicurati che non sia null
        parsedResponse = textResponse; // Già parsato dall'SDK (grazie a responseMimeType)
        console.log("generateContentIndex: AI response era già un oggetto parsato.");
      } else {
        throw new Error(`Tipo di risposta AI non riconosciuto o nullo: ${typeof textResponse}`);
      }
    } catch (e) {
      console.error("generateContentIndex: Failed to parse AI JSON response:", e, "\nRaw/Cleaned response was:", textResponse);
      throw new Error(`L'AI non ha restituito un JSON valido. Dettagli: ${e.message}`);
    }

    if (!parsedResponse.tableOfContents || !Array.isArray(parsedResponse.tableOfContents)) {
      console.error("generateContentIndex: AI response missing 'tableOfContents' array or not an array.", parsedResponse);
      throw new Error("La risposta dell'AI non contiene un 'tableOfContents' valido o non è un array.");
    }

    // Validazione e pulizia dei dati ricevuti
    parsedResponse.tableOfContents.forEach((topic, topicIdx) => {
        if (!topic.title || !topic.pages_info || !Array.isArray(topic.pages_info)) {
            console.warn(`generateContentIndex: Topic ${topicIdx} ("${topic.title || 'SENZA TITOLO'}") ha una struttura invalida (manca title o pages_info).`, topic);
        }
        topic.pages_info.forEach((pInfo, pIdx) => {
            if (typeof pInfo.pdf_index !== 'number' || typeof pInfo.start_page !== 'number' || typeof pInfo.end_page !== 'number' || !pInfo.original_filename) {
                console.warn(`generateContentIndex: pages_info[${pIdx}] per topic "${topic.title || 'SENZA TITOLO'}" ha una struttura invalida.`, pInfo);
            }
            if (pInfo.pdf_index < 0 || pInfo.pdf_index >= originalFilesDriveInfo.length) {
                console.warn(`generateContentIndex: pages_info[${pIdx}] per topic "${topic.title || 'SENZA TITOLO'}" ha un pdf_index (${pInfo.pdf_index}) non valido.`);
                // Potresti voler invalidare questa specifica pInfo
                pInfo.pdf_index = -1; // Segnala come invalido
            } else {
                // Assicurati che il nome del file sia corretto
                pInfo.original_filename = originalFilesDriveInfo[pInfo.pdf_index].name;
            }
        });
        // Filtra le pages_info invalide (quelle con pdf_index = -1)
        topic.pages_info = topic.pages_info.filter(pInfo => pInfo.pdf_index !== -1);
    });

    // NUOVA FUNZIONALITÀ: Verifica e correggi sovrapposizioni di pagine
    const pageAssignments = new Map(); // Map di pdf_index -> Map(pageNumber -> topicTitle)
    const overlappingPages = []; // Array per tenere traccia delle pagine con sovrapposizioni

    // Primo passo: Raccogli tutte le assegnazioni di pagine
    parsedResponse.tableOfContents.forEach(topic => {
        topic.pages_info.forEach(pInfo => {
            const pdfIndex = pInfo.pdf_index;
            if (!pageAssignments.has(pdfIndex)) {
                pageAssignments.set(pdfIndex, new Map());
            }
            
            const pageMap = pageAssignments.get(pdfIndex);
            for (let pageNum = pInfo.start_page; pageNum <= pInfo.end_page; pageNum++) {
                if (pageMap.has(pageNum)) {
                    // C'è una sovrapposizione
                    overlappingPages.push({
                        pdfIndex,
                        pageNum,
                        topics: [pageMap.get(pageNum), topic.title]
                    });
                }
                pageMap.set(pageNum, topic.title);
            }
        });
    });

    // Secondo passo: Stampa avviso se ci sono sovrapposizioni
    if (overlappingPages.length > 0) {
        console.warn(`generateContentIndex: Rilevate ${overlappingPages.length} pagine con sovrapposizioni:`, 
            overlappingPages.slice(0, 5), // Mostra solo le prime 5 per brevità
            overlappingPages.length > 5 ? `... e altre ${overlappingPages.length - 5}` : '');
        
        // Terzo passo: Correggi le sovrapposizioni - strategia "primo arrivato, primo servito"
        // Ordina argomenti per dimensione (dal più piccolo al più grande)
        const sortedTopics = [...parsedResponse.tableOfContents]
            .sort((a, b) => {
                const pagesA = a.pages_info.reduce((sum, p) => sum + (p.end_page - p.start_page + 1), 0);
                const pagesB = b.pages_info.reduce((sum, p) => sum + (p.end_page - p.start_page + 1), 0);
                return pagesA - pagesB;
            });
        
        // Reset mappa pagine
        pageAssignments.clear();
        const correctedPageAssignments = new Map();
        
        // Riassegna pagine senza sovrapposizioni
        for (const topic of sortedTopics) {
            const newPagesInfo = [];
            
            for (const pInfo of topic.pages_info) {
                const pdfIndex = pInfo.pdf_index;
                if (!correctedPageAssignments.has(pdfIndex)) {
                    correctedPageAssignments.set(pdfIndex, new Map());
                }
                
                const pageMap = correctedPageAssignments.get(pdfIndex);
                let currentStartPage = null;
                let currentEndPage = null;
                
                for (let pageNum = pInfo.start_page; pageNum <= pInfo.end_page; pageNum++) {
                    if (!pageMap.has(pageNum)) {
                        pageMap.set(pageNum, topic.title);
                        
                        if (currentStartPage === null) {
                            currentStartPage = pageNum;
                        }
                        currentEndPage = pageNum;
                    } else {
                        // Fine intervallo contiguo - salva quello corrente se esiste
                        if (currentStartPage !== null && currentEndPage !== null) {
                            newPagesInfo.push({
                                ...pInfo,
                                start_page: currentStartPage,
                                end_page: currentEndPage
                            });
                            currentStartPage = null;
                            currentEndPage = null;
                        }
                    }
                }
                
                // Salva l'ultimo intervallo se c'è
                if (currentStartPage !== null && currentEndPage !== null) {
                    newPagesInfo.push({
                        ...pInfo,
                        start_page: currentStartPage,
                        end_page: currentEndPage
                    });
                }
            }
            
            // Aggiorna le pages_info del topic
            topic.pages_info = newPagesInfo;
        }
        
        console.log("generateContentIndex: Sovrapposizioni di pagine corrette.");
        
        // Rimuovi argomenti che non hanno più pagine assegnate
        parsedResponse.tableOfContents = parsedResponse.tableOfContents.filter(topic => 
            topic.pages_info && topic.pages_info.length > 0
        );
    }

    const newPageMapping = {}; // Lasciato vuoto, il modale dovrà adattarsi

    console.log("generateContentIndex: Successfully parsed AI response and prepared data.");
    return {
      tableOfContents: parsedResponse.tableOfContents,
      pageMapping: newPageMapping
    };

  } catch (error) {
    console.error('generateContentIndex: Error during AI content generation from PDF:', error);
    if (error.message.includes("Invalid JSON payload")) {
        console.error("DETTAGLIO ERRORE PAYLOAD:", error.cause || error.toString());
    }
    if (error.response && error.response.data) { // Per errori Axios-like da chiamate HTTP dirette
      console.error('Gemini API Error Data (from error.response.data):', error.response.data);
    }
    throw new Error(`Errore AI nell'analisi dei PDF: ${error.message}`);
  }
};


/**
 * Distribuisce gli argomenti (ottenuti da generateContentIndex) nei giorni disponibili.
 * Versione corretta per evitare duplicazione di argomenti tra giorni.
 * @param {string} examName Il nome dell'esame.
 * @param {number} totalDays Il numero totale di giorni per lo studio.
 * @param {Array<object>} topics La lista degli argomenti (struttura da generateContentIndex).
 * @param {string} [userDescription=""] Note aggiuntive dall'utente.
 * @returns {Promise<object>} Un oggetto con la struttura del piano giornaliero.
 */
export const distributeTopicsToDays = async (examName, totalDays, topics, userDescription = "") => {
  console.log('distributeTopicsToDays: Distributing topics to days...', { examName, totalDays, numTopics: topics.length });

  if (!genAI || !geminiDefaultModel) {
      throw new Error('Servizio AI Gemini non inizializzato correttamente.');
  }
  if (!topics || topics.length === 0) {
      console.warn("distributeTopicsToDays: Nessun argomento fornito da distribuire.");
      return { dailyPlan: [] };
  }

  const topicsSummaryForPrompt = topics.map((topic, index) => {
      let summary = `${index + 1}. ${topic.title}`;
      if (topic.description) {
          summary += ` (Desc: ${topic.description.substring(0, 50)}...)`;
      }
      if (topic.pages_info && topic.pages_info.length > 0) {
          // Aggiungi informazioni sulle pagine per migliorare la distribuzione
          const pagesInfo = topic.pages_info.map(p => 
              `File ${p.pdf_index}: p${p.start_page}-${p.end_page}`
          ).join(', ');
          summary += ` [Pagine: ${pagesInfo}]`;
      }
      return summary;
  }).join('\n');

  const promptText = `
      Sei un assistente AI esperto nella pianificazione dello studio.
      Il nome dell'esame è "${examName}".
      L'utente ha ${totalDays} giorni totali per prepararsi.
      
      Gli argomenti da studiare sono (con i loro titoli, descrizioni e informazioni sulle pagine):
      ${topicsSummaryForPrompt}

      ${userDescription ? `Considera anche queste note aggiuntive dall'utente: "${userDescription}"` : ''}

      Il tuo compito è distribuire questi argomenti in un piano di studio giornaliero per i ${totalDays} giorni.
      
      REGOLE IMPORTANTI:
      1. Ogni argomento deve apparire UNA SOLA VOLTA in tutto il piano. NON ripetere MAI gli stessi argomenti in giorni diversi.
      2. Cerca di bilanciare il carico di lavoro giornaliero in base alla complessità degli argomenti e al numero di pagine.
      3. NON creare giorni extra oltre i ${totalDays} specificati.
      4. NON aggiungere giorni di "Ripasso" automaticamente. Lascia i giorni vuoti se ci sono meno argomenti che giorni disponibili.
      5. Assicurati di usare ESATTAMENTE ${totalDays} giorni, numerati da 1 a ${totalDays}. Non aggiungere giorni aggiuntivi.
      6. Distribuisci gli argomenti in modo equo e logico, considerando la loro complessità e relazione tematica.
      
      Restituisci il risultato ESCLUSIVAMENTE in formato JSON.
      L'oggetto JSON radice deve contenere una chiave "dailyPlan".
      "dailyPlan" deve essere un array di oggetti, dove ogni oggetto rappresenta un giorno e ha la seguente struttura:
      {
        "day": numero_giorno,
        "assignedTopics": [
          {
            "title": "Titolo Originale dell'Argomento come fornito nell'elenco",
            "description": "Eventuale breve nota specifica per lo studio di questo argomento in questo giorno (opzionale)."
          }
        ]
      }
      
      IMPORTANTE: "dailyPlan" DEVE contenere esattamente ${totalDays} oggetti, con giorni numerati da 1 a ${totalDays}. Se ci sono meno argomenti che giorni, alcuni giorni avranno "assignedTopics" come array vuoto [].
      
      Assicurati che TUTTI gli argomenti forniti siano presenti nel piano UNA SOLA VOLTA.
      Non includere preamboli o testo al di fuori dell'oggetto JSON. Solo il JSON.
  `;

  try {
      const generationConfig = { 
          responseMimeType: "application/json",
          temperature: 0.1, // Temperatura bassa per risultati più prevedibili
          maxOutputTokens: 8192
      };
      
      const requestPayload = {
          contents: [{ role: "user", parts: [{ text: promptText }] }],
          generationConfig
      };
      
      const result = await geminiDefaultModel.generateContent(requestPayload);
      const response = result.response;
      
      let textResponse;
      if (response.candidates && response.candidates[0]?.content?.parts[0]?.text) {
          textResponse = response.candidates[0].content.parts[0].text;
      } else {
          textResponse = response.text();
      }
      console.log('distributeTopicsToDays: Raw AI Response Text:', textResponse);

      let parsedResponse;
      if (typeof textResponse === 'string') {
          const cleanedTextResponse = textResponse.replace(/^```json\s*|```\s*$/g, '').trim();
          if (!cleanedTextResponse) throw new Error("L'AI ha restituito una stringa vuota per la distribuzione.");
          parsedResponse = JSON.parse(cleanedTextResponse);
      } else if (typeof textResponse === 'object' && textResponse !== null) {
          parsedResponse = textResponse;
      } else {
          throw new Error(`Tipo di risposta AI per distribuzione non riconosciuto o nullo: ${typeof textResponse}`);
      }

      if (!parsedResponse.dailyPlan || !Array.isArray(parsedResponse.dailyPlan)) {
          console.error("distributeTopicsToDays: AI response missing 'dailyPlan' array.", parsedResponse);
          throw new Error("La risposta dell'AI non contiene un 'dailyPlan' valido.");
      }
      
      // Verifica che non ci siano argomenti duplicati tra i giorni
      const allAssignedTopics = new Set();
      const duplicatedTopics = [];
      
      parsedResponse.dailyPlan.forEach(day => {
          if (!day.assignedTopics) return;
          
          day.assignedTopics.forEach(topic => {
              if (!topic.title) return;
              // Ignora i giorni di ripasso
              if (topic.title.toLowerCase().includes("ripasso")) return;
              
              if (allAssignedTopics.has(topic.title)) {
                  duplicatedTopics.push(topic.title);
              } else {
                  allAssignedTopics.add(topic.title);
              }
          });
      });
      
      if (duplicatedTopics.length > 0) {
          console.warn("distributeTopicsToDays: Trovati argomenti duplicati nel piano:", duplicatedTopics);
          
          // Correggi il piano eliminando i duplicati
          const seenTopics = new Set();
          parsedResponse.dailyPlan.forEach(day => {
              if (!day.assignedTopics) return;
              
              day.assignedTopics = day.assignedTopics.filter(topic => {
                  if (!topic.title) return false;
                  // Conserva sempre i giorni di ripasso
                  if (topic.title.toLowerCase().includes("ripasso")) return true;
                  
                  if (seenTopics.has(topic.title)) {
                      return false; // Elimina il duplicato
                  } else {
                      seenTopics.add(topic.title);
                      return true;
                  }
              });
          });
          
          // Rimuovi i giorni che sono rimasti senza argomenti
          parsedResponse.dailyPlan = parsedResponse.dailyPlan.filter(day => 
              day.assignedTopics && day.assignedTopics.length > 0
          );
          
          // Riassegna i numeri dei giorni in modo sequenziale
          parsedResponse.dailyPlan.forEach((day, index) => {
              day.day = index + 1;
          });
          
          console.log("distributeTopicsToDays: Piano corretto dopo la rimozione dei duplicati.");
      }
      
      // Verifica che tutti gli argomenti originali siano stati inclusi nel piano
      const topicTitlesInPlan = new Set();
      parsedResponse.dailyPlan.forEach(day => {
          (day.assignedTopics || []).forEach(topic => {
              if (topic.title && !topic.title.toLowerCase().includes("ripasso")) {
                  topicTitlesInPlan.add(topic.title);
              }
          });
      });
      
      const missingTopics = topics.filter(topic => 
          topic.title && !topicTitlesInPlan.has(topic.title)
      );
      
      if (missingTopics.length > 0) {
          console.warn("distributeTopicsToDays: Alcuni argomenti originali non sono stati inclusi nel piano:", 
              missingTopics.map(t => t.title));
              
          // Se mancano argomenti, aggiungili agli ultimi giorni o crea nuovi giorni
          let lastDay = parsedResponse.dailyPlan.length;
          const maxTopicsPerDay = 2; // Numero massimo di argomenti per giorno
          
          for (let i = 0; i < missingTopics.length; i++) {
              const missingTopic = missingTopics[i];
              
              // Verifica se l'ultimo giorno ha spazio
              const lastDayObj = parsedResponse.dailyPlan[lastDay - 1];
              if (lastDayObj && lastDayObj.assignedTopics && lastDayObj.assignedTopics.length < maxTopicsPerDay) {
                  // Aggiungi l'argomento all'ultimo giorno
                  lastDayObj.assignedTopics.push({
                      title: missingTopic.title,
                      description: missingTopic.description || ""
                  });
              } else {
                  // Crea un nuovo giorno
                  lastDay++;
                  parsedResponse.dailyPlan.push({
                      day: lastDay,
                      assignedTopics: [{
                          title: missingTopic.title,
                          description: missingTopic.description || ""
                      }]
                  });
              }
          }
          
          console.log("distributeTopicsToDays: Piano aggiornato con l'aggiunta degli argomenti mancanti.");
      }

      // Assicurati che il risultato abbia esattamente totalDays
      const ensureExactDayCount = (parsedResponse, requestedDays) => {
        if (!parsedResponse.dailyPlan || !Array.isArray(parsedResponse.dailyPlan)) {
          console.error("distributeTopicsToDays: ensureExactDayCount - input non valido", parsedResponse);
          return parsedResponse;
        }

        const existingDays = new Set(parsedResponse.dailyPlan.map(day => day.day));
        const result = { dailyPlan: [...parsedResponse.dailyPlan] };

        // Controlla che abbiamo esattamente il numero di giorni richiesto
        for (let i = 1; i <= requestedDays; i++) {
          if (!existingDays.has(i)) {
            // Aggiungi giorni mancanti con array vuoto
            console.log(`distributeTopicsToDays: ensureExactDayCount - Aggiunto giorno mancante ${i}`);
            result.dailyPlan.push({
              day: i,
              assignedTopics: []
            });
          }
        }

        // Rimuovi eventuali giorni in eccesso
        result.dailyPlan = result.dailyPlan
          .filter(day => day.day <= requestedDays)
          .sort((a, b) => a.day - b.day);

        console.log(`distributeTopicsToDays: ensureExactDayCount - Risultato finale: ${result.dailyPlan.length} giorni`);
        return result;
      };

      console.log("distributeTopicsToDays: Successfully parsed AI response for daily plan.");
      // Assicurati che il risultato abbia esattamente totalDays
      const finalResponse = ensureExactDayCount(parsedResponse, totalDays);
      return finalResponse;

  } catch (error) {
      console.error('distributeTopicsToDays: Error during AI daily plan generation:', error);
      throw new Error(`Errore AI nella distribuzione giornaliera: ${error.message}`);
  }
};