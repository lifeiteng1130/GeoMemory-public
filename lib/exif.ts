export interface ExifData {
  latitude?: number;
  longitude?: number;
  timestamp?: string;
}

// Convert DMS (degrees/minutes/seconds) EXIF format to decimal degrees
function dmsToDecimal(dms: number[], ref: string): number {
  if (!dms || dms.length < 3) return 0;
  const degrees = dms[0];
  const minutes = dms[1];
  const seconds = dms[2];
  let decimal = degrees + minutes / 60 + seconds / 3600;
  if (ref === 'S' || ref === 'W') decimal = -decimal;
  return decimal;
}

// Parse EXIF date format "YYYY:MM:DD HH:MM:SS" to ISO string
function parseExifDate(dateStr: string): string | undefined {
  if (!dateStr) return undefined;
  const match = dateStr.match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  if (!match) return undefined;
  const [, year, month, day, hour, min, sec] = match;
  return `${year}-${month}-${day}T${hour}:${min}:${sec}`;
}

export function parseExif(exif: any): ExifData {
  if (!exif) return {};

  const result: ExifData = {};

  // GPS coordinates
  const lat = exif.GPSLatitude;
  const latRef = exif.GPSLatitudeRef || 'N';
  const lon = exif.GPSLongitude;
  const lonRef = exif.GPSLongitudeRef || 'E';

  if (lat && lon) {
    result.latitude = dmsToDecimal(lat, latRef);
    result.longitude = dmsToDecimal(lon, lonRef);
  }

  // Timestamp
  const dateStr = exif.DateTimeOriginal || exif.DateTimeDigitized || exif.DateTime;
  if (dateStr) {
    result.timestamp = parseExifDate(dateStr);
  }

  return result;
}
