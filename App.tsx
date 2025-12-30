import './global.css';

import React from 'react';
import { LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './app/navigation';
import { GluestackUIProvider } from './components/ui/gluestack-ui-provider';
import { AuthProvider } from './src/contexts/AuthContext';

// Metro(ターミナル)に出るWARNは LogBox では消えないため、開発時のみフィルタする。
// - MediaLibraryの警告は Expo Go の制約で、根本対応は development build。
// - SafeAreaView警告は依存側が SafeAreaView を参照しているため発生。
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const first = args[0];
    const msg = typeof first === 'string' ? first : '';

    if (
      msg.includes(
        'Due to changes in Androids permission requirements, Expo Go can no longer provide full access to the media library.'
      ) ||
      msg.includes('SafeAreaView has been deprecated and will be removed in a future release.')
    ) {
      return;
    }

    originalWarn(...(args as any));
  };
}

// 開発時の冗長な警告を抑止（根本対応は依存側の更新）
LogBox.ignoreLogs([
  'SafeAreaView has been deprecated',
  '[baseline-browser-mapping] The data in this module is over two months old.',
  'Due to changes in Androids permission requirements, Expo Go can no longer provide full access to the media library.',
]);

export default function App() {
  return (
    <SafeAreaProvider>
      <GluestackUIProvider>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </GluestackUIProvider>
    </SafeAreaProvider>
  );
}