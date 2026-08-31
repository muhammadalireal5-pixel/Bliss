import { resolveMx } from 'node:dns/promises';

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

export async function findValidEmail(name: string, domain: string): Promise<{email: string, confidence: 'guessed'} | null> {
  const nameParts = name.trim().split(" ");
  const firstName = nameParts[0];
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
  
  const patterns = guessEmailPatterns(firstName, lastName, domain);
  
  const isDomainValid = await validateEmailMx(`test@${domain}`);
  if (!isDomainValid) return null;
  
  if (patterns.length > 0) {
    return { email: patterns[0], confidence: 'guessed' };
  }
  
  return null;
}
