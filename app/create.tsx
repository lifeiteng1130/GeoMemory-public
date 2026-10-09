import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import ImageGrid from '../components/ImageGrid';
import LocationPicker from '../components/LocationPicker';
import DateTimePicker from '../components/DateTimePicker';
import { addMemory } from '../lib/database';
import { saveImage, saveVoice } from '../lib/storage';
import { parseExif, ExifData } from '../lib/exif';

export default function CreateScreen() {
  const router = useRouter();
  const [images, setImages] = useState<string[]>([]);
  const [latitude, setLatitude] = useState(0);
  const [longitude, setLongitude] = useState(0);
  const [placeName, setPlaceName] = useState('');
  const [content, setContent] = useState('');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [voiceUri, setVoiceUri] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dateTime, setDateTime] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 9 - images.length,
      exif: true,
    });

    if (result.canceled || !result.assets.length) return;

    const newUris: string[] = [];
    let firstExif: ExifData | null = null;

    for (const asset of result.assets) {
      newUris.push(asset.uri);
      // Extract EXIF from first image that has GPS data
      if (!firstExif && asset.exif) {
        const parsed = parseExif(asset.exif);
        if (parsed.latitude && parsed.longitude) {
          firstExif = parsed;
        }
      }
    }

    setImages((prev) => [...prev, ...newUris].slice(0, 9));

    // Auto-fill location and time from EXIF
    if (firstExif?.latitude && firstExif?.longitude && latitude === 0 && longitude === 0) {
      setLatitude(firstExif.latitude);
      setLongitude(firstExif.longitude);
      setPlaceName(`${firstExif.latitude.toFixed(4)}, ${firstExif.longitude.toFixed(4)}`);
    }
    if (firstExif?.timestamp) {
      const t = new Date(firstExif.timestamp);
      setDateTime(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLocationChange = (lat: number, lng: number, name: string) => {
    console.log('[Create] handleLocationChange:', lat, lng, name);
    setLatitude(lat);
    setLongitude(lng);
    setPlaceName(name);
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('权限不足', '需要麦克风权限才能录音');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
    } catch (e) {
      Alert.alert('录音失败', String(e));
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setIsRecording(false);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setVoiceUri(uri || null);
    setRecording(null);
  };

  const handleSave = async () => {
    console.log('[Create] handleSave - lat:', latitude, 'lng:', longitude, 'place:', placeName);
    if (images.length === 0) {
      Alert.alert('提示', '请至少选择一张图片');
      return;
    }
    if (latitude === 0 && longitude === 0) {
      Alert.alert('提示', '请先搜索并选择一个地点，或手动输入坐标');
      return;
    }

    setSaving(true);
    try {
      const savedImagePaths: string[] = [];
      for (const uri of images) {
        const path = await saveImage(uri);
        savedImagePaths.push(path);
      }

      let voicePath: string | undefined;
      if (voiceUri) {
        voicePath = await saveVoice(voiceUri);
      }

      await addMemory({
        latitude,
        longitude,
        place_name: placeName,
        content,
        voice_path: voicePath,
        image_paths: savedImagePaths,
        date_time: dateTime,
      });

      router.back();
    } catch (e) {
      Alert.alert('保存失败', String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Images */}
      <Text style={styles.sectionTitle}>图片</Text>
      <ImageGrid
        images={images}
        onAdd={pickImages}
        onRemove={removeImage}
        editable
      />
      <Text style={styles.hint}>选择带有 GPS 信息的图片可自动识别地点和时间</Text>

      {/* Date Time */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>时间</Text>
        <DateTimePicker value={dateTime} onChange={setDateTime} />
      </View>

      {/* Location */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>地点</Text>
        <LocationPicker
          latitude={latitude}
          longitude={longitude}
          placeName={placeName}
          onLocationChange={handleLocationChange}
        />
      </View>

      {/* Content */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>内容</Text>
        <TextInput
          style={styles.textInput}
          placeholder="记录点什么..."
          placeholderTextColor="#999"
          value={content}
          onChangeText={setContent}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

      {/* Voice */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>语音</Text>
        <View style={styles.voiceRow}>
        <TouchableOpacity
          style={[styles.voiceBtn, isRecording && styles.voiceBtnActive]}
          onPress={isRecording ? stopRecording : startRecording}
        >
          <Text style={styles.voiceBtnText}>
            {isRecording ? '停止录音' : voiceUri ? '重新录音' : '开始录音'}
          </Text>
        </TouchableOpacity>
        {voiceUri && !isRecording && (
          <Text style={styles.voiceHint}>已录音</Text>
        )}
          </View>
        </View>

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveBtnText}>保存记忆</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a1a',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 10,
  },
  hint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 6,
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    color: '#fff',
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  voiceBtn: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  voiceBtnActive: {
    backgroundColor: '#cc0000',
  },
  voiceBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  voiceHint: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
