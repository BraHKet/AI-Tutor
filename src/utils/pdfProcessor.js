// src/utils/pdfProcessor.js
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import * as pdfjsWorker from 'pdfjs-dist/build/pdf.worker.entry'; // Importa il worker
import { PDFDocument } from 'pdf-lib';

// Configura il worker per pdf.js - Fallo una sola volta nell'app, magari qui o nel file principale (index.js)
try {
    if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
         console.log("Setting pdfjs worker source");
         pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
    }
} catch (e) { console.error("Error setting pdfjs worker source:", e); }

/**
 * Estrae il testo da un array di oggetti File PDF, mantenendo l'associazione con pagina e file originale.
 * @param {File[]} files - Array di file PDF.
 * @param {function} onProgress - Callback per aggiornamenti sullo stato.
 * @returns {Promise<{fullText: string, pagedTextData: Array<{fileIndex: number, fileName: string, pageNum: number, text: string}>}>}
 */
export const extractTextFromFiles = async (files, onProgress) => {              //POTREI ANCHE ELIMINARLO O LASCIARLO NEL CASO IO VOGLIA USARLO SUCCESSIVAMENTE MA PER ADESSO E' INUTILE
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
         if (!file || typeof file.arrayBuffer !== 'function') {
             console.warn(`PDFProcessor/extractText: Invalid file object at index ${fileIndex}. Skipping.`);
             continue;
         }
        console.log(`PDFProcessor/extractText: Processing file ${fileIndex + 1}/${files.length}: ${file.name}`);
        onProgress?.(`Estrazione testo da ${file.name} (${fileIndex + 1}/${files.length})...`);

        let pdfDoc = null;
        try {
            const arrayBuffer = await file.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            pdfDoc = await loadingTask.promise;
            const numPages = pdfDoc.numPages;
            console.log(`PDFProcessor/extractText: ${file.name} - Pages found: ${numPages}`);

            for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                try {
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
                    // Cleanup opzionale per la pagina
                     if (page && typeof page.cleanup === 'function') { page.cleanup(); }
                } catch(pageError) {
                    console.error(`PDFProcessor/extractText: Error processing page ${pageNum} of file ${file.name}:`, pageError);
                    fullText += `\n\n[Errore estrazione pagina ${pageNum} di ${file.name}]\n\n`;
                }
            }
            console.log(`PDFProcessor/extractText: Finished processing text for ${file.name}`);

        } catch (error) {
            console.error(`PDFProcessor/extractText: Error loading/processing document ${file.name}:`, error);
            onProgress?.(`Errore durante l'elaborazione di ${file.name}.`);
             // Aggiungi un placeholder per indicare l'errore del file?
             fullText += `\n\n[ERRORE DURANTE ELABORAZIONE FILE: ${file.name}]\n\n`;
        } finally {
            if (pdfDoc && typeof pdfDoc.destroy === 'function') {
                try { await pdfDoc.destroy(); } catch (e) { /* ignore */ }
            }
            pdfDoc = null;
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
    console.log(`[DEBUG] pdfProcessor/createPdfChunk: INIZIO per "${chunkFileName}"`);
    console.log(`[DEBUG] pdfProcessor/createPdfChunk: Ricevuto originalFile.name: ${originalFile?.name}`);
    console.log(`[DEBUG] pdfProcessor/createPdfChunk: Ricevuto pageNumbers (1-based):`, JSON.stringify(pageNumbers));

    if (!originalFile || typeof originalFile.arrayBuffer !== 'function') { 
        console.error("PDFProcessor/createPdfChunk: Invalid original file");
        return null; 
    }
    if (!pageNumbers || !Array.isArray(pageNumbers) || pageNumbers.length === 0) { 
        console.error("PDFProcessor/createPdfChunk: Invalid page numbers array");
        return null; 
    }

    // Filtra e converte a 0-based
    const validNumericPageNumbers = pageNumbers.filter(n => typeof n === 'number' && !isNaN(n) && n > 0);
    if (validNumericPageNumbers.length === 0) { 
        console.error("PDFProcessor/createPdfChunk: No valid page numbers");
        return null; 
    }
    if (validNumericPageNumbers.length !== pageNumbers.length) { 
        console.warn("PDFProcessor/createPdfChunk: Some invalid page numbers were filtered out"); 
    }

    const zeroBasedPageIndices = validNumericPageNumbers.map(n => n - 1);
    console.log(`[DEBUG] pdfProcessor/createPdfChunk: Indici 0-based calcolati per "${chunkFileName}":`, JSON.stringify(zeroBasedPageIndices));

    onProgress?.(`Creazione chunk PDF: ${chunkFileName}...`);
    console.log(`PDFProcessor: Creating chunk ${chunkFileName} with valid pages (1-based): ${validNumericPageNumbers.join(',')}`);

    let pdfDoc = null;
    try {
        const arrayBuffer = await originalFile.arrayBuffer();
        pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        const pageCount = pdfDoc.getPageCount();
        console.log(`[DEBUG] pdfProcessor/createPdfChunk: Documento "${originalFile.name}" caricato (pdf-lib). Pagine: ${pageCount}`);

        // Verifica validità indici
        const validIndices = zeroBasedPageIndices.filter(index => index >= 0 && index < pageCount);
        console.log(`[DEBUG] pdfProcessor/createPdfChunk: Indici 0-based validati (vs ${pageCount} pagine):`, JSON.stringify(validIndices));

        if (validIndices.length === 0) { 
            console.error("PDFProcessor/createPdfChunk: No valid page indices after validation");
            return null; 
        }
        if (validIndices.length < zeroBasedPageIndices.length) { 
            console.warn("PDFProcessor/createPdfChunk: Some page indices were out of range and filtered out"); 
        }

        // Crea/Salva chunk
        const chunkDoc = await PDFDocument.create();
        const copiedPages = await chunkDoc.copyPages(pdfDoc, validIndices);
        copiedPages.forEach(page => chunkDoc.addPage(page));
        const chunkBytes = await chunkDoc.save();
        const chunkFile = new File([chunkBytes], chunkFileName, { type: 'application/pdf' });

        console.log(`PDFProcessor/createPdfChunk: Chunk ${chunkFileName} creato (${chunkFile.size} bytes).`);
        onProgress?.(`Chunk ${chunkFileName} creato.`);
        return chunkFile;

    } catch (error) {
        console.error(`PDFProcessor/createPdfChunk: ERRORE durante creazione PDF chunk "${chunkFileName}":`, error);
        onProgress?.(`Errore creazione chunk: ${chunkFileName}.`);
        return null;
    } finally {
        pdfDoc = null;
        console.log(`[DEBUG] pdfProcessor/createPdfChunk: FINE per "${chunkFileName}"`);
    }
};