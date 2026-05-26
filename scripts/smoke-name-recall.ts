// Non-interactive smoke driver — reproduces live TUI path without UI
import { WorldSession } from '../src/session/WorldSession'

async function main() {
  const session = new WorldSession()
  session.setSilentMode(true)

  console.log(`baseline vocab: ${session.vocabularyTracker.getVocabularySize()}`)

  const inputs = [
    'hi',
    'hi',
    'hi',
    'hi',
    'hi',
    'call me wutty',
    'do you remember me?',
    'do you remember me?',
    'do you remember me?',
    'do you remember me?',
    'do you remember me?',
  ]

  for (const input of inputs) {
    try {
      const reply = await session.handleUserMessage(input)
      console.log(`you: ${input}`)
      console.log(`◆ companion: ${reply.response}`)
    } catch (e: any) {
      console.log(`you: ${input}`)
      console.log(`!! ERROR: ${e?.message ?? e}`)
      console.log(`!! STACK:\n${e?.stack ?? '(no stack)'}`)
    }
  }
  console.log(`\nfinal vocab: ${session.vocabularyTracker.getVocabularySize()}`)
  process.exit(0)
}
main()
