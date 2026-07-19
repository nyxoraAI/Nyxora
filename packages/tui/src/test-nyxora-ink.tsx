import React from 'react';
import { render, Text } from '@nyxora/ink';

console.log("Starting nyxora-ink app...");
render(<Text>Hello from nyxora-ink!</Text>).then(() => {
  console.log("Render function returned.");
}).catch(console.error);

const timer = setInterval(() => {}, 1000 * 60);
process.on('exit', () => clearInterval(timer));
