/**
 * Firebase Analytics - Rastreamento de eventos do jogo
 * 
 * Eventos rastreados:
 * - Navegação entre páginas (screen_view)
 * - Partidas de treino livre iniciadas
 * - Playlists iniciadas e completadas
 * - Cenários completados e falhados
 * - Scores submetidos ao ranking
 * - Editor de playlists usado
 */

import { getAnalytics, logEvent, Analytics, isSupported } from 'firebase/analytics';
import { getApp } from 'firebase/app';

let analytics: Analytics | null = null;

/**
 * Inicializa o Firebase Analytics.
 * Chame após initializeApp(). Falha silenciosamente se Analytics
 * não estiver habilitado no projeto ou o ambiente não suportar.
 */
export async function initAnalytics(): Promise<void> {
  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn('[Analytics] Ambiente não suporta Firebase Analytics');
      return;
    }
    analytics = getAnalytics(getApp());
    console.log('[Analytics] Firebase Analytics inicializado');
  } catch (error) {
    // Analytics pode falhar se measurementId não estiver configurado,
    // ad blockers, ou ambiente não suportado. Tudo continua funcionando.
    console.warn('[Analytics] Não foi possível inicializar:', error);
  }
}

/**
 * Loga um evento de forma segura (no-op se analytics não inicializado)
 */
function safeLogEvent(eventName: string, params?: Record<string, unknown>): void {
  if (!analytics) return;
  try {
    logEvent(analytics, eventName, params);
  } catch {
    // Silenciar erros de analytics para não afetar o jogo
  }
}

// ── Eventos de Navegação ──

/** Rastreia visualização de página/tela */
export function trackPageView(pageName: string): void {
  safeLogEvent('screen_view', {
    firebase_screen: pageName,
    firebase_screen_class: pageName,
  });
}

// ── Eventos de Jogo ──

/** Jogador iniciou treino livre */
export function trackFreePlayStart(mapType: string): void {
  safeLogEvent('free_play_start', {
    map_type: mapType,
  });
}

/** Partida de treino livre finalizada (game over) */
export function trackFreePlayEnd(winner: string, scoreRed: number, scoreBlue: number): void {
  safeLogEvent('free_play_end', {
    winner,
    score_red: scoreRed,
    score_blue: scoreBlue,
  });
}

// ── Eventos de Playlist ──

/** Jogador iniciou uma playlist */
export function trackPlaylistStart(playlistName: string, scenarioCount: number): void {
  safeLogEvent('playlist_start', {
    playlist_name: playlistName,
    scenario_count: scenarioCount,
  });
}

/** Jogador completou uma playlist inteira */
export function trackPlaylistComplete(
  playlistName: string,
  kicks: number,
  timeSeconds: number,
  score: number,
  isOfficial: boolean
): void {
  safeLogEvent('playlist_complete', {
    playlist_name: playlistName,
    kicks,
    time_seconds: Math.round(timeSeconds),
    score,
    is_official: isOfficial,
  });
}

/** Cenário individual completado */
export function trackScenarioComplete(playlistName: string, scenarioIndex: number): void {
  safeLogEvent('scenario_complete', {
    playlist_name: playlistName,
    scenario_index: scenarioIndex,
  });
}

/** Cenário individual falhado */
export function trackScenarioFail(playlistName: string, scenarioIndex: number, reason: string): void {
  safeLogEvent('scenario_fail', {
    playlist_name: playlistName,
    scenario_index: scenarioIndex,
    fail_reason: reason,
  });
}

/** Playlist reiniciada (backspace) */
export function trackPlaylistRestart(playlistName: string): void {
  safeLogEvent('playlist_restart', {
    playlist_name: playlistName,
  });
}

// ── Eventos de Ranking ──

/** Score submetido ao ranking */
export function trackScoreSubmit(
  playlistName: string,
  score: number,
  isNewHighscore: boolean
): void {
  safeLogEvent('score_submit', {
    playlist_name: playlistName,
    score,
    is_new_highscore: isNewHighscore,
  });
}

// ── Eventos de Editor ──

/** Editor de playlists aberto */
export function trackEditorOpen(): void {
  safeLogEvent('editor_open');
}

/** Playlist testada a partir do editor */
export function trackEditorTestPlaylist(): void {
  safeLogEvent('editor_test_playlist');
}

// ── Eventos de Configuração ──

/** Configurações alteradas */
export function trackSettingsChange(setting: string, value: string | number | boolean): void {
  safeLogEvent('settings_change', {
    setting_name: setting,
    setting_value: String(value),
  });
}
