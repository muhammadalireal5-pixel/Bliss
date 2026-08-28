import { GoogleGenAI, Type } from '@google/genai';

export interface GenerateTemplateParams {
  targetAudience: string;
  reasonForOutreach: string;
  offering: string;
  tone: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LeadData {
  name?: string;
  company?: string;
  industry?: string;
  bioSnippet?: string;
}

export interface RegenerateLeadEmailParams {
  baseTemplate: string;
  leadData: LeadData;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

const FLATTERY_BLACKLIST = [
  "hope this email finds you well",
  "hope you are doing well",
  "impressed by your profile",
  "loved your recent post",
  "came across your profile",
  "huge fan of your work",
  "we handle everything",
];

function performQualityCheck(subject: string, body: string, isTemplate: boolean): void {
  if (subject.length > 60) {
    throw new Error('Quality Check Failed: Subject line is over 60 characters.');
  }

  const lowerText = (subject + ' ' + body).toLowerCase();
  for (const phrase of FLATTERY_BLACKLIST) {
    if (lowerText.includes(phrase)) {
      throw new Error(`Quality Check Failed: Contains generic flattery or banned phrase ("${phrase}").`);
    }
  }

  if (!isTemplate) {
    // Make sure no unfilled placeholders remain
    if (body.includes('{{') || subject.includes('{{')) {
      throw new Error('Quality Check Failed: Output contains unfilled placeholder tokens.');
    }
  }
}

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

function buildTemplatePrompt({
  targetAudience,
  reasonForOutreach,
  offering,
  tone,
}: Omit<GenerateTemplateParams, 'model' | 'temperature' | 'maxTokens'>): string {
  const bannedPhrases = FLATTERY_BLACKLIST.map(p => `"${p}"`).join(", ");
  return `
You are an expert sales and outreach copywriter. 
Write a highly effective cold email template based on the following:

Target Audience: ${targetAudience}
Reason for Outreach: ${reasonForOutreach}
What we are offering: ${offering}
Desired Tone: ${tone}

Instructions:
1. The output MUST be ~120-150 words.
2. Use EXACTLY these placeholder tokens where appropriate: {{name}}, {{company}}, {{industry}}, {{personalization_hook}}.
3. Include: a subject line, an opening line (NO generic flattery, use the {{personalization_hook}} here), a clear specific value proposition (no vague phrases), a credibility/proof placeholder, and a low-friction CTA with a specific next step.
4. DO NOT use these banned phrases: ${bannedPhrases}
5. AVOID typical AI marketing words like: delve, unlock, synergy, transform, revolutionary, elevate, innovative, seamless, robust, dynamic.
6. Write at a 5th-grade reading level. Keep sentences short, conversational, and direct. Use simple, everyday language. Do not sound like a marketer.
7. Format with proper line breaks/paragraphs (\\n\\n) between the greeting, body paragraphs, and sign-off. Do not write a single block of text.
8. Sign off professionally.
`.trim();
}

function buildRegeneratePrompt(baseTemplate: string, leadData: LeadData): string {
  const bannedPhrases = FLATTERY_BLACKLIST.map(p => `"${p}"`).join(", ");
  return `
You are an expert sales and outreach copywriter.
Below is a base cold email template and specific data about a lead.
Your task is to REWRITE ONLY the first 2-3 sentences (the opening + personalization hook) to be highly specific to this lead, while keeping the overall structure, CTA, and word count of the original template. 
DO NOT regenerate the whole email from scratch, just adapt the opening and blend it naturally into the rest of the template.
Ensure all placeholder tokens like {{name}}, {{company}}, etc. are replaced with the actual data provided. If a specific data point is missing, adapt the sentence naturally without leaving a placeholder.

Base Template:
"""
${baseTemplate}
"""

Lead Data:
Name: ${leadData.name || 'Not provided'}
Company: ${leadData.company || 'Not provided'}
Industry: ${leadData.industry || 'Not provided'}
Bio/Snippet for Personalization: ${leadData.bioSnippet || 'Not provided'}

Instructions:
1. Rewrite the opening incorporating the lead's data.
2. Keep the original CTA and closing intact.
3. Ensure no {{ }} placeholders remain in the output.
4. DO NOT use these banned phrases: ${bannedPhrases}
5. AVOID typical AI marketing words like: delve, unlock, synergy, transform, revolutionary, elevate, innovative, seamless, robust, dynamic.
6. Write at a 5th-grade reading level. Keep sentences short, conversational, and direct.
7. Maintain proper email formatting with line breaks (\\n\\n). Do not return a single block of text.
`.trim();
}

function getAIClient() {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured in environment variables');
  }
  return new GoogleGenAI({ apiKey: GEMINI_API_KEY });
}

async function generateWithRetry(prompt: string, modelName: string, params: any, isTemplate: boolean, maxRetries = 2): Promise<{ subject: string; draftEmail: string }> {
  let attempt = 0;
  let lastError: Error | null = null;
  const ai = getAIClient();

  while (attempt <= maxRetries) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          temperature: params.temperature ?? 0.7,
          maxOutputTokens: params.maxTokens ?? 1500,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              subject: { type: Type.STRING, description: 'Subject line' },
              body: { type: Type.STRING, description: 'The email body' },
            },
            required: ['subject', 'body'],
          },
        },
      });

      const content = response.text;
      if (!content) throw new Error('No valid content returned from Gemini.');

      // Fix JSON Parsing: Strip markdown code blocks if present
      const cleanedContent = content.replace(/^```(?:json)?\s*|\s*```$/gi, '').trim();
      const parsed = JSON.parse(cleanedContent);
      const subject = parsed.subject.trim();
      const body = parsed.body.trim();

      performQualityCheck(subject, body, isTemplate);

      return { subject, draftEmail: body };
    } catch (error: any) {
      // If it's a rate limit error (429), throw immediately instead of wasting retries in a tight loop
      if (error.status === 429 || error.status === 'RESOURCE_EXHAUSTED' || (error.message && error.message.includes('429'))) {
        throw error;
      }
      
      lastError = error;
      attempt++;
      if (attempt <= maxRetries) {
        await delay(1000); // Wait 1 second before retrying to allow API to breathe
      }
    }
  }

  throw lastError || new Error('Failed to generate email after max retries.');
}

class RequestQueue {
  private queue: (() => Promise<void>)[] = [];
  private isProcessing = false;

  async enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processNext();
    });
  }

  private async processNext() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;
    
    const nextTask = this.queue.shift();
    if (nextTask) {
      await nextTask();
      // Add a 2 second delay between requests to help respect the free tier RPM limits
      await delay(2000); 
    }
    
    this.isProcessing = false;
    this.processNext();
  }
}

const globalForQueue = globalThis as unknown as {
  geminiQueue: RequestQueue | undefined;
};

const geminiQueue = globalForQueue.geminiQueue ?? new RequestQueue();
if (process.env.NODE_ENV !== 'production') globalForQueue.geminiQueue = geminiQueue;

export async function generateEmailTemplate(params: GenerateTemplateParams): Promise<{ subject: string; draftEmail: string }> {
  const prompt = buildTemplatePrompt(params);
  const modelName = params.model || 'gemini-3.5-flash-lite';
  return geminiQueue.enqueue(() => generateWithRetry(prompt, modelName, params, true));
}

export async function regenerateLeadEmail(params: RegenerateLeadEmailParams): Promise<{ subject: string; draftEmail: string }> {
  const prompt = buildRegeneratePrompt(params.baseTemplate, params.leadData);
  const modelName = params.model || 'gemini-3.5-flash-lite';
  return geminiQueue.enqueue(() => generateWithRetry(prompt, modelName, params, false));
}

export interface GenerateBatchParams extends GenerateTemplateParams {
  leads: LeadData[];
}

function buildBatchPrompt(params: GenerateBatchParams): string {
  const bannedPhrases = FLATTERY_BLACKLIST.map(p => `"${p}"`).join(", ");
  const leadsJson = JSON.stringify(params.leads, null, 2);
  
  return `
You are an expert sales and outreach copywriter. 
Write highly effective, personalized cold emails for a list of leads based on the following campaign context:

Target Audience: ${params.targetAudience}
Reason for Outreach: ${params.reasonForOutreach}
What we are offering: ${params.offering}
Desired Tone: ${params.tone || 'professional'}

Here is the JSON array of leads to write emails for:
${leadsJson}

Instructions:
1. Generate an array of JSON objects. Each object must have a "subject" and a "body".
2. The array you return MUST be exactly in the same order as the provided leads array, and must have exactly ${params.leads.length} items.
3. The "body" MUST include proper line breaks (\\n\\n) to format it as a standard email with paragraphs (Greeting, Body, Sign-off). Do not write a single block of text.
4. Keep the body concise (~120 words).
5. DO NOT use these banned phrases: ${bannedPhrases}
6. AVOID typical AI marketing words like: delve, unlock, synergy, transform, revolutionary, elevate, innovative.
7. Write at a 5th-grade reading level. Keep sentences short, conversational, and direct.
8. Sign off professionally.
`.trim();
}

async function generateBatchWithRetry(prompt: string, modelName: string, params: any, maxRetries = 2): Promise<{ subject: string; body: string }[]> {
  let attempt = 0;
  let lastError: Error | null = null;
  const ai = getAIClient();

  while (attempt <= maxRetries) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          temperature: params.temperature ?? 0.7,
          maxOutputTokens: params.maxTokens ?? 8000,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                subject: { type: Type.STRING, description: 'Subject line' },
                body: { type: Type.STRING, description: 'The email body' },
              },
              required: ['subject', 'body'],
            },
          },
        },
      });

      const content = response.text;
      if (!content) throw new Error('No valid content returned from Gemini.');

      const cleanedContent = content.replace(/^```(?:json)?\s*|\s*```$/gi, '').trim();
      const parsed = JSON.parse(cleanedContent);
      return parsed;
    } catch (error: any) {
      if (error.status === 429 || error.status === 'RESOURCE_EXHAUSTED' || (error.message && error.message.includes('429'))) {
        throw error;
      }
      lastError = error;
      attempt++;
      if (attempt <= maxRetries) await delay(2000); 
    }
  }

  throw lastError || new Error('Failed to generate batch emails after max retries.');
}

export async function generateBatchEmails(params: GenerateBatchParams): Promise<{ subject: string; draftEmail: string }[]> {
  const prompt = buildBatchPrompt(params);
  const modelName = params.model || 'gemini-3.5-flash-lite';
  
  const results = await geminiQueue.enqueue(() => generateBatchWithRetry(prompt, modelName, params));
  
  return results.map(r => ({
    subject: r.subject,
    draftEmail: r.body,
  }));
}

export function populateEmailTemplate(template: string, leadData: LeadData): { draftEmail: string; missingHook: boolean } {
  let draftEmail = template;
  let missingHook = false;

  draftEmail = draftEmail.replace(/\{\{name\}\}/gi, () => leadData.name || '');
  draftEmail = draftEmail.replace(/\{\{company\}\}/gi, () => leadData.company || '');
  draftEmail = draftEmail.replace(/\{\{industry\}\}/gi, () => leadData.industry || '');

  if (leadData.bioSnippet) {
    draftEmail = draftEmail.replace(/\{\{personalization_hook\}\}/gi, () => leadData.bioSnippet || '');
  } else {
    missingHook = true;
    draftEmail = draftEmail.replace(/\{\{personalization_hook\}\}/gi, () => '');
    draftEmail = draftEmail.replace(/ {2,}/g, ' ').replace(/\n{3,}/g, '\n\n');
  }

  return { draftEmail: draftEmail.trim(), missingHook };
}
