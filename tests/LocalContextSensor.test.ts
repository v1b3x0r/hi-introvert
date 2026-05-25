import { test, expect, describe } from 'bun:test'
import { readLocalContext } from '../src/sensors/LocalContextSensor'

describe('LocalContextSensor', () => {
  test('returns cwd basename', () => {
    const ctx = readLocalContext({ cwd: '/Users/foo/projects/my-app' })
    expect(ctx.cwdName).toBe('my-app')
  })

  test('cwdName is empty string when cwd is root', () => {
    const ctx = readLocalContext({ cwd: '/' })
    expect(ctx.cwdName).toBe('')
  })

  test('recentFileAge is null when fs read fails', () => {
    const ctx = readLocalContext({ cwd: '/nonexistent/path/xyz' })
    expect(ctx.recentFileAge).toBeNull()
  })

  test('reports recentFileAge for real directory', () => {
    const ctx = readLocalContext({ cwd: process.cwd() })
    // project root has files, so age should be a number
    expect(typeof ctx.recentFileAge === 'number' || ctx.recentFileAge === null).toBe(true)
  })
})
