/**
 * Generates placeholder teal PNG icons for the extension.
 * Run once before building: `bun run gen-icons`
 *
 * No external dependencies — uses Node.js zlib to produce valid PNGs.
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const iconsDir = join(import.meta.dir, '..', 'icons')
mkdirSync(iconsDir, { recursive: true })

function crc32(data: Uint8Array): number {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c
  }
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc = (table[(crc ^ data[i]!) & 0xff]!) ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crcInput = Buffer.concat([typeBytes, data])
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(crcInput), 0)
  return Buffer.concat([len, typeBytes, data, crcBuf])
}

function makePng(size: number, r: number, g: number, b: number): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: RGB
  // compression, filter, interlace = 0

  // Raw image: per row — filter byte (None) followed by size × RGB triplets
  const row = Buffer.alloc(1 + size * 3)
  for (let x = 0; x < size; x++) {
    row[1 + x * 3] = r
    row[2 + x * 3] = g
    row[3 + x * 3] = b
  }
  const rawData = Buffer.concat(Array.from({ length: size }, () => row))
  const idat = deflateSync(rawData)

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

// Teal #0d9488
const [r, g, b] = [0x0d, 0x94, 0x88]

for (const size of [16, 48, 128]) {
  const dest = join(iconsDir, `icon${size}.png`)
  writeFileSync(dest, makePng(size, r, g, b))
  console.log(`Generated ${dest}`)
}
