/**
 * Sistema de gerenciamento de jogador e nickname
 */

const NICKNAME_STORAGE_KEY = 'haxlab_player_nickname';

/**
 * Gera nickname aleatório de 8 caracteres
 */
export function generateRandomNickname(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removido I, O, 0, 1 para evitar confusão
  let nickname = '';
  for (let i = 0; i < 8; i++) {
    nickname += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nickname;
}

/**
 * Salva nickname no localStorage
 */
export function saveNickname(nickname: string): void {
  localStorage.setItem(NICKNAME_STORAGE_KEY, nickname);
}

/**
 * Obtém nickname salvo ou gera um novo
 */
export function getNickname(): string {
  let nickname = localStorage.getItem(NICKNAME_STORAGE_KEY);
  
  if (!nickname) {
    nickname = generateRandomNickname();
    saveNickname(nickname);
  }
  
  return nickname;
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
