/**
 * E2: when vocab >= PROTO_LANG_PRIORITY_THRESHOLD (30), autonomous output
 * should try proto-language BEFORE entity.speak('self_monologue').
 *
 * Deterministic — spies on call order, no sampling.
 */

import { test, expect, beforeAll } from 'bun:test'
import { unlinkSync, existsSync } from 'fs'

const SESSION_FILE = '.hi-introvert-session.json'

beforeAll(() => {
  console.log = () => {}
  console.info = () => {}
  console.warn = () => {}
  if (existsSync(SESSION_FILE)) {
    try { unlinkSync(SESSION_FILE) } catch {}
  }
})

test('with vocab >= threshold, protoLangGenerator.generate is called before companion.speak', async () => {
  const { WorldSession, PROTO_LANG_PRIORITY_THRESHOLD } = await import('../../src/session/WorldSession')
  const session = new WorldSession()
  session.setSilentMode(true)

  // Bump vocab over threshold (×2 for comfortable margin)
  for (let i = 0; i < PROTO_LANG_PRIORITY_THRESHOLD * 2; i++) {
    ;(session as any).vocabularyTracker.detectNewWords(`testword${i}`)
  }

  // Record call order
  const order: string[] = []
  const proto = (session as any).protoLangGenerator
  const originalGenerate = proto.generate.bind(proto)
  proto.generate = (...args: any[]) => { order.push('proto'); return originalGenerate(...args) }

  const companion = (session as any).companionEntity.entity
  const originalSpeak = companion.speak.bind(companion)
  companion.speak = (...args: any[]) => { order.push(`speak:${args[0]}`); return originalSpeak(...args) }

  ;(session as any).lastAutonomousAt = 0
  await session.generateAutonomousMessage()

  process.stderr.write(`[autonomous-priority] call order: ${JSON.stringify(order)}\n`)

  // Assertion: proto-lang is attempted at least once and BEFORE any
  // speak('self_monologue') call (if a fallback to speak occurs at all).
  const firstProto = order.indexOf('proto')
  const firstSpeakSelfMono = order.indexOf('speak:self_monologue')
  expect(firstProto).toBeGreaterThanOrEqual(0)
  if (firstSpeakSelfMono >= 0) {
    expect(firstProto).toBeLessThan(firstSpeakSelfMono)
  }
})

test('with vocab < threshold, companion.speak is called first (safety net)', async () => {
  const { WorldSession, PROTO_LANG_PRIORITY_THRESHOLD } = await import('../../src/session/WorldSession')
  const session = new WorldSession()
  session.setSilentMode(true)

  // Default vocab is well above threshold (BASE_VOCABULARY ~200) so we mock
  // vocabularyTracker.getVocabularySize() to a value below the gate.
  const vt = (session as any).vocabularyTracker
  vt.getVocabularySize = () => Math.max(1, PROTO_LANG_PRIORITY_THRESHOLD - 20)

  const order: string[] = []
  const proto = (session as any).protoLangGenerator
  const originalGenerate = proto.generate.bind(proto)
  proto.generate = (...args: any[]) => { order.push('proto'); return originalGenerate(...args) }

  const companion = (session as any).companionEntity.entity
  const originalSpeak = companion.speak.bind(companion)
  companion.speak = (...args: any[]) => { order.push(`speak:${args[0]}`); return originalSpeak(...args) }

  ;(session as any).lastAutonomousAt = 0
  await session.generateAutonomousMessage()

  process.stderr.write(`[autonomous-priority low-vocab] call order: ${JSON.stringify(order)}\n`)

  const firstSpeak = order.findIndex(s => s.startsWith('speak:'))
  const firstProto = order.indexOf('proto')
  expect(firstSpeak).toBeGreaterThanOrEqual(0)
  if (firstProto >= 0) {
    expect(firstSpeak).toBeLessThan(firstProto)
  }
})
