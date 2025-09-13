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
        className="flex-row items-center justify-center mt-4 bg-blue-200 border border-navy-800"
      >
        <ButtonText className="mr-2 text-lg text-blue-600">マップ画面に移動</ButtonText>
        <Text className="text-lg text-blue-600">{'>'}</Text>
      </Button>
    </Box>
  );
}