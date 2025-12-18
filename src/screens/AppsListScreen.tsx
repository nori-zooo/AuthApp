import React from 'react';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { Button, ButtonText } from '@/components/ui/button';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppsListStackParamList } from '@/app/types/navigation';

export default function AppsListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppsListStackParamList>>();

  return (
    <Box className="flex-1 p-4 bg-blue-50">
      <Text className="mb-4 text-xl font-bold">Apps List</Text>
      <Button
        onPress={() => navigation.navigate('MapScreen')}
        className="flex-row items-center justify-between w-full px-4 mt-4 bg-blue-200 border border-navy-800"
      >
        <ButtonText className="flex-1 text-lg text-left text-blue-600">🗺️マップで住所検索</ButtonText>
        <Text className="ml-4 text-lg text-blue-600">{'>'}</Text>
      </Button>

      <Button
        onPress={() => navigation.navigate('PartsSampleScreen')}
        className="flex-row items-center justify-between w-full px-4 mt-4 bg-blue-200 border border-navy-800"
      >
        <ButtonText className="flex-1 text-lg text-left text-blue-600">⚙️部品サンプル</ButtonText>
        <Text className="ml-4 text-lg text-blue-600">{'>'}</Text>
      </Button>

      <Button
        onPress={() => navigation.navigate('ImageUploadScreen')}
        className="flex-row items-center justify-between w-full px-4 mt-4 bg-blue-200 border border-navy-800"
      >
        <ButtonText className="flex-1 text-lg text-left text-blue-600">🖌️AI数学の先生（画像解析）</ButtonText>
        <Text className="ml-4 text-lg text-blue-600">{'>'}</Text>
      </Button>

      <Button
        onPress={() => navigation.navigate('MusicUploadScreen')}
        className="flex-row items-center justify-between w-full px-4 mt-4 bg-blue-200 border border-navy-800"
      >
        <ButtonText className="flex-1 text-lg text-left text-blue-600">♪AI音楽の先生（音声ファイル解析）</ButtonText>
        <Text className="ml-4 text-lg text-blue-600">{'>'}</Text>
      </Button>

      <Button
        onPress={() => navigation.navigate('GraphSampleScreen')}
        className="flex-row items-center justify-between w-full px-4 mt-4 bg-blue-200 border border-navy-800"
      >
        <ButtonText className="flex-1 text-lg text-left text-blue-600">📊売上グラフサンプル</ButtonText>
        <Text className="ml-4 text-lg text-blue-600">{'>'}</Text>
      </Button>

      <Button
        onPress={() => navigation.navigate('VictorySampleScreen')}
        className="flex-row items-center justify-between w-full px-4 mt-4 bg-blue-200 border border-navy-800"
      >
        <ButtonText className="flex-1 text-lg text-left text-blue-600">🏆Victoryグラフサンプル</ButtonText>
        <Text className="ml-4 text-lg text-blue-600">{'>'}</Text>
      </Button>
    </Box>
  );
}