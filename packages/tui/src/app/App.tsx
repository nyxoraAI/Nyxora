import React, { useState, useEffect } from 'react'
import { Box, useInput, useApp, useStdout } from 'ink'
import { MainArea } from '../components/MainArea.js'

export function App() {
  const { exit } = useApp()
  const { stdout } = useStdout()
  const [height, setHeight] = useState(stdout.rows || 24)

  useEffect(() => {
    const onResize = () => setHeight(stdout.rows)
    stdout.on('resize', onResize)
    return () => {
      stdout.off('resize', onResize)
    }
  }, [stdout])

  // Keep event loop alive and explicitly handle quitting
  useEffect(() => {
    const timer = setInterval(() => {}, 1000)
    return () => clearInterval(timer)
  }, [])

  useInput((input, key) => {
    // Check for Ctrl+C
    if (key.ctrl && input === 'c') {
      exit()
    }
  })

  return (
    <Box 
      width="100%" 
      minHeight={height}
      flexDirection="column" 
    >
      <MainArea />
    </Box>
  )
}
