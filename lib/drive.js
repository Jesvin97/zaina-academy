const { google } = require('googleapis');
const pdfParse = require('pdf-parse');
function getAuthClient() {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  return new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
}
async function findFileByName(folderId, fileName) {
  const auth = getAuthClient();
  const drive = google.drive({ version: 'v3', auth });
  const res = await drive.files.list({ q: "'" + folderId + "' in parents and name='" + fileName + "'", fields: 'files(id,name)' });
  return res.data.files[0] || null;
}
async function downloadFile(fileId) {
  const auth = getAuthClient();
  const drive = google.drive({ version: 'v3', auth });
  const res = await drive.files.get({ fileId: fileId, alt: 'media' }, { responseType: 'arraybuffer' });
  return Buffer.from(res.data);
}
async function fetchAndExtractPdf(folderId, dayNumber) {
  const fileName = 'day' + dayNumber + '.pdf';
  const file = await findFileByName(folderId, fileName);
  if (!file) throw new Error('File ' + fileName + ' not found in Drive');
  const buffer = await downloadFile(file.id);
  const data = await pdfParse(buffer);
  return { filename: fileName, fileId: file.id, content: data.text };
}
module.exports = { findFileByName, downloadFile, fetchAndExtractPdf };
