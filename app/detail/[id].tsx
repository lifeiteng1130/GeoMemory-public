import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { Audio } from 'expo-av';
import { getMemoryById, updateMemory, deleteMemory, MemoryWithImages } from '../../lib/database';
import DateTimePicker from '../../components/DateTimePicker';
import { getFullPath, deleteMedia } from '../../lib/storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function DetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const [memory, setMemory] = useState<MemoryWithImages | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editPlaceName, setEditPlaceName] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editDateTime, setEditDateTime] = useState('');

  useEffect(() => {
    loadMemory();
    return () => {
      sound?.unloadAsync();
    };
  }, [id]);

  const loadMemory = async () => {
    if (!id) return;
    try {
      const data = await getMemoryById(id);
      setMemory(data);
      if (data) {
        navigation.setOptions({ title: data.place_name || '记忆详情' });
        setEditPlaceName(data.place_name || '');
        setEditContent(data.content || '');
        setEditDateTime(data.date_time || '');
      }
    } catch (e) {
      console.error('Failed to load memory:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setEditing(true);
  };

  const handleSave = async () => {
    if (!id) return;
    try {
      await updateMemory(id, {
        place_name: editPlaceName,
        content: editContent,
        date_time: editDateTime,
      });
      setEditing(false);
      loadMemory();
    } catch (e) {
      Alert.alert('保存失败', String(e));
    }
  };

  const handlePlayVoice = async () => {
    if (!memory?.voice_path) return;

    try {
      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          await sound.playAsync();
          setIsPlaying(true);
        }
        return;
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: getFullPath(memory.voice_path) },
        { shouldPlay: true }
      );
      setSound(newSound);
      setIsPlaying(true);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
        }
      });
    } catch (e) {
      Alert.alert('播放失败', String(e));
    }
  };

  const handleDelete = () => {
    Alert.alert('确认删除', '删除后无法恢复', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          if (!id) return;
          try {
            const filePaths = await deleteMemory(id);
            for (const path of filePaths) {
              await deleteMedia(path);
            }
            if (memory?.voice_path) {
              await deleteMedia(memory.voice_path);
            }
            router.back();
          } catch (e) {
            Alert.alert('删除失败', String(e));
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!memory) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>记忆不存在</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Image Carousel */}
      {memory.images.length > 0 && (
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setCurrentImageIndex(index);
            }}
          >
            {memory.images.map((img, index) => (
              <Image
                key={img.id}
                source={{ uri: getFullPath(img.file_path) }}
                style={styles.carouselImage}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
          {memory.images.length > 1 && (
            <View style={styles.dots}>
              {memory.images.map((_, index) => (
                <View
                  key={index}
                  style={[styles.dot, index === currentImageIndex && styles.dotActive]}
                />
              ))}
            </View>
          )}
        </View>
      )}

      {/* Info */}
      <View style={styles.infoSection}>
        {editing ? (
          <TextInput
            style={styles.editInput}
            value={editPlaceName}
            onChangeText={setEditPlaceName}
            placeholder="地点名称"
            placeholderTextColor="#999"
          />
        ) : (
          <Text style={styles.placeName}>{memory.place_name || '未知地点'}</Text>
        )}
        <Text style={styles.coordsText}>
          {memory.latitude.toFixed(4)}, {memory.longitude.toFixed(4)}
        </Text>
      </View>

      {/* Date Time */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>时间</Text>
        {editing ? (
          <DateTimePicker value={editDateTime} onChange={setEditDateTime} />
        ) : (
          <Text style={styles.dateText}>{memory.date_time || memory.created_at}</Text>
        )}
      </View>

      {/* Content */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>内容</Text>
        {editing ? (
          <TextInput
            style={styles.editContentInput}
            value={editContent}
            onChangeText={setEditContent}
            placeholder="记录点什么..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        ) : memory.content ? (
          <Text style={styles.contentText}>{memory.content}</Text>
        ) : (
          <Text style={styles.emptyText}>暂无内容</Text>
        )}
      </View>

      {/* Voice */}
      {memory.voice_path ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>语音</Text>
          <TouchableOpacity style={styles.playBtn} onPress={handlePlayVoice}>
            <Text style={styles.playBtnText}>
              {isPlaying ? '暂停' : '播放语音'}
            </Text>
          </TouchableOpacity>
          {memory.voice_text ? (
            <Text style={styles.voiceText}>{memory.voice_text}</Text>
          ) : null}
        </View>
      ) : null}

      {/* Actions */}
      <View style={styles.actions}>
        {editing ? (
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>保存修改</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.editBtn} onPress={handleEdit}>
            <Text style={styles.editBtnText}>编辑</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteBtnText}>删除</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#999',
  },
  carouselImage: {
    width: SCREEN_WIDTH,
    height: 280,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ccc',
  },
  dotActive: {
    backgroundColor: '#007AFF',
    width: 20,
  },
  infoSection: {
    padding: 16,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  placeName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  coordsText: {
    fontSize: 12,
    color: '#aaa',
  },
  section: {
    padding: 16,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  contentText: {
    fontSize: 15,
    color: '#444',
    lineHeight: 24,
  },
  playBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  playBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  voiceText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  dateText: {
    fontSize: 15,
    color: '#444',
  },
  emptyText: {
    fontSize: 15,
    color: '#999',
  },
  editInput: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
    paddingVertical: 4,
    marginBottom: 8,
  },
  editContentInput: {
    fontSize: 15,
    color: '#444',
    lineHeight: 24,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 12,
    minHeight: 100,
  },
  actions: {
    paddingHorizontal: 16,
    marginTop: 20,
    flexDirection: 'row',
    gap: 12,
  },
  editBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  editBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#34C759',
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FF3B30',
    alignItems: 'center',
  },
  deleteBtnText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
});
