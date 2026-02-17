/**
 * Sistema de Replay para Playlists
 * 
 * Este módulo é responsável por:
 * - Gravar inputs do jogador durante execuções de playlists
 * - Salvar replays no Firebase
 * - Reproduzir replays gravados
 */

import { 
  ReplayData, 
  ReplayInputEvent, 
  ReplayInputEventType,
  ReplayAction,
  ReplayScenarioInfo
} from './types.js';
import { db } from './firebase.js';
import { collection, addDoc, query, where, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { APP_VERSION } from './version.js';

/**
 * Classe responsável por gravar inputs durante a execução de uma playlist
 */
export class ReplayRecorder {
  private events: ReplayInputEvent[] = [];
  private scenarios: ReplayScenarioInfo[] = [];
  private playlistStartTime: number = 0;
  private currentScenarioIndex: number = 0;
  private isRecording: boolean = false;
  private playlistName: string = '';
  private playlistId: string | undefined;
  private playerNickname: string = '';
  
  constructor(playlistName: string, playerNickname: string, playlistId?: string) {
    this.playlistName = playlistName;
    this.playerNickname = playerNickname;
    this.playlistId = playlistId;
  }
  
  /**
   * Inicia a gravação do replay
   */
  start(): void {
    this.isRecording = true;
    this.playlistStartTime = Date.now();
    this.events = [];
    this.scenarios = [];
    this.currentScenarioIndex = 0;
  }
  
  /**
   * Para a gravação do replay
   */
  stop(): void {
    this.isRecording = false;
  }
  
  /**
   * Descarta o replay atual e recomeça a gravação
   * Usado quando o jogador pressiona Backspace para reiniciar a playlist
   */
  restart(): void {
    this.events = [];
    this.scenarios = [];
    this.playlistStartTime = Date.now();
    this.currentScenarioIndex = 0;
    this.isRecording = true;
  }
  
  /**
   * Registra o início de um cenário
   */
  recordScenarioStart(scenarioIndex: number, wasReset: boolean = false): void {
    if (!this.isRecording) return;
    
    this.currentScenarioIndex = scenarioIndex;
    this.scenarios.push({
      scenarioIndex,
      startTime: Date.now() - this.playlistStartTime,
      wasReset
    });
  }
  
  /**
   * Registra um evento de input (pressionar ou soltar tecla)
   */
  recordInputEvent(type: ReplayInputEventType, action: ReplayAction): void {
    if (!this.isRecording) return;
    
    const timestamp = Date.now() - this.playlistStartTime;
    
    this.events.push({
      timestamp,
      type,
      action,
      scenarioIndex: this.currentScenarioIndex
    });
  }
  
  /**
   * Obtém os dados completos do replay
   */
  getReplayData(totalTime: number): ReplayData {
    return {
      playlistName: this.playlistName,
      playlistId: this.playlistId,
      playerNickname: this.playerNickname,
      totalTime,
      events: [...this.events],
      scenarios: [...this.scenarios],
      recordedAt: Date.now(),
      version: APP_VERSION
    };
  }
  
  /**
   * Verifica se está gravando
   */
  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }
}

/**
 * Salva um replay no Firebase
 */
export async function saveReplay(replayData: ReplayData): Promise<string> {
  try {
    const collectionName = replayData.playlistId ? 'community_replays' : 'replays';
    
    const docRef = await addDoc(collection(db, collectionName), {
      playlistName: replayData.playlistName,
      playlistId: replayData.playlistId,
      playerNickname: replayData.playerNickname,
      totalTime: replayData.totalTime,
      events: replayData.events,
      scenarios: replayData.scenarios,
      recordedAt: replayData.recordedAt,
      version: replayData.version
    });
    
    console.log('Replay saved with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error saving replay:', error);
    throw error;
  }
}

/**
 * Busca replays de uma playlist específica
 */
export async function getPlaylistReplays(
  playlistName: string,
  playlistId?: string,
  limitCount: number = 10
): Promise<(ReplayData & { id: string })[]> {
  try {
    const collectionName = playlistId ? 'community_replays' : 'replays';
    
    let q = query(
      collection(db, collectionName),
      where('playlistName', '==', playlistName),
      orderBy('recordedAt', 'desc'),
      limit(limitCount)
    );
    
    if (playlistId) {
      q = query(
        collection(db, collectionName),
        where('playlistId', '==', playlistId),
        orderBy('recordedAt', 'desc'),
        limit(limitCount)
      );
    }
    
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data() as ReplayData
    }));
  } catch (error) {
    console.error('Error fetching replays:', error);
    return [];
  }
}

/**
 * Busca um replay específico por ID
 */
export async function getReplayById(replayId: string, isCommunity: boolean = false): Promise<ReplayData | null> {
  try {
    const collectionName = isCommunity ? 'community_replays' : 'replays';
    const docRef = doc(db, collectionName, replayId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as ReplayData;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching replay:', error);
    return null;
  }
}

/**
 * Busca o replay associado a um ranking entry específico
 * Busca pelo nickname, playlist e tempo mais próximo
 */
export async function getReplayForRankingEntry(
  nickname: string,
  playlistName: string,
  time: number,
  playlistId?: string
): Promise<(ReplayData & { id: string }) | null> {
  try {
    const collectionName = playlistId ? 'community_replays' : 'replays';
    
    let q = query(
      collection(db, collectionName),
      where('playerNickname', '==', nickname),
      where('playlistName', '==', playlistName),
      orderBy('recordedAt', 'desc'),
      limit(5) // Buscar os 5 mais recentes para comparar
    );
    
    if (playlistId) {
      q = query(
        collection(db, collectionName),
        where('playerNickname', '==', nickname),
        where('playlistId', '==', playlistId),
        orderBy('recordedAt', 'desc'),
        limit(5)
      );
    }
    
    const snapshot = await getDocs(q);
    
    // Encontrar o replay com tempo mais próximo
    let closestReplay: (ReplayData & { id: string }) | null = null;
    let smallestDiff = Infinity;
    
    snapshot.docs.forEach(doc => {
      const data = doc.data() as ReplayData;
      const diff = Math.abs(data.totalTime - time);
      
      // Considerar apenas replays com diferença de até 0.5 segundos
      if (diff < smallestDiff && diff <= 0.5) {
        smallestDiff = diff;
        closestReplay = {
          id: doc.id,
          ...data
        };
      }
    });
    
    return closestReplay;
  } catch (error) {
    console.error('Error fetching replay for ranking entry:', error);
    return null;
  }
}

/**
 * Mapeia teclas para ações de replay
 */
export function keyToReplayAction(key: string): ReplayAction | null {
  switch (key.toLowerCase()) {
    case 'w':
    case 'arrowup':
      return 'up';
    case 's':
    case 'arrowdown':
      return 'down';
    case 'a':
    case 'arrowleft':
      return 'left';
    case 'd':
    case 'arrowright':
      return 'right';
    case ' ':
    case 'enter':
      return 'kick';
    default:
      return null;
  }
}
