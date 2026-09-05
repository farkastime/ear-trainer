import { mkdir, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { INSTRUMENTS, SAMPLE_SOURCES } from '../src/core/content/instruments.ts'

const OUT_ROOT = new URL('../public/samples/', import.meta.url).pathname

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false,
  )
}

async function fetchWithRetry(url: string, attempts = 3): Promise<ArrayBuffer> {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${res.status} ${url}`)
      return await res.arrayBuffer()
    } catch (err) {
      lastError = err
      await new Promise((r) => setTimeout(r, 500 * (i + 1)))
    }
  }
  throw lastError
}

let downloaded = 0
let skipped = 0
for (const inst of INSTRUMENTS) {
  const dir = join(OUT_ROOT, inst.id)
  await mkdir(dir, { recursive: true })
  for (const file of Object.values(inst.samples)) {
    const target = join(dir, file)
    if (await exists(target)) {
      skipped++
      continue
    }
    const bytes = await fetchWithRetry(SAMPLE_SOURCES[inst.id] + file)
    await writeFile(target, Buffer.from(bytes))
    downloaded++
    process.stdout.write(`${inst.id}/${file}\n`)
  }
}
console.log(`samples: ${downloaded} downloaded, ${skipped} already present`)
