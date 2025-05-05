// src/utils/pdfProcessor.js
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import * as pdfjsWorker from 'pdfjs-dist/build/pdf.worker.entry';
import { PDFDocument } from 'pdf-lib'; // Assicurati che l'import sia corretto

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Estrae il testo da un array di oggetti File PDF, mantenendo l'associazione con pagina e file originale.
 * @param {File[]} files - Array di file PDF.
 * @param {function} onProgress - Callback per aggiornamenti sullo stato.
 * @returns {Promise<{fullText: string, pagedTextData: Array<{fileIndex: number, fileName: string, pageNum: number, text: string}>}>}
 */
export const extractTextFromFiles = async (files, onProgress) => {
  if (!files || files.length === 0) {
    console.log("PDFProcessor/extractText: No files provided.");
    return { fullText: '', pagedTextData: [] };
  }

  let fullText = '';
  const pagedTextData = [];
  console.log("PDFProcessor/extractText: Starting text extraction (page by page)...");
  onProgress?.('Avvio estrazione testo dettagliata...');

  for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
    const file = files[fileIndex];
    console.log(`PDFProcessor/extractText: Processing file ${fileIndex + 1}/${files.length}: ${file.name}`);
    onProgress?.(`Estrazione testo da ${file.name} (${fileIndex + 1}/${files.length})...`);

    let pdfDoc = null; // Dichiarato fuori per il finally
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      pdfDoc = await loadingTask.promise;
      const numPages = pdfDoc.numPages;
      console.log(`PDFProcessor/extractText: ${file.name} - Pages found: ${numPages}`);

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        try { // Try-catch per singola pagina
            const page = await pdfDoc.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ').replace(/\s+/g, ' ').trim();

            fullText += pageText + '\n\n';

            pagedTextData.push({
              fileIndex: fileIndex,
              fileName: file.name,
              pageNum: pageNum,
              text: pageText
            });
             // Libera memoria pagina se possibile (potrebbe non essere necessario)
             if (page && typeof page.cleanup === 'function') {
                 page.cleanup();
             }
        } catch(pageError) {
             console.error(`PDFProcessor/extractText: Error processing page ${pageNum} of file ${file.name}:`, pageError);
             // Aggiungi un placeholder o salta la pagina? Per ora saltiamo
             fullText += `\n\n[Errore estrazione pagina ${pageNum} di ${file.name}]\n\n`;
        }
      } // Fine loop pagine
      console.log(`PDFProcessor/extractText: Finished processing text for ${file.name}`);

    } catch (error) { // Errore caricamento documento
      console.error(`PDFProcessor/extractText: Error loading/processing document ${file.name}:`, error);
      onProgress?.(`Errore durante l'elaborazione di ${file.name}.`);
    } finally {
        // Tenta di distruggere l'oggetto pdfjs per liberare memoria
        if (pdfDoc && typeof pdfDoc.destroy === 'function') {
            try {
                await pdfDoc.destroy();
                console.log(`PDFProcessor/extractText: pdfjs document object for ${file?.name} destroyed.`);
            } catch (destroyError) {
                 console.error(`PDFProcessor/extractText: Error destroying pdfjs object for ${file?.name}:`, destroyError);
            }
        }
        pdfDoc = null; // Dereferenzia
    }
  } // Fine loop file

  console.log("PDFProcessor/extractText: Text extraction completed. Total pages processed:", pagedTextData.length);
  onProgress?.('Estrazione testo dettagliata completata.');
  return { fullText, pagedTextData };
};


/**
 * Crea un nuovo file PDF contenente solo le pagine specificate da un file originale.
 * @param {File} originalFile - Il file PDF originale.
 * @param {number[]} pageNumbers - Array di numeri di pagina (1-based) da includere nel chunk.
 * @param {string} chunkFileName - Il nome desiderato per il file chunk.
 * @param {function} onProgress - Callback per aggiornamenti.
 * @returns {Promise<File|null>} - Una Promise che risolve con il nuovo oggetto File del chunk, o null se fallisce.
 */
export const createPdfChunk = async (originalFile, pageNumbers, chunkFileName, onProgress) => {
  // *** DEBUG LOGGING: Input ricevuto dalla funzione ***
  console.log(`[DEBUG] pdfProcessor/createPdfChunk: INIZIO per "${chunkFileName}"`);
  console.log(`[DEBUG] pdfProcessor/createPdfChunk: Ricevuto originalFile.name: ${originalFile?.name}`);
  console.log(`[DEBUG] pdfProcessor/createPdfChunk: Ricevuto pageNumbers (1-based):`, JSON.stringify(pageNumbers));
  // **************************************************

  if (!originalFile || typeof originalFile.arrayBuffer !== 'function') {
      console.error(`PDFProcessor/createPdfChunk: Oggetto 'originalFile' non valido o mancante per "${chunkFileName}".`);
      return null;
  }
  if (!pageNumbers || !Array.isArray(pageNumbers) || pageNumbers.length === 0) {
    console.error(`PDFProcessor/createPdfChunk: Array 'pageNumbers' mancante, vuoto o non valido per "${chunkFileName}". Ricevuto:`, pageNumbers);
    return null;
  }

  // Filtra e converte a 0-based
   const validNumericPageNumbers = pageNumbers.filter(n => typeof n === 'number' && !isNaN(n) && n > 0); // Assicura numeri > 0
   if (validNumericPageNumbers.length !== pageNumbers.length) {
       console.warn(`[DEBUG] pdfProcessor/createPdfChunk: pageNumbers conteneva valori non numerici o <= 0 per "${chunkFileName}". Filtrati. Originale:`, pageNumbers, "Numeri validi (1-based):", validNumericPageNumbers);
   }
   if (validNumericPageNumbers.length === 0) {
        console.error(`PDFProcessor/createPdfChunk: Nessun numero di pagina valido (>0) fornito per ${chunkFileName}. Array originale:`, pageNumbers);
        return null;
   }

  const zeroBasedPageIndices = validNumericPageNumbers.map(n => n - 1); // Converti a 0-based DOPO aver filtrato > 0
  console.log(`[DEBUG] pdfProcessor/createPdfChunk: Indici 0-based calcolati per "${chunkFileName}":`, JSON.stringify(zeroBasedPageIndices));


  onProgress?.(`Creazione chunk PDF: ${chunkFileName} (pagine ${validNumericPageNumbers.join(',')})...`);
  console.log(`PDFProcessor: Creating chunk ${chunkFileName} with valid pages (1-based): ${validNumericPageNumbers.join(',')}`);

  let pdfDoc = null; // Per caricamento con pdf-lib
  try {
    const arrayBuffer = await originalFile.arrayBuffer();
    pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true }); // Aggiunto ignoreEncryption per sicurezza
    const pageCount = pdfDoc.getPageCount();
    console.log(`[DEBUG] pdfProcessor/createPdfChunk: Documento "${originalFile.name}" caricato con pdf-lib. Pagine totali: ${pageCount}`);

    // Verifica validità indici vs numero pagine REALE del doc
    const validIndices = zeroBasedPageIndices.filter(index => index >= 0 && index < pageCount);
    console.log(`[DEBUG] pdfProcessor/createPdfChunk: Indici 0-based validati (vs ${pageCount} pagine totali) per "${chunkFileName}":`, JSON.stringify(validIndices));

    if (validIndices.length === 0) {
       console.error(`PDFProcessor/createPdfChunk: Nessuna delle pagine richieste (${validNumericPageNumbers.join(',')}) esiste nel documento originale "${originalFile.name}" che ha ${pageCount} pagine.`);
       return null;
    }
     if (validIndices.length < zeroBasedPageIndices.length) {
        const invalidOriginalPages = validNumericPageNumbers.filter(n => (n - 1) >= pageCount || (n-1) < 0);
        console.warn(`[DEBUG] pdfProcessor/createPdfChunk: Pagine originali richieste non valide (${invalidOriginalPages.join(',')}) scartate per "${chunkFileName}" (Doc ha ${pageCount} pag).`);
     }

    // Crea/Salva chunk
    const chunkDoc = await PDFDocument.create();
    const copiedPages = await chunkDoc.copyPages(pdfDoc, validIndices);
    copiedPages.forEach(page => chunkDoc.addPage(page));
    const chunkBytes = await chunkDoc.save();
    const chunkFile = new File([chunkBytes], chunkFileName, { type: 'application/pdf' });

    console.log(`PDFProcessor/createPdfChunk: Chunk ${chunkFileName} creato con successo (${chunkFile.size} bytes). Pagine incluse (0-based): ${validIndices.join(',')}`);
    onProgress?.(`Chunk ${chunkFileName} creato.`);
    return chunkFile;

  } catch (error) {
    console.error(`PDFProcessor/createPdfChunk: ERRORE durante creazione PDF chunk "${chunkFileName}":`, error);
    onProgress?.(`Errore creazione chunk: ${chunkFileName}.`);
    // Aggiungi log specifici per pdf-lib se possibile
    if (error.message && error.message.toLowerCase().includes('encrypted')) {
        console.error(`PDFProcessor/createPdfChunk: Il PDF "${originalFile.name}" potrebbe essere criptato o protetto.`);
    }
    return null;
  } finally {
      pdfDoc = null; // Dereferenzia
      console.log(`[DEBUG] pdfProcessor/createPdfChunk: FINE per "${chunkFileName}"`);
  }
};