// =================================================================
// FILE: src/agents/PhysicsAgent.js (VERSIONE FRONTEND - CLIENT API)
// Questo è il file che deve esistere nel frontend.
// È il "telecomando" per l'API del backend.
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

    async analyzeMaterial(file, progressCallback) {
        progressCallback?.({ message: 'Sending material to server...' });

        const base64 = await this._blobToBase64(file.blob);

        const result = await this._callApi('analyzeMaterial', {
            file: { base64 }
        });

        this.currentMaterial = result.currentMaterial;

        progressCallback?.({ message: 'Server processing complete!' });
        return { success: result.success };
    }

    async startExamination() {
        if (!this.currentMaterial) {
            throw new Error("Material not analyzed. Cannot start examination.");
        }

        return await this._callApi('startExamination', {
            currentMaterial: this.currentMaterial
        });
    }

    async processResponse(responseData) {
        return await this._callApi('processResponse', {
            currentMaterial: this.currentMaterial,
            responseData: responseData
        });
    }

    async generateFinalEvaluation() {
        return await this._callApi('generateFinalEvaluation', {});
    }

    reset() {
        this.currentMaterial = null;
        this._callApi('reset', {});
    }
}

export default PhysicsAgent;