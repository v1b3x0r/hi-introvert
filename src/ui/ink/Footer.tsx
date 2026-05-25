import React from 'react'
import { Box, Text } from 'ink'
import path from 'path'
import { COLORS } from './colors.js'

interface FooterProps {
  battery: number | null
  version: string
}

export const Footer: React.FC<FooterProps> = ({ battery, version }) => {
  const cwd = path.basename(process.cwd()) || '/'
  const batteryText = battery !== null ? `battery ${Math.round(battery * 100)}%` : null
  return (
    <Box>
      <Text color={COLORS.footer} dimColor>
        ~{cwd}
        {batteryText && ` · ${batteryText}`}
        {` · v${version}`}
      </Text>
    </Box>
  )
}
