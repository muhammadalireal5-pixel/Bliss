export function generateTrackingId(): string {
  return crypto.randomUUID();
}

export function wrapEmailHtml(html: string, trackingId: string, baseUrl: string, senderAddress: string): { wrappedHtml: string, listUnsubscribeHeader: string } {
  const pixelHtml = `<img src="${baseUrl}/api/track/open/${trackingId}" width="1" height="1" style="display:none" alt="" />`;
  
  let rewrittenHtml = html.replace(/<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1([^>]*)>/gi, (match, quote, url, rest) => {
    if (url.startsWith('mailto:') || url.startsWith('tel:')) return match;
    const trackedUrl = `${baseUrl}/api/track/click/${trackingId}?url=${encodeURIComponent(url)}`;
    return `<a href=${quote}${trackedUrl}${quote}${rest}>`;
  });

  const unsubscribeLink = `${baseUrl}/api/unsubscribe/${trackingId}`;
  const footer = `
    <br><br>
    <div style="font-size: 11px; color: #888; border-top: 1px solid #eee; padding-top: 10px; margin-top: 20px;">
      <p>If you no longer wish to receive these emails, you can <a href="${unsubscribeLink}">unsubscribe here</a>.</p>
      ${senderAddress ? `<p>${senderAddress}</p>` : ''}
    </div>
  `;

  if (rewrittenHtml.includes('</body>')) {
    rewrittenHtml = rewrittenHtml.replace('</body>', `${pixelHtml}${footer}</body>`);
  } else {
    rewrittenHtml += pixelHtml + footer;
  }

  return {
    wrappedHtml: rewrittenHtml,
    listUnsubscribeHeader: `<${unsubscribeLink}>`
  };
}
