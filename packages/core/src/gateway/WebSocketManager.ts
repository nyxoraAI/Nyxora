import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { validateToken } from '../utils/state';
import { IncomingMessage } from 'http';

interface BufferedLog {
  timestamp: number;
  message: string;
  level: string;
}

export class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Map<string, WebSocket> = new Map();
  private ringBuffer: Map<string, { logs: BufferedLog[]; timeout: NodeJS.Timeout }> = new Map();

  constructor(server: http.Server) {
    this.wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', async (request: IncomingMessage, socket, head) => {
      try {
        const url = new URL(request.url || '', `http://${request.headers.host}`);
        if (url.pathname !== '/ws/stream') {
          socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
          socket.destroy();
          return;
        }

        const traceId = url.searchParams.get('traceId');
        const token = url.searchParams.get('token');

        if (!traceId || !token) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        // Validate Auth Token during Upgrade Handshake
        if (!validateToken(token)) {
          socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
          socket.destroy();
          return;
        }

        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit('connection', ws, request, traceId);
        });
      } catch (e) {
        socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
        socket.destroy();
      }
    });

    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage, traceId: string) => {
      this.clients.set(traceId, ws);

      ws.on('close', () => {
        this.clients.delete(traceId);
      });

      // Flush Ring Buffer if it exists
      const buffer = this.ringBuffer.get(traceId);
      if (buffer) {
        clearTimeout(buffer.timeout);
        for (const log of buffer.logs) {
          ws.send(JSON.stringify(log));
        }
        this.ringBuffer.delete(traceId);
      }
    });
  }

  public broadcast(traceId: string, message: string, level: string = 'info') {
    const payload = { timestamp: Date.now(), message, level };
    const ws = this.clients.get(traceId);
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      // Client is connected, send directly
      ws.send(JSON.stringify(payload));
    } else {
      // Client not connected yet, buffer the log (Anti-Race Condition)
      let buffer = this.ringBuffer.get(traceId);
      if (!buffer) {
        buffer = {
          logs: [],
          timeout: setTimeout(() => {
            // Drop buffer after 5 seconds if client never connects
            this.ringBuffer.delete(traceId);
          }, 5000)
        };
        this.ringBuffer.set(traceId, buffer);
      }
      buffer.logs.push(payload);
    }
  }

  public broadcastAll(message: string, level: string = 'info') {
    const payload = { timestamp: Date.now(), message, level };
    const payloadStr = JSON.stringify(payload);
    for (const [_, ws] of this.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payloadStr);
      }
    }
  }
}

// Global instance to be initialized in server.ts
export let wsManager: WebSocketManager | null = null;

export function initWebSocket(server: http.Server) {
  wsManager = new WebSocketManager(server);
  return wsManager;
}
