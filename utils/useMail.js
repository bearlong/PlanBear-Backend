import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 25, // 先用 25 測，若公司另有提供再改
  secure: false,
  tls: {
    rejectUnauthorized: false,
  },
});

export async function sendNotificationMail(data) {
  const { recipientEmail, ccEmails, subject, message, html, file } = data;
  const info = await transporter.sendMail({
    from: `"${process.env.DB_SCHEMA}" <${process.env.SMTP_TO_EMAIL}>`,
    to: recipientEmail,
    cc: ccEmails || [],
    subject: subject,
    text: message,
    html: html || message.replace(/\n/g, "<br>"),
    attachments: file ? [{ path: file }] : [],
  });

  return info;
}
