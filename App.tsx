import './global.css';

import React from 'react';
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";

import { AuthProvider } from './src/contexts/AuthContext';
import AppNavigator from './app/navigation';

export default function App() {
  return (
    <GluestackUIProvider>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </GluestackUIProvider>
  );
}