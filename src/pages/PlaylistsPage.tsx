import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../hooks/useI18n';
import { useKeyboardNav } from '../hooks/useKeyboardNav';
import PlaylistItem from '../components/PlaylistItem';
import PlaylistDetails from '../components/PlaylistDetails';
import { PlaylistInfo } from '../types/playlist-ui';
import { Playlist } from '../types';
import { audioManager } from '../audio';
import { trackPageView } from '../analytics';


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
  },
//   { 
//     file: 'goleiro-treino.json', 
//     name: 'Treino de Goleiro', 
//     description: 'Defenda seu gol contra ataques cada vez mais difíceis. Dos chutes simples até blitz com múltiplos atacantes.', 
//     icon: 'fa-hand' 
//   }
];

function PlaylistsPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistInfo | null>(null);
  const [playlistData, setPlaylistData] = useState<Playlist | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { trackPageView('PlaylistsPage'); }, []);

  const handleBack = () => {
    audioManager.play('menuBack');
    navigate('/modes');
  };

  const { containerRef, getFocusableElements } = useKeyboardNav({
    onEscape: handleBack,
    autoFocus: true,
    initialFocusSelector: '.playlist-item'
  });

  // Navegação Q/E entre playlists
  useEffect(() => {
    const handleQENavigation = (e: KeyboardEvent) => {
      // Ignorar se estiver em um input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      if (e.key.toLowerCase() === 'q' || e.key.toLowerCase() === 'e') {
        e.preventDefault();
        
        if (!selectedPlaylist) {
          // Se nenhuma playlist está selecionada, selecionar a primeira
          if (AVAILABLE_PLAYLISTS.length > 0) {
            handleSelectPlaylist(AVAILABLE_PLAYLISTS[0]);
          }
          return;
        }

        const currentIndex = AVAILABLE_PLAYLISTS.findIndex(p => p.file === selectedPlaylist.file);
        if (currentIndex === -1) return;

        let newIndex: number;
        if (e.key.toLowerCase() === 'q') {
          // Q = anterior
          newIndex = currentIndex - 1;
          if (newIndex < 0) newIndex = AVAILABLE_PLAYLISTS.length - 1;
        } else {
          // E = próximo
          newIndex = currentIndex + 1;
          if (newIndex >= AVAILABLE_PLAYLISTS.length) newIndex = 0;
        }

        handleSelectPlaylist(AVAILABLE_PLAYLISTS[newIndex]);
      }
    };

    window.addEventListener('keydown', handleQENavigation);
    return () => window.removeEventListener('keydown', handleQENavigation);
  }, [selectedPlaylist]);

  const handleSelectPlaylist = async (playlist: PlaylistInfo) => {
    audioManager.play('menuSelect');
    setSelectedPlaylist(playlist);
    
    try {
      const response = await fetch(`/playlists/${playlist.file}`);
      if (!response.ok) throw new Error('Failed to load playlist');
      
      const data: Playlist = await response.json();
      setPlaylistData(data);
      
      // Focar no botão "Jogar Playlist" após carregar
      setTimeout(() => {
        if (containerRef.current) {
          const playButton = containerRef.current.querySelector('.btn-primary') as HTMLElement;
          if (playButton) {
            playButton.focus();
            playButton.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        }
      }, 150);
    } catch (error) {
      console.error('Error loading playlist:', error);
      alert(t('playlists.loadError'));
      setPlaylistData(null);
    }
  };

  const handleStartPlaylist = () => {
    if (playlistData) {
      audioManager.play('menuSelect');
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

  return (
    <div className="playlists-page">
      <div className="playlists-container-wrapper" ref={containerRef}>
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
          <div className="playlists-sidebar-wrapper">
            {/* Keybindings hint - fixed at top */}
            <div className="playlists-keybindings">
              <div className="keybinding-item">
                <kbd className="key">Q</kbd>
                <span className="keybinding-action">{t('playlists.previous')}</span>
              </div>
              <div className="keybinding-divider"></div>
              <div className="keybinding-item">
                <kbd className="key">E</kbd>
                <span className="keybinding-action">{t('playlists.next')}</span>
              </div>
            </div>

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
