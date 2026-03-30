import fs from 'fs/promises'
import path from 'path'

function getDataFile() {
  const base = process.env.DB_PATH
    ? path.dirname(process.env.DB_PATH)
    : path.join(process.cwd(), 'data')
  return path.join(base, 'panel.json')
}

export async function readSavedPort(defaultPort) {
  try {
    const raw = await fs.readFile(getDataFile(), 'utf8')
    const data = JSON.parse(raw)
    if (data.port && Number.isInteger(data.port)) return data.port
  } catch {}
  return defaultPort
}
