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
      <Text color={COLORS.systemText} dimColor>  ◌ a small mind learning to speak.</Text>
      <Text> </Text>
      <Text color={COLORS.systemText}>Tips:</Text>
      <Text color={COLORS.systemText}>  · type anything — english, thai, anything</Text>
      <Text color={COLORS.systemText}>  · /help to list commands</Text>
      <Text color={COLORS.systemText}>  · vocabulary grows as you teach it</Text>
      {weatherEnabled && (
        <Text color={COLORS.systemText} dimColor>
          ※ wttr.in fetches local weather. /privacy to disable.
        </Text>
      )}
    </Box>
  </Box>
)
