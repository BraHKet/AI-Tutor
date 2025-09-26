// =================================================================
// FILE: src/agents/PhysicsAgent.js (CLIENT API - "IL TELECOMANDO")
// Questo file deve trovarsi nel frontend.
// =================================================================

export class PhysicsAgent {
    constructor() {
        this.currentMaterial = null;
        // MODIFICA CHIAVE 1: Aggiungiamo un posto per l'ID di sessione.
        this.sessionId = null;
    }

    _generateSessionId() {
        // Un modo semplice per creare un ID univoco per la sessione.
        return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    async _callApi(action, payload) {
        try {
            // MODIFICA CHIAVE 2: Aggiungiamo SEMPRE il sessionId al payload.
            // Il backend ora se lo aspetta per ogni chiamata.
            const fullPayload = {
                ...payload,
                sessionId: this.sessionId,
            };

            const response = await fetch('/api/agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, payload: fullPayload }), // invia il payload completo
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'API call failed');
            }
            return result;
        } catch (error) {
            console.error(`[API Client Error] Action '${action}' failed:`, error);
            throw error;
        }
    }

    _blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => { resolve(reader.result.split(',')[1]); };
            reader.onerror = error => reject(error);
        });
    }

    async analyzeMaterial(file, progressCallback) {
        // MODIFICA CHIAVE 3: Quando l'analisi inizia, creiamo una NUOVA sessione.
        this.sessionId = this._generateSessionId();
        console.log(`[Frontend Agent] New session started with ID: ${this.sessionId}`);

        progressCallback?.({ message: 'Converting and sending file...' });
        const base64 = await this._blobToBase64(file.blob);
        const result = await this._callApi('analyzeMaterial', { file: { base64 } });
        
        // Non abbiamo più bisogno di salvare currentMaterial qui, il backend se ne ricorda.
        // this.currentMaterial = result.currentMaterial; // RIGA OBSOLETA
        
        return { success: result.success };
    }

    async startExamination() {
        // Non dobbiamo più passare currentMaterial. Il backend lo sa già.
        // if (!this.currentMaterial) throw new Error("Material not analyzed."); // Controllo non più necessario qui
        return await this._callApi('startExamination', {});
    }

    async processResponse(responseData) {
        // Anche qui, non serve più passare currentMaterial.
        return await this._callApi('processResponse', {
            responseData: responseData
        });
    }

    async generateFinalEvaluation() {
        return await this._callApi('generateFinalEvaluation', {});
    }

    reset() {
        // Invia la chiamata di reset CON il sessionId corrente per permettere
        // al backend di pulire l'agente corretto.
        this._callApi('reset', {});
        
        // Pulisce lo stato del frontend.
        this.currentMaterial = null;
        this.sessionId = null;
        console.log('[Frontend Agent] Session reset.');
    }
}

export default PhysicsAgent;