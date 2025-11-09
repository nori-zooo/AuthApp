import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, View, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { Button, ButtonText } from '@/components/ui/button';
import { Input, InputField } from '@/components/ui/input';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Audio } from 'expo-av';
import type { AVPlaybackStatus } from 'expo-av';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import Constants from 'expo-constants';
import { encode as b64encode, decode as b64decode } from 'base64-arraybuffer';

const ALWAYS_ASCII_KEYS = true;
const toAsciiBase = (s: string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9._-]/g, '_');
const sanitizeFileName = (s: string) => s.replace(/[\\/:*?"<>|\t\n\r]+/g, '_').trim();
const base64ToArrayBuffer = (base64: string) => b64decode(base64);
const arrayBufferToBase64 = (ab: ArrayBuffer) => b64encode(ab);
const AUDIO_SUBFOLDER = 'audio';
const guessContentTypes = (ext: string) => {
  const normalized = ext.toLowerCase();
  const types: string[] = [];

  switch (normalized) {
    case 'wav':
      types.push('audio/wav', 'audio/x-wav');
      break;
    case 'm4a':
    case 'mp4':
      types.push('audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/mp4a-latm');
      break;
    case 'aac':
      types.push('audio/aac', 'audio/mp4', 'audio/m4a', 'audio/mp4a-latm');
      break;
    case 'flac':
      types.push('audio/flac', 'audio/x-flac');
      break;
    case 'ogg':
    case 'oga':
      types.push('audio/ogg', 'audio/vorbis');
      break;
    case 'opus':
      types.push('audio/opus', 'audio/ogg');
      break;
    case 'aif':
    case 'aiff':
      types.push('audio/aiff', 'audio/x-aiff');
      break;
    case 'mp3':
      types.push('audio/mpeg', 'audio/mp3');
      break;
    default:
      types.push('audio/mpeg');
      break;
  }

  types.push('application/octet-stream');
  return Array.from(new Set(types));
};

const formatDuration = (millis: number) => {
  if (!millis || millis < 0) return '00:00';
  const totalSeconds = Math.floor(millis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

type Item = { key: string; url: string; displayName: string };

export default function MusicUploadScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { user } = useAuth();

  const bucketConfig = useMemo(() => {
    const extra = Constants.expoConfig?.extra as any;
    const raw = extra?.supabaseAudioBucket;
    if (typeof raw === 'string' && raw.trim()) {
      return raw.trim();
    }
    return 'audio';
  }, []);

  const { bucket, bucketPrefix } = useMemo(() => {
    const segments = bucketConfig.split('/').map((seg) => seg.trim()).filter(Boolean);
    const bucketName = segments.shift() || 'audio';
    return { bucket: bucketName, bucketPrefix: segments.join('/') };
  }, [bucketConfig]);

  const folderPath = useMemo(() => {
    if (!user?.id) return null;
    const parts = [] as string[];
    if (bucketPrefix) parts.push(bucketPrefix);
    parts.push(user.id, AUDIO_SUBFOLDER);
    return parts.join('/');
  }, [user?.id, bucketPrefix]);

  const [audioUri, setAudioUri] = useState('');
  const [pickedBase64, setPickedBase64] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const playbackRef = useRef<Audio.Sound | null>(null);
  const listPlaybackRef = useRef<Audio.Sound | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [recordedName, setRecordedName] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewPosition, setPreviewPosition] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [listPlaybackKey, setListPlaybackKey] = useState<string | null>(null);
  const [isListPlaybackPlaying, setIsListPlaybackPlaying] = useState(false);
  const [transcriptions, setTranscriptions] = useState<Record<string, string>>({});
  const [transcriptionErrors, setTranscriptionErrors] = useState<Record<string, string>>({});
  const [transcribingKey, setTranscribingKey] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [summaryErrors, setSummaryErrors] = useState<Record<string, string>>({});
  const [summarizingKey, setSummarizingKey] = useState<string | null>(null);

  const canUpload = !!user && !!audioUri && !!fileName.trim();

  useEffect(() => {
    refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket, folderPath, user?.id]);

  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        try {
          recordingRef.current.stopAndUnloadAsync();
        } catch {
          /* noop */
        }
        recordingRef.current = null;
      }
      releasePlayback().catch(() => {});
      stopListPlayback().catch(() => {});
    };
  }, []);

  async function stopListPlayback() {
    const current = listPlaybackRef.current;
    listPlaybackRef.current = null;
    setIsListPlaybackPlaying(false);
    setListPlaybackKey(null);
    if (!current) return;
    try {
      await current.stopAsync();
    } catch {
      /* noop */
    }
    try {
      await current.unloadAsync();
    } catch {
      /* noop */
    }
  }

  function handleListPlaybackStatusUpdate(status: AVPlaybackStatus) {
    if (!status.isLoaded) {
      if ('error' in status && status.error) {
        setMessage((prev) => prev ?? `再生エラー: ${status.error}`);
      }
      setIsListPlaybackPlaying(false);
      return;
    }

    setIsListPlaybackPlaying(status.isPlaying ?? false);

    if (status.didJustFinish) {
      setIsListPlaybackPlaying(false);
      setListPlaybackKey(null);
      stopListPlayback().catch(() => {});
    }
  }

  async function resolveItemUrl(item: Item): Promise<string> {
    if (item.url) return item.url;
    try {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(item.key, 300);
      if (error) throw error;
      const signedUrl = data?.signedUrl;
      if (!signedUrl) throw new Error('音声URLを取得できませんでした。');
      setItems((prev) => prev.map((it) => (it.key === item.key ? { ...it, url: signedUrl } : it)));
      return signedUrl;
    } catch (error) {
      throw new Error(`音声URLの取得に失敗しました: ${String((error as Error)?.message ?? error)}`);
    }
  }

  async function toggleItemPlayback(item: Item) {
    if (listPlaybackKey === item.key && isListPlaybackPlaying) {
      await stopListPlayback();
      return;
    }

    try {
      await stopListPlayback();
      await releasePlayback();

      const playbackUrl = await resolveItemUrl(item);

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: playbackUrl },
        { shouldPlay: true },
        handleListPlaybackStatusUpdate
      );

      listPlaybackRef.current = sound;
      sound.setOnPlaybackStatusUpdate(handleListPlaybackStatusUpdate);
      setListPlaybackKey(item.key);
      setIsListPlaybackPlaying(true);
    } catch (error) {
      await stopListPlayback().catch(() => {});
      setListPlaybackKey(null);
      setMessage(`一覧の再生に失敗しました: ${String((error as Error)?.message ?? error)}`);
    }
  }

  const guessMimeFromKey = (key: string) => {
    const ext = key.split('?')[0]?.split('.').pop()?.toLowerCase() || '';
    const types = guessContentTypes(ext);
    return types.length ? types[0] : 'audio/mpeg';
  };

  async function transcribeItem(item: Item) {
    if (!user) {
      setMessage('文字起こしにはログインが必要です。先にログインしてください。');
      return;
    }

    setTranscribingKey(item.key);
    setTranscriptionErrors((prev) => {
      if (!prev[item.key]) return prev;
      const next = { ...prev };
      delete next[item.key];
      return next;
    });

    try {
      const audioUrl = await resolveItemUrl(item);
      const mimeType = guessMimeFromKey(item.key) || guessMimeFromKey(item.displayName);

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const resp = await fetch(`${SUPABASE_URL}/functions/v1/transcribe-audio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          apikey: SUPABASE_ANON_KEY || '',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ audioUrl, mimeType, locale: 'ja' }),
      });

      const raw = await resp.text();
      let payload: any = {};
      if (raw) {
        try {
          payload = JSON.parse(raw);
        } catch {
          payload = { transcript: raw };
        }
      }

      if (!resp.ok) {
        throw new Error(payload?.error || `文字起こしリクエストに失敗しました (${resp.status})`);
      }

      const transcriptCandidate = payload?.transcript ?? payload?.text ?? payload?.result?.transcript ?? '';
      const transcript = typeof transcriptCandidate === 'string' ? transcriptCandidate.trim() : '';
      if (!transcript) {
        throw new Error('文字起こし結果が空でした。もう一度お試しください。');
      }

      setTranscriptions((prev) => ({ ...prev, [item.key]: transcript }));
    } catch (error) {
      const message = (error as Error)?.message ?? String(error);
      setTranscriptionErrors((prev) => ({ ...prev, [item.key]: message }));
    } finally {
      setTranscribingKey(null);
    }
  }

  async function summarizeItem(item: Item) {
    if (!user) {
      setMessage('要約にはログインが必要です。先にログインしてください。');
      return;
    }

    const transcript = transcriptions[item.key]?.trim();
    if (!transcript) {
      setSummaryErrors((prev) => ({ ...prev, [item.key]: '先に文字起こしを実行してください。' }));
      return;
    }

    setSummarizingKey(item.key);
    setSummaryErrors((prev) => {
      if (!prev[item.key]) return prev;
      const next = { ...prev };
      delete next[item.key];
      return next;
    });

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const resp = await fetch(`${SUPABASE_URL}/functions/v1/summarize-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          apikey: SUPABASE_ANON_KEY || '',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ transcript, locale: 'ja', maxSentences: 3 }),
      });

      const raw = await resp.text();
      let payload: any = {};
      if (raw) {
        try {
          payload = JSON.parse(raw);
        } catch {
          payload = { summary: raw };
        }
      }

      if (!resp.ok) {
        throw new Error(payload?.error || `要約リクエストに失敗しました (${resp.status})`);
      }

      const summaryCandidate = payload?.summary ?? payload?.result?.summary ?? payload?.text ?? '';
      const summary = typeof summaryCandidate === 'string' ? summaryCandidate.trim() : '';
      if (!summary) {
        throw new Error('要約結果が空でした。もう一度お試しください。');
      }

      setSummaries((prev) => ({ ...prev, [item.key]: summary }));
    } catch (error) {
      const message = (error as Error)?.message ?? String(error);
      setSummaryErrors((prev) => ({ ...prev, [item.key]: message }));
    } finally {
      setSummarizingKey(null);
    }
  }

  async function refreshList() {
    if (!user || !folderPath) {
      setItems([]);
      setTranscriptions({});
      setTranscriptionErrors({});
      return;
    }
    try {
      const { data: list, error } = await supabase.storage
        .from(bucket)
        .list(folderPath, { limit: 200, sortBy: { column: 'name', order: 'desc' } });
      if (error) throw error;

      const next: Item[] = (list || [])
        .filter((f: any) => f?.name)
        .map((f: any) => ({
          key: `${folderPath}/${f.name}`,
          url: '',
          displayName: f.name,
        }));

      const withUrls: Item[] = [];
      for (const it of next) {
        try {
          const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(it.key, 300);
          withUrls.push({ ...it, url: signed?.signedUrl || '' });
        } catch {
          withUrls.push(it);
        }
      }
      if (listPlaybackKey && !withUrls.some((it) => it.key === listPlaybackKey)) {
        await stopListPlayback();
      }
      setItems(withUrls);
      setTranscriptions((prev) => {
        const next: Record<string, string> = {};
        for (const it of withUrls) {
          if (prev[it.key]) next[it.key] = prev[it.key];
        }
        return next;
      });
      setTranscriptionErrors((prev) => {
        const next: Record<string, string> = {};
        for (const it of withUrls) {
          if (prev[it.key]) next[it.key] = prev[it.key];
        }
        return next;
      });
      setSummaries((prev) => {
        const next: Record<string, string> = {};
        for (const it of withUrls) {
          if (prev[it.key]) next[it.key] = prev[it.key];
        }
        return next;
      });
      setSummaryErrors((prev) => {
        const next: Record<string, string> = {};
        for (const it of withUrls) {
          if (prev[it.key]) next[it.key] = prev[it.key];
        }
        return next;
      });
    } catch (e: any) {
      setMessage(`一覧取得に失敗: ${e?.message ?? String(e)}`);
    }
  }

  async function pickAudio() {
    if (!user) {
      setMessage('音声を選ぶにはログインが必要です。');
      return;
    }
    setMessage(null);
    try {
      const pickerResult = await DocumentPicker.getDocumentAsync({
        type: ['audio/*'],
        multiple: false,
        copyToCacheDirectory: true,
      });

      const canceled = ('type' in pickerResult && pickerResult.type === 'cancel') || (pickerResult as any)?.canceled;
      if (canceled) {
        return;
      }

      const asset = 'assets' in pickerResult && pickerResult.assets?.length
        ? pickerResult.assets[0]
        : (pickerResult as unknown as { uri: string; name?: string });

      if (!asset?.uri) {
        setMessage('音声ファイルの取得に失敗しました。再度お試しください。');
        return;
      }

      await stopListPlayback();
      await releasePlayback();
      setAudioUri(asset.uri);
      setPickedBase64(null); // DocumentPicker は base64 を返さないため、後続で読み込む
      const fromUri = asset.name || asset.uri.split('/').pop() || `audio-${Date.now()}.mp3`;
      setFileName(fromUri);
    } catch (error) {
      setMessage(`音声ファイルの選択に失敗しました: ${String((error as Error)?.message ?? error)}`);
    }
  }

  async function startRecording() {
    if (!user) {
      setMessage('録音にはログインが必要です。先にログインしてください。');
      return;
    }
    if (isRecording) return;
    try {
      await stopListPlayback();
      await releasePlayback();
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setMessage('マイクへのアクセス許可が必要です。設定から有効にしてください。');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recording.setOnRecordingStatusUpdate((status) => {
        if (!status) return;
        if (status.canRecord) {
          setRecordingDuration(status.durationMillis ?? 0);
        }
      });
      recording.setProgressUpdateInterval(200);
      await recording.startAsync();

      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);
      setRecordedUri(null);
      setRecordedName(null);
      setMessage('録音を開始しました。停止するには「録音停止」をタップしてください。');
    } catch (error) {
      setMessage(`録音開始に失敗しました: ${String((error as Error)?.message ?? error)}`);
      setIsRecording(false);
    }
  }

  async function stopRecording() {
    const recording = recordingRef.current;
    if (!recording) {
      setIsRecording(false);
      return;
    }
    try {
      await recording.stopAndUnloadAsync();
    } catch (error) {
      setMessage(`録音の停止に失敗しました: ${String((error as Error)?.message ?? error)}`);
    }
    try {
      const status = await recording.getStatusAsync();
      if (status && 'durationMillis' in status && typeof status.durationMillis === 'number') {
        setRecordingDuration(status.durationMillis);
      }
    } catch {
      /* noop */
    }
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    } catch {
      /* noop */
    }

    const uri = recording.getURI();
    recordingRef.current = null;
    setIsRecording(false);

    if (uri) {
      await stopListPlayback();
      await releasePlayback();
      const stamped = `recording-${new Date().toISOString().replace(/[:.]/g, '-')}.m4a`;
      setRecordedUri(uri);
      setRecordedName(stamped);
      setMessage('録音が完了しました。「録音をアップロードに利用」をタップすると選択されます。');
    } else {
      setMessage('録音データを取得できませんでした。もう一度お試しください。');
    }
  }

  async function selectRecordedForUpload() {
    if (!recordedUri) {
      setMessage('先に録音を完了させてください。');
      return;
    }
    await stopListPlayback();
    await releasePlayback();
    setAudioUri(recordedUri);
    setPickedBase64(null);
    const name = recordedName || recordedUri.split('/').pop() || `recording-${Date.now()}.m4a`;
    setFileName(name);
    setMessage('録音ファイルをアップロード対象に設定しました。');
  }

  function resetPlaybackState() {
    setIsPlayingPreview(false);
    setPreviewPosition(0);
    setPreviewDuration(0);
  }

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if ('error' in status && status.error) {
        setMessage((prev) => prev ?? `再生エラー: ${status.error}`);
      }
      return;
    }
    setPreviewPosition(status.positionMillis ?? 0);
    setPreviewDuration(status.durationMillis ?? 0);
    setIsPlayingPreview(status.isPlaying ?? false);
    if (status.didJustFinish) {
      setIsPlayingPreview(false);
    }
  };

  async function releasePlayback() {
    const sound = playbackRef.current;
    if (!sound) {
      resetPlaybackState();
      return;
    }

    playbackRef.current = null;
    try {
      await sound.stopAsync();
    } catch {
      /* noop */
    }
    try {
      await sound.unloadAsync();
    } catch {
      /* noop */
    }
    resetPlaybackState();
  }

  async function togglePlaybackPreview() {
    if (!recordedUri) {
      setMessage('再生する録音がありません。先に録音を完了させてください。');
      return;
    }

    try {
      await stopListPlayback();
      const existing = playbackRef.current;

      if (existing) {
        const status = await existing.getStatusAsync();
        if (!status.isLoaded) {
          await releasePlayback();
        } else if (status.isPlaying) {
          await existing.pauseAsync();
          setIsPlayingPreview(false);
          return;
        } else {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
          });

          if ((status.positionMillis ?? 0) >= (status.durationMillis ?? 0)) {
            await existing.playFromPositionAsync(0);
          } else {
            await existing.playAsync();
          }
          setIsPlayingPreview(true);
          return;
        }
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: recordedUri },
        { shouldPlay: true },
        handlePlaybackStatusUpdate
      );

      playbackRef.current = sound;
      sound.setOnPlaybackStatusUpdate(handlePlaybackStatusUpdate);
      setIsPlayingPreview(true);
    } catch (error) {
      setMessage(`録音の再生に失敗しました: ${String((error as Error)?.message ?? error)}`);
      await releasePlayback();
    }
  }

  async function ensureBase64FromUri(uri: string): Promise<string> {
    try {
      const b64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
      if (b64) return b64;
    } catch {}
    try {
      const resp = await fetch(uri);
      const ab = await resp.arrayBuffer();
      return arrayBufferToBase64(ab);
    } catch (e) {
      throw new Error(`音声データの読込に失敗しました: ${String((e as any)?.message || e)}`);
    }
  }

  async function uploadAudio() {
    if (!user || !folderPath) {
      setMessage('アップロードにはログインが必要です。先にログインしてください。');
      return;
    }
    if (!audioUri) {
      setMessage('先に音声ファイルを選択してください。');
      return;
    }
    if (!fileName || !fileName.trim()) {
      setMessage('ファイル名を入力してください。');
      return;
    }

  let computedPath: string | null = null;
  let metadataWarning: string | null = null;
    try {
      setUploading(true);
      setMessage(null);

      const base64 = pickedBase64 ?? (await ensureBase64FromUri(audioUri));
      const ab = base64ToArrayBuffer(base64);

      const pathPart = (audioUri.split('?')[0] || '').split('/').pop() || '';
      const detectedExt = (pathPart.split('.').pop() || 'mp3').toLowerCase();
      const inputName = sanitizeFileName(fileName);
      const dot = inputName.lastIndexOf('.');
      const rawBase = dot > 0 ? inputName.slice(0, dot) : inputName;
      const rawExt = (dot > 0 ? inputName.slice(dot + 1) : detectedExt).toLowerCase();
      const baseSafe = rawBase && !/^\.+$/.test(rawBase) ? rawBase : `audio-${Date.now()}`;
      const extSafe = /^[a-z0-9]{2,5}$/.test(rawExt) ? rawExt : detectedExt;
      const baseForKey = ALWAYS_ASCII_KEYS ? toAsciiBase(baseSafe) : baseSafe;
      const finalName = `${baseForKey}.${extSafe}`;
      const filePath = `${folderPath}/${finalName}`;
      computedPath = filePath;
      const originalDisplayName = `${baseSafe}.${extSafe}`;
      const contentTypes = guessContentTypes(extSafe);

      let currentPath = filePath;
      let finalPath = filePath;
  let uploadSuccess = false;
      let asciiFallbackUsed = false;
      let lastUnsupportedError: any = null;

      for (let i = 0; i < contentTypes.length; ) {
        const contentType = contentTypes[i];
        const { error } = await supabase.storage
          .from(bucket)
          .upload(currentPath, ab, { contentType, upsert: false });

        if (!error) {
          uploadSuccess = true;
          finalPath = currentPath;
          break;
        }

        const message = String(error?.message ?? error ?? '');

        if (!asciiFallbackUsed && message.includes('invalid key')) {
          let asciiBase = baseSafe.replace(/[^A-Za-z0-9._-]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
          if (!asciiBase) asciiBase = `audio-${Date.now()}`;
          const altFinal = `${asciiBase}.${extSafe}`;
          currentPath = `${folderPath}/${altFinal}`;
          finalPath = currentPath;
          asciiFallbackUsed = true;
          continue; // retry the same content type with a safer key
        }

        if (message.includes('The resource already exists') || (error as any)?.statusCode === '409') {
          throw error;
        }

        if (message.includes('is not supported') || message.includes('not allowed')) {
          lastUnsupportedError = error;
          i += 1;
          continue;
        }

        throw error;
      }

      if (!uploadSuccess) {
        if (lastUnsupportedError) throw lastUnsupportedError;
        throw new Error('アップロードに失敗しました。');
      }

      computedPath = finalPath;
      const attemptedPath = finalPath;

      if (user?.id) {
        try {
          const { error: metadataError } = await supabase
            .from('uploads')
            .insert({ user_id: user.id, storage_key: attemptedPath, original_name: originalDisplayName, bucket });

          if (metadataError) {
            const fallbackDetail = [metadataError.message, metadataError.details]
              .filter((part) => typeof part === 'string' && part.trim().length > 0)
              .join(' / ');

            if (metadataError.message?.includes('row-level security') || metadataError.code === '42501') {
              metadataWarning =
                '※ アップロード履歴テーブルへの記録が行えませんでした。Supabase の Row Level Security 設定を確認してください。';
            } else {
              metadataWarning = `※ メタデータ保存に失敗しました: ${fallbackDetail || metadataError.code || '不明なエラー'}`;
            }

            if (typeof __DEV__ !== 'undefined' && __DEV__) {
              console.warn('[music-upload] uploads insert warning', metadataError);
            }
          }
        } catch (metadataException) {
          const message = (metadataException as Error)?.message ?? String(metadataException);
          metadataWarning = `※ メタデータ保存処理でエラーが発生しました: ${message}`;
          if (typeof __DEV__ !== 'undefined' && __DEV__) {
            console.warn('[music-upload] uploads insert exception', metadataException);
          }
        }
      }

      const { data } = supabase.storage.from(bucket).getPublicUrl(computedPath || filePath);
      const successMessage = metadataWarning
        ? `アップロード成功: ${data.publicUrl}\n${metadataWarning}`
        : `アップロード成功: ${data.publicUrl}`;
      setMessage(successMessage);
      await refreshList();
      await stopListPlayback();
      await releasePlayback();
      setAudioUri('');
      setPickedBase64(null);
      setRecordedUri(null);
      setRecordedName(null);
      setRecordingDuration(0);
    } catch (e: any) {
      if (e?.message?.includes('Bucket not found')) {
        setMessage(`アップロード失敗: 指定されたバケット '${bucket}' が見つかりません。Supabase の Storage でバケットを作成し、公開設定を確認してください。`);
      } else if (e?.message?.includes('The resource already exists') || e?.statusCode === '409') {
        setMessage('アップロード失敗: 同名のファイルが既に存在します。別のファイル名に変更してください。');
      } else if (e?.message?.includes('not supported')) {
        setMessage('アップロード失敗: このバケットで許可されていない MIME タイプです。Supabase Storage のバケット設定で音声ファイル (例: audio/mp4, audio/mpeg) を allowed_mime_types に追加してください。');
      } else {
        const extra = computedPath ? ` (path: ${computedPath})` : '';
        setMessage(`アップロード失敗: ${e?.message ?? String(e)}${extra}`);
      }
    } finally {
      setUploading(false);
    }
  }

  async function removeItem(storageKey: string) {
    try {
      if (listPlaybackKey === storageKey) {
        await stopListPlayback();
      }
      setTranscriptions((prev) => {
        if (!prev[storageKey]) return prev;
        const next = { ...prev };
        delete next[storageKey];
        return next;
      });
      setTranscriptionErrors((prev) => {
        if (!prev[storageKey]) return prev;
        const next = { ...prev };
        delete next[storageKey];
        return next;
      });
      setSummaries((prev) => {
        if (!prev[storageKey]) return prev;
        const next = { ...prev };
        delete next[storageKey];
        return next;
      });
      setSummaryErrors((prev) => {
        if (!prev[storageKey]) return prev;
        const next = { ...prev };
        delete next[storageKey];
        return next;
      });
      const { error } = await supabase.storage.from(bucket).remove([storageKey]);
      if (error) throw error;
      try {
        if (user?.id) {
          await supabase.from('uploads').delete().match({ user_id: user.id, storage_key: storageKey });
        }
      } catch {
        /* noop */
      }
      await refreshList();
    } catch (e: any) {
      setMessage(`削除に失敗: ${e?.message ?? String(e)}`);
    }
  }

  const renderItem = ({ item }: { item: Item }) => (
    <Box className="p-3 mb-3 bg-white border border-blue-100 rounded-lg">
      <Text className="mb-2 text-base font-semibold text-blue-900">{item.displayName}</Text>
      <View className="flex-row flex-wrap">
        <Button
          onPress={() => toggleItemPlayback(item)}
          className="mb-2 mr-2 bg-blue-200 border border-blue-400"
        >
          <ButtonText className="text-blue-700">
            {listPlaybackKey === item.key && isListPlaybackPlaying ? '停止' : '再生 / 開く'}
          </ButtonText>
        </Button>
        <Button
          onPress={() => transcribeItem(item)}
          isDisabled={transcribingKey === item.key}
          className="mb-2 mr-2 bg-purple-200 border border-purple-400"
        >
          <ButtonText className="text-purple-700">
            {transcribingKey === item.key ? '文字起こし中…' : '文字起こし'}
          </ButtonText>
        </Button>
        <Button
          onPress={() => summarizeItem(item)}
          isDisabled={summarizingKey === item.key || !transcriptions[item.key]}
          className="mb-2 mr-2 border bg-amber-200 border-amber-400"
        >
          <ButtonText className="text-amber-700">
            {summarizingKey === item.key ? '要約中…' : '要約'}
          </ButtonText>
        </Button>
        <Button
          onPress={() => removeItem(item.key)}
          className="mb-2 bg-red-200 border border-red-400"
        >
          <ButtonText className="text-red-700">削除</ButtonText>
        </Button>
      </View>
      {transcriptions[item.key] && (
        <Box className="p-2 mt-2 border border-blue-200 rounded bg-blue-50">
          <Text selectable className="text-xs text-blue-900">
            {transcriptions[item.key]}
          </Text>
        </Box>
      )}
      {transcriptionErrors[item.key] && (
        <Text className="mt-2 text-xs text-red-600">{transcriptionErrors[item.key]}</Text>
      )}
      {summaries[item.key] && (
        <Box className="p-2 mt-2 border rounded border-amber-200 bg-amber-50">
          <Text selectable className="text-xs text-amber-900">
            {summaries[item.key]}
          </Text>
        </Box>
      )}
      {summaryErrors[item.key] && (
        <Text className="mt-2 text-xs text-red-600">{summaryErrors[item.key]}</Text>
      )}
    </Box>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={{ flex: 1 }}
      keyboardVerticalOffset={headerHeight + insets.top}
    >
      <Box className="flex-1 bg-blue-50">
        <FlatList
          data={items}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 + insets.bottom }}
          ListHeaderComponent={(
            <Box className="p-4 mb-4 bg-white rounded-lg">
              <Text className="mb-3 text-xl font-bold text-blue-900">音声アップロード</Text>
              <Text className="mb-4 text-sm text-blue-600">
                音声ファイルを Supabase Storage にアップロードし、署名付きURLから再生できます。
              </Text>

              <Box className="p-3 mb-4 bg-blue-100 border border-blue-200 rounded-lg">
                <Text className="mb-2 text-base font-semibold text-blue-900">録音</Text>
                <View className="flex-row">
                  <Button
                    onPress={startRecording}
                    isDisabled={isRecording || uploading}
                    className="flex-1 mr-2 bg-blue-200 border border-blue-400"
                  >
                    <ButtonText className="text-blue-700">録音開始</ButtonText>
                  </Button>
                  <Button
                    onPress={stopRecording}
                    isDisabled={!isRecording}
                    className="flex-1 bg-blue-200 border border-blue-400"
                  >
                    <ButtonText className="text-blue-700">録音停止</ButtonText>
                  </Button>
                </View>
                {isRecording && (
                  <Text className="mt-2 text-sm text-blue-800">録音中: {formatDuration(recordingDuration)}</Text>
                )}
                {recordedUri && !isRecording && (
                  <Box className="mt-3">
                    <Text className="mb-2 text-sm text-blue-800">
                      録音済み: {formatDuration(recordingDuration)}
                    </Text>
                    <Button
                      onPress={togglePlaybackPreview}
                      className="mb-2 bg-blue-200 border border-blue-400"
                    >
                      <ButtonText className="text-blue-700">
                        {isPlayingPreview ? '再生を一時停止' : '録音を再生'}
                      </ButtonText>
                    </Button>
                    {(previewDuration > 0 || previewPosition > 0 || isPlayingPreview) && (
                      <Text className="mb-2 text-xs text-blue-700">
                        再生位置: {formatDuration(previewPosition)} / {formatDuration(previewDuration || recordingDuration)}
                      </Text>
                    )}
                    <Button
                      onPress={selectRecordedForUpload}
                      className="bg-green-200 border border-green-400"
                    >
                      <ButtonText className="text-green-700">録音をアップロードに利用</ButtonText>
                    </Button>
                  </Box>
                )}
              </Box>

              <View className="flex-row mb-4">
                <Button
                  onPress={pickAudio}
                  isDisabled={isRecording}
                  className="flex-1 bg-blue-200 border border-blue-400"
                >
                  <ButtonText className="text-blue-700">音声ファイルを選択</ButtonText>
                </Button>
              </View>

              <Input className="mb-3">
                <InputField
                  value={fileName}
                  onChangeText={setFileName}
                  placeholder="保存するファイル名 (例: music.mp3)"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </Input>

              <Button
                onPress={uploadAudio}
                isDisabled={!canUpload || uploading}
                className="bg-blue-500"
              >
                <ButtonText className="text-white">
                  {uploading ? 'アップロード中...' : 'アップロード'}
                </ButtonText>
              </Button>

              {message && (
                <Box className="p-3 mt-3 border border-blue-200 rounded-md bg-blue-50">
                  <Text selectable className="text-sm text-blue-900">{message}</Text>
                </Box>
              )}
            </Box>
          )}
          ListEmptyComponent={(
            <Text className="px-4 text-sm text-blue-600">アップロード済みの音声はまだありません。</Text>
          )}
        />
      </Box>
    </KeyboardAvoidingView>
  );
}
