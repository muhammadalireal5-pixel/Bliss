import { resolveMx } from 'node:dns/promises';
import { redis } from '@/lib/redis';

export interface MxRecord {
  exchange: string;
  priority: number;
}

export async function resolveMxRecords(domain: string): Promise<MxRecord[]> {
  const cleanDomain = domain.trim().toLowerCase().replace(/\.$/, "");

  if (!cleanDomain || cleanDomain.includes(" ")) {
    throw new Error("Invalid domain name supplied.");
  }

  try {
    const records = await resolveMx(cleanDomain);
    return records.sort((a, b) => a.priority - b.priority);
  } catch (err: any) {
    if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') {
      return [];
    }
    throw new Error(`Failed to resolve MX records for ${domain}: ${err.message}`);
  }
}

export async function validateEmailMx(email: string): Promise<boolean> {
  const parts = email.split("@");
  if (parts.length !== 2) return false;
  const domain = parts[1];
  try {
    // Check Redis cooldown
    const cooldownKey = `cooldown:${domain}`;
    const isCooldown = await redis.get(cooldownKey);
    if (isCooldown) {
      // Delay or skip. To avoid hammering, we'll just delay slightly and return true for now, 
      // or we can implement a queue. The prompt says "skip/delay verification if the key is present".
      // Let's assume it's valid if it's on cooldown, to prevent false negatives when processing batches.
      return true;
    }
    
    // Set a 45s TTL cooldown for the domain before doing actual DNS resolution
    await redis.set(cooldownKey, "1", { ex: 45 });

    const mxRecords = await resolveMxRecords(domain);
    return mxRecords.length > 0;
  } catch (err) {
    return false;
  }
}

export function guessEmailPatterns(firstName: string, lastName: string, domain: string): string[] {
  const f = firstName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const l = lastName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const patterns: string[] = [];
  
  if (f && l) {
    patterns.push(`${f}.${l}@${domain}`);
    patterns.push(`${f}${l}@${domain}`);
    patterns.push(`${f[0]}${l}@${domain}`);
    patterns.push(`${f}@${domain}`);
  } else if (f) {
    patterns.push(`${f}@${domain}`);
  } else if (l) {
    patterns.push(`${l}@${domain}`);
  }
  
  return patterns;
}

export async function findValidEmail(name: string, domain: string): Promise<{email: string, confidence: 'low', emailType: 'guessed'} | null> {
  const nameParts = name.trim().split(" ");
  const firstName = nameParts[0];
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
  
  const patterns = guessEmailPatterns(firstName, lastName, domain);
  
  const isDomainValid = await validateEmailMx(`test@${domain}`);
  if (!isDomainValid) return null;
  
  if (patterns.length > 0) {
    return { email: patterns[0], confidence: 'low', emailType: 'guessed' };
  }
  
  return null;
}
