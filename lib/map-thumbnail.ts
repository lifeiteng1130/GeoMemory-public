import { Image } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { getFullPath } from './storage';

const pending = new Map<string, Promise<string>>();

// Crop matches the existing centered object-fit: cover; PNG retains transparency.
export function thumbnailActions(width: number, height: number, pixels: number) {
  const side = Math.min(width, height);
  if (!(side > 0) || !Number.isFinite(side)) throw new Error('Invalid image dimensions');
  return [
    { crop: { originX: Math.floor((width - side) / 2), originY: Math.floor((height - side) / 2), width: side, height: side } },
    { resize: { width: Math.min(side, pixels), height: Math.min(side, pixels) } },
  ];
}

export async function getMapThumbnail(relativePath: string, dpr: number): Promise<string> {
  const uri = getFullPath(relativePath);
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists || info.isDirectory) throw new Error('Image is unavailable');
  const pixels = Math.max(144, Math.ceil(48 * dpr));
  const key = `${encodeURIComponent(relativePath)}-${info.size}-${info.modificationTime}-${pixels}-v1.png`;
  let task = pending.get(key);
  if (!task) {
    task = createThumbnail(uri, key, pixels).finally(() => pending.delete(key));
    pending.set(key, task);
  }
  return task;
}

async function createThumbnail(uri: string, key: string, pixels: number): Promise<string> {
  const directory = `${FileSystem.cacheDirectory}map-thumbnails/`;
  const cached = directory + key;
  const existing = await FileSystem.getInfoAsync(cached);
  if (existing.exists && !existing.isDirectory && existing.size > 0) {
    return 'data:image/png;base64,' + await FileSystem.readAsStringAsync(cached, { encoding: FileSystem.EncodingType.Base64 });
  }
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const dimensions = await Image.getSize(uri);
  const result = await manipulateAsync(uri, thumbnailActions(dimensions.width, dimensions.height, pixels), { format: SaveFormat.PNG });
  try {
    await FileSystem.copyAsync({ from: result.uri, to: cached });
    return 'data:image/png;base64,' + await FileSystem.readAsStringAsync(cached, { encoding: FileSystem.EncodingType.Base64 });
  } finally {
    await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => {});
  }
}
