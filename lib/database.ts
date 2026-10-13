import * as SQLite from 'expo-sqlite';

export interface Memory {
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

export interface MemoryImage {
  id: string;
  memory_id: string;
  file_path: string;
  sort_order: number;
}

export interface MemoryWithImages extends Memory {
  images: MemoryImage[];
}

let db: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    db = await SQLite.openDatabaseAsync('geomemory.db');
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        place_name TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        voice_path TEXT,
        voice_text TEXT,
        created_at TEXT NOT NULL,
        date_time TEXT
      );
      CREATE TABLE IF NOT EXISTS memory_images (
        id TEXT PRIMARY KEY,
        memory_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
      );
      ALTER TABLE memories ADD COLUMN date_time TEXT;
    `).catch(() => {});
    return db;
  })();
  return initPromise;
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    try { await db.closeAsync(); } catch {}
    db = null;
    initPromise = null;
  }
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function addMemory(data: {
  latitude: number;
  longitude: number;
  place_name: string;
  content: string;
  voice_path?: string;
  voice_text?: string;
  image_paths: string[];
  date_time?: string;
}): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const created_at = new Date().toISOString();
  console.log('[DB] addMemory:', data.latitude, data.longitude, data.place_name);

  await db.runAsync(
    `INSERT INTO memories (id, latitude, longitude, place_name, content, voice_path, voice_text, created_at, date_time)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.latitude, data.longitude, data.place_name, data.content, data.voice_path || null, data.voice_text || null, created_at, data.date_time || null]
  );

  for (let i = 0; i < data.image_paths.length; i++) {
    const imgId = generateId();
    await db.runAsync(
      `INSERT INTO memory_images (id, memory_id, file_path, sort_order) VALUES (?, ?, ?, ?)`,
      [imgId, id, data.image_paths[i], i]
    );
  }

  return id;
}

export async function getMemories(): Promise<MemoryWithImages[]> {
  const db = await getDatabase();
  const memories = await db.getAllAsync<Memory>('SELECT * FROM memories ORDER BY date_time DESC');
  if (memories.length === 0) return [];
  const images = await db.getAllAsync<MemoryImage>(
    'SELECT * FROM memory_images ORDER BY sort_order'
  );
  const imagesByMemory = new Map<string, MemoryImage[]>();
  for (const image of images) {
    const group = imagesByMemory.get(image.memory_id) || [];
    group.push(image);
    imagesByMemory.set(image.memory_id, group);
  }
  return memories.map(mem => ({ ...mem, images: imagesByMemory.get(mem.id) || [] }));
}

export async function getMemoryById(id: string): Promise<MemoryWithImages | null> {
  const db = await getDatabase();
  const memory = await db.getFirstAsync<Memory>('SELECT * FROM memories WHERE id = ?', [id]);
  if (!memory) return null;

  const images = await db.getAllAsync<MemoryImage>(
    'SELECT * FROM memory_images WHERE memory_id = ? ORDER BY sort_order',
    [memory.id]
  );

  return { ...memory, images };
}

export async function updateMemory(id: string, data: {
  place_name?: string;
  content?: string;
  date_time?: string;
  voice_text?: string;
}): Promise<void> {
  const db = await getDatabase();
  const sets: string[] = [];
  const params: any[] = [];

  if (data.place_name !== undefined) { sets.push('place_name = ?'); params.push(data.place_name); }
  if (data.content !== undefined) { sets.push('content = ?'); params.push(data.content); }
  if (data.date_time !== undefined) { sets.push('date_time = ?'); params.push(data.date_time); }
  if (data.voice_text !== undefined) { sets.push('voice_text = ?'); params.push(data.voice_text); }

  if (sets.length === 0) return;
  params.push(id);
  await db.runAsync(`UPDATE memories SET ${sets.join(', ')} WHERE id = ?`, params);
}

export async function deleteMemory(id: string): Promise<string[]> {
  const db = await getDatabase();
  const images = await db.getAllAsync<MemoryImage>(
    'SELECT * FROM memory_images WHERE memory_id = ?',
    [id]
  );
  const filePaths = images.map((img) => img.file_path);

  await db.runAsync('DELETE FROM memory_images WHERE memory_id = ?', [id]);
  await db.runAsync('DELETE FROM memories WHERE id = ?', [id]);

  return filePaths;
}
