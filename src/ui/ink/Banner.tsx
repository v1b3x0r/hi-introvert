import React from 'react'
import { Box, Text } from 'ink'
import Gradient from 'ink-gradient'
import BigText from 'ink-big-text'
import { COLORS } from './colors.js'

interface BannerProps {
  weatherEnabled: boolean
}

export const Banner: React.FC<BannerProps> = ({ weatherEnabled }) => (
  <Box flexDirection="column" marginBottom={1}>
    <Gradient name="atlas">
      <BigText text="hi-introvert" font="tiny" />
    </Gradient>
    <Box flexDirection="column" marginLeft={2}>
      <Text color={COLORS.systemText}>Tips:</Text>
      <Text color={COLORS.systemText}>  · คุยภาษาไทย หรือ English ก็ได้</Text>
      <Text color={COLORS.systemText}>  · /help เพื่อดูคำสั่งทั้งหมด</Text>
      <Text color={COLORS.systemText}>  · vocab โตตามที่คุยกัน</Text>
      {weatherEnabled && (
        <Text color={COLORS.systemText} dimColor>
          wttr.in fetches local weather. /privacy to disable.
        </Text>
      )}
    </Box>
  </Box>
)
