import { readSync, writeSync } from 'node:fs'

const DAEMON = 'http://localhost:18281'

function readBytes(n: number): Buffer {
  const buf = Buffer.alloc(n)
  let offset = 0
  while (offset < n) {
    const read = readSync(0, buf, offset, n - offset, null)
    if (read === 0) throw new Error('stdin EOF')
    offset += read
  }
  return buf
}

function writeMessage(msg: unknown): void {
  const json = JSON.stringify(msg)
  const data = Buffer.from(json, 'utf8')
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32LE(data.length, 0)
  writeSync(1, lenBuf)
  writeSync(1, data)
}

// Read one Native Messaging frame: 4-byte LE length prefix + JSON body
const lenBuf = readBytes(4)
const msgLen = lenBuf.readUInt32LE(0)
const msgBuf = readBytes(msgLen)
const msg = JSON.parse(msgBuf.toString('utf8'))

try {
  if (msg.type === 'PROBE') {
    const res = await fetch(`${DAEMON}/probe?url=${encodeURIComponent(msg.url as string)}`)
    const data = await res.json()
    writeMessage({ success: true, data })
  } else if (msg.type === 'ADD') {
    const res = await fetch(`${DAEMON}/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msg.payload),
    })
    const data = await res.json()
    writeMessage({ success: res.ok, data })
  } else {
    writeMessage({ success: false, error: 'Unknown message type' })
  }
} catch (e: unknown) {
  writeMessage({ success: false, error: e instanceof Error ? e.message : String(e) })
}
