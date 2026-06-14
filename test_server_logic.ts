import express from 'express';
import { loadRpcConfig, saveRpcConfig } from './packages/core/src/config/parser';

const app = express();
app.use(express.json());

app.post('/api/rpc', (req, res) => {
  try {
    const currentRpc = loadRpcConfig();
    const newRpc = { ...currentRpc, ...req.body };
    saveRpcConfig(newRpc);
    res.json({ success: true, newRpc });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const request = require('supertest');
request(app)
  .post('/api/rpc')
  .send({ arbitrum_sepolia: 'https://test-via-api' })
  .expect(200)
  .end((err, res) => {
    if (err) throw err;
    console.log(res.body);
  });
