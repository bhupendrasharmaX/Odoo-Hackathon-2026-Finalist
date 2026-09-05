import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';

/**
 * Payslip email.
 *
 * SMTP is optional by design. With no SMTP host configured the send is LOGGED
 * and still reported as sent, so the whole payrun flow can be demonstrated on
 * a laptop with no network. That is specified behaviour, not a silent failure
 * - the log line says plainly that nothing left the machine.
 */

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.smtpConfigured) return null;
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });

  return transporter;
}

export interface PayslipEmail {
  to: string;
  employeeName: string;
  periodStart: Date;
  periodEnd: Date;
  net: number;
  pdf: Buffer;
}

export interface SendOutcome {
  sent: boolean;
  /** True when SMTP was not configured and the send was only logged. */
  simulated: boolean;
}

export async function sendPayslipEmail(message: PayslipEmail): Promise<SendOutcome> {
  const period = `${message.periodStart.toISOString().slice(0, 10)} to ${message.periodEnd.toISOString().slice(0, 10)}`;
  const filename = `payslip-${message.periodStart.toISOString().slice(0, 7)}.pdf`;
  const subject = `Your payslip for ${message.periodStart.toISOString().slice(0, 7)}`;

  const mail = getTransporter();

  if (!mail) {
    logger.info(
      `[mailer] SMTP not configured - simulated send of "${subject}" to ${message.to} (${message.pdf.length} byte PDF). Set SMTP_HOST and SMTP_PORT to send for real.`,
    );
    return { sent: true, simulated: true };
  }

  await mail.sendMail({
    from: env.SMTP_FROM,
    to: message.to,
    subject,
    text: [
      `Hello ${message.employeeName},`,
      '',
      `Your payslip for ${period} is attached.`,
      `Net pay: ${message.net.toFixed(2)}`,
      '',
      `- ${env.COMPANY_NAME}`,
    ].join('\n'),
    attachments: [{ filename, content: message.pdf, contentType: 'application/pdf' }],
  });

  logger.info(`[mailer] sent "${subject}" to ${message.to}`);
  return { sent: true, simulated: false };
}
