import nodemailer from 'nodemailer';
import config from './config.js';
import logger from './logger.js';

let transporter: nodemailer.Transporter | undefined;

export function getTransporter(): nodemailer.Transporter | undefined {
  if (!config.ENABLE_EMAIL) return undefined;
  if (transporter) return transporter;
  if (!config.SMTP_USER || !config.SMTP_PASS || !config.EMAIL_FROM) {
    logger.warn('Email disabled: SMTP_USER/SMTP_PASS/EMAIL_FROM missing');
    return undefined;
  }
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: config.SMTP_USER, pass: config.SMTP_PASS },
  });
  return transporter;
}

export async function sendMail(opts: { to: string; subject: string; html?: string; text?: string }): Promise<void> {
  const t = getTransporter();
  if (!t) {
    logger.info({ to: opts.to, subject: opts.subject }, 'Skipping email send (disabled)');
    return;
  }
  await t.sendMail({ from: config.EMAIL_FROM, ...opts });
}

export default { sendMail };
