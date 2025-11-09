import './global.css';

import React from 'react';
import { LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './app/navigation';
import { GluestackUIProvider } from './components/ui/gluestack-ui-provider';
import { AuthProvider } from './src/contexts/AuthContext';

export default function App() {
  // 開発時の冗長な警告を抑止（根本対応は依存側の更新）
  LogBox.ignoreLogs(['SafeAreaView has been deprecated']);
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