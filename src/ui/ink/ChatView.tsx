import React from 'react'
import { Box, Text } from 'ink'
import { emotionToColor, COLORS, type Emotion } from './colors.js'
import { toText } from '../../utils/to-text.js'
import type { Message } from '../../types/index.js'

interface ChatViewProps {
  messages: Message[]
  companionEmotion: Emotion
}

export const ChatView: React.FC<ChatViewProps> = ({ messages, companionEmotion }) => {
  const recent = messages.slice(-30)
  return (
    <Box flexDirection="column" flexGrow={1}>
      {recent.map((m, i) => {
        const text = toText(m.text)
        const sender = toText(m.sender)
        if (m.type === 'user') {
          return (
            <Text key={i} color={COLORS.userText}>
              you: {text}
            </Text>
          )
        }
        if (m.type === 'entity') {
          return (
            <Text key={i} color={emotionToColor(companionEmotion)}>
              ◆ {sender}: {text}
            </Text>
          )
        }
        if (m.type === 'monologue') {
          return (
            <Text key={i} color={emotionToColor(companionEmotion)} italic>
              ◌ {text}
            </Text>
          )
        }
        return (
          <Text key={i} color={COLORS.systemText} dimColor>
            {text}
          </Text>
        )
      })}
    </Box>
  )
}
