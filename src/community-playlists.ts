import { 
  collection, 
  addDoc, 
  getDocs, 
  getDoc,
  doc,
  setDoc,
  query, 
  orderBy, 
  limit, 
  where,
  updateDoc,
  increment,
  deleteDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { Playlist } from './types';

export interface CommunityPlaylist {
  id: string;
  name: string;
  description: string;
  authorId: string;
  authorNickname: string;
  scenarios: any[];
  likes: number;
  dislikes: number;
  plays: number;
  createdAt: number;
  updatedAt: number;
  randomizeOrder?: boolean;
}

export interface PlaylistLike {
  playlistId: string;
  userId: string;
  type: 'like' | 'dislike';
  timestamp: number;
}

export type PlaylistSortBy = 'trending' | 'likes' | 'recent' | 'plays' | 'name';

/**
 * Publicar playlist na comunidade
 */
export async function publishCommunityPlaylist(
  playlist: Playlist,
  authorUid: string,
  authorNickname: string
): Promise<string> {
  try {
    const communityPlaylist = {
      name: playlist.name,
      description: playlist.description || '',
      authorId: authorUid,
      authorNickname: authorNickname,
      scenarios: playlist.scenarios,
      likes: 0,
      dislikes: 0,
      plays: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      randomizeOrder: playlist.randomizeOrder || false
    };

    const docRef = await addDoc(collection(db, 'community_playlists'), communityPlaylist);
    console.log('Playlist published with ID:', docRef.id);
    return docRef.id;
  } catch (error: any) {
    console.error('Error publishing playlist:', error);
    
    // Melhorar mensagem de erro
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      throw new Error('Você não tem permissão para publicar playlists. Verifique se está logado com uma conta válida.');
    }
    
    throw error;
  }
}

/**
 * Buscar playlists da comunidade
 */
export async function getCommunityPlaylists(
  sortBy: PlaylistSortBy = 'trending',
  limitCount: number = 50
): Promise<CommunityPlaylist[]> {
  try {
    // Para trending, precisamos buscar plays das últimas 24 horas
    if (sortBy === 'trending') {
      return await getTrendingPlaylists(limitCount);
    }

    let q;
    
    switch (sortBy) {
      case 'likes':
        q = query(
          collection(db, 'community_playlists'),
          orderBy('likes', 'desc'),
          limit(limitCount)
        );
        break;
      case 'recent':
        q = query(
          collection(db, 'community_playlists'),
          orderBy('createdAt', 'desc'),
          limit(limitCount)
        );
        break;
      case 'plays':
        q = query(
          collection(db, 'community_playlists'),
          orderBy('plays', 'desc'),
          limit(limitCount)
        );
        break;
      case 'name':
        q = query(
          collection(db, 'community_playlists'),
          orderBy('name', 'asc'),
          limit(limitCount)
        );
        break;
      default:
        q = query(
          collection(db, 'community_playlists'),
          orderBy('likes', 'desc'),
          limit(limitCount)
        );
    }

    const querySnapshot = await getDocs(q);
    const playlists: CommunityPlaylist[] = [];

    querySnapshot.forEach((doc) => {
      playlists.push({
        id: doc.id,
        ...doc.data()
      } as CommunityPlaylist);
    });

    return playlists;
  } catch (error) {
    console.error('Error getting community playlists:', error);
    throw error;
  }
}

/**
 * Buscar playlist específica da comunidade
 */
export async function getCommunityPlaylist(playlistId: string): Promise<CommunityPlaylist | null> {
  try {
    const docRef = doc(db, 'community_playlists', playlistId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data()
      } as CommunityPlaylist;
    }

    return null;
  } catch (error) {
    console.error('Error getting community playlist:', error);
    return null;
  }
}

/**
 * Buscar playlists de um autor específico
 */
export async function getUserPlaylists(authorUid: string): Promise<CommunityPlaylist[]> {
  try {
    const q = query(
      collection(db, 'community_playlists'),
      where('author.uid', '==', authorUid),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const playlists: CommunityPlaylist[] = [];

    querySnapshot.forEach((doc) => {
      playlists.push({
        id: doc.id,
        ...doc.data()
      } as CommunityPlaylist);
    });

    return playlists;
  } catch (error) {
    console.error('Error getting user playlists:', error);
    throw error;
  }
}

/**
 * Dar like ou dislike em uma playlist
 */
export async function likePlaylist(
  playlistId: string,
  userId: string,
  type: 'like' | 'dislike'
): Promise<void> {
  try {
    console.log('likePlaylist called with:', { playlistId, userId, type });
    
    // Verificar se usuário já deu like/dislike
    const existingLike = await getUserPlaylistLike(playlistId, userId);
    console.log('Existing like:', existingLike);

    if (existingLike) {
      console.log('Found existing like, attempting to remove...');
      // Remover like/dislike anterior
      await removeLike(playlistId, userId, existingLike.type);
      
      // Se for o mesmo tipo, apenas remove (toggle)
      if (existingLike.type === type) {
        console.log('Same type, toggling off');
        return;
      }
    }

    console.log('Adding new like...');
    // Adicionar novo like/dislike
    const likeData: Omit<PlaylistLike, 'id'> = {
      playlistId,
      userId,
      type,
      timestamp: Date.now()
    };

    await addDoc(collection(db, 'playlist_likes'), likeData);
    console.log('Like document created');

    // Atualizar contador na playlist
    const playlistRef = doc(db, 'community_playlists', playlistId);
    const updateData: any = {};
    updateData[type === 'like' ? 'likes' : 'dislikes'] = increment(1);
    
    await updateDoc(playlistRef, updateData);
    console.log('Playlist counter updated');

    console.log(`${type} added to playlist ${playlistId}`);
  } catch (error) {
    console.error('Error liking playlist:', error);
    throw error;
  }
}

/**
 * Remover like/dislike
 */
async function removeLike(
  playlistId: string,
  userId: string,
  type: 'like' | 'dislike'
): Promise<void> {
  try {
    console.log('removeLike called with:', { playlistId, userId, type });
    
    // Buscar documento de like
    const q = query(
      collection(db, 'playlist_likes'),
      where('playlistId', '==', playlistId),
      where('userId', '==', userId)
    );

    const querySnapshot = await getDocs(q);
    console.log('Found documents to delete:', querySnapshot.size);
    
    if (!querySnapshot.empty) {
      const docId = querySnapshot.docs[0].id;
      const docData = querySnapshot.docs[0].data();
      console.log('Deleting document:', { docId, docData });
      
      // Deletar documento
      await deleteDoc(doc(db, 'playlist_likes', docId));
      console.log('Document deleted successfully');

      // Atualizar contador na playlist
      const playlistRef = doc(db, 'community_playlists', playlistId);
      const updateData: any = {};
      updateData[type === 'like' ? 'likes' : 'dislikes'] = increment(-1);
      
      await updateDoc(playlistRef, updateData);
      console.log('Playlist counter decremented');
    }
  } catch (error) {
    console.error('Error removing like:', error);
    throw error;
  }
}

/**
 * Buscar like/dislike de um usuário em uma playlist
 */
export async function getUserPlaylistLike(
  playlistId: string,
  userId: string
): Promise<PlaylistLike | null> {
  try {
    const q = query(
      collection(db, 'playlist_likes'),
      where('playlistId', '==', playlistId),
      where('userId', '==', userId),
      limit(1)
    );

    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data() as PlaylistLike;
    }

    return null;
  } catch (error) {
    console.error('Error getting user like:', error);
    return null;
  }
}

/**
 * Incrementar contador de plays de uma playlist
 */
export async function incrementPlaylistPlays(playlistId: string, nickname: string): Promise<void> {
  try {
    // Incrementar contador de plays
    const playlistRef = doc(db, 'community_playlists', playlistId);
    await updateDoc(playlistRef, {
      plays: increment(1)
    });
    
    // Registrar play individual para tracking de trending
    await addDoc(collection(db, 'playlist_plays'), {
      playlistId,
      nickname,
      timestamp: Date.now()
    });
    
    console.log('Play counted for playlist:', playlistId);
  } catch (error) {
    console.error('Error incrementing plays:', error);
  }
}

/**
 * Buscar playlists em destaque (mais jogadas nas últimas 24 horas)
 */
async function getTrendingPlaylists(limitCount: number = 50): Promise<CommunityPlaylist[]> {
  try {
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
    
    // Buscar plays das últimas 24 horas
    const playsQuery = query(
      collection(db, 'playlist_plays'),
      where('timestamp', '>=', twentyFourHoursAgo)
    );
    
    const playsSnapshot = await getDocs(playsQuery);
    
    // Contar plays por playlist
    const playCountMap = new Map<string, number>();
    playsSnapshot.forEach((doc) => {
      const data = doc.data();
      const currentCount = playCountMap.get(data.playlistId) || 0;
      playCountMap.set(data.playlistId, currentCount + 1);
    });
    
    // Buscar todas as playlists
    const playlistsQuery = query(
      collection(db, 'community_playlists'),
      limit(200) // Buscar mais para ordenar
    );
    
    const playlistsSnapshot = await getDocs(playlistsQuery);
    const playlists: (CommunityPlaylist & { recentPlays: number })[] = [];
    
    playlistsSnapshot.forEach((doc) => {
      const data = doc.data() as Omit<CommunityPlaylist, 'id'>;
      const recentPlays = playCountMap.get(doc.id) || 0;
      playlists.push({
        id: doc.id,
        ...data,
        recentPlays
      });
    });
    
    // Ordenar por plays recentes (desc), depois por likes (desc) como desempate
    playlists.sort((a, b) => {
      if (b.recentPlays !== a.recentPlays) {
        return b.recentPlays - a.recentPlays;
      }
      return b.likes - a.likes;
    });
    
    // Retornar apenas o limite solicitado (sem recentPlays no retorno)
    return playlists.slice(0, limitCount).map(({ recentPlays, ...playlist }) => playlist);
  } catch (error) {
    console.error('Error getting trending playlists:', error);
    // Fallback para ordenação por likes
    const q = query(
      collection(db, 'community_playlists'),
      orderBy('likes', 'desc'),
      limit(limitCount)
    );
    
    const querySnapshot = await getDocs(q);
    const playlists: CommunityPlaylist[] = [];
    
    querySnapshot.forEach((doc) => {
      playlists.push({
        id: doc.id,
        ...doc.data()
      } as CommunityPlaylist);
    });
    
    return playlists;
  }
}

/**
 * Deletar playlist da comunidade (apenas autor pode deletar)
 */
export async function deleteCommunityPlaylist(
  playlistId: string,
  authorUid: string
): Promise<void> {
  try {
    // Verificar se o usuário é o autor
    const playlist = await getCommunityPlaylist(playlistId);
    
    if (!playlist) {
      throw new Error('Playlist não encontrada');
    }

    if (playlist.authorId !== authorUid) {
      throw new Error('Apenas o autor pode deletar esta playlist');
    }

    // Deletar todos os likes/dislikes associados
    const likesQuery = query(
      collection(db, 'playlist_likes'),
      where('playlistId', '==', playlistId)
    );
    
    const likesSnapshot = await getDocs(likesQuery);
    const deletePromises = likesSnapshot.docs.map(doc => deleteDoc(doc.ref));
    
    // Deletar todos os rankings/scores associados
    const rankingsQuery = query(
      collection(db, 'community_rankings'),
      where('playlistId', '==', playlistId)
    );
    
    const rankingsSnapshot = await getDocs(rankingsQuery);
    const deleteRankingsPromises = rankingsSnapshot.docs.map(doc => deleteDoc(doc.ref));

    // Aguardar todas as deleções
    await Promise.all([...deletePromises, ...deleteRankingsPromises]);

    // Deletar a playlist
    await deleteDoc(doc(db, 'community_playlists', playlistId));

    console.log('Playlist deleted successfully with all associated data');
  } catch (error) {
    console.error('Error deleting playlist:', error);
    throw error;
  }
}

/**
 * Atualizar playlist da comunidade (apenas autor pode atualizar)
 */
export async function updateCommunityPlaylist(
  playlistId: string,
  authorUid: string,
  playlist: Playlist
): Promise<void> {
  try {
    // Verificar se o usuário é o autor
    const existingPlaylist = await getCommunityPlaylist(playlistId);
    
    if (!existingPlaylist) {
      throw new Error('Playlist não encontrada');
    }

    if (existingPlaylist.authorId !== authorUid) {
      throw new Error('Apenas o autor pode atualizar esta playlist');
    }

    // Atualizar playlist
    const playlistRef = doc(db, 'community_playlists', playlistId);
    await updateDoc(playlistRef, {
      name: playlist.name,
      description: playlist.description || '',
      scenarios: playlist.scenarios,
      updatedAt: Date.now()
    });

    console.log('Playlist updated successfully');
  } catch (error) {
    console.error('Error updating playlist:', error);
    throw error;
  }
}
