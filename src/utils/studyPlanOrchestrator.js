// src/utils/studyPlanOrchestrator.js
import { googleDriveService } from './googleDriveService';
import { extractTextFromFiles, createPdfChunk } from './pdfProcessor';
import { generateContentIndex, distributeTopicsToDays } from './gemini';
import { saveProjectWithPlan } from './firebase';
import { v4 as uuidv4 } from 'uuid';

/**
 * Orchestrator V3.1: Usa un approccio a due passi con l'AI.
 * Aggiunto logging super dettagliato e corretta logica fallback.
 */
export const createAndGeneratePlan = async (formData, files, userId, progressCallback) => {
  console.log("Orchestrator V3.1: Starting two-step AI plan creation...");
  progressCallback({ type: 'processing', message: 'Avvio processo...' });

  let originalUploadedFilesData = []; let pagedTextData = []; let pageMapping = {};
  let contentIndex = null; let topicDistribution = null; let projectId = null;

  try {
    // --- 1. Upload File Originali ---
    console.log("Orchestrator: Step 1 - Uploading original files...");
    progressCallback({ type: 'processing', message: 'Caricamento file originali...' });
    const uploadPromises = files.map((file, index) =>
      googleDriveService.uploadFile(file, (percent) => {
        progressCallback({ type: 'upload', phase: 'original', fileName: file.name, percent: percent });
      }).then(result => {
          progressCallback({ type: 'processing', message: `File originale ${file.name} caricato.` });
          return {
              name: result.name, driveFileId: result.driveFileId || result.id,
              size: result.size, type: result.type, webViewLink: result.webViewLink,
              originalFileIndex: index // Memorizza l'indice originale del file nell'array 'files'
          };
      }).catch(err => {
          console.error(`Orchestrator: Failed to upload original file ${file.name}`, err);
          throw new Error(`Errore upload ${file.name}: ${err.message}`);
       })
    );
    originalUploadedFilesData = await Promise.all(uploadPromises);
    console.log("Orchestrator: Original files uploaded successfully:", originalUploadedFilesData);
    progressCallback({ type: 'processing', message: 'File originali caricati.' });


    // --- 2. Estrazione Testo Dettagliata e Creazione Mapping ---
    console.log("Orchestrator: Step 2 - Extracting detailed text and creating page map...");
    progressCallback({ type: 'processing', message: 'Estrazione testo dettagliata dai PDF...' });
    const extractionResult = await extractTextFromFiles(files, (message) => {
       progressCallback({ type: 'processing', message });
    });
    pagedTextData = extractionResult.pagedTextData;
    const fullTextForAI = extractionResult.fullText;
    pageMapping = pagedTextData.reduce((map, pageInfo, index) => {
        // Chiave: marcatore globale 1-based, Valore: info pagina originale
        map[index + 1] = { ...pageInfo }; // Copia l'oggetto pageInfo
        return map;
    }, {});
    const totalSourcePages = Object.keys(pageMapping).length;
    console.log(`Orchestrator: Text extracted. Total global page markers created: ${totalSourcePages}`);
    console.log("[DEBUG] Orchestrator: Page Mapping Created:", pageMapping); // Logga il mapping completo
    if (pagedTextData.length === 0) {
      console.error("Orchestrator: Text extraction yielded no pages. Cannot proceed.");
      throw new Error("Estrazione testo fallita o PDF vuoti. Impossibile procedere.");
    }


    // --- 3. Generazione Indice Strutturato (AI Passo 1) ---
    console.log("Orchestrator: Step 3 - Generating content index via AI...");
    progressCallback({ type: 'processing', message: 'Analisi AI per struttura argomenti (Passo 1)...' });
    contentIndex = await generateContentIndex(
        formData.examName,
        fullTextForAI, // Passa il testo completo qui
        pageMapping   // Il mapping serve all'AI per referenziare nel suo output
    );
    console.log("Orchestrator: Content index generated (raw AI result):", JSON.stringify(contentIndex, null, 2)); // Log indice formattato
     if (!contentIndex || !contentIndex.tableOfContents || !Array.isArray(contentIndex.tableOfContents) || contentIndex.tableOfContents.length === 0) {
         console.error("Orchestrator: AI failed to generate a valid content index.", contentIndex);
         throw new Error("L'AI non ha generato un indice di argomenti valido.");
     }
    progressCallback({ type: 'processing', message: 'Struttura argomenti identificata.' });


    // --- 4. Distribuzione Argomenti sui Giorni (AI Passo 2) ---
    console.log("Orchestrator: Step 4 - Distributing topics to days via AI...");
    progressCallback({ type: 'processing', message: 'Distribuzione AI degli argomenti sui giorni (Passo 2)...' });
    topicDistribution = await distributeTopicsToDays(
        formData.examName,
        formData.totalDays,
        contentIndex.tableOfContents, // Passa l'indice appena generato
        formData.description
    );
    console.log("Orchestrator: Topic distribution received (raw AI result):", JSON.stringify(topicDistribution, null, 2)); // Log distribuzione formattata
     if (!topicDistribution || !topicDistribution.dailyPlan || !Array.isArray(topicDistribution.dailyPlan) || topicDistribution.dailyPlan.length === 0) {
         console.error("Orchestrator: AI failed to generate a valid daily distribution.", topicDistribution);
         throw new Error("L'AI non ha generato una distribuzione giornaliera valida.");
     }
    progressCallback({ type: 'processing', message: 'Distribuzione giornaliera completata.' });


    // --- 5. Elaborazione Finale: Calcolo Pagine Fine, Creazione/Upload Chunk ---
    console.log("Orchestrator: Step 5 - Final processing: calculating end pages, creating/uploading chunks...");
    progressCallback({ type: 'processing', message: 'Calcolo dettagli pagine e creazione sezioni...' });
    const topicsDataForFirestore = [];
    const dailyPlanMapForFirestore = {};

    // Mappa per accesso rapido all'indice generato nel passo 3
    const indexTopicMap = contentIndex.tableOfContents.reduce((map, topic) => {
        const normalizedTitle = topic.title?.trim();
        if (normalizedTitle) { map[normalizedTitle] = topic; }
        return map;
    }, {});
    console.log("Orchestrator: Created indexTopicMap (Size: " + Object.keys(indexTopicMap).length + ")");

    let totalChunksToProcess = 0;
     topicDistribution.dailyPlan.forEach(day => {
         if (day.assignedTopics && !day.assignedTopics.some(t => t.title?.toLowerCase().includes("ripasso"))) {
             totalChunksToProcess += day.assignedTopics.length;
         }
      });
    let chunksProcessed = 0;

    // Itera sulla DISTRIBUZIONE giornaliera ricevuta (Passo 4)
    for (const dayPlan of topicDistribution.dailyPlan) {
      const dayNumber = dayPlan.day;
      if (!dayNumber) { console.warn("Orchestrator: Skipping dayPlan without day number:", dayPlan); continue; }
      dailyPlanMapForFirestore[dayNumber] = [];

      // Salta giorni di ripasso o vuoti
       if (!dayPlan.assignedTopics || dayPlan.assignedTopics.length === 0 || dayPlan.assignedTopics.some(t => t.title?.toLowerCase().includes("ripasso"))) {
            if(dayPlan.assignedTopics && dayPlan.assignedTopics.length > 0){ // Gestisci topic ripasso
                const reviewTopic = dayPlan.assignedTopics.find(t => t.title?.toLowerCase().includes("ripasso"));
                if (reviewTopic) { /* ... aggiungi topic ripasso a Firestore ... */ }
            }
           console.log(`Orchestrator: Skipping Day ${dayNumber} (review or no topics).`);
           continue;
       }

      // Itera sugli argomenti assegnati al giorno
      for (const [topicIndexInDay, assignedTopic] of dayPlan.assignedTopics.entries()) {
        const topicTitle = assignedTopic.title?.trim();
        if (!topicTitle) { console.warn(`Orchestrator: Skipping topic in Day ${dayNumber} without valid title.`); continue; }

        chunksProcessed++;
        const progressMessage = ` Elaborazione ${chunksProcessed}/${totalChunksToProcess}: "${topicTitle}" (G${dayNumber})...`;
        progressCallback({ type: 'processing', message: progressMessage });
        console.log(`\n--- Processing Topic ${chunksProcessed}/${totalChunksToProcess}: "${topicTitle}" (Day ${dayNumber}) ---`);

        const topicId = uuidv4();
        dailyPlanMapForFirestore[dayNumber].push(topicId);
        let topicSources = []; // Resetta sources per ogni topic

        // Cerca il topic nell'indice generato al Passo 3
        const topicInfoFromIndex = indexTopicMap[topicTitle];
        console.log(`[DEBUG] Orchestrator: Matching topic title from AI Step 2: "${topicTitle}"`);
        if (topicInfoFromIndex) {
            console.log(`[DEBUG] Orchestrator: -> Found in Step 1 index! startPageMarker: ${topicInfoFromIndex.startPageMarker}`, topicInfoFromIndex);
        } else {
            console.error(`[DEBUG] Orchestrator: -> NOT FOUND in Step 1 index! Searched for: "${topicTitle}". Available keys:`, Object.keys(indexTopicMap));
        }

        // Procedi SOLO se trovato e con startPage valido
        if (topicInfoFromIndex && typeof topicInfoFromIndex.startPageMarker === 'number' && topicInfoFromIndex.startPageMarker > 0) {
          const startPageMarker = topicInfoFromIndex.startPageMarker;
          let endPageMarker = totalSourcePages; // Default a ultima pagina globale

          // Stima EndPageMarker
          const currentTopicIndexInToc = contentIndex.tableOfContents.findIndex(t => t.title?.trim() === topicTitle);
          console.log(`[DEBUG] Orchestrator: Index of "${topicTitle}" in tableOfContents: ${currentTopicIndexInToc}`);
          if (currentTopicIndexInToc !== -1 && currentTopicIndexInToc + 1 < contentIndex.tableOfContents.length) {
            const nextTopic = contentIndex.tableOfContents[currentTopicIndexInToc + 1];
            const nextTopicStart = nextTopic?.startPageMarker;
             console.log(`[DEBUG] Orchestrator: Next topic is "${nextTopic?.title}", startPageMarker: ${nextTopicStart}`);
            if (typeof nextTopicStart === 'number' && nextTopicStart > startPageMarker) {
              endPageMarker = nextTopicStart - 1;
            } else {
                console.warn(`[DEBUG] Orchestrator: Next topic startPageMarker (${nextTopicStart}) invalid or not sequential. Using last page (${totalSourcePages}) as end for "${topicTitle}".`);
            }
          } else {
              console.log(`[DEBUG] Orchestrator: "${topicTitle}" is the last topic in index. Using last page (${totalSourcePages}) as end.`);
          }
          endPageMarker = Math.max(startPageMarker, endPageMarker); // Sicurezza end >= start

          console.log(`[DEBUG] Orchestrator: Topic "${topicTitle}" - Calculated Global Marker Range: ${startPageMarker} - ${endPageMarker}`);

          // Identifica pagine originali da pageMapping
          const pagesToInclude = []; // Array di {fileIndex, fileName, pageNum, text}
          for (let p = startPageMarker; p <= endPageMarker; p++) {
              const pageMapInfo = pageMapping[p];
              if (pageMapInfo) { pagesToInclude.push(pageMapInfo); }
              // else { console.warn(`[DEBUG] Orchestrator: Global marker ${p} not found in pageMapping for "${topicTitle}"`); }
          }
          console.log(`[DEBUG] Orchestrator: Topic "${topicTitle}" - Identified original pages (${pagesToInclude.length}):`, pagesToInclude.map(p => `(FileIdx ${p.fileIndex}, OrigPg ${p.pageNum})`));

          // Raggruppa per file originale
          const pagesByFile = pagesToInclude.reduce((acc, pageInfo) => {
            const fileIndexKey = String(pageInfo.fileIndex);
            if (!acc[fileIndexKey]) {
              acc[fileIndexKey] = {
                file: files[pageInfo.fileIndex], // Il File object
                originalFileInfo: originalUploadedFilesData.find(f => f.originalFileIndex === pageInfo.fileIndex), // Info Drive
                pages: [] // Numeri pagina 1-based
              };
            }
            if (typeof pageInfo.pageNum === 'number' && !isNaN(pageInfo.pageNum)) {
                acc[fileIndexKey].pages.push(pageInfo.pageNum);
            } else {
                 console.warn(`[DEBUG] Orchestrator: Ignored invalid original page number (${pageInfo.pageNum}) for file index ${fileIndexKey} in topic "${topicTitle}"`);
            }
            return acc;
          }, {});
          console.log(`[DEBUG] Orchestrator: Topic "${topicTitle}" - Pages grouped by source file:`, pagesByFile);

          // Crea e carica chunk per ogni file coinvolto
          for (const fileIndexStr in pagesByFile) {
              const fileData = pagesByFile[fileIndexStr];
              const originalFile = fileData.file;
              const originalFileInfo = fileData.originalFileInfo;
              let pageNumbersForChunk = [...new Set(fileData.pages)].sort((a, b) => a - b);

              console.log(`[DEBUG] Orchestrator: Topic "${topicTitle}" - File "${originalFile?.name}" - Preparing chunk with 1-based pages:`, JSON.stringify(pageNumbersForChunk));

              if (pageNumbersForChunk.length > 0 && originalFileInfo && originalFile) {
                  const firstPage = pageNumbersForChunk[0];
                  const lastPage = pageNumbersForChunk[pageNumbersForChunk.length - 1];
                   console.log(`[DEBUG] Orchestrator: Topic "${topicTitle}" - File "${originalFile?.name}" - Calculated firstPage: ${firstPage}, lastPage: ${lastPage}`);

                  if (typeof firstPage === 'number' && typeof lastPage === 'number' && !isNaN(firstPage) && !isNaN(lastPage)) {
                      const safeTitlePart = topicTitle.substring(0, 15).replace(/[^a-zA-Z0-9]/g, '_');
                      const chunkFileName = `${originalFile.name.replace(/\.pdf$/i, '')}_${safeTitlePart}_p${firstPage}-${lastPage}.pdf`;
                       console.log(`[DEBUG] Orchestrator: Attempting to create chunk: "${chunkFileName}"`);

                      try {
                          progressCallback({ type: 'processing', message: `Creazione chunk ${chunkFileName}...` });
                          // Passa l'array 1-based a createPdfChunk
                          const chunkFile = await createPdfChunk(originalFile, pageNumbersForChunk, chunkFileName, (msg) => progressCallback({type: 'processing', message: msg}));

                          if (chunkFile) {
                               console.log(`[DEBUG] Orchestrator: Chunk ${chunkFileName} CREATED (size: ${chunkFile.size}). Uploading...`);
                               progressCallback({ type: 'processing', message: `Caricamento chunk ${chunkFileName}...` });
                               const uploadedChunk = await googleDriveService.uploadFile(chunkFile, (percent) => { /* ... */ });
                               console.log(`[DEBUG] Orchestrator: Chunk ${chunkFileName} UPLOADED. Info:`, uploadedChunk);
                               // Aggiungi chunk alle fonti
                               topicSources.push({
                                   type: 'pdf_chunk',
                                   chunkDriveId: uploadedChunk.driveFileId || uploadedChunk.id,
                                   chunkName: chunkFileName,
                                   webViewLink: uploadedChunk.webViewLink,
                                   originalFileId: originalFileInfo.driveFileId,
                                   originalFileName: originalFileInfo.name,
                                   pageStart: firstPage,
                                   pageEnd: lastPage
                               });
                                progressCallback({ type: 'processing', message: `Chunk ${chunkFileName} caricato.` });
                          } else {
                               console.error(`[DEBUG] Orchestrator: createPdfChunk returned null for "${chunkFileName}". Pages requested:`, pageNumbersForChunk);
                               topicSources.push({ type: 'error_chunk', name: chunkFileName, error: 'Creazione fallita (pdfProcessor null)', originalFileId: originalFileInfo.driveFileId, originalFileName: originalFileInfo.name });
                          }
                      } catch (chunkError) {
                          console.error(`Orchestrator: ERROR during chunk handling for ${chunkFileName}`, chunkError);
                          progressCallback({ type: 'error', message: `Errore chunk ${chunkFileName}: ${chunkError.message}` });
                          topicSources.push({ type: 'error_chunk', name: chunkFileName, error: chunkError.message, originalFileId: originalFileInfo.driveFileId, originalFileName: originalFileInfo.name });
                      }
                  } else { // firstPage o lastPage non validi
                       console.error(`[DEBUG] Orchestrator: Invalid firstPage (${firstPage}) or lastPage (${lastPage}) for chunk of "${topicTitle}" in file "${originalFile?.name}". Skipping chunk creation.`);
                       topicSources.push({ type: 'error_chunk', name: `Chunk_ErrorePagine_${topicTitle.substring(0,10)}`, error: 'Pagine inizio/fine non valide dopo elaborazione', originalFileId: originalFileInfo?.driveFileId, originalFileName: originalFileInfo?.name });
                  }
              } else { // Se pageNumbersForChunk è vuoto o mancano info
                   console.warn(`[DEBUG] Orchestrator: Skipping chunk creation for file index ${fileIndexStr} in topic "${topicTitle}" due to empty page list or missing file info.`);
              }
          } // Fine loop per file coinvolti nel topic
        } // Fine if (topicInfoFromIndex && startPageMarker)

        // Fallback se non sono state create fonti chunk O se il topic non era nell'indice
        if (topicSources.length === 0) {
             console.warn(`Orchestrator: Applying fallback (original files) for topic "${topicTitle}" (Day ${dayNumber}). Reason: ${!topicInfoFromIndex ? 'Not found in index' : 'Chunk creation failed/skipped'}.`);
             topicSources.push(...originalUploadedFilesData.map(f => ({
                 type: 'pdf_original',
                 driveFileId: f.driveFileId,
                 name: f.name,
                 webViewLink: f.webViewLink
              })));
        }

        console.log(`[DEBUG] Orchestrator: Final sources collected for topic "${topicTitle}" (Day ${dayNumber}):`, JSON.stringify(topicSources));

        // Prepara topic per Firestore
        topicsDataForFirestore.push({
          id: topicId,
          title: topicTitle,
          description: topicInfoFromIndex?.subTopics?.map(st => st.title).join(', ') || assignedTopic.description || '',
          assignedDay: dayNumber,
          orderInDay: topicIndexInDay, // Usa indice da loop `entries`
          isCompleted: false,
          sources: topicSources // Salva le fonti (chunk, errori o originali)
        });
        console.log(`--- Finished Processing Topic: "${topicTitle}" ---`); // Fine log topic
      } // Fine loop assignedTopics
    } // Fine loop giorni


    console.log("Orchestrator: Step 5 (Final processing) finished.");
    progressCallback({ type: 'processing', message: 'Elaborazione finale completata.' });

    // --- 6. Preparazione Dati Finali Progetto ---
     const projectCoreData = {
       title: formData.title, examName: formData.examName, totalDays: formData.totalDays,
       description: formData.description, userId: userId,
       originalFiles: originalUploadedFilesData.map(({originalFileIndex, ...rest}) => rest),
       aiModelUsed: 'gemini-1.5-flash-latest (2-step)',
       dailyPlan: dailyPlanMapForFirestore,
     };


    // --- 7. Salvataggio su Firestore ---
    console.log("Orchestrator: Step 7 - Saving project and final topics to Firestore...");
    console.log("[DEBUG] Orchestrator: Final Project Data to Save:", JSON.stringify(projectCoreData, null, 2));
    console.log("[DEBUG] Orchestrator: Final Topics Data to Save:", JSON.stringify(topicsDataForFirestore, null, 2));
    progressCallback({ type: 'processing', message: 'Salvataggio finale del piano...' });
    projectId = await saveProjectWithPlan(projectCoreData, topicsDataForFirestore);
    console.log("Orchestrator: Plan saved successfully. Project ID:", projectId);
    progressCallback({ type: 'processing', message: 'Piano salvato!' });

    return projectId;

  } catch (error) {
    console.error("Orchestrator V3.1: FATAL ERROR during plan creation process!", error);
    progressCallback({ type: 'error', message: `ERRORE CRITICO: ${error.message}` || 'Errore imprevisto grave nel processo di creazione.' });
    throw error; // Rilancia per gestione nell'UI
  }
};