// @ts-nocheck
// 依存を減らしてコールドスタート時間と失敗率を下げるため、外部 import を避ける
// Uint8Array → base64（大きい配列でも安全なチャンク処理）
//   - Deno/Edge 環境は Buffer が使えないため btoa を直接活用
//   - String.fromCharCode の引数制限を避けるため 32KB 単位で加工する
function u8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000; // 32KB ずつ
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, i + chunk);
    // String.fromCharCode は引数数に制限があるため段階的に連結
    binary += String.fromCharCode(...sub as unknown as number[]);
  }
  // Deno/Edge 環境にある btoa を使用
  return btoa(binary);
}

// クライアントから届くリクエストボディの型。URL または base64 を受け取れる。
interface RequestBody { imageUrl?: string; imageBase64?: string; mimeType?: string; locale?: string }

// deno-lint-ignore no-undef
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const API_VERSION = Deno.env.get('GEMINI_API_VERSION') || 'v1beta';
const MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';
const FALLBACK_MODEL = Deno.env.get('GEMINI_FALLBACK_MODEL') || 'gemini-2.5-pro';

// CORS 設定: Expo アプリやローカル開発からの直接呼び出しを許可する
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Expose-Headers': 'x-error',
};

function buildPrompt(locale: string) {
  return `あなたは優秀な数学解説者です。画像に写っている数学の問題を読み取り、日本語で簡潔に答えと根拠を述べてください。`;
}

function collectTextsFromCandidate(candidate: any): string[] {
  // Gemini のレスポンスは複数の parts / content 構造に散らばるため
  // 文字列を再帰的に探索して一つの配列にまとめる
  const texts: string[] = [];
  if (!candidate) return texts;

  const pushText = (value: any) => {
    if (typeof value === 'string' && value.trim()) texts.push(value.trim());
  };

  const directParts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
  for (const part of directParts) {
    pushText(part?.text);
    if (part?.inlineData?.data) {
      pushText(`[inlineData:${part.inlineData.mimeType ?? 'binary'}]`);
    }
  }

  const contentArray = Array.isArray(candidate?.content) ? candidate.content : [];
  for (const entry of contentArray) {
    if (Array.isArray(entry?.parts)) {
      for (const part of entry.parts) {
        pushText(part?.text);
        if (part?.inlineData?.data) {
          pushText(`[inlineData:${part.inlineData.mimeType ?? 'binary'}]`);
        }
      }
    } else {
      pushText(entry?.text);
    }
  }

  if (candidate?.output_text) pushText(candidate.output_text);
  if (candidate?.content?.text) pushText(candidate.content.text);

  return texts;
}

function buildResultFromGeminiResponse(gjson: any) {
  // Gemini 固有のレスポンス shape を __copilot メタに格納するため整形する
  const candidates = Array.isArray(gjson?.candidates) ? gjson.candidates : [];
  const texts: string[] = [];
  let finishReason: string | null = null;

  for (const candidate of candidates) {
    if (!finishReason && candidate?.finishReason) finishReason = candidate.finishReason;
    const partsTexts = collectTextsFromCandidate(candidate);
    for (const t of partsTexts) {
      if (t && !texts.includes(t)) texts.push(t);
    }
  }

  const explanation = texts.join('\n').trim();
  let answer = '';
  if (explanation) {
    const ansMatch = explanation.match(/(?:答え|解答|Answer|Solution)\s*[:：]\s*(.+)/i);
    if (ansMatch && ansMatch[1]) {
      answer = ansMatch[1].split(/\n|。/)[0].trim();
    }
  }

  const steps: string[] = [];
  if (explanation) {
    const lines = explanation.split(/\n+/);
    for (const line of lines) {
      if (/^(?:\d+\.|\d+\)|・|\-|①|②|③|④|⑤)/.test(line.trim())) {
        steps.push(line.trim());
      }
      if (steps.length >= 8) break;
    }
  }

  return {
    answer,
    explanation,
    steps: steps.length ? steps : undefined,
    finishReason: finishReason ?? null,
    promptFeedback: gjson?.promptFeedback ?? null,
    candidatesCount: candidates.length,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...cors } });
  }
  try {
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');
    // URL 経由／base64 経由のどちらか一方でも指定されていれば処理を継続する
    const body = (await req.json()) as RequestBody;
    if (!body?.imageUrl && !body?.imageBase64) {
      return new Response(JSON.stringify({ error: 'imageUrl or imageBase64 is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
    }

    // まず応答をSSEで開始して、最初のバイトを即時返却
    const stream = new ReadableStream({
      start(controller) {
        const enc = new TextEncoder();
        // 初期パディング（プロキシのバッファ閾値を超えるためのダミーデータ）
        controller.enqueue(enc.encode(':' + ' '.repeat(2048) + '\n'));
        // 初期イベント
        controller.enqueue(enc.encode(':ok\n\n'));
        controller.enqueue(enc.encode('event: open\n'));
        controller.enqueue(enc.encode('data: {"status":"starting"}\n\n'));
        // 1秒ごとのハートビート（プロキシにフラッシュを促す）
        const hb = setInterval(() => {
          try { controller.enqueue(enc.encode(':hb\n\n')); } catch (_) { /* noop */ }
        }, 1000);

        (async () => {
          try {
            // 画像の準備: クライアントから base64 が渡された場合はそれを優先
            let ct = 'image/*';
            let base64 = '';
            if (body.imageBase64) {
              base64 = body.imageBase64;
              ct = (body.mimeType && /^image\//i.test(body.mimeType) ? body.mimeType : 'image/*');
            } else {
              // URL 経由で取得（やや余裕のあるタイムアウト）
              const ab = new AbortController();
              const t = setTimeout(() => ab.abort(), 6000);
              const resImg = await fetch(body.imageUrl!, { signal: ab.signal });
              clearTimeout(t);
              if (!resImg.ok) throw new Error(`failed to fetch image: ${resImg.status}`);
              ct = resImg.headers.get('content-type') || 'image/*';
              const buf = await resImg.arrayBuffer();
              const bytes = new Uint8Array(buf);
              base64 = u8ToBase64(bytes);
            }

            const payload = {
              contents: [
                {
                  role: 'user',
                  parts: [
                    { text: buildPrompt(body.locale ?? 'ja') },
                    { inlineData: { mimeType: /^image\//i.test(ct) ? ct : 'image/*', data: base64 } },
                  ],
                },
              ],
            } as any;

            const resolveModelName = (modelName: string) => {
              // Supabase のシークレットには `models/` なしで保存しても動作するように正規化
              if (!modelName) return '';
              return modelName.startsWith('models/') ? modelName : `models/${modelName}`;
            };

            async function callGemini(modelName: string) {
              const target = resolveModelName(modelName);
              if (!target) {
                throw new Error('gemini error: model name is empty');
              }
              const url = `https://generativelanguage.googleapis.com/${API_VERSION}/${target}:generateContent`;
              const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
                body: JSON.stringify(payload),
              });
              const raw = await response.text().catch(() => '');
              return { response, raw };
            }

            const shouldFallback = (status: number, body: string) => {
              if (status === 404) return true;
              return /not\s+found/i.test(body) || /unsupported/i.test(body);
            };

            let usedModel = MODEL;
            let first = await callGemini(MODEL);
            if (!first.response.ok && shouldFallback(first.response.status, first.raw) && FALLBACK_MODEL && FALLBACK_MODEL !== MODEL) {
              // モデルが利用不可だった場合はフォールバックモデルに切り替えて再試行
              const second = await callGemini(FALLBACK_MODEL);
              if (second.response.ok) {
                usedModel = FALLBACK_MODEL;
                first = second;
              } else {
                const message = `gemini error: ${second.response.status} ${second.raw || ''}`.trim();
                throw new Error(message || 'gemini error: fallback request failed');
              }
            }

            if (!first.response.ok) {
              const message = `gemini error: ${first.response.status} ${first.raw || ''}`.trim();
              throw new Error(message || 'gemini error');
            }

            let gjson: any = {};
            try {
              gjson = first.raw ? JSON.parse(first.raw) : {};
            } catch (_) {
              gjson = { raw: first.raw };
            }

            const parsed = buildResultFromGeminiResponse(gjson);
            // 生レスポンスに解析済みの情報（`__copilot`）を付け足してクライアントへ送る
            const envelope = { ...gjson, __copilot: { ...parsed, usedModel } };
            const ssePayload = JSON.stringify(envelope);
            controller.enqueue(enc.encode(`data: ${ssePayload}\n\n`));
            controller.enqueue(enc.encode('event: done\n'));
            controller.enqueue(enc.encode('data: ["complete"]\n\n'));
            clearInterval(hb);
            controller.close();
          } catch (err) {
            const msg = (err as Error)?.message ?? String(err);
            const enc = new TextEncoder();
            // SSE 経由でエラー内容を返してストリームを終了
            controller.enqueue(enc.encode('event: error\n'));
            controller.enqueue(enc.encode(`data: {"error": ${JSON.stringify(msg)} }\n\n`));
            clearInterval(hb);
            controller.close();
          }
        })();
      },
    });

    return new Response(stream, { headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      ...cors,
    } });
  } catch (e) {
    const msg = (e as Error)?.message ?? String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'Content-Type': 'application/json', 'x-error': String(msg).slice(0,256), ...cors } });
  }
});
