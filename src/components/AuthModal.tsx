import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useKeyboardNav } from '../hooks/useKeyboardNav';
import { 
  signUpWithEmail, 
  signInWithEmail, 
  signInWithGoogle,
  createGuestSession,
  updateUserNickname,
  signOut
} from '../auth';
import '../styles/Modal.css';
import '../styles/AuthModal.css';

interface AuthModalProps {
  onClose: () => void;
  allowGuest?: boolean;
}

type AuthMode = 'login' | 'register' | 'guest' | 'set-nickname' | 'manage-guest' | 'change-nickname';

export default function AuthModal({ onClose, allowGuest = true }: AuthModalProps) {
  const { userProfile, setUserProfile } = useAuth();
  const [mode, setMode] = useState<AuthMode>(
    userProfile?.isGuest ? 'manage-guest' : (userProfile && !userProfile.isGuest ? 'change-nickname' : (allowGuest ? 'guest' : 'login'))
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState(userProfile?.nickname || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingGoogleUid, setPendingGoogleUid] = useState<string | null>(null);

  // Navegação por teclado
  const { containerRef } = useKeyboardNav({
    onEscape: onClose,
    autoFocus: true,
    initialFocusSelector: 'input:not([type="hidden"])'
  });

  const handleGuestLogin = () => {
    if (!nickname.trim()) {
      setError('Digite um nickname');
      return;
    }

    const profile = createGuestSession(nickname.trim());
    setUserProfile(profile);
    onClose();
  };

  const handleEmailLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Preencha todos os campos');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const profile = await signInWithEmail(email, password);
      setUserProfile(profile);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailRegister = async () => {
    if (!email.trim() || !password.trim() || !nickname.trim()) {
      setError('Preencha todos os campos');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const profile = await signUpWithEmail(email, password, nickname.trim());
      setUserProfile(profile);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');

    try {
      const { user, needsNickname } = await signInWithGoogle();
      
      if (needsNickname) {
        // Usuário novo precisa escolher nickname
        setPendingGoogleUid(user.uid);
        setMode('set-nickname');
      } else {
        setUserProfile(user);
        onClose();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetNickname = async () => {
    if (!nickname.trim()) {
      setError('Digite um nickname');
      return;
    }

    if (!pendingGoogleUid) {
      setError('Erro ao configurar perfil');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await updateUserNickname(pendingGoogleUid, nickname.trim());
      const profile = {
        uid: pendingGoogleUid,
        email: null,
        nickname: nickname.trim(),
        isGuest: false,
        createdAt: Date.now()
      };
      setUserProfile(profile);
      onClose();
    } catch (err: any) {
      setError('Erro ao salvar nickname');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeNickname = () => {
    if (!nickname.trim()) {
      setError('Digite um nickname');
      return;
    }

    const profile = createGuestSession(nickname.trim());
    setUserProfile(profile);
    onClose();
  };

  const handleChangeNicknameLoggedIn = async () => {
    if (!nickname.trim()) {
      setError('Digite um nickname');
      return;
    }

    if (!userProfile?.uid) {
      setError('Erro ao atualizar perfil');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await updateUserNickname(userProfile.uid, nickname.trim());
      const updatedProfile = {
        ...userProfile,
        nickname: nickname.trim()
      };
      setUserProfile(updatedProfile);
      onClose();
    } catch (err: any) {
      setError('Erro ao salvar nickname');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await signOut();
      setUserProfile(null);
      onClose();
    } catch (err: any) {
      setError('Erro ao sair');
    } finally {
      setLoading(false);
    }
  };

  const renderManageGuestMode = () => (
    <>
      <h2><i className="fas fa-user"></i> Gerenciar Conta</h2>
      <p className="auth-description">
        Você está jogando como convidado. Altere seu nickname ou crie uma conta para publicar playlists.
      </p>
      
      <div className="auth-form">
        <div className="form-group">
          <label htmlFor="nickname">Nickname</label>
          <input
            id="nickname"
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Seu nickname"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleChangeNickname()}
          />
        </div>

        {error && <div className="auth-error">{error}</div>}

        <button 
          className="btn-primary" 
          onClick={handleChangeNickname}
          disabled={loading}
        >
          <i className="fas fa-check"></i> Salvar Nickname
        </button>

        <div className="auth-divider">ou</div>

        <button 
          className="btn-secondary" 
          onClick={() => setMode('register')}
        >
          <i className="fas fa-user-plus"></i> Criar Conta
        </button>

        <button 
          className="btn-secondary" 
          onClick={() => setMode('login')}
        >
          <i className="fas fa-sign-in-alt"></i> Fazer Login
        </button>

        <button 
          className="btn-secondary" 
          onClick={handleLogout}
          disabled={loading}
          style={{ marginTop: '10px', opacity: 0.7 }}
        >
          <i className="fas fa-sign-out-alt"></i> Sair
        </button>
      </div>
    </>
  );

  const renderGuestMode = () => (
    <>
      <h2><i className="fas fa-user"></i> Entrar como Convidado</h2>
      <p className="auth-description">
        Jogue sem criar conta. Você não poderá publicar playlists da comunidade.
      </p>
      
      <div className="auth-form">
        <div className="form-group">
          <label htmlFor="nickname">Nickname</label>
          <input
            id="nickname"
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Seu nickname"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleGuestLogin()}
          />
        </div>

        {error && <div className="auth-error">{error}</div>}

        <button 
          className="btn-primary" 
          onClick={handleGuestLogin}
          disabled={loading}
        >
          <i className="fas fa-play"></i> Jogar
        </button>

        <div className="auth-divider">ou</div>

        <button 
          className="btn-secondary" 
          onClick={() => setMode('login')}
        >
          <i className="fas fa-sign-in-alt"></i> Fazer Login
        </button>

        <button 
          className="btn-secondary" 
          onClick={() => setMode('register')}
        >
          <i className="fas fa-user-plus"></i> Criar Conta
        </button>
      </div>
    </>
  );

  const renderLoginMode = () => (
    <>
      <h2><i className="fas fa-sign-in-alt"></i> Login</h2>
      
      <div className="auth-form">
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            autoFocus
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Sua senha"
            onKeyDown={(e) => e.key === 'Enter' && handleEmailLogin()}
          />
        </div>

        {error && <div className="auth-error">{error}</div>}

        <button 
          className="btn-primary" 
          onClick={handleEmailLogin}
          disabled={loading}
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>

        <button 
          className="btn-google" 
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          <i className="fab fa-google"></i> Entrar com Google
        </button>

        <div className="auth-footer">
          <button className="btn-link" onClick={() => setMode('register')}>
            Não tem conta? Cadastre-se
          </button>
          {allowGuest && (
            <button className="btn-link" onClick={() => setMode('guest')}>
              Entrar como convidado
            </button>
          )}
        </div>
      </div>
    </>
  );

  const renderRegisterMode = () => (
    <>
      <h2><i className="fas fa-user-plus"></i> Criar Conta</h2>
      
      <div className="auth-form">
        <div className="form-group">
          <label htmlFor="nickname">Nickname</label>
          <input
            id="nickname"
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Seu nickname"
            autoFocus
          />
        </div>

        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
          />
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword">Confirmar Senha</label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Digite a senha novamente"
            onKeyDown={(e) => e.key === 'Enter' && handleEmailRegister()}
          />
        </div>

        {error && <div className="auth-error">{error}</div>}

        <button 
          className="btn-primary" 
          onClick={handleEmailRegister}
          disabled={loading}
        >
          {loading ? 'Criando...' : 'Criar Conta'}
        </button>

        <button 
          className="btn-google" 
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          <i className="fab fa-google"></i> Cadastrar com Google
        </button>

        <div className="auth-footer">
          <button className="btn-link" onClick={() => setMode('login')}>
            Já tem conta? Faça login
          </button>
          {allowGuest && (
            <button className="btn-link" onClick={() => setMode('guest')}>
              Entrar como convidado
            </button>
          )}
        </div>
      </div>
    </>
  );

  const renderSetNicknameMode = () => (
    <>
      <h2><i className="fas fa-user-edit"></i> Escolha seu Nickname</h2>
      <p className="auth-description">
        Você está logado com o Google. Escolha um nickname para sua conta.
      </p>
      
      <div className="auth-form">
        <div className="form-group">
          <label htmlFor="nickname">Nickname</label>
          <input
            id="nickname"
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Seu nickname"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleSetNickname()}
          />
        </div>

        {error && <div className="auth-error">{error}</div>}

        <button 
          className="btn-primary" 
          onClick={handleSetNickname}
          disabled={loading}
        >
          {loading ? 'Salvando...' : 'Continuar'}
        </button>
      </div>
    </>
  );

  const renderChangeNicknameMode = () => (
    <>
      <h2><i className="fas fa-user-edit"></i> Alterar Nickname</h2>
      <p className="auth-description">
        Você está logado. Altere seu nickname abaixo.
      </p>
      
      <div className="auth-form">
        <div className="form-group">
          <label htmlFor="nickname">Nickname</label>
          <input
            id="nickname"
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Seu nickname"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleChangeNicknameLoggedIn()}
          />
        </div>

        {error && <div className="auth-error">{error}</div>}

        <button 
          className="btn-primary" 
          onClick={handleChangeNicknameLoggedIn}
          disabled={loading}
        >
          {loading ? 'Salvando...' : 'Salvar Nickname'}
        </button>

        <button 
          className="btn-secondary" 
          onClick={handleLogout}
          disabled={loading}
          style={{ marginTop: '15px' }}
        >
          <i className="fas fa-sign-out-alt"></i> Sair
        </button>
      </div>
    </>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content auth-modal" onClick={(e) => e.stopPropagation()} ref={containerRef}>
        <button className="modal-close" onClick={onClose}>
          <i className="fas fa-times"></i>
        </button>

        {mode === 'manage-guest' && renderManageGuestMode()}
        {mode === 'guest' && renderGuestMode()}
        {mode === 'login' && renderLoginMode()}
        {mode === 'register' && renderRegisterMode()}
        {mode === 'set-nickname' && renderSetNicknameMode()}
        {mode === 'change-nickname' && renderChangeNicknameMode()}
      </div>
    </div>
  );
}
