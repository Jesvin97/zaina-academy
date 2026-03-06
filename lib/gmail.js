const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
});
function getEmailTemplate(title, content, footer) {
  return '<html><body style="background:#080c14;color:#e8e0d0;font-family:sans-serif;padding:40px"><div style="max-width:600px;margin:0 auto"><h1 style="color:#d4af5f;text-align:center">Zaina Academy</h1><h2 style="color:#d4af5f">' + title + '</h2><div style="background:#0d1220;border:1px solid rgba(212,175,95,0.12);border-radius:12px;padding:24px;white-space:pre-wrap">' + content + '</div>' + (footer ? '<p style="color:#7a7060;margin-top:20px">' + footer + '</p>' : '') + '</div></body></html>';
}
async function sendEmail(to, subject, html) {
  try {
    const r = await transporter.sendMail({ from: '"Zaina Academy" <' + process.env.GMAIL_USER + '>', to: to, subject: subject, html: html });
    return { success: true, messageId: r.messageId };
  } catch (e) { return { success: false, error: e.message }; }
}
async function sendBulkEmail(recipients, subject, title, content, footer) {
  const html = getEmailTemplate(title, content, footer || '');
  const results = [];
  for (const r of recipients) {
    results.push(await sendEmail(r, subject, html));
    await new Promise(res => setTimeout(res, 200));
  }
  return results;
}
module.exports = { sendEmail, sendBulkEmail, getEmailTemplate };
