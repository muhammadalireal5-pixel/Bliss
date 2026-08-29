export interface SendGmailOptions {
  accessToken: string;
  fromName?: string;
  fromEmail: string;
  toEmail: string;
  toName?: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
}

export function buildRfc2822Message(options: SendGmailOptions): string {
  const fromHeader = options.fromName 
    ? `=?UTF-8?B?${Buffer.from(options.fromName).toString('base64')}?= <${options.fromEmail}>`
    : options.fromEmail;

  const toHeader = options.toName
    ? `=?UTF-8?B?${Buffer.from(options.toName).toString('base64')}?= <${options.toEmail}>`
    : options.toEmail;

  const subjectHeader = `=?UTF-8?B?${Buffer.from(options.subject).toString('base64')}?=`;

  const headers: string[] = [
    `From: ${fromHeader}`,
    `To: ${toHeader}`,
    `Subject: ${subjectHeader}`,
    `MIME-Version: 1.0`,
    `Date: ${new Date().toUTCString()}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit'
  ];

  return `${headers.join('\r\n')}\r\n\r\n${options.htmlContent}`;
}

export async function sendGmailMessage(options: SendGmailOptions) {
  const mimeMessage = buildRfc2822Message(options);
  const rawBase64Url = Buffer.from(mimeMessage, 'utf-8').toString('base64url');

  const requestBody = { raw: rawBase64Url };

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${options.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gmail send failed [${response.status}]: ${errorBody}`);
  }

  return response.json();
}
