import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../../src/screens/LoginScreen';
import SignUpScreen from '../../src/screens/SignUpScreen';

const Stack = createNativeStackNavigator();

export default function AuthStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'ログイン' }} />
      <Stack.Screen name="SignUp" component={SignUpScreen} options={{ title: 'アカウント作成' }} />
    </Stack.Navigator>
  );
}
