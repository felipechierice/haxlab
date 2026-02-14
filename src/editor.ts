import { Game } from './game.js';
import { DEFAULT_MAP, CLASSIC_MAP } from './maps.js';
import { GameConfig, Vector2D, BotDefinition, BotBehavior, CheckpointObjective, PathObjective, Scenario, Playlist, GameMap, PatrolParams } from './types.js';
import { Renderer } from './renderer.js';
import { PlaylistMode } from './playlist.js';

type EditorTool = 'select' | 'bot' | 'checkpoint' | 'path';
type EditorSpecialEntity = 'player' | 'ball';

interface ScenarioSettings {
  name: string;
  timeLimit: number;
  ballSpawn?: Vector2D;
  playerSpawn?: Vector2D;
  initialBallVelocity?: Vector2D;
  initialPlayerVelocity?: Vector2D;
  goalObjective?: { team: 'red' | 'blue'; scoredBy?: 'player' | 'bot'; scoredByBotId?: string };
  noGoalObjective?: { team: 'red' | 'blue' };
  kickCountObjective?: { min?: number; max?: number; exact?: number };
  preventBotTeamTouch?: { teams: ('red' | 'blue')[] }; // Times de bots que NÃO podem tocar na bola
}

interface EditorScenario {
  settings: ScenarioSettings;
  entities: EditorEntity[];
}

interface PlaylistSettings {
  name: string;
  description: string;
}

interface EditorBot extends BotDefinition {
  editorId: string;
}

interface EditorCheckpoint extends CheckpointObjective {
  editorId: string;
  order: number;
  timeLimit: number;
}

interface EditorPath extends PathObjective {
  editorId: string;
  order: number;
}

type EditorEntity = EditorBot | EditorCheckpoint | EditorPath;

export class PlaylistEditor {
  private game: Game;
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  private currentTool: EditorTool = 'select';
  private entities: EditorEntity[] = [];
  private selectedEntity: EditorEntity | EditorSpecialEntity | null = null;
  private draggingEntity: EditorEntity | EditorSpecialEntity | null = null;
  private dragOffset: Vector2D = { x: 0, y: 0 };
  private isDragging: boolean = false;
  private pathBeingDrawn: Vector2D[] | null = null;
  private nextEntityId: number = 0;
  private toolbarElement: HTMLElement | null = null;
  private propertiesPanel: HTMLElement | null = null;
  private mapType: string = 'default';
  private config: GameConfig;
  private isTestMode: boolean = false;
  private testPlaylistMode: PlaylistMode | null = null;
  private scenarioSettings: ScenarioSettings = {
    name: 'Cenário Customizado',
    timeLimit: 60,
    goalObjective: { team: 'red' }
  };
  
  // Playlist management
  private scenarios: EditorScenario[] = [];
  private currentScenarioIndex: number = 0;
  private playlistSettings: PlaylistSettings = {
    name: 'Minha Playlist',
    description: 'Playlist personalizada'
  };
  
  // Captura de coordenadas para patrol
  private capturingPatrolPoint: { bot: EditorBot; pointIndex: number } | null = null;
  
  // Arrasto de pontos de patrulha
  private draggingPatrolPoint: { bot: EditorBot; pointIndex: number } | null = null;
  
  // Arrasto de pontos de path
  private draggingPathPoint: { path: EditorPath; pointIndex: number } | null = null;
  
  // Visualização de velocidade inicial
  private velocityVisualizationEnabled: { player: boolean; ball: boolean } = { player: false, ball: false };
  private draggingVelocityHandle: 'player' | 'ball' | null = null;
  
  // Controle de clique rápido
  private mouseDownTime: number = 0;
  private mouseDownPos: Vector2D = { x: 0, y: 0 };

  constructor(canvas: HTMLCanvasElement, mapType: string = 'default') {
    this.canvas = canvas;
    this.mapType = mapType;
    
    const map = mapType === 'classic' ? CLASSIC_MAP : DEFAULT_MAP;
    this.config = this.getDefaultConfig();
    
    this.game = new Game(canvas, map, this.config);
    this.renderer = new Renderer(canvas);
    
    // Inicializar com um cenário vazio
    this.scenarios.push({
      settings: { ...this.scenarioSettings },
      entities: []
    });
    
    this.setupEventListeners();
    this.createUI();
    this.startRenderLoop();
  }

  private getDefaultConfig(): GameConfig {
    return {
      timeLimit: 60,
      scoreLimit: 0,
      playersPerTeam: 1,
      kickMode: 'classic',
      kickStrength: 500,
      playerRadius: 15,
      playerSpeed: 260,
      playerAcceleration: 6.5,
      kickSpeedMultiplier: 0.5,
      ballConfig: {
        radius: 8,
        mass: 2,
        damping: 0.99,
        color: '#ffff00',
        borderColor: '#000000',
        borderWidth: 2
      }
    };
  }

  private createUI(): void {
    // Criar toolbar
    this.toolbarElement = document.createElement('div');
    this.toolbarElement.id = 'editor-toolbar';
    this.toolbarElement.className = 'editor-toolbar';
    this.toolbarElement.innerHTML = `
      <button class="editor-tool-btn active" data-tool="select">
        <span class="tool-icon"><i class="fas fa-mouse-pointer"></i></span>
        <span class="tool-name">Selecionar</span>
      </button>
      <button class="editor-tool-btn" data-tool="bot">
        <span class="tool-icon"><i class="fas fa-robot"></i></span>
        <span class="tool-name">Bot</span>
      </button>
      <button class="editor-tool-btn" data-tool="checkpoint">
        <span class="tool-icon"><i class="fas fa-flag-checkered"></i></span>
        <span class="tool-name">Checkpoint</span>
      </button>
      <button class="editor-tool-btn" data-tool="path">
        <span class="tool-icon"><i class="fas fa-route"></i></span>
        <span class="tool-name">Caminho</span>
      </button>
      <div class="editor-toolbar-divider"></div>
      <div class="scenario-navigation">
        <button class="editor-action-btn" id="editor-prev-scenario" title="Cenário anterior">
          <span class="tool-icon"><i class="fas fa-chevron-left"></i></span>
        </button>
        <button class="editor-action-btn" id="editor-next-scenario" title="Próximo cenário">
          <span class="tool-icon"><i class="fas fa-chevron-right"></i></span>
        </button>
        <span id="editor-scenario-counter" style="grid-column: span 2; text-align: center; margin: 4px 0; font-weight: bold; font-size: 11px; color: #cbd5e1;">1 / 1</span>
        <button class="editor-action-btn" id="editor-add-scenario" title="Adicionar novo cenário">
          <span class="tool-icon"><i class="fas fa-plus"></i></span>
        </button>
        <button class="editor-action-btn" id="editor-remove-scenario" title="Remover cenário atual">
          <span class="tool-icon"><i class="fas fa-minus"></i></span>
        </button>
      </div>
      <div class="editor-toolbar-divider"></div>
      <button class="editor-action-btn" id="editor-playlist-settings">
        <span class="tool-icon"><i class="fas fa-list"></i></span>
        <span class="tool-name">Playlist</span>
      </button>
      <button class="editor-action-btn" id="editor-import">
        <span class="tool-icon"><i class="fas fa-file-import"></i></span>
        <span class="tool-name">Importar</span>
      </button>
      <button class="editor-action-btn" id="editor-save">
        <span class="tool-icon"><i class="fas fa-save"></i></span>
        <span class="tool-name">Exportar</span>
      </button>
      <button class="editor-action-btn" id="editor-test">
        <span class="tool-icon"><i class="fas fa-play"></i></span>
        <span class="tool-name">Testar</span>
      </button>
      <button class="editor-action-btn" id="editor-clear">
        <span class="tool-icon"><i class="fas fa-trash"></i></span>
        <span class="tool-name">Limpar</span>
      </button>
      <button class="editor-action-btn" id="editor-settings">
        <span class="tool-icon"><i class="fas fa-cog"></i></span>
        <span class="tool-name">Cenário</span>
      </button>
      <button class="editor-action-btn" id="editor-exit">
        <span class="tool-icon"><i class="fas fa-times"></i></span>
        <span class="tool-name">Sair</span>
      </button>
    `;
    
    // Criar painel de propriedades
    this.propertiesPanel = document.createElement('div');
    this.propertiesPanel.id = 'editor-properties';
    this.propertiesPanel.className = 'editor-properties hidden';
    
    document.body.appendChild(this.toolbarElement);
    document.body.appendChild(this.propertiesPanel);
    
    // Event listeners dos botões
    this.toolbarElement.querySelectorAll('.editor-tool-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tool = (e.currentTarget as HTMLElement).dataset.tool as EditorTool;
        this.selectTool(tool);
      });
    });
    
    document.getElementById('editor-save')?.addEventListener('click', () => this.saveScenario());
    document.getElementById('editor-import')?.addEventListener('click', () => this.importPlaylist());
    document.getElementById('editor-test')?.addEventListener('click', () => this.testScenario());
    document.getElementById('editor-clear')?.addEventListener('click', () => this.clearAll());
    document.getElementById('editor-settings')?.addEventListener('click', () => this.showScenarioSettings());
    document.getElementById('editor-playlist-settings')?.addEventListener('click', () => this.showPlaylistSettings());
    document.getElementById('editor-prev-scenario')?.addEventListener('click', () => this.previousScenario());
    document.getElementById('editor-next-scenario')?.addEventListener('click', () => this.nextScenario());
    document.getElementById('editor-add-scenario')?.addEventListener('click', () => this.addScenario());
    document.getElementById('editor-remove-scenario')?.addEventListener('click', () => this.removeScenario());
    document.getElementById('editor-exit')?.addEventListener('click', () => this.exit());
  }

  private selectTool(tool: EditorTool, keepSelection: boolean = false): void {
    this.currentTool = tool;
    
    // Atualizar botões
    this.toolbarElement?.querySelectorAll('.editor-tool-btn').forEach(btn => {
      btn.classList.remove('active');
      if ((btn as HTMLElement).dataset.tool === tool) {
        btn.classList.add('active');
      }
    });
    
    // Limpar seleção ao trocar de ferramenta (a menos que explicitamente preservado)
    if (!keepSelection) {
      this.selectedEntity = null;
      this.hidePropertiesPanel();
    }
  }

  private setupEventListeners(): void {
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    
    // Teclas de atalho
    document.addEventListener('keydown', (e) => {
      // Ignora atalhos quando o foco está em um campo de texto
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        // Permite apenas Escape passar para o editor mesmo em inputs
        if (e.key !== 'Escape') return;
      }
      
      if (e.key === 'Escape') {
        // Cancelar captura de coordenada
        if (this.capturingPatrolPoint) {
          this.capturingPatrolPoint = null;
          this.canvas.style.cursor = 'default';
          document.getElementById('capture-overlay')?.remove();
          e.stopImmediatePropagation();
          return;
        }
        
        // Sair do modo de teste se estiver ativo
        if (this.isTestMode) {
          e.stopImmediatePropagation();
          this.exitTestMode();
          return;
        }
        
        // Cancelar caminho sendo desenhado ou sair do editor
        if (this.pathBeingDrawn) {
          this.pathBeingDrawn = null;
        }
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        // Resetar cenário no modo de teste
        if (this.isTestMode && this.testPlaylistMode) {
          this.testPlaylistMode.resetScenario();
        } else {
          // Entrar no modo teste quando não está testando
          this.testScenario();
        }
      } else if (e.key === 'Enter') {
        // Finalizar caminho
        if (this.pathBeingDrawn && this.pathBeingDrawn.length >= 2) {
          this.finalizePath();
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        // Deletar entidade selecionada
        if (this.selectedEntity) {
          e.preventDefault();
          if (typeof this.selectedEntity === 'string') {
            // Não permitir deletar jogador e bola
            alert('Não é possível deletar o jogador ou a bola. Use "Resetar Posição" no painel de propriedades.');
          } else {
            this.deleteEntity(this.selectedEntity);
          }
        }
      }
    });
  }

  private getMousePosition(e: MouseEvent): Vector2D {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  private handleMouseDown(e: MouseEvent): void {
    const pos = this.getMousePosition(e);
    this.mouseDownTime = Date.now();
    this.mouseDownPos = { x: pos.x, y: pos.y };
    
    // Verificar se está capturando coordenada para patrol
    if (this.capturingPatrolPoint) {
      if (this.capturingPatrolPoint.bot.behavior.config.type === 'ai_preset') {
        const params = (this.capturingPatrolPoint.bot.behavior.config as any).params;
        params.points[this.capturingPatrolPoint.pointIndex] = { x: Math.round(pos.x), y: Math.round(pos.y) };
        this.updatePatrolPointsList(this.capturingPatrolPoint.bot);
        this.capturingPatrolPoint = null;
        // Restaurar cursor e remover overlay
        this.canvas.style.cursor = 'default';
        document.getElementById('capture-overlay')?.remove();
      }
      return;
    }
    
    // Verificar se clicou no handle de velocidade
    const velocityHandle = this.findVelocityHandleAtPosition(pos);
    if (velocityHandle) {
      this.draggingVelocityHandle = velocityHandle;
      this.isDragging = true;
      return;
    }
    
    if (this.currentTool === 'select') {
      // Verificar se clicou em um ponto de patrulha (se um bot de patrulha estiver selecionado)
      if (this.selectedEntity && typeof this.selectedEntity === 'object' && 'spawn' in this.selectedEntity) {
        const bot = this.selectedEntity as EditorBot;
        if (bot.behavior.type === 'ai_preset' && bot.behavior.config.type === 'ai_preset' && bot.behavior.config.preset === 'patrol') {
          const patrolPoint = this.findPatrolPointAtPosition(bot, pos);
          if (patrolPoint !== null) {
            this.draggingPatrolPoint = { bot, pointIndex: patrolPoint };
            this.isDragging = true;
            return;
          }
        }
      }
      
      // Verificar se clicou em um ponto de path
      const pathAtPos = this.findPathAtPosition(pos);
      if (pathAtPos) {
        const pointIndex = this.findPathPointAtPosition(pathAtPos, pos);
        if (pointIndex !== null) {
          // Clicou em um ponto específico - permitir arrastar
          this.draggingPathPoint = { path: pathAtPos, pointIndex };
          this.selectedEntity = pathAtPos;
          this.isDragging = true;
          return;
        }
      }
      
      // Verificar se clicou no jogador ou na bola primeiro
      const specialEntity = this.findSpecialEntityAtPosition(pos);
      if (specialEntity) {
        this.selectedEntity = specialEntity;
        this.draggingEntity = specialEntity;
        this.isDragging = true;
        
        const entityPos = this.getSpecialEntityPosition(specialEntity);
        this.dragOffset = {
          x: pos.x - entityPos.x,
          y: pos.y - entityPos.y
        };
        
        this.showSpecialEntityProperties(specialEntity);
      } else {
        // Verificar se clicou em alguma entidade normal
        const entity = this.findEntityAtPosition(pos);
        if (entity) {
          this.selectedEntity = entity;
          this.draggingEntity = entity;
          this.isDragging = true;
          
          const entityPos = this.getEntityPosition(entity);
          this.dragOffset = {
            x: pos.x - entityPos.x,
            y: pos.y - entityPos.y
          };
          
          this.showPropertiesPanel(entity);
        } else {
          this.selectedEntity = null;
          this.hidePropertiesPanel();
        }
      }
    } else if (this.currentTool === 'bot') {
      this.createBot(pos);
    } else if (this.currentTool === 'checkpoint') {
      this.createCheckpoint(pos);
    } else if (this.currentTool === 'path') {
      if (!this.pathBeingDrawn) {
        this.pathBeingDrawn = [pos];
      } else {
        this.pathBeingDrawn.push(pos);
      }
    }
  }
  
  private handleMouseMove(e: MouseEvent): void {
    const pos = this.getMousePosition(e);
    
    if (this.isDragging) {
      if (this.draggingVelocityHandle) {
        // Arrastar handle de velocidade
        this.updateVelocityFromHandle(this.draggingVelocityHandle, pos);
      } else if (this.draggingPatrolPoint) {
        // Arrastar ponto de patrulha
        const bot = this.draggingPatrolPoint.bot;
        if (bot.behavior.config.type === 'ai_preset') {
          const params = (bot.behavior.config as any).params;
          params.points[this.draggingPatrolPoint.pointIndex] = { x: Math.round(pos.x), y: Math.round(pos.y) };
        }
      } else if (this.draggingPathPoint) {
        // Arrastar ponto de path
        this.draggingPathPoint.path.points[this.draggingPathPoint.pointIndex] = {
          x: Math.round(pos.x),
          y: Math.round(pos.y)
        };
      } else if (this.draggingEntity) {
        const newPos = {
          x: pos.x - this.dragOffset.x,
          y: pos.y - this.dragOffset.y
        };
        
        if (typeof this.draggingEntity === 'string') {
          this.setSpecialEntityPosition(this.draggingEntity as EditorSpecialEntity, newPos);
        } else {
          this.setEntityPosition(this.draggingEntity, newPos);
        }
      }
    }
  }
  
  private handleMouseUp(e: MouseEvent): void {
    const pos = this.getMousePosition(e);
    const clickDuration = Date.now() - this.mouseDownTime;
    const dx = pos.x - this.mouseDownPos.x;
    const dy = pos.y - this.mouseDownPos.y;
    const moveDistance = Math.sqrt(dx * dx + dy * dy);
    
    // Detectar clique rápido (não arrasto) em path
    const isQuickClick = clickDuration < 200 && moveDistance < 5;
    
    if (isQuickClick && this.currentTool === 'select' && !this.draggingVelocityHandle && !this.draggingPatrolPoint) {
      const pathAtPos = this.findPathAtPosition(pos);
      if (pathAtPos && !this.draggingPathPoint) {
        // Clique rápido em path - abrir propriedades
        this.selectedEntity = pathAtPos;
        this.showPropertiesPanel(pathAtPos);
      }
    }
    
    // Finalizar arrasto de velocity handle
    if (this.draggingVelocityHandle) {
      this.draggingVelocityHandle = null;
      // Atualizar inputs do painel
      if (this.selectedEntity) {
        this.showSpecialEntityProperties(this.selectedEntity as EditorSpecialEntity);
      }
    }
    
    // Atualizar lista de patrulha se estava arrastando ponto
    if (this.draggingPatrolPoint) {
      this.updatePatrolPointsList(this.draggingPatrolPoint.bot);
      this.draggingPatrolPoint = null;
    }
    
    // Finalizar arrasto de ponto de path
    if (this.draggingPathPoint) {
      this.draggingPathPoint = null;
      // Atualizar painel de propriedades se necessário
      if (this.selectedEntity && typeof this.selectedEntity === 'object' && 'points' in this.selectedEntity) {
        this.showPropertiesPanel(this.selectedEntity);
      }
    }
    
    // Finalizar caminho com duplo clique
    if (this.currentTool === 'path' && this.pathBeingDrawn && this.pathBeingDrawn.length >= 2) {
      // Detectar duplo clique ou clique com shift para finalizar
      if (e.shiftKey) {
        this.finalizePath();
      }
    }
    
    this.isDragging = false;
    this.draggingEntity = null;
  }

  private findSpecialEntityAtPosition(pos: Vector2D): EditorSpecialEntity | null {
    // Verificar jogador
    const playerPos = this.scenarioSettings.playerSpawn || { x: 200, y: 300 };
    const playerRadius = 15;
    let dx = pos.x - playerPos.x;
    let dy = pos.y - playerPos.y;
    if (dx * dx + dy * dy < playerRadius * playerRadius) {
      return 'player';
    }
    
    // Verificar bola
    const ballPos = this.scenarioSettings.ballSpawn || { x: 500, y: 300 };
    const ballRadius = this.config.ballConfig.radius + 5; // Margem maior para facilitar clique
    dx = pos.x - ballPos.x;
    dy = pos.y - ballPos.y;
    if (dx * dx + dy * dy < ballRadius * ballRadius) {
      return 'ball';
    }
    
    return null;
  }

  private findPatrolPointAtPosition(bot: EditorBot, pos: Vector2D): number | null {
    if (bot.behavior.config.type !== 'ai_preset') return null;
    
    const params = (bot.behavior.config as any).params;
    if (!params.points || params.points.length === 0) return null;
    
    const clickRadius = 12; // Mesmo raio usado para renderizar
    
    for (let i = 0; i < params.points.length; i++) {
      const point = params.points[i];
      const dx = pos.x - point.x;
      const dy = pos.y - point.y;
      if (dx * dx + dy * dy < clickRadius * clickRadius) {
        return i;
      }
    }
    
    return null;
  }
  
  private findPathPointAtPosition(path: EditorPath, pos: Vector2D): number | null {
    const clickRadius = 10;
    
    for (let i = 0; i < path.points.length; i++) {
      const point = path.points[i];
      const dx = pos.x - point.x;
      const dy = pos.y - point.y;
      if (dx * dx + dy * dy < clickRadius * clickRadius) {
        return i;
      }
    }
    
    return null;
  }
  
  private findPathAtPosition(pos: Vector2D): EditorPath | null {
    // Procurar paths
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const entity = this.entities[i];
      if ('points' in entity && 'width' in entity) {
        const path = entity as EditorPath;
        
        // Verificar se clicou em algum ponto
        if (this.findPathPointAtPosition(path, pos) !== null) {
          return path;
        }
        
        // Verificar se clicou no caminho
        for (let j = 0; j < path.points.length - 1; j++) {
          const p1 = path.points[j];
          const p2 = path.points[j + 1];
          const dist = this.distanceToSegment(pos, p1, p2);
          
          if (dist <= path.width / 2) {
            return path;
          }
        }
      }
    }
    return null;
  }
  
  private distanceToSegment(point: Vector2D, p1: Vector2D, p2: Vector2D): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lengthSq = dx * dx + dy * dy;
    
    if (lengthSq === 0) {
      const pdx = point.x - p1.x;
      const pdy = point.y - p1.y;
      return Math.sqrt(pdx * pdx + pdy * pdy);
    }
    
    let t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));
    
    const closest = {
      x: p1.x + t * dx,
      y: p1.y + t * dy
    };
    
    const cdx = point.x - closest.x;
    const cdy = point.y - closest.y;
    return Math.sqrt(cdx * cdx + cdy * cdy);
  }

  private findVelocityHandleAtPosition(pos: Vector2D): 'player' | 'ball' | null {
    // Verificar handle do player
    if (this.velocityVisualizationEnabled.player && this.selectedEntity === 'player') {
      const playerPos = this.scenarioSettings.playerSpawn || { x: 200, y: 300 };
      const vel = this.scenarioSettings.initialPlayerVelocity || { x: 0, y: 0 };
      const handlePos = { x: playerPos.x + vel.x, y: playerPos.y + vel.y };
      const handleRadius = 8;
      
      const dx = pos.x - handlePos.x;
      const dy = pos.y - handlePos.y;
      if (dx * dx + dy * dy < handleRadius * handleRadius) {
        return 'player';
      }
    }
    
    // Verificar handle da bola
    if (this.velocityVisualizationEnabled.ball && this.selectedEntity === 'ball') {
      const ballPos = this.scenarioSettings.ballSpawn || { x: 500, y: 300 };
      const vel = this.scenarioSettings.initialBallVelocity || { x: 0, y: 0 };
      const handlePos = { x: ballPos.x + vel.x, y: ballPos.y + vel.y };
      const handleRadius = 8;
      
      const dx = pos.x - handlePos.x;
      const dy = pos.y - handlePos.y;
      if (dx * dx + dy * dy < handleRadius * handleRadius) {
        return 'ball';
      }
    }
    
    return null;
  }

  private updateVelocityFromHandle(entity: 'player' | 'ball', handlePos: Vector2D): void {
    if (entity === 'player') {
      const playerPos = this.scenarioSettings.playerSpawn || { x: 200, y: 300 };
      const velocity = {
        x: handlePos.x - playerPos.x,
        y: handlePos.y - playerPos.y
      };
      this.scenarioSettings.initialPlayerVelocity = velocity;
      
      // Atualizar inputs no painel
      const inputX = document.getElementById('prop-player-vel-x') as HTMLInputElement;
      const inputY = document.getElementById('prop-player-vel-y') as HTMLInputElement;
      if (inputX) inputX.value = Math.round(velocity.x).toString();
      if (inputY) inputY.value = Math.round(velocity.y).toString();
    } else if (entity === 'ball') {
      const ballPos = this.scenarioSettings.ballSpawn || { x: 500, y: 300 };
      const velocity = {
        x: handlePos.x - ballPos.x,
        y: handlePos.y - ballPos.y
      };
      this.scenarioSettings.initialBallVelocity = velocity;
      
      // Atualizar inputs no painel
      const inputX = document.getElementById('prop-ball-vel-x') as HTMLInputElement;
      const inputY = document.getElementById('prop-ball-vel-y') as HTMLInputElement;
      if (inputX) inputX.value = Math.round(velocity.x).toString();
      if (inputY) inputY.value = Math.round(velocity.y).toString();
    }
  }

  private findEntityAtPosition(pos: Vector2D): EditorEntity | null {
    // Procurar de trás para frente para pegar entidade mais no topo
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const entity = this.entities[i];
      const entityPos = this.getEntityPosition(entity);
      const radius = this.getEntityRadius(entity);
      
      const dx = pos.x - entityPos.x;
      const dy = pos.y - entityPos.y;
      const distSq = dx * dx + dy * dy;
      
      if (distSq < radius * radius) {
        return entity;
      }
    }
    return null;
  }

  private getEntityPosition(entity: EditorEntity): Vector2D {
    if ('spawn' in entity) {
      return entity.spawn;
    } else if ('position' in entity) {
      return entity.position;
    } else if ('points' in entity) {
      return entity.points[0] || { x: 0, y: 0 };
    }
    return { x: 0, y: 0 };
  }

  private getSpecialEntityPosition(entity: EditorSpecialEntity): Vector2D {
    if (entity === 'player') {
      return this.scenarioSettings.playerSpawn || { x: 200, y: 300 };
    } else {
      return this.scenarioSettings.ballSpawn || { x: 500, y: 300 };
    }
  }

  private setSpecialEntityPosition(entity: EditorSpecialEntity, pos: Vector2D): void {
    if (entity === 'player') {
      this.scenarioSettings.playerSpawn = pos;
    } else {
      this.scenarioSettings.ballSpawn = pos;
    }
  }

  private setEntityPosition(entity: EditorEntity, pos: Vector2D): void {
    if ('spawn' in entity) {
      entity.spawn = pos;
    } else if ('position' in entity) {
      entity.position = pos;
    }
  }

  private getEntityRadius(entity: EditorEntity): number {
    if ('spawn' in entity) {
      return (entity as EditorBot).radius ?? 15; // Bot radius (custom or default)
    } else if ('radius' in entity) {
      return entity.radius;
    } else if ('width' in entity) {
      return entity.width / 2;
    }
    return 20;
  }

  private createBot(pos: Vector2D): void {
    const bot: EditorBot = {
      editorId: `bot-${this.nextEntityId++}`,
      id: `bot-${Date.now()}`,
      name: 'Bot',
      team: 'blue',
      spawn: pos,
      radius: 15, // Raio padrão
      behavior: {
        type: 'ai_preset',
        config: {
          type: 'ai_preset',
          preset: 'idle',
          params: {
            type: 'idle',
            kickOnContact: false
          }
        }
      }
    };
    
    this.entities.push(bot);
    this.selectedEntity = bot;
    this.selectTool('select', true);
    this.showPropertiesPanel(bot);
  }

  private createCheckpoint(pos: Vector2D): void {
    const nextOrder = this.getNextCheckpointOrder();
    const checkpoint: EditorCheckpoint = {
      editorId: `checkpoint-${this.nextEntityId++}`,
      type: 'checkpoint',
      position: pos,
      radius: 50,
      timeLimit: 10,
      order: nextOrder
    };
    
    this.entities.push(checkpoint);
    this.selectedEntity = checkpoint;
    this.selectTool('select', true);
    this.showPropertiesPanel(checkpoint);
  }

  private getNextCheckpointOrder(): number {
    let maxOrder = 0;
    this.entities.forEach(e => {
      if ('order' in e && e.order > maxOrder) {
        maxOrder = e.order;
      }
    });
    return maxOrder + 1;
  }

  private finalizePath(): void {
    if (this.pathBeingDrawn && this.pathBeingDrawn.length >= 2) {
      const nextOrder = this.getNextCheckpointOrder();
      const path: EditorPath = {
        editorId: `path-${this.nextEntityId++}`,
        type: 'path',
        points: [...this.pathBeingDrawn],
        width: 80,
        order: nextOrder
      };
      
      this.entities.push(path);
      this.selectedEntity = path;
      this.pathBeingDrawn = null;
      this.selectTool('select', true);
      this.showPropertiesPanel(path);
    } else {
      this.pathBeingDrawn = null;
      this.selectTool('select');
    }
  }

  private showPropertiesPanel(entity: EditorEntity): void {
    if (!this.propertiesPanel) return;
    
    this.propertiesPanel.classList.remove('hidden');
    
    if ('spawn' in entity) {
      this.showBotProperties(entity);
    } else if ('position' in entity && 'radius' in entity) {
      this.showCheckpointProperties(entity);
    } else if ('points' in entity) {
      this.showPathProperties(entity);
    }
  }

  private showBotProperties(bot: EditorBot): void {
    if (!this.propertiesPanel) return;
    
    const behaviorType = bot.behavior.type;
    const aiPreset = behaviorType === 'ai_preset' && bot.behavior.config.type === 'ai_preset' 
      ? bot.behavior.config.preset 
      : 'chase_ball';
    
    // Obter params atuais se existirem
    const currentParams = behaviorType === 'ai_preset' && bot.behavior.config.type === 'ai_preset' 
      ? (bot.behavior.config as any).params 
      : {};
    
    this.propertiesPanel.innerHTML = `
      <h3>Propriedades do Bot</h3>
      <div class="property">
        <label>ID do Bot:</label>
        <input type="text" id="prop-bot-id" value="${bot.id}" readonly style="background: #f0f0f0; cursor: pointer;" title="Clique para copiar" />
        <small style="color: #666; font-size: 11px;">Clique para copiar o ID</small>
      </div>
      <div class="property">
        <label>Nome:</label>
        <input type="text" id="prop-bot-name" value="${bot.name}" />
      </div>
      <div class="property">
        <label>Time:</label>
        <select id="prop-bot-team">
          <option value="red" ${bot.team === 'red' ? 'selected' : ''}>Vermelho</option>
          <option value="blue" ${bot.team === 'blue' ? 'selected' : ''}>Azul</option>
        </select>
      </div>
      <div class="property">
        <label>Tamanho (Raio):</label>
        <input type="range" id="prop-bot-radius" min="8" max="40" value="${bot.radius ?? 15}" step="1" />
        <span id="prop-bot-radius-value">${bot.radius ?? 15}</span>
      </div>
      <div class="property">
        <label>Preset de IA:</label>
        <select id="prop-bot-ai-preset">
          <option value="idle" ${aiPreset === 'idle' ? 'selected' : ''}>Nada (Parado)</option>
          <option value="mark_player" ${aiPreset === 'mark_player' ? 'selected' : ''}>Marcar Jogador</option>
          <option value="chase_ball" ${aiPreset === 'chase_ball' ? 'selected' : ''}>Perseguir Bola</option>
          <option value="patrol" ${aiPreset === 'patrol' ? 'selected' : ''}>Patrulhar</option>
        </select>
      </div>
      
      <!-- Configurações para Nada (Parado) -->
      <div id="idle-config" style="display: ${aiPreset === 'idle' ? 'block' : 'none'};">
        <h4>Config. Bot Parado</h4>
        <div class="property">
          <label>
            <input type="checkbox" id="prop-idle-kick" ${currentParams.kickOnContact ? 'checked' : ''} />
            Chutar ao encostar na bola
          </label>
        </div>
      </div>
      
      <!-- Configurações para Marcar Jogador -->
      <div id="mark-player-config" style="display: ${aiPreset === 'mark_player' ? 'block' : 'none'};">
        <h4>Config. Marcar Jogador</h4>
        <div class="property">
          <label>Velocidade:</label>
          <input type="range" id="prop-mark-speed" min="0.1" max="1.5" value="${currentParams.speed || 0.8}" step="0.1" />
          <span id="prop-mark-speed-value">${currentParams.speed || 0.8}</span>
        </div>
        <div class="property">
          <label>Distância Mínima:</label>
          <input type="number" id="prop-mark-distance" value="${currentParams.distance || 100}" min="10" max="300" step="10" />
        </div>
        <div class="property">
          <label>Tempo de Reação (s):</label>
          <input type="number" id="prop-mark-reaction" value="${currentParams.reactionTime || 0}" min="0" max="2" step="0.1" />
        </div>
        <div class="property">
          <label>
            <input type="checkbox" id="prop-mark-kick" ${currentParams.kickOnContact ? 'checked' : ''} />
            Chutar ao encostar na bola
          </label>
        </div>
      </div>
      
      <!-- Configurações para Perseguir Bola -->
      <div id="chase-ball-config" style="display: ${aiPreset === 'chase_ball' ? 'block' : 'none'};">
        <h4>Config. Perseguir Bola</h4>
        <div class="property">
          <label>Velocidade:</label>
          <input type="range" id="prop-chase-speed" min="0.1" max="1.5" value="${currentParams.speed || 0.8}" step="0.1" />
          <span id="prop-chase-speed-value">${currentParams.speed || 0.8}</span>
        </div>
        <div class="property">
          <label>
            <input type="checkbox" id="prop-chase-kick" ${currentParams.kickWhenClose !== false ? 'checked' : ''} />
            Chutar ao encostar na bola
          </label>
        </div>
      </div>
      
      <!-- Configurações do patrol -->
      <div id="patrol-config" style="display: ${aiPreset === 'patrol' ? 'block' : 'none'};">
        <h4>Pontos de Patrulha</h4>
        <div id="patrol-points-list"></div>
        <div class="property">
          <button id="prop-add-patrol-point" class="apply-btn" style="width: 100%; margin-top: 10px;"><i class="fas fa-plus"></i> Adicionar Ponto</button>
        </div>
        <div class="property">
          <label>
            <input type="checkbox" id="prop-patrol-loop" ${currentParams.loop !== false ? 'checked' : ''} />
            Loop (voltar ao ponto 1)
          </label>
        </div>
        <div class="property">
          <label>Velocidade:</label>
          <input type="range" id="prop-patrol-speed" min="0.1" max="1" value="0.6" step="0.1" />
          <span id="prop-patrol-speed-value">0.6</span>
        </div>
        <div class="property">
          <label>Tempo de Espera (s):</label>
          <input type="number" id="prop-patrol-wait" value="0" min="0" max="10" step="0.5" />
        </div>
        <div class="property">
          <label>
            <input type="checkbox" id="prop-patrol-kick" ${currentParams.kickOnContact ? 'checked' : ''} />
            Chutar ao encostar na bola
          </label>
        </div>
      </div>
      
      <div class="property">
        <button id="prop-delete" class="delete-btn">Deletar Bot</button>
      </div>
    `;
    
    document.getElementById('prop-bot-name')?.addEventListener('input', (e) => {
      bot.name = (e.target as HTMLInputElement).value;
    });
    
    // Event listener para copiar ID do bot
    document.getElementById('prop-bot-id')?.addEventListener('click', (e) => {
      const input = e.target as HTMLInputElement;
      input.select();
      navigator.clipboard.writeText(bot.id).then(() => {
        const originalBg = input.style.background;
        input.style.background = '#d4edda';
        setTimeout(() => {
          input.style.background = originalBg;
        }, 500);
      }).catch(err => {
        console.error('Erro ao copiar ID:', err);
      });
    });
    
    document.getElementById('prop-bot-team')?.addEventListener('change', (e) => {
      bot.team = (e.target as HTMLSelectElement).value as 'red' | 'blue';
    });
    
    // Event listener para o slider de raio
    const radiusInput = document.getElementById('prop-bot-radius') as HTMLInputElement;
    const radiusValue = document.getElementById('prop-bot-radius-value');
    radiusInput?.addEventListener('input', () => {
      const value = parseInt(radiusInput.value);
      bot.radius = value;
      if (radiusValue) radiusValue.textContent = value.toString();
    });
    
    document.getElementById('prop-bot-ai-preset')?.addEventListener('change', (e) => {
      const preset = (e.target as HTMLSelectElement).value as any;
      
      // Criar config apropriado para cada preset
      let params: any;
      switch (preset) {
        case 'idle':
          params = { 
            type: 'idle', 
            kickOnContact: false 
          };
          break;
        case 'mark_player':
          params = { 
            type: 'mark_player', 
            speed: 0.8, 
            distance: 100, 
            reactionTime: 0, 
            kickOnContact: false 
          };
          break;
        case 'chase_ball':
          params = { 
            type: 'chase_ball', 
            speed: 0.8, 
            kickWhenClose: true 
          };
          break;
        case 'patrol':
          params = { 
            type: 'patrol', 
            points: [{ x: 400, y: 300 }, { x: 600, y: 300 }], 
            speed: 0.6,
            loop: true,
            waitTime: 0,
            reactionTime: 0,
            kickOnContact: false
          };
          break;
      }
      
      bot.behavior = {
        type: 'ai_preset',
        config: {
          type: 'ai_preset',
          preset: preset,
          params: params
        }
      };
      
      // Recarregar propriedades para mostrar configurações corretas
      this.showBotProperties(bot);
    });
    
    // Configurar controles específicos de cada preset
    if (aiPreset === 'idle') {
      this.setupIdleControls(bot);
    } else if (aiPreset === 'mark_player') {
      this.setupMarkPlayerControls(bot);
    } else if (aiPreset === 'chase_ball') {
      this.setupChaseBallControls(bot);
    } else if (aiPreset === 'patrol') {
      this.setupPatrolControls(bot);
    }
    
    document.getElementById('prop-delete')?.addEventListener('click', () => {
      this.deleteEntity(bot);
    });
  }

  private setupIdleControls(bot: EditorBot): void {
    if (bot.behavior.config.type !== 'ai_preset') return;
    
    const idleParams = (bot.behavior.config as any).params;
    
    // Kick on contact checkbox
    const kickCheckbox = document.getElementById('prop-idle-kick') as HTMLInputElement;
    kickCheckbox?.addEventListener('change', () => {
      if (bot.behavior.config.type === 'ai_preset') {
        ((bot.behavior.config as any).params).kickOnContact = kickCheckbox.checked;
      }
    });
  }

  private setupMarkPlayerControls(bot: EditorBot): void {
    if (bot.behavior.config.type !== 'ai_preset') return;
    
    const markParams = (bot.behavior.config as any).params;
    
    // Speed slider
    const speedInput = document.getElementById('prop-mark-speed') as HTMLInputElement;
    const speedValue = document.getElementById('prop-mark-speed-value');
    if (speedInput && markParams.speed !== undefined) {
      speedInput.value = markParams.speed.toString();
      if (speedValue) speedValue.textContent = markParams.speed.toFixed(1);
    }
    speedInput?.addEventListener('input', () => {
      const value = parseFloat(speedInput.value);
      if (bot.behavior.config.type === 'ai_preset') {
        ((bot.behavior.config as any).params).speed = value;
        if (speedValue) speedValue.textContent = value.toFixed(1);
      }
    });
    
    // Distance input
    const distanceInput = document.getElementById('prop-mark-distance') as HTMLInputElement;
    if (distanceInput && markParams.distance !== undefined) {
      distanceInput.value = markParams.distance.toString();
    }
    distanceInput?.addEventListener('input', () => {
      const value = parseFloat(distanceInput.value);
      if (bot.behavior.config.type === 'ai_preset') {
        ((bot.behavior.config as any).params).distance = value;
      }
    });
    
    // Reaction time input
    const reactionInput = document.getElementById('prop-mark-reaction') as HTMLInputElement;
    if (reactionInput && markParams.reactionTime !== undefined) {
      reactionInput.value = markParams.reactionTime.toString();
    }
    reactionInput?.addEventListener('input', () => {
      const value = parseFloat(reactionInput.value);
      if (bot.behavior.config.type === 'ai_preset') {
        ((bot.behavior.config as any).params).reactionTime = value;
      }
    });
    
    // Kick on contact checkbox
    const kickCheckbox = document.getElementById('prop-mark-kick') as HTMLInputElement;
    kickCheckbox?.addEventListener('change', () => {
      if (bot.behavior.config.type === 'ai_preset') {
        ((bot.behavior.config as any).params).kickOnContact = kickCheckbox.checked;
      }
    });
  }

  private setupChaseBallControls(bot: EditorBot): void {
    if (bot.behavior.config.type !== 'ai_preset') return;
    
    const chaseParams = (bot.behavior.config as any).params;
    
    // Speed slider
    const speedInput = document.getElementById('prop-chase-speed') as HTMLInputElement;
    const speedValue = document.getElementById('prop-chase-speed-value');
    if (speedInput && chaseParams.speed !== undefined) {
      speedInput.value = chaseParams.speed.toString();
      if (speedValue) speedValue.textContent = chaseParams.speed.toFixed(1);
    }
    speedInput?.addEventListener('input', () => {
      const value = parseFloat(speedInput.value);
      if (bot.behavior.config.type === 'ai_preset') {
        ((bot.behavior.config as any).params).speed = value;
        if (speedValue) speedValue.textContent = value.toFixed(1);
      }
    });
    
    // Kick when close checkbox
    const kickCheckbox = document.getElementById('prop-chase-kick') as HTMLInputElement;
    kickCheckbox?.addEventListener('change', () => {
      if (bot.behavior.config.type === 'ai_preset') {
        ((bot.behavior.config as any).params).kickWhenClose = kickCheckbox.checked;
      }
    });
  }

  private setupPatrolControls(bot: EditorBot): void {
    if (bot.behavior.config.type !== 'ai_preset') return;
    
    this.updatePatrolPointsList(bot);
    
    const patrolParams = (bot.behavior.config as any).params;
    
    // Loop checkbox
    const loopCheckbox = document.getElementById('prop-patrol-loop') as HTMLInputElement;
    if (loopCheckbox) {
      loopCheckbox.checked = patrolParams.loop !== false; // Padrão true
    }
    loopCheckbox?.addEventListener('change', () => {
      if (bot.behavior.config.type === 'ai_preset') {
        ((bot.behavior.config as any).params as any).loop = loopCheckbox.checked;
      }
    });
    
    // Speed slider
    const speedInput = document.getElementById('prop-patrol-speed') as HTMLInputElement;
    const speedValue = document.getElementById('prop-patrol-speed-value');
    if (speedInput && patrolParams.speed !== undefined) {
      speedInput.value = patrolParams.speed.toString();
      if (speedValue) speedValue.textContent = patrolParams.speed.toFixed(1);
    }
    speedInput?.addEventListener('input', () => {
      const value = parseFloat(speedInput.value);
      if (bot.behavior.config.type === 'ai_preset') {
        ((bot.behavior.config as any).params as any).speed = value;
      }
      if (speedValue) speedValue.textContent = value.toFixed(1);
    });
    
    // Wait time
    const waitInput = document.getElementById('prop-patrol-wait') as HTMLInputElement;
    if (waitInput && patrolParams.waitTime !== undefined) {
      waitInput.value = patrolParams.waitTime.toString();
    }
    waitInput?.addEventListener('input', () => {
      const value = parseFloat(waitInput.value);
      if (bot.behavior.config.type === 'ai_preset') {
        ((bot.behavior.config as any).params as any).waitTime = value > 0 ? value : undefined;
      }
    });
    
    // Kick on contact checkbox
    const kickCheckbox = document.getElementById('prop-patrol-kick') as HTMLInputElement;
    kickCheckbox?.addEventListener('change', () => {
      if (bot.behavior.config.type === 'ai_preset') {
        ((bot.behavior.config as any).params).kickOnContact = kickCheckbox.checked;
      }
    });
    
    // Add point button
    const addButton = document.getElementById('prop-add-patrol-point');
    if (addButton) {
      addButton.addEventListener('click', () => {
        if (bot.behavior.config.type === 'ai_preset') {
          const params = (bot.behavior.config as any).params;
          if (!params.points) params.points = [];
          params.points.push({ x: 500, y: 300 });
          this.updatePatrolPointsList(bot);
        }
      });
    }
  }

  private updatePatrolPointsList(bot: EditorBot): void {
    const listContainer = document.getElementById('patrol-points-list');
    if (!listContainer || bot.behavior.config.type !== 'ai_preset') return;
    
    const params = (bot.behavior.config as any).params;
    if (!params.points || params.points.length === 0) {
      listContainer.innerHTML = '<p style="color: #888; font-size: 12px;">Nenhum ponto adicionado</p>';
      return;
    }
    
    listContainer.innerHTML = params.points.map((point: any, index: number) => `
      <div class="patrol-point" style="background: rgba(255,255,255,0.05); padding: 10px; margin: 5px 0; border-radius: 5px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
          <strong>Ponto ${index + 1}</strong>
          <div>
            <button class="capture-patrol-point" data-index="${index}" title="Capturar coordenada clicando no campo" style="background: #667eea; border: none; color: white; padding: 2px 8px; border-radius: 3px; cursor: pointer; font-size: 11px; margin-right: 5px;"><i class="fas fa-crosshairs"></i></button>
            <button class="delete-patrol-point" data-index="${index}" style="background: #ff4444; border: none; color: white; padding: 2px 8px; border-radius: 3px; cursor: pointer; font-size: 11px;"><i class="fas fa-times"></i></button>
          </div>
        </div>
        <div style="display: flex; gap: 10px;">
          <div style="flex: 1;">
            <label style="font-size: 11px; color: #aaa;">X:</label>
            <input type="number" class="patrol-point-x" data-index="${index}" value="${Math.round(point.x)}" style="width: 100%; padding: 4px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.3); color: white; border-radius: 3px;" />
          </div>
          <div style="flex: 1;">
            <label style="font-size: 11px; color: #aaa;">Y:</label>
            <input type="number" class="patrol-point-y" data-index="${index}" value="${Math.round(point.y)}" style="width: 100%; padding: 4px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.3); color: white; border-radius: 3px;" />
          </div>
          <div style="flex: 1;">
            <label style="font-size: 11px; color: #aaa;">Delay (s):</label>
            <input type="number" class="patrol-point-delay" data-index="${index}" value="${point.delay || 0}" min="0" max="10" step="0.1" style="width: 100%; padding: 4px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.3); color: white; border-radius: 3px;" />
          </div>
        </div>
      </div>
    `).join('');
    
    // Event listeners para inputs
    listContainer.querySelectorAll('.patrol-point-x').forEach(input => {
      input.addEventListener('input', (e) => {
        const index = parseInt((e.target as HTMLInputElement).dataset.index || '0');
        const value = parseFloat((e.target as HTMLInputElement).value);
        params.points[index].x = value;
      });
    });
    
    listContainer.querySelectorAll('.patrol-point-y').forEach(input => {
      input.addEventListener('input', (e) => {
        const index = parseInt((e.target as HTMLInputElement).dataset.index || '0');
        const value = parseFloat((e.target as HTMLInputElement).value);
        params.points[index].y = value;
      });
    });
    
    listContainer.querySelectorAll('.patrol-point-delay').forEach(input => {
      input.addEventListener('input', (e) => {
        const index = parseInt((e.target as HTMLInputElement).dataset.index || '0');
        const value = parseFloat((e.target as HTMLInputElement).value);
        params.points[index].delay = value > 0 ? value : undefined;
      });
    });
    
    // Event listeners para botões de delete
    listContainer.querySelectorAll('.delete-patrol-point').forEach(button => {
      button.addEventListener('click', (e) => {
        const index = parseInt((e.target as HTMLButtonElement).dataset.index || '0');
        if (params.points.length > 2) {
          params.points.splice(index, 1);
          this.updatePatrolPointsList(bot);
        } else {
          alert('O bot precisa ter pelo menos 2 pontos de patrulha!');
        }
      });
    });
    
    // Event listeners para botões de captura
    listContainer.querySelectorAll('.capture-patrol-point').forEach(button => {
      button.addEventListener('click', (e) => {
        const index = parseInt((e.target as HTMLButtonElement).dataset.index || '0');
        this.capturingPatrolPoint = { bot, pointIndex: index };
        this.canvas.style.cursor = 'crosshair';
        
        // Mostrar feedback visual
        const overlay = document.createElement('div');
        overlay.id = 'capture-overlay';
        overlay.style.cssText = `
          position: fixed;
          top: 10px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(102, 126, 234, 0.95);
          color: white;
          padding: 15px 30px;
          border-radius: 10px;
          z-index: 10000;
          font-size: 14px;
          font-weight: bold;
          box-shadow: 0 5px 20px rgba(0,0,0,0.3);
        `;
        overlay.textContent = `Clique no campo para definir o Ponto ${index + 1} (ESC para cancelar)`;
        document.body.appendChild(overlay);
      });
    });
  }

  private showCheckpointProperties(checkpoint: EditorCheckpoint): void {
    if (!this.propertiesPanel) return;
    
    this.propertiesPanel.innerHTML = `
      <h3>Propriedades do Checkpoint</h3>
      <div class="property">
        <label>Raio:</label>
        <input type="number" id="prop-checkpoint-radius" value="${checkpoint.radius}" min="10" max="200" />
      </div>
      <div class="property">
        <label>Tempo Limite (s):</label>
        <input type="number" id="prop-checkpoint-time" value="${checkpoint.timeLimit}" min="1" max="300" />
      </div>
      <div class="property">
        <label>Ordem:</label>
        <input type="number" id="prop-checkpoint-order" value="${checkpoint.order}" min="1" />
      </div>
      <div class="property">
        <button id="prop-delete" class="delete-btn">Deletar Checkpoint</button>
      </div>
    `;
    
    document.getElementById('prop-checkpoint-radius')?.addEventListener('input', (e) => {
      checkpoint.radius = parseFloat((e.target as HTMLInputElement).value);
    });
    
    document.getElementById('prop-checkpoint-time')?.addEventListener('input', (e) => {
      checkpoint.timeLimit = parseFloat((e.target as HTMLInputElement).value);
    });
    
    document.getElementById('prop-checkpoint-order')?.addEventListener('input', (e) => {
      checkpoint.order = parseInt((e.target as HTMLInputElement).value);
    });
    
    document.getElementById('prop-delete')?.addEventListener('click', () => {
      this.deleteEntity(checkpoint);
    });
  }

  private showPathProperties(path: EditorPath): void {
    if (!this.propertiesPanel) return;
    
    this.propertiesPanel.innerHTML = `
      <h3>Propriedades do Caminho</h3>
      <div class="property">
        <label>Largura:</label>
        <input type="number" id="prop-path-width" value="${path.width}" min="10" max="300" />
      </div>
      <div class="property">
        <label>Ordem:</label>
        <input type="number" id="prop-path-order" value="${path.order}" min="1" />
      </div>
      <div class="property">
        <label>Pontos:</label>
        <div>${path.points.length} pontos</div>
      </div>
      <div class="property">
        <button id="prop-delete" class="delete-btn">Deletar Caminho</button>
      </div>
    `;
    
    document.getElementById('prop-path-width')?.addEventListener('input', (e) => {
      path.width = parseFloat((e.target as HTMLInputElement).value);
    });
    
    document.getElementById('prop-path-order')?.addEventListener('input', (e) => {
      path.order = parseInt((e.target as HTMLInputElement).value);
    });
    
    document.getElementById('prop-delete')?.addEventListener('click', () => {
      this.deleteEntity(path);
    });
  }

  private showSpecialEntityProperties(entity: EditorSpecialEntity): void {
    if (!this.propertiesPanel) return;
    
    this.propertiesPanel.classList.remove('hidden');
    
    if (entity === 'player') {
      const pos = this.scenarioSettings.playerSpawn || { x: 200, y: 300 };
      const vel = this.scenarioSettings.initialPlayerVelocity || { x: 0, y: 0 };
      const hasVelocity = this.velocityVisualizationEnabled.player;
      
      this.propertiesPanel.innerHTML = `
        <h3><i class="fas fa-user"></i> Configurações do Jogador</h3>
        
        <h4>Posição Inicial</h4>
        <div class="property">
          <label>Posição X:</label>
          <input type="number" id="prop-player-x" value="${Math.round(pos.x)}" />
        </div>
        <div class="property">
          <label>Posição Y:</label>
          <input type="number" id="prop-player-y" value="${Math.round(pos.y)}" />
        </div>
        
        <h4>Velocidade Inicial</h4>
        <div class="property">
          <label>
            <input type="checkbox" id="prop-player-has-velocity" ${hasVelocity ? 'checked' : ''} />
            Ativar velocidade inicial
          </label>
        </div>
        <div id="player-velocity-inputs" style="display: ${hasVelocity ? 'block' : 'none'};">
          <div class="property">
            <label>Velocidade X:</label>
            <input type="number" id="prop-player-vel-x" value="${vel.x}" step="10" />
          </div>
          <div class="property">
            <label>Velocidade Y:</label>
            <input type="number" id="prop-player-vel-y" value="${vel.y}" step="10" />
          </div>
          <div class="property" style="color: #888; font-size: 11px; margin-top: -5px;">
            <i class="fas fa-lightbulb"></i> Arraste a bolinha no campo para ajustar
          </div>
        </div>
        
        <h4>Física do Jogador</h4>
        <div class="property">
          <label>Raio do Jogador:</label>
          <input type="range" id="prop-player-radius" min="10" max="25" value="${this.config.playerRadius}" step="1" />
          <span id="prop-player-radius-value">${this.config.playerRadius}</span>
        </div>
        
        <h4>Chute</h4>
        <div class="property" style="color: #888; font-size: 11px; margin-bottom: 8px;">
          <i class="fas fa-info-circle"></i> Estas configurações serão exportadas com a playlist para garantir física determinística
        </div>
        <div class="property">
          <label>Modo de Chute:</label>
          <select id="prop-kick-mode">
            <option value="classic" ${this.config.kickMode === 'classic' ? 'selected' : ''}>Clássico (instantâneo)</option>
            <option value="chargeable" ${this.config.kickMode === 'chargeable' ? 'selected' : ''}>Carregável (segurar)</option>
          </select>
        </div>
        <div class="property">
          <label>Força do Chute:</label>
          <input type="range" id="prop-kick-strength" min="200" max="1000" value="${this.config.kickStrength}" step="50" />
          <span id="prop-kick-strength-value">${this.config.kickStrength}</span>
        </div>
        <div class="property">
          <label>Multiplicador de Velocidade:</label>
          <input type="range" id="prop-kick-speed-mult" min="0" max="1" value="${this.config.kickSpeedMultiplier || 0.5}" step="0.1" />
          <span id="prop-kick-speed-mult-value">${this.config.kickSpeedMultiplier || 0.5}</span>
        </div>
        
        <div class="property">
          <button id="prop-reset-player" class="apply-btn">Resetar Tudo</button>
        </div>
      `;
      
      // Posição
      document.getElementById('prop-player-x')?.addEventListener('input', (e) => {
        const x = parseFloat((e.target as HTMLInputElement).value);
        this.scenarioSettings.playerSpawn = { x, y: pos.y };
      });
      
      document.getElementById('prop-player-y')?.addEventListener('input', (e) => {
        const y = parseFloat((e.target as HTMLInputElement).value);
        this.scenarioSettings.playerSpawn = { x: pos.x, y };
      });
      
      // Checkbox de velocidade inicial
      document.getElementById('prop-player-has-velocity')?.addEventListener('change', (e) => {
        const checked = (e.target as HTMLInputElement).checked;
        this.velocityVisualizationEnabled.player = checked;
        const inputs = document.getElementById('player-velocity-inputs');
        if (inputs) inputs.style.display = checked ? 'block' : 'none';
        if (!checked) {
          delete this.scenarioSettings.initialPlayerVelocity;
        } else {
          this.scenarioSettings.initialPlayerVelocity = { x: 0, y: 0 };
        }
      });
      
      // Velocidade inicial
      document.getElementById('prop-player-vel-x')?.addEventListener('input', (e) => {
        const x = parseFloat((e.target as HTMLInputElement).value);
        this.scenarioSettings.initialPlayerVelocity = { x, y: vel.y };
      });
      
      document.getElementById('prop-player-vel-y')?.addEventListener('input', (e) => {
        const y = parseFloat((e.target as HTMLInputElement).value);
        this.scenarioSettings.initialPlayerVelocity = { x: vel.x, y };
      });
      
      // Raio do jogador
      const radiusInput = document.getElementById('prop-player-radius') as HTMLInputElement;
      const radiusValue = document.getElementById('prop-player-radius-value');
      radiusInput?.addEventListener('input', () => {
        const value = parseFloat(radiusInput.value);
        this.config.playerRadius = value;
        if (radiusValue) radiusValue.textContent = value.toString();
      });
      
      // Modo de chute
      document.getElementById('prop-kick-mode')?.addEventListener('change', (e) => {
        this.config.kickMode = (e.target as HTMLSelectElement).value as 'classic' | 'chargeable';
      });
      
      // Força do chute
      const strengthInput = document.getElementById('prop-kick-strength') as HTMLInputElement;
      const strengthValue = document.getElementById('prop-kick-strength-value');
      strengthInput?.addEventListener('input', () => {
        const value = parseFloat(strengthInput.value);
        this.config.kickStrength = value;
        if (strengthValue) strengthValue.textContent = value.toString();
      });
      
      // Multiplicador de velocidade
      const multInput = document.getElementById('prop-kick-speed-mult') as HTMLInputElement;
      const multValue = document.getElementById('prop-kick-speed-mult-value');
      multInput?.addEventListener('input', () => {
        const value = parseFloat(multInput.value);
        this.config.kickSpeedMultiplier = value;
        if (multValue) multValue.textContent = value.toFixed(1);
      });
      
      document.getElementById('prop-reset-player')?.addEventListener('click', () => {
        delete this.scenarioSettings.playerSpawn;
        delete this.scenarioSettings.initialPlayerVelocity;
        this.config.playerRadius = 15;
        this.config.kickMode = 'classic';
        this.config.kickStrength = 500;
        this.config.kickSpeedMultiplier = 0.5;
        this.selectedEntity = null;
        this.hidePropertiesPanel();
      });
    } else if (entity === 'ball') {
      const pos = this.scenarioSettings.ballSpawn || { x: 500, y: 300 };
      const vel = this.scenarioSettings.initialBallVelocity || { x: 0, y: 0 };
      const hasVelocity = this.velocityVisualizationEnabled.ball;
      
      this.propertiesPanel.innerHTML = `
        <h3><i class="fas fa-futbol"></i> Configurações da Bola</h3>
        
        <h4>Posição Inicial</h4>
        <div class="property">
          <label>Posição X:</label>
          <input type="number" id="prop-ball-x" value="${Math.round(pos.x)}" />
        </div>
        <div class="property">
          <label>Posição Y:</label>
          <input type="number" id="prop-ball-y" value="${Math.round(pos.y)}" />
        </div>
        
        <h4>Velocidade Inicial</h4>
        <div class="property">
          <label>
            <input type="checkbox" id="prop-ball-has-velocity" ${hasVelocity ? 'checked' : ''} />
            Ativar velocidade inicial
          </label>
        </div>
        <div id="ball-velocity-inputs" style="display: ${hasVelocity ? 'block' : 'none'};">
          <div class="property">
            <label>Velocidade X:</label>
            <input type="number" id="prop-ball-vel-x" value="${vel.x}" step="10" />
          </div>
          <div class="property">
            <label>Velocidade Y:</label>
            <input type="number" id="prop-ball-vel-y" value="${vel.y}" step="10" />
          </div>
          <div class="property" style="color: #888; font-size: 11px; margin-top: -5px;">
            <i class="fas fa-lightbulb"></i> Arraste a bolinha no campo para ajustar
          </div>
        </div>
        
        <h4>Física da Bola</h4>
        <div class="property">
          <label>Raio:</label>
          <input type="range" id="prop-ball-radius" min="5" max="20" value="${this.config.ballConfig.radius}" step="1" />
          <span id="prop-ball-radius-value">${this.config.ballConfig.radius}</span>
        </div>
        <div class="property">
          <label>Massa:</label>
          <input type="range" id="prop-ball-mass" min="1" max="10" value="${this.config.ballConfig.mass}" step="0.5" />
          <span id="prop-ball-mass-value">${this.config.ballConfig.mass}</span>
        </div>
        <div class="property">
          <label>Amortecimento:</label>
          <input type="range" id="prop-ball-damping" min="0.9" max="0.999" value="${this.config.ballConfig.damping}" step="0.001" />
          <span id="prop-ball-damping-value">${this.config.ballConfig.damping.toFixed(3)}</span>
        </div>
        
        <h4>Aparência</h4>
        <div class="property">
          <label>Cor da Bola:</label>
          <input type="color" id="prop-ball-color" value="${this.config.ballConfig.color}" />
        </div>
        <div class="property">
          <label>Cor da Borda:</label>
          <input type="color" id="prop-ball-border-color" value="${this.config.ballConfig.borderColor}" />
        </div>
        <div class="property">
          <label>Largura da Borda:</label>
          <input type="range" id="prop-ball-border-width" min="1" max="5" value="${this.config.ballConfig.borderWidth}" step="1" />
          <span id="prop-ball-border-width-value">${this.config.ballConfig.borderWidth}</span>
        </div>
        
        <div class="property">
          <button id="prop-reset-ball" class="apply-btn">Resetar Tudo</button>
        </div>
      `;
      
      // Posição
      document.getElementById('prop-ball-x')?.addEventListener('input', (e) => {
        const x = parseFloat((e.target as HTMLInputElement).value);
        this.scenarioSettings.ballSpawn = { x, y: pos.y };
      });
      
      document.getElementById('prop-ball-y')?.addEventListener('input', (e) => {
        const y = parseFloat((e.target as HTMLInputElement).value);
        this.scenarioSettings.ballSpawn = { x: pos.x, y };
      });
      
      // Checkbox de velocidade inicial
      document.getElementById('prop-ball-has-velocity')?.addEventListener('change', (e) => {
        const checked = (e.target as HTMLInputElement).checked;
        this.velocityVisualizationEnabled.ball = checked;
        const inputs = document.getElementById('ball-velocity-inputs');
        if (inputs) inputs.style.display = checked ? 'block' : 'none';
        if (!checked) {
          delete this.scenarioSettings.initialBallVelocity;
        } else {
          this.scenarioSettings.initialBallVelocity = { x: 0, y: 0 };
        }
      });
      
      // Velocidade inicial
      document.getElementById('prop-ball-vel-x')?.addEventListener('input', (e) => {
        const x = parseFloat((e.target as HTMLInputElement).value);
        if (!this.scenarioSettings.initialBallVelocity) this.scenarioSettings.initialBallVelocity = { x: 0, y: 0 };
        this.scenarioSettings.initialBallVelocity.x = x;
      });
      
      document.getElementById('prop-ball-vel-y')?.addEventListener('input', (e) => {
        const y = parseFloat((e.target as HTMLInputElement).value);
        if (!this.scenarioSettings.initialBallVelocity) this.scenarioSettings.initialBallVelocity = { x: 0, y: 0 };
        this.scenarioSettings.initialBallVelocity.y = y;
      });
      
      // Física
      const radiusInput = document.getElementById('prop-ball-radius') as HTMLInputElement;
      const radiusValue = document.getElementById('prop-ball-radius-value');
      radiusInput?.addEventListener('input', () => {
        const value = parseFloat(radiusInput.value);
        this.config.ballConfig.radius = value;
        if (radiusValue) radiusValue.textContent = value.toString();
      });
      
      const massInput = document.getElementById('prop-ball-mass') as HTMLInputElement;
      const massValue = document.getElementById('prop-ball-mass-value');
      massInput?.addEventListener('input', () => {
        const value = parseFloat(massInput.value);
        this.config.ballConfig.mass = value;
        if (massValue) massValue.textContent = value.toString();
      });
      
      const dampingInput = document.getElementById('prop-ball-damping') as HTMLInputElement;
      const dampingValue = document.getElementById('prop-ball-damping-value');
      dampingInput?.addEventListener('input', () => {
        const value = parseFloat(dampingInput.value);
        this.config.ballConfig.damping = value;
        if (dampingValue) dampingValue.textContent = value.toFixed(3);
      });
      
      // Aparência
      document.getElementById('prop-ball-color')?.addEventListener('input', (e) => {
        this.config.ballConfig.color = (e.target as HTMLInputElement).value;
      });
      
      document.getElementById('prop-ball-border-color')?.addEventListener('input', (e) => {
        this.config.ballConfig.borderColor = (e.target as HTMLInputElement).value;
      });
      
      const borderWidthInput = document.getElementById('prop-ball-border-width') as HTMLInputElement;
      const borderWidthValue = document.getElementById('prop-ball-border-width-value');
      borderWidthInput?.addEventListener('input', () => {
        const value = parseFloat(borderWidthInput.value);
        this.config.ballConfig.borderWidth = value;
        if (borderWidthValue) borderWidthValue.textContent = value.toString();
      });
      
      document.getElementById('prop-reset-ball')?.addEventListener('click', () => {
        delete this.scenarioSettings.ballSpawn;
        delete this.scenarioSettings.initialBallVelocity;
        this.config.ballConfig = {
          radius: 8,
          mass: 2,
          damping: 0.99,
          color: '#ffff00',
          borderColor: '#000000',
          borderWidth: 2
        };
        this.selectedEntity = null;
        this.hidePropertiesPanel();
      });
    }
  }

  private deleteEntity(entity: EditorEntity): void {
    const index = this.entities.indexOf(entity);
    if (index > -1) {
      this.entities.splice(index, 1);
    }
    this.selectedEntity = null;
    this.hidePropertiesPanel();
  }

  private saveCurrentScenario(): void {
    this.scenarios[this.currentScenarioIndex] = {
      settings: { ...this.scenarioSettings },
      entities: [...this.entities]
    };
  }

  private loadScenario(index: number): void {
    if (index < 0 || index >= this.scenarios.length) return;
    
    this.saveCurrentScenario();
    this.currentScenarioIndex = index;
    
    const scenario = this.scenarios[index];
    this.scenarioSettings = { ...scenario.settings };
    this.entities = [...scenario.entities];
    this.selectedEntity = null;
    
    this.updateScenarioCounter();
  }

  private updateScenarioCounter(): void {
    const counter = document.getElementById('editor-scenario-counter');
    if (counter) {
      counter.textContent = `${this.currentScenarioIndex + 1} / ${this.scenarios.length}`;
    }
  }

  private previousScenario(): void {
    if (this.currentScenarioIndex > 0) {
      this.loadScenario(this.currentScenarioIndex - 1);
    }
  }

  private nextScenario(): void {
    if (this.currentScenarioIndex < this.scenarios.length - 1) {
      this.loadScenario(this.currentScenarioIndex + 1);
    }
  }

  private addScenario(): void {
    this.saveCurrentScenario();
    
    const newScenario: EditorScenario = {
      settings: {
        name: `Cenário ${this.scenarios.length + 1}`,
        timeLimit: 60,
        goalObjective: { team: 'red' }
      },
      entities: []
    };
    
    this.scenarios.push(newScenario);
    this.loadScenario(this.scenarios.length - 1);
  }

  private removeScenario(): void {
    if (this.scenarios.length <= 1) {
      alert('Você precisa ter pelo menos um cenário!');
      return;
    }
    
    if (confirm(`Remover cenário "${this.scenarioSettings.name}"?`)) {
      this.scenarios.splice(this.currentScenarioIndex, 1);
      
      if (this.currentScenarioIndex >= this.scenarios.length) {
        this.currentScenarioIndex = this.scenarios.length - 1;
      }
      
      this.loadScenario(this.currentScenarioIndex);
    }
  }

  private showPlaylistSettings(): void {
    if (!this.propertiesPanel) return;
    
    this.propertiesPanel.classList.remove('hidden');
    this.propertiesPanel.innerHTML = `
      <h3>Configurações da Playlist</h3>
      <div class="property">
        <label>Nome da Playlist:</label>
        <input type="text" id="prop-playlist-name" value="${this.playlistSettings.name}" />
      </div>
      <div class="property">
        <label>Descrição:</label>
        <textarea id="prop-playlist-description" rows="3">${this.playlistSettings.description}</textarea>
      </div>
      <div class="property">
        <label>Cenários: ${this.scenarios.length}</label>
      </div>
      <div class="property">
        <button id="prop-apply-playlist" class="apply-btn">Aplicar</button>
      </div>
    `;
    
    document.getElementById('prop-apply-playlist')?.addEventListener('click', () => {
      this.applyPlaylistSettings();
    });
  }

  private applyPlaylistSettings(): void {
    this.playlistSettings.name = (document.getElementById('prop-playlist-name') as HTMLInputElement).value;
    this.playlistSettings.description = (document.getElementById('prop-playlist-description') as HTMLTextAreaElement).value;
    
    this.propertiesPanel?.classList.add('hidden');
  }

  private showScenarioSettings(): void {
    if (!this.propertiesPanel) return;
    
    this.selectedEntity = null;
    this.propertiesPanel.classList.remove('hidden');
    
    const settings = this.scenarioSettings;
    
    this.propertiesPanel.innerHTML = `
      <h3>Configurações do Cenário</h3>
      
      <div class="property">
        <label>Nome:</label>
        <input type="text" id="prop-scenario-name" value="${settings.name}" />
      </div>
      
      <div class="property">
        <label>Tempo Limite (s):</label>
        <input type="number" id="prop-scenario-time" value="${settings.timeLimit}" min="10" max="300" />
      </div>
      
      <h4 style="margin-top: 20px; margin-bottom: 10px; color: #667eea;">Spawns</h4>
      
      <div class="property">
        <label>Ball Spawn X:</label>
        <input type="number" id="prop-ball-spawn-x" value="${settings.ballSpawn?.x || ''}" placeholder="Padrão do mapa" />
      </div>
      
      <div class="property">
        <label>Ball Spawn Y:</label>
        <input type="number" id="prop-ball-spawn-y" value="${settings.ballSpawn?.y || ''}" placeholder="Padrão do mapa" />
      </div>
      
      <div class="property">
        <label>Player Spawn X:</label>
        <input type="number" id="prop-player-spawn-x" value="${settings.playerSpawn?.x || ''}" placeholder="Padrão do mapa" />
      </div>
      
      <div class="property">
        <label>Player Spawn Y:</label>
        <input type="number" id="prop-player-spawn-y" value="${settings.playerSpawn?.y || ''}" placeholder="Padrão do mapa" />
      </div>
      
      <h4 style="margin-top: 20px; margin-bottom: 10px; color: #667eea;">Velocidades Iniciais</h4>
      
      <div class="property">
        <label>Ball Velocity X:</label>
        <input type="number" id="prop-ball-vel-x" value="${settings.initialBallVelocity?.x || ''}" placeholder="0" />
      </div>
      
      <div class="property">
        <label>Ball Velocity Y:</label>
        <input type="number" id="prop-ball-vel-y" value="${settings.initialBallVelocity?.y || ''}" placeholder="0" />
      </div>
      
      <div class="property">
        <label>Player Velocity X:</label>
        <input type="number" id="prop-player-vel-x" value="${settings.initialPlayerVelocity?.x || ''}" placeholder="0" />
      </div>
      
      <div class="property">
        <label>Player Velocity Y:</label>
        <input type="number" id="prop-player-vel-y" value="${settings.initialPlayerVelocity?.y || ''}" placeholder="0" />
      </div>
      
      <h4 style="margin-top: 20px; margin-bottom: 10px; color: #667eea;">Objetivos Adicionais</h4>
      
      <div class="property">
        <label>Qual time deve marcar gol:</label>
        <select id="prop-goal-objective">
          <option value="">Nenhum (sem objetivo de gol)</option>
          <option value="red" ${settings.goalObjective?.team === 'red' ? 'selected' : ''}>Time Vermelho</option>
          <option value="blue" ${settings.goalObjective?.team === 'blue' ? 'selected' : ''}>Time Azul</option>
        </select>
      </div>
      
      <div class="property" id="prop-goal-scored-by-container" style="display: ${settings.goalObjective ? 'block' : 'none'};">
        <label>Quem deve fazer o gol:</label>
        <select id="prop-goal-scored-by">
          <option value="">Qualquer um (Player ou Bot)</option>
          <option value="player" ${settings.goalObjective?.scoredBy === 'player' ? 'selected' : ''}>Apenas o Player</option>
          <option value="bot" ${settings.goalObjective?.scoredBy === 'bot' ? 'selected' : ''}>Apenas um Bot</option>
        </select>
      </div>
      
      <div class="property" id="prop-goal-bot-id-container" style="display: ${settings.goalObjective?.scoredBy === 'bot' ? 'block' : 'none'};">
        <label>Bot específico (ID):</label>
        <input type="text" id="prop-goal-bot-id" value="${settings.goalObjective?.scoredByBotId || ''}" placeholder="Deixe vazio para qualquer bot aliado" />
        <small style="color: #666; font-size: 11px;">Clique em um bot no canvas para copiar seu ID</small>
      </div>
      
      <div class="property">
        <label>NÃO tomar Gol (time protegido):</label>
        <select id="prop-no-goal-objective">
          <option value="">Nenhum</option>
          <option value="red" ${settings.noGoalObjective?.team === 'red' ? 'selected' : ''}>Time Vermelho</option>
          <option value="blue" ${settings.noGoalObjective?.team === 'blue' ? 'selected' : ''}>Time Azul</option>
        </select>
      </div>
      
      <div class="property">
        <label>Chutes Mínimos:</label>
        <input type="number" id="prop-kick-min" value="${settings.kickCountObjective?.min || ''}" placeholder="Sem mínimo" min="0" />
      </div>
      
      <div class="property">
        <label>Chutes Máximos:</label>
        <input type="number" id="prop-kick-max" value="${settings.kickCountObjective?.max || ''}" placeholder="Sem máximo" min="0" />
      </div>
      
      <div class="property">
        <label>Chutes Exatos:</label>
        <input type="number" id="prop-kick-exact" value="${settings.kickCountObjective?.exact || ''}" placeholder="Não obrigatório" min="0" />
      </div>
      
      <div class="property">
        <label>Falha se tocar na bola:</label>
        <div style="display: flex; gap: 10px;">
          <label style="display: flex; align-items: center; gap: 5px;">
            <input type="checkbox" id="prop-prevent-red" ${settings.preventBotTeamTouch?.teams.includes('red') ? 'checked' : ''} />
            Bot Vermelho
          </label>
          <label style="display: flex; align-items: center; gap: 5px;">
            <input type="checkbox" id="prop-prevent-blue" ${settings.preventBotTeamTouch?.teams.includes('blue') ? 'checked' : ''} />
            Bot Azul
          </label>
        </div>
      </div>
      
      <div class="property">
        <button id="prop-apply-settings" style="width: 100%; padding: 10px; background: rgba(102, 126, 234, 0.8); border: none; color: white; border-radius: 5px; cursor: pointer; font-size: 14px; font-weight: 600;">Aplicar</button>
      </div>
    `;
    
    document.getElementById('prop-apply-settings')?.addEventListener('click', () => {
      this.applyScenarioSettings();
    });
    
    // Event listeners para mostrar/ocultar campos condicionalmente
    const goalObjectiveSelect = document.getElementById('prop-goal-objective') as HTMLSelectElement;
    const scoredByContainer = document.getElementById('prop-goal-scored-by-container');
    const scoredBySelect = document.getElementById('prop-goal-scored-by') as HTMLSelectElement;
    const botIdContainer = document.getElementById('prop-goal-bot-id-container');
    
    goalObjectiveSelect?.addEventListener('change', () => {
      if (scoredByContainer) {
        scoredByContainer.style.display = goalObjectiveSelect.value ? 'block' : 'none';
      }
    });
    
    scoredBySelect?.addEventListener('change', () => {
      if (botIdContainer) {
        botIdContainer.style.display = scoredBySelect.value === 'bot' ? 'block' : 'none';
      }
    });
  }
  
  private applyScenarioSettings(): void {
    const settings = this.scenarioSettings;
    
    settings.name = (document.getElementById('prop-scenario-name') as HTMLInputElement).value;
    settings.timeLimit = parseFloat((document.getElementById('prop-scenario-time') as HTMLInputElement).value);
    
    // Ball spawn
    const ballX = (document.getElementById('prop-ball-spawn-x') as HTMLInputElement).value;
    const ballY = (document.getElementById('prop-ball-spawn-y') as HTMLInputElement).value;
    if (ballX && ballY) {
      settings.ballSpawn = { x: parseFloat(ballX), y: parseFloat(ballY) };
    } else {
      settings.ballSpawn = undefined;
    }
    
    // Player spawn
    const playerX = (document.getElementById('prop-player-spawn-x') as HTMLInputElement).value;
    const playerY = (document.getElementById('prop-player-spawn-y') as HTMLInputElement).value;
    if (playerX && playerY) {
      settings.playerSpawn = { x: parseFloat(playerX), y: parseFloat(playerY) };
    } else {
      settings.playerSpawn = undefined;
    }
    
    // Ball velocity
    const ballVelX = (document.getElementById('prop-ball-vel-x') as HTMLInputElement).value;
    const ballVelY = (document.getElementById('prop-ball-vel-y') as HTMLInputElement).value;
    if (ballVelX || ballVelY) {
      settings.initialBallVelocity = { 
        x: ballVelX ? parseFloat(ballVelX) : 0, 
        y: ballVelY ? parseFloat(ballVelY) : 0 
      };
    } else {
      settings.initialBallVelocity = undefined;
    }
    
    // Player velocity
    const playerVelX = (document.getElementById('prop-player-vel-x') as HTMLInputElement).value;
    const playerVelY = (document.getElementById('prop-player-vel-y') as HTMLInputElement).value;
    if (playerVelX || playerVelY) {
      settings.initialPlayerVelocity = { 
        x: playerVelX ? parseFloat(playerVelX) : 0, 
        y: playerVelY ? parseFloat(playerVelY) : 0 
      };
    } else {
      settings.initialPlayerVelocity = undefined;
    }
    
    // Goal objective
    const goalTeam = (document.getElementById('prop-goal-objective') as HTMLSelectElement).value;
    if (goalTeam) {
      const scoredBy = (document.getElementById('prop-goal-scored-by') as HTMLSelectElement).value;
      const scoredByBotId = (document.getElementById('prop-goal-bot-id') as HTMLInputElement).value;
      
      settings.goalObjective = { 
        team: goalTeam as 'red' | 'blue',
        scoredBy: scoredBy ? scoredBy as 'player' | 'bot' : undefined,
        scoredByBotId: scoredByBotId || undefined
      };
    } else {
      settings.goalObjective = undefined;
    }
    
    // No goal objective
    const noGoalTeam = (document.getElementById('prop-no-goal-objective') as HTMLSelectElement).value;
    if (noGoalTeam) {
      settings.noGoalObjective = { team: noGoalTeam as 'red' | 'blue' };
    } else {
      settings.noGoalObjective = undefined;
    }
    
    // Kick count objective
    const kickMin = (document.getElementById('prop-kick-min') as HTMLInputElement).value;
    const kickMax = (document.getElementById('prop-kick-max') as HTMLInputElement).value;
    const kickExact = (document.getElementById('prop-kick-exact') as HTMLInputElement).value;
    
    if (kickMin || kickMax || kickExact) {
      settings.kickCountObjective = {
        min: kickMin ? parseInt(kickMin) : undefined,
        max: kickMax ? parseInt(kickMax) : undefined,
        exact: kickExact ? parseInt(kickExact) : undefined
      };
    } else {
      settings.kickCountObjective = undefined;
    }
    
    // Prevent bot team touch objective
    const preventRed = (document.getElementById('prop-prevent-red') as HTMLInputElement).checked;
    const preventBlue = (document.getElementById('prop-prevent-blue') as HTMLInputElement).checked;
    
    if (preventRed || preventBlue) {
      const teams: ('red' | 'blue')[] = [];
      if (preventRed) teams.push('red');
      if (preventBlue) teams.push('blue');
      settings.preventBotTeamTouch = { teams };
    } else {
      settings.preventBotTeamTouch = undefined;
    }
    
    this.hidePropertiesPanel();
    alert('Configurações aplicadas!');
  }

  private hidePropertiesPanel(): void {
    this.propertiesPanel?.classList.add('hidden');
  }

  private startRenderLoop(): void {
    const render = () => {
      this.render();
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  }
  
  private renderMap(map: GameMap): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    
    // Desenhar segmentos
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const segment of map.segments) {
      ctx.moveTo(segment.p1.x, segment.p1.y);
      ctx.lineTo(segment.p2.x, segment.p2.y);
    }
    ctx.stroke();
    
    // Desenhar gols
    for (const goal of map.goals) {
      ctx.strokeStyle = goal.team === 'red' ? '#ff4757' : '#5352ed';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(goal.p1.x, goal.p1.y);
      ctx.lineTo(goal.p2.x, goal.p2.y);
      ctx.stroke();
    }
    
    // Linha central
    ctx.strokeStyle = '#444';
    ctx.setLineDash([10, 10]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.canvas.width / 2, 50);
    ctx.lineTo(this.canvas.width / 2, this.canvas.height - 50);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Círculo central
    ctx.beginPath();
    ctx.arc(this.canvas.width / 2, this.canvas.height / 2, 80, 0, Math.PI * 2);
    ctx.stroke();
  }

  private render(): void {
    // Não renderizar se estiver em modo de teste
    if (this.isTestMode) return;
    
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    
    // Limpar canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Renderizar mapa
    const map = this.mapType === 'classic' ? CLASSIC_MAP : DEFAULT_MAP;
    this.renderMap(map);
    
    // Renderizar entidades
    this.renderEntities(ctx);
    
    // Renderizar caminho sendo desenhado
    if (this.pathBeingDrawn && this.pathBeingDrawn.length > 0) {
      this.renderPathPreview(ctx, this.pathBeingDrawn);
      
      // Mostrar instrução
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(10, 10, 280, 80);
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px Arial';
      ctx.fillText('Clique para adicionar pontos', 20, 30);
      ctx.fillText('Enter: Finalizar caminho', 20, 50);
      ctx.fillText('Esc: Cancelar', 20, 70);
      ctx.restore();
    }
  }

  private renderEntities(ctx: CanvasRenderingContext2D): void {
    // Renderizar jogador
    this.renderPlayer(ctx);
    
    // Renderizar bola
    this.renderBall(ctx);
    
    // Renderizar outras entidades
    this.entities.forEach(entity => {
      if ('spawn' in entity) {
        this.renderBot(ctx, entity);
      } else if ('position' in entity && 'radius' in entity) {
        this.renderCheckpoint(ctx, entity);
      } else if ('points' in entity) {
        this.renderPath(ctx, entity);
      }
    });
    
    // Renderizar pontos de patrulha se um bot com patrol estiver selecionado
    if (this.selectedEntity && typeof this.selectedEntity === 'object' && 'spawn' in this.selectedEntity) {
      const bot = this.selectedEntity as EditorBot;
      if (bot.behavior.type === 'ai_preset' && bot.behavior.config.type === 'ai_preset' && bot.behavior.config.preset === 'patrol') {
        this.renderPatrolWaypoints(ctx, bot);
      }
    }
    
    // Renderizar visualização de velocidade inicial
    if (this.velocityVisualizationEnabled.player && this.selectedEntity === 'player') {
      this.renderVelocityVisualization(ctx, 'player');
    }
    if (this.velocityVisualizationEnabled.ball && this.selectedEntity === 'ball') {
      this.renderVelocityVisualization(ctx, 'ball');
    }
  }

  private renderPatrolWaypoints(ctx: CanvasRenderingContext2D, bot: EditorBot): void {
    if (bot.behavior.config.type !== 'ai_preset') return;
    if (!bot.behavior.config.params) return;
    
    const patrolParams = bot.behavior.config.params as PatrolParams;
    if (!patrolParams.points || patrolParams.points.length === 0) return;
    
    ctx.save();
    
    // Desenhar linhas conectando os pontos
    if (patrolParams.points.length > 1) {
      ctx.beginPath();
      ctx.moveTo(patrolParams.points[0].x, patrolParams.points[0].y);
      for (let i = 1; i < patrolParams.points.length; i++) {
        ctx.lineTo(patrolParams.points[i].x, patrolParams.points[i].y);
      }
      ctx.strokeStyle = 'rgba(255, 200, 0, 0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
    // Desenhar círculos numerados em cada ponto
    patrolParams.points.forEach((point, index) => {
      // Círculo externo
      ctx.beginPath();
      ctx.arc(point.x, point.y, 12, 0, Math.PI * 2);
      ctx.fillStyle = '#ffc800';
      ctx.fill();
      ctx.strokeStyle = '#ff8800';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Número da ordem
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((index + 1).toString(), point.x, point.y);
    });
    
    ctx.restore();
  }

  private renderPlayer(ctx: CanvasRenderingContext2D): void {
    const pos = this.scenarioSettings.playerSpawn || { x: 200, y: 300 };
    const isSelected = this.selectedEntity === 'player';
    
    ctx.save();
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 15, 0, Math.PI * 2);
    ctx.fillStyle = '#ff4444';
    ctx.fill();
    
    if (isSelected) {
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('P', pos.x, pos.y);
    
    // Mostrar "PLAYER" em cima
    ctx.fillStyle = isSelected ? '#ffff00' : '#ffffff';
    ctx.font = '12px Arial';
    ctx.fillText('PLAYER', pos.x, pos.y - 25);
    ctx.restore();
  }

  private renderBall(ctx: CanvasRenderingContext2D): void {
    const pos = this.scenarioSettings.ballSpawn || { x: 500, y: 300 };
    const isSelected = this.selectedEntity === 'ball';
    const radius = this.config.ballConfig.radius;
    
    ctx.save();
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = this.config.ballConfig.color;
    ctx.fill();
    
    if (isSelected) {
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 3;
      ctx.stroke();
    } else {
      ctx.strokeStyle = this.config.ballConfig.borderColor;
      ctx.lineWidth = this.config.ballConfig.borderWidth;
      ctx.stroke();
    }
    
    // Mostrar "BALL" em cima
    ctx.fillStyle = isSelected ? '#ffff00' : '#ffffff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('BALL', pos.x, pos.y - 20);
    ctx.restore();
  }

  private renderVelocityVisualization(ctx: CanvasRenderingContext2D, entity: 'player' | 'ball'): void {
    let pos: Vector2D;
    let vel: Vector2D;
    let color: string;
    
    if (entity === 'player') {
      pos = this.scenarioSettings.playerSpawn || { x: 200, y: 300 };
      vel = this.scenarioSettings.initialPlayerVelocity || { x: 0, y: 0 };
      color = '#ff4444';
    } else {
      pos = this.scenarioSettings.ballSpawn || { x: 500, y: 300 };
      vel = this.scenarioSettings.initialBallVelocity || { x: 0, y: 0 };
      color = this.config.ballConfig.color;
    }
    
    const handlePos = { x: pos.x + vel.x, y: pos.y + vel.y };
    const isDragging = this.draggingVelocityHandle === entity;
    
    ctx.save();
    
    // Desenhar linha da entidade até o handle
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(handlePos.x, handlePos.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Desenhar seta na ponta
    const arrowSize = 10;
    const angle = Math.atan2(vel.y, vel.x);
    ctx.beginPath();
    ctx.moveTo(handlePos.x, handlePos.y);
    ctx.lineTo(
      handlePos.x - arrowSize * Math.cos(angle - Math.PI / 6),
      handlePos.y - arrowSize * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(handlePos.x, handlePos.y);
    ctx.lineTo(
      handlePos.x - arrowSize * Math.cos(angle + Math.PI / 6),
      handlePos.y - arrowSize * Math.sin(angle + Math.PI / 6)
    );
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Desenhar handle (bolinha)
    ctx.beginPath();
    ctx.arc(handlePos.x, handlePos.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = isDragging ? '#ffff00' : color;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Mostrar magnitude da velocidade
    const magnitude = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(magnitude)}`, handlePos.x, handlePos.y - 15);
    
    ctx.restore();
  }

  private renderBot(ctx: CanvasRenderingContext2D, bot: EditorBot): void {
    const isSelected = this.selectedEntity === bot;
    const radius = bot.radius ?? 15;
    
    ctx.save();
    ctx.beginPath();
    ctx.arc(bot.spawn.x, bot.spawn.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = bot.team === 'red' ? '#ff4444' : '#4444ff';
    ctx.fill();
    
    if (isSelected) {
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    
    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.max(12, radius)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('B', bot.spawn.x, bot.spawn.y);
    ctx.restore();
  }

  private renderCheckpoint(ctx: CanvasRenderingContext2D, checkpoint: EditorCheckpoint): void {
    const isSelected = this.selectedEntity === checkpoint;
    
    ctx.save();
    ctx.beginPath();
    ctx.arc(checkpoint.position.x, checkpoint.position.y, checkpoint.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
    ctx.fill();
    ctx.strokeStyle = isSelected ? '#ffff00' : '#00ff00';
    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.stroke();
    
    // Desenhar ordem
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(checkpoint.order.toString(), checkpoint.position.x, checkpoint.position.y);
    ctx.restore();
  }

  private renderPath(ctx: CanvasRenderingContext2D, path: EditorPath): void {
    if (path.points.length < 2) return;
    
    const isSelected = this.selectedEntity === path;
    
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(path.points[0].x, path.points[0].y);
    
    for (let i = 1; i < path.points.length; i++) {
      ctx.lineTo(path.points[i].x, path.points[i].y);
    }
    
    ctx.strokeStyle = isSelected ? 'rgba(255, 255, 0, 0.5)' : 'rgba(255, 165, 0, 0.5)';
    ctx.lineWidth = path.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    
    // Desenhar pontos
    path.points.forEach((point, idx) => {
      ctx.beginPath();
      const pointRadius = isSelected ? 8 : 5;
      ctx.arc(point.x, point.y, pointRadius, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#ffff00' : '#ff8800';
      ctx.fill();
      
      // Adicionar borda branca quando selecionado
      if (isSelected) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      
      // Mostrar número do ponto quando selecionado
      if (isSelected) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((idx + 1).toString(), point.x, point.y - 15);
      }
    });
    
    ctx.restore();
  }

  private renderPathPreview(ctx: CanvasRenderingContext2D, points: Vector2D[]): void {
    if (points.length === 0) return;
    
    ctx.save();
    
    if (points.length === 1) {
      ctx.beginPath();
      ctx.arc(points[0].x, points[0].y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#ff8800';
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      
      ctx.strokeStyle = 'rgba(255, 165, 0, 0.3)';
      ctx.lineWidth = 80;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      
      points.forEach(point => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#ff8800';
        ctx.fill();
      });
    }
    
    ctx.restore();
  }

  private saveScenario(): void {
    // Salvar o cenário atual antes de exportar
    this.saveCurrentScenario();
    
    // Exportar playlist completa
    const playlist = this.exportPlaylist();
    const json = JSON.stringify(playlist, null, 2);
    
    // Download como arquivo JSON
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = this.playlistSettings.name.toLowerCase().replace(/\s+/g, '-');
    a.download = `${filename}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    alert(`Playlist "${this.playlistSettings.name}" exportada com ${this.scenarios.length} cenário(s)!`);
    console.log('Playlist exportada:', playlist);
  }

  private importPlaylist(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        // Verificar se é uma playlist válida
        if (!data.scenarios || !Array.isArray(data.scenarios)) {
          throw new Error('Arquivo JSON inválido: deve conter um array "scenarios"');
        }
        
        // Perguntar se quer substituir ou adicionar
        const replace = confirm(`Importar "${data.name || 'Playlist'}"?\n\nOK = Substituir playlist atual\nCancelar = Adicionar cenários à playlist atual`);
        
        if (replace) {
          // Substituir tudo
          this.playlistSettings.name = data.name || 'Playlist Importada';
          this.playlistSettings.description = data.description || '';
          this.scenarios = [];
          
          // Importar configurações de física se existirem
          if (data.gameConfig) {
            if (data.gameConfig.kickStrength !== undefined) {
              this.config.kickStrength = data.gameConfig.kickStrength;
            }
            if (data.gameConfig.kickMode !== undefined) {
              this.config.kickMode = data.gameConfig.kickMode;
            }
            if (data.gameConfig.playerRadius !== undefined) {
              this.config.playerRadius = data.gameConfig.playerRadius;
            }
            if (data.gameConfig.playerSpeed !== undefined) {
              this.config.playerSpeed = data.gameConfig.playerSpeed;
            }
            if (data.gameConfig.playerAcceleration !== undefined) {
              this.config.playerAcceleration = data.gameConfig.playerAcceleration;
            }
            if (data.gameConfig.kickSpeedMultiplier !== undefined) {
              this.config.kickSpeedMultiplier = data.gameConfig.kickSpeedMultiplier;
            }
            if (data.gameConfig.ballConfig) {
              this.config.ballConfig = { ...this.config.ballConfig, ...data.gameConfig.ballConfig };
            }
          }
        }
        
        // Importar cenários
        for (const scenario of data.scenarios) {
          const editorScenario = this.convertScenarioToEditor(scenario);
          this.scenarios.push(editorScenario);
        }
        
        // Carregar primeiro cenário
        if (replace) {
          this.currentScenarioIndex = 0;
          const scenario = this.scenarios[0];
          this.scenarioSettings = { ...scenario.settings };
          this.entities = [...scenario.entities];
          this.selectedEntity = null;
        }
        
        this.updateScenarioCounter();
        alert(`${data.scenarios.length} cenário(s) importado(s) com sucesso!`);
        
      } catch (error) {
        alert(`Erro ao importar playlist: ${error}`);
        console.error('Erro na importação:', error);
      }
    };
    input.click();
  }

  private convertScenarioToEditor(scenario: Scenario): EditorScenario {
    const settings: ScenarioSettings = {
      name: scenario.name || 'Cenário Importado',
      timeLimit: scenario.timeLimit || 60,
      ballSpawn: scenario.ballSpawn,
      playerSpawn: scenario.playerSpawn,
      initialBallVelocity: scenario.initialBallVelocity,
      initialPlayerVelocity: scenario.initialPlayerVelocity
    };
    
    const entities: EditorEntity[] = [];
    let checkpointOrder = 1;
    let pathOrder = 1;
    
    // Importar objetivos
    if (scenario.objectives) {
      for (const obj of scenario.objectives) {
        if (obj.type === 'checkpoint') {
          const checkpoint: EditorCheckpoint = {
            editorId: `checkpoint-${this.nextEntityId++}`,
            type: 'checkpoint',
            position: obj.position,
            radius: obj.radius,
            order: checkpointOrder++,
            timeLimit: obj.timeLimit || 0
          };
          entities.push(checkpoint);
        } else if (obj.type === 'path') {
          const path: EditorPath = {
            editorId: `path-${this.nextEntityId++}`,
            type: 'path',
            points: obj.points,
            width: obj.width,
            order: pathOrder++
          };
          entities.push(path);
        } else if (obj.type === 'goal') {
          settings.goalObjective = { 
            team: obj.team,
            scoredBy: (obj as any).scoredBy,
            scoredByBotId: (obj as any).scoredByBotId
          };
        } else if (obj.type === 'no_goal') {
          settings.noGoalObjective = { team: obj.team };
        } else if (obj.type === 'kick_count') {
          settings.kickCountObjective = {
            min: obj.min,
            max: obj.max,
            exact: obj.exact
          };
        } else if (obj.type === 'prevent_touch') {
          // Inferir os times a partir dos bot IDs
          const preventTeams: ('red' | 'blue')[] = [];
          if (scenario.bots) {
            const botTeams = new Set<'red' | 'blue'>();
            scenario.bots.forEach(bot => {
              if (obj.preventBotIds.includes(bot.id)) {
                botTeams.add(bot.team);
              }
            });
            preventTeams.push(...Array.from(botTeams));
          }
          if (preventTeams.length > 0) {
            settings.preventBotTeamTouch = { teams: preventTeams };
          }
        }
      }
    }
    
    // Importar bots
    if (scenario.bots) {
      for (const bot of scenario.bots) {
        const editorBot: EditorBot = {
          editorId: `bot-${this.nextEntityId++}`,
          id: bot.id,
          name: bot.name,
          team: bot.team,
          spawn: bot.spawn,
          behavior: bot.behavior,
          radius: bot.radius ?? 15 // Usar padrão se não especificado
        };
        entities.push(editorBot);
      }
    }
    
    return { settings, entities };
  }

  private exportPlaylist(): Playlist {
    const scenarios: Scenario[] = this.scenarios.map((editorScenario) => {
      return this.exportScenarioFromData(editorScenario);
    });
    
    // Exportar configurações de física relevantes para garantir determinismo
    const gameConfig: Partial<GameConfig> = {
      kickStrength: this.config.kickStrength,
      kickMode: this.config.kickMode,
      playerRadius: this.config.playerRadius,
      playerSpeed: this.config.playerSpeed,
      playerAcceleration: this.config.playerAcceleration,
      kickSpeedMultiplier: this.config.kickSpeedMultiplier,
      ballConfig: {
        ...this.config.ballConfig
      }
    };
    
    return {
      name: this.playlistSettings.name,
      description: this.playlistSettings.description,
      scenarios,
      gameConfig
    };
  }

  private exportScenarioFromData(editorScenario: EditorScenario): Scenario {
    const checkpoints = editorScenario.entities.filter(e => 'position' in e && 'radius' in e) as EditorCheckpoint[];
    const paths = editorScenario.entities.filter(e => 'points' in e) as EditorPath[];
    const bots = editorScenario.entities.filter(e => 'spawn' in e) as EditorBot[];
    
    // Ordenar checkpoints e paths
    checkpoints.sort((a, b) => a.order - b.order);
    paths.sort((a, b) => a.order - b.order);
    
    const objectives: any[] = [];
    
    // Intercalar checkpoints e paths pela ordem
    const allOrderedObjs = [...checkpoints, ...paths].sort((a, b) => a.order - b.order);
    
    allOrderedObjs.forEach(obj => {
      if ('position' in obj) {
        objectives.push({
          type: 'checkpoint',
          position: obj.position,
          radius: obj.radius,
          timeLimit: obj.timeLimit
        });
      } else if ('points' in obj) {
        objectives.push({
          type: 'path',
          points: obj.points,
          width: obj.width
        });
      }
    });
    
    // Adicionar objetivos de gol
    if (editorScenario.settings.goalObjective) {
      const goalObj: any = {
        type: 'goal',
        team: editorScenario.settings.goalObjective.team
      };
      if (editorScenario.settings.goalObjective.scoredBy) {
        goalObj.scoredBy = editorScenario.settings.goalObjective.scoredBy;
      }
      if (editorScenario.settings.goalObjective.scoredByBotId) {
        goalObj.scoredByBotId = editorScenario.settings.goalObjective.scoredByBotId;
      }
      objectives.push(goalObj);
    }
    
    if (editorScenario.settings.noGoalObjective) {
      objectives.push({
        type: 'no_goal',
        team: editorScenario.settings.noGoalObjective.team
      });
    }
    
    // Adicionar objetivo de contagem de chutes
    if (editorScenario.settings.kickCountObjective) {
      objectives.push({
        type: 'kick_count',
        ...editorScenario.settings.kickCountObjective
      });
    }
    
    // Adicionar objetivo de prevenir toque de bots
    if (editorScenario.settings.preventBotTeamTouch) {
      const preventBotIds: string[] = [];
      editorScenario.settings.preventBotTeamTouch.teams.forEach(team => {
        bots.filter(b => b.team === team).forEach(b => {
          preventBotIds.push(b.id);
        });
      });
      
      if (preventBotIds.length > 0) {
        objectives.push({
          type: 'prevent_touch',
          preventBotIds
        });
      }
    }
    
    const scenario: Scenario = {
      name: editorScenario.settings.name,
      map: this.mapType,
      timeLimit: editorScenario.settings.timeLimit,
      objectives,
      bots: bots.map(b => ({
        id: b.id,
        name: b.name,
        team: b.team,
        spawn: b.spawn,
        behavior: b.behavior,
        radius: b.radius ?? 15 // Sempre exporta o radius
      }))
    };
    
    // Adicionar propriedades opcionais
    if (editorScenario.settings.ballSpawn) {
      scenario.ballSpawn = editorScenario.settings.ballSpawn;
    }
    if (editorScenario.settings.playerSpawn) {
      scenario.playerSpawn = editorScenario.settings.playerSpawn;
    }
    if (editorScenario.settings.initialBallVelocity) {
      scenario.initialBallVelocity = editorScenario.settings.initialBallVelocity;
    }
    if (editorScenario.settings.initialPlayerVelocity) {
      scenario.initialPlayerVelocity = editorScenario.settings.initialPlayerVelocity;
    }
    
    return scenario;
  }

  private exportScenario(): Scenario {
    return this.exportScenarioFromData({
      settings: this.scenarioSettings,
      entities: this.entities
    });
  }

  private testScenario(): void {
    const scenario = this.exportScenario();
    
    if (scenario.objectives.length === 0) {
      alert('Adicione pelo menos um objetivo antes de testar!\n\nUse as ferramentas:\n- Checkpoint\n- Caminho\n\nOu configure objetivos adicionais no botão Cenário');
      return;
    }
    
    const playlist: Playlist = {
      name: 'Teste do Editor',
      description: 'Cenário em teste',
      scenarios: [scenario]
    };
    
    // Entrar em modo de teste
    this.isTestMode = true;
    
    // Ocultar toolbar e painel de propriedades
    this.toolbarElement?.classList.add('hidden');
    this.propertiesPanel?.classList.add('hidden');
    
    // Criar config específico para teste
    const testConfig: GameConfig = {
      ...this.config,
      disableGoalReset: scenario.objectives.some(obj => obj.type === 'goal' || obj.type === 'no_goal')
    };
    
    // Criar e iniciar PlaylistMode
    this.testPlaylistMode = new PlaylistMode(this.canvas, playlist, testConfig, {
      onScenarioComplete: () => {
        // Resetar cenário ao invés de sair
        setTimeout(() => {
          if (this.testPlaylistMode) {
            this.testPlaylistMode.resetScenario();
          }
        }, 1500);
      },
      onPlaylistComplete: () => {
        // Resetar cenário ao invés de sair
        setTimeout(() => {
          if (this.testPlaylistMode) {
            this.testPlaylistMode.resetScenario();
          }
        }, 1500);
      },
      onScenarioFail: (reason) => {
        // Resetar cenário ao invés de sair
        setTimeout(() => {
          if (this.testPlaylistMode) {
            this.testPlaylistMode.resetScenario();
          }
        }, 2000);
      },
      onScenarioStart: () => {}
    });
    
    this.testPlaylistMode.startScenario(0);
  }
  
  private exitTestMode(): void {
    if (this.testPlaylistMode) {
      this.testPlaylistMode.stop();
      this.testPlaylistMode = null;
    }
    
    this.isTestMode = false;
    
    // Mostrar toolbar e painel novamente
    this.toolbarElement?.classList.remove('hidden');
    if (this.selectedEntity) {
      this.propertiesPanel?.classList.remove('hidden');
    }
    
    // Esconder HUD da playlist
    document.getElementById('playlist-hud')?.classList.add('hidden');
    document.getElementById('playlist-hud-bottom')?.classList.add('hidden');
    document.getElementById('playlist-feedback')?.classList.add('hidden');
    
    // Prevenir que ESC abra o menu de configurações
    setTimeout(() => {
      // Flag para ignorar próximo ESC no main.ts
      (window as any)._editorJustExitedTest = true;
      setTimeout(() => {
        delete (window as any)._editorJustExitedTest;
      }, 100);
    }, 0);
  }

  private clearAll(): void {
    if (confirm('Deseja limpar todos os elementos?')) {
      this.entities = [];
      this.selectedEntity = null;
      this.pathBeingDrawn = null;
      this.hidePropertiesPanel();
    }
  }

  private exit(): void {
    if (confirm('Deseja sair do editor? Mudanças não salvas serão perdidas.')) {
      this.cleanup();
      // Voltar ao menu principal - disparar evento customizado
      window.dispatchEvent(new CustomEvent('editor-exit'));
    }
  }

  public cleanup(): void {
    this.toolbarElement?.remove();
    this.propertiesPanel?.remove();
  }

  public start(): void {
    // Editor está pronto para uso
  }

  public requestExit(): void {
    this.exit();
  }

  public getIsTestMode(): boolean {
    return this.isTestMode;
  }
}
