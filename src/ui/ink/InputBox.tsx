import React from 'react'
import { Box, Text } from 'ink'
import TextInput from 'ink-text-input'
import { COLORS } from './colors.js'

interface InputBoxProps {
  value: string
  onChange: (v: string) => void
  onSubmit: (v: string) => void
}

export const InputBox: React.FC<InputBoxProps> = ({ value, onChange, onSubmit }) => (
  <Box borderStyle="round" borderColor={COLORS.border} paddingX={1}>
    <Text color={COLORS.prompt}>{'> '}</Text>
    <TextInput value={value} onChange={onChange} onSubmit={onSubmit} />
  </Box>
)
