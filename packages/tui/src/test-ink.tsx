import React from 'react';
import { render, Text } from 'ink';

console.log("Starting minimal Ink app...");
render(<Text>Hello from minimal Ink!</Text>);
console.log("Render function returned.");

const timer = setInterval(() => {}, 1000 * 60);
process.on('exit', () => clearInterval(timer));
