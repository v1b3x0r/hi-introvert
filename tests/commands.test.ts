import { test, expect, describe } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Static "wiring" tests for the 10 user-facing slash commands.
 *
 * Scans the Ink App shell source to confirm each command has a
 * `case '<name>':` clause. Does NOT run handlers (would require
 * booting the full TUI + mds-core).
 */

const ROOT = join(import.meta.dir, '..')

const EXPECTED_COMMANDS = [
  'help', 'status', 'growth', 'lexicon',
  'history', 'save', 'load', 'clear', 'exit', 'privacy',
] as const

function extractCaseLabels(source: string): Set<string> {
  const labels = new Set<string>()
  const matches = source.matchAll(/case\s+['"]([a-z]+)['"]\s*:/gi)
  for (const m of matches) labels.add(m[1].toLowerCase())
  return labels
}

describe('slash command dispatcher', () => {
  const source = readFileSync(join(ROOT, 'src/ui/ink/App.tsx'), 'utf-8')
  const labels = extractCaseLabels(source)

  for (const cmd of EXPECTED_COMMANDS) {
    test(`/${cmd} is wired in Ink App shell`, () => {
      expect(labels.has(cmd)).toBe(true)
    })
  }
})

describe('help text', () => {
  test('HELP_TEXT lists every user-listed command', async () => {
    const { HELP_TEXT } = await import('../src/ui/help-text')
    for (const cmd of EXPECTED_COMMANDS) {
      expect(HELP_TEXT).toContain(`/${cmd}`)
    }
  })

  test('Ink App shell imports HELP_TEXT', () => {
    const source = readFileSync(join(ROOT, 'src/ui/ink/App.tsx'), 'utf-8')
    expect(source).toContain('HELP_TEXT')
  })
})

describe('command parser', () => {
  function parseCommand(cmd: string): { command: string; args: string[] } {
    const [command, ...args] = cmd.slice(1).split(' ')
    return { command, args }
  }

  test('parses bare /help', () => {
    expect(parseCommand('/help')).toEqual({ command: 'help', args: [] })
  })

  test('parses /save filename.json', () => {
    expect(parseCommand('/save snapshot.json')).toEqual({
      command: 'save',
      args: ['snapshot.json'],
    })
  })

  test('parses /privacy on', () => {
    expect(parseCommand('/privacy on')).toEqual({
      command: 'privacy',
      args: ['on'],
    })
  })

  test('all expected commands parse to their canonical name', () => {
    for (const cmd of EXPECTED_COMMANDS) {
      expect(parseCommand(`/${cmd}`).command).toBe(cmd)
    }
  })
})
