process.env.YPERSISTENCE = './storage';
const WebSocket = require('ws');
const http = require('http');
const { setupWSConnection } = require('y-websocket/bin/utils');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Whiteboard sync server is running');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  setupWSConnection(ws, req);
});

const PORT = 1234;
server.listen(PORT, () => {
  console.log(`Whiteboard sync server running on ws://localhost:${PORT}`);
});