import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 3000;
const app = express();

// Servir arquivos estáticos do frontend
app.use(express.static(join(__dirname, '../dist')));
app.use(express.static(join(__dirname, '..')));

// Rota catch-all para SPA
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../index.html'));
});

const server = createServer(app);
const wss = new WebSocketServer({ server });

const rooms = new Map();
const clients = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (rooms.has(code));
  return code;
}

function broadcast(room, message, excludeId = null) {
  room.clients.forEach(clientId => {
    if (clientId !== excludeId) {
      const client = clients.get(clientId);
      if (client && client.ws.readyState === 1) {
        client.ws.send(JSON.stringify(message));
      }
    }
  });
}

wss.on('connection', (ws) => {
  const clientId = Math.random().toString(36).substring(7);
  clients.set(clientId, { ws, roomCode: null });

  ws.send(JSON.stringify({ type: 'connected', clientId }));

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'create_room':
          const roomCode = message.roomCode || generateRoomCode();
          const room = {
            code: roomCode,
            name: message.name || 'Unnamed Room',
            hostId: clientId,
            clients: [clientId],
            config: message.config,
            password: message.password || null,
            createdAt: Date.now()
          };
          rooms.set(roomCode, room);
          clients.get(clientId).roomCode = roomCode;
          
          ws.send(JSON.stringify({
            type: 'room_created',
            roomCode,
            isHost: true
          }));
          break;

        case 'join_room':
          const targetRoom = rooms.get(message.roomCode);
          if (!targetRoom) {
            ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
            break;
          }
          
          if (targetRoom.password && targetRoom.password !== message.password) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid password' }));
            break;
          }

          targetRoom.clients.push(clientId);
          clients.get(clientId).roomCode = message.roomCode;
          
          ws.send(JSON.stringify({
            type: 'room_joined',
            roomCode: message.roomCode,
            isHost: false,
            hostId: targetRoom.hostId,
            config: targetRoom.config
          }));

          broadcast(targetRoom, {
            type: 'peer_joined',
            peerId: clientId
          }, clientId);
          break;

        case 'list_rooms':
          const publicRooms = Array.from(rooms.values())
            .filter(r => !r.password)
            .map(r => ({
              code: r.code,
              name: r.name || 'Unnamed Room',
              players: r.clients.length,
              config: r.config,
              createdAt: r.createdAt
            }));
          
          ws.send(JSON.stringify({
            type: 'rooms_list',
            rooms: publicRooms
          }));
          break;

        case 'webrtc_offer':
        case 'webrtc_answer':
        case 'webrtc_ice':
          const client = clients.get(message.targetId);
          if (client && client.ws.readyState === 1) {
            client.ws.send(JSON.stringify({
              ...message,
              fromId: clientId
            }));
          }
          break;

        case 'ping_server':
          // Responde imediatamente para medir latência do WebSocket
          ws.send(JSON.stringify({
            type: 'pong_server',
            timestamp: message.timestamp
          }));
          break;

        case 'leave_room':
          const userRoom = rooms.get(clients.get(clientId).roomCode);
          if (userRoom) {
            userRoom.clients = userRoom.clients.filter(id => id !== clientId);
            
            if (userRoom.clients.length === 0) {
              rooms.delete(userRoom.code);
            } else if (userRoom.hostId === clientId) {
              userRoom.hostId = userRoom.clients[0];
              broadcast(userRoom, {
                type: 'new_host',
                hostId: userRoom.hostId
              });
            }
            
            broadcast(userRoom, {
              type: 'peer_left',
              peerId: clientId
            });
          }
          clients.get(clientId).roomCode = null;
          break;
      }
    } catch (err) {
      console.error('Error handling message:', err);
    }
  });

  ws.on('close', () => {
    const client = clients.get(clientId);
    if (client && client.roomCode) {
      const room = rooms.get(client.roomCode);
      if (room) {
        room.clients = room.clients.filter(id => id !== clientId);
        
        if (room.clients.length === 0) {
          rooms.delete(room.code);
        } else if (room.hostId === clientId) {
          room.hostId = room.clients[0];
          broadcast(room, {
            type: 'new_host',
            hostId: room.hostId
          });
        }
        
        broadcast(room, {
          type: 'peer_left',
          peerId: clientId
        });
      }
    }
    clients.delete(clientId);
  });
});

server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
