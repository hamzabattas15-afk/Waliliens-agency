import { Resend } from 'resend';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const resend = new Resend(env.RESEND_API_KEY);

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  try {
    const { data, error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      replyTo: options.replyTo,
    });

    if (error) {
      throw new Error(`Resend API error: ${error.message}`);
    }

    logger.info({ emailId: data?.id, to: options.to }, 'Email sent successfully');
  } catch (err) {
    logger.error({ err, to: options.to }, 'Failed to send email');
    throw err;
  }
}

// ─── Email templates ──────────────────────────────────────────────────────────

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

// User-controlled values (name/email/message from the contact form, up to
// 5000 chars) are interpolated raw into these HTML email templates — escape
// before embedding to prevent HTML/script injection into the rendered email.
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

export function buildConfirmationEmail(name: string): string {
  const safeName = escapeHtml(name);
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Waliliens — Demande reçue</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="padding:40px 40px 32px;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);border-radius:16px 16px 0 0;text-align:center;">
              <p style="margin:0;font-size:13px;letter-spacing:4px;color:#8b7cf8;font-weight:600;text-transform:uppercase;">WALILIENS</p>
              <h1 style="margin:16px 0 0;font-size:28px;font-weight:700;color:#ffffff;line-height:1.2;">
                Votre demande<br/>est bien reçue.
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;background:#111118;border-left:1px solid #1e1e2e;border-right:1px solid #1e1e2e;">
              <p style="margin:0 0 20px;font-size:16px;color:#a0a0b8;line-height:1.7;">
                Bonjour <strong style="color:#ffffff;">${safeName}</strong>,
              </p>
              <p style="margin:0 0 20px;font-size:16px;color:#a0a0b8;line-height:1.7;">
                Merci pour votre message — nous l'avons bien reçu et nous vous répondrons <strong style="color:#8b7cf8;">sous deux jours ouvrés</strong>.
              </p>
              <p style="margin:0 0 32px;font-size:16px;color:#a0a0b8;line-height:1.7;">
                En attendant, n'hésitez pas à explorer nos projets et services sur notre site.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://waliliens.com" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#8b7cf8,#6c63ff);color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.5px;">
                      Visiter notre site ↗
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;background:#0d0d14;border-radius:0 0 16px 16px;border:1px solid #1e1e2e;border-top:0;text-align:center;">
              <p style="margin:0;font-size:13px;color:#4a4a6a;line-height:1.6;">
                Waliliens — Développement web &amp; automatisation par IA<br/>
                <a href="mailto:hello@waliliens.com" style="color:#8b7cf8;text-decoration:none;">hello@waliliens.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildTeamNotificationEmail(data: {
  name: string;
  email: string;
  projectType: string;
  message: string;
  leadId: string;
}): string {
  const projectTypeLabels: Record<string, string> = {
    web_development: '🌐 Développement web',
    ai_automation: '🤖 Automatisation par IA',
    both: '🌐🤖 Les deux',
  };

  const safeName = escapeHtml(data.name);
  const safeEmail = escapeHtml(data.email);
  // Escape first, then convert newlines — escaping after would double-encode
  // the `<br/>` markup we just inserted.
  const safeMessage = escapeHtml(data.message).replace(/\n/g, '<br/>');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Nouveau lead — ${safeName}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f8;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="padding:32px 32px 24px;background:linear-gradient(135deg,#1a1a2e,#16213e);">
              <p style="margin:0;font-size:12px;letter-spacing:4px;color:#8b7cf8;font-weight:600;text-transform:uppercase;">WALILIENS / NOUVEAU LEAD</p>
              <h1 style="margin:12px 0 0;font-size:22px;color:#ffffff;font-weight:700;">
                ${safeName} vient de soumettre une demande
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:12px 16px;background:#f8f8fc;border-radius:8px;border-left:3px solid #8b7cf8;margin-bottom:12px;display:block;">
                    <p style="margin:0;font-size:12px;color:#8b7cf8;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Email</p>
                    <p style="margin:4px 0 0;font-size:16px;color:#1a1a2e;font-weight:500;">${safeEmail}</p>
                  </td>
                </tr>
                <tr><td style="height:12px;"></td></tr>
                <tr>
                  <td style="padding:12px 16px;background:#f8f8fc;border-radius:8px;border-left:3px solid #6c63ff;">
                    <p style="margin:0;font-size:12px;color:#6c63ff;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Type de projet</p>
                    <p style="margin:4px 0 0;font-size:16px;color:#1a1a2e;font-weight:500;">${projectTypeLabels[data.projectType] ?? data.projectType}</p>
                  </td>
                </tr>
                <tr><td style="height:12px;"></td></tr>
                <tr>
                  <td style="padding:16px;background:#f8f8fc;border-radius:8px;border-left:3px solid #4ecdc4;">
                    <p style="margin:0;font-size:12px;color:#4ecdc4;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Message</p>
                    <p style="margin:8px 0 0;font-size:15px;color:#2a2a3e;line-height:1.6;">${safeMessage}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:13px;color:#8a8a9a;">
                Lead ID: <code style="background:#f0f0f8;padding:2px 6px;border-radius:4px;font-size:12px;">${data.leadId}</code>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
