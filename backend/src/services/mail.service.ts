import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http-error.js';

let transporter: ReturnType<typeof nodemailer.createTransport> | null | undefined;

function getTransporter() {
  if (transporter !== undefined) return transporter;
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    transporter = null;
    return transporter;
  }
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE === 'true',
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  return transporter;
}

export const mailService = {
  isConfigured() {
    return Boolean(getTransporter());
  },
  async sendMail(options: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
  }) {
    const client = getTransporter();
    if (!client) {
      throw new HttpError(
        500,
        'Email sending is not configured. Add SMTP_HOST, SMTP_USER, and SMTP_PASS to the backend environment.',
      );
    }
    await client.sendMail({ from: env.SMTP_FROM || env.SMTP_USER, ...options });
  },
};
