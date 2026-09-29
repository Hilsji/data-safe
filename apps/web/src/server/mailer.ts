import nodemailer from "nodemailer";
import type { Mailer } from "./auth";

/** SMTP über SMTP_URL (lokal: Mailpit, Strato: smtps://…). Ohne SMTP_URL nur in der Entwicklung: Ausgabe in der Konsole. */
export function createMailer(): Mailer {
  const url = process.env.SMTP_URL;
  const from = process.env.MAIL_FROM ?? "Guide me <no-reply@localhost>";
  if (!url) {
    if (process.env.NODE_ENV === "production") throw new Error("SMTP_URL fehlt");
    return {
      async send(to, subject, text) {
        console.info(`[guide-me] (Entwicklung, keine Mail verschickt) An: ${to} · ${subject}\n${text}`);
        // nur für automatisierte Tests abrufbar (/api/test/last-mail, ENABLE_TEST_ROUTES=1)
        (globalThis as { __guideMeLastMail?: string }).__guideMeLastMail = text;
      },
    };
  }
  const transport = nodemailer.createTransport(url);
  return {
    async send(to, subject, text) {
      await transport.sendMail({ from, to, subject, text });
    },
  };
}
