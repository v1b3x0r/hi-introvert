#!/usr/bin/env node
import React from 'react'
import { render } from 'ink'

// Silence mds-core's startup chatter before the TUI mounts.
// mds-core's World constructor prints "LLM: Using...", "v6.0: ..." which
// fight Ink's redraw and cause flicker. setSilentMode only affects
// hi-introvert's own logs, not the engine.
const _log = console.log
const _info = console.info
const _warn = console.warn
console.log = () => {}
console.info = () => {}
console.warn = () => {}

// stdin.setRawMode shim — workaround for known Ink/Bun edge cases
if (!process.stdin.setRawMode) {
  ;(process.stdin as any).setRawMode = ((_mode: boolean) => process.stdin)
}

// Restore for our own errors after Ink has taken over
process.on('exit', () => {
  console.log = _log
  console.info = _info
  console.warn = _warn
})

// Lazy import so the console patch is in place before WorldSession loads
const { App } = await import('./ui/ink/App.js')
render(<App />)
