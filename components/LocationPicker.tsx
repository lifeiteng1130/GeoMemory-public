import React, { useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Alert, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import MapAdjuster from './MapAdjuster';

// ⚠️ 替换为你自己的高德 API Key（免费申请：https://lbs.amap.com）
const AMAP_KEY: string = 'xxxxx';

interface LocationPickerProps {
  latitude: number;
  longitude: number;
  placeName: string;
  onLocationChange: (lat: number, lng: number, name: string) => void;
}

interface SearchResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

// 离线城市库（高德 API 不可用时的降级方案）
const CITIES: Record<string, [number, number]> = {
  '北京': [39.9042, 116.4074], 'beijing': [39.9042, 116.4074],
  '上海': [31.2304, 121.4737], 'shanghai': [31.2304, 121.4737],
  '广州': [23.1291, 113.2644], 'guangzhou': [23.1291, 113.2644],
  '深圳': [22.5431, 114.0579], 'shenzhen': [22.5431, 114.0579],
  '杭州': [30.2741, 120.1551], 'hangzhou': [30.2741, 120.1551],
  '成都': [30.5728, 104.0668], 'chengdu': [30.5728, 104.0668],
  '西安': [34.3416, 108.9398], "xi'an": [34.3416, 108.9398],
  '重庆': [29.4316, 106.9123], 'chongqing': [29.4316, 106.9123],
  '武汉': [30.5928, 114.3055], 'wuhan': [30.5928, 114.3055],
  '南京': [32.0603, 118.7969], 'nanjing': [32.0603, 118.7969],
  '厦门': [24.4798, 118.0894], 'xiamen': [24.4798, 118.0894],
  '大理': [25.6065, 100.2676], 'dali': [25.6065, 100.2676],
  '拉萨': [29.65, 91.1], 'lhasa': [29.65, 91.1],
  '东京': [35.6762, 139.6503], 'tokyo': [35.6762, 139.6503],
  '首尔': [37.5665, 126.978], 'seoul': [37.5665, 126.978],
  '纽约': [40.7128, -74.006], 'new york': [40.7128, -74.006],
  '伦敦': [51.5074, -0.1278], 'london': [51.5074, -0.1278],
  '巴黎': [48.8566, 2.3522], 'paris': [48.8566, 2.3522],
  '悉尼': [-33.8688, 151.2093], 'sydney': [-33.8688, 151.2093],
};

async function searchWithAmap(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://restapi.amap.com/v3/geocode/geo?address=${encodeURIComponent(query)}&key=${AMAP_KEY}&output=json`;
    const resp = await fetch(url);
    const data = await resp.json();

    if (data.status === '1' && data.geocodes?.length > 0) {
      return data.geocodes.slice(0, 5).map((g: any) => {
        const [lng, lat] = g.location.split(',').map(Number);
        return {
          name: g.formatted_address || g.name,
          address: g.district || '',
          lat: lat,
          lng: lng,
        };
      });
    }
    return [];
  } catch (e) {
    console.log('[LocationPicker] searchWithAmap error:', String(e));
    return [];
  }
}

function searchOffline(query: string): SearchResult[] {
  const key = query.toLowerCase().trim();
  const results: SearchResult[] = [];
  for (const [name, coords] of Object.entries(CITIES)) {
    if (key === name || key === name.toLowerCase()) {
      results.push({ name: query, address: '', lat: coords[0], lng: coords[1] });
    }
  }
  return results;
}

export default function LocationPicker({
  latitude,
  longitude,
  placeName,
  onLocationChange,
}: LocationPickerProps) {
  const [searchText, setSearchText] = useState('');
  const [latText, setLatText] = useState(latitude ? String(latitude) : '');
  const [lngText, setLngText] = useState(longitude ? String(longitude) : '');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedName, setSelectedName] = useState(placeName || '');
  const [showAdjuster, setShowAdjuster] = useState(false);

  // Sync when props change (e.g., EXIF auto-fill)
  useEffect(() => {
    if (latitude !== 0 || longitude !== 0) {
      setLatText(String(latitude));
      setLngText(String(longitude));
      if (placeName && !selectedName) {
        setSelectedName(placeName);
      }
    }
  }, [latitude, longitude, placeName]);

  const handleSearch = async () => {
    const query = searchText.trim();
    if (!query) return;

    setSearching(true);
    setShowResults(true);

    try {
      if (AMAP_KEY !== 'YOUR_AMAP_KEY_HERE') {
        const amapResults = await searchWithAmap(query);
        if (amapResults.length > 0) {
          setResults(amapResults);
          setSearching(false);
          return;
        }
      }

      const offlineResults = searchOffline(query);
      if (offlineResults.length > 0) {
        setResults(offlineResults);
      } else {
        setResults([]);
        Alert.alert('未找到', '请尝试其他关键词，或手动输入坐标');
      }
    } catch (e) {
      console.log('[LocationPicker] handleSearch error:', String(e));
      const offlineResults = searchOffline(query);
      if (offlineResults.length > 0) {
        setResults(offlineResults);
      } else {
        setResults([]);
        Alert.alert('未找到', '请尝试其他关键词，或手动输入坐标');
      }
    } finally {
      setSearching(false);
    }
  };

  const selectResult = (item: SearchResult) => {
    console.log('[LocationPicker] selectResult:', item.lat, item.lng, item.name);
    setLatText(String(item.lat.toFixed(6)));
    setLngText(String(item.lng.toFixed(6)));
    setSelectedName(item.name);
    onLocationChange(item.lat, item.lng, item.name);
    setShowResults(false);
    setResults([]);
    setSearchText('');
  };

  const handleGetCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('权限不足', '需要定位权限才能获取当前位置');
        return;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        Alert.alert('定位服务已关闭', '请在系统设置中开启定位服务后重试', [
          { text: '确定' },
          { text: '手动输入', onPress: () => {} },
        ]);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude: lat, longitude: lng } = loc.coords;
      setLatText(String(lat.toFixed(6)));
      setLngText(String(lng.toFixed(6)));

      // Reverse geocode via Amap
      try {
        const url = `https://restapi.amap.com/v3/geocode/regeo?location=${lng},${lat}&key=${AMAP_KEY}&output=json`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (data.status === '1' && data.regeocode) {
          const place = data.regeocode.formatted_address || data.regeocode.addressComponent?.district || '';
          const name = place || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
          setSelectedName(name);
          onLocationChange(lat, lng, name);
          return;
        }
      } catch {}

      const name = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      setSelectedName(name);
      onLocationChange(lat, lng, name);
    } catch (e) {
      Alert.alert('定位失败', String(e));
    }
  };

  const handleManualInput = () => {
    const lat = parseFloat(latText);
    const lng = parseFloat(lngText);
    if (isNaN(lat) || isNaN(lng)) {
      Alert.alert('格式错误', '请输入有效的数字坐标');
      return;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      Alert.alert('范围错误', '纬度 -90~90，经度 -180~180');
      return;
    }
    setSelectedName(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    onLocationChange(lat, lng, `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
  };

  return (
    <View style={styles.container}>
      {/* 搜索框 */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="搜索地名（如：北京故宫、西湖）"
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={searchText}
          onChangeText={(t) => { setSearchText(t); setShowResults(false); }}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.locateBtn} onPress={handleGetCurrentLocation}>
          <Text style={styles.locateBtnText}>⊕</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={searching}>
          <Text style={styles.searchBtnText}>{searching ? '...' : '搜索'}</Text>
        </TouchableOpacity>
      </View>

      {/* 搜索结果列表 */}
      {showResults && results.length > 0 && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsHint}>请点击选择一个地点 ↓</Text>
          <ScrollView
            style={styles.resultsScroll}
            nestedScrollEnabled
            showsVerticalScrollIndicator
          >
            {results.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.resultItem}
                onPress={() => selectResult(item)}
                activeOpacity={0.6}
              >
                <Text style={styles.resultName}>{item.name}</Text>
                {item.address ? <Text style={styles.resultAddr}>{item.address}</Text> : null}
                <Text style={styles.resultCoord}>{item.lat.toFixed(6)}, {item.lng.toFixed(6)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {showResults && results.length === 0 && !searching && (
        <View style={styles.noResultsContainer}>
          <Text style={styles.noResultsText}>未找到结果，请尝试其他关键词或手动输入坐标</Text>
        </View>
      )}

      {/* 微调按钮 */}
      {(parseFloat(latText) !== 0 || parseFloat(lngText) !== 0) && (
        <TouchableOpacity style={styles.adjustBtn} onPress={() => setShowAdjuster(true)}>
          <Text style={styles.adjustBtnText}>📍 在地图上微调位置</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.orText}>或手动输入坐标</Text>

      {/* 手动输入 */}
      <View style={styles.coordRow}>
        <View style={styles.coordField}>
          <Text style={styles.coordLabel}>纬度</Text>
          <TextInput
            style={styles.coordInput}
            placeholder="-90 ~ 90"
            placeholderTextColor="#bbb"
            value={latText}
            onChangeText={setLatText}
            keyboardType="numeric"
          />
        </View>
        <View style={styles.coordField}>
          <Text style={styles.coordLabel}>经度</Text>
          <TextInput
            style={styles.coordInput}
            placeholder="-180 ~ 180"
            placeholderTextColor="#bbb"
            value={lngText}
            onChangeText={setLngText}
            keyboardType="numeric"
          />
        </View>
        <TouchableOpacity style={styles.confirmBtn} onPress={handleManualInput}>
          <Text style={styles.confirmBtnText}>确定</Text>
        </TouchableOpacity>
      </View>

      {/* 已选位置 */}
      {selectedName ? (
        <View style={styles.locationDisplay}>
          <Text style={styles.locationText}>📍 {selectedName}</Text>
        </View>
      ) : null}

      <MapAdjuster
        visible={showAdjuster}
        latitude={parseFloat(latText) || 0}
        longitude={parseFloat(lngText) || 0}
        onConfirm={(lat, lng) => {
          setLatText(String(lat.toFixed(6)));
          setLngText(String(lng.toFixed(6)));
          // Keep original place name, just update coordinates
          const name = selectedName || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
          onLocationChange(lat, lng, name);
          setShowAdjuster(false);
        }}
        onCancel={() => setShowAdjuster(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchInput: {
    flex: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, backgroundColor: 'rgba(255,255,255,0.06)', color: '#fff',
  },
  locateBtn: {
    backgroundColor: 'rgba(0,122,255,0.12)',
    paddingHorizontal: 12, borderRadius: 10, justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(0,122,255,0.2)',
  },
  locateBtnText: { color: '#64b5f6', fontSize: 20, fontWeight: '600', marginTop: -1 },
  searchBtn: {
    backgroundColor: '#007AFF', paddingHorizontal: 16, borderRadius: 10, justifyContent: 'center',
  },
  searchBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  resultsContainer: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden',
  },
  resultsScroll: {
    maxHeight: 200,
  },
  resultsHint: {
    fontSize: 12, color: '#64b5f6', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 4, fontWeight: '600',
  },
  resultItem: {
    paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  resultName: { fontSize: 15, fontWeight: '600', color: '#fff' },
  resultAddr: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  resultCoord: { fontSize: 11, color: '#64b5f6', marginTop: 2 },
  noResultsContainer: {
    backgroundColor: 'rgba(255,193,7,0.1)', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: 'rgba(255,193,7,0.2)',
  },
  noResultsText: { fontSize: 13, color: '#ffc107' },
  orText: { textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13, marginVertical: 4 },
  coordRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  coordField: { flex: 1 },
  coordLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 },
  coordInput: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: 'rgba(255,255,255,0.06)', color: '#fff',
  },
  confirmBtn: {
    backgroundColor: '#34C759', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, justifyContent: 'center',
  },
  confirmBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  locationDisplay: {
    paddingVertical: 6, paddingHorizontal: 10, backgroundColor: 'rgba(0,122,255,0.15)', borderRadius: 8,
  },
  locationText: { fontSize: 14, color: '#64b5f6', fontWeight: '500' },
  adjustBtn: {
    backgroundColor: 'rgba(0,122,255,0.12)',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,122,255,0.2)',
  },
  adjustBtnText: { color: '#64b5f6', fontSize: 14, fontWeight: '600' },
});
