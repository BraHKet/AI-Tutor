// src/utils/googleDriveService.js

class GoogleDriveService {
  constructor() {
    console.log('GoogleDriveService: Constructor called');
    this.isInitialized = false;
    this.accessToken = null;
    this.tokenClient = null;
    
    // IMPORTANTE: Assicurati di avere le credenziali corrette
    this.CLIENT_ID = '954741971381-4qtl2v6f4b2iebt23kd827sumf6d31dg.apps.googleusercontent.com';
    this.API_KEY = 'AIzaSyDEvG7PnTdzMg5xF_xO-u97cjO4QF4rRaw';
    this.SCOPES = 'https://www.googleapis.com/auth/drive.file';
    this.FOLDER_NAME = 'AI Tutor Files';
    
    // Verifica le credenziali
    this.checkConfiguration();
  }
  
  // Controlla la configurazione
  checkConfiguration() {
    console.log('GoogleDriveService: Checking configuration...');
    
    if (!this.CLIENT_ID || this.CLIENT_ID.includes('XXXXXXXXXX')) {
      console.error('GoogleDriveService: CLIENT_ID non configurato correttamente!');
    } else {
      console.log('GoogleDriveService: CLIENT_ID presente:', this.CLIENT_ID);
    }
    
    if (!this.API_KEY || this.API_KEY.includes('YOUR_API_KEY')) {
      console.error('GoogleDriveService: API_KEY non configurata correttamente!');
    } else {
      console.log('GoogleDriveService: API_KEY presente:', this.API_KEY);
    }
    
    console.log('GoogleDriveService: SCOPES:', this.SCOPES);
    console.log('GoogleDriveService: Current origin:', window.location.origin);
  }

  // Inizializza Google API Client
  async initialize() {
    console.log('GoogleDriveService: initialize() called');
    
    if (this.isInitialized) {
      console.log('GoogleDriveService: Already initialized');
      return true;
    }

    try {
      // Aspetta che GSI sia caricato (è già nel index.html)
      console.log('GoogleDriveService: Waiting for GSI to be ready...');
      await this.waitForGSI();
      console.log('GoogleDriveService: GSI is ready');
      
      // Carica Google API
      console.log('GoogleDriveService: Loading Google API script...');
      await this.loadGoogleScript();
      console.log('GoogleDriveService: Google API script loaded');
      
      // Inizializza solo il client per le API
      console.log('GoogleDriveService: Loading client...');
      await new Promise((resolve, reject) => {
        window.gapi.load('client', {
          callback: resolve,
          onerror: reject
        });
      });
      
      console.log('GoogleDriveService: Initializing gapi client...');
      await window.gapi.client.init({
        apiKey: this.API_KEY
      });
      
      this.isInitialized = true;
      console.log('GoogleDriveService: Initialization completed');
      return true;
    } catch (error) {
      console.error('GoogleDriveService: Initialization error:', error);
      throw new Error('Inizializzazione fallita: ' + error.message);
    }
  }

  // Aspetta che GSI sia caricato
  waitForGSI() {
    return new Promise((resolve) => {
      const checkGSI = () => {
        if (window.google && window.google.accounts && window.google.accounts.oauth2) {
          resolve();
        } else {
          setTimeout(checkGSI, 100);
        }
      };
      checkGSI();
    });
  }

  // Carica lo script delle Google API
  loadGoogleScript() {
    return new Promise((resolve, reject) => {
      if (window.gapi) {
        console.log('GoogleDriveService: gapi already loaded');
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        console.log('GoogleDriveService: Google API script loaded');
        resolve();
      };
      script.onerror = (error) => {
        console.error('GoogleDriveService: Failed to load Google API script', error);
        reject(new Error('Failed to load Google API script'));
      };
      document.head.appendChild(script);
    });
  }

  // Ottieni il token di accesso usando Google Identity Services (GSI)
  async getAccessToken() {
    if (this.accessToken) {
      console.log('GoogleDriveService: Using existing access token');
      return this.accessToken;
    }

    return new Promise((resolve, reject) => {
      try {
        // Crea un tokenClient solo se non esiste
        if (!this.tokenClient) {
          this.tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: this.CLIENT_ID,
            scope: this.SCOPES,
            callback: (response) => {
              console.log('GoogleDriveService: Token response received');
              if (response.access_token) {
                this.accessToken = response.access_token;
                resolve(response.access_token);
              } else {
                reject(new Error('Failed to get access token'));
              }
            },
            error_callback: (error) => {
              console.error('GoogleDriveService: Token error', error);
              reject(error);
            }
          });
        }

        // Richiedi il token
        console.log('GoogleDriveService: Requesting access token...');
        this.tokenClient.requestAccessToken();
      } catch (error) {
        console.error('GoogleDriveService: Error creating token client', error);
        reject(error);
      }
    });
  }

  // Verifica se l'utente è autenticato
  async ensureAuthenticated() {
    console.log('GoogleDriveService: ensureAuthenticated() called');
    
    if (!this.isInitialized) {
      console.log('GoogleDriveService: Not initialized, calling initialize()');
      await this.initialize();
    }

    try {
      // Usa Google Identity Services per ottenere il token
      const token = await this.getAccessToken();
      console.log('GoogleDriveService: Access token obtained');
      return token;
    } catch (error) {
      console.error('GoogleDriveService: Error in ensureAuthenticated', error);
      throw error;
    }
  }

  // Crea o trova la cartella dell'app
  async getOrCreateAppFolder() {
    console.log('GoogleDriveService: getOrCreateAppFolder() called');
    
    const token = await this.ensureAuthenticated();
    console.log('GoogleDriveService: Token obtained for folder operation');

    try {
      // Cerca se la cartella esiste già
      console.log('GoogleDriveService: Searching for existing folder...');
      const searchResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
          `name='${this.FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
        )}&fields=files(id,name)`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!searchResponse.ok) {
        const errorData = await searchResponse.json();
        console.error('GoogleDriveService: Search failed:', errorData);
        throw new Error(`Search failed: ${searchResponse.status}`);
      }

      const searchData = await searchResponse.json();
      console.log('GoogleDriveService: Search response:', searchData);

      if (searchData.files && searchData.files.length > 0) {
        console.log('GoogleDriveService: Folder found:', searchData.files[0].id);
        return searchData.files[0].id;
      }

      // Crea la cartella se non esiste
      console.log('GoogleDriveService: Folder not found, creating new folder...');
      const createResponse = await fetch(
        'https://www.googleapis.com/drive/v3/files',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: this.FOLDER_NAME,
            mimeType: 'application/vnd.google-apps.folder'
          })
        }
      );

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        console.error('GoogleDriveService: Create folder failed:', errorData);
        throw new Error(`Create folder failed: ${createResponse.status}`);
      }

      const createData = await createResponse.json();
      console.log('GoogleDriveService: Folder created:', createData.id);
      return createData.id;
    } catch (error) {
      console.error('GoogleDriveService: Error in getOrCreateAppFolder', error);
      throw new Error('Impossibile creare la cartella su Google Drive: ' + error.message);
    }
  }

  // Carica un file su Google Drive
  async uploadFile(file, onProgress = null) {
    console.log('GoogleDriveService: uploadFile() called for file:', file.name);
    
    const token = await this.ensureAuthenticated();
    console.log('GoogleDriveService: Token obtained for upload');
    
    const folderId = await this.getOrCreateAppFolder();
    console.log('GoogleDriveService: Folder ID for upload:', folderId);

    try {
      // Prepara i metadati del file
      const metadata = {
        name: file.name,
        parents: [folderId]
      };
      console.log('GoogleDriveService: File metadata:', metadata);

      // Crea un form data per il caricamento
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', file);

      // Carica il file
      console.log('GoogleDriveService: Starting file upload...');
      const xhr = new XMLHttpRequest();
      xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink');
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      // Gestisci il progresso del caricamento
      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100;
            console.log(`GoogleDriveService: Upload progress ${percentComplete}%`);
            onProgress(percentComplete);
          }
        };
      }

      // Promisify la richiesta
      const uploadPromise = new Promise((resolve, reject) => {
        xhr.onload = () => {
          console.log('GoogleDriveService: Upload completed with status:', xhr.status);
          if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText);
            console.log('GoogleDriveService: Upload response:', response);
            resolve(response);
          } else {
            console.error('GoogleDriveService: Upload failed', xhr.responseText);
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };
        xhr.onerror = (error) => {
          console.error('GoogleDriveService: Upload error', error);
          reject(new Error('Upload failed'));
        };
      });

      xhr.send(form);
      const uploadedFile = await uploadPromise;
      console.log('GoogleDriveService: File uploaded successfully:', uploadedFile.id);

      // Imposta i permessi per rendere il file accessibile
      console.log('GoogleDriveService: Setting file permissions...');
      const permissionResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${uploadedFile.id}/permissions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            role: 'reader',
            type: 'anyone'
          })
        }
      );

      if (!permissionResponse.ok) {
        console.error('GoogleDriveService: Failed to set permissions');
      } else {
        console.log('GoogleDriveService: Permissions set successfully');
      }

      return {
        id: uploadedFile.id,
        name: file.name,
        size: file.size,
        type: file.type,
        webViewLink: uploadedFile.webViewLink,
        webContentLink: uploadedFile.webContentLink,
        driveFileId: uploadedFile.id
      };
    } catch (error) {
      console.error('GoogleDriveService: Error uploading file to Google Drive', error);
      throw new Error(`Errore durante il caricamento di ${file.name}: ${error.message}`);
    }
  }

  // Altri metodi rimangono uguali...
}

// Esporta un'istanza singleton del servizio
export const googleDriveService = new GoogleDriveService();