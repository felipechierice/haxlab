import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { 
  UserProfile, 
  onAuthChanged, 
  getUserProfile, 
  getGuestSession,
  checkCurrentUserBanned,
  signOut
} from '../auth';
import { saveNickname } from '../player';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  isGuest: boolean;
  setUserProfile: (profile: UserProfile | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Observar mudanças de autenticação do Firebase
    const unsubscribe = onAuthChanged(async (user) => {
      setCurrentUser(user);

      if (user) {
        // Verificar se o usuário está banido
        const bannedCheck = await checkCurrentUserBanned();
        if (bannedCheck.banned) {
          console.error('Usuário banido:', bannedCheck.reason);
          alert(`Sua conta foi banida. Motivo: ${bannedCheck.reason}`);
          await signOut();
          setUserProfile(null);
          setLoading(false);
          return;
        }

        // Usuário autenticado - buscar perfil
        const profile = await getUserProfile(user.uid);
        setUserProfile(profile);
        
        // Sincronizar com sistema legado (player.ts)
        if (profile?.nickname) {
          saveNickname(profile.nickname);
        }
      } else {
        // Não autenticado - verificar se há sessão guest existente
        // Não criar automaticamente - usuário deve escolher nickname manualmente
        const guestProfile = getGuestSession();
        
        setUserProfile(guestProfile);
        
        // Sincronizar com sistema legado (player.ts) se tiver perfil
        if (guestProfile?.nickname) {
          saveNickname(guestProfile.nickname);
        }
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Verificação periódica de banimento (a cada 30 segundos)
  useEffect(() => {
    if (!currentUser) return;

    const checkBanInterval = setInterval(async () => {
      const bannedCheck = await checkCurrentUserBanned();
      if (bannedCheck.banned) {
        console.error('Usuário banido durante a sessão:', bannedCheck.reason);
        alert(`Sua conta foi banida. Motivo: ${bannedCheck.reason}\n\nVocê será desconectado.`);
        await signOut();
        setUserProfile(null);
      }
    }, 30000); // 30 segundos

    return () => clearInterval(checkBanInterval);
  }, [currentUser]);

  // Wrapper para setUserProfile que também sincroniza com o sistema legado
  const handleSetUserProfile = (profile: UserProfile | null) => {
    setUserProfile(profile);
    
    // Sincronizar com sistema legado (player.ts)
    if (profile?.nickname) {
      saveNickname(profile.nickname);
    }
  };

  const value: AuthContextType = {
    currentUser,
    userProfile,
    loading,
    isAuthenticated: currentUser !== null,
    isGuest: userProfile?.isGuest ?? false,
    setUserProfile: handleSetUserProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
