import { 
  getAuth, 
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db, updateNicknameInRankings } from './firebase';

// Inicializar Firebase Auth
export const auth: Auth = getAuth();

// Interface para banimentos
export interface BannedUser {
  uid: string;
  email?: string;
  nickname?: string;
  reason: string;
  bannedAt: number;
  bannedBy: string;
}

export interface BannedIP {
  ip: string;
  reason: string;
  bannedAt: number;
  bannedBy: string;
}

// Provider do Google
const googleProvider = new GoogleAuthProvider();

// Chave do localStorage do sistema legado (player.ts)
const LEGACY_NICKNAME_KEY = 'haxlab_player_nickname';

/**
 * Sincroniza o nickname com o sistema legado (player.ts)
 * Isso garante que o código legado (legacy-init.ts) use o nickname correto
 */
function syncNicknameWithLegacy(nickname: string): void {
  localStorage.setItem(LEGACY_NICKNAME_KEY, nickname);
}

export interface UserProfile {
  uid: string;
  email: string | null;
  nickname: string;
  isGuest: boolean;
  createdAt: number;
  lastIP?: string;
  lastIPTimestamp?: number;
}

/**
 * Criar conta com email e senha
 */
export async function signUpWithEmail(email: string, password: string, nickname: string): Promise<UserProfile> {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Atualizar perfil do Firebase Auth
    await updateProfile(user, { displayName: nickname });

    // Obter IP do cliente
    const clientIP = await getClientIP();

    // Criar perfil no Firestore
    const userProfile: UserProfile = {
      uid: user.uid,
      email: user.email,
      nickname,
      isGuest: false,
      createdAt: Date.now(),
      ...(clientIP && { lastIP: clientIP, lastIPTimestamp: Date.now() })
    };

    await setDoc(doc(db, 'users', user.uid), userProfile);

    // Registrar IP no histórico
    if (clientIP) {
      await logUserIP(user.uid, nickname, clientIP);
    }

    // Limpar sessão de convidado se existir
    clearGuestSession();
    
    // Sincronizar com sistema legado (player.ts)
    syncNicknameWithLegacy(nickname);

    return userProfile;
  } catch (error: any) {
    console.error('Error signing up:', error);
    
    // Extrair código de erro (pode vir de diferentes fontes)
    const errorCode = error.code || error.message || '';
    throw new Error(getAuthErrorMessage(errorCode));
  }
}

/**
 * Login com email e senha
 */
export async function signInWithEmail(email: string, password: string): Promise<UserProfile> {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Verificar se o usuário está banido
    const bannedCheck = await isUserBanned(user.uid);
    if (bannedCheck.banned) {
      await firebaseSignOut(auth);
      throw new Error(`Sua conta foi banida. Motivo: ${bannedCheck.reason}`);
    }

    // Obter IP do cliente
    const clientIP = await getClientIP();

    // Buscar perfil no Firestore
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    
    if (userDoc.exists()) {
      const profile = userDoc.data() as UserProfile;
      
      // Atualizar IP no perfil
      if (clientIP) {
        await updateDoc(doc(db, 'users', user.uid), {
          lastIP: clientIP,
          lastIPTimestamp: Date.now()
        });
        await logUserIP(user.uid, profile.nickname, clientIP);
        profile.lastIP = clientIP;
        profile.lastIPTimestamp = Date.now();
      }
      
      // Limpar sessão de convidado se existir
      clearGuestSession();
      // Sincronizar com sistema legado (player.ts)
      syncNicknameWithLegacy(profile.nickname);
      return profile;
    } else {
      // Se não existe, criar perfil básico (migração de usuários antigos)
      const userProfile: UserProfile = {
        uid: user.uid,
        email: user.email,
        nickname: user.displayName || user.email?.split('@')[0] || 'Jogador',
        isGuest: false,
        createdAt: Date.now(),
        ...(clientIP && { lastIP: clientIP, lastIPTimestamp: Date.now() })
      };
      await setDoc(doc(db, 'users', user.uid), userProfile);
      
      // Registrar IP no histórico
      if (clientIP) {
        await logUserIP(user.uid, userProfile.nickname, clientIP);
      }
      // Limpar sessão de convidado se existir
      clearGuestSession();
      // Sincronizar com sistema legado (player.ts)
      syncNicknameWithLegacy(userProfile.nickname);
      return userProfile;
    }
  } catch (error: any) {
    console.error('Error signing in:', error);
    const errorCode = error.code || error.message || '';
    throw new Error(getAuthErrorMessage(errorCode));
  }
}

/**
 * Login com Google
 */
export async function signInWithGoogle(): Promise<{ user: UserProfile; needsNickname: boolean }> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    // Verificar se o usuário está banido
    const bannedCheck = await isUserBanned(user.uid);
    if (bannedCheck.banned) {
      await firebaseSignOut(auth);
      throw new Error(`Sua conta foi banida. Motivo: ${bannedCheck.reason}`);
    }

    // Obter IP do cliente
    const clientIP = await getClientIP();

    // Limpar sessão de convidado se existir
    clearGuestSession();

    // Verificar se usuário já existe no Firestore
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    
    if (userDoc.exists()) {
      const profile = userDoc.data() as UserProfile;
      
      // Atualizar IP no perfil
      if (clientIP) {
        await updateDoc(doc(db, 'users', user.uid), {
          lastIP: clientIP,
          lastIPTimestamp: Date.now()
        });
        await logUserIP(user.uid, profile.nickname, clientIP);
        profile.lastIP = clientIP;
        profile.lastIPTimestamp = Date.now();
      }
      
      // Sincronizar com sistema legado (player.ts)
      syncNicknameWithLegacy(profile.nickname);
      return {
        user: profile,
        needsNickname: false
      };
    } else {
      // Novo usuário - precisa escolher nickname
      // NÃO criar perfil no Firestore ainda (as regras exigem nickname válido)
      // O perfil será criado quando o usuário escolher um nickname
      const userProfile: UserProfile = {
        uid: user.uid,
        email: user.email,
        nickname: '', // Será preenchido depois
        isGuest: false,
        createdAt: Date.now()
      };
      
      return {
        user: userProfile,
        needsNickname: true
      };
    }
  } catch (error: any) {
    console.error('Error signing in with Google:', error);
    const errorCode = error.code || error.message || '';
    throw new Error(getAuthErrorMessage(errorCode));
  }
}

/**
 * Atualizar nickname de usuário
 * Se o perfil não existir (novo usuário Google), cria o perfil completo
 * Também atualiza o nickname em todos os registros de ranking
 */
export async function updateUserNickname(uid: string, nickname: string): Promise<void> {
  try {
    const userDocRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userDocRef);
    
    let oldNickname: string | null = null;
    
    if (userDoc.exists()) {
      // Guardar nickname antigo para atualizar rankings
      oldNickname = userDoc.data().nickname || null;
      
      // Perfil existe, apenas atualizar nickname
      await updateDoc(userDocRef, { nickname });
    } else {
      // Perfil não existe (novo usuário Google), criar completo
      const currentUser = auth.currentUser;
      const userProfile: UserProfile = {
        uid,
        email: currentUser?.email || null,
        nickname,
        isGuest: false,
        createdAt: Date.now()
      };
      await setDoc(userDocRef, userProfile);
    }
    
    // Atualizar também no Firebase Auth
    const currentUser = auth.currentUser;
    if (currentUser && currentUser.uid === uid) {
      await updateProfile(currentUser, { displayName: nickname });
    }
    
    // Sincronizar com sistema legado (player.ts)
    syncNicknameWithLegacy(nickname);
    
    // Atualizar nickname em todos os rankings (se havia nickname antigo e mudou)
    if (oldNickname && oldNickname !== nickname) {
      try {
        const result = await updateNicknameInRankings(oldNickname, nickname);
        console.log(`Rankings updated - Official: ${result.official}, Community: ${result.community}`);
      } catch (rankingError) {
        // Log do erro mas não falha a operação principal
        console.error('Error updating rankings (non-critical):', rankingError);
      }
    }
  } catch (error) {
    console.error('Error updating nickname:', error);
    throw error;
  }
}

/**
 * Logout
 */
export async function signOut(): Promise<void> {
  try {
    // Limpar sessão de convidado se existir
    clearGuestSession();
    
    // Fazer signout do Firebase (se estiver autenticado)
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
}

/**
 * Criar sessão de convidado (guest)
 * Não cria conta no Firebase, apenas salva nickname localmente
 */
export function createGuestSession(nickname: string): UserProfile {
  // Validar nickname
  if (!nickname || nickname.trim().length === 0) {
    throw new Error('Nickname não pode estar vazio');
  }
  
  const trimmedNickname = nickname.trim();
  
  const guestProfile: UserProfile = {
    uid: `guest_${Date.now()}`,
    email: null,
    nickname: trimmedNickname,
    isGuest: true,
    createdAt: Date.now()
  };

  // Salvar no localStorage
  localStorage.setItem('guestProfile', JSON.stringify(guestProfile));
  
  // Sincronizar com sistema legado (player.ts)
  syncNicknameWithLegacy(trimmedNickname);

  return guestProfile;
}

/**
 * Atualizar nickname de convidado (guest)
 * Também atualiza o nickname em todos os registros de ranking
 */
export async function updateGuestNickname(oldNickname: string, newNickname: string): Promise<UserProfile> {
  // Validar novo nickname
  if (!newNickname || newNickname.trim().length === 0) {
    throw new Error('Nickname não pode estar vazio');
  }
  
  const trimmedNewNickname = newNickname.trim();
  
  // Criar novo perfil de convidado
  const guestProfile: UserProfile = {
    uid: `guest_${Date.now()}`,
    email: null,
    nickname: trimmedNewNickname,
    isGuest: true,
    createdAt: Date.now()
  };

  // Salvar no localStorage
  localStorage.setItem('guestProfile', JSON.stringify(guestProfile));
  
  // Sincronizar com sistema legado (player.ts)
  syncNicknameWithLegacy(trimmedNewNickname);
  
  // Atualizar nickname em todos os rankings (se nickname mudou)
  if (oldNickname && oldNickname !== trimmedNewNickname) {
    try {
      const result = await updateNicknameInRankings(oldNickname, trimmedNewNickname);
      console.log(`Guest rankings updated - Official: ${result.official}, Community: ${result.community}`);
    } catch (rankingError) {
      // Log do erro mas não falha a operação principal
      console.error('Error updating guest rankings (non-critical):', rankingError);
    }
  }

  return guestProfile;
}

/**
 * Recuperar sessão de convidado do localStorage
 */
export function getGuestSession(): UserProfile | null {
  const stored = localStorage.getItem('guestProfile');
  if (stored) {
    try {
      return JSON.parse(stored) as UserProfile;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Limpar sessão de convidado
 */
export function clearGuestSession(): void {
  localStorage.removeItem('guestProfile');
}

/**
 * Observador de mudanças de autenticação
 */
export function onAuthChanged(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

/**
 * Buscar perfil de usuário do Firestore
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return userDoc.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
}

/**
 * Verificar se um usuário está banido
 */
export async function isUserBanned(uid: string): Promise<{ banned: boolean; reason?: string }> {
  try {
    const bannedDoc = await getDoc(doc(db, 'banned_users', uid));
    if (bannedDoc.exists()) {
      const data = bannedDoc.data() as BannedUser;
      return { banned: true, reason: data.reason };
    }
    return { banned: false };
  } catch (error) {
    console.error('Error checking if user is banned:', error);
    return { banned: false };
  }
}

/**
 * Verificar se um IP está banido
 */
export async function isIPBanned(ip: string): Promise<{ banned: boolean; reason?: string }> {
  try {
    const bannedDoc = await getDoc(doc(db, 'banned_ips', ip.replace(/\./g, '_')));
    if (bannedDoc.exists()) {
      const data = bannedDoc.data() as BannedIP;
      return { banned: true, reason: data.reason };
    }
    return { banned: false };
  } catch (error) {
    console.error('Error checking if IP is banned:', error);
    return { banned: false };
  }
}

/**
 * Obter IP do cliente (melhor esforço)
 * Nota: Em produção, isso deve ser feito pelo servidor
 */
async function getClientIP(): Promise<string | null> {
  try {
    // Tentar obter IP através de um serviço externo
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip || null;
  } catch (error) {
    console.error('Error getting client IP:', error);
    return null;
  }
}

/**
 * Registrar IP no histórico de IPs do usuário
 */
async function logUserIP(uid: string, nickname: string, ip: string): Promise<void> {
  try {
    // Verificar se já existe um registro recente deste IP para este usuário (últimas 24h)
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const recentQuery = query(
      collection(db, 'user_ip_history'),
      where('uid', '==', uid),
      where('ip', '==', ip),
      where('timestamp', '>', oneDayAgo)
    );
    
    const recentDocs = await getDocs(recentQuery);
    
    // Só adicionar novo registro se não houver um recente
    if (recentDocs.empty) {
      await addDoc(collection(db, 'user_ip_history'), {
        uid,
        nickname,
        ip,
        timestamp: Date.now()
      });
      console.log(`IP ${ip} registrado para usuário ${nickname}`);
    }
  } catch (error) {
    console.error('Error logging user IP:', error);
    // Não bloquear o fluxo se houver erro ao salvar IP
  }
}

/**
 * Exportar função para uso em outros módulos
 */
export async function saveUserIP(uid: string, nickname: string): Promise<void> {
  const ip = await getClientIP();
  if (ip) {
    await logUserIP(uid, nickname, ip);
  }
}

/**
 * Verificar se o usuário atual está banido (por UID ou IP)
 */
export async function checkCurrentUserBanned(): Promise<{ banned: boolean; reason?: string }> {
  const user = auth.currentUser;
  
  // Verificar banimento por UID
  if (user) {
    const userBanned = await isUserBanned(user.uid);
    if (userBanned.banned) {
      return userBanned;
    }
  }
  
  // Verificar banimento por IP
  const ip = await getClientIP();
  if (ip) {
    const ipBanned = await isIPBanned(ip);
    if (ipBanned.banned) {
      return ipBanned;
    }
  }
  
  return { banned: false };
}

/**
 * Mensagens de erro traduzidas
 */
function getAuthErrorMessage(errorCode?: string): string {
  if (!errorCode) return 'Erro de autenticação. Tente novamente.';
  
  const code = errorCode.toLowerCase();
  
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Este email já está em uso.';
    case 'auth/invalid-email':
      return 'Email inválido.';
    case 'auth/operation-not-allowed':
      return 'Operação não permitida.';
    case 'auth/weak-password':
      return 'Senha muito fraca. Use pelo menos 6 caracteres.';
    case 'auth/user-disabled':
      return 'Esta conta foi desativada.';
    case 'auth/user-not-found':
      return 'Usuário não encontrado.';
    case 'auth/wrong-password':
      return 'Senha incorreta.';
    case 'auth/popup-closed-by-user':
      return 'Login cancelado.';
    case 'auth/cancelled-popup-request':
      return 'Login cancelado.';
    case 'permission-denied':
    case 'auth/permission-denied':
      return 'Permissão negada. Verifique as configurações do Firebase.';
    case 'user-banned':
      return 'Sua conta foi banida.';
    default:
      return 'Erro de autenticação. Tente novamente.';
  }
}
