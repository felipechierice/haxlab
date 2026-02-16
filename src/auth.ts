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
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

// Inicializar Firebase Auth
export const auth: Auth = getAuth();

// Provider do Google
const googleProvider = new GoogleAuthProvider();

export interface UserProfile {
  uid: string;
  email: string | null;
  nickname: string;
  isGuest: boolean;
  createdAt: number;
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

    // Criar perfil no Firestore
    const userProfile: UserProfile = {
      uid: user.uid,
      email: user.email,
      nickname,
      isGuest: false,
      createdAt: Date.now()
    };

    await setDoc(doc(db, 'users', user.uid), userProfile);

    // Limpar sessão de convidado se existir
    clearGuestSession();

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

    // Buscar perfil no Firestore
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    
    if (userDoc.exists()) {
      // Limpar sessão de convidado se existir
      clearGuestSession();
      return userDoc.data() as UserProfile;
    } else {
      // Se não existe, criar perfil básico (migração de usuários antigos)
      const userProfile: UserProfile = {
        uid: user.uid,
        email: user.email,
        nickname: user.displayName || user.email?.split('@')[0] || 'Jogador',
        isGuest: false,
        createdAt: Date.now()
      };
      await setDoc(doc(db, 'users', user.uid), userProfile);
      // Limpar sessão de convidado se existir
      clearGuestSession();
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

    // Limpar sessão de convidado se existir
    clearGuestSession();

    // Verificar se usuário já existe no Firestore
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    
    if (userDoc.exists()) {
      return {
        user: userDoc.data() as UserProfile,
        needsNickname: false
      };
    } else {
      // Novo usuário - precisa escolher nickname
      const userProfile: UserProfile = {
        uid: user.uid,
        email: user.email,
        nickname: '', // Será preenchido depois
        isGuest: false,
        createdAt: Date.now()
      };
      
      await setDoc(doc(db, 'users', user.uid), userProfile);
      
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
 */
export async function updateUserNickname(uid: string, nickname: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid), { nickname });
    
    // Atualizar também no Firebase Auth
    const currentUser = auth.currentUser;
    if (currentUser && currentUser.uid === uid) {
      await updateProfile(currentUser, { displayName: nickname });
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
  
  const guestProfile: UserProfile = {
    uid: `guest_${Date.now()}`,
    email: null,
    nickname: nickname.trim(),
    isGuest: true,
    createdAt: Date.now()
  };

  // Salvar no localStorage
  localStorage.setItem('guestProfile', JSON.stringify(guestProfile));

  return guestProfile;
}

/**
 * Criar sessão de convidado automática com nickname aleatório
 */
export function createAutoGuestSession(): UserProfile {
  // Gerar nickname aleatório
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let nickname = '';
  for (let i = 0; i < 8; i++) {
    nickname += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return createGuestSession(nickname);
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
    default:
      return 'Erro de autenticação. Tente novamente.';
  }
}
