import React from 'react';
import { Home, User, Settings } from 'lucide-react-native';

type Props = {
  name: 'home' | 'user' | 'settings';
  color?: string;
  size?: number;
};

const iconMap: Record<Props['name'], React.ComponentType<{ color?: string; size?: number }>> = {
  home: Home,
  user: User,
  settings: Settings,
};

export default function TabIcon({ name, color = '#333', size = 24 }: Props) {
  const Icon = iconMap[name];
  return <Icon color={color} size={size} />;
}
