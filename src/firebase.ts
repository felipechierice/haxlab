import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, collection, addDoc, query, orderBy, limit, getDocs, where, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { initAnalytics } from './analytics.js';

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCM4kVzke9iC9yzRI8_A5vgLeyxhKPYQYE",
  authDomain: "haxlab-ranking.firebaseapp.com",
  projectId: "haxlab-ranking",
  storageBucket: "haxlab-ranking.firebasestorage.app",
  messagingSenderId: "757442993193",
  appId: "1:757442993193:web:9f1b084ce42afc873f5038",
  databaseURL: "https://haxlab-ranking-default-rtdb.firebaseio.com",
  measurementId: "G-VSD7RLYFKB"
};

// Inicializar Firebase
let app: FirebaseApp;
let db: Firestore;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  console.log('Firebase initialized successfully');
  
  // Inicializar Analytics (async, não bloqueia)
  initAnalytics();
} catch (error) {
  console.error('Error initializing Firebase:', error);
}

export { db };

// Lista de playlists oficiais que podem ter ranking salvo
const OFFICIAL_PLAYLISTS = [
  'Condução - Fácil',
  'Cruzamento - Fácil',
  'Drible e Gol',
  'TORNEIO A.D. BRK - Edição 1',
  'Finalizações - Fácil',
  'Desafio 1',
//   'Treino de Goleiro'
];

/**
 * Verifica se uma playlist é oficial
 */
export function isOfficialPlaylist(playlistName: string): boolean {
  return OFFICIAL_PLAYLISTS.includes(playlistName);
}

// Interface para entrada no ranking
export interface RankingEntry {
  nickname: string;
  playlistName: string;
  time: number; // tempo em segundos
  score: number; // pontuação calculada
  timestamp: number;
}

/**
 * Calcula pontuação baseado apenas no tempo
 * Quanto menos tempo, maior a pontuação
 */
export function calculateScore(timeInSeconds: number): number {
  // Fórmula: 100000 / tempo_em_segundos
  // Isso garante que menos tempo = maior pontuação
  const safeTime = Math.max(timeInSeconds, 0.1);
  const baseScore = 100000 / safeTime;
  return Math.round(baseScore);
}

/**
 * Submete pontuação ao ranking
 * Verifica se já existe um registro para o nickname + playlist
 * Se existir, atualiza apenas se o novo score for maior
 */
export async function submitScore(
  nickname: string,
  playlistName: string,
  timeInSeconds: number,
  playlistId?: string
): Promise<void> {
  // Verificar se é uma playlist oficial ou da comunidade
  const collectionName = playlistId ? 'community_rankings' : 'rankings';
  
  if (!playlistId && !isOfficialPlaylist(playlistName)) {
    console.log('Playlist não oficial, ranking não será salvo:', playlistName);
    return;
  }
  
  const score = calculateScore(timeInSeconds);
  
  const entry: RankingEntry & { playlistId?: string } = {
    nickname,
    playlistName,
    time: timeInSeconds,
    score,
    timestamp: Date.now(),
    ...(playlistId && { playlistId })
  };

  try {
    // Verificar se já existe um registro para esse nickname + playlist
    const queryConstraints = [
      where('nickname', '==', nickname),
      where('playlistName', '==', playlistName)
    ];
    
    if (playlistId) {
      queryConstraints.push(where('playlistId', '==', playlistId));
    }
    
    const q = query(
      collection(db, collectionName),
      ...queryConstraints
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      // Já existe registro(s) - vamos verificar e manter apenas o melhor
      const existingDocs = querySnapshot.docs;
      const existingEntry = existingDocs[0].data() as RankingEntry;
      
      if (score > existingEntry.score) {
        // Novo score é melhor - atualizar o primeiro e deletar os outros
        await updateDoc(doc(db, collectionName, existingDocs[0].id), {
          time: entry.time,
          score: entry.score,
          timestamp: entry.timestamp
        });
        
        // Deletar registros duplicados se existirem
        for (let i = 1; i < existingDocs.length; i++) {
          await deleteDoc(doc(db, collectionName, existingDocs[i].id));
        }
        
        console.log('Score updated successfully:', entry);
      } else {
        // Score existente é melhor - apenas deletar duplicatas se existirem
        for (let i = 1; i < existingDocs.length; i++) {
          await deleteDoc(doc(db, collectionName, existingDocs[i].id));
        }
        
        console.log('Existing score is better, no update needed');
      }
    } else {
      // Não existe registro - criar novo
      await addDoc(collection(db, collectionName), entry);
      console.log('Score submitted successfully:', entry);
    }
  } catch (error) {
    console.error('Error submitting score:', error);
    throw error;
  }
}

/**
 * Obtém top scores de uma playlist
 */
export async function getTopScores(playlistName: string, limitCount: number = 10): Promise<RankingEntry[]> {
  try {
    const q = query(
      collection(db, 'rankings'),
      where('playlistName', '==', playlistName),
      orderBy('score', 'desc'),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(q);
    const scores: RankingEntry[] = [];
    
    querySnapshot.forEach((doc) => {
      scores.push(doc.data() as RankingEntry);
    });

    return scores;
  } catch (error) {
    console.error('Error getting top scores:', error);
    throw error;
  }
}

/**
 * Obtém ranking global (todas as playlists)
 */
export async function getGlobalRanking(limitCount: number = 50): Promise<RankingEntry[]> {
  try {
    const q = query(
      collection(db, 'rankings'),
      orderBy('score', 'desc'),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(q);
    const scores: RankingEntry[] = [];
    
    querySnapshot.forEach((doc) => {
      scores.push(doc.data() as RankingEntry);
    });

    return scores;
  } catch (error) {
    console.error('Error getting global ranking:', error);
    throw error;
  }
}

/**
 * Obtém todos os rankings (sem limite) para agregação client-side
 */
export async function getAllRankings(): Promise<RankingEntry[]> {
  try {
    const q = query(
      collection(db, 'rankings'),
      orderBy('score', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const scores: RankingEntry[] = [];
    
    querySnapshot.forEach((doc) => {
      scores.push(doc.data() as RankingEntry);
    });

    return scores;
  } catch (error) {
    console.error('Error getting all rankings:', error);
    throw error;
  }
}

/**
 * Obtém scores de um jogador específico
 */
export async function getPlayerScores(nickname: string, limitCount: number = 20): Promise<RankingEntry[]> {
  try {
    const q = query(
      collection(db, 'rankings'),
      where('nickname', '==', nickname),
      orderBy('score', 'desc'),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(q);
    const scores: RankingEntry[] = [];
    
    querySnapshot.forEach((doc) => {
      scores.push(doc.data() as RankingEntry);
    });

    return scores;
  } catch (error) {
    console.error('Error getting player scores:', error);
    throw error;
  }
}

/**
 * Obtém highscore de um jogador para uma playlist específica
 */
export async function getPlayerHighscore(nickname: string, playlistName: string): Promise<RankingEntry | null> {
  try {
    const q = query(
      collection(db, 'rankings'),
      where('nickname', '==', nickname),
      where('playlistName', '==', playlistName),
      limit(1)
    );

    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    return querySnapshot.docs[0].data() as RankingEntry;
  } catch (error) {
    console.error('Error getting player highscore:', error);
    return null;
  }
}

/**
 * Obtém top scores de uma playlist da comunidade
 */
export async function getCommunityPlaylistRanking(playlistId: string, limitCount: number = 10): Promise<RankingEntry[]> {
  try {
    const q = query(
      collection(db, 'community_rankings'),
      where('playlistId', '==', playlistId),
      orderBy('score', 'desc'),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(q);
    const scores: RankingEntry[] = [];
    
    querySnapshot.forEach((doc) => {
      scores.push(doc.data() as RankingEntry);
    });

    return scores;
  } catch (error) {
    console.error('Error getting community playlist ranking:', error);
    throw error;
  }
}

/**
 * Obtém highscore de um jogador para uma playlist da comunidade específica
 */
export async function getPlayerCommunityPlaylistHighscore(
  nickname: string, 
  playlistId: string
): Promise<RankingEntry | null> {
  try {
    const q = query(
      collection(db, 'community_rankings'),
      where('nickname', '==', nickname),
      where('playlistId', '==', playlistId),
      limit(1)
    );

    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    return querySnapshot.docs[0].data() as RankingEntry;
  } catch (error) {
    console.error('Error getting player community playlist highscore:', error);
    return null;
  }
}

/**
 * Obtém lista de playlists únicas que existem no ranking
 */
export async function getAvailablePlaylists(): Promise<string[]> {
  try {
    const querySnapshot = await getDocs(collection(db, 'rankings'));
    const playlistsSet = new Set<string>();
    
    querySnapshot.forEach((doc) => {
      const data = doc.data() as RankingEntry;
      if (data.playlistName) {
        playlistsSet.add(data.playlistName);
      }
    });

    return Array.from(playlistsSet).sort();
  } catch (error) {
    console.error('Error getting available playlists:', error);
    return [];
  }
}
