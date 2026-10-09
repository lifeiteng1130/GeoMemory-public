import React, { useCallback, useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Dimensions, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Earth from '../components/Earth';
import MemoryCard from '../components/MemoryCard';
import { getMemories, MemoryWithImages } from '../lib/database';
import { exportBackup, importBackup } from '../lib/export';

const { width, height } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const [memories, setMemories] = useState<MemoryWithImages[]>([]);
  const [selectedMemory, setSelectedMemory] = useState<MemoryWithImages | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapLayer, setMapLayer] = useState('standard');

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
    } finally {
      setLoading(false);
    }
  };

  const handlePointPress = (id: string) => {
    const mem = memories.find((m) => m.id === id);
    if (mem) setSelectedMemory(mem);
  };

  const handleExport = async () => {
    try {
      await exportBackup();
    } catch (e) {
      console.error('Export failed:', e);
    }
  };

  const handleImport = async () => {
    try {
      const result = await importBackup();
      if (result.skipped > 0) {
        Alert.alert('导入完成', `新增 ${result.imported} 条，跳过重复 ${result.skipped} 条`, [
          { text: '确定', onPress: () => loadMemories() },
        ]);
      } else if (result.imported > 0) {
        Alert.alert('导入成功', `已合并 ${result.imported} 条记录`, [
          { text: '确定', onPress: () => loadMemories() },
        ]);
      } else {
        Alert.alert('提示', '没有可导入的数据');
      }
    } catch (e) {
      Alert.alert('导入失败', String(e));
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 3D Earth */}
      <View style={styles.earthContainer}>
        <Earth memories={memories} onPointPress={handlePointPress} onLayerChange={setMapLayer} />
      </View>

      {/* Title */}
      <View style={styles.titleContainer}>
        <Text style={[styles.title, { color: mapLayer === 'standard' ? '#1a3a5c' : '#fff' }]}>Our Memories</Text>
        <Text style={[styles.subtitle, mapLayer === 'standard' && { color: 'rgba(0,0,0,0.5)' }]}>
          我们的记忆 · {memories.length}
        </Text>
      </View>

      {/* Memory Card Preview */}
      {selectedMemory && (
        <MemoryCard
          memory={selectedMemory}
          onPress={() => {
            setSelectedMemory(null);
            router.push(`/detail/${selectedMemory.id}`);
          }}
          onClose={() => setSelectedMemory(null)}
        />
      )}

      {/* Action Buttons */}
      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.pillBtn, mapLayer === 'standard' ? styles.pillBtnStandard : styles.pillBtnDark]}
          onPress={handleExport}
        >
          <Text style={[styles.pillBtnText, mapLayer === 'standard' && styles.pillBtnTextStandard]}>导出</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.pillBtn, mapLayer === 'standard' ? styles.pillBtnStandard : styles.pillBtnDark]}
          onPress={handleImport}
        >
          <Text style={[styles.pillBtnText, mapLayer === 'standard' && styles.pillBtnTextStandard]}>导入</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.pillBtn, mapLayer === 'standard' ? styles.pillBtnStandard : styles.pillBtnDark]}
          onPress={() => router.push('/create')}
        >
          <Text style={[styles.pillBtnText, mapLayer === 'standard' && styles.pillBtnTextStandard]}>添加</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.pillBtn, mapLayer === 'standard' ? styles.pillBtnStandard : styles.pillBtnDark]}
          onPress={() => router.push('/records')}
        >
          <Text style={[styles.pillBtnText, mapLayer === 'standard' && styles.pillBtnTextStandard]}>记录</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a1a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a1a',
  },
  earthContainer: {
    width,
    height,
  },
  titleContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
  },
  buttons: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  pillBtn: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 22,
    borderWidth: 1,
  },
  pillBtnDark: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  pillBtnStandard: {
    backgroundColor: 'rgba(26,58,92,0.15)',
    borderColor: 'rgba(26,58,92,0.3)',
  },
  pillBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  pillBtnTextStandard: {
    color: '#1a3a5c',
  },
});
