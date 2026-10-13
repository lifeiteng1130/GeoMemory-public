import { File, Directory, Paths } from 'expo-file-system/next';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import JSZip from 'jszip';
import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';
import { getDatabase } from './database';
import { writeBackupZip } from './backup-zip';

interface ImportMemory {
  id: string;
  latitude: number;
  longitude: number;
  place_name: string;
  content: string;
  voice_path: string | null;
  voice_text: string | null;
  created_at: string;
  date_time: string | null;
}

interface ImportImage {
  id: string;
  memory_id: string;
  file_path: string;
  sort_order: number;
}

export async function exportBackup(onProgress?: (value: { done: number; total: number }) => void): Promise<void> {
  const snapshotName = `_backup_snapshot_${Date.now()}_${Math.random().toString(36).slice(2)}.db`;
  const dbFile = new File(Paths.document, 'SQLite', snapshotName);
  const mediaDir = new Directory(Paths.document, 'media');
  let snapshotDb: SQLite.SQLiteDatabase | null = null;
  try {
    const sourceDb = await getDatabase();
    snapshotDb = await SQLite.openDatabaseAsync(snapshotName);
    await SQLite.backupDatabaseAsync({ sourceDatabase: sourceDb, destDatabase: snapshotDb });
    await snapshotDb.closeAsync();
    snapshotDb = null;

    const entries: { name: string; file: File }[] = [{ name: 'db/geomemory.db', file: dbFile }];
    if (mediaDir.exists) {
      for (const entry of mediaDir.list()) {
        if (entry instanceof File) entries.push({ name: `media/${entry.name}`, file: entry });
      }
    }
    const zipFile = new File(Paths.cache, `geomemory_backup_${Date.now()}.zip`);
    zipFile.create();
    let shared = false;
    try {
      await writeBackupZip(zipFile, entries, onProgress);
      if (!await Sharing.isAvailableAsync()) throw new Error('当前设备不支持分享备份文件');
      await Sharing.shareAsync(zipFile.uri, {
        mimeType: 'application/zip',
        dialogTitle: '导出 GeoMemory 备份',
      });
      shared = true;
    } finally {
      // The receiving app may read the shared URI after the chooser closes.
      if (!shared && zipFile.exists) zipFile.delete();
    }
  } finally {
    if (snapshotDb) await snapshotDb.closeAsync();
    if (dbFile.exists) dbFile.delete();
  }
}

export async function importBackup(): Promise<{ imported: number; skipped: number }> {
  let importedCount = 0;
  let skippedCount = 0;
  let tempDb: SQLite.SQLiteDatabase | null = null;
  const TEMP_DB_NAME = '_import_temp.db';

  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/zip',
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.length) return { imported: 0, skipped: 0 };

    const zipPath = result.assets[0].uri;
    const zipContent = await FileSystem.readAsStringAsync(zipPath, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const zip = await JSZip.loadAsync(zipContent, { base64: true });

    const dbEntry = zip.file('db/geomemory.db');
    if (!dbEntry) return { imported: 0, skipped: 0 };

    // Write temp db to SQLite directory so expo-sqlite can open it
    const dbBytes = await dbEntry.async('uint8array');
    const sqlDir = new Directory(Paths.document, 'SQLite');
    if (!sqlDir.exists) sqlDir.create({ intermediates: true });
    const tmpDbFile = new File(sqlDir, TEMP_DB_NAME);
    if (tmpDbFile.exists) tmpDbFile.delete();
    tmpDbFile.create();
    tmpDbFile.write(new Uint8Array(dbBytes));

    // Open temp db and read imported data
    tempDb = await SQLite.openDatabaseAsync(TEMP_DB_NAME);
    const memories = await tempDb.getAllAsync<ImportMemory>(`
      SELECT * FROM memories ORDER BY created_at
    `);

    // Use the shared db connection
    const db = await getDatabase();

    // Insert all memories and build path mapping
    const pathMap = new Map<string, string>();

    for (const mem of memories) {
      const images = await tempDb.getAllAsync<ImportImage>(
        'SELECT * FROM memory_images WHERE memory_id = ? ORDER BY sort_order',
        [mem.id]
      );

      // Deduplicate: check if this exact memory already exists
      const existing = await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM memories WHERE latitude = ? AND longitude = ? AND place_name = ? AND content = ? AND created_at = ? LIMIT 1`,
        [mem.latitude, mem.longitude, mem.place_name, mem.content, mem.created_at]
      );
      if (existing) {
        console.log('[Import] duplicate skipped for:', mem.place_name, mem.created_at);
        skippedCount++;
        continue;
      }

      // Generate new IDs to avoid conflicts
      const newId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

      await db.runAsync(
        `INSERT INTO memories (id, latitude, longitude, place_name, content, voice_path, voice_text, created_at, date_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId, mem.latitude, mem.longitude, mem.place_name, mem.content,
         mem.voice_path, mem.voice_text, mem.created_at, mem.date_time]
      );

      // Insert images with new paths
      for (let i = 0; i < images.length; i++) {
        const newImgId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + i;
        const origPath = images[i].file_path;
        const ext = origPath.split('.').pop() || 'jpg';
        const newPath = `media/${newId}_${i}.${ext}`;

        console.log('[Import] image origPath:', origPath, '→ newPath:', newPath);
        await db.runAsync(
          `INSERT INTO memory_images (id, memory_id, file_path, sort_order) VALUES (?, ?, ?, ?)`,
          [newImgId, newId, newPath, images[i].sort_order]
        );

        // Map filename to new path
        pathMap.set(origPath.split('/').pop()!, newPath);
      }

      importedCount++;
      await new Promise(r => setTimeout(r, 2));
    }

    // Copy media files from zip (only those we have path mappings for)
    const mediaDir = new Directory(Paths.document, 'media');
    if (!mediaDir.exists) mediaDir.create({ idempotent: true });

    // Iterate zip's top-level files directly, filtering for media/ prefix
    const zipFileNames = Object.keys(zip.files);
    console.log('[Import] all zip files:', zipFileNames);
    let copiedCount = 0;
    for (const name of zipFileNames) {
      if (!name.startsWith('media/') || name.endsWith('/')) continue;
      const entry = zip.file(name);
      if (!entry || entry.dir) continue;
      const fileName = name.split('/').pop();
      if (!fileName) continue;
      const newPath = pathMap.get(fileName);
      console.log('[Import] zip file:', name, '→ lookup key:', fileName, '→ found path:', newPath);
      if (!newPath) { console.log('[Import] SKIP - no pathMap match'); continue; }
      const dest = new File(Paths.document, newPath);
      console.log('[Import] dest uri:', dest.uri, 'exists before:', dest.exists);
      if (dest.exists) { console.log('[Import] dest exists, skip'); continue; }
      const bytes = await entry.async('uint8array');
      console.log('[Import] writing', bytes.length, 'bytes to', newPath);
      dest.create();
      dest.write(new Uint8Array(bytes));
      console.log('[Import] write done, exists after:', dest.exists);
      copiedCount++;
    }
    console.log('[Import] copied', copiedCount, 'media files');

    // Final check: list what's in media dir now
    const finalMediaDir = new Directory(Paths.document, 'media');
    if (finalMediaDir.exists) {
      const finalEntries = finalMediaDir.list();
      console.log('[Import] final media dir has', finalEntries.length, 'files');
    }

  } catch (e) {
    console.error('Import failed:', e);
  } finally {
    try {
      if (tempDb) await tempDb.closeAsync();
      const tmp = new File(Paths.document, 'SQLite', TEMP_DB_NAME);
      if (tmp.exists) tmp.delete();
    } catch {}
  }

  return { imported: importedCount, skipped: skippedCount };
}
