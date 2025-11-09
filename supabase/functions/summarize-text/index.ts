// @ts-nocheck
// Supabase Edge Function: summarize-text
// 文字起こし済みテキストを Gemini で要約する
// 期待するリクエストボディ: { transcript: string, locale?: string, maxSentences?: number }

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

interface RequestBody {
  transcript: string;
  locale?: string;
  maxSentences?: number;
}

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-1.5-flash';
const DEADLINE_MS = Number(Deno.env.get('SUMMARIZE_DEADLINE_MS') || '') || 12000;
const MAX_ATTEMPTS = Math.max(1, Number(Deno.env.get('SUMMARIZE_MAX_ATTEMPTS') || '') || 3);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const fetchWithTimeout = async (url: string, init: RequestInit = {}, timeoutMs = 15000): Promise<Response> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if ((err as any)?.name === 'AbortError') {
      throw new Error(`timeout after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(id);
  }
};

function buildPrompt(locale: string, maxSentences: number) {
  if (locale === 'ja') {
    return `以下の文章を ${maxSentences} 文以内で要約してください。重要なポイントは保ち、自然な日本語で書いてください。`;
  }
  return `Summarize the following text in at most ${maxSentences} sentences. Keep key points and use natural language.`;
}

async function callGemini(transcript: string, locale = 'ja', maxSentences = 3) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const normalizedMax = Math.max(1, Math.min(10, Math.floor(maxSentences)));
  const prompt = buildPrompt(locale, normalizedMax);

  // Geminiは長大な入力に対してタイムアウト/コスト増となるため、必要に応じてトリミング
  const trimmed = transcript.length > 16000 ? `${transcript.slice(0, 16000)}\n... (trimmed)` : transcript;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: `${prompt}\n\n${trimmed}` },
        ],
      },
    ],
  } as Record<string, unknown>;

  const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent`;

  const started = Date.now();
  let lastStatus = 0;
  let lastText = '';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const elapsed = Date.now() - started;
    const bufferMs = attempt === MAX_ATTEMPTS ? 400 : 600;
    const remain = Math.max(1500, DEADLINE_MS - elapsed - bufferMs);
    if (remain < 1200) {
      throw new Error(`deadline too short (remain ${remain}ms)`);
    }

    try {
      const response = await fetchWithTimeout(geminiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify(body),
      }, remain);

      lastStatus = response.status;
      if (response.ok) {
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || '').join('\n').trim() ?? '';
        if (!text) {
          throw new Error('summary was empty');
        }
        return text;
      }

      lastText = await response.text();
      const retriable = response.status === 429 || response.status >= 500;
      if (!retriable || attempt === MAX_ATTEMPTS) {
        throw new Error(`gemini error: ${response.status} ${lastText}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    } catch (error) {
      const message = (error as Error)?.message ?? String(error);
      const isTimeout = /timeout/i.test(message) || /deadline/i.test(message);
      if (attempt === MAX_ATTEMPTS || !isTimeout) {
        if (!lastText) lastText = message;
        throw new Error(message);
      }
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }
  }

  throw new Error(`gemini error: ${lastStatus} ${lastText || 'unknown error'}`);
}

const jsonResponse = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { ...corsHeaders } });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = (await req.json()) as RequestBody;
    if (!body?.transcript || typeof body.transcript !== 'string') {
      return jsonResponse({ error: 'transcript is required' }, 400);
    }

    const summary = await callGemini(body.transcript, body.locale ?? 'ja', body.maxSentences ?? 3);
    return jsonResponse({ summary });
  } catch (error) {
    const message = (error as Error)?.message ?? String(error);
    console.error('[summarize-text] error', message);
    const status =
      /transcript is required/i.test(message)
        ? 400
        : /Method not allowed/i.test(message)
        ? 405
        : /timeout/i.test(message)
        ? 504
        : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json', 'x-error': message.slice(0, 256), ...corsHeaders },
    });
  }
});
