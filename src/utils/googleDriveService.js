// src/utils/googleDriveService.js

class GoogleDriveService {
  // Proprietà statiche per condividere lo stato tra istanze
  static instance = null;
  static isInitialized = false;
  static isInitializing = false;
  static initPromise = null;
  static initializationAttempts = 0;
  static MAX_INITIALIZATION_ATTEMPTS = 3;
  static gapiLoaded = false;
  static gsiLoaded = false;
  static tokenPromise = null; 
  
  constructor() {
    // Implementazione del pattern singleton
    if (GoogleDriveService.instance) {
      return GoogleDriveService.instance;
    }
    
    GoogleDriveService.instance = this;
    
    this.accessToken = null;
    this.tokenClient = null;
    this.MAX_FILE_SIZE_MB = 50; // Maximum file size in MB
    
    // IMPORTANTE: Assicurati di avere le credenziali corrette
    this.CLIENT_ID = '954741971381-4qtl2v6f4b2iebt23kd827sumf6d31dg.apps.googleusercontent.com';
    this.API_KEY = 'AIzaSyDEvG7PnTdzMg5xF_xO-u97cjO4QF4rRaw';
    this.SCOPES = 'https://www.googleapis.com/auth/drive.file';
    this.FOLDER_NAME = 'AI Tutor Files';
    
    console.log('GoogleDriveService: Singleton instance created');
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

  // Controlla la dimensione del file
  checkFileSize(file) {
    const fileSizeMB = file.size / (1024 * 1024);
    console.log(`GoogleDriveService: File size check - ${file.name}: ${fileSizeMB.toFixed(2)} MB`);
    
    if (fileSizeMB > this.MAX_FILE_SIZE_MB) {
      throw new Error(`Il file ${file.name} supera la dimensione massima consentita di ${this.MAX_FILE_SIZE_MB} MB`);
    }
    
    return true;
  }

  // Inizializza Google API Client con singleton pattern
  async initialize() {
    console.log('GoogleDriveService: initialize() called');
    
    // Verifica se è già inizializzato
    if (GoogleDriveService.isInitialized) {
      console.log('GoogleDriveService: Already initialized');
      return true;
    }
    
    // Se è già in corso un'inizializzazione, restituisci la stessa promise
    if (GoogleDriveService.isInitializing && GoogleDriveService.initPromise) {
      console.log('GoogleDriveService: Initialization already in progress, returning existing promise');
      return GoogleDriveService.initPromise;
    }
    
    console.log('GoogleDriveService: Starting new initialization process');
    GoogleDriveService.isInitializing = true;
    GoogleDriveService.initializationAttempts++;
    
    // Reset delle librerie caricate se stiamo ritentando
    if (GoogleDriveService.initializationAttempts > 1) {
      GoogleDriveService.gapiLoaded = false;
      GoogleDriveService.gsiLoaded = false;
    }
    
    // Crea una nuova promise e memorizzala
    GoogleDriveService.initPromise = new Promise(async (resolve, reject) => {
      try {
        // Imposta un timeout per l'intera inizializzazione
        const timeoutId = setTimeout(() => {
          GoogleDriveService.isInitializing = false;
          GoogleDriveService.initPromise = null;
          reject(new Error('Timeout inizializzazione'));
        }, 20000);
        
        // Processo di inizializzazione
        await this._initializeProcess();
        
        // Cancella il timeout se l'inizializzazione ha successo
        clearTimeout(timeoutId);
        
        GoogleDriveService.isInitialized = true;
        GoogleDriveService.isInitializing = false;
        console.log('GoogleDriveService: Initialization completed successfully');
        resolve(true);
      } catch (error) {
        console.error('GoogleDriveService: Initialization error:', error);
        GoogleDriveService.isInitializing = false;
        GoogleDriveService.initPromise = null;
        
        // Riprova l'inizializzazione se non abbiamo superato il numero massimo di tentativi
        if (GoogleDriveService.initializationAttempts < GoogleDriveService.MAX_INITIALIZATION_ATTEMPTS) {
          console.log(`GoogleDriveService: Retrying initialization (attempt ${GoogleDriveService.initializationAttempts + 1}/${GoogleDriveService.MAX_INITIALIZATION_ATTEMPTS})...`);
          // Chiamata ricorsiva per riprovare dopo un breve ritardo
          setTimeout(() => {
            resolve(this.initialize());
          }, 1000);
        } else {
          reject(new Error(`Inizializzazione fallita dopo ${GoogleDriveService.MAX_INITIALIZATION_ATTEMPTS} tentativi: ${error.message}`));
        }
      }
    });
    
    return GoogleDriveService.initPromise;
  }
  
  // Processo interno di inizializzazione
  async _initializeProcess() {
    try {
      // Aspetta che GSI sia caricato
      if (!GoogleDriveService.gsiLoaded) {
        console.log('GoogleDriveService: Waiting for GSI to be ready...');
        await this.waitForGSI();
        GoogleDriveService.gsiLoaded = true;
        console.log('GoogleDriveService: GSI is ready');
      } else {
        console.log('GoogleDriveService: GSI already loaded');
      }
      
      // Carica Google API se non è già caricata
      if (!GoogleDriveService.gapiLoaded) {
        console.log('GoogleDriveService: Loading Google API script...');
        await this.loadGoogleScript();
        GoogleDriveService.gapiLoaded = true;
        console.log('GoogleDriveService: Google API script loaded');
      } else {
        console.log('GoogleDriveService: Google API script already loaded');
      }
      
      // Verifica se il client è già stato inizializzato
      if (window.gapi && window.gapi.client && window.gapi.client.getToken) {
        console.log('GoogleDriveService: GAPI client already initialized');
        return true;
      }
      
      // Inizializza il client per le API
      console.log('GoogleDriveService: Loading client...');
      
      // Usa una Promise per avvolgere gapi.load per controllare meglio il flusso
      await new Promise((resolve, reject) => {
        try {
          window.gapi.load('client', {
            callback: () => {
              console.log('GoogleDriveService: Client loaded successfully');
              resolve();
            },
            onerror: (err) => {
              console.error('GoogleDriveService: Error loading client:', err);
              reject(new Error('Failed to load GAPI client'));
            },
            timeout: 10000,
            ontimeout: () => {
              console.error('GoogleDriveService: Timeout loading client');
              reject(new Error('Timeout loading GAPI client'));
            }
          });
        } catch (err) {
          console.error('GoogleDriveService: Exception in gapi.load:', err);
          reject(err);
        }
      });
      
      console.log('GoogleDriveService: Initializing gapi client...');
      try {
        await window.gapi.client.init({
          apiKey: this.API_KEY,
        });
        console.log('GoogleDriveService: GAPI client initialized successfully');
        return true;
      } catch (err) {
        console.error('GoogleDriveService: Error initializing GAPI client:', err);
        throw err;
      }
    } catch (error) {
      console.error('GoogleDriveService: Error in initialization process:', error);
      throw error;
    }
  }

  // Aspetta che GSI sia caricato con timeout
  waitForGSI() {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 50; // circa 5 secondi
      
      // Se GSI è già caricato, risolvi immediatamente
      if (window.google && window.google.accounts && window.google.accounts.oauth2) {
        resolve();
        return;
      }
      
      const checkGSI = () => {
        attempts++;
        if (window.google && window.google.accounts && window.google.accounts.oauth2) {
          resolve();
        } else if (attempts > maxAttempts) {
          reject(new Error('Timeout nel caricamento di Google Identity Services'));
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
      // Se gapi è già caricato, risolvi immediatamente
      if (window.gapi) {
        console.log('GoogleDriveService: gapi already loaded');
        resolve();
        return;
      }

      // Rimuovi eventuali script esistenti (in caso di ricaricamento)
      const existingScript = document.querySelector('script[src*="apis.google.com/js/api.js"]');
      if (existingScript) {
        existingScript.parentNode.removeChild(existingScript);
        console.log('GoogleDriveService: Removed existing gapi script');
      }

      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.async = true;
      script.defer = true;
      
      // Aggiungi un timeout per il caricamento dello script
      const timeout = setTimeout(() => {
        reject(new Error('Timeout nel caricamento dello script Google API'));
      }, 10000);
      
      script.onload = () => {
        clearTimeout(timeout);
        console.log('GoogleDriveService: Google API script loaded');
        
        // Lascia un po' di tempo all'API per inizializzarsi
        setTimeout(() => {
          if (window.gapi) {
            resolve();
          } else {
            reject(new Error('Google API loaded but gapi object not available'));
          }
        }, 500);
      };
      
      script.onerror = (error) => {
        clearTimeout(timeout);
        console.error('GoogleDriveService: Failed to load Google API script', error);
        reject(new Error('Failed to load Google API script'));
      };
      
      document.head.appendChild(script);
    });
  }

  // Ottieni il token di accesso usando Google Identity Services (GSI)
  async getAccessToken() {
    // Se abbiamo già un token valido (non scaduto), restituiscilo.
    // NOTA: questo codice non verifica la scadenza del token. Per una maggiore robustezza,
    // si potrebbe aggiungere un controllo sulla scadenza o invalidare il token in caso di errore 401.
    if (this.accessToken) {
        console.log('GoogleDriveService: Using existing access token');
        return this.accessToken;
    }

    // Se una richiesta di token è già in corso, attendi quella promise esistente.
    if (GoogleDriveService.tokenPromise) {
        console.log('GoogleDriveService: Access token request already in progress, returning existing promise');
        return GoogleDriveService.tokenPromise;
    }

    console.log('GoogleDriveService: Creating new access token promise');
    // Crea una nuova promise per questa richiesta di token e memorizzala staticamente.
    GoogleDriveService.tokenPromise = new Promise((resolve, reject) => {
        try {
            if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
                GoogleDriveService.tokenPromise = null; // Resetta in caso di errore immediato
                reject(new Error('Google Identity Services non è caricato'));
                return;
            }

            // Inizializza tokenClient solo se non esiste.
            // La callback di initTokenClient verrà usata per risolvere/rigettare la promise condivisa.
            if (!this.tokenClient) {
                console.log('GoogleDriveService: Initializing token client for getAccessToken');
                this.tokenClient = window.google.accounts.oauth2.initTokenClient({
                    client_id: this.CLIENT_ID,
                    scope: this.SCOPES,
                    callback: (response) => { // Questa callback viene chiamata da GSI
                        console.log('GoogleDriveService: Token response received from GSI callback');
                        if (response.access_token) {
                            this.accessToken = response.access_token;
                            console.log('GoogleDriveService: Access token obtained and stored.');
                            GoogleDriveService.tokenPromise = null; // Resetta la promise condivisa per future richieste
                            resolve(this.accessToken);
                        } else {
                            console.error('GoogleDriveService: GSI callback - Failed to get access token, response:', response);
                            GoogleDriveService.tokenPromise = null;
                            reject(new Error('Failed to get access token from GSI callback'));
                        }
                    },
                    error_callback: (error) => {
                        console.error('GoogleDriveService: GSI Token error_callback', error);
                        GoogleDriveService.tokenPromise = null; // Resetta la promise condivisa
                        reject(new Error(`GSI token error: ${error.type || error.message || 'Unknown error'}`));
                    }
                });
                console.log('GoogleDriveService: Token client initialized.');
            } else {
                console.log('GoogleDriveService: Using existing token client.');
            }
            
            console.log('GoogleDriveService: Requesting access token via GSI...');
            // Richiedi il token. Se l'utente non è loggato o il consenso non è dato,
            // GSI gestirà il flusso (es. mostrando un popup).
            // Aggiungere {prompt: ''} può tentare di ottenere il token senza interazione utente se possibile.
            this.tokenClient.requestAccessToken({ prompt: '' });

        } catch (error) {
            console.error('GoogleDriveService: Error in getAccessToken promise setup', error);
            GoogleDriveService.tokenPromise = null; // Resetta la promise condivisa
            reject(error);
        }
    });
    return GoogleDriveService.tokenPromise;
}

  // Verifica se l'utente è autenticato
  async ensureAuthenticated() {
    console.log('GoogleDriveService: ensureAuthenticated() called');
    
    if (!GoogleDriveService.isInitialized) {
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
    
    // Verifica la dimensione del file
    this.checkFileSize(file);
    
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
      
      // Imposta un timeout per l'upload (30 minuti)
      xhr.timeout = 30 * 60 * 1000;

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
        xhr.ontimeout = () => {
          console.error('GoogleDriveService: Upload timed out');
          reject(new Error('Timeout durante il caricamento del file'));
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
}

// Esporta un'istanza singleton del servizio
export const googleDriveService = new GoogleDriveService();