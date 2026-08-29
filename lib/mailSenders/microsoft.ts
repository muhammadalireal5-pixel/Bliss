export interface SendMicrosoftMailOptions {
  accessToken: string;
  toEmail: string;
  toName?: string;
  subject: string;
  htmlContent: string;
}

export async function sendMicrosoftMail(options: SendMicrosoftMailOptions) {
  const bodyPayload = {
    message: {
      subject: options.subject,
      body: {
        contentType: 'HTML',
        content: options.htmlContent,
      },
      toRecipients: [
        {
          emailAddress: {
            address: options.toEmail,
            name: options.toName || options.toEmail,
          },
        },
      ],
    },
    saveToSentItems: true,
  };

  const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${options.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(bodyPayload),
  });

  if (response.status !== 202 && !response.ok) {
    const errorBody = await response.text();
    throw new Error(`Microsoft Graph sendMail failed [${response.status}]: ${errorBody}`);
  }

  return { success: true };
}
