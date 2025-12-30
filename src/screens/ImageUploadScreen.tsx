import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, View, Image, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { Button, ButtonText } from '@/components/ui/button';
import { Input, InputField } from '@/components/ui/input';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
// Expo SDK 54: legacy FS API が安定（fallback 用に使用）
import * as FileSystem from 'expo-file-system/legacy';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import Constants from 'expo-constants';
import { encode as b64encode, decode as b64decode } from 'base64-arraybuffer';

// ===== Helpers =====
const ALWAYS_ASCII_KEYS = true;
const toAsciiBase = (s: string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9._-]/g, '_');
const sanitizeFileName = (s: string) => s.replace(/[\\/:*?"<>|\t\n\r]+/g, '_').trim();
const base64ToArrayBuffer = (base64: string) => b64decode(base64);
const arrayBufferToBase64 = (ab: ArrayBuffer) => b64encode(ab);
const IMAGE_SUBFOLDER = 'images';
const guessContentType = (ext: string) =>
  ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

const formatAiMathTextForDisplay = (input: string): string => {
  if (!input) return '';
  let s = String(input).replace(/\r\n/g, '\n');

  // NOTE: 生成結果の「読みやすさ」担保は Edge Function 側で行う（根本対策）。
  // ここでは表示崩れを避けるための最小限の整形のみを実施する。
  // 先頭のラベル重複（UI側で「解説:」を付けるため）を除去
  s = s.replace(/^\s*(?:答え|解答|回答|解説)\s*[:：]\s*/u, '');

  // 余分な空白/空行の整理
  s = s.replace(/[ \t]+\n/g, '\n');
  s = s.replace(/\n{3,}/g, '\n\n');
  s = s.trim();
  return s;
};

const firstNonEmptyLine = (text: string): string => {
  const lines = String(text || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  return lines[0] || '';
};

const removeLeadingLineIfMatches = (text: string, lineToRemove: string): string => {
  if (!text || !lineToRemove) return text;
  const rawLines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const idx = rawLines.findIndex((l) => l.trim().length > 0);
  if (idx < 0) return text;
  if (rawLines[idx].trim() === lineToRemove.trim()) {
    const next = [...rawLines.slice(0, idx), ...rawLines.slice(idx + 1)].join('\n');
    return next.replace(/\n{3,}/g, '\n\n').trim();
  }
  return text;
};

type Item = { key: string; url: string; displayName: string };
type Analysis = { name: string; answer: string; explanation: string; steps?: string[] } | null;

const DISABLE_SYNC_FALLBACK = true; // ストリームのみで評価（必要なら false で同期版にフォールバック）

export default function ImageUploadScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { user } = useAuth();

  const bucketConfig = useMemo(() => {
    const extra = Constants.expoConfig?.extra as any;
    const raw = extra?.supabaseImageBucket ?? extra?.supabaseBucket;
    if (typeof raw === 'string' && raw.trim()) {
      return raw.trim();
    }
    return 'images';
  }, []);

  const { bucket, bucketPrefix } = useMemo(() => {
    const segments = bucketConfig.split('/').map((seg) => seg.trim()).filter(Boolean);
    const bucketName = segments.shift() || 'images';
    return { bucket: bucketName, bucketPrefix: segments.join('/') };
  }, [bucketConfig]);

  // ユーザー毎の隔離: ログイン必須 + 画像サブフォルダ
  const folderPath = useMemo(() => {
    if (!user?.id) return null;
    const parts = [] as string[];
    if (bucketPrefix) parts.push(bucketPrefix);
    parts.push(user.id, IMAGE_SUBFOLDER);
    return parts.join('/');
  }, [user?.id, bucketPrefix]);

  const [imageUri, setImageUri] = useState('');
  const [pickedBase64, setPickedBase64] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);

  const [analysis, setAnalysis] = useState<Analysis>(null);
  const [analysisErr, setAnalysisErr] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingKey, setAnalyzingKey] = useState<string | null>(null);

  const listRef = useRef<FlatList<Item>>(null as any);

  const canUpload = !!user && !!imageUri && !!fileName.trim();

  useEffect(() => {
    refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket, folderPath, user?.id]);

  async function refreshList() {
    if (!user || !folderPath) {
      setItems([]);
      return;
    }
    try {
      // DB に保存した表示名のマップを取得（無ければ空）
      let nameMap = new Map<string, string>();
      try {
        if (user?.id) {
          const { data } = await supabase
            .from('uploads')
            .select('storage_key, original_name')
            .eq('user_id', user.id);
          (data || []).forEach((r: any) => {
            if (r?.storage_key && r?.original_name) nameMap.set(r.storage_key, r.original_name);
          });
        }
      } catch {
        // テーブルが無い等は無視
      }

      const { data: list, error } = await supabase.storage
        .from(bucket)
        .list(folderPath, { limit: 200, sortBy: { column: 'name', order: 'desc' } });
      if (error) throw error;

      const next: Item[] = (list || [])
        .filter((f: any) => f?.name)
        .map((f: any) => ({
          key: `${folderPath}/${f.name}`,
          url: '',
          displayName: nameMap.get(`${folderPath}/${f.name}`) || f.name,
        }));
      // 各アイテムの表示用 URL は署名付き URL を生成（private バケット対応）
      const withUrls: Item[] = [];
      for (const it of next) {
        try {
          const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(it.key, 300);
          withUrls.push({ ...it, url: signed?.signedUrl || '' });
        } catch {
          withUrls.push(it);
        }
      }
      setItems(withUrls);
    } catch (e: any) {
      setMessage('一覧取得に失敗しました。');
      console.error('[ImageUpload] refreshList failed', { bucket, folderPath, error: e });
    }
  }

  async function pickImage() {
    if (!user) {
      setMessage('画像を選ぶにはログインが必要です。');
      return;
    }
    setMessage(null);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setMessage('写真ライブラリへのアクセス許可が必要です。');
      return;
    }
    // Deprecated: MediaTypeOptions → MediaType を使用。base64 を受け取り、FS 読み込みを避ける
    const result = await ImagePicker.launchImageLibraryAsync({
      // MediaTypeOptions は deprecated。新APIは string 配列: ['images'] | ['videos'] | ['audio']
      mediaTypes: ['images'] as any,
      base64: true,
      quality: 0.9,
    } as any);
    if (!result.canceled && result.assets?.length) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      setPickedBase64(asset.base64 ?? null);

      // 初期ファイル名候補（iOS等では fileName が空になることがあるため assetId から解決を試みる）
      let resolvedName = asset.fileName || '';
      if (!resolvedName && (asset as any)?.assetId) {
        try {
          const { status: mlStatus } = await MediaLibrary.getPermissionsAsync();
          if (mlStatus !== 'granted') {
            await MediaLibrary.requestPermissionsAsync();
          }
          const { status: mlStatus2 } = await MediaLibrary.getPermissionsAsync();
          if (mlStatus2 === 'granted') {
            const info: any = await MediaLibrary.getAssetInfoAsync((asset as any).assetId);
            resolvedName = info?.filename || '';
          }
        } catch (e) {
          console.error('[ImageUpload] failed to resolve filename via MediaLibrary', e);
        }
      }
      if (!resolvedName) {
        resolvedName = asset.uri.split('/').pop() || `image-${Date.now()}.jpg`;
      }

      setFileName(resolvedName);
      setMessage(`画像を選択しました（${resolvedName}）。`);
    }
  }

  // URI から base64 を確実に取得する（picker からの base64 が無い場合のフォールバック）
  async function ensureBase64FromUri(uri: string): Promise<string> {
    // 1) FileSystem で base64 読み込み
    try {
      const b64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
      if (b64) return b64;
    } catch {}
    // 2) fetch → arrayBuffer → base64
    try {
      const resp = await fetch(uri);
      const ab = await resp.arrayBuffer();
      return arrayBufferToBase64(ab);
    } catch (e) {
      throw new Error(`画像データの読込に失敗しました: ${String((e as any)?.message || e)}`);
    }
  }

  async function uploadImage() {
    if (!user || !folderPath) {
      setMessage('アップロードにはログインが必要です。先にログインしてください。');
      return;
    }
    if (!imageUri) {
      setMessage('先に画像を選択してください。');
      return;
    }
    if (!fileName || !fileName.trim()) {
      setMessage('ファイル名を入力してください。');
      return;
    }

    let computedPath: string | null = null;
    try {
      setUploading(true);
      setMessage(null);

  // 画像読み込み（picker の base64 を優先、無ければフォールバック）
  const base64 = pickedBase64 ?? (await ensureBase64FromUri(imageUri));
      const ab = base64ToArrayBuffer(base64);

      // 拡張子とベース名
  const pathPart = (imageUri.split('?')[0] || '').split('/').pop() || '';
  const detectedExt = (pathPart.split('.').pop() || 'jpg').toLowerCase();
      const inputName = sanitizeFileName(fileName);
      const dot = inputName.lastIndexOf('.');
      const rawBase = dot > 0 ? inputName.slice(0, dot) : inputName;
      const rawExt = (dot > 0 ? inputName.slice(dot + 1) : detectedExt).toLowerCase();
      const baseSafe = rawBase && !/^\.+$/.test(rawBase) ? rawBase : `image-${Date.now()}`;
      const extSafe = /^[a-z0-9]{2,5}$/.test(rawExt) ? rawExt : detectedExt;
      const baseForKey = ALWAYS_ASCII_KEYS ? toAsciiBase(baseSafe) : baseSafe;
      const finalName = `${baseForKey}.${extSafe}`;
  const filePath = `${folderPath}/${finalName}`;
      computedPath = filePath;
      const originalDisplayName = `${baseSafe}.${extSafe}`; // 表示用（日本語可）
      const contentType = guessContentType(extSafe);

      // アップロード試行
      let attemptedPath = filePath;
      let uploadErr: any | null = null;
      {
        const { error } = await supabase.storage
          .from(bucket)
          .upload(attemptedPath, ab, { contentType, upsert: false });
        uploadErr = error ?? null;
      }
      if (uploadErr && String(uploadErr.message || uploadErr).includes('invalid key')) {
        // 非ASCII等の環境で invalid key が出る場合の代替
        let asciiBase = baseSafe.replace(/[^A-Za-z0-9._-]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
        if (!asciiBase) asciiBase = `image-${Date.now()}`;
        const altFinal = `${asciiBase}.${extSafe}`;
        const altPath = `${folderPath}/${altFinal}`;
        const { error: err2 } = await supabase.storage
          .from(bucket)
          .upload(altPath, ab, { contentType, upsert: false });
        if (err2) throw err2;
        attemptedPath = altPath;
        computedPath = altPath;
      } else if (uploadErr) {
        throw uploadErr;
      }

      // 表示名を DB に保存（存在しなければ無視）
      try {
        if (user?.id) {
          await supabase
            .from('uploads')
            .insert({ user_id: user.id, storage_key: attemptedPath, original_name: originalDisplayName, bucket });
        }
      } catch {
        /* noop */
      }

      // 成功時は画面ログは出さず、一覧（アップロード済み）に反映するのみ
      setMessage(`アップロードしました（${originalDisplayName}）。`);
      await refreshList();
    } catch (e: any) {
      // 失敗時は短文を画面に出し、詳細はコンソールに出す
      setMessage('アップロードに失敗しました。');
      if (e?.message?.includes('Bucket not found')) {
        console.error(
          `[ImageUpload] upload failed: bucket not found (bucket=${bucket})`,
          e
        );
      } else if (e?.message?.includes('The resource already exists') || e?.statusCode === '409') {
        console.error('[ImageUpload] upload failed: resource already exists (409)', e);
      } else {
        const extra = computedPath ? { computedPath } : undefined;
        console.error('[ImageUpload] upload failed', { bucket, ...extra, error: e });
      }
    } finally {
      setUploading(false);
    }
  }

  async function removeItem(storageKey: string) {
    try {
      setMessage(null);
      const { error } = await supabase.storage.from(bucket).remove([storageKey]);
      if (error) throw error;
      try {
        if (user?.id) {
          await supabase.from('uploads').delete().match({ user_id: user.id, storage_key: storageKey });
        }
      } catch {
        /* noop */
      }
      setMessage('削除しました。');
      await refreshList();
    } catch (e: any) {
      setMessage('削除に失敗しました。');
      console.error('[ImageUpload] removeItem failed', { bucket, storageKey, error: e });
    }
  }

  // 単発 SSE（1イベント）または JSON 本文を解釈
  type SSEParseResult = {
    finalJson: any | null;
    sseEvents: number;
    combinedText: string;
    payloads: string[];
    promptFeedback: any | null;
  };

  function extractTextFromCandidate(candidate: any): string {
    if (!candidate) return '';
    const texts: string[] = [];

    function collectFromPart(part: any) {
      if (!part) return;
      if (typeof part.text === 'string' && part.text) {
        texts.push(part.text);
      } else if (part?.inlineData?.data) {
        texts.push(`[inlineData:${part.inlineData.mimeType ?? 'binary'}]`);
      }
    }

    const directParts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    for (const part of directParts) collectFromPart(part);

    const contentArray = Array.isArray(candidate?.content) ? candidate.content : [];
    for (const entry of contentArray) {
      if (Array.isArray(entry?.parts)) {
        for (const part of entry.parts) collectFromPart(part);
      } else {
        collectFromPart(entry);
      }
    }

    if (candidate?.output_text) texts.push(String(candidate.output_text));
    if (candidate?.content?.text) texts.push(String(candidate.content.text));

    return texts
      .map((t) => (typeof t === 'string' ? t : String(t)))
      .filter((t) => t.trim().length > 0)
      .join('\n');
  }

  function parseSSEorJSON(text: string): SSEParseResult {
    const normalized = text.replace(/\r\n/g, '\n');
    let sseEvents = 0;
    let combinedText = '';
    let finalJson: any | null = null;
    const payloads: string[] = [];
    let promptFeedback: any | null = null;

    const events = normalized.split('\n\n');
    for (const evt of events) {
      const dataLines = evt.split('\n').filter((l) => l.startsWith('data:'));
      if (!dataLines.length) continue;
      sseEvents += dataLines.length;
      for (const dl of dataLines) {
        const payload = dl.replace(/^data:\s?/, '').trim();
        if (!payload || payload === '[DONE]') continue;
        payloads.push(payload);
        try {
          const j = JSON.parse(payload);
          if (!promptFeedback) {
            promptFeedback = j?.promptFeedback ?? j?.__copilot?.promptFeedback ?? null;
          }
          const parsedResult = j?.__copilot ?? null;
          const candidate = j?.candidates?.[0];
          let text = extractTextFromCandidate(candidate) || j?.text || '';
          if ((!text || !text.trim()) && typeof parsedResult?.explanation === 'string' && parsedResult.explanation.trim()) {
            text = parsedResult.explanation;
          }
          if (typeof text === 'string' && text) {
            combinedText += (combinedText ? '\n' : '') + text;
            const fbFirst = text.indexOf('{');
            const fbLast = text.lastIndexOf('}');
            if (fbFirst >= 0 && fbLast > fbFirst) {
              try { finalJson = JSON.parse(text.slice(fbFirst, fbLast + 1)); } catch {}
            }
          }
          if (!finalJson && parsedResult && (parsedResult.answer || parsedResult.explanation)) {
            finalJson = {
              answer: parsedResult.answer ?? '',
              explanation: parsedResult.explanation ?? '',
              steps: parsedResult.steps,
              finishReason: parsedResult.finishReason,
              candidatesCount: parsedResult.candidatesCount,
              promptFeedback: parsedResult.promptFeedback ?? promptFeedback ?? null,
            };
          }
        } catch {
          // ignore
        }
      }
    }
    if (!sseEvents) {
      try {
        const j = JSON.parse(normalized);
        payloads.push(normalized);
        const candidate = j?.candidates?.[0];
        let text = extractTextFromCandidate(candidate) || j?.text || '';
        if ((!text || !text.trim()) && typeof j?.__copilot?.explanation === 'string') {
          text = j.__copilot.explanation;
        }
        if (typeof text === 'string' && text) {
          finalJson = { answer: '', explanation: text };
          combinedText = text;
        }
        if (!promptFeedback) {
          promptFeedback = j?.promptFeedback ?? j?.__copilot?.promptFeedback ?? null;
        }
      } catch {
        // not json
      }
    }
    if (!finalJson && combinedText.trim()) {
      finalJson = { answer: '', explanation: combinedText };
    }
    return { finalJson, sseEvents, combinedText, payloads, promptFeedback };
  }

  async function analyzeItem(itemKey: string, displayName: string, url: string) {
    if (!user) {
      setAnalysis(null);
      setAnalysisErr('AI解析にはログインが必要です。先にログインしてください。');
      listRef.current?.scrollToEnd?.({ animated: true });
      return;
    }
    setAnalysis(null);
    setAnalysisErr(null);
    setAnalyzing(true);
    setAnalyzingKey(itemKey);
    try {
      let analyzeUrl = url;
      try {
        const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(itemKey, 300);
        if (signed?.signedUrl) analyzeUrl = signed.signedUrl;
      } catch {}

      // 画像を事前に base64 化し、mimeType を推定
      let mimeType = 'image/jpeg';
      let imageBase64: string | undefined = undefined;
      try {
        const ext = (analyzeUrl.split('?')[0] || '').split('.').pop()?.toLowerCase() || '';
        if (ext === 'png') mimeType = 'image/png';
        else if (ext === 'webp') mimeType = 'image/webp';
        else mimeType = 'image/jpeg';
      } catch {}
      try {
        const imgResp = await fetch(analyzeUrl);
        if (imgResp.ok) {
          const ct = imgResp.headers.get('content-type');
          if (ct && /^image\//i.test(ct)) mimeType = ct;
          const ab = await imgResp.arrayBuffer();
          imageBase64 = arrayBufferToBase64(ab);
        }
      } catch {}

      const { data: sessData } = await supabase.auth.getSession();
      const accessToken = sessData?.session?.access_token;

      const resp = await fetch(`${SUPABASE_URL}/functions/v1/solve-math-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'apikey': SUPABASE_ANON_KEY || '',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ imageUrl: analyzeUrl, imageBase64, mimeType, locale: 'ja' }),
      });
      const full = await resp.text();
      if (!resp.ok) {
        throw Object.assign(new Error(`stream call failed: ${resp.status}`), { context: full });
      }
      const { finalJson, sseEvents, combinedText, payloads, promptFeedback } = parseSSEorJSON(full);
      const ans = (finalJson ?? {}) as { answer?: string; explanation?: string; steps?: string[] };
      if (!ans.answer && !ans.explanation) {
        const informativePayload = payloads.find((p) => !/"status"\s*:\s*"starting"/.test(p)) || payloads[0];
        const preview = informativePayload ? ` payload=${informativePayload.slice(0, 400)}` : '';
        const feedbackMsg = promptFeedback?.blockReason ? ` blockReason=${promptFeedback.blockReason}` : '';
        throw new Error(`AIの解析結果を取得できませんでした（events=${sseEvents}, textLen=${combinedText.length}${feedbackMsg}${preview ? ',' + preview : ''}）`);
      }
      const formattedAnswer = formatAiMathTextForDisplay(ans.answer ?? '');
      const formattedExplanation = formatAiMathTextForDisplay(ans.explanation ?? '');
      const formattedCombined = formatAiMathTextForDisplay(combinedText ?? '');
      const displayAnswer = formattedAnswer || formattedExplanation || formattedCombined;
      const answerLine = firstNonEmptyLine(displayAnswer);
      // answer が存在する時だけ解説を表示（answer が explanation 由来の場合は重複防止で非表示）
      const displayExplanationRaw = formattedAnswer ? formattedExplanation : '';
      // 解説の先頭に答えが書かれていることが多いので重複行を削除
      const displayExplanation = removeLeadingLineIfMatches(displayExplanationRaw, answerLine);
      const formattedSteps = (ans.steps || [])
        .map((step) => formatAiMathTextForDisplay(step))
        .map((step) => step.replace(/^\s*(?:手順|ステップ)\s*[:：]\s*/u, '').trim())
        .filter(Boolean)
        // 手順に答え行だけが混ざる場合があるので除外
        .filter((step) => step.trim() !== answerLine.trim());
      setAnalysis({ name: displayName, answer: displayAnswer, explanation: displayExplanation, steps: formattedSteps });
      listRef.current?.scrollToEnd?.({ animated: true });
    } catch (e: any) {
      const ctx = e?.context ? `\ncontext: ${typeof e.context === 'string' ? e.context : JSON.stringify(e.context)}` : '';
      setAnalysisErr(`${e?.message ?? String(e)}${ctx}`);
      listRef.current?.scrollToEnd?.({ animated: true });
    } finally {
      setAnalyzing(false);
      setAnalyzingKey(null);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={headerHeight}
    >
      <Box className="flex-1 bg-purple-50">
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(it) => it.key}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={8}
          windowSize={10}
          renderItem={({ item: it }) => (
            <View style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
              <Image source={{ uri: it.url }} style={{ width: '100%', height: 160 }} />
              <Box className="flex-row items-center justify-between p-2 bg-white">
                <Text className="flex-1 mr-2 text-xs" numberOfLines={1}>
                  {it.displayName}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button
                    variant="outline"
                    className="border bg-blue-100 data-[hover=true]:bg-blue-200 data-[active=true]:bg-blue-300"
                    onPress={() => analyzeItem(it.key, it.displayName, it.url)}
                    isDisabled={analyzing}
                    size="sm"
                  >
                    <ButtonText className="text-blue-700">AIで解く{analyzing && analyzingKey === it.key ? '…' : ''}</ButtonText>
                  </Button>
                  <Button
                    variant="outline"
                    action="negative"
                    className="border bg-red-100 data-[hover=true]:bg-red-200 data-[active=true]:bg-red-300"
                    onPress={() => removeItem(it.key)}
                    size="sm"
                  >
                    <ButtonText className="text-red-700">削除</ButtonText>
                  </Button>
                </View>
              </Box>
            </View>
          )}
          ListHeaderComponent={
            <View>
              <View style={{ padding: 16 }}>
                <Text className="mb-4 text-xl font-bold">画像アップロード</Text>

                <Text className="mb-4 text-typography-600">
                  {imageUri ? '画像を選択済み' : '画像が選択されていません'}
                </Text>

                <Text className="mb-2 text-base">ファイル名</Text>
                <Input className="mb-2">
                  <InputField
                    placeholder="例: myphoto.jpg（拡張子省略可）"
                    value={fileName}
                    onChangeText={setFileName}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </Input>

                {message && (
                  <Box className="p-3 mb-4 bg-white border rounded border-outline-200">
                    <Text selectable>{message}</Text>
                  </Box>
                )}

                <Box className="flex-row gap-3 mb-6">
                  <Button
                    variant="outline"
                    className="border bg-purple-200 data-[hover=true]:bg-purple-300 data-[active=true]:bg-purple-400"
                    onPress={pickImage}
                  >
                    <ButtonText className="text-purple-700">画像を選ぶ</ButtonText>
                  </Button>
                  <Button
                    action="positive"
                    variant="outline"
                    className="border bg-green-200 data-[hover=true]:bg-green-300 data-[active=true]:bg-green-400"
                    onPress={uploadImage}
                    disabled={!imageUri || uploading || !canUpload || !fileName.trim()}
                  >
                    <ButtonText className="text-green-800">アップロード</ButtonText>
                  </Button>
                </Box>

                <Text className="mb-2 text-lg font-semibold">アップロード済み</Text>
              </View>
            </View>
          }
          ListFooterComponent={
            (analysis || analysisErr) ? (
              <View style={{ paddingTop: 16 }}>
                {analysis && (
                  <Box className="p-3 mb-4 bg-white border rounded border-outline-200">
                    <Text className="mb-1 font-semibold">AI解析結果</Text>
                    {!!analysis.steps?.length && (
                      <View style={{ marginTop: 4 }}>
                        {analysis.steps.map((s, i) => (
                          <Text key={i} className="text-xs">{i + 1}. {s}</Text>
                        ))}
                      </View>
                    )}
                    {!!analysis.answer && <Text className="mt-2">{analysis.answer}</Text>}
                    {!!analysis.explanation && <Text className="mt-2">解説: {analysis.explanation}</Text>}
                  </Box>
                )}
                {analysisErr && (
                  <Box className="p-3 mb-4 bg-white border rounded border-outline-200">
                    <Text selectable>{analysisErr}</Text>
                  </Box>
                )}
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
              <Text className="text-typography-600">まだ画像がありません</Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingHorizontal: 16, paddingTop: 0 }}
          showsVerticalScrollIndicator={false}
        />
      </Box>
    </KeyboardAvoidingView>
  );
}
