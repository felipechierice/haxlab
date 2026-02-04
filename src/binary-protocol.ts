/**
 * Binary Protocol for Game Networking
 * 
 * Serializa/deserializa mensagens de jogo em formato binário
 * para reduzir latência e uso de banda em comparação com JSON.
 * 
 * Formato: [MessageType (1 byte)] + [Payload específico]
 */

// Tipos de mensagem (1 byte)
export enum MessageType {
  STATE_UPDATE = 1,
  PLAYER_INPUT = 2,
  PLAYER_INFO = 3,
  ROOM_UPDATE = 4,
  TEAM_CHANGE = 5,
  GAME_START = 6,
  GAME_PAUSE = 7,
  GAME_STOP = 8,
  CHAT_MESSAGE = 9,
  CONSOLE_EVENT = 10,
  PING = 11,
  PONG = 12,
  PING_BROADCAST = 13,
}

// Tipos de time (2 bits)
export enum TeamType {
  RED = 0,
  BLUE = 1,
  SPECTATOR = 2,
}

// Helper para converter team string <-> enum
function teamToEnum(team: 'red' | 'blue' | 'spectator'): TeamType {
  switch (team) {
    case 'red': return TeamType.RED;
    case 'blue': return TeamType.BLUE;
    case 'spectator': return TeamType.SPECTATOR;
  }
}

function enumToTeam(t: TeamType): 'red' | 'blue' | 'spectator' {
  switch (t) {
    case TeamType.RED: return 'red';
    case TeamType.BLUE: return 'blue';
    case TeamType.SPECTATOR: return 'spectator';
  }
}

// Codificador de texto
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * Classe principal do protocolo binário
 */
export class BinaryProtocol {
  // Buffer reutilizável para evitar alocações frequentes
  private static buffer = new ArrayBuffer(4096);
  private static view = new DataView(BinaryProtocol.buffer);

  /**
   * Serializa uma mensagem para binário
   */
  static encode(message: any): ArrayBuffer {
    switch (message.type) {
      case 'state_update':
        return this.encodeStateUpdate(message.state);
      case 'player_input':
        return this.encodePlayerInput(message.input);
      case 'player_info':
        return this.encodePlayerInfo(message);
      case 'ping':
        return this.encodePing(message.timestamp);
      case 'pong':
        return this.encodePong(message.timestamp);
      case 'game_start':
        return this.encodeSimple(MessageType.GAME_START);
      case 'game_pause':
        return this.encodeGamePause(message.running);
      case 'game_stop':
        return this.encodeSimple(MessageType.GAME_STOP);
      case 'team_change':
        return this.encodeTeamChange(message.playerId, message.team);
      case 'room_update':
        return this.encodeRoomUpdate(message.players);
      case 'chat_message':
        return this.encodeChatMessage(message);
      case 'console_event':
        return this.encodeConsoleEvent(message);
      case 'ping_broadcast':
        return this.encodePingBroadcast(message.playerId, message.ping);
      default:
        // Fallback para JSON se tipo desconhecido
        return this.encodeJson(message);
    }
  }

  /**
   * Deserializa uma mensagem binária
   */
  static decode(buffer: ArrayBuffer): any {
    const view = new DataView(buffer);
    const type = view.getUint8(0);

    switch (type) {
      case MessageType.STATE_UPDATE:
        return this.decodeStateUpdate(buffer);
      case MessageType.PLAYER_INPUT:
        return this.decodePlayerInput(buffer);
      case MessageType.PLAYER_INFO:
        return this.decodePlayerInfo(buffer);
      case MessageType.PING:
        return this.decodePing(buffer);
      case MessageType.PONG:
        return this.decodePong(buffer);
      case MessageType.GAME_START:
        return { type: 'game_start' };
      case MessageType.GAME_PAUSE:
        return { type: 'game_pause', running: view.getUint8(1) === 1 };
      case MessageType.GAME_STOP:
        return { type: 'game_stop' };
      case MessageType.TEAM_CHANGE:
        return this.decodeTeamChange(buffer);
      case MessageType.ROOM_UPDATE:
        return this.decodeRoomUpdate(buffer);
      case MessageType.CHAT_MESSAGE:
        return this.decodeChatMessage(buffer);
      case MessageType.CONSOLE_EVENT:
        return this.decodeConsoleEvent(buffer);
      case MessageType.PING_BROADCAST:
        return this.decodePingBroadcast(buffer);
      default:
        // Tenta JSON como fallback (tipo 0 ou 255 reservado)
        return this.decodeJson(buffer);
    }
  }

  /**
   * STATE_UPDATE - A mensagem mais frequente e importante
   * 
   * Layout:
   * [0]: MessageType (1 byte)
   * [1]: numPlayers (1 byte)
   * [2-5]: ballPosX (float32)
   * [6-9]: ballPosY (float32)
   * [10-13]: ballVelX (float32)
   * [14-17]: ballVelY (float32)
   * [18-19]: scoreRed (uint16)
   * [20-21]: scoreBlue (uint16)
   * [22-25]: time (float32)
   * [26]: flags (1 byte: bit0=finished, bit1=running, bit2=gameStarted)
   * [27]: winner (1 byte: 0=none, 1=red, 2=blue, 3=draw)
   * [28]: kickMode (1 byte: 0=classic, 1=chargeable)
   * [29-32]: ballRadius (float32)
   * [33-36]: ballMass (float32)
   * [37-40]: ballDamping (float32)
   * Para cada player (tamanho variável):
   *   [+0]: idLength (1 byte)
   *   [+1..idLength]: id (string)
   *   [+]: nameLength (1 byte)
   *   [+]: name (string)
   *   [+]: team (1 byte)
   *   [+]: posX (float32)
   *   [+]: posY (float32)
   *   [+]: velX (float32)
   *   [+]: velY (float32)
   *   [+]: kickCharge (float32)
   *   [+]: isChargingKick (1 byte)
   */
  private static encodeStateUpdate(state: any): ArrayBuffer {
    const view = this.view;
    let offset = 0;

    // Header
    view.setUint8(offset++, MessageType.STATE_UPDATE);
    view.setUint8(offset++, state.players?.length || 0);

    // Ball
    view.setFloat32(offset, state.ball?.pos?.x || 0, true); offset += 4;
    view.setFloat32(offset, state.ball?.pos?.y || 0, true); offset += 4;
    view.setFloat32(offset, state.ball?.vel?.x || 0, true); offset += 4;
    view.setFloat32(offset, state.ball?.vel?.y || 0, true); offset += 4;

    // Score
    view.setUint16(offset, state.score?.red || 0, true); offset += 2;
    view.setUint16(offset, state.score?.blue || 0, true); offset += 2;

    // Time
    view.setFloat32(offset, state.time || 0, true); offset += 4;

    // Flags
    let flags = 0;
    if (state.finished) flags |= 1;
    if (state.running) flags |= 2;
    if (state.gameStarted) flags |= 4;
    view.setUint8(offset++, flags);

    // Winner
    let winner = 0;
    if (state.winner === 'red') winner = 1;
    else if (state.winner === 'blue') winner = 2;
    else if (state.winner === 'draw') winner = 3;
    view.setUint8(offset++, winner);

    // Config
    view.setUint8(offset++, state.config?.kickMode === 'chargeable' ? 1 : 0);
    view.setFloat32(offset, state.config?.ballConfig?.radius || 10, true); offset += 4;
    view.setFloat32(offset, state.config?.ballConfig?.mass || 1, true); offset += 4;
    view.setFloat32(offset, state.config?.ballConfig?.damping || 0.99, true); offset += 4;

    // Players
    if (state.players) {
      for (const player of state.players) {
        // ID
        const idBytes = textEncoder.encode(player.id || '');
        view.setUint8(offset++, idBytes.length);
        new Uint8Array(this.buffer, offset, idBytes.length).set(idBytes);
        offset += idBytes.length;

        // Name
        const nameBytes = textEncoder.encode(player.name || '');
        view.setUint8(offset++, nameBytes.length);
        new Uint8Array(this.buffer, offset, nameBytes.length).set(nameBytes);
        offset += nameBytes.length;

        // Team
        view.setUint8(offset++, teamToEnum(player.team || 'spectator'));

        // Position & Velocity
        view.setFloat32(offset, player.pos?.x || 0, true); offset += 4;
        view.setFloat32(offset, player.pos?.y || 0, true); offset += 4;
        view.setFloat32(offset, player.vel?.x || 0, true); offset += 4;
        view.setFloat32(offset, player.vel?.y || 0, true); offset += 4;

        // Kick
        view.setFloat32(offset, player.kickCharge || 0, true); offset += 4;
        view.setUint8(offset++, player.isChargingKick ? 1 : 0);
      }
    }

    return this.buffer.slice(0, offset);
  }

  private static decodeStateUpdate(buffer: ArrayBuffer): any {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    let offset = 1; // Skip message type

    const numPlayers = view.getUint8(offset++);

    // Ball
    const ball = {
      pos: {
        x: view.getFloat32(offset, true),
        y: view.getFloat32(offset + 4, true)
      },
      vel: {
        x: view.getFloat32(offset + 8, true),
        y: view.getFloat32(offset + 12, true)
      }
    };
    offset += 16;

    // Score
    const score = {
      red: view.getUint16(offset, true),
      blue: view.getUint16(offset + 2, true)
    };
    offset += 4;

    // Time
    const time = view.getFloat32(offset, true);
    offset += 4;

    // Flags
    const flags = view.getUint8(offset++);
    const finished = (flags & 1) !== 0;
    const running = (flags & 2) !== 0;
    const gameStarted = (flags & 4) !== 0;

    // Winner
    const winnerByte = view.getUint8(offset++);
    let winner: 'red' | 'blue' | 'draw' | null = null;
    if (winnerByte === 1) winner = 'red';
    else if (winnerByte === 2) winner = 'blue';
    else if (winnerByte === 3) winner = 'draw';

    // Config
    const kickMode = view.getUint8(offset++) === 1 ? 'chargeable' : 'classic';
    const ballRadius = view.getFloat32(offset, true);
    offset += 4;
    const ballMass = view.getFloat32(offset, true);
    offset += 4;
    const ballDamping = view.getFloat32(offset, true);
    offset += 4;

    // Players
    const players = [];
    for (let i = 0; i < numPlayers; i++) {
      // ID
      const idLength = view.getUint8(offset++);
      const id = textDecoder.decode(bytes.slice(offset, offset + idLength));
      offset += idLength;

      // Name
      const nameLength = view.getUint8(offset++);
      const name = textDecoder.decode(bytes.slice(offset, offset + nameLength));
      offset += nameLength;

      // Team
      const team = enumToTeam(view.getUint8(offset++));

      // Position & Velocity
      const pos = {
        x: view.getFloat32(offset, true),
        y: view.getFloat32(offset + 4, true)
      };
      offset += 8;
      const vel = {
        x: view.getFloat32(offset, true),
        y: view.getFloat32(offset + 4, true)
      };
      offset += 8;

      // Kick
      const kickCharge = view.getFloat32(offset, true);
      offset += 4;
      const isChargingKick = view.getUint8(offset++) === 1;

      players.push({ id, name, team, pos, vel, kickCharge, isChargingKick });
    }

    return {
      type: 'state_update',
      state: {
        players,
        ball,
        score,
        time,
        finished,
        running,
        winner,
        gameStarted,
        config: {
          kickMode,
          ballConfig: { radius: ballRadius, mass: ballMass, damping: ballDamping }
        }
      }
    };
  }

  /**
   * PLAYER_INPUT - Enviado pelos clients
   * 
   * Layout:
   * [0]: MessageType (1 byte)
   * [1]: flags (1 byte: bit0=up, bit1=down, bit2=left, bit3=right, bit4=kick, bit5=isChargingKick)
   * [2-5]: kickCharge (float32)
   */
  private static encodePlayerInput(input: any): ArrayBuffer {
    const view = this.view;
    
    view.setUint8(0, MessageType.PLAYER_INPUT);
    
    let flags = 0;
    if (input.up) flags |= 1;
    if (input.down) flags |= 2;
    if (input.left) flags |= 4;
    if (input.right) flags |= 8;
    if (input.kick) flags |= 16;
    if (input.isChargingKick) flags |= 32;
    view.setUint8(1, flags);
    
    view.setFloat32(2, input.kickCharge || 0, true);

    return this.buffer.slice(0, 6);
  }

  private static decodePlayerInput(buffer: ArrayBuffer): any {
    const view = new DataView(buffer);
    const flags = view.getUint8(1);
    
    return {
      type: 'player_input',
      input: {
        up: (flags & 1) !== 0,
        down: (flags & 2) !== 0,
        left: (flags & 4) !== 0,
        right: (flags & 8) !== 0,
        kick: (flags & 16) !== 0,
        isChargingKick: (flags & 32) !== 0,
        kickCharge: view.getFloat32(2, true)
      }
    };
  }

  /**
   * PLAYER_INFO
   */
  private static encodePlayerInfo(message: any): ArrayBuffer {
    const view = this.view;
    let offset = 0;

    view.setUint8(offset++, MessageType.PLAYER_INFO);

    // ClientId
    const clientIdBytes = textEncoder.encode(message.clientId || '');
    view.setUint8(offset++, clientIdBytes.length);
    new Uint8Array(this.buffer, offset, clientIdBytes.length).set(clientIdBytes);
    offset += clientIdBytes.length;

    // Name
    const nameBytes = textEncoder.encode(message.name || '');
    view.setUint8(offset++, nameBytes.length);
    new Uint8Array(this.buffer, offset, nameBytes.length).set(nameBytes);
    offset += nameBytes.length;

    // Team
    view.setUint8(offset++, teamToEnum(message.team || 'spectator'));

    return this.buffer.slice(0, offset);
  }

  private static decodePlayerInfo(buffer: ArrayBuffer): any {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    let offset = 1;

    // ClientId
    const clientIdLength = view.getUint8(offset++);
    const clientId = textDecoder.decode(bytes.slice(offset, offset + clientIdLength));
    offset += clientIdLength;

    // Name
    const nameLength = view.getUint8(offset++);
    const name = textDecoder.decode(bytes.slice(offset, offset + nameLength));
    offset += nameLength;

    // Team
    const team = enumToTeam(view.getUint8(offset++));

    return { type: 'player_info', clientId, name, team };
  }

  /**
   * PING/PONG
   */
  private static encodePing(timestamp: number): ArrayBuffer {
    const view = this.view;
    view.setUint8(0, MessageType.PING);
    view.setFloat64(1, timestamp, true);
    return this.buffer.slice(0, 9);
  }

  private static decodePing(buffer: ArrayBuffer): any {
    const view = new DataView(buffer);
    return { type: 'ping', timestamp: view.getFloat64(1, true) };
  }

  private static encodePong(timestamp: number): ArrayBuffer {
    const view = this.view;
    view.setUint8(0, MessageType.PONG);
    view.setFloat64(1, timestamp, true);
    return this.buffer.slice(0, 9);
  }

  private static decodePong(buffer: ArrayBuffer): any {
    const view = new DataView(buffer);
    return { type: 'pong', timestamp: view.getFloat64(1, true) };
  }

  /**
   * Mensagem simples (só tipo)
   */
  private static encodeSimple(type: MessageType): ArrayBuffer {
    this.view.setUint8(0, type);
    return this.buffer.slice(0, 1);
  }

  /**
   * GAME_PAUSE
   */
  private static encodeGamePause(running: boolean): ArrayBuffer {
    const view = this.view;
    view.setUint8(0, MessageType.GAME_PAUSE);
    view.setUint8(1, running ? 1 : 0);
    return this.buffer.slice(0, 2);
  }

  /**
   * TEAM_CHANGE
   */
  private static encodeTeamChange(playerId: string, team: 'red' | 'blue' | 'spectator'): ArrayBuffer {
    const view = this.view;
    let offset = 0;

    view.setUint8(offset++, MessageType.TEAM_CHANGE);

    const idBytes = textEncoder.encode(playerId);
    view.setUint8(offset++, idBytes.length);
    new Uint8Array(this.buffer, offset, idBytes.length).set(idBytes);
    offset += idBytes.length;

    view.setUint8(offset++, teamToEnum(team));

    return this.buffer.slice(0, offset);
  }

  private static decodeTeamChange(buffer: ArrayBuffer): any {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    let offset = 1;

    const idLength = view.getUint8(offset++);
    const playerId = textDecoder.decode(bytes.slice(offset, offset + idLength));
    offset += idLength;

    const team = enumToTeam(view.getUint8(offset));

    return { type: 'team_change', playerId, team };
  }

  /**
   * ROOM_UPDATE
   */
  private static encodeRoomUpdate(players: any[]): ArrayBuffer {
    const view = this.view;
    let offset = 0;

    view.setUint8(offset++, MessageType.ROOM_UPDATE);
    view.setUint8(offset++, players.length);

    for (const player of players) {
      // ID
      const idBytes = textEncoder.encode(player.id || '');
      view.setUint8(offset++, idBytes.length);
      new Uint8Array(this.buffer, offset, idBytes.length).set(idBytes);
      offset += idBytes.length;

      // Name
      const nameBytes = textEncoder.encode(player.name || '');
      view.setUint8(offset++, nameBytes.length);
      new Uint8Array(this.buffer, offset, nameBytes.length).set(nameBytes);
      offset += nameBytes.length;

      // Team
      view.setUint8(offset++, teamToEnum(player.team || 'spectator'));
    }

    return this.buffer.slice(0, offset);
  }

  private static decodeRoomUpdate(buffer: ArrayBuffer): any {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    let offset = 1;

    const numPlayers = view.getUint8(offset++);
    const players = [];

    for (let i = 0; i < numPlayers; i++) {
      const idLength = view.getUint8(offset++);
      const id = textDecoder.decode(bytes.slice(offset, offset + idLength));
      offset += idLength;

      const nameLength = view.getUint8(offset++);
      const name = textDecoder.decode(bytes.slice(offset, offset + nameLength));
      offset += nameLength;

      const team = enumToTeam(view.getUint8(offset++));

      players.push({ id, name, team });
    }

    return { type: 'room_update', players };
  }

  /**
   * CHAT_MESSAGE
   */
  private static encodeChatMessage(message: any): ArrayBuffer {
    const view = this.view;
    let offset = 0;

    view.setUint8(offset++, MessageType.CHAT_MESSAGE);

    // playerName
    const nameBytes = textEncoder.encode(message.playerName || '');
    view.setUint8(offset++, nameBytes.length);
    new Uint8Array(this.buffer, offset, nameBytes.length).set(nameBytes);
    offset += nameBytes.length;

    // message text (usa 2 bytes para tamanho, pois pode ser maior)
    const msgBytes = textEncoder.encode(message.message || '');
    view.setUint16(offset, msgBytes.length, true);
    offset += 2;
    new Uint8Array(this.buffer, offset, msgBytes.length).set(msgBytes);
    offset += msgBytes.length;

    // senderId
    const senderBytes = textEncoder.encode(message.senderId || '');
    view.setUint8(offset++, senderBytes.length);
    new Uint8Array(this.buffer, offset, senderBytes.length).set(senderBytes);
    offset += senderBytes.length;

    return this.buffer.slice(0, offset);
  }

  private static decodeChatMessage(buffer: ArrayBuffer): any {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    let offset = 1;

    const nameLength = view.getUint8(offset++);
    const playerName = textDecoder.decode(bytes.slice(offset, offset + nameLength));
    offset += nameLength;

    const msgLength = view.getUint16(offset, true);
    offset += 2;
    const message = textDecoder.decode(bytes.slice(offset, offset + msgLength));
    offset += msgLength;

    const senderLength = view.getUint8(offset++);
    const senderId = textDecoder.decode(bytes.slice(offset, offset + senderLength));

    return { type: 'chat_message', playerName, message, senderId };
  }

  /**
   * CONSOLE_EVENT
   */
  private static encodeConsoleEvent(message: any): ArrayBuffer {
    const view = this.view;
    let offset = 0;

    view.setUint8(offset++, MessageType.CONSOLE_EVENT);
    
    // eventType: 0 = event, 1 = chat
    view.setUint8(offset++, message.eventType === 'chat' ? 1 : 0);

    // text
    const textBytes = textEncoder.encode(message.text || '');
    view.setUint16(offset, textBytes.length, true);
    offset += 2;
    new Uint8Array(this.buffer, offset, textBytes.length).set(textBytes);
    offset += textBytes.length;

    return this.buffer.slice(0, offset);
  }

  private static decodeConsoleEvent(buffer: ArrayBuffer): any {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    let offset = 1;

    const eventType = view.getUint8(offset++) === 1 ? 'chat' : 'event';

    const textLength = view.getUint16(offset, true);
    offset += 2;
    const text = textDecoder.decode(bytes.slice(offset, offset + textLength));

    return { type: 'console_event', text, eventType };
  }

  /**
   * PING_BROADCAST
   */
  private static encodePingBroadcast(playerId: string, ping: number): ArrayBuffer {
    const view = this.view;
    let offset = 0;

    view.setUint8(offset++, MessageType.PING_BROADCAST);

    const idBytes = textEncoder.encode(playerId);
    view.setUint8(offset++, idBytes.length);
    new Uint8Array(this.buffer, offset, idBytes.length).set(idBytes);
    offset += idBytes.length;

    view.setUint16(offset, ping, true);
    offset += 2;

    return this.buffer.slice(0, offset);
  }

  private static decodePingBroadcast(buffer: ArrayBuffer): any {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    let offset = 1;

    const idLength = view.getUint8(offset++);
    const playerId = textDecoder.decode(bytes.slice(offset, offset + idLength));
    offset += idLength;

    const ping = view.getUint16(offset, true);

    return { type: 'ping_broadcast', playerId, ping };
  }

  /**
   * JSON Fallback - para mensagens desconhecidas
   */
  private static encodeJson(message: any): ArrayBuffer {
    const json = JSON.stringify(message);
    const jsonBytes = textEncoder.encode(json);
    
    // Tipo 0 = JSON fallback
    const buffer = new ArrayBuffer(1 + jsonBytes.length);
    const view = new DataView(buffer);
    view.setUint8(0, 0);
    new Uint8Array(buffer, 1).set(jsonBytes);
    
    return buffer;
  }

  private static decodeJson(buffer: ArrayBuffer): any {
    const bytes = new Uint8Array(buffer);
    const json = textDecoder.decode(bytes.slice(1));
    return JSON.parse(json);
  }

  /**
   * Verifica se um dado é binário (ArrayBuffer) ou texto (JSON)
   */
  static isBinary(data: any): data is ArrayBuffer {
    return data instanceof ArrayBuffer;
  }
}
