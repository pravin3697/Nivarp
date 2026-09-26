const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 implementation for pure PNG construction
function makeCrcTable() {
  let c;
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[n] = c;
  }
  return crcTable;
}

const crcTable = makeCrcTable();

function crc32(buf) {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

function writePng(width, height, rgbaBuffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // bit depth
  ihdrData.writeUInt8(6, 9); // color type: RGBA
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace

  const ihdrLen = Buffer.alloc(4);
  ihdrLen.writeUInt32BE(13, 0);
  const ihdrType = Buffer.from('IHDR');
  const ihdrCrc = Buffer.alloc(4);
  ihdrCrc.writeUInt32BE(crc32(Buffer.concat([ihdrType, ihdrData])), 0);
  const ihdr = Buffer.concat([ihdrLen, ihdrType, ihdrData, ihdrCrc]);

  // Filter scanlines: add 0 byte (Filter type None) at the start of each row
  const rawScanlines = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (width * 4 + 1);
    rawScanlines[rowOffset] = 0; // Filter: None
    rgbaBuffer.copy(rawScanlines, rowOffset + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressedData = zlib.deflateSync(rawScanlines, { level: 9 });
  const idatLen = Buffer.alloc(4);
  idatLen.writeUInt32BE(compressedData.length, 0);
  const idatType = Buffer.from('IDAT');
  const idatCrc = Buffer.alloc(4);
  idatCrc.writeUInt32BE(crc32(Buffer.concat([idatType, compressedData])), 0);
  const idat = Buffer.concat([idatLen, idatType, compressedData, idatCrc]);

  // IEND chunk
  const iendLen = Buffer.alloc(4);
  const iendType = Buffer.from('IEND');
  const iendCrc = Buffer.alloc(4);
  iendCrc.writeUInt32BE(crc32(iendType), 0);
  const iend = Buffer.concat([iendLen, iendType, iendCrc]);

  return Buffer.concat([signature, ihdr, idat, iend]);
}

// Draw the Nivarp logo into an RGBA buffer
function renderNivarpIcon(size) {
  const buf = Buffer.alloc(size * size * 4);

  // Geometry definition normalized from 0 to 1
  const bgR = 11, bgG = 13, bgB = 20;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      // Normalized coordinates [0, 1]
      const nx = x / size;
      const ny = y / size;

      // Dark futuristic background (#0B0D14)
      let r = bgR;
      let g = bgG;
      let b = bgB;
      let a = 255;

      // Subtle cyan glow top-right
      const dxGlow = nx - 0.72;
      const dyGlow = ny - 0.28;
      const distGlow = Math.sqrt(dxGlow * dxGlow + dyGlow * dyGlow);
      if (distGlow < 0.45) {
        const glowFactor = (1 - distGlow / 0.45) * 0.4;
        r = Math.min(255, Math.floor(r + 34 * glowFactor));
        g = Math.min(255, Math.floor(g + 211 * glowFactor));
        b = Math.min(255, Math.floor(b + 238 * glowFactor));
      }

      // Draw Pure White "N"
      const inLeftStem = (nx >= 0.22 && nx <= 0.35 && ny >= 0.24 && ny <= 0.76);
      const inRightStem = (nx >= 0.58 && nx <= 0.71 && ny >= 0.24 && ny <= 0.76);

      // Diagonal of N
      let inDiagonal = false;
      if (nx >= 0.28 && nx <= 0.65 && ny >= 0.24 && ny <= 0.76) {
        const diagCenter = 0.28 + ((ny - 0.24) / 0.52) * (0.65 - 0.28);
        if (Math.abs(nx - diagCenter) <= 0.08) {
          inDiagonal = true;
        }
      }

      if (inLeftStem || inRightStem || inDiagonal) {
        r = 255;
        g = 255;
        b = 255;
      }

      // Draw Trending Breakout Cyan Arrow ↗ at Top-Right
      // Stem: line from (0.58, 0.42) to (0.83, 0.17)
      const u = (nx - 0.58) + (0.42 - ny);
      const perpDist = Math.abs((nx - 0.58) - (0.42 - ny)) / Math.SQRT2;
      const inArrowStem = (nx >= 0.58 && nx <= 0.83 && ny <= 0.42 && ny >= 0.17 && perpDist <= 0.035);

      // Arrow Head lines:
      const inArrowH = (nx >= 0.68 && nx <= 0.84 && Math.abs(ny - 0.17) <= 0.035);
      const inArrowV = (ny >= 0.17 && ny <= 0.33 && Math.abs(nx - 0.83) <= 0.035);

      if (inArrowStem || inArrowH || inArrowV) {
        r = 34;
        g = 211;
        b = 238; // #22D3EE
      }

      buf[idx] = r;
      buf[idx + 1] = g;
      buf[idx + 2] = b;
      buf[idx + 3] = a;
    }
  }

  return writePng(size, size, buf);
}

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

console.log('Generating high-resolution Nivarp application icons...');

// Generate 512x512
const png512 = renderNivarpIcon(512);
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), png512);
console.log('✓ Created public/icon-512.png (512x512)');

// Generate 192x192
const png192 = renderNivarpIcon(192);
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), png192);
console.log('✓ Created public/icon-192.png (192x192)');

// Generate apple-touch-icon.png (180x180)
const appleIcon = renderNivarpIcon(180);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), appleIcon);
console.log('✓ Created public/apple-touch-icon.png (180x180)');

// Generate favicon.ico (fallback 48x48 PNG)
const favicon = renderNivarpIcon(48);
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), favicon);
console.log('✓ Created public/favicon.ico');

console.log('\nAll brand PNG icons generated successfully!');