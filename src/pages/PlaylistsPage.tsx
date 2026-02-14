import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../hooks/useI18n';
import PlaylistItem from '../components/PlaylistItem';
import PlaylistDetails from '../components/PlaylistDetails';
import { PlaylistInfo } from '../types/playlist-ui';
import { Playlist } from '../types';


const AVAILABLE_PLAYLISTS: PlaylistInfo[] = [
  { 
    file: 'torneio-1.json', 
    name: 'TORNEIO A.D. BRK - Edição 1', 
    description: 'Playlist oficial do 1º Torneio A.D. BRK', 
    icon: 'fa-trophy' 
  },
  { 
    file: 'cruzamento-facil.json', 
    name: 'Cruzamento - Fácil', 
    description: 'Pratique cruzamentos e finalizações', 
    icon: 'fa-futbol' 
  },
  { 
    file: 'drible-e-gol.json', 
    name: 'Drible e Gol', 
    description: 'Melhore suas habilidades de drible', 
    icon: 'fa-bullseye' 
  },
  { 
    file: 'conducao-facil.json', 
    name: 'Condução - Fácil', 
    description: 'Exercícios focados em condução de bola', 
    icon: 'fa-person-running' 
  },
  { 
    file: 'finalizacoes-facil.json', 
    name: 'Finalizações - Fácil', 
    description: 'Seu time penetrou pela defesa adversária. Finalize com sucesso marcando gol.', 
    icon: 'fa-crosshairs' 
  }
];

function PlaylistsPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistInfo | null>(null);
  const [playlistData, setPlaylistData] = useState<Playlist | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleBack();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const handleSelectPlaylist = async (playlist: PlaylistInfo) => {
    setSelectedPlaylist(playlist);
    
    try {
      const response = await fetch(`/playlists/${playlist.file}`);
      if (!response.ok) throw new Error('Failed to load playlist');
      
      const data: Playlist = await response.json();
      setPlaylistData(data);
    } catch (error) {
      console.error('Error loading playlist:', error);
      alert(t('playlists.loadError'));
      setPlaylistData(null);
    }
  };

  const handleStartPlaylist = () => {
    if (playlistData) {
      // Navegar para página de jogo com dados da playlist
      navigate('/game', { state: { playlist: playlistData, mode: 'playlist' } });
    }
  };

  const handleImportPlaylist = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt: ProgressEvent<FileReader>) => {
      try {
        const content = evt.target?.result as string;
        const data = JSON.parse(content);

        let playlist: Playlist;

        if (data.scenarios && Array.isArray(data.scenarios)) {
          if (!data.name) {
            throw new Error('Playlist must have a name');
          }
          playlist = data;
        } else if (data.name && data.objectives) {
          playlist = {
            name: data.name,
            description: data.description || `Playlist criada a partir do cenário: ${data.name}`,
            scenarios: [data]
          };
        } else {
          throw new Error('Invalid format: must be a playlist or scenario');
        }

        // Navigate to game page with imported playlist
        navigate('/game', { state: { mode: 'playlist', playlist } });
      } catch (error) {
        console.error('Error parsing playlist:', error);
        alert(t('playlists.importError'));
      }

      e.target.value = '';
    };

    reader.readAsText(file);
  };

  const handleBack = () => {
    navigate('/modes');
  };

  return (
    <div className="playlists-page">
      <div className="playlists-container-wrapper">
        <div className="playlists-header">
          <h2>
            <i className="fas fa-list"></i> {t('playlists.title')}
          </h2>
          <button className="btn-back-secondary" onClick={handleBack}>
            <i className="fas fa-arrow-left"></i> {t('playlists.back')}
          </button>
        </div>

        <div className="playlists-container">
          {/* Sidebar with playlist list */}
          <div className="playlists-sidebar">
            <div className="playlists-list">
              {AVAILABLE_PLAYLISTS.map((playlist) => (
                <PlaylistItem
                  key={playlist.file}
                  playlist={playlist}
                  isSelected={selectedPlaylist?.file === playlist.file}
                  onSelect={() => handleSelectPlaylist(playlist)}
                />
              ))}
            </div>

            <div className="playlists-import">
              <button onClick={handleImportPlaylist}>
                <i className="fas fa-folder-open"></i> {t('playlists.import')}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>
          </div>

          {/* Details panel */}
          <PlaylistDetails
            playlist={selectedPlaylist}
            playlistData={playlistData}
            onStartPlaylist={handleStartPlaylist}
          />
        </div>
      </div>
    </div>
  );
}

export default PlaylistsPage;
