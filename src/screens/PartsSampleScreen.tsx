import React, { useMemo, useState } from 'react';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { Button, ButtonText } from '@/components/ui/button';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppsListStackParamList } from '@/app/types/navigation';
import { Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';

type Props = NativeStackScreenProps<AppsListStackParamList, 'PartsSampleScreen'>;

export default function PartsSampleScreen({ navigation }: Props) {
  // 初期値は今日
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState<number>(today.getFullYear());
  const [month, setMonth] = useState<number>(today.getMonth() + 1); // 1-12
  const [day, setDay] = useState<number>(today.getDate());
  const [showPicker, setShowPicker] = useState<boolean>(false); // （未使用・削除可）Android モーダル制御

  // ラジオ: あり/なし
  const [hasOption, setHasOption] = useState<boolean>(false);

  // チェック: 四季
  const [seasons, setSeasons] = useState({
    spring: false,
    summer: false,
    autumn: false,
    winter: false,
  });

  const currentDate = useMemo(() => new Date(year, month - 1, day), [year, month, day]);

  // 日数の調整
  const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
  const clampDay = (y: number, m: number, d: number) => Math.min(d, daysInMonth(y, m));

  const selectHasOption = (value: boolean) => {
    setHasOption(value);
    if (!value) {
      // なしに切り替えたらチェックはクリア
      setSeasons({ spring: false, summer: false, autumn: false, winter: false });
    }
  };

  const toggleSeason = (key: keyof typeof seasons) => {
    if (!hasOption) return;
    setSeasons((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const radioBtnClass = (selected: boolean) =>
    `border ${selected ? 'bg-green-200 data-[hover=true]:bg-green-300 data-[active=true]:bg-green-400' : 'bg-transparent data-[hover=true]:bg-background-50 data-[active=true]:bg-transparent'}`;

  const seasonBtnClass = (selected: boolean, disabled: boolean) => {
    const base = 'border';
    const bg = selected
      ? 'bg-blue-200 data-[hover=true]:bg-blue-300 data-[active=true]:bg-blue-400'
      : 'bg-transparent data-[hover=true]:bg-background-50 data-[active=true]:bg-transparent';
    const state = disabled ? ' opacity-40' : '';
    return `${base} ${bg}${state}`;
  };

  return (
    <Box className="flex-1 p-4 bg-green-50">
      <Text className="mb-4 text-xl font-bold">部品サンプル</Text>

      {/* 年月日セレクター（左から 年・月・日、全て数値のホイール） */}
      <Box className="mb-6">
        <Text className="mb-2 text-lg font-semibold">日付の選択（年・月・日）</Text>
        <Box className="flex-row gap-3">
          {/* 年 */}
          <Box className="flex-1 bg-white border rounded">
            <Picker
              selectedValue={year}
              onValueChange={(v: number) => {
                const nextDay = clampDay(v, month, day);
                setYear(v);
                setDay(nextDay);
              }}
            >
              {Array.from({ length: 201 }, (_, i) => 1900 + i).map((y) => (
                <Picker.Item key={y} label={`${y}`} value={y} />
              ))}
            </Picker>
          </Box>
          {/* 月 */}
          <Box className="w-24 bg-white border rounded">
            <Picker
              selectedValue={month}
              onValueChange={(m: number) => {
                const nextDay = clampDay(year, m, day);
                setMonth(m);
                setDay(nextDay);
              }}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <Picker.Item key={m} label={`${m}`} value={m} />
              ))}
            </Picker>
          </Box>
          {/* 日 */}
          <Box className="w-24 bg-white border rounded">
            <Picker
              selectedValue={day}
              onValueChange={(d: number) => setDay(d)}
            >
              {Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1).map(
                (d) => (
                  <Picker.Item key={d} label={`${d}`} value={d} />
                )
              )}
            </Picker>
          </Box>
        </Box>
        <Text className="mt-2 text-base">{`${year}年${month}月${day}日`}</Text>
      </Box>

      {/* ラジオ: あり / なし */}
      <Box className="mb-6">
        <Text className="mb-2 text-lg font-semibold">ラジオ（あり / なし）</Text>
        <Box className="flex-row gap-3">
          <Button
            variant="outline"
            className={radioBtnClass(hasOption)}
            onPress={() => selectHasOption(true)}
          >
            <ButtonText className="text-green-700">あり</ButtonText>
          </Button>
          <Button
            variant="outline"
            className={radioBtnClass(!hasOption)}
            onPress={() => selectHasOption(false)}
          >
            <ButtonText className="text-green-700">なし</ButtonText>
          </Button>
        </Box>
      </Box>

      {/* チェック: 春 夏 秋 冬 */}
      <Box className="mb-8">
        <Text className="mb-2 text-lg font-semibold">チェック（四季）</Text>
        <Box className="flex-row flex-wrap gap-3">
          <Button
            variant="outline"
            disabled={!hasOption}
            className={seasonBtnClass(seasons.spring, !hasOption)}
            onPress={() => toggleSeason('spring')}
          >
            <ButtonText>春 ☘️</ButtonText>
          </Button>
          <Button
            variant="outline"
            disabled={!hasOption}
            className={seasonBtnClass(seasons.summer, !hasOption)}
            onPress={() => toggleSeason('summer')}
          >
            <ButtonText>夏 ☀️</ButtonText>
          </Button>
          <Button
            variant="outline"
            disabled={!hasOption}
            className={seasonBtnClass(seasons.autumn, !hasOption)}
            onPress={() => toggleSeason('autumn')}
          >
            <ButtonText>秋 🍂</ButtonText>
          </Button>
          <Button
            variant="outline"
            disabled={!hasOption}
            className={seasonBtnClass(seasons.winter, !hasOption)}
            onPress={() => toggleSeason('winter')}
          >
            <ButtonText>冬 ⛄️</ButtonText>
          </Button>
        </Box>
      </Box>

      {/* 戻る */}
      <Button
        onPress={() => navigation.goBack()}
        variant="outline"
        className="flex-row items-center justify-center border bg-green-200 data-[hover=true]:bg-green-300 data-[active=true]:bg-green-400"
      >
        <ButtonText className="text-green-700">戻る</ButtonText>
      </Button>
    </Box>
  );
}
