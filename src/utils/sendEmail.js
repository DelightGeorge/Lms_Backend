// src/utils/sendEmail.js
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host:    process.env.EMAIL_HOST || "smtp.gmail.com",
  port:    Number(process.env.EMAIL_PORT) || 587,
  secure:  true, // true for port 465, false for 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  // ── Timeouts: fail fast instead of hanging the request ──────────────────
  connectionTimeout: 10_000, // 10s to establish connection
  greetingTimeout:   10_000, // 10s for SMTP greeting
  socketTimeout:     15_000, // 15s for socket inactivity
});

/**
 * sendEmail(to, subject, html)
 * Throws on failure — callers should catch and decide whether to surface the
 * error to the user or swallow it (e.g. registration still succeeds).
 */
const sendEmail = async (to, subject, html) => {
  await transporter.sendMail({
    from: `"LMSPRO" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
};

module.exports = sendEmail;