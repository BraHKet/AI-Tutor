// =================================================================
// FILE: src/agents/PhysicsAgent.js (CLIENT API - "IL TELECOMANDO")
// Questo file deve trovarsi nel frontend.
// =================================================================

export class PhysicsAgent {
    constructor() {
        this.currentMaterial = null;
    }

    async _callApi(action, payload) {
        try {
            const response = await fetch('/api/agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, payload }),
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
        // QUESTA FUNZIONE USA FileReader E DEVE STARE NEL FRONTEND
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
                resolve(reader.result.split(',')[1]);
            };
            reader.onerror = error => reject(error);
        });
    }

    async analyzeMaterial(file, progressCallback) {
        progressCallback?.({ message: 'Converting and sending file...' });
        const base64 = await this._blobToBase64(file.blob);
        const result = await this._callApi('analyzeMaterial', { file: { base64 } });
        this.currentMaterial = result.currentMaterial;
        return { success: result.success };
    }

    async startExamination() {
        if (!this.currentMaterial) throw new Error("Material not analyzed.");
        return await this._callApi('startExamination', { currentMaterial: this.currentMaterial });
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