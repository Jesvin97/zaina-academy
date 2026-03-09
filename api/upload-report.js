// api/upload-report.js
// Uploads student reports to a personal Google Drive folder using OAuth2.
//
// Required Vercel environment variables:
//   GOOGLE_CLIENT_ID        → from Google Cloud Console → Credentials → OAuth 2.0 Client
//   GOOGLE_CLIENT_SECRET    → from Google Cloud Console → Credentials → OAuth 2.0 Client
//   GOOGLE_REFRESH_TOKEN    → from OAuth Playground (developers.google.com/oauthplayground)
//   GOOGLE_DRIVE_FOLDER_ID_2 → folder ID from your personal Google Drive URL

import { google } from 'googleapis';
import { IncomingForm } from 'formidable';
import fs from 'fs';

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  // ── 1. Parse multipart form ──────────────────────────────────────────────
  const form = new IncomingForm({ maxFileSize: 20 * 1024 * 1024 });
  let fields, files;
  try {
    [fields, files] = await new Promise((resolve, reject) =>
      form.parse(req, (err, f, fi) => (err ? reject(err) : resolve([f, fi])))
    );
  } catch (err) {
    return res.status(400).json({ error: 'Could not parse upload: ' + err.message });
  }

  const file        = Array.isArray(files.file)         ? files.file[0]         : files.file;
  const studentName = (Array.isArray(fields.studentName) ? fields.studentName[0] : fields.studentName) || 'Unknown';
  const dayNumber   = (Array.isArray(fields.dayNumber)   ? fields.dayNumber[0]   : fields.dayNumber)   || '0';

  if (!file) return res.status(400).json({ error: 'No file received' });

  // ── 2. Check env vars ────────────────────────────────────────────────────
  const folderId     = process.env.GOOGLE_DRIVE_FOLDER_ID_2;
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!folderId)     return res.status(500).json({ error: 'GOOGLE_DRIVE_FOLDER_ID_2 is not set' });
  if (!clientId)     return res.status(500).json({ error: 'GOOGLE_CLIENT_ID is not set' });
  if (!clientSecret) return res.status(500).json({ error: 'GOOGLE_CLIENT_SECRET is not set' });
  if (!refreshToken) return res.status(500).json({ error: 'GOOGLE_REFRESH_TOKEN is not set' });

  // ── 3. Auth via OAuth2 — uploads as you, directly into your My Drive ─────
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  // ── 4. Build filename and upload ─────────────────────────────────────────
  const ext      = (file.originalFilename || 'report').split('.').pop().toLowerCase();
  const date     = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const fileName = `Day${dayNumber} - ${studentName} - ${date}.${ext}`;

  try {
    const uploaded = await drive.files.create({
      requestBody: {
        name:    fileName,
        parents: [folderId],
      },
      media: {
        mimeType: file.mimetype || 'application/octet-stream',
        body:     fs.createReadStream(file.filepath),
      },
      fields: 'id, name, webViewLink',
    });

    return res.status(200).json({
      success:  true,
      fileName: uploaded.data.name,
      fileId:   uploaded.data.id,
      link:     uploaded.data.webViewLink,
    });

  } catch (err) {
    console.error('[upload-report] Drive error:', err);
    return res.status(500).json({ error: 'Google Drive upload failed: ' + err.message });
  }
}