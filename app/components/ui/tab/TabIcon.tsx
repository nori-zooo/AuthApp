import React from 'react';
import { Home, User, Plug, Settings } from 'lucide-react-native';

type Props = {
  name: 'home' | 'user' | 'plug' | 'settings';
  color?: string;
  size?: number;
};

const iconMap: Record<Props['name'], React.ComponentType<{ color?: string; size?: number }>> = {
  home: Home,
  user: User,
  plug: Plug,
  settings: Settings,
};

export default function TabIcon({ name, color = '#333', size = 24 }: Props) {
  const Icon = iconMap[name];
  return <Icon color={color} size={size} />;
}
