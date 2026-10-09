import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { MemoryWithImages } from '../lib/database';
import { getFullPath } from '../lib/storage';

interface MemoryCardProps {
  memory: MemoryWithImages;
  onPress: () => void;
  onClose: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.8;

export default function MemoryCard({ memory, onPress, onClose }: MemoryCardProps) {
  const firstImage = memory.images[0];

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
      <View style={styles.card}>
        {firstImage && (
          <Image
            source={{ uri: getFullPath(firstImage.file_path) }}
            style={styles.image}
            resizeMode="cover"
          />
        )}
        <View style={styles.info}>
          <Text style={styles.placeName} numberOfLines={1}>
            {memory.place_name || '未知地点'}
          </Text>
          <Text style={styles.date}>
            {new Date(memory.created_at).toLocaleDateString('zh-CN')}
          </Text>
          {memory.content ? (
            <Text style={styles.content} numberOfLines={2}>
              {memory.content}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity style={styles.detailBtn} onPress={onPress}>
          <Text style={styles.detailBtnText}>查看详情</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  image: {
    width: '100%',
    height: 180,
  },
  info: {
    padding: 14,
  },
  placeName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  date: {
    fontSize: 13,
    color: '#888',
    marginBottom: 8,
  },
  content: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
  detailBtn: {
    margin: 14,
    marginTop: 0,
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  detailBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
