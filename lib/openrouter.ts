
export interface GenerateEmailParams {
  name: string;
  targetAudience: string;
  reasonForOutreach: string;
  offering: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Builds the cold email generation prompt.
 */
function buildColdEmailPrompt({
  name,
  targetAudience,
  reasonForOutreach,
  offering,
}: Omit<GenerateEmailParams, 'model' | 'temperature' | 'maxTokens'>): string {
  return `
You are an expert sales and outreach copywriter. 
Write a highly personalized, concise, and engaging cold email.

Recipient Name: ${name}
Target Audience Profile: ${targetAudience}
Reason for Outreach: ${reasonForOutreach}
What we are offering: ${offering}

Instructions:
1. Keep the body under 150 words.
2. Make it sound natural, human, and not overly salesy.
3. Include a clear, low-friction call to action at the end.
4. Sign off professionally (e.g., "Best,\\n[Your Name] - [Your Company]" or something similar). Do NOT end abruptly.
5. You MUST return your response as a valid JSON object with EXACTLY two keys: "subject" (a professional, relevant subject line) and "body" (the email body). 

JSON Format Example:
{
  "subject": "Quick question about your experience",
  "body": "Hi Name,\\n\\nI saw your profile..."
}
`.trim();
}

/**
 * Generates an outreach email draft using OpenRouter.
 */
export async function generateOutreachEmail(params: GenerateEmailParams): Promise<{ subject: string; draftEmail: string }> {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not configured in environment variables');
  }

  const prompt = buildColdEmailPrompt(params);

  // Use "openrouter/free" — OpenRouter's built-in router that automatically selects
  // a currently-available free model per request. This avoids hardcoding specific
  // free-tier model slugs which break whenever OpenRouter deprecates or renames them.
  const payload = {
    model: 'openrouter/free',
    messages: [{ role: 'user', content: prompt }],
    temperature: params.temperature ?? 0.7,
    max_tokens: params.maxTokens ?? 1500,
    response_format: { type: 'json_object' }
  };

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      'X-Title': 'SayMe AI Outreach',
    },
    body: JSON.stringify(payload)
  });

  const response = await res.json();

  if (response.error) {
    throw new Error(`OpenRouter API Error: ${response.error.message || JSON.stringify(response.error)}`);
  }

  const message = response.choices?.[0]?.message;
  
  // Strict check on message.content without falling back to reasoning.
  const content = message?.content;

  if (!content) {
    console.error('OpenRouter returned empty content. Full payload:', JSON.stringify(response, null, 2));
    throw new Error('No valid content returned from OpenRouter. This could be due to an empty response or the model returning reasoning/chain-of-thought instead of standard text.');
  }

  try {
    // Some models might wrap JSON in markdown blocks like ```json ... ```
    const cleanContent = content.replace(/```json\\n?|```/g, '').trim();
    const parsed = JSON.parse(cleanContent);
    
    if (!parsed.subject || !parsed.body) {
      throw new Error('Model did not return "subject" and "body" keys.');
    }

    return {
      subject: parsed.subject.trim(),
      draftEmail: parsed.body.trim()
    };
  } catch (error: any) {
    console.error('Failed to parse JSON response from OpenRouter:', content);
    throw new Error(`Failed to parse AI response: ${error.message}`);
  }
}
