import { File, Directory, Paths } from 'expo-file-system/next';

function ensureMediaDir() {
  const dir = new Directory(Paths.document, 'media');
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
}

function generateFileName(extension: string): string {
  const now = new Date();
  const ts = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${ts}_${rand}.${extension}`;
}

export async function saveImage(sourceUri: string): Promise<string> {
  ensureMediaDir();
  const ext = sourceUri.split('.').pop()?.split('?')[0] || 'jpg';
  const fileName = generateFileName(ext);
  const source = new File(sourceUri);
  const dest = new File(Paths.document, 'media', fileName);
  source.copy(dest);
  return `media/${fileName}`;
}

export async function saveVoice(sourceUri: string): Promise<string> {
  ensureMediaDir();
  const ext = sourceUri.split('.').pop()?.split('?')[0] || 'm4a';
  const fileName = generateFileName(ext);
  const source = new File(sourceUri);
  const dest = new File(Paths.document, 'media', fileName);
  source.copy(dest);
  return `media/${fileName}`;
}

export function getFullPath(relativePath: string): string {
  return Paths.document.uri + relativePath;
}

export async function deleteMedia(relativePath: string): Promise<void> {
  const file = new File(Paths.document, relativePath);
  if (file.exists) {
    file.delete();
  }
}
