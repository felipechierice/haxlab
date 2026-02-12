/**
 * Tipos específicos para a interface de Playlists
 */

export interface PlaylistInfo {
  file: string;
  name: string;
  description: string;
  icon: string;
}

export interface PlaylistStats {
  scenariosCount: number;
  avgTime: string;
  avgKicks: string;
}

export interface PlayerHighscore {
  score: number;
  rank: string;
  kicks: number;
  time: number;
}

export interface RankingEntry {
  nickname: string;
  score: number;
  kicks: number;
  time: number;
  playlistName: string;
}
