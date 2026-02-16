import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { 
  UserProfile, 
  onAuthChanged, 
  getUserProfile, 
  getGuestSession,
  createAutoGuestSession
} from '../auth';

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
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    // Observar mudanças de autenticação do Firebase
    const unsubscribe = onAuthChanged(async (user) => {
      setCurrentUser(user);

      if (user) {
        // Usuário autenticado - buscar perfil
        const profile = await getUserProfile(user.uid);
        setUserProfile(profile);
      } else {
        // Não autenticado - verificar se há sessão guest
        let guestProfile = getGuestSession();
        
        // Se não há sessão guest e é o primeiro carregamento, criar automaticamente
        if (!guestProfile && isInitialLoad) {
          guestProfile = createAutoGuestSession();
        }
        
        setUserProfile(guestProfile);
      }

      setLoading(false);
      setIsInitialLoad(false);
    });

    return unsubscribe;
  }, [isInitialLoad]);

  const value: AuthContextType = {
    currentUser,
    userProfile,
    loading,
    isAuthenticated: currentUser !== null,
    isGuest: userProfile?.isGuest ?? false,
    setUserProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
