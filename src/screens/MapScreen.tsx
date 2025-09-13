import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TextInput, Button, Alert } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';

const MapScreen: React.FC = () => {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [searchQuery, setSearchQuery] = useState(''); // 検索クエリ
  const [markerCoords, setMarkerCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.error('位置情報のアクセスが許可されていません');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
    })();
  }, []);

  const handleSearch = async () => {
    if (!searchQuery) {
      Alert.alert('エラー', '住所を入力してください');
      return;
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`
      );
      const data = await response.json();

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
          initialRegion={{
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
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
            coordinate={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            }}
            title="現在地"
          />

          {/* 検索結果のマーカー */}
          {markerCoords && (
            <Marker
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