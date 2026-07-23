import React from 'react'
import { render } from 'ink'
import { App } from './app/App.js'
import dns from 'dns'

dns.setDefaultResultOrder('ipv4first')

export function startTui() {
  const { waitUntilExit } = render(<App />)
  
  return waitUntilExit()
}

// If run directly for testing
if (process.argv[1] === new URL(import.meta.url).pathname) {
  startTui()
}
