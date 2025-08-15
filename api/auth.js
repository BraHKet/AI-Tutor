// api/auth.js
import { OAuth2Client } from 'google-auth-library';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end(); // Method Not Allowed
  }

  // Le tue credenziali segrete, lette dalle variabili d'ambiente di Vercel
  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URL; // L'URL del tuo sito Vercel

  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Authorization code is missing.' });
  }

  try {
    const oAuth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
    
    // Scambia il codice per i token. Questa è l'operazione sicura che ora avviene nel backend.
    const { tokens } = await oAuth2Client.getToken(code);
    
    // Invia i token al frontend.
    // In un'app di produzione completa, salveresti il refresh_token nel DB qui.
    // Per l'MVP, inviarli indietro è accettabile.
    return res.status(200).json({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token, // Potrebbe non essere sempre presente
      idToken: tokens.id_token,
    });

  } catch (error) {
    console.error('Error exchanging authorization code:', error.message);
    return res.status(500).json({ error: 'Failed to exchange authorization code.' });
  }
}