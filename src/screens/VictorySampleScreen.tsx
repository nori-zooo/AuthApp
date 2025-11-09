import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { FontEdging, Skia } from '@shopify/react-native-skia';
import { Area, CartesianChart, Line, PolarChart, Pie, Scatter } from 'victory-native';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { Heading } from '@/components/ui/heading';
import { Card } from '@/components/ui/card';
import { Divider } from '@/components/ui/divider';

const categorySales = [
  { label: 'ドリップコーヒー', value: 420 },
  { label: 'エスプレッソ', value: 310 },
  { label: '季節限定', value: 260 },
  { label: 'スイーツ', value: 360 },
  { label: 'テイクアウト', value: 280 },
];

const temperatureSales = [
  { temperature: 6, sales: 180 },
  { temperature: 10, sales: 230 },
  { temperature: 14, sales: 290 },
  { temperature: 18, sales: 340 },
  { temperature: 22, sales: 410 },
  { temperature: 26, sales: 395 },
  { temperature: 30, sales: 360 },
];

const PIE_COLORS = ['#60a5fa', '#facc15', '#34d399', '#f97316', '#a78bfa'];

function formatSales(value: number) {
  return `${value.toLocaleString('ja-JP')}万円`;
}

function formatPercentage(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export default function VictorySampleScreen() {
  const { pieData, totalSales } = useMemo(() => {
    const total = categorySales.reduce((acc, cur) => acc + cur.value, 0);
    const enriched = categorySales.map((item, index) => ({
      ...item,
      color: PIE_COLORS[index % PIE_COLORS.length],
      ratio: total === 0 ? 0 : item.value / total,
    }));

    return { pieData: enriched, totalSales: total };
  }, []);

  const axisFont = useMemo(() => {
    try {
      const font = Skia.Font(undefined, 12);
      font.setEdging?.(FontEdging.SubpixelAntiAlias);
      return font;
    } catch (error) {
      return null;
    }
  }, []);

  const averageTemperature = useMemo(
    () =>
      (
        temperatureSales.reduce((acc, cur) => acc + cur.temperature, 0) /
        temperatureSales.length
      ).toFixed(1),
    []
  );

  const correlationSummary = useMemo(() => {
    const n = temperatureSales.length;
    if (n === 0) {
      return { r: 0, strongest: null as null | typeof temperatureSales[0] };
    }

    const meanTemp =
      temperatureSales.reduce((acc, cur) => acc + cur.temperature, 0) / n;
    const meanSales =
      temperatureSales.reduce((acc, cur) => acc + cur.sales, 0) / n;

    let numerator = 0;
    let sumSqTemp = 0;
    let sumSqSales = 0;
    temperatureSales.forEach((item) => {
      const tempDiff = item.temperature - meanTemp;
      const salesDiff = item.sales - meanSales;
      numerator += tempDiff * salesDiff;
      sumSqTemp += tempDiff ** 2;
      sumSqSales += salesDiff ** 2;
    });

    const denominator = Math.sqrt(sumSqTemp * sumSqSales) || 1;
    const r = numerator / denominator;

    const strongest = temperatureSales.reduce((prev, cur) =>
      !prev || cur.sales > prev.sales ? cur : prev
    );

    return { r, strongest };
  }, []);

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <VStack space="xl" className="pb-8">
        <Box>
          <Heading size="xl">Victory Native グラフサンプル</Heading>
          <Text className="mt-2 text-typography-600">
            Victory Native を使って、商品カテゴリー別の売上円グラフと、気温と売上の関係を散布図で可視化したサンプルです。
          </Text>
        </Box>

        <Card className="p-4">
          <VStack space="md">
            <Heading size="md">ライブラリについて</Heading>
            <Text className="text-typography-600">
              Victory Native は Victory の React Native 版です。宣言的な API で各種チャートを組み立てられ、SVG ベースなので細かなスタイル調整も可能です。
            </Text>
            <Divider className="bg-gray-200" />
            <Text className="text-typography-600">
              npm / yarn で `victory-native` と `react-native-svg` を追加すれば、Expo プロジェクトでもすぐ利用できます。
            </Text>
          </VStack>
        </Card>

        <Card className="p-4">
          <VStack space="md">
            <Heading size="lg">① 商品カテゴリーごとの売上（円グラフ）</Heading>
            <Text className="text-typography-600">
              架空カフェの月間売上（単位: 万円）をカテゴリ別に表した円グラフです。中心をくり抜いたドーナツ型にし、凡例を右側に配置しています。
            </Text>
            <Divider className="bg-gray-200" />
            <HStack className="items-stretch" space="lg">
              <Box className="flex-1">
                <View style={styles.pieContainer}>
                  <PolarChart
                    data={pieData}
                    labelKey="label"
                    valueKey="value"
                    colorKey="color"
                    containerStyle={{ height: 320 }}
                  >
                    <Pie.Chart innerRadius={80}>
                      {({ slice }) => (
                        <Pie.Slice
                          strokeWidth={1}
                          label={{
                            text: `${slice.label}\n${formatSales(slice.value)}`,
                            radiusOffset: -48,
                            color: '#1f2937',
                          }}
                        />
                      )}
                    </Pie.Chart>
                  </PolarChart>
                  <View style={styles.pieCenterOverlay} pointerEvents="none">
                    <Text className="text-xs text-typography-500">合計売上</Text>
                    <Text className="text-lg font-semibold text-typography-900">
                      {formatSales(totalSales)}
                    </Text>
                  </View>
                </View>
              </Box>
              <VStack space="md" className="justify-center">
                {pieData.map((item) => (
                  <HStack key={item.label} space="md" className="items-center">
                    <View
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        backgroundColor: item.color,
                      }}
                    />
                    <VStack space="xs">
                      <Text className="text-sm font-semibold text-typography-900">
                        {item.label}
                      </Text>
                      <Text className="text-xs text-typography-600">
                        {formatSales(item.value)}／{formatPercentage(item.ratio)}
                      </Text>
                    </VStack>
                  </HStack>
                ))}
              </VStack>
            </HStack>
            <Text className="text-sm text-typography-600">
              季節限定メニューは、夏のフルーツフェアに合わせて売上が伸びています。
            </Text>
          </VStack>
        </Card>

        <Card className="p-4">
          <VStack space="md">
            <Heading size="lg">② 気温と売上の関係（散布図）</Heading>
            <Text className="text-typography-600">
              週ごとの平均気温（℃）と売上（万円）の相関イメージです。緩やかな放物線状に動いており、暑すぎる日には売上が少し落ちる傾向が見られます。
            </Text>
            <Divider className="bg-gray-200" />
            <VStack space="md">
              <Box className="h-[320px] w-full">
                <CartesianChart
                  data={temperatureSales}
                  xKey="temperature"
                  yKeys={["sales"]}
                  padding={{ left: 56, right: 32, top: 32, bottom: 48 }}
                  domainPadding={{ left: 2, right: 2, top: 20, bottom: 20 }}
                  axisOptions={{
                    lineColor: 'rgba(55, 65, 81, 0.25)',
                    lineWidth: 1,
                    labelColor: '#4b5563',
                    ...(axisFont ? { font: axisFont } : {}),
                  }}
                  xAxis={{ font: axisFont ?? null, tickCount: 6, labelColor: '#4b5563' }}
                  yAxis={[
                    {
                      font: axisFont ?? null,
                      tickCount: 6,
                      labelColor: '#4b5563',
                      formatYLabel: (value) => `${value} 万円`,
                    },
                  ]}
                >
                  {({ points, chartBounds }) => (
                    <>
                      <Area
                        points={points.sales}
                        y0={chartBounds.bottom}
                        color="rgba(37, 99, 235, 0.18)"
                        curveType="natural"
                      />
                      <Line
                        points={points.sales}
                        color="#2563eb"
                        strokeWidth={2}
                        curveType="natural"
                      />
                      <Scatter
                        points={points.sales}
                        color="#f97316"
                        radius={6}
                      />
                    </>
                  )}
                </CartesianChart>
              </Box>
              <HStack className="justify-between">
                <Text className="text-xs font-medium text-typography-500">
                  平均気温 (℃)
                </Text>
                <Text className="text-xs font-medium text-typography-500">
                  売上 (万円)
                </Text>
              </HStack>
            </VStack>
            <Box>
              <Text className="text-sm text-typography-600">
                平均気温: {averageTemperature}℃／売上のピークは 22℃ 前後にあり、真夏日は冷たいドリンク中心の売上に変わることで全体額がやや下がる想定です。
              </Text>
              <Text className="mt-1 text-sm text-typography-600">
                相関係数 (r) ≒ {correlationSummary.r.toFixed(2)}。もっとも売上が高かった週は {correlationSummary.strongest?.temperature ?? '-'}℃・{formatSales(correlationSummary.strongest?.sales ?? 0)} でした。
              </Text>
            </Box>
          </VStack>
        </Card>
      </VStack>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pieContainer: {
    height: 320,
    position: 'relative',
  },
  pieCenterOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -72 }, { translateY: -28 }],
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.88)',
  },
});
