// @ts-nocheck
// Supabase Edge Function: transcribe-audio
// 用途: Supabase Storage 等にある音声ファイルを Google Gemini で文字起こしする
// 期待するリクエストボディ: { audioUrl: string, mimeType?: string, locale?: string }

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';

interface RequestBody {
  audioUrl: string;
  mimeType?: string;
  locale?: string;
}

// deno-lint-ignore no-undef
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-1.5-flash';
const DEADLINE_MS = Number(Deno.env.get('TRANSCRIBE_DEADLINE_MS') || '') || 24000;
const MAX_ATTEMPTS = Math.max(1, Number(Deno.env.get('TRANSCRIBE_MAX_ATTEMPTS') || '') || 3);
const MAX_AUDIO_BYTES = 15_000_000; // ~15MB までを安全圏とする

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function buildPrompt(locale: string) {
  if (locale === 'ja') {
    return '以下の音声を丁寧に文字起こししてください。雑音や意味の曖昧な部分は「(聞き取り困難)」と注記してください。改行は文や段落の区切りで適切に挿入してください。';
  }
  return 'Please transcribe the following audio accurately. Use "(inaudible)" for unintelligible parts and insert line breaks at natural boundaries.';
}

const fetchWithTimeout = async (url: string, init: RequestInit = {}, timeoutMs = 20000): Promise<Response> => {
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

async function loadAudioAsBase64(audioUrl: string, mimeHint?: string) {
  const timeout = Math.min(7000, Math.max(2500, Math.floor(DEADLINE_MS * 0.35)));
  const resp = await fetchWithTimeout(audioUrl, {}, timeout);
  if (!resp.ok) {
    throw new Error(`failed to fetch audio: ${resp.status}`);
  }
  const detectedType = resp.headers.get('content-type') || mimeHint || 'audio/mpeg';
  const buffer = await resp.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes.byteLength === 0) {
    throw new Error('audio payload is empty');
  }
  if (bytes.byteLength > MAX_AUDIO_BYTES) {
    const mb = (bytes.byteLength / 1_000_000).toFixed(1);
    throw new Error(`audio too large (${mb} MB). Please upload a shorter clip.`);
  }
  const base64 = encodeBase64(bytes);
  return { base64, mimeType: detectedType };
}

async function callGeminiWithAudio(audioUrl: string, locale = 'ja', mimeHint?: string) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const started = Date.now();
  const { base64, mimeType } = await loadAudioAsBase64(audioUrl, mimeHint);

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: buildPrompt(locale) },
          { inlineData: { mimeType, data: base64 } },
        ],
      },
    ],
  } as Record<string, unknown>;

  const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent`;

  const requestInit = () => ({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY,
    },
    body: JSON.stringify(body),
  });

  let lastStatus = 0;
  let lastText = '';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const elapsed = Date.now() - started;
    const bufferMs = attempt === MAX_ATTEMPTS ? 350 : 500;
    const remain = Math.max(2500, DEADLINE_MS - elapsed - bufferMs);
    if (remain < 1500) {
      throw new Error(`deadline too short (remain ${remain}ms)`);
    }

    try {
      const response = await fetchWithTimeout(geminiUrl, requestInit(), remain);
      lastStatus = response.status;
      if (response.ok) {
        const data = await response.json();
        const transcript =
          data?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || '').join('\n').trim() ?? '';

        if (!transcript) {
          throw new Error('transcript was empty');
        }
        return transcript;
      }

      lastText = await response.text();
      const isRetriable = response.status === 429 || response.status >= 500;
      if (!isRetriable || attempt === MAX_ATTEMPTS) {
        throw new Error(`gemini error: ${response.status} ${lastText}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    } catch (error) {
      const message = (error as Error)?.message ?? String(error);
      const isAbort = /timeout/i.test(message) || /deadline/i.test(message);
      if (attempt === MAX_ATTEMPTS || !isAbort) {
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

// deno-lint-ignore no-undef
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { ...corsHeaders } });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = (await req.json()) as RequestBody;
    if (!body?.audioUrl) {
      return jsonResponse({ error: 'audioUrl is required' }, 400);
    }

    const transcript = await callGeminiWithAudio(body.audioUrl, body.locale ?? 'ja', body.mimeType);
    return jsonResponse({ transcript });
  } catch (error) {
    const message = (error as Error)?.message ?? String(error);
    console.error('[transcribe-audio] error', message);
    const status =
      /audioUrl is required/i.test(message)
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
