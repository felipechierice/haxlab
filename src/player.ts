/**
 * Sistema de gerenciamento de jogador e nickname
 * 
 * IMPORTANTE: Este módulo foi atualizado para integrar com o sistema de autenticação.
 * O nickname agora é obtido na seguinte ordem de prioridade:
 * 1. Perfil de convidado (localStorage 'guestProfile')
 * 2. Fallback para o sistema legado (localStorage 'haxlab_player_nickname')
 * 
 * Para usuários autenticados, o nickname deve ser obtido via AuthContext no React.
 * Este módulo é usado principalmente pelo código legado (legacy-init.ts).
 * 
 * NOTA: Não há mais geração automática de nicknames aleatórios.
 * O usuário deve escolher seu nickname manualmente antes de jogar.
 */

const NICKNAME_STORAGE_KEY = 'haxlab_player_nickname';
const GUEST_PROFILE_KEY = 'guestProfile';

/**
 * Salva nickname no localStorage (sistema legado)
 * Também atualiza o guestProfile se existir para manter sincronização
 */
export function saveNickname(nickname: string): void {
  localStorage.setItem(NICKNAME_STORAGE_KEY, nickname);
  
  // Sincronizar com guestProfile se existir
  const guestProfileStr = localStorage.getItem(GUEST_PROFILE_KEY);
  if (guestProfileStr) {
    try {
      const guestProfile = JSON.parse(guestProfileStr);
      guestProfile.nickname = nickname;
      localStorage.setItem(GUEST_PROFILE_KEY, JSON.stringify(guestProfile));
    } catch {
      // Ignora erro de parse
    }
  }
}

/**
 * Obtém nickname do sistema de autenticação ou do sistema legado
 * Prioridade:
 * 1. guestProfile (sistema de autenticação para convidados)
 * 2. haxlab_player_nickname (sistema legado)
 * 
 * Retorna string vazia se nenhum nickname estiver configurado.
 * O usuário deve escolher um nickname antes de jogar.
 */
export function getNickname(): string {
  // 1. Tentar obter do guestProfile (sistema de autenticação)
  const guestProfileStr = localStorage.getItem(GUEST_PROFILE_KEY);
  if (guestProfileStr) {
    try {
      const guestProfile = JSON.parse(guestProfileStr);
      if (guestProfile.nickname && typeof guestProfile.nickname === 'string') {
        // Sincronizar com sistema legado para manter consistência
        localStorage.setItem(NICKNAME_STORAGE_KEY, guestProfile.nickname);
        return guestProfile.nickname;
      }
    } catch {
      // Ignora erro de parse, continua para próxima fonte
    }
  }
  
  // 2. Fallback para sistema legado
  const nickname = localStorage.getItem(NICKNAME_STORAGE_KEY);
  
  // Retorna nickname existente ou string vazia (usuário deve escolher)
  return nickname || '';
}

/**
 * Verifica se nickname é válido
 */
export function isValidNickname(nickname: string): boolean {
  // 3-16 caracteres alfanuméricos
  return /^[a-zA-Z0-9]{3,16}$/.test(nickname);
}

/**
 * Limpa nickname salvo
 */
export function clearNickname(): void {
  localStorage.removeItem(NICKNAME_STORAGE_KEY);
}
