import { Game } from './game.js';
import { DEFAULT_MAP, CLASSIC_MAP } from './maps.js';
import { GameConfig } from './types.js';
import { NetworkManager } from './network.js';
import { i18n } from './i18n.js';

let currentGame: Game | null = null;
let currentRoomCode: string = '';
let networkManager: NetworkManager | null = null;

function generateRandomUsername(): string {
  const language = i18n.getLanguage();
  
  const adjectives = language === 'pt' ? [
    'Veloz', 'Corajoso', 'Astuto', 'Sábio', 'Forte', 'Ágil', 'Calmo', 'Bravo',
    'Esperto', 'Leal', 'Feroz', 'Doce', 'Amargo', 'Brilhante', 'Obscuro', 'Radiante',
    'Trovejante', 'Silencioso', 'Barulhento', 'Pacífico', 'Rebelde', 'Místico', 'Épico',
    'Lendário', 'Heroico', 'Malandro', 'Travesso', 'Sagaz', 'Audaz', 'Destemido',
    'Fantástico', 'Mágico', 'Selvagem', 'Nobre', 'Real', 'Imperial', 'Supremo',
    'Supremo', 'Divino', 'Celestial', 'Infernal', 'Eterno', 'Temporal', 'Espacial',
    'Cósmico', 'Lunar', 'Solar', 'Estelar', 'Galáctico', 'Turbinado'
  ] : [
    'Swift', 'Brave', 'Clever', 'Wise', 'Strong', 'Agile', 'Calm', 'Bold',
    'Smart', 'Loyal', 'Fierce', 'Sweet', 'Bitter', 'Bright', 'Dark', 'Radiant',
    'Thundering', 'Silent', 'Loud', 'Peaceful', 'Rebel', 'Mystic', 'Epic',
    'Legendary', 'Heroic', 'Cunning', 'Mischievous', 'Shrewd', 'Audacious', 'Fearless',
    'Fantastic', 'Magic', 'Wild', 'Noble', 'Royal', 'Imperial', 'Supreme',
    'Divine', 'Celestial', 'Infernal', 'Eternal', 'Temporal', 'Spatial',
    'Cosmic', 'Lunar', 'Solar', 'Stellar', 'Galactic', 'Turbo'
  ];
  
  const nouns = language === 'pt' ? [
    'Dragão', 'Tigre', 'Leão', 'Falcão', 'Águia', 'Lobo', 'Urso', 'Raposa',
    'Gato', 'Panda', 'Ninja', 'Samurai', 'Guerreiro', 'Mago', 'Cavaleiro', 'Arqueiro',
    'Guardião', 'Protetor', 'Caçador', 'Explorador', 'Aventureiro', 'Herói', 'Campeão',
    'Mestre', 'Sábio', 'Oráculo', 'Profeta', 'Visionário', 'Sonhador', 'Pensador',
    'Trovão', 'Relâmpago', 'Tempestade', 'Furacão', 'Tornado', 'Vulcão', 'Tsunami',
    'Cometa', 'Meteoro', 'Asteroide', 'Planeta', 'Estrela', 'Cosmos', 'Universo',
    'Fênix', 'Grifo', 'Minotauro', 'Centauro', 'Pegasus', 'Kraken'
  ] : [
    'Dragon', 'Tiger', 'Lion', 'Falcon', 'Eagle', 'Wolf', 'Bear', 'Fox',
    'Cat', 'Panda', 'Ninja', 'Samurai', 'Warrior', 'Mage', 'Knight', 'Archer',
    'Guardian', 'Protector', 'Hunter', 'Explorer', 'Adventurer', 'Hero', 'Champion',
    'Master', 'Sage', 'Oracle', 'Prophet', 'Visionary', 'Dreamer', 'Thinker',
    'Thunder', 'Lightning', 'Storm', 'Hurricane', 'Tornado', 'Volcano', 'Tsunami',
    'Comet', 'Meteor', 'Asteroid', 'Planet', 'Star', 'Cosmos', 'Universe',
    'Phoenix', 'Griffin', 'Minotaur', 'Centaur', 'Pegasus', 'Kraken'
  ];
  
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${noun} ${adj}`;
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function hideAllScreens(): void {
  document.getElementById('menu')?.classList.add('hidden');
  document.getElementById('play-menu')?.style.setProperty('display', 'none');
  document.getElementById('host-menu')?.style.setProperty('display', 'none');
  document.getElementById('rooms-list-menu')?.style.setProperty('display', 'none');
  document.getElementById('game-container')?.classList.add('hidden');
}

function updateTranslations(): void {
  // Atualizar todos os elementos com data-i18n
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const key = element.getAttribute('data-i18n');
    if (key) {
      element.textContent = i18n.t(key);
    }
  });

  // Atualizar placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
    const key = element.getAttribute('data-i18n-placeholder');
    if (key && element instanceof HTMLInputElement) {
      element.placeholder = i18n.t(key);
    }
  });

  // Atualizar titles
  document.querySelectorAll('[data-i18n-title]').forEach((element) => {
    const key = element.getAttribute('data-i18n-title');
    if (key) {
      element.setAttribute('title', i18n.t(key));
    }
  });

  // Atualizar o valor padrão do room name quando o idioma mudar
  const roomNameInput = document.getElementById('room-name') as HTMLInputElement;
  if (roomNameInput && !roomNameInput.value) {
    roomNameInput.value = i18n.t('host.roomNamePlaceholder');
  }
}

function showMainMenu(): void {
  hideAllScreens();
  document.getElementById('menu')?.classList.remove('hidden');
  
  if (currentGame) {
    currentGame.stop();
  }
}

function showPlayMenu(): void {
  hideAllScreens();
  document.getElementById('play-menu')?.style.setProperty('display', 'block');
}

function showHostMenu(): void {
  hideAllScreens();
  document.getElementById('host-menu')?.style.setProperty('display', 'block');
}

function showRoomsListMenu(): void {
  hideAllScreens();
  document.getElementById('rooms-list-menu')?.style.setProperty('display', 'block');
  loadRoomsList();
}

async function loadRoomsList(): Promise<void> {
  const loadingEl = document.getElementById('loading-rooms');
  const noRoomsEl = document.getElementById('no-rooms');
  const roomsListEl = document.getElementById('rooms-list');
  
  if (loadingEl) loadingEl.classList.remove('hidden');
  if (noRoomsEl) noRoomsEl.classList.add('hidden');
  if (roomsListEl) roomsListEl.innerHTML = '';
  
  try {
    // Criar NetworkManager temporário apenas para buscar salas
    const tempNetwork = new NetworkManager();
    await tempNetwork.connect();
    
    // Medir ping do servidor
    let serverPing = 0;
    try {
      serverPing = await tempNetwork.pingServer();
    } catch (e) {
      console.warn('Failed to measure server ping:', e);
      serverPing = -1;
    }
    
    // Configurar callback para receber lista
    tempNetwork.onRoomsList((rooms) => {
      if (loadingEl) loadingEl.classList.add('hidden');
      
      if (rooms.length === 0) {
        if (noRoomsEl) noRoomsEl.classList.remove('hidden');
      } else {
        if (roomsListEl) {
          roomsListEl.innerHTML = '';
          rooms.forEach(room => {
            const row = document.createElement('tr');
            
            const kickModeName = room.config?.kickMode === 'chargeable' ? 'Chargeable' : 'Classic';
            const playersInfo = `${room.players}/${(room.config?.playersPerTeam || 2) * 2}`;
            const mode = `${room.config?.playersPerTeam || 2}v${room.config?.playersPerTeam || 2}`;
            const scoreLimit = room.config?.scoreLimit || 3;
            const timeLimit = `${Math.floor((room.config?.timeLimit || 300) / 60)}m`;
            const pingDisplay = serverPing >= 0 ? `${serverPing}ms` : '—';
            
            row.innerHTML = `
              <td class="room-code-cell">${room.code}</td>
              <td class="room-name-cell">${room.name || 'Unnamed Room'}</td>
              <td>${playersInfo}</td>
              <td>${mode}</td>
              <td>${kickModeName}</td>
              <td>${scoreLimit}</td>
              <td>${timeLimit}</td>
              <td>${pingDisplay}</td>
            `;
            
            row.addEventListener('click', () => joinRoomFromList(room.code));
            roomsListEl.appendChild(row);
          });
        }
      }
      
      // Desconectar o NetworkManager temporário
      tempNetwork.disconnect();
    });
    
    // Solicitar lista de salas
    tempNetwork.requestRoomsList();
    
  } catch (error) {
    console.error('Failed to load rooms:', error);
    if (loadingEl) loadingEl.classList.add('hidden');
    if (noRoomsEl) {
      noRoomsEl.textContent = 'Error loading rooms. Server might be offline.';
      noRoomsEl.classList.remove('hidden');
    }
  }
}

async function joinRoomFromList(roomCode: string): Promise<void> {
  try {
    networkManager = new NetworkManager();
    await networkManager.connect();
    await networkManager.joinRoom(roomCode);
    
    // Config temporário - será sobrescrito pelo host
    const config: GameConfig = {
      timeLimit: 300,
      scoreLimit: 3,
      playersPerTeam: 2,
      kickMode: 'classic',
      ballConfig: {
        radius: 8,
        mass: 2,
        damping: 0.99,
        color: '#ffff00',
        borderColor: '#000000',
        borderWidth: 2
      }
    };
    
    startGame(config, 'default', networkManager);
  } catch (error) {
    console.error('Failed to join room:', error);
    alert('Failed to join room: ' + (error as Error).message);
    networkManager = null;
  }
}

function startGame(config: GameConfig, mapType: string, network?: NetworkManager): void {
  hideAllScreens();
  const gameContainer = document.getElementById('game-container');
  if (gameContainer) gameContainer.classList.remove('hidden');
  
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  
  if (!canvas) {
    console.error('Canvas not found');
    return;
  }
  
  if (network) {
    currentRoomCode = network.getRoomCode();
  } else {
    currentRoomCode = generateRoomCode();
  }
  
  setTimeout(() => {
    const roomCodeElement = document.getElementById('room-code');
    if (roomCodeElement) {
      roomCodeElement.textContent = currentRoomCode;
    }
  }, 0);
  
  const map = mapType === 'classic' ? CLASSIC_MAP : DEFAULT_MAP;
  
  currentGame = new Game(canvas, map, config, network);
  
  if (network) {
    currentGame.setupNetworkCallbacks();
    const isHost = network.getIsHost();
    const clientId = network.getClientId();
    const usernameInput = document.getElementById('player-username') as HTMLInputElement;
    const username = usernameInput?.value?.trim() || generateRandomUsername();
    
    // Armazena o nome localmente para usar no chat
    currentGame.setLocalPlayerName(username);
    
    if (isHost) {
      // Host entra como espectador e abre menu de sala
      currentGame.addSpectator(clientId, username);
      currentGame.setControlledPlayer(clientId);
      // Abre menu de sala automaticamente
      currentGame.toggleRoomMenu();
    } else {
      // Client envia sua info como espectador e aguarda
      currentGame.setControlledPlayer(clientId);
      network.sendPlayerInfo(username, 'spectator');
    }
    
    // Em multiplayer, não inicia o jogo automaticamente
    // O jogo só inicia quando o host clicar em Start
    currentGame.reset();
    // Inicia apenas o render loop (sem a física)
    currentGame.startRenderLoop();
  } else {
    // Singleplayer - comportamento normal
    currentGame.initPlayers();
    currentGame.reset();
    currentGame.start();
  }
}

function init(): void {
  const btnPlay = document.getElementById('btn-play');
  const btnMenu = document.getElementById('btn-menu');
  const btnBackMain = document.getElementById('btn-back-main');
  const btnBackPlay = document.getElementById('btn-back-play');
  const btnHostRoom = document.getElementById('btn-host-room');
  const btnJoinCode = document.getElementById('btn-join-code');
  const btnListRooms = document.getElementById('btn-list-rooms');
  const btnCreateRoom = document.getElementById('btn-create-room');
  const btnRefreshRooms = document.getElementById('btn-refresh-rooms');
  const btnBackPlayFromList = document.getElementById('btn-back-play-from-list');
  
  if (btnPlay) {
    btnPlay.addEventListener('click', showPlayMenu);
  }
  
  if (btnMenu) {
    btnMenu.addEventListener('click', showMainMenu);
  }

  if (btnBackMain) {
    btnBackMain.addEventListener('click', showMainMenu);
  }

  if (btnBackPlay) {
    btnBackPlay.addEventListener('click', showPlayMenu);
  }

  // Atualiza os valores exibidos ao lado dos sliders
  const ballRadiusInput = document.getElementById('ball-radius') as HTMLInputElement;
  const ballRadiusValue = document.getElementById('ball-radius-value');
  if (ballRadiusInput && ballRadiusValue) {
    ballRadiusInput.addEventListener('input', () => {
      ballRadiusValue.textContent = ballRadiusInput.value;
    });
  }

  const ballMassInput = document.getElementById('ball-mass') as HTMLInputElement;
  const ballMassValue = document.getElementById('ball-mass-value');
  if (ballMassInput && ballMassValue) {
    ballMassInput.addEventListener('input', () => {
      ballMassValue.textContent = ballMassInput.value;
    });
  }

  const ballDampingInput = document.getElementById('ball-damping') as HTMLInputElement;
  const ballDampingValue = document.getElementById('ball-damping-value');
  if (ballDampingInput && ballDampingValue) {
    ballDampingInput.addEventListener('input', () => {
      ballDampingValue.textContent = ballDampingInput.value;
    });
  }

  if (btnHostRoom) {
    btnHostRoom.addEventListener('click', showHostMenu);
  }

  if (btnJoinCode) {
    btnJoinCode.addEventListener('click', async () => {
      const code = prompt('Enter room code:');
      if (code) {
        const password = prompt('Enter password (leave empty if none):');
        
        try {
          networkManager = new NetworkManager();
          await networkManager.connect();
          await networkManager.joinRoom(code, password || undefined);
          
          // Config temporário - será sobrescrito pelo host
          const config: GameConfig = {
            timeLimit: 300,
            scoreLimit: 3,
            playersPerTeam: 2,
            kickMode: 'classic',
            ballConfig: {
              radius: 8,
              mass: 2,
              damping: 0.995,
              color: '#ffff00',
              borderColor: '#000000',
              borderWidth: 2
            }
          };
          
          startGame(config, 'default', networkManager);
        } catch (error) {
          console.error('Failed to join room:', error);
          alert('Failed to join room: ' + (error as Error).message);
          networkManager = null;
        }
      }
    });
  }

  if (btnListRooms) {
    btnListRooms.addEventListener('click', showRoomsListMenu);
  }

  if (btnRefreshRooms) {
    btnRefreshRooms.addEventListener('click', loadRoomsList);
  }

  if (btnBackPlayFromList) {
    btnBackPlayFromList.addEventListener('click', showPlayMenu);
  }

  if (btnCreateRoom) {
    btnCreateRoom.addEventListener('click', async () => {
      const roomName = (document.getElementById('room-name') as HTMLInputElement).value || 'Unnamed Room';
      const playersPerTeam = parseInt((document.getElementById('players-per-team') as HTMLSelectElement).value);
      const scoreLimit = parseInt((document.getElementById('score-limit') as HTMLInputElement).value);
      const timeLimitMinutes = parseInt((document.getElementById('time-limit') as HTMLInputElement).value);
      const mapType = (document.getElementById('map-select') as HTMLSelectElement).value;
      const kickMode = (document.getElementById('kick-mode') as HTMLSelectElement).value as 'classic' | 'chargeable';
      const password = (document.getElementById('room-password') as HTMLInputElement).value;
      
      const ballColor = (document.getElementById('ball-color') as HTMLInputElement).value;
      const ballBorderColor = (document.getElementById('ball-border-color') as HTMLInputElement).value;
      const ballRadius = parseFloat((document.getElementById('ball-radius') as HTMLInputElement).value);
      const ballMass = parseFloat((document.getElementById('ball-mass') as HTMLInputElement).value);
      const ballDamping = parseFloat((document.getElementById('ball-damping') as HTMLInputElement).value);
      
      const config: GameConfig = {
        timeLimit: timeLimitMinutes * 60,
        scoreLimit: scoreLimit,
        playersPerTeam: playersPerTeam,
        kickMode: kickMode,
        ballConfig: {
          radius: ballRadius,
          mass: ballMass,
          damping: ballDamping,
          color: ballColor,
          borderColor: ballBorderColor,
          borderWidth: 2
        }
      };
      
      try {
        networkManager = new NetworkManager();
        await networkManager.connect();
        await networkManager.createRoom(config, password || undefined, roomName);
        startGame(config, mapType, networkManager);
      } catch (error) {
        console.error('Failed to create room:', error);
        alert('Failed to create room. Make sure the signaling server is running.');
        networkManager = null;
      }
    });
  }

  const btnCopyCode = document.getElementById('btn-copy-code');
  if (btnCopyCode) {
    btnCopyCode.addEventListener('click', () => {
      if (!currentRoomCode) {
        alert('No room code available');
        return;
      }
      
      navigator.clipboard.writeText(currentRoomCode).then(() => {
        const btn = btnCopyCode as HTMLButtonElement;
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => {
          btn.textContent = originalText;
        }, 2000);
      }).catch((err) => {
        console.error('Failed to copy:', err);
        prompt('Copy this code:', currentRoomCode);
      });
    });
  }
  
  // Configurar seleção de idioma
  const languageSelect = document.getElementById('language-select') as HTMLSelectElement;
  if (languageSelect) {
    // Definir idioma atual
    languageSelect.value = i18n.getLanguage();
    
    // Listener de mudança de idioma
    languageSelect.addEventListener('change', () => {
      i18n.setLanguage(languageSelect.value as 'en' | 'pt');
      updateTranslations();
      
      // Atualizar o nome de usuário se estiver vazio ou for um nome gerado
      const usernameInput = document.getElementById('player-username') as HTMLInputElement;
      if (usernameInput) {
        const newName = generateRandomUsername();
        usernameInput.value = newName;
        usernameInput.placeholder = newName;
      }
    });
  }

  // Configurar nome de usuário aleatório
  const usernameInput = document.getElementById('player-username') as HTMLInputElement;
  const btnRandomName = document.getElementById('btn-random-name');
  
  if (usernameInput) {
    // Gerar nome aleatório inicial
    const randomName = generateRandomUsername();
    usernameInput.value = randomName;
    usernameInput.placeholder = randomName;
  }
  
  if (btnRandomName && usernameInput) {
    btnRandomName.addEventListener('click', (e) => {
      e.preventDefault();
      const newName = generateRandomUsername();
      usernameInput.value = newName;
    });
  }

  // Atualizar traduções na inicialização
  updateTranslations();
  
  showMainMenu();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
