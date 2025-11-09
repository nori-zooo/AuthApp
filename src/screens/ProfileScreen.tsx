import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Keyboard, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonText } from '@/components/ui/button';
import { Alert, AlertIcon, AlertText } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { InfoIcon } from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function ProfileScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  // Profile fields
  const initialName = useMemo(() => {
    const meta = (user?.user_metadata ?? {}) as Record<string, any>;
    return (meta.full_name || meta.name || '') as string;
  }, [user?.user_metadata]);

  const [displayName, setDisplayName] = useState<string>(initialName);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string>('');
  const [profileErr, setProfileErr] = useState<string>('');

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPass, setChangingPass] = useState(false);
  const [passMsg, setPassMsg] = useState<string>('');
  const [passErr, setPassErr] = useState<string>('');

  const email = user?.email ?? '';

  const handleSaveProfile = async () => {
    Keyboard.dismiss();
    setProfileMsg('');
    setProfileErr('');
    setSavingProfile(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: displayName },
      });
      if (error) throw error;
      setProfileMsg('プロフィールを更新しました');
    } catch (e: any) {
      setProfileErr(e?.message ?? 'プロフィールの更新に失敗しました');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    Keyboard.dismiss();
    setPassMsg('');
    setPassErr('');

    if (!email) {
      setPassErr('ログイン情報を取得できませんでした');
      return;
    }
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPassErr('現在のパスワード・新しいパスワード・確認用をすべて入力してください');
      return;
    }
    if (newPassword.length < 6) {
      setPassErr('新しいパスワードは6文字以上で入力してください');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassErr('確認用パスワードが一致しません');
      return;
    }

    setChangingPass(true);
    try {
      // セキュリティ的に、パスワード変更前に現在のパスワードで再認証しておく
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (signInError) throw signInError;

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setPassMsg('パスワードを変更しました');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      setPassErr(e?.message ?? 'パスワードの変更に失敗しました');
    } finally {
      setChangingPass(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 24 }}
      >
        <Box className="flex-1 p-4 bg-yellow-50">
          <VStack space="xl" className="mt-6">
            <Heading size="xl">プロフィール</Heading>

            <Card className="p-4 border rounded-lg border-outline-200">
              <VStack space="md">
                <Text className="text-text-light-600">メールアドレス（読み取り専用）</Text>
                <Input isDisabled>
                  <InputField value={email} editable={false} />
                </Input>

                <Text className="text-text-light-600">表示名</Text>
                <Input>
                  <InputField
                    placeholder="表示名"
                    value={displayName}
                    onChangeText={setDisplayName}
                  />
                </Input>

                <Box className="min-h-12">
                  {profileErr ? (
                    <Alert action="error" variant="solid">
                      <AlertIcon as={InfoIcon} className="mr-3" />
                      <AlertText>{profileErr}</AlertText>
                    </Alert>
                  ) : profileMsg ? (
                    <Alert action="success" variant="solid">
                      <AlertIcon as={InfoIcon} className="mr-3" />
                      <AlertText>{profileMsg}</AlertText>
                    </Alert>
                  ) : null}
                </Box>

                <HStack className="justify-end">
                  <Button
                    onPress={handleSaveProfile}
                    isDisabled={savingProfile}
                    size="lg"
                    variant="outline"
                    className="bg-yellow-200 data-[hover=true]:bg-yellow-300 data-[active=true]:bg-yellow-400 border"
                    accessibilityRole="button"
                  >
                    <ButtonText>
                      {savingProfile ? '保存中…' : 'プロフィールを保存'}
                    </ButtonText>
                  </Button>
                </HStack>
              </VStack>
            </Card>

            <Heading size="lg">パスワードの変更</Heading>
            <Card className="p-4 border rounded-lg border-outline-200">
              <VStack space="md">
                <Text className="text-text-light-600">現在のパスワード</Text>
                <Input>
                  <InputField
                    placeholder="現在のパスワード"
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    secureTextEntry
                  />
                </Input>

                <Text className="text-text-light-600">新しいパスワード</Text>
                <Input>
                  <InputField
                    placeholder="新しいパスワード（6文字以上）"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                  />
                </Input>

                <Text className="text-text-light-600">新しいパスワード（確認）</Text>
                <Input>
                  <InputField
                    placeholder="新しいパスワード（確認）"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                  />
                </Input>

                <Box className="min-h-12">
                  {passErr ? (
                    <Alert action="error" variant="solid">
                      <AlertIcon as={InfoIcon} className="mr-3" />
                      <AlertText>{passErr}</AlertText>
                    </Alert>
                  ) : passMsg ? (
                    <Alert action="success" variant="solid">
                      <AlertIcon as={InfoIcon} className="mr-3" />
                      <AlertText>{passMsg}</AlertText>
                    </Alert>
                  ) : null}
                </Box>

                <HStack className="justify-end">
                  <Button
                    onPress={handleChangePassword}
                    isDisabled={changingPass}
                    size="lg"
                    variant="outline"
                    className="bg-yellow-200 data-[hover=true]:bg-yellow-300 data-[active=true]:bg-yellow-400 border"
                    accessibilityRole="button"
                  >
                    <ButtonText>
                      {changingPass ? '変更中…' : 'パスワードを変更'}
                    </ButtonText>
                  </Button>
                </HStack>
              </VStack>
            </Card>
          </VStack>
        </Box>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
