import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TextInput, Button, Alert } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';

const MapScreen: React.FC = () => {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  // 検索バーに入力された住所文字列を保持する
  const [searchQuery, setSearchQuery] = useState('');
  // MapView 上に表示する検索先の座標（未検索時は null）
  const [markerCoords, setMarkerCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    (async () => {
      // 初回レンダリング時に位置情報の利用許可をリクエスト
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.error('位置情報のアクセスが許可されていません');
        return;
      }

      // 許可が得られたら端末の現在地を取得して state に保存
      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
    })();
  }, []);

  const handleSearch = async () => {
    // 入力チェック：空のまま検索しようとした場合は警告を表示
    if (!searchQuery) {
      Alert.alert('エラー', '住所を入力してください');
      return;
    }

    try {
      // OpenStreetMap Nominatim API を用いて住所をジオコーディング（緯度経度の取得）
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`
      );
      const data = await response.json();

      // 1件もヒットしなかった場合はユーザーに通知
      if (data.length === 0) {
        Alert.alert('エラー', '住所が見つかりませんでした');
        return;
      }

      const { lat, lon } = data[0];
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lon);

      setMarkerCoords({ latitude, longitude });

      // 地図を移動
      if (location) {
        // MapView の region 更新のため、現在地 state を検索結果の座標で上書き
        setLocation({
          ...location,
          coords: {
            latitude,
            longitude,
            altitude: 0,
            accuracy: 0,
            altitudeAccuracy: null,
            heading: null,
            speed: 0,
          },
        });
      }
    } catch (error) {
      console.error('住所検索中にエラーが発生しました:', error);
      Alert.alert('エラー', '住所検索中に問題が発生しました');
    }
  };

  return (
    <View style={styles.container}>
      {/* 検索バー */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="住所を入力"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <Button title="検索" onPress={handleSearch} />
      </View>

      {/* 地図 */}
      {location && (
        <MapView
          style={styles.map}
          // 画面初期表示時の中心位置（現在地）
          initialRegion={{
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          // 検索後はマーカー座標を region に渡して地図を移動させる
          region={
            markerCoords
              ? {
                  latitude: markerCoords.latitude,
                  longitude: markerCoords.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }
              : undefined
          }
        >
          {/* 現在地のマーカー */}
          <Marker
            // 現在位置を青ピンとして表示
            coordinate={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            }}
            title="現在地"
          />

          {/* 検索結果のマーカー */}
          {markerCoords && (
            <Marker
              // ユーザーが検索した地点を別ピンで表示
              coordinate={markerCoords}
              title="検索結果"
            />
          )}
        </MapView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 5,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  searchInput: {
    flex: 1,
    height: 40,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    paddingHorizontal: 10,
  },
  map: {
    flex: 1,
  },
});

export default MapScreen;