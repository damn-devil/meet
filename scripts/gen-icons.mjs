import { mkdirSync, writeFileSync } from 'node:fs'
import zlib from 'node:zlib'

mkdirSync('public/icons', { recursive: true })

function makePng(width, height, pixelFn) {
  // raw RGBA scanlines with filter byte 0
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1)
    raw[rowStart] = 0
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y)
      const i = rowStart + 1 + x * 4
      raw[i] = r
      raw[i + 1] = g
      raw[i + 2] = b
      raw[i + 3] = a
    }
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const typeBuf = Buffer.from(type, 'ascii')
    const crcBuf = Buffer.concat([typeBuf, data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(crcBuf) >>> 0)
    return Buffer.concat([len, typeBuf, data, crc])
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const idat = zlib.deflateSync(raw)
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

let crcTable = null
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crcTable[n] = c
    }
  }
  let crc = -1
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff]
  }
  return (crc ^ -1) >>> 0
}

// ---- pixel cat sprite (18x18 logical) ----
const CAT = [
  '....oo......oo....',
  '..oofffo..offfo...',
  '.ooffffffofffff...',
  '.ooffffFooooooo...',
  '.oofffffffffff....',
  '..oofffffffff.....',
  '...oofffffff......',
  '..oofffffffff.....',
  '.oofffffffffff....',
  '.offfffffffffff...',
  '.offEEffoffEFF....',
  '.offEHEfoEHEF.....',
  '.offfffffffff.....',
  '.oooffffnffff.....',
  '..oofffnnfff......',
  '...oofffmff.......',
  '....offfff........',
  '.....oooo.........',
]
const PAL = {
  o: [91, 58, 30, 255],
  f: [245, 158, 11, 255],
  F: [251, 191, 36, 255],
  E: [17, 24, 39, 255],
  H: [255, 255, 255, 255],
  n: [251, 113, 133, 255],
  m: [124, 45, 18, 255],
}

function appIcon(size) {
  const cell = size / 18
  const pad = size * 0.06
  return makePng(size, size, (x, y) => {
    // rounded gradient background
    const radius = size * 0.22
    const inRounded = (x, y) => {
      const xr = Math.min(x, size - x)
      const yr = Math.min(y, size - y)
      if (xr <= radius && yr <= radius) {
        const dx = radius - xr
        const dy = radius - yr
        return dx * dx + dy * dy <= radius * radius
      }
      return true
    }
    if (!inRounded(x, y)) return [0, 0, 0, 0]
    const t = (x + y) / (2 * size)
    const r = Math.round(99 + t * (236 - 99))
    const g = Math.round(102 + t * (72 - 102))
    const b = Math.round(241 + t * (153 - 241))
    // scale into inner area
    const ix = (x - pad) * (size / (size - pad * 2))
    const iy = (y - pad) * (size / (size - pad * 2))
    const cx = Math.floor(ix / cell)
    const cy = Math.floor(iy / cell)
    const ch = CAT[cy]?.[cx]
    if (ch === '.') return [r, g, b, 255]
    const p = PAL[ch] || [0, 0, 0, 0]
    return p
  })
}

writeFileSync('public/icons/icon-192.png', appIcon(192))
writeFileSync('public/icons/icon-512.png', appIcon(512))
console.log('icons written')
