import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, collection, addDoc, query, orderBy, limit, getDocs, where, updateDoc, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { initAnalytics } from './analytics.js';
import { auth } from './auth.js';

// Função helper para obter IP (importada depois para evitar circular dependency)
let getClientIPFunc: (() => Promise<string | null>) | null = null;

export function setGetClientIPFunc(func: () => Promise<string | null>) {
  getClientIPFunc = func;
}

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
  'Desafio 2',
  'Desafio 3',
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
  replayId?: string; // ID do replay associado (opcional)
  ip?: string; // IP do jogador (opcional)
  uid?: string; // UID do jogador (opcional)
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
  playlistId?: string,
  replayId?: string
): Promise<void> {
  // Verificar se é uma playlist oficial ou da comunidade
  const collectionName = playlistId ? 'community_rankings' : 'rankings';
  
  if (!playlistId && !isOfficialPlaylist(playlistName)) {
    console.log('Playlist não oficial, ranking não será salvo:', playlistName);
    return;
  }
  
  const score = calculateScore(timeInSeconds);
  
  // Obter informações adicionais do usuário
  const currentUser = auth.currentUser;
  const uid = currentUser?.uid;
  
  // Tentar obter IP (se a função foi configurada)
  let ip: string | undefined;
  if (getClientIPFunc) {
    try {
      ip = (await getClientIPFunc()) || undefined;
    } catch (error) {
      console.warn('Could not get client IP:', error);
    }
  }
  
  const entry: RankingEntry & { playlistId?: string } = {
    nickname,
    playlistName,
    time: timeInSeconds,
    score,
    timestamp: Date.now(),
    ...(playlistId && { playlistId }),
    ...(replayId && { replayId }),
    ...(ip && { ip }),
    ...(uid && { uid })
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
        const updateData: any = {
          time: entry.time,
          score: entry.score,
          timestamp: entry.timestamp
        };
        
        if (replayId) {
          updateData.replayId = replayId;
        }
        
        await updateDoc(doc(db, collectionName, existingDocs[0].id), updateData);
        
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

/**
 * Obtém a posição do jogador no ranking de cada playlist oficial que ele completou
 * Retorna um Map com nome da playlist -> posição no ranking
 */
export async function getPlayerOfficialPlaylistRanks(nickname: string): Promise<Map<string, number>> {
  const ranks = new Map<string, number>();
  
  try {
    // Primeiro, buscar todas as playlists que o jogador completou
    const playerQuery = query(
      collection(db, 'rankings'),
      where('nickname', '==', nickname)
    );
    
    const playerSnapshot = await getDocs(playerQuery);
    const playerPlaylists: { playlistName: string; score: number }[] = [];
    
    playerSnapshot.forEach((doc) => {
      const data = doc.data() as RankingEntry;
      if (data.playlistName) {
        playerPlaylists.push({ playlistName: data.playlistName, score: data.score });
      }
    });
    
    // Para cada playlist, buscar a posição do jogador
    for (const { playlistName, score } of playerPlaylists) {
      const rankQuery = query(
        collection(db, 'rankings'),
        where('playlistName', '==', playlistName),
        where('score', '>', score)
      );
      
      const rankSnapshot = await getDocs(rankQuery);
      // Posição = número de jogadores com score maior + 1
      ranks.set(playlistName, rankSnapshot.size + 1);
    }
    
    return ranks;
  } catch (error) {
    console.error('Error getting player official playlist ranks:', error);
    return ranks;
  }
}

/**
 * Obtém a posição do jogador no ranking de cada playlist da comunidade que ele completou
 * Retorna um Map com ID da playlist -> posição no ranking
 */
export async function getPlayerCommunityPlaylistRanks(nickname: string): Promise<Map<string, number>> {
  const ranks = new Map<string, number>();
  
  try {
    // Primeiro, buscar todas as playlists que o jogador completou
    const playerQuery = query(
      collection(db, 'community_rankings'),
      where('nickname', '==', nickname)
    );
    
    const playerSnapshot = await getDocs(playerQuery);
    const playerPlaylists: { playlistId: string; score: number }[] = [];
    
    playerSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.playlistId) {
        playerPlaylists.push({ playlistId: data.playlistId, score: data.score });
      }
    });
    
    // Para cada playlist, buscar a posição do jogador
    for (const { playlistId, score } of playerPlaylists) {
      const rankQuery = query(
        collection(db, 'community_rankings'),
        where('playlistId', '==', playlistId),
        where('score', '>', score)
      );
      
      const rankSnapshot = await getDocs(rankQuery);
      // Posição = número de jogadores com score maior + 1
      ranks.set(playlistId, rankSnapshot.size + 1);
    }
    
    return ranks;
  } catch (error) {
    console.error('Error getting player community playlist ranks:', error);
    return ranks;
  }
}

/**
 * Atualiza o nickname em todos os rankings do jogador
 * Atualiza tanto rankings oficiais quanto da comunidade
 */
export async function updateNicknameInRankings(oldNickname: string, newNickname: string): Promise<{ official: number; community: number }> {
  const result = { official: 0, community: 0 };
  
  try {
    // Atualizar rankings oficiais
    const officialQuery = query(
      collection(db, 'rankings'),
      where('nickname', '==', oldNickname)
    );
    
    const officialSnapshot = await getDocs(officialQuery);
    
    if (!officialSnapshot.empty) {
      const batch = writeBatch(db);
      officialSnapshot.forEach((docSnapshot) => {
        batch.update(docSnapshot.ref, { nickname: newNickname });
        result.official++;
      });
      await batch.commit();
      console.log(`Updated ${result.official} official ranking entries`);
    }
    
    // Atualizar rankings da comunidade
    const communityQuery = query(
      collection(db, 'community_rankings'),
      where('nickname', '==', oldNickname)
    );
    
    const communitySnapshot = await getDocs(communityQuery);
    
    if (!communitySnapshot.empty) {
      const batch = writeBatch(db);
      communitySnapshot.forEach((docSnapshot) => {
        batch.update(docSnapshot.ref, { nickname: newNickname });
        result.community++;
      });
      await batch.commit();
      console.log(`Updated ${result.community} community ranking entries`);
    }
    
    console.log(`Total rankings updated - Official: ${result.official}, Community: ${result.community}`);
    return result;
  } catch (error) {
    console.error('Error updating nickname in rankings:', error);
    throw error;
  }
}
