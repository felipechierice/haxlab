import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, collection, addDoc, query, orderBy, limit, getDocs, where, updateDoc, doc, deleteDoc } from 'firebase/firestore';

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCM4kVzke9iC9yzRI8_A5vgLeyxhKPYQYE",
  authDomain: "haxlab-ranking.firebaseapp.com",
  projectId: "haxlab-ranking",
  storageBucket: "haxlab-ranking.firebasestorage.app",
  messagingSenderId: "757442993193",
  appId: "1:757442993193:web:9f1b084ce42afc873f5038",
  databaseURL: "https://haxlab-ranking-default-rtdb.firebaseio.com"
};

// Inicializar Firebase
let app: FirebaseApp;
let db: Firestore;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  console.log('Firebase initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase:', error);
}

export { db };

// Lista de playlists oficiais que podem ter ranking salvo
const OFFICIAL_PLAYLISTS = [
  'Cruzamento - Fácil',
  'Drible e Gol',
  'TORNEIO A.D. BRK - Edição 1',
  'Finalizações'
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
  kicks: number;
  time: number; // tempo em segundos
  score: number; // pontuação calculada
  timestamp: number;
}

/**
 * Calcula pontuação baseado em chutes e tempo
 * Quanto menos chutes e menos tempo, maior a pontuação
 */
export function calculateScore(kicks: number, timeInSeconds: number): number {
  // Fórmula: 1000000 / (kicks * tempo_em_segundos)
  // Isso garante que menos chutes e menos tempo = maior pontuação
  const safeKicks = Math.max(kicks, 1);
  const safeTime = Math.max(timeInSeconds, 0.1);
  const baseScore = 1000000 / (safeKicks * safeTime);
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
  kicks: number,
  timeInSeconds: number
): Promise<void> {
  // Verificar se é uma playlist oficial
  if (!isOfficialPlaylist(playlistName)) {
    console.log('Playlist não oficial, ranking não será salvo:', playlistName);
    return;
  }
  
  const score = calculateScore(kicks, timeInSeconds);
  
  const entry: RankingEntry = {
    nickname,
    playlistName,
    kicks,
    time: timeInSeconds,
    score,
    timestamp: Date.now()
  };

  try {
    // Verificar se já existe um registro para esse nickname + playlist
    const q = query(
      collection(db, 'rankings'),
      where('nickname', '==', nickname),
      where('playlistName', '==', playlistName)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      // Já existe registro(s) - vamos verificar e manter apenas o melhor
      const existingDocs = querySnapshot.docs;
      const existingEntry = existingDocs[0].data() as RankingEntry;
      
      if (score > existingEntry.score) {
        // Novo score é melhor - atualizar o primeiro e deletar os outros
        await updateDoc(doc(db, 'rankings', existingDocs[0].id), {
          kicks: entry.kicks,
          time: entry.time,
          score: entry.score,
          timestamp: entry.timestamp
        });
        
        // Deletar registros duplicados se existirem
        for (let i = 1; i < existingDocs.length; i++) {
          await deleteDoc(doc(db, 'rankings', existingDocs[i].id));
        }
        
        console.log('Score updated successfully:', entry);
      } else {
        // Score existente é melhor - apenas deletar duplicatas se existirem
        for (let i = 1; i < existingDocs.length; i++) {
          await deleteDoc(doc(db, 'rankings', existingDocs[i].id));
        }
        
        console.log('Existing score is better, no update needed');
      }
    } else {
      // Não existe registro - criar novo
      await addDoc(collection(db, 'rankings'), entry);
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
