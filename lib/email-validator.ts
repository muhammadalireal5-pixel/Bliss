export interface MxRecord {
  exchange: string;
  priority: number;
}

export async function resolveMxRecords(domain: string): Promise<MxRecord[]> {
  const cleanDomain = domain.trim().toLowerCase().replace(/\.$/, "");

  if (!cleanDomain || cleanDomain.includes(" ")) {
    throw new Error("Invalid domain name supplied.");
  }

  const endpoints = [
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(cleanDomain)}&type=MX`,
    `https://dns.google/resolve?name=${encodeURIComponent(cleanDomain)}&type=MX`,
  ];

  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          Accept: "application/dns-json",
        },
      });

      if (!response.ok) {
        throw new Error(`DoH server responded with HTTP ${response.status}`);
      }

      const json = await response.json();

      if (json.Status === 0 && Array.isArray(json.Answer)) {
        const mxRecords: MxRecord[] = json.Answer
          .filter((record: any) => record.type === 15)
          .map((record: any) => {
            const parts = record.data.trim().split(/\s+/);
            const priority = parseInt(parts[0], 10);
            const exchange = (parts[1] || "").replace(/\.$/, "").toLowerCase();
            return { exchange, priority };
          })
          .filter((rec: any) => !isNaN(rec.priority) && rec.exchange.length > 0)
          .sort((a: any, b: any) => a.priority - b.priority);

        return mxRecords;
      }

      if (json.Status === 3) {
        return [];
      }
      return [];
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      continue;
    }
  }

  throw new Error(`Failed to resolve MX records for ${domain}: ${lastError?.message}`);
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
