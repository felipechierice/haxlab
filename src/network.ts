import { BinaryProtocol } from './binary-protocol.js';

export interface NetworkMessage {
  type: string;
  [key: string]: any;
}

export interface PeerConnection {
  id: string;
  connection: RTCPeerConnection;
  dataChannel: RTCDataChannel | null;
}

export interface PlayerInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  kick: boolean;
  kickCharge?: number; // Para o modo carregável
  isChargingKick?: boolean; // Para visualização do carregamento
}

export interface NetworkedPlayer {
  id: string;
  name: string;
  team: 'red' | 'blue' | 'spectator';
  input: PlayerInput;
}

export class NetworkManager {
  private ws: WebSocket | null = null;
  private clientId: string = '';
  private roomCode: string = '';
  private isHost: boolean = false;
  private peers: Map<string, PeerConnection> = new Map();
  private onStateUpdateCallback: ((state: any) => void) | null = null;
  private onPlayerJoinCallback: ((player: NetworkedPlayer) => void) | null = null;
  private onPlayerLeaveCallback: ((playerId: string) => void) | null = null;
  private onInputCallback: ((playerId: string, input: PlayerInput) => void) | null = null;
  private onDataChannelReadyCallback: (() => void) | null = null;
  private onRoomUpdateCallback: ((players: NetworkedPlayer[]) => void) | null = null;
  private onTeamChangeCallback: ((playerId: string, team: 'red' | 'blue' | 'spectator') => void) | null = null;
  private onGameStartCallback: (() => void) | null = null;
  private onGamePauseCallback: ((running: boolean) => void) | null = null;
  private onGameStopCallback: (() => void) | null = null;
  private onChatMessageCallback: ((playerName: string, message: string, senderId: string) => void) | null = null;
  private onConsoleEventCallback: ((text: string, type: 'event' | 'chat') => void) | null = null;
  private onRoomsListCallback: ((rooms: any[]) => void) | null = null;
  private pendingPlayerInfo: { name: string, team: 'red' | 'blue' | 'spectator' } | null = null;
  private pings: Map<string, number> = new Map(); // peerId -> ping em ms
  private pingIntervals: Map<string, number> = new Map(); // peerId -> intervalId
  private pendingPings: Map<string, number> = new Map(); // peerId -> timestamp do ping enviado
  private onPingUpdateCallback: ((peerId: string, ping: number) => void) | null = null;
  private onServerPongCallback: ((ping: number) => void) | null = null;
  private lastBroadcastTime: Map<string, number> = new Map(); // peerId -> último tempo de broadcast
  
  // Heartbeat system
  private lastPeerActivity: Map<string, number> = new Map(); // peerId -> timestamp da última atividade
  private heartbeatCheckInterval: number | null = null;
  private readonly PEER_TIMEOUT_MS = 5000; // 5 segundos de timeout
  private readonly HEARTBEAT_CHECK_INTERVAL_MS = 1000; // Verificar a cada 1 segundo

  constructor(private serverUrl: string = NetworkManager.getDefaultServerUrl()) {}

  private static getDefaultServerUrl(): string {
    // Se estiver rodando em localhost, usa ws://localhost:3000
    // Caso contrário, usa o protocolo correto baseado na URL atual
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'ws://localhost:3000';
    }
    
    // Em produção (playit.gg ou outro host), usa o mesmo host com protocolo ws/wss
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }

  connect(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.serverUrl);

      this.ws.onopen = () => {
        console.log('Connected to signaling server');
      };

      this.ws.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        await this.handleSignalingMessage(message);
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };

      this.ws.onclose = () => {
        console.log('Disconnected from signaling server');
      };

      const checkConnection = setInterval(() => {
        if (this.clientId) {
          clearInterval(checkConnection);
          resolve(this.clientId);
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkConnection);
        if (!this.clientId) {
          reject(new Error('Connection timeout'));
        }
      }, 5000);
    });
  }

  private async handleSignalingMessage(message: NetworkMessage) {
    switch (message.type) {
      case 'connected':
        this.clientId = message.clientId;
        break;

      case 'room_created':
        this.roomCode = message.roomCode;
        this.isHost = true;
        break;

      case 'room_joined':
        this.roomCode = message.roomCode;
        this.isHost = false;
        await this.connectToPeer(message.hostId);
        break;

      case 'peer_joined':
        if (this.isHost) {
          await this.createOfferForPeer(message.peerId);
        }
        break;

      case 'peer_left':
        this.removePeer(message.peerId);
        if (this.onPlayerLeaveCallback) {
          this.onPlayerLeaveCallback(message.peerId);
        }
        break;

      case 'webrtc_offer':
        await this.handleOffer(message);
        break;

      case 'webrtc_answer':
        await this.handleAnswer(message);
        break;

      case 'webrtc_ice':
        await this.handleIceCandidate(message);
        break;

      case 'rooms_list':
        if (this.onRoomsListCallback) {
          this.onRoomsListCallback(message.rooms);
        }
        break;

      case 'pong_server':
        // Resposta do servidor para ping do WebSocket
        if (this.onServerPongCallback && message.timestamp) {
          const ping = Date.now() - message.timestamp;
          this.onServerPongCallback(ping);
        }
        break;
    }
  }

  private createPeerConnection(peerId: string): RTCPeerConnection {
    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    const pc = new RTCPeerConnection(config);

    pc.onicecandidate = (event) => {
      if (event.candidate && this.ws) {
        this.ws.send(JSON.stringify({
          type: 'webrtc_ice',
          targetId: peerId,
          candidate: event.candidate
        }));
      }
    };

    pc.ondatachannel = (event) => {
      const dataChannel = event.channel;
      this.setupDataChannel(peerId, dataChannel);
    };

    return pc;
  }

  private setupDataChannel(peerId: string, dataChannel: RTCDataChannel) {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.dataChannel = dataChannel;
    }

    // Configurar para modo binário (ArrayBuffer)
    dataChannel.binaryType = 'arraybuffer';

    dataChannel.onopen = () => {
      console.log(`Data channel opened with ${peerId}`);
      
      // Registra atividade inicial do peer
      this.lastPeerActivity.set(peerId, Date.now());
      
      // Se for host, inicia verificação de heartbeat (apenas uma vez)
      if (this.isHost && !this.heartbeatCheckInterval) {
        this.startHeartbeatCheck();
      }
      
      // Se for client e tem info pendente, enviar agora
      if (!this.isHost && this.pendingPlayerInfo) {
        console.log('Sending pending player info:', this.pendingPlayerInfo);
        this.sendPlayerInfo(this.pendingPlayerInfo.name, this.pendingPlayerInfo.team);
        this.pendingPlayerInfo = null;
      }
      
      // Iniciar medição de ping
      this.startPingMeasurement(peerId);
      
      // Notificar que o canal está pronto
      if (this.onDataChannelReadyCallback) {
        this.onDataChannelReadyCallback();
      }
    };

    dataChannel.onmessage = (event) => {
      // Decodifica mensagem binária ou JSON (fallback)
      let message: any;
      if (event.data instanceof ArrayBuffer) {
        message = BinaryProtocol.decode(event.data);
      } else {
        // Fallback para JSON (compatibilidade)
        message = JSON.parse(event.data);
      }
      // Atualiza timestamp de atividade do peer (heartbeat implícito)
      this.lastPeerActivity.set(peerId, Date.now());
      this.handleDataChannelMessage(peerId, message);
    };
  }

  private handleDataChannelMessage(peerId: string, message: any) {
    switch (message.type) {
      case 'state_update':
        if (this.onStateUpdateCallback) {
          this.onStateUpdateCallback(message.state);
        }
        break;

      case 'player_input':
        if (this.onInputCallback) {
          this.onInputCallback(peerId, message.input);
        }
        break;

      case 'player_info':
        if (this.onPlayerJoinCallback) {
          this.onPlayerJoinCallback({
            id: message.clientId || peerId,
            name: message.name,
            team: message.team,
            input: { up: false, down: false, left: false, right: false, kick: false }
          });
        }
        break;

      case 'room_update':
        if (this.onRoomUpdateCallback) {
          this.onRoomUpdateCallback(message.players);
        }
        break;

      case 'team_change':
        if (this.onTeamChangeCallback) {
          this.onTeamChangeCallback(message.playerId, message.team);
        }
        break;

      case 'game_start':
        if (this.onGameStartCallback) {
          this.onGameStartCallback();
        }
        break;

      case 'game_pause':
        if (this.onGamePauseCallback) {
          this.onGamePauseCallback(message.running);
        }
        break;

      case 'game_stop':
        if (this.onGameStopCallback) {
          this.onGameStopCallback();
        }
        break;

      case 'chat_message':
        if (this.onChatMessageCallback) {
          this.onChatMessageCallback(message.playerName, message.message, peerId);
        }
        break;

      case 'console_event':
        if (this.onConsoleEventCallback) {
          this.onConsoleEventCallback(message.text, message.eventType);
        }
        break;

      case 'ping':
        // Responder com pong
        this.sendToPeer(peerId, { type: 'pong', timestamp: message.timestamp });
        break;

      case 'pong':
        // Calcular ping
        const sentTime = this.pendingPings.get(peerId);
        if (sentTime !== undefined) {
          const ping = Date.now() - sentTime;
          this.pings.set(peerId, ping);
          this.pendingPings.delete(peerId);
          if (this.onPingUpdateCallback) {
            this.onPingUpdateCallback(peerId, ping);
          }
          // Se for host, broadcast o ping para todos os outros peers (máximo 1x por segundo)
          if (this.isHost) {
            const now = Date.now();
            const lastBroadcast = this.lastBroadcastTime.get(peerId) || 0;
            if (now - lastBroadcast >= 1000) {
              this.broadcastPingUpdate(peerId, ping);
              this.lastBroadcastTime.set(peerId, now);
            }
          }
        }
        break;

      case 'ping_broadcast':
        // Client recebe ping de outro jogador do host
        if (!this.isHost && message.playerId && message.ping !== undefined) {
          this.pings.set(message.playerId, message.ping);
          if (this.onPingUpdateCallback) {
            this.onPingUpdateCallback(message.playerId, message.ping);
          }
        }
        break;
    }
  }

  private async createOfferForPeer(peerId: string) {
    const pc = this.createPeerConnection(peerId);
    const dataChannel = pc.createDataChannel('game');
    
    this.peers.set(peerId, { id: peerId, connection: pc, dataChannel });
    this.setupDataChannel(peerId, dataChannel);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    if (this.ws) {
      this.ws.send(JSON.stringify({
        type: 'webrtc_offer',
        targetId: peerId,
        offer: offer
      }));
    }
  }

  private async connectToPeer(peerId: string) {
    const pc = this.createPeerConnection(peerId);
    this.peers.set(peerId, { id: peerId, connection: pc, dataChannel: null });
  }

  private async handleOffer(message: NetworkMessage) {
    const peerId = message.fromId;
    let pc = this.peers.get(peerId)?.connection;
    
    if (!pc) {
      pc = this.createPeerConnection(peerId);
      this.peers.set(peerId, { id: peerId, connection: pc, dataChannel: null });
    }

    await pc.setRemoteDescription(new RTCSessionDescription(message.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    if (this.ws) {
      this.ws.send(JSON.stringify({
        type: 'webrtc_answer',
        targetId: peerId,
        answer: answer
      }));
    }
  }

  private async handleAnswer(message: NetworkMessage) {
    const peer = this.peers.get(message.fromId);
    if (peer) {
      await peer.connection.setRemoteDescription(new RTCSessionDescription(message.answer));
    }
  }

  private async handleIceCandidate(message: NetworkMessage) {
    const peer = this.peers.get(message.fromId);
    if (peer && message.candidate) {
      await peer.connection.addIceCandidate(new RTCIceCandidate(message.candidate));
    }
  }

  private removePeer(peerId: string) {
    const peer = this.peers.get(peerId);
    if (peer) {
      this.stopPingMeasurement(peerId);
      this.lastPeerActivity.delete(peerId);
      peer.dataChannel?.close();
      peer.connection.close();
      this.peers.delete(peerId);
    }
  }

  // Heartbeat: verifica periodicamente se algum peer está inativo
  private startHeartbeatCheck(): void {
    if (this.heartbeatCheckInterval) return;
    
    this.heartbeatCheckInterval = window.setInterval(() => {
      const now = Date.now();
      const timedOutPeers: string[] = [];
      
      this.lastPeerActivity.forEach((lastActivity, peerId) => {
        const timeSinceActivity = now - lastActivity;
        if (timeSinceActivity > this.PEER_TIMEOUT_MS) {
          console.log(`Peer ${peerId} timed out (${timeSinceActivity}ms since last activity)`);
          timedOutPeers.push(peerId);
        }
      });
      
      // Remove peers que deram timeout
      for (const peerId of timedOutPeers) {
        this.removePeer(peerId);
        if (this.onPlayerLeaveCallback) {
          this.onPlayerLeaveCallback(peerId);
        }
      }
      
      // Se não há mais peers, para o check
      if (this.peers.size === 0 && this.heartbeatCheckInterval) {
        this.stopHeartbeatCheck();
      }
    }, this.HEARTBEAT_CHECK_INTERVAL_MS);
  }

  private stopHeartbeatCheck(): void {
    if (this.heartbeatCheckInterval) {
      clearInterval(this.heartbeatCheckInterval);
      this.heartbeatCheckInterval = null;
    }
  }

  createRoom(config: any, password?: string, name?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'create_room',
          config,
          password,
          name
        }));

        const checkRoom = setInterval(() => {
          if (this.roomCode) {
            clearInterval(checkRoom);
            resolve(this.roomCode);
          }
        }, 100);
      }
    });
  }

  joinRoom(roomCode: string, password?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'join_room',
          roomCode,
          password
        }));

        const timeout = setTimeout(() => {
          reject(new Error('Join room timeout'));
        }, 10000);

        const originalHandler = this.ws.onmessage;
        this.ws.onmessage = async (event) => {
          const message = JSON.parse(event.data);
          if (message.type === 'room_joined') {
            clearTimeout(timeout);
            this.ws!.onmessage = originalHandler;
            await this.handleSignalingMessage(message);
            resolve();
          } else if (message.type === 'error') {
            clearTimeout(timeout);
            this.ws!.onmessage = originalHandler;
            reject(new Error(message.message));
          } else {
            await this.handleSignalingMessage(message);
          }
        };
      } else {
        reject(new Error('WebSocket not connected'));
      }
    });
  }

  broadcastState(state: any) {
    if (!this.isHost) return;

    // Usa protocolo binário para menor latência
    const binaryMessage = BinaryProtocol.encode({
      type: 'state_update',
      state
    });

    this.peers.forEach(peer => {
      if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
        peer.dataChannel.send(binaryMessage);
      }
    });
  }

  sendInput(input: PlayerInput) {
    // Usa protocolo binário (apenas 6 bytes vs ~80 bytes JSON)
    const binaryMessage = BinaryProtocol.encode({
      type: 'player_input',
      input
    });

    this.peers.forEach(peer => {
      if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
        peer.dataChannel.send(binaryMessage);
      }
    });
  }

  sendPlayerInfo(name: string, team: 'red' | 'blue' | 'spectator') {
    // Se ainda não há peers conectados, armazenar para enviar depois
    const hasOpenChannel = Array.from(this.peers.values()).some(
      peer => peer.dataChannel && peer.dataChannel.readyState === 'open'
    );
    
    if (!hasOpenChannel) {
      console.log('No open data channel yet, storing player info');
      this.pendingPlayerInfo = { name, team };
      return;
    }
    
    const binaryMessage = BinaryProtocol.encode({
      type: 'player_info',
      clientId: this.clientId,
      name,
      team
    });

    console.log('Sending player_info (binary)');
    this.peers.forEach(peer => {
      if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
        peer.dataChannel.send(binaryMessage);
        console.log('Sent player_info to peer:', peer.id);
      }
    });
  }

  broadcastRoomUpdate(players: { id: string, name: string, team: 'red' | 'blue' | 'spectator' }[]) {
    if (!this.isHost) return;

    const binaryMessage = BinaryProtocol.encode({
      type: 'room_update',
      players
    });

    this.peers.forEach(peer => {
      if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
        peer.dataChannel.send(binaryMessage);
      }
    });
  }

  broadcastTeamChange(playerId: string, team: 'red' | 'blue' | 'spectator') {
    if (!this.isHost) return;

    const binaryMessage = BinaryProtocol.encode({
      type: 'team_change',
      playerId,
      team
    });

    this.peers.forEach(peer => {
      if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
        peer.dataChannel.send(binaryMessage);
      }
    });
  }

  broadcastGameStart() {
    if (!this.isHost) return;

    const binaryMessage = BinaryProtocol.encode({
      type: 'game_start'
    });

    this.peers.forEach(peer => {
      if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
        peer.dataChannel.send(binaryMessage);
      }
    });
  }

  broadcastGamePause(running: boolean) {
    if (!this.isHost) return;

    const binaryMessage = BinaryProtocol.encode({
      type: 'game_pause',
      running
    });

    this.peers.forEach(peer => {
      if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
        peer.dataChannel.send(binaryMessage);
      }
    });
  }

  broadcastGameStop() {
    if (!this.isHost) return;

    const binaryMessage = BinaryProtocol.encode({
      type: 'game_stop'
    });

    this.peers.forEach(peer => {
      if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
        peer.dataChannel.send(binaryMessage);
      }
    });
  }

  onStateUpdate(callback: (state: any) => void) {
    this.onStateUpdateCallback = callback;
  }

  onPlayerJoin(callback: (player: NetworkedPlayer) => void) {
    this.onPlayerJoinCallback = callback;
  }

  onPlayerLeave(callback: (playerId: string) => void) {
    this.onPlayerLeaveCallback = callback;
  }

  onInput(callback: (playerId: string, input: PlayerInput) => void) {
    this.onInputCallback = callback;
  }

  onDataChannelReady(callback: () => void) {
    this.onDataChannelReadyCallback = callback;
  }

  onRoomUpdate(callback: (players: NetworkedPlayer[]) => void) {
    this.onRoomUpdateCallback = callback;
  }

  onTeamChange(callback: (playerId: string, team: 'red' | 'blue' | 'spectator') => void) {
    this.onTeamChangeCallback = callback;
  }

  onGameStart(callback: () => void) {
    this.onGameStartCallback = callback;
  }

  onGamePause(callback: (running: boolean) => void) {
    this.onGamePauseCallback = callback;
  }

  onGameStop(callback: () => void) {
    this.onGameStopCallback = callback;
  }

  onChatMessage(callback: (playerName: string, message: string, senderId: string) => void) {
    this.onChatMessageCallback = callback;
  }

  onConsoleEvent(callback: (text: string, type: 'event' | 'chat') => void) {
    this.onConsoleEventCallback = callback;
  }

  onRoomsList(callback: (rooms: any[]) => void) {
    this.onRoomsListCallback = callback;
  }

  requestRoomsList() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'list_rooms' }));
    }
  }

  sendChatMessage(playerName: string, message: string) {
    const binaryMsg = BinaryProtocol.encode({
      type: 'chat_message',
      playerName,
      message,
      senderId: this.clientId
    });

    // Se for host, broadcast para todos
    if (this.isHost) {
      this.peers.forEach(peer => {
        if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
          peer.dataChannel.send(binaryMsg);
        }
      });
    } else {
      // Se for client, envia apenas para o host
      this.peers.forEach(peer => {
        if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
          peer.dataChannel.send(binaryMsg);
        }
      });
    }
  }

  broadcastChatExcept(playerName: string, message: string, excludeId: string) {
    if (!this.isHost) return;

    const binaryMsg = BinaryProtocol.encode({
      type: 'chat_message',
      playerName,
      message,
      senderId: excludeId
    });

    this.peers.forEach(peer => {
      // Não envia de volta para quem enviou
      if (peer.id !== excludeId && peer.dataChannel && peer.dataChannel.readyState === 'open') {
        peer.dataChannel.send(binaryMsg);
      }
    });
  }

  broadcastConsoleEvent(text: string, eventType: 'event' | 'chat') {
    if (!this.isHost) return;

    const binaryMsg = BinaryProtocol.encode({
      type: 'console_event',
      text,
      eventType
    });

    this.peers.forEach(peer => {
      if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
        peer.dataChannel.send(binaryMsg);
      }
    });
  }

  getIsHost(): boolean {
    return this.isHost;
  }

  getRoomCode(): string {
    return this.roomCode;
  }

  getClientId(): string {
    return this.clientId;
  }

  private sendToPeer(peerId: string, message: any) {
    const peer = this.peers.get(peerId);
    if (peer && peer.dataChannel && peer.dataChannel.readyState === 'open') {
      // Usa binário para ping/pong (mais eficiente)
      const binaryMessage = BinaryProtocol.encode(message);
      peer.dataChannel.send(binaryMessage);
    }
  }

  private startPingMeasurement(peerId: string) {
    // Envia ping a cada 2 segundos
    const intervalId = window.setInterval(() => {
      const timestamp = Date.now();
      this.pendingPings.set(peerId, timestamp);
      this.sendToPeer(peerId, { type: 'ping', timestamp });
    }, 2000);
    this.pingIntervals.set(peerId, intervalId);
    
    // Envia o primeiro ping imediatamente
    const timestamp = Date.now();
    this.pendingPings.set(peerId, timestamp);
    this.sendToPeer(peerId, { type: 'ping', timestamp });
  }

  private stopPingMeasurement(peerId: string) {
    const intervalId = this.pingIntervals.get(peerId);
    if (intervalId !== undefined) {
      clearInterval(intervalId);
      this.pingIntervals.delete(peerId);
    }
    this.pings.delete(peerId);
    this.pendingPings.delete(peerId);
    this.lastBroadcastTime.delete(peerId);
  }

  getPing(peerId: string): number | undefined {
    return this.pings.get(peerId);
  }

  getAllPings(): Map<string, number> {
    return new Map(this.pings);
  }

  private broadcastPingUpdate(playerId: string, ping: number) {
    if (!this.isHost) return;

    const binaryMessage = BinaryProtocol.encode({
      type: 'ping_broadcast',
      playerId,
      ping
    });

    this.peers.forEach(peer => {
      if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
        peer.dataChannel.send(binaryMessage);
      }
    });
  }

  onPingUpdate(callback: (peerId: string, ping: number) => void) {
    this.onPingUpdateCallback = callback;
  }

  pingServer(): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const timestamp = Date.now();
      
      // Configura callback temporário para este ping específico
      const timeoutId = setTimeout(() => {
        this.onServerPongCallback = null;
        reject(new Error('Ping timeout'));
      }, 5000);

      this.onServerPongCallback = (ping: number) => {
        clearTimeout(timeoutId);
        this.onServerPongCallback = null;
        resolve(ping);
      };

      this.ws.send(JSON.stringify({
        type: 'ping_server',
        timestamp
      }));
    });
  }

  disconnect() {
    this.stopHeartbeatCheck();
    this.peers.forEach(peer => this.removePeer(peer.id));
    
    if (this.ws) {
      this.ws.send(JSON.stringify({ type: 'leave_room' }));
      this.ws.close();
      this.ws = null;
    }
  }
}
