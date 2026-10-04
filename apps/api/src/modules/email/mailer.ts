export interface Email {
  to: { email: string; name?: string };
  subject: string;
  html: string;
  text: string;
}

export type SendEmail = (email: Email) => Promise<void>;

interface BrevoConfig {
  apiKey: string;
  senderEmail: string;
  senderName: string;
}

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

/** Sends transactional emails through Brevo's HTTP API. */
export function createBrevoMailer({ apiKey, senderEmail, senderName }: BrevoConfig): SendEmail {
  return async ({ to, subject, html, text }) => {
    const response = await fetch(BREVO_URL, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: senderName },
        to: [to],
        subject,
        htmlContent: html,
        textContent: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Brevo answered ${response.status}: ${await response.text()}`);
    }
  };
}

/** Local fallback: prints the email so links can be opened without Brevo. */
export function createConsoleMailer(log: (message: string) => void): SendEmail {
  return async ({ to, subject, text }) => {
    log(`[email] To: ${to.email}\nSubject: ${subject}\n\n${text}`);
  };
}
