/**
 * Outgoing email. EMAIL_TRANSPORT selects how messages are sent:
 * - console (default): printed to the server log, links included
 * - memory: kept in `sentEmails` (tests)
 *
 * To use a provider (Resend, Postmark, SES, ...), add a transport here;
 * nothing else needs to change.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

/** Messages sent with EMAIL_TRANSPORT=memory */
export const sentEmails: EmailMessage[] = [];

export async function sendEmail(message: EmailMessage): Promise<void> {
  const transport = process.env.EMAIL_TRANSPORT || 'console';

  if (transport === 'memory') {
    sentEmails.push(message);
    return;
  }
  if (transport === 'console') {
    console.log(
      ['', '──── Email (console transport) ────', `To: ${message.to}`, `Subject: ${message.subject}`, '', message.text, '───────────────────────────────────', ''].join('\n')
    );
    return;
  }
  throw new Error(`Unsupported EMAIL_TRANSPORT "${transport}"`);
}
