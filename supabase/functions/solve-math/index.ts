// @ts-nocheck
// Supabase Edge Function: solve-math
// Uses Google Gemini 1.5 Flash (cost-effective vision) via REST
// Expects JSON body: { imageUrl: string, locale?: string, responseFormat?: 'json' }

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';

interface RequestBody {
  imageUrl: string;
  locale?: string;
  responseFormat?: 'json';
}

// deno-lint-ignore no-undef
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-1.5-flash';
const DEADLINE_MS = Number(Deno.env.get('SOLVE_DEADLINE_MS') || '') || 8000; // エッジ実行時間内に収める目安

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function buildPrompt(locale: string) {
  return `あなたは優秀な数学解説者です。画像に写っている数学の問題を読み取り、以下のJSON形式で日本語で返してください。
{
  "answer": "最終的な答え（数値や式）",
  "explanation": "要点を押さえた分かりやすい解説（200-400字程度）",
  "steps": ["主要な解法ステップを順番に"]
}
注意: 数式はできるだけ簡潔に。不要な前置きは書かない。`;
}

async function callGemini(imageUrl: string, locale = 'ja') {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  // Helper: fetch with timeout
  const fetchWithTimeout = async (url: string, init: RequestInit = {}, timeoutMs = 15000): Promise<Response> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      return res;
    } catch (err) {
      if ((err as any)?.name === 'AbortError') {
        throw new Error(`timeout after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(id);
    }
  };
  const startedAt = Date.now();

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: buildPrompt(locale) },
          { inlineData: { mimeType: 'image/*', data: '' } },
        ],
      },
    ],
  } as any;

  // Gemini REST API は画像を base64 で渡す必要があるケースが多い。
  // ここではURLから画像を取得して base64 に変換します。
  const imgTimeout = Math.min(3000, Math.max(1500, Math.floor(DEADLINE_MS * 0.35)));
  const resImg = await fetchWithTimeout(imageUrl, {}, imgTimeout);
  if (!resImg.ok) throw new Error(`failed to fetch image: ${resImg.status}`);
  const ct = resImg.headers.get('content-type') || 'image/*';
  const arrayBuf = await resImg.arrayBuffer();
  const bytes = new Uint8Array(arrayBuf);
  const byteLen = bytes.byteLength;
  // サイズが大きすぎると上流APIやエッジ実行時間で失敗しやすい
  if (byteLen > 6_000_000) {
    throw new Error(`image too large (${(byteLen / 1_000_000).toFixed(1)} MB). please try a smaller image.`);
  }
  // NOTE: String.fromCharCode(...bytes) は大きな画像で call stack overflow を起こすため、std の base64 エンコーダを使用
  const base64 = encodeBase64(bytes);
  body.contents[0].parts[1].inlineData.mimeType = /^image\//i.test(ct) ? ct : 'image/*';
  body.contents[0].parts[1].inlineData.data = base64;

  // Gemini 呼び出し（5xx は1回だけリトライ）
  const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent`;
  const elapsed = Date.now() - startedAt;
  let remain = Math.max(1000, DEADLINE_MS - elapsed - 500); // レスポンス整形の余裕500ms
  if (remain < 1500) throw new Error(`deadline too short (remain ${remain}ms)`);
  let resp = await fetchWithTimeout(geminiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
    body: JSON.stringify(body),
  }, remain);
  if (!resp.ok && resp.status >= 500) {
    // 小さな待機の後に1回だけ再試行
    await new Promise((r) => setTimeout(r, 800));
    // 再計算
    const elapsed2 = Date.now() - startedAt;
    remain = Math.max(1000, DEADLINE_MS - elapsed2 - 300);
    if (remain < 1200) throw new Error(`deadline too short (retry remain ${remain}ms)`);
    resp = await fetchWithTimeout(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
      body: JSON.stringify(body),
    }, remain);
  }
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`gemini error: ${resp.status} ${txt}`);
  }

  const data = await resp.json();
  // Gemini の応答からテキストを取り出す
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  // 出力がJSONで来ない場合があるので、寛容にパースを試みる
  try {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    const jsonText = firstBrace >= 0 && lastBrace > firstBrace ? text.slice(firstBrace, lastBrace + 1) : text;
    const parsed = JSON.parse(jsonText);
    return parsed;
  } catch {
    return { answer: '', explanation: text };
  }
}

// deno-lint-ignore no-undef
Deno.serve(async (req: Request) => {
  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { ...corsHeaders } });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  try {
    const body = (await req.json()) as RequestBody;
    if (!body?.imageUrl) {
      return new Response(JSON.stringify({ error: 'imageUrl is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const result = await callGemini(body.imageUrl, body.locale ?? 'ja');
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (e) {
    const message = (e as Error)?.message ?? String(e);
    const status = /imageUrl is required/i.test(message) ? 400 : /Method not allowed/i.test(message) ? 405 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json', 'x-error': String(message).slice(0, 256), ...corsHeaders },
    });
  }
});
