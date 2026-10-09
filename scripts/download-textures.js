#!/usr/bin/env node
/**
 * Download Earth textures from Three.js r169 repository.
 * Uses Gcore CDN (gcore.jsdelivr.net) for reliable access from China.
 *
 * Usage: node scripts/download-textures.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const TEXTURES_DIR = path.join(__dirname, '..', 'assets', 'textures');

const TEXTURES = [
  {
    url: 'https://gcore.jsdelivr.net/gh/mrdoob/three.js@r169/examples/textures/planets/earth_day_4096.jpg',
    filename: 'earth_day_4096.jpg',
  },
  {
    url: 'https://gcore.jsdelivr.net/gh/mrdoob/three.js@r169/examples/textures/planets/earth_bump_roughness_clouds_4096.jpg',
    filename: 'earth_bump_4096.jpg',
  },
  {
    url: 'https://gcore.jsdelivr.net/gh/mrdoob/three.js@r169/examples/textures/planets/earth_normal_2048.jpg',
    filename: 'earth_normal_2048.jpg',
  },
  {
    url: 'https://gcore.jsdelivr.net/gh/mrdoob/three.js@r169/examples/textures/planets/earth_specular_2048.jpg',
    filename: 'earth_specular_2048.jpg',
  },
  {
    url: 'https://gcore.jsdelivr.net/gh/mrdoob/three.js@r169/examples/textures/planets/earth_clouds_1024.png',
    filename: 'earth_clouds_1024.png',
  },
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        download(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let downloaded = 0;
      res.on('data', (chunk) => {
        downloaded += chunk.length;
        if (total > 0) {
          const pct = ((downloaded / total) * 100).toFixed(1);
          process.stdout.write(`\r  ${pct}% (${(downloaded / 1024).toFixed(0)}KB)`);
        }
      });
      res.pipe(file);
      file.on('finish', () => { file.close(); console.log(''); resolve(); });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function main() {
  if (!fs.existsSync(TEXTURES_DIR)) {
    fs.mkdirSync(TEXTURES_DIR, { recursive: true });
  }

  for (const { url, filename } of TEXTURES) {
    const dest = path.join(TEXTURES_DIR, filename);
    if (fs.existsSync(dest)) {
      const stat = fs.statSync(dest);
      console.log(`[skip] ${filename} (${(stat.size / 1024).toFixed(0)}KB already exists)`);
      continue;
    }
    console.log(`[download] ${filename}`);
    try {
      await download(url, dest);
      const stat = fs.statSync(dest);
      console.log(`[done] ${filename} (${(stat.size / 1024).toFixed(0)}KB)`);
    } catch (err) {
      console.error(`[error] ${filename}: ${err.message}`);
    }
  }

  console.log('\nAll textures downloaded to assets/textures/');
}

main();
