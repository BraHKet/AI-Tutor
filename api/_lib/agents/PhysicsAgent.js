// =================================================================
// FILE: src/agents/PhysicsAgent.js (VERSIONE FRONTEND - CLIENT API)
// Questo file è un "telecomando" per l'API del backend.
// Non contiene logica di business, ma solo chiamate di rete.
// =================================================================

export class PhysicsAgent {
    constructor() {
        // Lo stato della conversazione (il materiale analizzato) ora viene
        // gestito qui, nel client, per essere inviato al backend stateless
        // ad ogni richiesta.
        this.currentMaterial = null;
    }

    /**
     * Funzione helper privata per centralizzare tutte le chiamate
     * al nostro endpoint API di backend.
     * @param {string} action - Il nome del metodo da eseguire sul backend (es. 'analyzeMaterial').
     * @param {object} payload - I dati da inviare insieme all'azione.
     * @returns {Promise<any>} - La risposta JSON dal server.
     */
    async _callApi(action, payload) {
        try {
            const response = await fetch('/api/agent', { // Chiama il nostro unico endpoint proxy
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action,
                    payload
                }), // Invia l'azione e i dati
            });

            const result = await response.json();

            if (!response.ok) {
                // Se il server risponde con un errore (es. status 500),
                // lancia un errore con il messaggio fornito dal backend.
                throw new Error(result.error || 'API call failed with status ' + response.status);
            }

            return result;

        } catch (error) {
            console.error(`[API Client Error] Action '${action}' failed:`, error);
            // Rilancia l'errore in modo che possa essere catturato dalla UI (es. AgentDemo.js)
            throw error;
        }
    }

    /**
     * Converte un file Blob in una stringa Base64 per l'invio tramite JSON.
     * @param {Blob} blob - Il file PDF da convertire.
     * @returns {Promise<string>} - La stringa Base64 del file.
     */
    _blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
                // Rimuoviamo l'intestazione 'data:application/pdf;base64,'
                // per inviare solo i dati puri.
                resolve(reader.result.split(',')[1]);
            };
            reader.onerror = error => reject(error);
        });
    }

    // --- METODI PUBBLICI (L'INTERFACCIA NON CAMBIA) ---

    // Il metodo initialize non è più necessario nel frontend,
    // poiché l'inizializzazione avviene on-demand sul server.

    async analyzeMaterial(file, progressCallback) {
        // La funzione di callback sul progresso non può più essere supportata
        // in questo modello semplice, poiché l'elaborazione è un'unica chiamata atomica.
        // La UI mostrerà semplicemente uno stato di caricamento generico.
        progressCallback?.({ message: 'Sending material to server...' });

        // 1. Converti il file per poterlo inviare.
        const base64 = await this._blobToBase64(file.blob);

        // 2. Chiama l'API per fare il vero lavoro di analisi sul backend.
        const result = await this._callApi('analyzeMaterial', {
            file: { base64 }
        });

        // 3. Il backend restituisce il materiale elaborato. Lo salviamo
        //    nello stato del nostro client per le chiamate successive.
        this.currentMaterial = result.currentMaterial;

        progressCallback?.({ message: 'Server processing complete!' });
        return { success: result.success };
    }

    async startExamination() {
        if (!this.currentMaterial) {
            throw new Error("Material not analyzed. Cannot start examination.");
        }

        // Inoltra la chiamata all'API, passando lo stato che abbiamo salvato.
        return await this._callApi('startExamination', {
            currentMaterial: this.currentMaterial
        });
    }

    async processResponse(responseData) {
        // Inoltra la chiamata all'API, passando sia lo stato che la nuova risposta.
        return await this._callApi('processResponse', {
            currentMaterial: this.currentMaterial,
            responseData: responseData
        });
    }

    async generateFinalEvaluation() {
        // Inoltra semplicemente la chiamata.
        return await this._callApi('generateFinalEvaluation', {});
    }

    reset() {
        // Resetta lo stato locale del client.
        this.currentMaterial = null;

        // Opzionalmente, possiamo notificare il backend, anche se è stateless.
        // Questa è una chiamata "fire-and-forget", non aspettiamo la risposta.
        this._callApi('reset', {});
    }
}

export default PhysicsAgent;