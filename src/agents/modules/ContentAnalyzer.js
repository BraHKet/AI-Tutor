// ==========================================
// FILE: src/agents/modules/ContentAnalyzer.js (VERSIONE COMPLETA E ROBUSTA)
// ==========================================

import { GoogleGenerativeAI } from '@google/generative-ai';
// Importa pdf.js per l'uso nel client
import * as pdfjsLib from 'pdfjs-dist/build/pdf';

// Imposta il worker per pdf.js. Questo è necessario per farlo funzionare nel browser.
// Copia il file 'pdf.worker.mjs' da 'node_modules/pdfjs-dist/build/' nella tua cartella 'public/'
// CORRETTO (per i file che hai tu)
pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.js`;

export class ContentAnalyzer {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        // ATTENZIONE: Chiave API esposta lato client. SOLO PER TEST.
        this.genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        this.agentProfile = null;
    }

    async initialize(agentProfile) {
        this.agentProfile = agentProfile;
        console.log('📊 Content Analyzer initialized');
    }

    async analyzePhysicsContent(material, progressCallback = null) {
        try {
            progressCallback?.({ status: 'extracting', message: 'Downloading and extracting text from PDF...' });
            
            const extractedText = await this.extractTextFromPdfUrl(material.url);
            
            if (!extractedText || extractedText.trim().length < 50) { // Aumentato leggermente il controllo
                throw new Error("Text extraction failed or the document is too short for analysis.");
            }

            progressCallback?.({ status: 'analyzing', message: 'Analyzing physics content with AI...' });
            
            const aiAnalysis = await this.performAIAnalysis(extractedText, material.filename);

            // MODIFICA CRITICA: Controlliamo che l'analisi AI sia andata a buon fine e abbia la struttura corretta.
            if (!aiAnalysis || !Array.isArray(aiAnalysis.topics)) {
                console.error("AI Analysis result is invalid or missing the 'topics' array:", aiAnalysis);
                // Invece di lanciare un errore, possiamo usare il fallback per continuare, ma con un avviso chiaro.
                // In questo caso, però, lanciare l'errore è più informativo per il debugging.
                throw new Error("AI analysis did not return a valid structure with a 'topics' array.");
            }
            
            progressCallback?.({ status: 'structuring', message: 'Structuring topics...' });
            
            const structuredTopics = this.structureTopicsForExamination(aiAnalysis);
            
            progressCallback?.({ status: 'storing', message: 'Saving analysis...' });
            
            // Il controllo sull'array 'topics' è già stato fatto sopra, quindi questa chiamata è sicura.
            await this.storePhysicsConcepts(material.id, structuredTopics);
            
            progressCallback?.({ status: 'completed', message: 'Analysis completed!' });
            
            return {
                success: true,
                topics: structuredTopics.topics,
                physicsAreas: structuredTopics.physicsAreas,
                overallDifficulty: structuredTopics.overallDifficulty,
                concepts: structuredTopics.concepts,
                formulas: structuredTopics.formulas,
                // Questo non darà più errore perché abbiamo verificato che 'topics' sia un array
                totalTopics: structuredTopics.topics.length
            };
        } catch (error) {
            console.error('The content analysis process failed:', error);
            progressCallback?.({ status: 'error', message: `Analysis failed: ${error.message}` });
            // Rilanciamo l'errore in modo che possa essere catturato dal chiamante (es. AgentDemo.js)
            throw error;
        }
    }

    async extractTextFromPdfUrl(url) {
        try {
            const loadingTask = pdfjsLib.getDocument(url);
            const pdf = await loadingTask.promise;
            const numPages = pdf.numPages;
            let fullText = '';

            for (let i = 1; i <= numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += pageText + '\n';
            }
            return fullText;
        } catch (error) {
            console.error("Error during PDF text extraction:", error);
            throw new Error(`Cannot read PDF from URL. Details: ${error.message}`);
        }
    }

    async performAIAnalysis(textContent, filename) {
        const prompt = `Sei un esperto professore di fisica universitaria. Analizza questo materiale di fisica e identifica:

1. ARGOMENTI PRINCIPALI: Identifica tutti i topic di fisica nel materiale
2. AREE FISICHE: Quali rami della fisica sono coperti (meccanica, termodinamica, elettromagnetismo, etc.)
3. CONCETTI CHIAVE: Principi, leggi, teoremi importanti
4. FORMULE MATEMATICHE: Equazioni e formule presenti 
5. LIVELLO DIFFICOLTÀ: Valuta il livello (1-10) per ogni argomento

MATERIALE DA ANALIZZARE:
Filename: ${filename}
Contenuto: ${textContent.slice(0, 8000)}

Restituisci la risposta in questo formato JSON:

{
  "physicsAreas": ["mechanics"],
  "overallDifficulty": 6,
  "topics": [
    {
      "topicName": "Cinematica",
      "physicsArea": "mechanics", 
      "difficulty": 5,
      "topicType": "exposition",
      "essentialPoints": [
        "Definizione di posizione e spostamento",
        "Velocità media e istantanea",
        "Accelerazione e sue proprietà"
      ],
      "advancedPoints": [
        "Derivazione delle equazioni cinematiche"
      ],
      "requiredFormulas": ["v = dr/dt", "a = dv/dt"],
      "demonstrationRequired": false,
      "estimatedExpositionTime": 10,
      "commonStudentGaps": ["Confusione tra velocità e accelerazione"]
    }
  ],
  "keyFormulas": [
    {
      "formula": "F = ma",
      "name": "Seconda legge di Newton", 
      "area": "mechanics",
      "variables": {"F": "Forza in Newton", "m": "massa in kg", "a": "accelerazione in m/s²"},
      "physicalMeaning": "La forza è proporzionale all'accelerazione"
    }
  ]
}`;

        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            return this.parseAIResponse(text);
        } catch (error) {
            console.error('AI analysis failed:', error);
            // MODIFICA: Invece di restituire il fallback, che potrebbe non essere gestito,
            // restituiamo null per indicare chiaramente il fallimento.
            return null;
        }
    }

    parseAIResponse(aiResponseText) {
        try {
            let cleanedText = aiResponseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                cleanedText = jsonMatch[0];
            } else {
                console.error("No JSON object found in the AI response string.");
                return null; // Restituisce null se non trova un oggetto JSON
            }
            
            const parsed = JSON.parse(cleanedText);
            return parsed;
        } catch (error) {
            console.error('Failed to parse AI response JSON:', error, 'Raw text:', aiResponseText);
            // MODIFICA: Restituiamo null invece del fallback per forzare la gestione dell'errore.
            return null;
        }
    }

    structureTopicsForExamination(aiAnalysis) {
        // Questa funzione ora si aspetta un aiAnalysis valido.
        // Il controllo viene fatto nel metodo chiamante (analyzePhysicsContent).
        return {
            physicsAreas: aiAnalysis.physicsAreas || [],
            overallDifficulty: aiAnalysis.overallDifficulty || 5,
            topics: aiAnalysis.topics || [],
            concepts: [],
            formulas: aiAnalysis.keyFormulas || [],
            demonstrations: []
        };
    }

    async storePhysicsConcepts(materialId, structuredTopics) {
        // Questo controllo ora è una doppia sicurezza, ma il controllo principale è in analyzePhysicsContent.
        if (!structuredTopics || !Array.isArray(structuredTopics.topics) || structuredTopics.topics.length === 0) {
            console.warn("storePhysicsConcepts: No topics to store or topics is not an array. Skipping.");
            return;
        }

        try {
            for (const topic of structuredTopics.topics) {
                // Aggiunto controllo per topic malformati
                if (!topic || typeof topic !== 'object' || !topic.topicName) {
                    console.warn("Skipping malformed topic object:", topic);
                    continue;
                }
                const { error: topicError } = await this.supabase
                    .from('physics_topics')
                    .insert({
                        material_id: materialId,
                        topic_name: topic.topicName,
                        topic_type: topic.topicType || 'exposition',
                        physics_area: topic.physicsArea,
                        difficulty_level: topic.difficulty,
                        essential_points: topic.essentialPoints || [],
                        advanced_points: topic.advancedPoints || [],
                        common_student_gaps: topic.commonStudentGaps || [],
                        estimated_exposition_time: topic.estimatedExpositionTime,
                        mathematical_content: topic.requiredFormulas || []
                    });
                
                if (topicError) {
                    console.error('Failed to store topic:', topic.topicName, topicError);
                }
            }
            
            console.log(`✅ Stored ${structuredTopics.topics.length} topics.`);
        } catch (error) {
            // Questo catch gestisce errori imprevisti nel ciclo, come un crash di Supabase.
            console.error('An unexpected error occurred while storing physics concepts:', error);
        }
    }

    // Il metodo di fallback non viene più chiamato direttamente, ma lo teniamo per riferimento o usi futuri.
    getFallbackAnalysis() {
        return {
            physicsAreas: ['mechanics'],
            overallDifficulty: 5,
            topics: [
                {
                    topicName: 'Meccanica Classica (Fallback)',
                    physicsArea: 'mechanics',
                    difficulty: 5,
                    topicType: 'exposition',
                    essentialPoints: ['Leggi di Newton', 'Cinematica', 'Dinamica'],
                    advancedPoints: [],
                    requiredFormulas: ['F = ma'],
                    demonstrationRequired: false,
                    estimatedExpositionTime: 15,
                    commonStudentGaps: ['Applicazione delle leggi']
                }
            ],
            keyFormulas: [
                {
                    formula: 'F = ma',
                    name: 'Seconda legge di Newton',
                    area: 'mechanics',
                    variables: {'F': 'forza', 'm': 'massa', 'a': 'accelerazione'},
                    physicalMeaning: 'Relazione tra forza e accelerazione'
                }
            ]
        };
    }
}

export default ContentAnalyzer;