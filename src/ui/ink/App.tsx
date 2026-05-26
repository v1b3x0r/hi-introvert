import React, { useState, useEffect, useRef } from 'react'
import { Box, useApp } from 'ink'
import { WorldSession } from '../../session/WorldSession.js'
import { Banner } from './Banner.js'
import { ChatView } from './ChatView.js'
import { StatusRow } from './StatusRow.js'
import { InputBox } from './InputBox.js'
import { Footer } from './Footer.js'
import { HELP_TEXT } from '../help-text.js'
import { scheduleAutonomous } from '../../utils/autonomous-scheduler.js'
import type { Message } from '../../types/index.js'

const VERSION = '1.2.9'

export const App: React.FC = () => {
  const { exit } = useApp()
  const [session] = useState(() => {
    const s = new WorldSession()
    s.setSilentMode(true)
    return s
  })
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [vocabCount, setVocabCount] = useState(0)
  const [skills, setSkills] = useState<any>(null)
  const [env, setEnv] = useState<{ tempC: number | null; humidity: number | null; weather: string | null }>({
    tempC: null, humidity: null, weather: null,
  })
  const [battery, setBattery] = useState<number | null>(null)
  const [showBanner, setShowBanner] = useState(true)
  const [, forceUpdate] = useState(0)
  // Autosave needs the latest messages from a stable ref (setInterval
  // captures messages once otherwise) so we keep messagesRef in sync.
  const messagesRef = useRef<Message[]>([])

  useEffect(() => {
    const loadResult = session.loadSessionWithHistory()
    if (loadResult?.success && loadResult.messages) {
      setMessages(loadResult.messages as Message[])
    }
    setVocabCount(session.vocabularyTracker.getVocabularySize())

    // Pull skills if available — use mds-core's getSkill(name) API
    const refreshSkills = () => {
      const c = session.companionEntity?.entity
      if (!c?.skills) return
      const getProf = (name: string) => (c.skills as any).getSkill?.(name)?.proficiency ?? 0
      setSkills({
        conversation: getProf('conversation'),
        creativity: getProf('creativity'),
        empathy: getProf('empathy'),
        learning: getProf('learning'),
      })
    }
    refreshSkills()
    session.on('skills-initialized', refreshSkills)

    session.on('environment', (data: any) => {
      setEnv(e => ({
        ...e,
        tempC: data?.mapping?.temperature ? data.mapping.temperature - 273 : e.tempC,
        humidity: data?.mapping?.humidity ?? e.humidity,
      }))
      setBattery(data?.metrics?.batteryLevel ?? null)
    })

    session.on('outside_weather', (data: any) => {
      setEnv(e => ({ ...e, weather: data?.description ?? null }))
    })

    session.on('vocab', (data: { words: string[] }) => {
      setVocabCount(session.vocabularyTracker.getVocabularySize())
      // Surface vocab growth as a system message so the user can feel learning
      if (data?.words?.length > 0) {
        setMessages(prev => [...prev, {
          type: 'system',
          sender: 'system',
          text: `[learned] ${data.words.join(', ')}`,
          timestamp: Date.now(),
        }])
      }
    })

    // Surface identity capture so user sees confirmation when companion
    // catches their name (parallel to vocab [learned] notice).
    session.on('identity', (data: { name: string }) => {
      if (!data?.name) return
      setMessages(prev => [...prev, {
        type: 'system',
        sender: 'system',
        text: `[identity] ${data.name}`,
        timestamp: Date.now(),
      }])
    })

    // Proactive introvert — companion speaks unprompted every 15–45s when autonomous
    const stopAutonomous = scheduleAutonomous(async () => {
      const companion = session.companionEntity?.entity
      if (!companion?.isAutonomous?.()) return
      const reply: any = await session.generateAutonomousMessage()
      if (!reply?.response) return
      setMessages(prev => [...prev, {
        type: 'monologue',
        sender: reply.name,
        text: reply.response,
        emotion: reply.emotion,
        timestamp: Date.now(),
      }])
      forceUpdate(n => n + 1)
    })

    // Autosave: persist every 30s using the latest messages. Prior behaviour
    // saved only on /exit, so a SIGINT/terminal-close dropped recent words.
    // Saves via WithHistory so the message log is preserved too.
    const autosaveTimer = setInterval(() => {
      try {
        session.saveSessionWithHistory(undefined, messagesRef.current)
      } catch { /* swallow — autosave failures must not crash the UI */ }
    }, 30000)

    return () => {
      stopAutonomous()
      clearInterval(autosaveTimer)
      // Stop every session-owned interval so Ctrl+C / SIGINT exits the
      // process cleanly on the first signal instead of leaking timers.
      session.shutdown()
    }
  }, [session])

  // Keep messagesRef in sync with state so the autosave interval reads
  // the latest log instead of the closure snapshot taken at mount.
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const sys = (text: string) =>
    setMessages(prev => [...prev, { type: 'system', sender: 'system', text, timestamp: Date.now() }])

  const handleSubmit = async (value: string) => {
    const text = value.trim()
    if (!text) return
    setShowBanner(false)
    setInput('')

    if (text.startsWith('/')) {
      await handleCommand(text)
      return
    }

    setMessages(prev => [...prev, { type: 'user', sender: 'you', text, timestamp: Date.now() }])
    try {
      const reply = await session.handleUserMessage(text)
      if (reply?.response) {
        setMessages(prev => [...prev, {
          type: 'entity',
          sender: reply.name,
          text: reply.response,
          timestamp: Date.now(),
        }])
        forceUpdate(n => n + 1)
      }
    } catch (err) {
      sys(`error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleCommand = async (cmd: string) => {
    const [command, ...args] = cmd.slice(1).split(' ')

    switch (command) {
      case 'help':
        sys(HELP_TEXT)
        break
      case 'privacy': {
        const sub = args[0]
        if (sub === 'on' || sub === 'off') {
          const enabled = sub === 'on'
          session.privacySettings.outsideWeatherEnabled = enabled
          session.privacySettings.localContextEnabled = enabled
          sys(`privacy sensors: ${enabled ? 'enabled' : 'disabled'}`)
        } else {
          const w = session.privacySettings.outsideWeatherEnabled
          const l = session.privacySettings.localContextEnabled
          sys(`privacy: weather=${w}, local=${l}. Use /privacy on or /privacy off.`)
        }
        break
      }
      case 'status':
        sys(session.getStatusSummary())
        break
      case 'growth':
        sys(session.getGrowthSummary())
        break
      case 'clear':
        setMessages([])
        break
      case 'save': {
        const fname = args[0] || '.hi-introvert-session.json'
        session.saveSessionWithHistory(fname, messages)
        sys(`saved to ${fname}`)
        break
      }
      case 'load': {
        const fname = args[0]
        const result = session.loadSessionWithHistory(fname)
        if (result?.success) {
          if (result.messages) setMessages(result.messages as Message[])
          sys(`loaded: ${result.vocabularySize ?? '?'} words`)
        } else {
          sys(`load: ${result?.error ?? 'failed'}`)
        }
        break
      }
      case 'exit':
      case 'quit':
        session.saveSessionWithHistory(undefined, messages)
        session.shutdown()
        exit()
        break
      case 'lexicon':
        sys(session.getLexiconSummary())
        break
      case 'history':
      case 'spawn':
      case 'autosave':
        sys(`/${command} not yet wired in ink shell — coming soon`)
        break
      default:
        sys(`unknown command: ${command}. /help for commands.`)
    }
  }

  const companionEmotion = session.companionEntity?.entity?.emotion ?? { valence: 0, arousal: 0 }

  return (
    <Box flexDirection="column">
      {showBanner && <Banner weatherEnabled={session.privacySettings.outsideWeatherEnabled} />}
      <ChatView messages={messages} companionEmotion={companionEmotion} />
      <StatusRow vocabCount={vocabCount} skills={skills} env={env} />
      <InputBox value={input} onChange={setInput} onSubmit={handleSubmit} />
      <Footer battery={battery} version={VERSION} />
    </Box>
  )
}
