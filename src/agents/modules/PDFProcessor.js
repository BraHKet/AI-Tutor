// ==========================================
// FILE: src/agents/modules/PDFProcessor.js (VERSIONE SEMPLIFICATA)
// ==========================================

export class PDFProcessor {
    constructor() {
        console.log('📄 PDF Processor initialized (Simple Base64 mode)');
        // Limite di 50MB per rispettare i limiti di Gemini API
        this.maxFileSize = 50 * 1024 * 1024; 
    }

    // ====================================
    // ELABORAZIONE PDF DA URL
    // ====================================
    async processPdfFromUrl(url, progressCallback = null) {
        try {
            // Notifica inizio download
            progressCallback?.({ status: 'downloading', message: 'Downloading PDF file...' });
            
            // Scarica il PDF dall'URL fornito
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`);
            }
            
            // Converte la risposta in ArrayBuffer per la manipolazione
            const arrayBuffer = await response.arrayBuffer();
            
            // Notifica inizio conversione
            progressCallback?.({ status: 'converting', message: 'Converting PDF to Base64...' });
            
            // Delega l'elaborazione al metodo comune
            return this.processArrayBuffer(arrayBuffer, {
                source: 'url',
                originalUrl: url
            });
            
        } catch (error) {
            console.error("Error processing PDF from URL:", error);
            throw new Error(`PDF URL processing failed: ${error.message}`);
        }
    }

    // ====================================
    // ELABORAZIONE PDF DA BLOB/FILE
    // ====================================
    async processPdfFromBlob(blob, progressCallback = null) {
        try {
            // Notifica inizio lettura del file blob
            progressCallback?.({ status: 'reading', message: 'Reading PDF blob...' });
            
            // Converte il blob in ArrayBuffer per la manipolazione
            const arrayBuffer = await blob.arrayBuffer();
            
            // Notifica inizio conversione
            progressCallback?.({ status: 'converting', message: 'Converting PDF to Base64...' });
            
            // Delega l'elaborazione al metodo comune, passando metadati del blob
            return this.processArrayBuffer(arrayBuffer, {
                source: 'blob',
                originalSize: blob.size,
                originalType: blob.type
            });
            
        } catch (error) {
            console.error("Error processing PDF from blob:", error);
            throw new Error(`PDF blob processing failed: ${error.message}`);
        }
    }

    // ====================================
    // ELABORAZIONE PRINCIPALE ARRAYBUFFER
    // ====================================
    async processArrayBuffer(arrayBuffer, metadata = {}) {
        const fileSize = arrayBuffer.byteLength;
        
        // Controlla che il file non superi il limite di dimensione per Gemini
        if (fileSize > this.maxFileSize) {
            throw new Error(`PDF file too large: ${this.formatFileSize(fileSize)} (max 50MB for Gemini)`);
        }
        
        // Validazione base: verifica che sia effettivamente un PDF
        if (!this.isValidPDF(arrayBuffer)) {
            throw new Error('File is not a valid PDF');
        }
        
        // Converte l'ArrayBuffer in stringa Base64 per Gemini API
        const uint8Array = new Uint8Array(arrayBuffer);
        const base64String = this.arrayBufferToBase64(uint8Array);
        
        // Restituisce l'oggetto formattato con tutti i dati necessari
        return {
            base64Data: base64String,           // Dati PDF in formato Base64
            mimeType: 'application/pdf',        // Tipo MIME per Gemini
            fileSize: fileSize,                 // Dimensione in bytes
            fileSizeFormatted: this.formatFileSize(fileSize), // Dimensione leggibile
            metadata: {
                processedAt: new Date().toISOString(),
                processingMethod: 'simple_base64_conversion',
                ...metadata                     // Metadati aggiuntivi passati dal chiamante
            }
        };
    }

    // ====================================
    // CONVERSIONE ARRAYBUFFER A BASE64
    // ====================================
    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        // Elabora in chunk per evitare stack overflow con file grandi
        const chunkSize = 8192; 
        
        // Converte ogni chunk di bytes in caratteri
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.slice(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, chunk);
        }
        
        // Codifica la stringa binaria in Base64
        return btoa(binary);
    }

    // ====================================
    // VALIDAZIONE PDF SEMPLICE
    // ====================================
    isValidPDF(arrayBuffer) {
        try {
            // Legge i primi 5 bytes per controllare l'header PDF
            const uint8Array = new Uint8Array(arrayBuffer);
            const header = new TextDecoder().decode(uint8Array.slice(0, 5));
            // Un PDF valido deve iniziare con "%PDF"
            return header.startsWith('%PDF');
        } catch (error) {
            return false;
        }
    }

    // ====================================
    // FORMATTAZIONE DIMENSIONE FILE
    // ====================================
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        // Calcola e formatta la dimensione con l'unità appropriata
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // ====================================
    // PREPARAZIONE DATI PER GEMINI API
    // ====================================
    prepareForGemini(processedPdf, additionalContext = {}) {
        // Restituisce i dati nel formato esatto richiesto da Google Gemini API
        return {
            mimeType: processedPdf.mimeType,    // "application/pdf"
            data: processedPdf.base64Data,      // Stringa Base64 del PDF
            metadata: {
                ...processedPdf.metadata,       // Metadati originali del processing
                ...additionalContext,           // Contesto aggiuntivo fornito dal chiamante
                geminiReady: true,              // Flag che indica che è pronto per Gemini
                preparedAt: new Date().toISOString()
            }
        };
    }

    // ====================================
    // VALIDAZIONE FILE PRIMA DEL PROCESSING
    // ====================================
    async validateFile(fileInput) {
        try {
            let arrayBuffer;
            
            // Gestisce input da Blob (file caricato) o da URL
            if (fileInput instanceof Blob) {
                arrayBuffer = await fileInput.arrayBuffer();
            } else if (typeof fileInput === 'string') {
                // Assume che sia un URL e prova a scaricarlo
                const response = await fetch(fileInput);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                arrayBuffer = await response.arrayBuffer();
            } else {
                throw new Error('Invalid file input: must be Blob or URL string');
            }
            
            const fileSize = arrayBuffer.byteLength;
            const isValid = this.isValidPDF(arrayBuffer);
            
            // Restituisce informazioni di validazione senza processare
            return {
                isValid,                                    // true se è un PDF valido
                fileSize,                                   // Dimensione in bytes
                fileSizeFormatted: this.formatFileSize(fileSize), // Dimensione leggibile
                exceedsLimit: fileSize > this.maxFileSize   // true se supera il limite
            };
            
        } catch (error) {
            return {
                isValid: false,
                error: error.message
            };
        }
    }
}