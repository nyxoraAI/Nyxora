import React, { useState } from 'react'
import { Box, Text } from 'ink'
import fs from 'fs'
import path from 'path'
import os from 'os'
import TextInput from 'ink-text-input'

const asciiBanner = `   _   __                           
  / | / /_  ___  ______  _________ _
 /  |/ / / / / |/ / __ \\/ ___/ __ \`/
/ /|  / /_/ />  </ /_/ / /  / /_/ / 
/_/ |_/\\__, /_/|_|\\____/_/   \\__,_/  
      /____/                         `

const asciiLogo = `
      .----.
   _.'__    '.
  .--(Q)(OK)---/$\\
.' @          /$$$\\
:         _.-'$$$$$
 '-.__.-'
`

export function MainArea() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<{role: 'user'|'assistant', content: string}[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [currentStreamingMessage, setCurrentStreamingMessage] = useState('')
  const [currentProgress, setCurrentProgress] = useState('')

  const handleSubmit = async (val: string) => {
    if (!val.trim() || isLoading) return
    const messageStr = val.trim()
    setMessages(prev => [...prev, { role: 'user', content: messageStr }])
    setInput('')
    setIsLoading(true)
    setCurrentStreamingMessage('')
    setCurrentProgress('')

    try {
      const tokenFile = path.join(os.homedir(), '.nyxora', 'auth', 'auth.token')
      if (!fs.existsSync(tokenFile)) {
        setMessages(prev => [...prev, { role: 'assistant', content: '❌ Nyxora daemon is not running. Please start it with `nyxora start`.' }])
        setIsLoading(false)
        return
      }

      let token = fs.readFileSync(tokenFile, 'utf8').trim()
      if (token.startsWith('{')) {
        try {
          const parsed = JSON.parse(token)
          token = parsed.token
        } catch {}
      }

      const params = new URLSearchParams({
        message: messageStr,
        session_id: 'tui-chat',
        token,
      })

      const response = await fetch(`http://localhost:3000/api/chat/stream?${params}`, {
        headers: { 'x-nyxora-token': token },
      })

      if (!response.ok) {
        setMessages(prev => [...prev, { role: 'assistant', content: `API Error: ${response.status}. Is the daemon running?` }])
        setIsLoading(false)
        return
      }

      const decoder = new TextDecoder()
      let finalReply = ''

      if (response.body && typeof (response.body as any)[Symbol.asyncIterator] === 'function') {
        let buffer = ''
        for await (const chunk of (response.body as any)) {
          const textChunk = typeof chunk === 'string' ? chunk : decoder.decode(chunk as any, { stream: true })
          buffer += textChunk
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const raw = line.slice(6).trim()
            if (raw === '[DONE]') break
            try {
              const data = JSON.parse(raw)
              if (data.progress) {
                setCurrentProgress(data.progress)
              }
              if (data.chunk) {
                if (data.chunk === '[CLEAR_STREAM]' || data.chunk === '[TOOL_CALL_FINISHED]') {
                  continue
                }
                setCurrentProgress('') // Clear progress when text arrives
                finalReply += data.chunk
                setCurrentStreamingMessage(finalReply)
              }
            } catch (err) {}
          }
        }
      }
      setMessages(prev => [...prev, { role: 'assistant', content: finalReply }])
    } catch (e: any) {
       setMessages(prev => [...prev, { role: 'assistant', content: 'Connection failed. Is the daemon running? (http://localhost:3000)' }])
    } finally {
      setIsLoading(false)
      setCurrentStreamingMessage('')
      setCurrentProgress('')
    }
  }

  return (
    <Box flexDirection="column" flexGrow={1} width="100%">
      
      {/* Banner */}
      <Box>
        <Text color="yellowBright" bold>{asciiBanner}</Text>
      </Box>

      {/* Info Box */}
      <Box borderStyle="round" borderColor="yellow" flexDirection="row" padding={1}>
        {/* Box Title hack */}
        <Box position="absolute" top={-1} right={2}>
          <Text color="yellowBright" bold> Nyxora Agent v1.0.0 </Text>
        </Box>

        {/* Left Column (Logo & Session) */}
        <Box flexDirection="column" width="30%">
          <Text color="yellow">{asciiLogo}</Text>
          <Box flexDirection="column" marginTop={1}>
            <Text color="yellowBright" bold>claude-opus-4.6 <Text dimColor>· Nyxora</Text></Text>
            <Text dimColor>~/Nyxora</Text>
            <Text dimColor>Session: 20260723_004500_nyx</Text>
          </Box>
        </Box>

        {/* Right Column (Tools & Skills) */}
        <Box flexDirection="column" flexGrow={1} paddingLeft={2}>
          <Box marginBottom={1} flexDirection="column">
            <Text color="yellowBright" bold>Available Tools</Text>
            <Text color="yellow">browser: <Text color="white">browser_back, browser_click, ...</Text></Text>
            <Text color="yellow">file: <Text color="white">patch, read_file, search_files, write_file</Text></Text>
            <Text dimColor>(and 10 more toolsets...)</Text>
          </Box>
          
          <Box marginBottom={1} flexDirection="column">
            <Text color="yellowBright" bold>Available Skills</Text>
            <Text color="yellow">autonomous: <Text color="white">claude-code, nyxora-agent</Text></Text>
            <Text color="yellow">developer: <Text color="white">code-review, plan, debug</Text></Text>
          </Box>

          <Box flexDirection="column">
            <Text color="yellowBright" bold>Profile: <Text color="white">custom</Text></Text>
            <Text dimColor>30 tools · 70 skills · /help for commands</Text>
          </Box>
        </Box>
      </Box>

      {/* Chat History Area */}
      <Box flexDirection="column" flexGrow={1}>
        <Box marginBottom={1}>
          <Text color="white">Welcome to Nyxora Agent! Type your message or /help for commands.</Text>
        </Box>

        {messages.map((msg, idx) => (
          <Box key={idx} flexDirection="row">
            {msg.role === 'user' ? (
              <Text color="green" bold>❯ </Text>
            ) : (
              <Text color="yellowBright" bold>Nyxora: </Text>
            )}
            <Text>{msg.content}</Text>
          </Box>
        ))}
        {isLoading && (
          <Box flexDirection="column">
            {currentProgress && (
              <Box flexDirection="row">
                <Text color="cyan" dimColor>⚙ {currentProgress}</Text>
              </Box>
            )}
            {currentStreamingMessage && (
              <Box flexDirection="row">
                <Text color="yellowBright" bold>Nyxora: </Text>
                <Text>{currentStreamingMessage}</Text>
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* Status Bar */}
      <Box flexDirection="row" paddingBottom={0} marginBottom={0}>
        <Text color="white"> ⚑ </Text>
        <Text color="yellowBright" bold>claude-opus-4.6</Text>
        <Text dimColor> | Context: 4,028 / 128,000 tokens (3%) | Latency: 420ms</Text>
      </Box>

      {/* Input Area */}
      <Box flexDirection="row" borderStyle="single" borderTop={true} borderBottom={true} borderLeft={false} borderRight={false} borderColor="yellow" paddingY={0}>
        <Text color="white" bold>❯ </Text>
        <TextInput 
          placeholder="How can I help you?"
          value={input} 
          onChange={setInput} 
          onSubmit={handleSubmit} 
        />
      </Box>
    </Box>
  )
}
