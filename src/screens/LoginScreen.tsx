import React, { useState } from 'react';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonText } from '@/components/ui/button';
import { Alert, AlertIcon, AlertText } from '@/components/ui/alert';
import { InfoIcon } from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';

const LoginScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { signIn } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      setError('メールアドレスとパスワードを入力してください');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await signIn(email, password);
    } catch (error: any) {
      setError(error.message || 'ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box className="flex-1 p-4 bg-white">
      <VStack space="lg" className="mt-10">
        <Text size="2xl" className="font-bold text-center">ログイン</Text>

        {error ? (
          <Alert action="error" variant="solid" className="mx-2.5">
            <AlertIcon as={InfoIcon} className="mr-3" />
            <AlertText>{error}</AlertText>
          </Alert>
        ) : null}

        <Input className="w-full">
          <InputField
            placeholder="メールアドレス"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </Input>

        <Input className="w-full">
          <InputField
            placeholder="パスワード"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </Input>

        <Button
          onPress={handleLogin}
          isDisabled={loading}
          className={loading ? 'opacity-60' : ''}
        >
          <ButtonText>{loading ? 'ログイン中...' : 'ログイン'}</ButtonText>
        </Button>

        <Button variant="link" onPress={() => navigation.navigate('SignUp')} className="mt-2">
          <ButtonText>アカウントを作成</ButtonText>
        </Button>
      </VStack>
    </Box>
  );
};

export default LoginScreen;