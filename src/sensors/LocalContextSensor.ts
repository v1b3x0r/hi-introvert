/**
 * Local context sensor — what folder is the user in, what was modified recently.
 * Foreground app detection stub (macOS support TBD via opt-in osascript).
 */

import fs from 'fs'
import path from 'path'

export interface LocalContext {
  cwdName: string                // basename of cwd
  recentFileAge: number | null   // seconds since most recent file mtime, or null
  foregroundApp: string | null
}

export function readLocalContext(opts?: { cwd?: string }): LocalContext {
  const cwd = opts?.cwd ?? process.cwd()
  const cwdName = path.basename(cwd)

  let recentFileAge: number | null = null
  try {
    const entries = fs.readdirSync(cwd, { withFileTypes: true })
    let newest = 0
    for (const e of entries) {
      if (e.isFile()) {
        const stat = fs.statSync(path.join(cwd, e.name))
        if (stat.mtimeMs > newest) newest = stat.mtimeMs
      }
    }
    if (newest > 0) {
      recentFileAge = Math.floor((Date.now() - newest) / 1000)
    }
  } catch {
    // silent
  }

  return { cwdName, recentFileAge, foregroundApp: null }
}
