// apps/api/src/ws-server.js
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 5051 });

wss.on('connection', (ws) => {
  console.log('[WS] Client connected');
  ws.on('close', () => {
    console.log('[WS] Client disconnected');
  });
});

export function broadcastReminder(reminder) {
  const msg = JSON.stringify({ type: 'reminder', reminder });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(msg);
    }
  });
}

export default wss;
