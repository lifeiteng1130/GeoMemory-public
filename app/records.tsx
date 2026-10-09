import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { useRouter, useFocusEffect, useNavigation } from 'expo-router';
import { getMemories, MemoryWithImages } from '../lib/database';
import { getFullPath } from '../lib/storage';

export default function RecordsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const [memories, setMemories] = useState<MemoryWithImages[]>([]);

  useEffect(() => {
    navigation.setOptions({ title: '所有记录' });
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMemories();
    }, [])
  );

  const loadMemories = async () => {
    try {
      const data = await getMemories();
      setMemories(data);
    } catch (e) {
      console.error('Failed to load memories:', e);
    }
  };

  const formatDate = (dt: string | null) => {
    if (!dt) return '未知时间';
    return dt;
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={memories}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/detail/${item.id}`)}
          >
            {item.images.length > 0 ? (
              <Image
                source={{ uri: getFullPath(item.images[0].file_path) }}
                style={styles.thumb}
              />
            ) : (
              <View style={[styles.thumb, styles.thumbPlaceholder]}>
                <Text style={styles.thumbPlaceholderText}>无图</Text>
              </View>
            )}
            <View style={styles.cardInfo}>
              <Text style={styles.cardPlace} numberOfLines={1}>
                {item.place_name || `${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}`}
              </Text>
              <Text style={styles.cardTime}>{formatDate(item.date_time)}</Text>
              {item.content ? (
                <Text style={styles.cardContent} numberOfLines={2}>
                  {item.content}
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>暂无记录</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a1a',
  },
  list: {
    padding: 12,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  thumbPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbPlaceholderText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  cardPlace: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  cardTime: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  cardContent: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },
  empty: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.3)',
    fontSize: 16,
    marginTop: 60,
  },
});
