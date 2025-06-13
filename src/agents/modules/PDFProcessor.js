// ==========================================
// FILE: src/agents/modules/PDFProcessor.js (NUOVA VERSIONE BASE64)
// ==========================================

import * as pdfjsLib from 'pdfjs-dist/build/pdf';

pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.js`;

export class PDFProcessor {
    constructor() {
        console.log('📄 PDF Processor initialized (Base64 mode)');
        this.supportedImageTypes = ['image/jpeg', 'image/png', 'image/gif'];
        this.maxFileSize = 50 * 1024 * 1024; // 50MB limit
    }

    async processPdfFromUrl(url, progressCallback = null) {
        try {
            progressCallback?.({ status: 'downloading', message: 'Downloading PDF file...' });
            
            // Download del PDF
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            const fileSize = arrayBuffer.byteLength;
            
            // Controllo dimensioni
            if (fileSize > this.maxFileSize) {
                throw new Error(`PDF file too large: ${Math.round(fileSize / 1024 / 1024)}MB (max 50MB)`);
            }
            
            progressCallback?.({ status: 'converting', message: 'Converting PDF to Base64...' });
            
            // Conversione in Base64
            const uint8Array = new Uint8Array(arrayBuffer);
            const base64String = this.arrayBufferToBase64(uint8Array);
            
            progressCallback?.({ status: 'analyzing', message: 'Analyzing PDF structure...' });
            
            // Analisi struttura PDF
            const pdfAnalysis = await this.analyzePdfStructure(arrayBuffer, progressCallback);
            
            progressCallback?.({ status: 'completed', message: 'PDF processing completed!' });
            
            return {
                base64Data: base64String,
                mimeType: 'application/pdf',
                fileSize: fileSize,
                fileSizeFormatted: this.formatFileSize(fileSize),
                analysis: pdfAnalysis,
                metadata: {
                    processedAt: new Date().toISOString(),
                    processingMethod: 'base64_conversion',
                    hasImages: pdfAnalysis.hasImages,
                    hasFormulas: pdfAnalysis.hasFormulas,
                    estimatedComplexity: pdfAnalysis.estimatedComplexity
                }
            };
            
        } catch (error) {
            console.error("Error during PDF processing:", error);
            throw new Error(`PDF processing failed: ${error.message}`);
        }
    }

    async processPdfFromBlob(blob, progressCallback = null) {
        try {
            progressCallback?.({ status: 'reading', message: 'Reading PDF blob...' });
            
            if (blob.size > this.maxFileSize) {
                throw new Error(`PDF file too large: ${Math.round(blob.size / 1024 / 1024)}MB (max 50MB)`);
            }
            
            const arrayBuffer = await blob.arrayBuffer();
            
            progressCallback?.({ status: 'converting', message: 'Converting PDF to Base64...' });
            
            // Conversione in Base64
            const uint8Array = new Uint8Array(arrayBuffer);
            const base64String = this.arrayBufferToBase64(uint8Array);
            
            progressCallback?.({ status: 'analyzing', message: 'Analyzing PDF structure...' });
            
            // Analisi struttura PDF
            const pdfAnalysis = await this.analyzePdfStructure(arrayBuffer, progressCallback);
            
            progressCallback?.({ status: 'completed', message: 'PDF processing completed!' });
            
            return {
                base64Data: base64String,
                mimeType: 'application/pdf',
                fileSize: blob.size,
                fileSizeFormatted: this.formatFileSize(blob.size),
                analysis: pdfAnalysis,
                metadata: {
                    processedAt: new Date().toISOString(),
                    processingMethod: 'blob_conversion',
                    hasImages: pdfAnalysis.hasImages,
                    hasFormulas: pdfAnalysis.hasFormulas,
                    estimatedComplexity: pdfAnalysis.estimatedComplexity
                }
            };
            
        } catch (error) {
            console.error("Error during PDF blob processing:", error);
            throw new Error(`PDF blob processing failed: ${error.message}`);
        }
    }

    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const chunkSize = 8192; // Process in chunks to avoid stack overflow
        
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.slice(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, chunk);
        }
        
        return btoa(binary);
    }

    async analyzePdfStructure(arrayBuffer, progressCallback = null) {
        try {
            const loadingTask = pdfjsLib.getDocument(arrayBuffer);
            const pdf = await loadingTask.promise;
            
            const analysis = {
                totalPages: pdf.numPages,
                hasImages: false,
                hasFormulas: false,
                pageStructures: [],
                textDensity: 0,
                imageCount: 0,
                estimatedComplexity: 'low',
                contentTypes: [],
                mathematicalContent: {
                    hasEquations: false,
                    hasSymbols: false,
                    hasDiagrams: false
                }
            };

            let totalTextLength = 0;
            let totalImages = 0;
            let mathematicalIndicators = 0;

            // Analizza ogni pagina
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                progressCallback?.({ 
                    status: 'analyzing', 
                    message: `Analyzing page ${pageNum}/${pdf.numPages}...` 
                });

                const page = await pdf.getPage(pageNum);
                const pageAnalysis = await this.analyzePageContent(page);
                
                analysis.pageStructures.push({
                    pageNumber: pageNum,
                    textLength: pageAnalysis.textLength,
                    hasImages: pageAnalysis.hasImages,
                    imageCount: pageAnalysis.imageCount,
                    hasMathContent: pageAnalysis.hasMathContent,
                    contentTypes: pageAnalysis.contentTypes
                });

                totalTextLength += pageAnalysis.textLength;
                totalImages += pageAnalysis.imageCount;
                
                if (pageAnalysis.hasImages) analysis.hasImages = true;
                if (pageAnalysis.hasMathContent) {
                    analysis.hasFormulas = true;
                    mathematicalIndicators++;
                }

                // Accumula tipi di contenuto
                pageAnalysis.contentTypes.forEach(type => {
                    if (!analysis.contentTypes.includes(type)) {
                        analysis.contentTypes.push(type);
                    }
                });
            }

            // Calcola metriche generali
            analysis.textDensity = Math.round(totalTextLength / pdf.numPages);
            analysis.imageCount = totalImages;

            // Determina contenuto matematico
            analysis.mathematicalContent.hasEquations = mathematicalIndicators > 0;
            analysis.mathematicalContent.hasSymbols = analysis.hasFormulas;
            analysis.mathematicalContent.hasDiagrams = analysis.hasImages && mathematicalIndicators > 0;

            // Stima la complessità
            analysis.estimatedComplexity = this.estimateComplexity({
                pages: pdf.numPages,
                textDensity: analysis.textDensity,
                imageCount: totalImages,
                mathContent: mathematicalIndicators
            });

            console.log(`📊 PDF Analysis completed: ${pdf.numPages} pages, ${totalImages} images, complexity: ${analysis.estimatedComplexity}`);
            
            return analysis;

        } catch (error) {
            console.error("Error analyzing PDF structure:", error);
            return {
                totalPages: 0,
                hasImages: false,
                hasFormulas: false,
                pageStructures: [],
                textDensity: 0,
                imageCount: 0,
                estimatedComplexity: 'unknown',
                contentTypes: ['unknown'],
                mathematicalContent: {
                    hasEquations: false,
                    hasSymbols: false,
                    hasDiagrams: false
                },
                error: error.message
            };
        }
    }

    async analyzePageContent(page) {
        try {
            // Estrae il testo per analisi
            const textContent = await page.getTextContent();
            const textItems = textContent.items || [];
            const fullText = textItems.map(item => item.str).join(' ');
            
            // Controlla le immagini/oggetti
            const operatorList = await page.getOperatorList();
            const hasImages = this.detectImagesInOperatorList(operatorList);
            const imageCount = this.countImagesInOperatorList(operatorList);
            
            // Rileva contenuto matematico
            const hasMathContent = this.detectMathematicalContent(fullText, textItems);
            
            // Classifica i tipi di contenuto
            const contentTypes = this.classifyContentTypes(fullText, hasImages, hasMathContent);

            return {
                textLength: fullText.length,
                hasImages: hasImages,
                imageCount: imageCount,
                hasMathContent: hasMathContent,
                contentTypes: contentTypes,
                textSample: fullText.substring(0, 200) // Per debugging
            };

        } catch (error) {
            console.error("Error analyzing page content:", error);
            return {
                textLength: 0,
                hasImages: false,
                imageCount: 0,
                hasMathContent: false,
                contentTypes: ['unknown'],
                error: error.message
            };
        }
    }

    detectImagesInOperatorList(operatorList) {
        const imageOperators = ['paintImageXObject', 'paintInlineImage', 'paintImageMaskXObject'];
        return operatorList.fnArray.some(fn => imageOperators.includes(pdfjsLib.OPS[fn]));
    }

    countImagesInOperatorList(operatorList) {
        const imageOperators = ['paintImageXObject', 'paintInlineImage', 'paintImageMaskXObject'];
        return operatorList.fnArray.filter(fn => imageOperators.includes(pdfjsLib.OPS[fn])).length;
    }

    detectMathematicalContent(text, textItems) {
        // Pattern per contenuto matematico
        const mathPatterns = [
            /[∑∏∫∆∇∂]/g,           // Simboli matematici
            /[αβγδεζηθικλμνξοπρστυφχψω]/g, // Lettere greche
            /\b[a-zA-Z]\s*[=≠<>≤≥]\s*[a-zA-Z0-9]/g, // Equazioni semplici
            /\d+[\s]*[+\-*/=]\s*\d+/g,  // Operazioni matematiche
            /\([^)]*\)\s*[²³⁴⁵⁶⁷⁸⁹]/g, // Esponenti
            /[₀₁₂₃₄₅₆₇₈₉]/g,         // Pedici
            /\b(sin|cos|tan|log|ln|exp|sqrt)\b/gi, // Funzioni matematiche
            /\b(theorem|lemma|proof|formula|equation)\b/gi // Parole matematiche inglesi
        ];

        // Parole chiave italiane per matematica/fisica
        const italianMathKeywords = [
            'teorema', 'dimostrazione', 'formula', 'equazione', 'funzione',
            'derivata', 'integrale', 'limite', 'serie', 'matrice',
            'vettore', 'energia', 'forza', 'velocità', 'accelerazione'
        ];

        // Controlla pattern matematici
        const hasSymbols = mathPatterns.some(pattern => pattern.test(text));
        
        // Controlla parole chiave
        const hasKeywords = italianMathKeywords.some(keyword => 
            text.toLowerCase().includes(keyword)
        );

        // Controlla spacing anomalo che potrebbe indicare formule
        const hasFormulaLikeSpacing = textItems.some(item => {
            const str = item.str.trim();
            return str.length === 1 && /[a-zA-Z0-9=+\-*/()²³]/.test(str);
        });

        return hasSymbols || hasKeywords || hasFormulaLikeSpacing;
    }

    classifyContentTypes(text, hasImages, hasMathContent) {
        const types = [];
        
        if (text.length > 100) types.push('text');
        if (hasImages) types.push('images');
        if (hasMathContent) types.push('mathematical');
        
        // Classifica per disciplina
        const lowerText = text.toLowerCase();
        if (lowerText.includes('fisica') || lowerText.includes('meccanica') || 
            lowerText.includes('energia') || lowerText.includes('forza')) {
            types.push('physics');
        }
        
        if (lowerText.includes('matematica') || lowerText.includes('calcolo') ||
            lowerText.includes('algebra') || lowerText.includes('geometria')) {
            types.push('mathematics');
        }

        if (lowerText.includes('chimica') || lowerText.includes('molecola') ||
            lowerText.includes('atomo') || lowerText.includes('reazione')) {
            types.push('chemistry');
        }

        if (types.length === 0) types.push('general');
        
        return types;
    }

    estimateComplexity(metrics) {
        let score = 0;
        
        // Punteggio basato su pagine
        if (metrics.pages > 20) score += 3;
        else if (metrics.pages > 10) score += 2;
        else if (metrics.pages > 5) score += 1;
        
        // Punteggio basato su densità testo
        if (metrics.textDensity > 2000) score += 3;
        else if (metrics.textDensity > 1000) score += 2;
        else if (metrics.textDensity > 500) score += 1;
        
        // Punteggio basato su immagini
        if (metrics.imageCount > 20) score += 3;
        else if (metrics.imageCount > 10) score += 2;
        else if (metrics.imageCount > 5) score += 1;
        
        // Punteggio basato su contenuto matematico
        if (metrics.mathContent > 5) score += 3;
        else if (metrics.mathContent > 2) score += 2;
        else if (metrics.mathContent > 0) score += 1;
        
        // Determina complessità
        if (score >= 8) return 'very_high';
        if (score >= 6) return 'high';
        if (score >= 4) return 'medium';
        if (score >= 2) return 'low';
        return 'very_low';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Metodo per preparare i dati per Gemini
    prepareForGemini(processedPdf, additionalContext = {}) {
        return {
            mimeType: processedPdf.mimeType,
            data: processedPdf.base64Data,
            metadata: {
                ...processedPdf.metadata,
                ...additionalContext,
                geminiReady: true,
                processingTimestamp: new Date().toISOString()
            },
            analysisContext: {
                totalPages: processedPdf.analysis.totalPages,
                complexity: processedPdf.analysis.estimatedComplexity,
                hasVisualElements: processedPdf.analysis.hasImages || processedPdf.analysis.hasFormulas,
                contentTypes: processedPdf.analysis.contentTypes,
                recommendedApproach: this.getRecommendedExaminationApproach(processedPdf.analysis)
            }
        };
    }

    getRecommendedExaminationApproach(analysis) {
        const approaches = [];
        
        if (analysis.hasFormulas) {
            approaches.push('formula_explanation');
            approaches.push('derivation_required');
        }
        
        if (analysis.hasImages) {
            approaches.push('diagram_interpretation');
            approaches.push('visual_explanation');
        }
        
        if (analysis.contentTypes.includes('physics')) {
            approaches.push('conceptual_understanding');
            approaches.push('practical_application');
        }
        
        if (analysis.estimatedComplexity === 'high' || analysis.estimatedComplexity === 'very_high') {
            approaches.push('comprehensive_treatment');
            approaches.push('advanced_questions');
        } else {
            approaches.push('complete_coverage');
            approaches.push('basic_understanding');
        }
        
        return approaches;
    }

    // Metodo di utilità per validare il PDF prima del processing
    async validatePdf(fileInput) {
        try {
            let arrayBuffer;
            
            if (fileInput instanceof Blob) {
                arrayBuffer = await fileInput.arrayBuffer();
            } else if (typeof fileInput === 'string') {
                // Assume sia un URL
                const response = await fetch(fileInput);
                arrayBuffer = await response.arrayBuffer();
            } else {
                throw new Error('Invalid file input type');
            }
            
            // Controlla se è un PDF valido
            const uint8Array = new Uint8Array(arrayBuffer);
            const header = new TextDecoder().decode(uint8Array.slice(0, 5));
            
            if (!header.startsWith('%PDF')) {
                throw new Error('File is not a valid PDF');
            }
            
            // Prova a caricare con PDF.js per validazione aggiuntiva
            const loadingTask = pdfjsLib.getDocument(arrayBuffer);
            const pdf = await loadingTask.promise;
            
            return {
                isValid: true,
                pages: pdf.numPages,
                fileSize: arrayBuffer.byteLength,
                version: header
            };
            
        } catch (error) {
            return {
                isValid: false,
                error: error.message
            };
        }
    }

    // Metodo di debug per testare il processing
    async debugProcessing(fileInput, options = {}) {
        console.log('🐛 Debug: Starting PDF processing...');
        
        const validation = await this.validatePdf(fileInput);
        console.log('🐛 Validation result:', validation);
        
        if (!validation.isValid) {
            throw new Error(`PDF validation failed: ${validation.error}`);
        }
        
        const startTime = Date.now();
        
        let result;
        if (fileInput instanceof Blob) {
            result = await this.processPdfFromBlob(fileInput, options.progressCallback);
        } else {
            result = await this.processPdfFromUrl(fileInput, options.progressCallback);
        }
        
        const processingTime = Date.now() - startTime;
        
        console.log('🐛 Processing completed in:', processingTime, 'ms');
        console.log('🐛 Result summary:', {
            pages: result.analysis.totalPages,
            size: result.fileSizeFormatted,
            hasImages: result.analysis.hasImages,
            hasFormulas: result.analysis.hasFormulas,
            complexity: result.analysis.estimatedComplexity
        });
        
        return {
            ...result,
            debugInfo: {
                processingTimeMs: processingTime,
                validationResult: validation
            }
        };
    }
}

export default PDFProcessor;