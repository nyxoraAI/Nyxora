#!/usr/bin/env node
process.env.TS_NODE_SKIP_IGNORE = "true";
process.env.TS_NODE_TRANSPILE_ONLY = "true";
require('ts-node/register');
require('../launcher.ts');
