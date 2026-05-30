#!/usr/bin/env node
const path = require('path');
process.env.TS_NODE_SKIP_IGNORE = "true";
process.env.TS_NODE_TRANSPILE_ONLY = "true";
process.env.TS_NODE_PROJECT = path.join(__dirname, '../tsconfig.json');
require('ts-node/register');

const args = process.argv.slice(2);
if (args[0] === 'setup') {
  require('../packages/core/src/gateway/cli.ts');
} else {
  require('../launcher.ts');
}
