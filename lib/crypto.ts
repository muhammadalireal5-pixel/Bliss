export async function encrypt(plaintext: string, keyString: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = enc.encode(keyString.padEnd(32, '0').substring(0, 32));
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );
  
  const ivBase64 = btoa(String.fromCharCode(...new Uint8Array(iv)));
  const ctBase64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
  
  return `${ivBase64}:${ctBase64}`;
}

export async function decrypt(encryptedText: string, keyString: string): Promise<string> {
  if (!encryptedText || !encryptedText.includes(':')) {
    throw new Error('Invalid encrypted text format');
  }
  
  const [ivBase64, ctBase64] = encryptedText.split(':');
  
  const iv = new Uint8Array(atob(ivBase64).split('').map(c => c.charCodeAt(0)));
  const ct = new Uint8Array(atob(ctBase64).split('').map(c => c.charCodeAt(0)));
  
  const enc = new TextEncoder();
  const keyMaterial = enc.encode(keyString.padEnd(32, '0').substring(0, 32));
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
  
  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ct
  );
  
  return new TextDecoder().decode(plaintextBuffer);
}
