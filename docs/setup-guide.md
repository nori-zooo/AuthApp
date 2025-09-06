# ログイン認証アプリ作成ガイド
React Native + Expo + Gluestack UI v2 + TypeScript + Supabase

## 1. 事前準備

### 必要なツール
- Node.js (16以上)
- npm または yarn
- Expo CLI
- Supabaseアカウント

### インストール
```bash
npm install -g @expo/cli
```

### 前提条件確認
Gluestack UI v2を使用するための前提条件：
- **Expo SDK**: 50以上
- **React Native**: 72.5以上
- **Node.js**: 16以上

## 2. プロジェクトの初期化

### Expoプロジェクト作成
```bash
npx create-expo-app --template blank-typescript AuthApp
cd AuthApp
```

## 3. Supabaseのセットアップ

### Supabaseプロジェクトの作成
1. [Supabase](https://supabase.com)にログイン
2. 新しいプロジェクトを作成
3. Database → Authentication → Settingsで認証設定を確認
4. Project Settings → APIでプロジェクトURLとanon keyを取得

### 認証テーブルの確認
Supabaseでは`auth.users`テーブルが自動で用意されているので、そのまま使用可能です。

## 4. 依存関係のインストール

### Gluestack UI v2 の初期化（最新版）

```bash
# ステップ1: Gluestack UI v2 プロジェクトの初期化
npx gluestack-ui init

# ステップ2: 認証アプリに必要なUIコンポーネントを個別に追加
npx gluestack-ui add box button input text vstack hstack alert card heading avatar
```

**重要:** Gluestack UI v2では、`npx gluestack-ui init`でGluestackUIProviderとconfig.tsファイルが作成され、その後個別にコンポーネントを追加する必要があります。

### その他の依存関係

```bash
# Supabase
npm install @supabase/supabase-js

# React Navigation (画面遷移用)
npm install @react-navigation/native @react-navigation/native-stack
npx expo install react-native-screens react-native-safe-area-context

# アニメーションとジェスチャー（推奨：エラー回避のため）
npx expo install react-native-gesture-handler react-native-reanimated

# AsyncStorage (ローカルストレージ)
npx expo install @react-native-async-storage/async-storage

# アイコンライブラリ（Alert用）
npx expo install lucide-react-native

# Web対応する場合のみ（オプション）
npx expo install react-dom react-native-web @expo/metro-runtime
```

**注意：**
- **Gluestack UI v2の特徴**: NativeWind（Tailwind CSS）ベースの設計で、copy-paste可能なコンポーネントシステム
- **Expo SDK 50以上が必須**: Gluestack UI v2 CLIはExpo SDK 50以上でのみサポートされています
- `react-native-gesture-handler`と`react-native-reanimated`は必須ではありませんが、画面遷移やアニメーションでエラーを避けるため推奨します
- **Web対応が不要な場合**は、`react-dom`、`react-native-web`、`@expo/metro-runtime`のインストールは省略可能です

## 5. 環境変数の設定

### `.env`ファイルを作成
プロジェクトルートに`.env`ファイルを作成し、Supabaseの認証情報を設定します：
```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### `app.config.js`で環境変数を設定

**重要：既存の`app.json`がある場合の対処法**

Expoプロジェクト作成時に`app.json`が生成された場合：

1. **既存の`app.json`をバックアップ**
   ```bash
   mv app.json app.json.backup
   ```

2. **新しく`app.config.js`を作成**
  ```javascript
   // Load local environment variables when running locally
   try {
     // eslint-disable-next-line @typescript-eslint/   no-var-requires
     require('dotenv').config();
   } catch (e) {
    // ignore if dotenv is not installed in production
   }

   export default {
     expo: {
       name: "AuthApp",
       slug: "auth-app",
       version: "1.0.0",
       orientation: "portrait",
       icon: "./assets/icon.png",
       userInterfaceStyle: "light",
       splash: {
         image: "./assets/splash.png",
         resizeMode: "contain",
         backgroundColor: "#ffffff"
       },
       assetBundlePatterns: [
         "**/*"
       ],
       ios: {
         supportsTablet: true
       },
       android: {
         adaptiveIcon: {
           foregroundImage: "./assets/adaptive-icon.png",
           backgroundColor: "#ffffff"
         }
       },
       web: {
         favicon: "./assets/favicon.png"
       },
       extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
       }
     }
   };
   ```

**注意：**
- `app.json`と`app.config.js`の両方が存在する場合、`app.config.js`が優先されます
- `.env`ファイルは必ず`.gitignore`に追加してください（セキュリティのため）

### `.gitignore`に`.env`を追加
```gitignore
# 既存の内容...

# Environment variables
.env
.env.local
.env.*.local
```

## 6. フォルダ構成

### フォルダ構造
```
docs/                     # ← ドキュメント保存用（追加）
  └── setup-guide.md      # ← この手順書を保存
src/
  ├── lib/
  │   └── supabase.ts
  ├── contexts/
  │   └── AuthContext.tsx
  ├── screens/
  │   ├── LoginScreen.tsx
  │   ├── SignUpScreen.tsx
  │   └── HomeScreen.tsx
  ├── components/
  │   └── (共通コンポーネント)
  └── types/
      └── auth.ts
components/               # ← Gluestack UI v2で自動生成
  └── ui/                 # ← UIコンポーネント保存先
      ├── gluestack-ui-provider/
      ├── box/
      ├── button/
      ├── input/
      └── ...
README.md                 # プロジェクト概要（既存）
```

### フォルダとファイル作成コマンド

**macOS/Linux:**
```bash
# フォルダ作成
mkdir -p src/lib src/contexts src/screens src/components src/types docs

# ファイル作成
touch src/lib/supabase.ts
touch src/contexts/AuthContext.tsx
touch src/screens/LoginScreen.tsx
touch src/screens/SignUpScreen.tsx
touch src/screens/HomeScreen.tsx
touch src/types/auth.ts
touch docs/setup-guide.md
```

**Windows (PowerShell):**
```powershell
# フォルダ作成
New-Item -ItemType Directory -Force -Path src\lib, src\contexts, src\screens, src\components, src\types, docs

# ファイル作成
New-Item -ItemType File -Path src\lib\supabase.ts
New-Item -ItemType File -Path src\contexts\AuthContext.tsx
New-Item -ItemType File -Path src\screens\LoginScreen.tsx
New-Item -ItemType File -Path src\screens\SignUpScreen.tsx
New-Item -ItemType File -Path src\screens\HomeScreen.tsx
New-Item -ItemType File -Path src\types\auth.ts
New-Item -ItemType File -Path docs\setup-guide.md
```

**Windows (コマンドプロンプト):**
```cmd
# フォルダ作成
mkdir src\lib src\contexts src\screens src\components src\types docs

# ファイル作成
type nul > src\lib\supabase.ts
type nul > src\contexts\AuthContext.tsx
type nul > src\screens\LoginScreen.tsx
type nul > src\screens\SignUpScreen.tsx
type nul > src\screens\HomeScreen.tsx
type nul > src\types\auth.ts
type nul > docs\setup-guide.md
```

### ドキュメント管理のベストプラクティス

**`docs`フォルダに保存するファイル例：**
- `setup-guide.md` - このセットアップ手順書
- `api-reference.md` - API仕様書
- `deployment.md` - デプロイ手順
- `troubleshooting.md` - トラブルシューティング
- `changelog.md` - 変更履歴

**`README.md`との使い分け：**
- `README.md` - プロジェクト概要、クイックスタート
- `docs/setup-guide.md` - 詳細なセットアップ手順（この手順書）

## 7. コード実装の手順

### 7.1 Supabaseクライアントの設定 (`src/lib/supabase.ts`)
```typescript
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

### 7.2 認証コンテキストの作成 (`src/contexts/AuthContext.tsx`)
```typescript
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // セッション取得
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // 認証状態の変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      signUp,
      signIn,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

### 7.3 メインApp.tsx（Gluestack UI v2対応）
```typescript
import './global.css';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";

import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import HomeScreen from './src/screens/HomeScreen';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return null; // ローディング画面を表示
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {user ? (
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ headerShown: false }}
          />
        ) : (
          <>
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="SignUp"
              component={SignUpScreen}
              options={{ title: 'アカウント作成' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <GluestackUIProvider>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </GluestackUIProvider>
  );
}
```

**重要な変更点（Gluestack UI v2）:**
- プロバイダーのインポート: `@/components/ui/gluestack-ui-provider`
- **configプロパティは不要**: `<GluestackUIProvider>`のみでOK（設定はプロバイダー内に統合済み）
- `config`のインポートも削除されている

### 7.4 ログイン画面 (`src/screens/LoginScreen.tsx`)
```typescript
import React, { useState } from 'react';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonText } from '@/components/ui/button';
import { Alert, AlertIcon, AlertText } from '@/components/ui/alert';
import { InfoIcon } from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';

const LoginScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { signIn } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      setError('メールアドレスとパスワードを入力してください');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await signIn(email, password);
    } catch (error: any) {
      setError(error.message || 'ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box className="flex-1 bg-white p-4">
      <VStack space="lg" className="mt-20">
        <Text size="2xl" className="font-bold text-center">
          ログイン
        </Text>

        {error ? (
          <Alert action="error" variant="solid" className="mx-2.5">
            <AlertIcon as={InfoIcon} className="mr-3" />
            <AlertText>{error}</AlertText>
          </Alert>
        ) : null}

        <Input>
          <InputField
            placeholder="メールアドレス"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </Input>

        <Input>
          <InputField
            placeholder="パスワード"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </Input>

        <Button
          onPress={handleLogin}
          isDisabled={loading}
          className={loading ? "opacity-60" : ""}
        >
          <ButtonText>{loading ? 'ログイン中...' : 'ログイン'}</ButtonText>
        </Button>

        <Button
          variant="link"
          onPress={() => navigation.navigate('SignUp')}
        >
          <ButtonText>アカウントを作成</ButtonText>
        </Button>
      </VStack>
    </Box>
  );
};

export default LoginScreen;
```

**重要な変更（Gluestack UI v2）:**
- 個別コンポーネントインポート（例：`@/components/ui/box`）
- NativeWind（Tailwind CSS）クラスを使用したスタイリング
- アイコンは `lucide-react-native` から個別にインポート

### 7.5 型定義ファイル (`src/types/auth.ts`)
```typescript
import { User, Session } from '@supabase/supabase-js';

export interface AuthUser extends User {}

export interface AuthSession extends Session {}

export interface AuthContextType {
  user: AuthUser | null;
  session: AuthSession | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export interface AuthError {
  message: string;
  code?: string;
}
```

### 7.6 サインアップ画面 (`src/screens/SignUpScreen.tsx`)
```typescript
import React, { useState } from 'react';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonText } from '@/components/ui/button';
import { Alert, AlertIcon, AlertText } from '@/components/ui/alert';
import { InfoIcon } from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';

const SignUpScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { signUp } = useAuth();

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      setError('全ての項目を入力してください');
      return;
    }

    if (password !== confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }

    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await signUp(email, password);
      setSuccess('アカウントが作成されました！確認メールをチェックしてください。');
      setTimeout(() => {
        navigation.navigate('Login');
      }, 2000);
    } catch (error: any) {
      setError(error.message || 'アカウント作成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box className="flex-1 bg-white p-4">
      <VStack space="lg" className="mt-10">
        <Text size="2xl" className="font-bold text-center">
          アカウント作成
        </Text>

        {error ? (
          <Alert action="error" variant="solid" className="mx-2.5">
            <AlertIcon as={InfoIcon} className="mr-3" />
            <AlertText>{error}</AlertText>
          </Alert>
        ) : null}

        {success ? (
          <Alert action="success" variant="solid" className="mx-2.5">
            <AlertIcon as={InfoIcon} className="mr-3" />
            <AlertText>{success}</AlertText>
          </Alert>
        ) : null}

        <Input>
          <InputField
            placeholder="メールアドレス"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </Input>

        <Input>
          <InputField
            placeholder="パスワード（6文字以上）"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </Input>

        <Input>
          <InputField
            placeholder="パスワード（確認）"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />
        </Input>

        <Button
          onPress={handleSignUp}
          isDisabled={loading}
          className={loading ? "opacity-60" : ""}
        >
          <ButtonText>{loading ? '作成中...' : 'アカウント作成'}</ButtonText>
        </Button>

        <Button
          variant="link"
          onPress={() => navigation.navigate('Login')}
        >
          <ButtonText>既にアカウントをお持ちの方</ButtonText>
        </Button>
      </VStack>
    </Box>
  );
};

export default SignUpScreen;
```

### 7.7 ホーム画面 (`src/screens/HomeScreen.tsx`)
```typescript
import React from 'react';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { Button, ButtonText } from '@/components/ui/button';
import { Avatar, AvatarFallbackText } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { useAuth } from '../contexts/AuthContext';

const HomeScreen = () => {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('ログアウトエラー:', error);
    }
  };

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };

  return (
    <Box className="flex-1 bg-background-light-0 p-4">
      <VStack space="xl" className="mt-10">
        {/* ヘッダー */}
        <HStack className="justify-between items-center">
          <VStack>
            <Heading size="xl">ようこそ！</Heading>
            <Text size="sm" className="text-text-light-600">
              ログインが完了しました
            </Text>
          </VStack>
          <Avatar className="bg-indigo-600" size="md">
            <AvatarFallbackText>
              {user?.email ? getInitials(user.email) : 'U'}
            </AvatarFallbackText>
          </Avatar>
        </HStack>

        {/* ユーザー情報カード */}
        <Card className="p-6 rounded-lg">
          <VStack space="md">
            <Heading size="md">アカウント情報</Heading>
            <HStack className="justify-between">
              <Text className="text-text-light-600">メールアドレス:</Text>
              <Text>{user?.email}</Text>
            </HStack>
            <HStack className="justify-between">
              <Text className="text-text-light-600">ユーザーID:</Text>
              <Text className="text-sm">{user?.id}</Text>
            </HStack>
            <HStack className="justify-between">
              <Text className="text-text-light-600">登録日時:</Text>
              <Text className="text-sm">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString('ja-JP') : '不明'}
              </Text>
            </HStack>
          </VStack>
        </Card>

        {/* アクション */}
        <VStack space="md">
          <Button variant="outline">
            <ButtonText>プロフィール編集</ButtonText>
          </Button>

          <Button variant="outline">
            <ButtonText>設定</ButtonText>
          </Button>

          <Button
            action="negative"
            variant="outline"
            onPress={handleSignOut}
          >
            <ButtonText>ログアウト</ButtonText>
          </Button>
        </VStack>
      </VStack>
    </Box>
  );
};

export default HomeScreen;
```

## 8. 実行とテスト

```bash
# 開発サーバー開始
npx expo start

# iOS Simulatorで実行
npx expo start --ios

# Android Emulatorで実行
npx expo start --android
```

## トラブルシューティング

### よくあるエラーと解決法

**1. アセットが見つからないエラー**
```
Unable to resolve asset "./assets/splash.png"
```
**解決法:**
```bash
# Expo管理下のアセットを修復
npx expo install --fix
```

**2. Gluestack UI v2 コンポーネントが見つからないエラー**
```
Module not found: Can't resolve '@/components/ui/button'
```

**原因:** 必要なコンポーネントが追加されていない

**対処法:**
```bash
# 不足しているコンポーネントを確認
ls -la components/ui/

# 不足しているコンポーネントを追加
npx gluestack-ui add button

# または全て再インストール
rm -rf components/ui
npx gluestack-ui init
npx gluestack-ui add box button input text vstack hstack alert card heading avatar
```

## 9. 変更履歴と現在の修正（2025-08-30）

- `src/lib/supabase.ts` の修正
  - Expo の `Constants.expoConfig?.extra` を優先で読み取り、なければ `process.env` をフォールバックするように変更しました。
  - 値が無い場合は警告を出力するようにして、起動は止めない実装です。
  - 例（抜粋）:
  ```typescript
  const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  ```

- 型定義の補正 (`global.d.ts` を追加)
  - `@gluestack-ui/themed` や `tailwind-variants/dist/config` など、型が提供されていないパッケージに対して最小限の宣言を追加しました。これにより TypeScript のコンパイルエラーを抑制しています。

- `tsconfig.json` の include を拡張
  - `**/*.d.ts` を含めるようにして、プロジェクト内の追加宣言ファイルを確実に読み込むようにしました。

- `components/ui/gluestack-ui-provider/index.tsx` の整理
  - 未使用の `config` import を削除し、プロバイダーのレンダリングを簡潔にしました。

- ナビゲーション設定の調整 (`App.tsx`)
  - 以前は `Login` と `Home` に `headerShown: false` が指定されていたためタイトルが表示されていませんでした。これを解除し、タイトルを設定しました（例: `options={{ title: 'ログイン' }}` や `options={{ title: 'ホーム' }}`）。

- スクリーンのスタイル調整
  - `LoginScreen.tsx` と `HomeScreen.tsx` を `SignUpScreen` と同様の余白・入力幅・ボタン配置となるよう修正しました（`mt-10`→`mt-6` 等、Avatar サイズ、Card padding、ボタン幅 `w-full` など）。

注意点 & 推奨事項
- ローカルで `.env` を使う場合はルートに `.env` を作成し、`.env.example` を参考に値をセットしてください。
- `app.config.js` で `dotenv` を有効にするため、開発マシンでは `dotenv` を devDependency に入れておくことを推奨します（`npm install --save-dev dotenv`）。
- 変更は手順書の手順自体を破壊しないよう、主に互換性と開発体験の向上を目的として実施しました。

必要であればこのセクションをさらに細かく分割し、各ファイルごとの完全な差分（完全なファイル内容）を手順書に埋め込むことも可能です。希望があれば指示してください。


**3. Expo SDK < 50でのCLI使用エラー**
```
gluestack-ui CLI requires Expo SDK 50 or above
```

**解決法:**
```bash
# Expo SDKをアップデート
npx expo upgrade

# または手動インストールガイドを参照
```

**4. Tailwind CSS再ビルドループエラー（iOS）**
```
Expo app stuck in tailwindcss(ios) rebuilding...
```

**原因:** ディレクトリ名にスペースが含まれている

**解決法:**
```bash
# スペースを含むディレクトリ名を変更
# 例: 'Expo App' -> 'Expo-App'
mv "Expo App" Expo-App
```

**5. 依存関係の競合エラー**
**解決法（安全なクリーンインストール）:**
```bash
# 1. キャッシュと依存関係をクリア
rm -rf node_modules package-lock.json
npx expo start --clear

# 2. Expo管理パッケージを再インストール
npx expo install

# 3. Gluestack UI v2再初期化
npx gluestack-ui init
npx gluestack-ui add box button input text vstack hstack alert card heading avatar

# 4. 追加パッケージをインストール
npm install @supabase/supabase-js
npm install @react-navigation/native @react-navigation/native-stack
npx expo install react-native-screens react-native-safe-area-context
npx expo install @react-native-async-storage/async-storage
npm install lucide-react-native
```

**6. configプロパティのTypeScriptエラー**
```
型 '{ children: Element; config: ... }' を型 'IntrinsicAttributes & { mode?: ModeType ...
```

**原因:** Gluestack UI v2では`config`プロパティが不要

**解決法:**
```typescript
// ❌ 間違い（v1の書き方）
<GluestackUIProvider config={config}>

// ✅ 正しい（v2の書き方）
<GluestackUIProvider>
```

## まとめ

このガイドでは、React Native + Expo + Gluestack UI v2 + TypeScript + Supabaseを使用した認証アプリの作成手順を説明しました。

### 主要なポイント
- Gluestack UI v2は`copy-paste`方式でコンポーネントを管理
- NativeWind（Tailwind CSS）ベースの現代的なスタイリング
- Expo SDK 50以上が必須
- configプロパティは不要（プロバイダー内に統合済み）
- 個別コンポーネントのインストールが必要

### 次のステップ
- デプロイメント設定
- プッシュ通知の実装
- ソーシャルログイ