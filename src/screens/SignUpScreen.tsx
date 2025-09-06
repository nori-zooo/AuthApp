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
    <Box className="flex-1 p-4 bg-white">
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