import type { File } from 'expo-file-system/next';

type BackupEntry = { name: string; file: File };
type Progress = (value: { done: number; total: number }) => void;

const CHUNK_SIZE = 256 * 1024;
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let value = n;
  for (let i = 0; i < 8; i++) value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
  return value >>> 0;
});

function utf8(value: string): Uint8Array {
  const bytes: number[] = [];
  for (const char of value) {
    const code = char.codePointAt(0)!;
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
  }
  return Uint8Array.from(bytes);
}

function header(size: number, signature: number): DataView {
  const view = new DataView(new ArrayBuffer(size));
  view.setUint32(0, signature, true);
  return view;
}

function bytes(view: DataView): Uint8Array {
  return new Uint8Array(view.buffer);
}

function dosDate(date: Date): { time: number; day: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    day: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

export async function writeBackupZip(output: File, entries: BackupEntry[], onProgress?: Progress): Promise<void> {
  if (entries.length > 65535) throw new Error('Too many backup files');
  const names = new Set<string>();
  const prepared = entries.map(({ name, file }) => {
    if (!name || name.startsWith('/') || name.includes('\\') || name.split('/').includes('..')) {
      throw new Error(`Invalid backup filename: ${name}`);
    }
    if (names.has(name)) throw new Error(`Duplicate backup filename: ${name}`);
    names.add(name);
    const nameBytes = utf8(name);
    if (nameBytes.length > 65535) throw new Error(`Backup filename too long: ${name}`);
    return { nameBytes, file };
  });

  const archive = output.open();
  const position = () => {
    if (archive.offset === null) throw new Error('Cannot determine backup file position');
    return archive.offset;
  };
  const records: { name: Uint8Array; crc: number; size: number; offset: number; time: number; day: number }[] = [];
  const date = dosDate(new Date());
  try {
    for (const { nameBytes, file } of prepared) {
      const offset = position();
      const local = header(30, 0x04034b50);
      local.setUint16(4, 20, true);
      local.setUint16(6, 0x0808, true); // UTF-8 names and a trailing data descriptor.
      local.setUint16(10, date.time, true);
      local.setUint16(12, date.day, true);
      local.setUint16(26, nameBytes.length, true);
      archive.writeBytes(bytes(local));
      archive.writeBytes(nameBytes);

      const source = file.open();
      let crc = 0xffffffff;
      let size = 0;
      try {
        while (size < file.size) {
          const chunk = source.readBytes(Math.min(CHUNK_SIZE, file.size - size));
          if (!chunk.length) throw new Error(`Cannot read backup file: ${file.name}`);
          archive.writeBytes(chunk);
          for (const byte of chunk) crc = CRC_TABLE[(crc ^ byte) & 255] ^ (crc >>> 8);
          size += chunk.length;
          if (size > 0xffffffff || position() > 0xffffffff) throw new Error('Backup exceeds ZIP 4 GB limit');
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      } finally {
        source.close();
      }
      crc = (crc ^ 0xffffffff) >>> 0;
      const descriptor = header(16, 0x08074b50);
      descriptor.setUint32(4, crc, true);
      descriptor.setUint32(8, size, true);
      descriptor.setUint32(12, size, true);
      archive.writeBytes(bytes(descriptor));
      records.push({ name: nameBytes, crc, size, offset, ...date });
      onProgress?.({ done: records.length, total: prepared.length });
    }

    const directoryOffset = position();
    for (const record of records) {
      const central = header(46, 0x02014b50);
      central.setUint16(4, 20, true);
      central.setUint16(6, 20, true);
      central.setUint16(8, 0x0808, true);
      central.setUint16(12, record.time, true);
      central.setUint16(14, record.day, true);
      central.setUint32(16, record.crc, true);
      central.setUint32(20, record.size, true);
      central.setUint32(24, record.size, true);
      central.setUint16(28, record.name.length, true);
      central.setUint32(42, record.offset, true);
      archive.writeBytes(bytes(central));
      archive.writeBytes(record.name);
    }
    const directorySize = position() - directoryOffset;
    if (position() > 0xffffffff) throw new Error('Backup exceeds ZIP 4 GB limit');
    const end = header(22, 0x06054b50);
    end.setUint16(8, records.length, true);
    end.setUint16(10, records.length, true);
    end.setUint32(12, directorySize, true);
    end.setUint32(16, directoryOffset, true);
    archive.writeBytes(bytes(end));
  } finally {
    archive.close();
  }
}
