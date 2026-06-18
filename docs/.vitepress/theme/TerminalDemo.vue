<template>
  <div class="terminal-mockup">
    <div class="terminal-header">
      <span class="dot red"></span>
      <span class="dot yellow"></span>
      <span class="dot green"></span>
      <span class="title">nyxora-runtime ~ ./agent.ts</span>
    </div>
    <div class="terminal-body">
      <div class="line"><span class="prompt">$</span> nyxora run agent.ts</div>
      <div class="line delay-1"><span class="tag reason">[Reasoning]</span> Checking wallet balance...</div>
      <div class="line delay-2"><span class="tag tool">[Tool]</span> Fetching token price from Uniswap V3...</div>
      <div class="line delay-3"><span class="tag exec">[Execution]</span> Preparing swap transaction (ETH -> USDC)</div>
      <div class="line delay-4"><span class="tag sec">[Security]</span> ⚠️ Awaiting human confirmation...</div>
    </div>
  </div>
</template>

<style scoped>
.terminal-mockup {
  border-radius: 8px;
  background: #1e1e1e;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
  overflow: hidden;
  font-family: 'Fira Code', 'JetBrains Mono', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #d4d4d4;
  margin: 2rem auto;
  max-width: 500px;
  width: 100%;
  border: 1px solid #333;
}

.terminal-header {
  background: #2d2d2d;
  padding: 10px 15px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid #333;
  position: relative;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 8px;
}

.dot.red { background: #ff5f56; }
.dot.yellow { background: #ffbd2e; }
.dot.green { background: #27c93f; }

.title {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  color: #888;
  font-size: 12px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.terminal-body {
  padding: 15px;
}

.line {
  margin-bottom: 4px;
  opacity: 0;
  animation: fadeIn 0.1s forwards;
}

.prompt { color: #50fa7b; font-weight: bold; margin-right: 8px; }
.tag { font-weight: bold; margin-right: 8px; }
.tag.reason { color: #8be9fd; }
.tag.tool { color: #bd93f9; }
.tag.exec { color: #ffb86c; }
.tag.sec { color: #ff5555; }

.delay-1 { animation-delay: 0.5s; }
.delay-2 { animation-delay: 1.5s; }
.delay-3 { animation-delay: 2.5s; }
.delay-4 { animation-delay: 3.5s; }

@keyframes fadeIn {
  to { opacity: 1; }
}
</style>
