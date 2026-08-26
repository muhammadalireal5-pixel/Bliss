import { generateOutreachEmail } from './lib/openrouter';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

async function main() {
  try {
    const email = await generateOutreachEmail({
      name: 'Alice',
      targetAudience: 'Engineers',
      reasonForOutreach: 'Testing',
      offering: 'Remote job'
    });
    console.log("SUCCESS:");
    console.log(email);
  } catch(e) {
    console.error("FAIL:", e);
  }
}
main();
