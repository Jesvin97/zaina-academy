// api/upload-report.js
// Receives a file from the dashboard and uploads it to your secondary Google Drive folder.
//
// Required Vercel environment variables:
//   GOOGLE_SERVICE_ACCOUNT_KEY   → the full JSON of your service account key (as a string)
//   GOOGLE_DRIVE_FOLDER_ID_2     → the folder ID of your secondary Google Drive folder
//
// How to get the folder ID:
//   Open the folder in Google Drive → copy the last part of the URL
//   e.g. https://drive.google.com/drive/folders/1A2B3C4D5E  →  ID is "1A2B3C4D5E"
//
// Share that folder with your service account email (e.g. xxx@project.iam.gserviceaccount.com)
// and give it Editor access.

import { google } from 'googleapis';
import { IncomingForm } from 'formidable';
import fs from 'fs';

export const config = {
  api: { bodyParser: false }, // required so formidable can parse the multipart body
};

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  // ── 1. Parse the multipart upload ───────────────────────────────────────
  const form = new IncomingForm({ maxFileSize: 20 * 1024 * 1024 }); // 20 MB
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

  // ── 2. Validate env vars ─────────────────────────────────────────────────
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID_2;
  if (!folderId) return res.status(500).json({ error: 'GOOGLE_DRIVE_FOLDER_ID_2 is not set in Vercel environment variables' });

  let credentials;
  try {
    credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  } catch {
    return res.status(500).json({ error: 'GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON' });
  }

  // ── 3. Authenticate with the service account ─────────────────────────────
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  const drive = google.drive({ version: 'v3', auth });

  // ── 4. Build a clean file name and upload ────────────────────────────────
  const ext      = (file.originalFilename || 'report').split('.').pop().toLowerCase();
  const date     = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  // Example result: "Day7 - Sara Ahmed - 2026-03-08.pdf"
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
