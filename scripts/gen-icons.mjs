// Генерирует PWA-иконки (PNG) без внешних зависимостей.
// Брутал-кнопка на всю плитку: тёмный не-чёрный тёплый фон, толстая кнопка
// в брутал-стиле (карточка + чернильная рамка + жёсткая тень), внутри —
// календарь с шапкой и сердечками вместо дней (глина — как акцент пары).
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

// ---------- PNG-энкодер ----------
function crc32(buf) {
  const table = crc32.table ||= (() => {
    const t = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[n] = c >>> 0
    }
    return t
  })()
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

// ---------- Геометрия ----------
function roundRectSDF(x, y, cx, cy, hw, hh, r) {
  const qx = Math.abs(x - cx) - (hw - r)
  const qy = Math.abs(y - cy) - (hh - r)
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
}

function inRoundedRect(px, py, cx, cy, hw, hh, r) {
  return roundRectSDF(px, py, cx, cy, hw, hh, r) <= 0
}

// Сердце (неявная кривая), y направлена вниз
function heart(x, y) {
  const x2 = x * x
  const y2 = y * y
  return (x2 + y2 - 1) ** 3 - x2 * y * y2 <= 0
}

function heartAt(px, py, cx, cy, s, angle) {
  const dx = px - cx
  const dy = py - cy
  const c = Math.cos(angle)
  const sn = Math.sin(angle)
  const x = (dx * c + dy * sn) / s
  const y = (-dx * sn + dy * c) / s
  return heart(x, y)
}

// ---------- Палитра ----------
const BG = [23, 19, 16]        // тёмный тёплый, не чёрный
const PAPER = [247, 242, 229]  // брутал-карточка
const INK = [27, 27, 27]       // брутал-чернила
const ACCENT = [155, 84, 46]   // глина (акцент)
const SHADOW = [7, 5, 4]       // жёсткая тень

function render(size) {
  const out = Buffer.alloc(size * size * 4)
  const S = size

  // Кнопка на всю плитку
  const m = S * 0.055
  const hw = S / 2 - m
  const r = S * 0.05
  const cx = S / 2
  const cy = S / 2 + S * 0.01
  const borderT = S * 0.024
  const shx = S * 0.028
  const shy = S * 0.042

  // Календарь внутри кнопки
  const calW = S * 0.5
  const headerH = S * 0.11
  const calCX = S / 2
  const calCY = S / 2 + S * 0.01
  const calTop = calCY - calW / 2 - headerH / 2
  const headerCX = calTop + headerH / 2
  const bodyTop = calTop + headerH
  const cellW = calW / 4
  const hs = cellW * 0.4
  const headHeartS = S * 0.06
  const ringR = S * 0.016

  const SS = 3
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let rA = 0, gA = 0, bA = 0, aA = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS
          const py = y + (sy + 0.5) / SS
          let cr = BG[0], cg = BG[1], cb = BG[2]

          if (inRoundedRect(px, py, cx + shx, cy + shy, hw, hw, r)) {
            cr = SHADOW[0]; cg = SHADOW[1]; cb = SHADOW[2]
          }
          if (inRoundedRect(px, py, cx, cy, hw, hw, r)) {
            cr = INK[0]; cg = INK[1]; cb = INK[2]
          }
          if (inRoundedRect(px, py, cx, cy, hw - borderT, hw - borderT, r - borderT)) {
            cr = PAPER[0]; cg = PAPER[1]; cb = PAPER[2]
          }

          // шапка календаря (чернильная) + сердце в центре
          if (inRoundedRect(px, py, calCX, headerCX, calW / 2, headerH / 2, S * 0.016)) {
            cr = INK[0]; cg = INK[1]; cb = INK[2]
          }
          if (heartAt(px, py, calCX, headerCX, headHeartS, 0)) {
            cr = PAPER[0]; cg = PAPER[1]; cb = PAPER[2]
          }

          // кольца-переплёт сверху (чернила на карточке)
          for (const rx of [calCX - calW * 0.3, calCX + calW * 0.3]) {
            if (Math.hypot(px - rx, py - (calTop - ringR)) <= ringR) {
              cr = INK[0]; cg = INK[1]; cb = INK[2]
            }
          }

          // сетка сердец вместо дней
          for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
              if (heartAt(px, py, calCX - calW / 2 + cellW * (col + 0.5), bodyTop + cellW * (row + 0.5), hs, 0)) {
                if ((row === 0 && col === 0) || (row === 3 && col === 3)) {
                  cr = ACCENT[0]; cg = ACCENT[1]; cb = ACCENT[2]
                } else {
                  cr = INK[0]; cg = INK[1]; cb = INK[2]
                }
              }
            }
          }

          rA += cr; gA += cg; bA += cb; aA += 255
        }
      }
      const n = SS * SS
      const i = (y * S + x) * 4
      out[i] = Math.round(rA / n)
      out[i + 1] = Math.round(gA / n)
      out[i + 2] = Math.round(bA / n)
      out[i + 3] = Math.round(aA / n)
    }
  }
  return encodePNG(S, S, out)
}

mkdirSync(ROOT, { recursive: true })
for (const size of [512, 192]) {
  const png = render(size)
  const file = join(ROOT, `icon-${size}.png`)
  writeFileSync(file, png)
  console.log(`icon-${size}.png: ${png.length} байт`)
}
