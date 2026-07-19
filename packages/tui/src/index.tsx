import React, { useState, useEffect } from 'react';
import { render, Box, Text, useApp, useInput, ScrollBox } from '@nyxora/ink';
import TextInput from 'ink-text-input';
import { MessageLine } from './components/messageLine.js';
import { Banner } from './components/branding.js';
import { DARK_THEME } from './theme.js';
import type { Msg } from './types.js';

function App() {
  const { exit } = useApp();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>([
    { kind: 'intro', role: 'system', text: '' }
  ]);

  useInput((char, key) => {
    if (key.escape) {
      exit();
      process.exit(0);
    }
  });

  const handleSubmit = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return;
    
    setInput('');
    const newMsg: Msg = { role: 'user', text: trimmed };
    setMessages(prev => [...prev, newMsg]);

    // Mock response
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', text: `You said: ${trimmed}` }
      ]);
    }, 500);
  };

  return (
    <Box flexDirection="column" paddingX={1} height={40}>
      <ScrollBox flexDirection="column" flexGrow={1} flexShrink={1}>
        <Banner t={DARK_THEME} />
        
        <Box flexDirection="column">
          {messages.map((msg, index) => (
            <MessageLine 
              key={index}
              cols={80}
              msg={msg}
              t={DARK_THEME}
            />
          ))}
        </Box>
      </ScrollBox>

      <Box marginTop={1}>
        <Text color={DARK_THEME.color.primary}>{DARK_THEME.brand.prompt} </Text>
        <TextInput 
          value={input} 
          onChange={setInput} 
          onSubmit={handleSubmit} 
        />
      </Box>
    </Box>
  );
}

process.on('uncaughtException', console.error);
process.on('unhandledRejection', console.error);

export async function runTUI(token?: string) {
  console.log("Starting TUI renderer...");
  console.log("isTTY?", process.stdout.isTTY);
  try {
    await render(<App />, { patchConsole: false } as any);
    console.log("Render completed successfully!");
  } catch (e) {
    console.error("Render failed:", e);
  }

  // Keep process alive until exit() is called
  const timer = setInterval(() => {}, 1000 * 60 * 60);

  // Stop timer when process exits
  process.on('exit', () => clearInterval(timer));
}

// Support running directly with tsx
runTUI().catch(console.error);
