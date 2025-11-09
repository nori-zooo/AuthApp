import React, { useMemo } from 'react';
import { ScrollView, useWindowDimensions } from 'react-native';
import { Svg, Rect, Line, Text as SvgText } from 'react-native-svg';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { Heading } from '@/components/ui/heading';
import { Card } from '@/components/ui/card';
import { Divider } from '@/components/ui/divider';

const salesData = [
  { month: '4月', lastYear: 820, thisYear: 940 },
  { month: '5月', lastYear: 780, thisYear: 910 },
  { month: '6月', lastYear: 860, thisYear: 1020 },
  { month: '7月', lastYear: 900, thisYear: 1130 },
  { month: '8月', lastYear: 970, thisYear: 1210 },
  { month: '9月', lastYear: 1020, thisYear: 1290 },
];

const LAST_YEAR_COLOR = '#94a3b8';
const THIS_YEAR_COLOR = '#2563eb';
const GRID_COLOR = '#d4d4d8';

const barChartConfig = {
  chartHeight: 240,
  chartPadding: 32,
  groupWidth: 72,
  barWidth: 22,
};

export default function GraphSampleScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const maxValue = useMemo(
    () => Math.max(...salesData.flatMap((item) => [item.lastYear, item.thisYear])),
    []
  );

  const chartWidth = Math.max(
    barChartConfig.groupWidth * salesData.length + barChartConfig.chartPadding * 2,
    windowWidth - 32
  );

  const scaleY = (value: number) => {
    if (maxValue === 0) return 0;
    return (
      (value / maxValue) * (barChartConfig.chartHeight - barChartConfig.chartPadding)
    );
  };

  const formatValue = (value: number) => `${value.toLocaleString('ja-JP')}万円`;

  const diffSummary = useMemo(() => {
    const totalLastYear = salesData.reduce((acc, cur) => acc + cur.lastYear, 0);
    const totalThisYear = salesData.reduce((acc, cur) => acc + cur.thisYear, 0);
    const diff = totalThisYear - totalLastYear;
    const rate = ((diff / totalLastYear) * 100).toFixed(1);
    return {
      totalLastYear,
      totalThisYear,
      diff,
      rate,
    };
  }, []);

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <VStack space="xl" className="pb-8">
        <Box>
          <Heading size="xl">売上グラフサンプル</Heading>
          <Text className="mt-2 text-typography-600">
            架空のカフェチェーンの月次売上（単位: 万円）を昨年度と今年度で比較したグラフです。
          </Text>
        </Box>

        <Card className="p-4">
          <VStack space="md">
            <Heading size="md">ポイント</Heading>
            <Text className="text-typography-600">
              今年度は夏以降のプロモーションが功を奏し、前年よりも安定して売上が伸びています。
            </Text>
            <Divider className="bg-gray-200" />
            <HStack className="items-center justify-start space-x-4">
              <HStack className="items-center space-x-2">
                <Box className="w-3 h-3 rounded-sm" style={{ backgroundColor: LAST_YEAR_COLOR }} />
                <Text className="text-typography-600">昨年度</Text>
              </HStack>
              <HStack className="items-center space-x-2">
                <Box className="w-3 h-3 rounded-sm" style={{ backgroundColor: THIS_YEAR_COLOR }} />
                <Text className="text-typography-600">今年度</Text>
              </HStack>
            </HStack>
          </VStack>
        </Card>

        <ScrollView
          horizontal
          contentContainerStyle={{ paddingVertical: 12 }}
          showsHorizontalScrollIndicator={false}
        >
          <Svg width={chartWidth} height={barChartConfig.chartHeight + 56}>
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y =
                barChartConfig.chartHeight -
                ratio * (barChartConfig.chartHeight - barChartConfig.chartPadding);
              const valueLabel = Math.round(maxValue * ratio);
              return (
                <React.Fragment key={`grid-${ratio}`}>
                  <Line
                    x1={barChartConfig.chartPadding - 4}
                    x2={chartWidth - barChartConfig.chartPadding / 2}
                    y1={y}
                    y2={y}
                    stroke={GRID_COLOR}
                    strokeDasharray={ratio === 0 ? undefined : '4 6'}
                    strokeWidth={1}
                  />
                  <SvgText
                    x={8}
                    y={y + 4}
                    fill="#6b7280"
                    fontSize={12}
                    fontWeight="500"
                  >
                    {valueLabel}
                  </SvgText>
                </React.Fragment>
              );
            })}

            {salesData.map((item, index) => {
              const groupX =
                barChartConfig.chartPadding + index * barChartConfig.groupWidth;
              const lastYearHeight = scaleY(item.lastYear);
              const thisYearHeight = scaleY(item.thisYear);

              const baseY = barChartConfig.chartHeight;

              return (
                <React.Fragment key={item.month}>
                  <Rect
                    x={groupX}
                    y={baseY - lastYearHeight}
                    width={barChartConfig.barWidth}
                    height={lastYearHeight}
                    fill={LAST_YEAR_COLOR}
                    rx={4}
                  />
                  <Rect
                    x={groupX + barChartConfig.barWidth + 8}
                    y={baseY - thisYearHeight}
                    width={barChartConfig.barWidth}
                    height={thisYearHeight}
                    fill={THIS_YEAR_COLOR}
                    rx={4}
                  />

                  <SvgText
                    x={groupX + barChartConfig.barWidth / 2}
                    y={baseY - lastYearHeight - 8}
                    fill={LAST_YEAR_COLOR}
                    fontSize={11}
                    fontWeight="600"
                    textAnchor="middle"
                  >
                    {item.lastYear}
                  </SvgText>
                  <SvgText
                    x={groupX + barChartConfig.barWidth + 8 + barChartConfig.barWidth / 2}
                    y={baseY - thisYearHeight - 8}
                    fill={THIS_YEAR_COLOR}
                    fontSize={11}
                    fontWeight="600"
                    textAnchor="middle"
                  >
                    {item.thisYear}
                  </SvgText>

                  <SvgText
                    x={groupX + barChartConfig.barWidth + 4}
                    y={baseY + 20}
                    fill="#374151"
                    fontSize={12}
                    fontWeight="600"
                    textAnchor="middle"
                  >
                    {item.month}
                  </SvgText>
                </React.Fragment>
              );
            })}
          </Svg>
        </ScrollView>

        <Card className="p-4">
          <VStack space="md">
            <Heading size="md">サマリー</Heading>
            <HStack className="justify-between">
              <Text className="text-typography-600">昨年度累計</Text>
              <Text className="font-semibold">{formatValue(diffSummary.totalLastYear)}</Text>
            </HStack>
            <HStack className="justify-between">
              <Text className="text-typography-600">今年度累計</Text>
              <Text className="font-semibold">{formatValue(diffSummary.totalThisYear)}</Text>
            </HStack>
            <Divider className="bg-gray-200" />
            <HStack className="justify-between">
              <Text className="text-typography-600">前年差分</Text>
              <Text className="font-semibold">
                {formatValue(diffSummary.diff)} ({diffSummary.rate}% 増)
              </Text>
            </HStack>
            <Text className="text-typography-600">
              夏以降は新メニューやテイクアウト施策が効果を上げ、前年よりも約{diffSummary.rate}% 成長しています。
            </Text>
          </VStack>
        </Card>
      </VStack>
    </ScrollView>
  );
}
