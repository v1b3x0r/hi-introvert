import React from 'react'
import { Box, Text } from 'ink'
import { COLORS } from './colors.js'

interface SkillSummary {
  conversation: number
  creativity: number
  empathy: number
  learning: number
}

interface EnvSummary {
  tempC: number | null
  humidity: number | null
  weather: string | null
}

interface StatusRowProps {
  vocabCount: number
  skills: SkillSummary | null
  env: EnvSummary
}

const pct = (n: number) => Math.round(n * 100).toString().padStart(2, '0')

export const StatusRow: React.FC<StatusRowProps> = ({ vocabCount, skills, env }) => (
  <Box flexDirection="column">
    <Text color={COLORS.systemText}>
      vocab {vocabCount}
      {skills && ` · skills cnv${pct(skills.conversation)} cre${pct(skills.creativity)} emp${pct(skills.empathy)} lrn${pct(skills.learning)}`}
    </Text>
    {(env.tempC !== null || env.weather) && (
      <Text color={COLORS.systemText} dimColor>
        {env.tempC !== null && `env ${env.tempC.toFixed(0)}°C`}
        {env.humidity !== null && ` · ${Math.round(env.humidity * 100)}% humid`}
        {env.weather && ` · ${env.weather}`}
      </Text>
    )}
  </Box>
)
