import { NextResponse } from 'next/server';
import { generateOutreachEmail } from '@/lib/openrouter';

export async function POST(req: Request) {
  try {
    const { name, targetAudience, reasonForOutreach, offering } = await req.json();

    if (!name || !targetAudience || !reasonForOutreach || !offering) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { subject, draftEmail } = await generateOutreachEmail({
      name,
      targetAudience,
      reasonForOutreach,
      offering,
    });

    return NextResponse.json({ subject, draftEmail });
  } catch (error: any) {
    console.error('Email Generation Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate email' },
      { status: 500 }
    );
  }
}
