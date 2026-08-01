import React, { useState, useEffect } from 'react'
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
  const port = process.env.PORT || 40000;
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<{role: 'user'|'assistant', content: string}[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [currentStreamingMessage, setCurrentStreamingMessage] = useState('')
  const [currentProgress, setCurrentProgress] = useState('')

  // Dynamic user settings and stats
  const [modelName, setModelName] = useState('gemini-2.5-flash')
  const [providerName, setProviderName] = useState('')
  const [agentName, setAgentName] = useState('Nyxora')
  const [contextTokens, setContextTokens] = useState<number>(0)
  const [maxTokens, setMaxTokens] = useState<number>(128000)
  const [latencyMs, setLatencyMs] = useState<number>(0)
  const [totalSkillsCount, setTotalSkillsCount] = useState<number>(70)
  const [activeSkillsCount, setActiveSkillsCount] = useState<number>(70)
  const [sessionId] = useState(() => {
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const hh = String(now.getHours()).padStart(2, '0')
    const min = String(now.getMinutes()).padStart(2, '0')
    const ss = String(now.getSeconds()).padStart(2, '0')
    return `${yyyy}${mm}${dd}_${hh}${min}${ss}_tui`
  })
  const [workDir] = useState(() => {
    const cwd = process.cwd()
    const home = os.homedir()
    return cwd.startsWith(home) ? '~' + cwd.slice(home.length) : cwd
  })

  const refreshSettingsAndStats = async () => {
    try {
      const tokenFile = path.join(os.homedir(), '.nyxora', 'auth', 'auth.token')
      let token = ''
      if (fs.existsSync(tokenFile)) {
        token = fs.readFileSync(tokenFile, 'utf8').trim()
        if (token.startsWith('{')) {
          try { token = JSON.parse(token).token } catch {}
        }
      }
      const headers = token ? { 'x-nyxora-token': token } : {}

      // Measure ping latency to gateway if 0
      const pingStart = Date.now()
      const healthRes = await fetch(`http://localhost:${port}/api/health`, { headers }).catch(() => null)
      if (healthRes && healthRes.ok) {
        const elapsed = Date.now() - pingStart
        setLatencyMs(prev => (prev === 0 ? elapsed : prev))
      }

      // Fetch user configuration
      const configRes = await fetch(`http://localhost:${port}/api/config`, { headers }).catch(() => null)
      if (configRes && configRes.ok) {
        const cfg: any = await configRes.json()
        if (cfg?.llm?.model) setModelName(cfg.llm.model)
        if (cfg?.llm?.provider) setProviderName(cfg.llm.provider)
        if (cfg?.agent?.name) setAgentName(cfg.agent.name)
        if (cfg?.llm?.max_tokens) setMaxTokens(Number(cfg.llm.max_tokens) || 128000)
      }

      // Fetch live token and skill stats
      const statsRes = await fetch(`http://localhost:${port}/api/stats`, { headers }).catch(() => null)
      if (statsRes && statsRes.ok) {
        const stats: any = await statsRes.json()
        if (stats?.tokens !== undefined) setContextTokens(Number(stats.tokens) || 0)
        if (stats?.totalSkills !== undefined) setTotalSkillsCount(Number(stats.totalSkills) || 70)
        if (stats?.activeSkills !== undefined) setActiveSkillsCount(Number(stats.activeSkills) || 70)
      }
    } catch (e) {}
  }

  useEffect(() => {
    refreshSettingsAndStats()
    const timer = setInterval(refreshSettingsAndStats, 4000)
    return () => clearInterval(timer)
  }, [])

  const handleSubmit = async (val: string) => {
    if (!val.trim() || isLoading) return
    const messageStr = val.trim()
    setMessages(prev => [...prev, { role: 'user', content: messageStr }])
    setInput('')
    setIsLoading(true)
    setCurrentStreamingMessage('')
    setCurrentProgress('')

    const startTime = Date.now()

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
        session_id: sessionId,
        token,
      })

      const response = await fetch(`http://localhost:${port}/api/chat/stream?${params}`, {
        headers: { 'x-nyxora-token': token },
      })

      const connectLatency = Date.now() - startTime
      setLatencyMs(connectLatency)

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
       setMessages(prev => [...prev, { role: 'assistant', content: `Connection failed. Is the daemon running? (http://localhost:${port})` }])
    } finally {
      const totalLatency = Date.now() - startTime
      setLatencyMs(totalLatency)
      setIsLoading(false)
      setCurrentStreamingMessage('')
      setCurrentProgress('')
      refreshSettingsAndStats()
    }
  }

  const tokenPercentage = Math.min(100, Math.round((contextTokens / (maxTokens || 128000)) * 100))

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
          <Text color="yellowBright" bold> {agentName} Agent v1.0.0 </Text>
        </Box>

        {/* Left Column (Logo & Session) */}
        <Box flexDirection="column" width="30%">
          <Text color="yellow">{asciiLogo}</Text>
          <Box flexDirection="column" marginTop={1}>
            <Text color="yellowBright" bold>{modelName} <Text dimColor>· {agentName}</Text></Text>
            <Text dimColor>{workDir}</Text>
            <Text dimColor>Session: {sessionId}</Text>
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
            <Text dimColor>30 tools · {activeSkillsCount}/{totalSkillsCount} active skills · /help for commands</Text>
          </Box>
        </Box>
      </Box>

      {/* Chat History Area */}
      <Box flexDirection="column" flexGrow={1}>
        <Box marginBottom={1}>
          <Text color="white">Welcome to {agentName} Agent! Type your message or /help for commands.</Text>
        </Box>

        {messages.map((msg, idx) => (
          <Box key={idx} flexDirection="row">
            {msg.role === 'user' ? (
              <Text color="green" bold>❯ </Text>
            ) : (
              <Text color="yellowBright" bold>{agentName}: </Text>
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
                <Text color="yellowBright" bold>{agentName}: </Text>
                <Text>{currentStreamingMessage}</Text>
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* Status Bar */}
      <Box flexDirection="row" paddingBottom={0} marginBottom={0}>
        <Text color="white"> ⚑ </Text>
        <Text color="yellowBright" bold>{modelName}</Text>
        {providerName ? <Text dimColor> ({providerName})</Text> : null}
        <Text dimColor> | Context: {contextTokens.toLocaleString()} / {(maxTokens || 128000).toLocaleString()} tokens ({tokenPercentage}%) | Latency: {latencyMs}ms</Text>
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

