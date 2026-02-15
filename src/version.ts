/**
 * Versão do jogo HaxLab
 * 
 * Quando esta versão mudar, todas as configurações personalizadas
 * serão resetadas para os valores padrão.
 * 
 * Formato recomendado: "MAJOR.MINOR.PATCH" ou "YYYY.MM.DD"
 */
export const GAME_VERSION = '2026.02.15.17.52.00';

/**
 * Chaves do localStorage que devem ser resetadas quando a versão mudar
 */
const CONFIG_KEYS_TO_RESET = [
  'gameConfig',
  'mapType',
  'extrapolation',
];

/**
 * Verifica se a versão do jogo mudou e reseta as configurações se necessário
 * @returns true se as configurações foram resetadas, false caso contrário
 */
export function checkVersionAndResetIfNeeded(): boolean {
  const savedVersion = localStorage.getItem('gameVersion');
  
  if (savedVersion !== GAME_VERSION) {
    console.log(`[HaxLab] Versão alterada: ${savedVersion || 'nenhuma'} → ${GAME_VERSION}`);
    console.log('[HaxLab] Resetando configurações para os valores padrão...');
    
    // Remove todas as configurações personalizadas
    for (const key of CONFIG_KEYS_TO_RESET) {
      localStorage.removeItem(key);
    }
    
    // Salva a nova versão
    localStorage.setItem('gameVersion', GAME_VERSION);
    
    return true;
  }
  
  return false;
}

/**
 * Obtém a versão atual do jogo
 */
export function getGameVersion(): string {
  return GAME_VERSION;
}
