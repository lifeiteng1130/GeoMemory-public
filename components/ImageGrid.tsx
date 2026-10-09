import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet, Text } from 'react-native';

interface ImageGridProps {
  images: string[]; // full URIs
  onAdd?: () => void;
  onRemove?: (index: number) => void;
  editable?: boolean;
}

export default function ImageGrid({ images, onAdd, onRemove, editable = false }: ImageGridProps) {
  return (
    <View style={styles.grid}>
      {images.map((uri, index) => (
        <View key={index} style={styles.imageWrapper}>
          <Image source={{ uri }} style={styles.image} resizeMode="cover" />
          {editable && onRemove && (
            <TouchableOpacity style={styles.removeBtn} onPress={() => onRemove(index)}>
              <Text style={styles.removeText}>×</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
      {editable && onAdd && (
        <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
          <Text style={styles.addText}>+</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  imageWrapper: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginTop: -1,
  },
  addBtn: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  addText: {
    fontSize: 32,
    color: 'rgba(255,255,255,0.3)',
  },
});
