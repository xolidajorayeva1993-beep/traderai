// GET /api/admin/ai-prompts/default?ai=gpt|gemini
import { NextRequest, NextResponse } from 'next/server'
import { DEFAULT_GPT_SYSTEM_PROMPT, DEFAULT_GEMINI_SYSTEM_PROMPT } from '@/lib/ai'

export async function GET(req: NextRequest) {
  const ai = req.nextUrl.searchParams.get('ai')
  if (ai === 'gpt') {
    return NextResponse.json({ systemPrompt: DEFAULT_GPT_SYSTEM_PROMPT })
  }
  if (ai === 'gemini') {
    return NextResponse.json({ systemPrompt: DEFAULT_GEMINI_SYSTEM_PROMPT })
  }
  return NextResponse.json({ error: 'ai=gpt|gemini talab qilinadi' }, { status: 400 })
}
