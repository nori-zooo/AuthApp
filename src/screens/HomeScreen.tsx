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
    <Box className="flex-1 p-4 bg-background-100">
      <VStack space="xl" className="mt-6">
        {/* ヘッダー */}
        <HStack className="items-center justify-between">
          <VStack>
            <Heading size="xl">ようこそ！</Heading>
            <Text size="sm" className="text-typography-600">
              ログインが完了しました
            </Text>
          </VStack>
          <Avatar className="bg-indigo-600" size="lg">
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
              <Text className="text-typography-600">メールアドレス:</Text>
              <Text>{user?.email}</Text>
            </HStack>
            <HStack className="justify-between">
              <Text className="text-typography-600">ユーザーID:</Text>
              <Text className="text-sm">{user?.id}</Text>
            </HStack>
            <HStack className="justify-between">
              <Text className="text-typography-600">登録日時:</Text>
              <Text className="text-sm">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString('ja-JP') : '不明'}
              </Text>
            </HStack>
          </VStack>
        </Card>

        {/* アクション */}
        <VStack space="md">
          <Button variant="outline" className="w-full">
            <ButtonText>プロフィール編集</ButtonText>
          </Button>

          <Button variant="outline" className="w-full">
            <ButtonText>設定</ButtonText>
          </Button>

          <Button
            action="negative"
            variant="outline"
            onPress={handleSignOut}
            className="w-full"
          >
            <ButtonText>ログアウト</ButtonText>
          </Button>
        </VStack>
      </VStack>
    </Box>
  );
};

export default HomeScreen;