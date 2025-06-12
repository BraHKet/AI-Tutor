// ==========================================
// FILE: src/agents/modules/TextExtractor.js
// ==========================================

import * as pdfjsLib from 'pdfjs-dist/build/pdf';

pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.js`;

export class TextExtractor {
    constructor() {
        console.log('📄 Text Extractor initialized');
    }

    async extractTextFromPdfUrl(url, progressCallback = null) {
        try {
            progressCallback?.({ message: 'Downloading PDF...' });
            const loadingTask = pdfjsLib.getDocument(url);
            const pdf = await loadingTask.promise;
            const numPages = pdf.numPages;
            let fullText = '';
            
            for (let i = 1; i <= numPages; i++) {
                progressCallback?.({ message: `Processing page ${i} of ${numPages}...` });
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                // Aggiungiamo un separatore di pagina per aiutare l'AI a capire la struttura
                fullText += `--- PAGINA ${i} ---\n\n`;
                fullText += textContent.items.map(item => item.str).join(' ') + '\n\n';
            }
            
            if (!fullText || fullText.trim().length < 50) {
                throw new Error("Text extraction failed or the document is empty.");
            }
            
            return fullText;
        } catch (error) {
            console.error("Error during PDF text extraction:", error);
            throw new Error(`Cannot read PDF from URL. Details: ${error.message}`);
        }
    }
}

export default TextExtractor;