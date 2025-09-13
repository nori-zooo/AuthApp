import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../../src/screens/HomeScreen';
import ProfileScreen from '../../src/screens/ProfileScreen';
import AppsListScreen from '../../src/screens/AppsListScreen';
import MapScreen from '../../src/screens/MapScreen';
import SettingsScreen from '../../src/screens/SettingsScreen';
import TabIcon from '../components/ui/tab/TabIcon';
import type { AppsListStackParamList, RootTabParamList } from '../types/navigation';


const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<AppsListStackParamList>();

// AppsList + MapScreen のスタックナビゲーター
function AppsListStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        animation: 'slide_from_right', // 右からスライド
      }}
    >
      <Stack.Screen
        name="AppsList"
        component={AppsListScreen}
        options={{ title: 'アプリ一覧' }}
      />
      <Stack.Screen
        name="MapScreen"
        component={MapScreen}
        options={{ title: 'マップ画面' }}
      />
    </Stack.Navigator>
  );
}

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#f8f9fa', // ヘッダーの背景色
        },
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        tabBarStyle: {
          backgroundColor: '#ffffff', // タブバーの背景色
          borderTopWidth: 1,
          borderTopColor: '#e0e0e0',
        },
        tabBarActiveTintColor: '#007bff', // アクティブなタブの色
        tabBarInactiveTintColor: '#6c757d', // 非アクティブなタブの色
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerShown: true,
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="home" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerShown: true,
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="user" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="AppsListStack"
        component={AppsListStackNavigator}
        options={{
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="plug" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          headerShown: true,
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="settings" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
