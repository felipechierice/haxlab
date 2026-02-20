import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../hooks/useI18n';
import { useKeyboardNav } from '../hooks/useKeyboardNav';
import { useAuth } from '../contexts/AuthContext';
import PlaylistItem from '../components/PlaylistItem';
import PlaylistDetails from '../components/PlaylistDetails';
import AuthModal from '../components/AuthModal';
import { PlaylistInfo } from '../types/playlist-ui';
import { Playlist } from '../types';
import { audioManager } from '../audio';
import { trackPageView } from '../analytics';
import { getPlayerOfficialPlaylistRanks, getPlayerCommunityPlaylistRanks } from '../firebase';
import { 
  getCommunityPlaylists, 
  CommunityPlaylist,
  PlaylistSortBy,
  likePlaylist,
  getUserPlaylistLike
} from '../community-playlists';
import '../styles/PlaylistsPage.css';


const AVAILABLE_PLAYLISTS: PlaylistInfo[] = [
  // Playlists serão adicionadas aqui
  {
    file: 'desafio-4.json',
    name: 'Desafio 4',
    description: 'Dessa vez, 6 cenários focados em testar suas habilidades em domínio, dribles e embaixadinhas.',
    icon: 'fa-fire'
  },
  {
    file: 'desafio-3.json',
    name: 'Desafio 3',
    description: '8 cenários desafiadores: finalizações de tabela, passes mágicos, corredores de posse de bola contra múltiplos adversários e dribles em M — teste seus reflexos, precisão e controle de bola!',
    icon: 'fa-fire'
  },
  {
    file: 'desafio-2.json',
    name: 'Desafio 2',
    description: '6 cenários de situações de 2x1, escanteios e condução de bola — teste seus reflexos e tome decisões rápidas!',
    icon: 'fa-fire'
  },
  {
    file: 'mix-1.json',
    name: 'Desafio 1',
    description: '9 cenários combinando habilidades de passe, drible, finalizações e mais.',
    icon: 'fa-fire'
  }
];

type TabType = 'official' | 'community';

function PlaylistsPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { userProfile, isAuthenticated } = useAuth();
  const [currentTab, setCurrentTab] = useState<TabType>('official');
  const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistInfo | null>(null);
  const [selectedCommunityPlaylist, setSelectedCommunityPlaylist] = useState<CommunityPlaylist | null>(null);
  const [playlistData, setPlaylistData] = useState<Playlist | null>(null);
  const [communityPlaylists, setCommunityPlaylists] = useState<CommunityPlaylist[]>([]);
  const [sortBy, setSortBy] = useState<PlaylistSortBy>('recent');
  const [loading, setLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [userLikes, setUserLikes] = useState<Map<string, 'like' | 'dislike'>>(new Map());
  const [officialPlaylistRanks, setOfficialPlaylistRanks] = useState<Map<string, number>>(new Map());
  const [communityPlaylistRanks, setCommunityPlaylistRanks] = useState<Map<string, number>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { trackPageView('PlaylistsPage'); }, []);

  // Carregar posições no ranking do usuário
  useEffect(() => {
    const loadPlaylistRanks = async () => {
      if (userProfile?.nickname) {
        const [official, community] = await Promise.all([
          getPlayerOfficialPlaylistRanks(userProfile.nickname),
          getPlayerCommunityPlaylistRanks(userProfile.nickname)
        ]);
        setOfficialPlaylistRanks(official);
        setCommunityPlaylistRanks(community);
      }
    };
    loadPlaylistRanks();
  }, [userProfile?.nickname]);

  // Carregar playlists da comunidade quando a aba mudar
  useEffect(() => {
    if (currentTab === 'community') {
      loadCommunityPlaylists();
    }
  }, [currentTab, sortBy]);

  const loadCommunityPlaylists = async () => {
    setLoading(true);
    try {
      const playlists = await getCommunityPlaylists(sortBy, 50);
      setCommunityPlaylists(playlists);
      
      // Carregar likes do usuário
      if (userProfile) {
        const likesMap = new Map<string, 'like' | 'dislike'>();
        await Promise.all(
          playlists.map(async (playlist) => {
            const like = await getUserPlaylistLike(playlist.id, userProfile.uid);
            if (like) {
              likesMap.set(playlist.id, like.type);
            }
          })
        );
        setUserLikes(likesMap);
      }
    } catch (error) {
      console.error('Error loading community playlists:', error);
    } finally {
      setLoading(false);
    }
  };

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
        
        const playlists = currentTab === 'official' ? AVAILABLE_PLAYLISTS : communityPlaylists;
        const currentPlaylist = currentTab === 'official' ? selectedPlaylist : selectedCommunityPlaylist;
        
        if (!currentPlaylist) {
          // Se nenhuma playlist está selecionada, selecionar a primeira
          if (playlists.length > 0) {
            if (currentTab === 'official') {
              handleSelectPlaylist(playlists[0] as PlaylistInfo);
            } else {
              handleSelectCommunityPlaylist(playlists[0] as CommunityPlaylist);
            }
          }
          return;
        }

        const currentIndex = currentTab === 'official' 
          ? AVAILABLE_PLAYLISTS.findIndex(p => p.file === (selectedPlaylist as PlaylistInfo).file)
          : communityPlaylists.findIndex(p => p.id === (selectedCommunityPlaylist as CommunityPlaylist).id);
          
        if (currentIndex === -1) return;

        let newIndex: number;
        if (e.key.toLowerCase() === 'q') {
          // Q = anterior
          newIndex = currentIndex - 1;
          if (newIndex < 0) newIndex = playlists.length - 1;
        } else {
          // E = próximo
          newIndex = currentIndex + 1;
          if (newIndex >= playlists.length) newIndex = 0;
        }

        if (currentTab === 'official') {
          handleSelectPlaylist(AVAILABLE_PLAYLISTS[newIndex]);
        } else {
          handleSelectCommunityPlaylist(communityPlaylists[newIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleQENavigation);
    return () => window.removeEventListener('keydown', handleQENavigation);
  }, [selectedPlaylist, selectedCommunityPlaylist, currentTab, communityPlaylists]);

  const handleSelectPlaylist = async (playlist: PlaylistInfo) => {
    audioManager.play('menuSelect');
    setSelectedPlaylist(playlist);
    setSelectedCommunityPlaylist(null);
    
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

  const handleSelectCommunityPlaylist = (playlist: CommunityPlaylist) => {
    audioManager.play('menuSelect');
    setSelectedCommunityPlaylist(playlist);
    setSelectedPlaylist(null);
    
    // Converter estrutura de community playlist para Playlist
    const playlistData: Playlist = {
      name: playlist.name,
      description: playlist.description,
      scenarios: playlist.scenarios,
      randomizeOrder: playlist.randomizeOrder || false
    };
    
    setPlaylistData(playlistData);
    
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
  };

  const handleTabChange = (tab: TabType) => {
    if (tab === currentTab) return;
    
    audioManager.play('menuSelect');
    setCurrentTab(tab);
    setSelectedPlaylist(null);
    setSelectedCommunityPlaylist(null);
    setPlaylistData(null);
  };

  const handleStartPlaylist = () => {
    if (!playlistData) return;
    
    // Validar se o jogador tem nickname
    if (!userProfile || !userProfile.nickname || userProfile.nickname.trim().length === 0) {
      audioManager.play('menuBack');
      setShowAuthModal(true);
      return;
    }
    
    audioManager.play('menuSelect');
    // Navegar para página de jogo com dados da playlist
    const state: any = { 
      playlist: playlistData, 
      mode: 'playlist'
    };
    
    // Se for playlist da comunidade, passar ID para salvar ranking separadamente
    if (selectedCommunityPlaylist) {
      state.communityPlaylistId = selectedCommunityPlaylist.id;
    }
    
    navigate('/game', { state });
  };

  const handleLikePlaylist = async (playlistId: string, type: 'like' | 'dislike') => {
    if (!userProfile) {
      setShowAuthModal(true);
      return;
    }

    // Verificar se é usuário guest
    if (userProfile.isGuest) {
      audioManager.play('menuBack');
      alert(t('playlists.guestCantLike'));
      return;
    }

    console.log('Attempting to like playlist:', { playlistId, userId: userProfile.uid, type, isGuest: userProfile.isGuest });

    try {
      await likePlaylist(playlistId, userProfile.uid, type);
      
      // Atualizar estado local
      const currentLike = userLikes.get(playlistId);
      const newLikes = new Map(userLikes);
      
      if (currentLike === type) {
        // Toggle - remover like
        newLikes.delete(playlistId);
      } else {
        // Adicionar ou trocar like
        newLikes.set(playlistId, type);
      }
      
      setUserLikes(newLikes);
      
      // Recarregar playlists para atualizar contadores
      await loadCommunityPlaylists();
      
      console.log('Like successful');
    } catch (error: any) {
      console.error('Error liking playlist:', error);
      console.error('Error details:', error.code, error.message);
      audioManager.play('menuBack');
      alert(error.message || t('playlists.likeError'));
    }
  };

  const handleDeletePlaylist = async () => {
    if (!selectedCommunityPlaylist || !userProfile) return;

    if (!confirm(t('playlists.confirmDelete'))) {
      return;
    }

    try {
      const { deleteCommunityPlaylist } = await import('../community-playlists');
      await deleteCommunityPlaylist(selectedCommunityPlaylist.id, userProfile.uid);
      
      // Limpar seleção e recarregar lista
      setSelectedCommunityPlaylist(null);
      setPlaylistData(null);
      await loadCommunityPlaylists();
      
      audioManager.play('menuBack');
    } catch (error: any) {
      console.error('Error deleting playlist:', error);
      alert(error.message || t('playlists.deleteError'));
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

        // Validar se o jogador tem nickname antes de navegar
        if (!userProfile || !userProfile.nickname || userProfile.nickname.trim().length === 0) {
          audioManager.play('menuBack');
          setShowAuthModal(true);
          e.target.value = '';
          return;
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
      {showAuthModal && (
        <AuthModal 
          onClose={() => setShowAuthModal(false)} 
          allowGuest={true}
        />
      )}
      
      <div className="playlists-container-wrapper" ref={containerRef}>
        <div className="playlists-header">
          <h2>
            <i className="fas fa-list"></i> {t('playlists.title')}
          </h2>
          <div className="playlists-header-actions">
            {userProfile && (
              <div className="user-info">
                <i className={userProfile.isGuest ? "fas fa-user" : "fas fa-user-circle"}></i>
                <span>{userProfile.nickname}</span>
              </div>
            )}
            {!userProfile && (
              <button className="btn-login" onClick={() => setShowAuthModal(true)}>
                <i className="fas fa-sign-in-alt"></i> {t('auth.login')}
              </button>
            )}
            <button className="btn-back-secondary" onClick={handleBack}>
              <i className="fas fa-arrow-left"></i> {t('playlists.back')}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="playlists-tabs">
          <button 
            className={`tab ${currentTab === 'official' ? 'active' : ''}`}
            onClick={() => handleTabChange('official')}
          >
            <i className="fas fa-star"></i> {t('playlists.official')}
          </button>
          <button 
            className={`tab ${currentTab === 'community' ? 'active' : ''}`}
            onClick={() => handleTabChange('community')}
          >
            <i className="fas fa-users"></i> {t('playlists.community')}
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
              {currentTab === 'official' ? (
                <>
                  <div className="playlists-list">
                    {AVAILABLE_PLAYLISTS.map((playlist) => (
                      <PlaylistItem
                        key={playlist.file}
                        playlist={playlist}
                        isSelected={selectedPlaylist?.file === playlist.file}
                        rankPosition={officialPlaylistRanks.get(playlist.name)}
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
                </>
              ) : (
                <>
                  <div className="community-sort">
                    <label>{t('playlists.sortBy')}</label>
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value as PlaylistSortBy)}>
                      <option value="recent">{t('playlists.sortRecent')}</option>
                      <option value="trending">{t('playlists.sortTrending')}</option>
                      <option value="plays">{t('playlists.sortPlays')}</option>
                      <option value="likes">{t('playlists.sortLikes')}</option>
                      <option value="name">{t('playlists.sortName')}</option>
                    </select>
                  </div>
                  
                  <div className="playlists-list">
                    {loading ? (
                      <div className="loading-message">{t('playlists.loading')}</div>
                    ) : communityPlaylists.length === 0 ? (
                      <div className="empty-message">{t('playlists.noCommunityPlaylists')}</div>
                    ) : (
                      communityPlaylists.map((playlist) => {
                        const rankPosition = communityPlaylistRanks.get(playlist.id);
                        return (
                        <div 
                          key={playlist.id}
                          className={`community-playlist-item ${selectedCommunityPlaylist?.id === playlist.id ? 'selected' : ''} ${rankPosition ? 'completed' : ''}`}
                          onClick={() => handleSelectCommunityPlaylist(playlist)}
                        >
                          <div className="playlist-header">
                            <i className="fas fa-list-ul"></i>
                            <span className="playlist-name">
                              {playlist.name}
                              {rankPosition && (
                                <span className={`rank-badge ${rankPosition <= 3 ? 'top-3' : ''} ${rankPosition === 1 ? 'gold' : rankPosition === 2 ? 'silver' : rankPosition === 3 ? 'bronze' : ''}`}>
                                  #{rankPosition}
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="playlist-meta">
                            <span className="author">
                              <i className="fas fa-user"></i> {playlist.authorNickname}
                            </span>
                            <div className="stats">
                              <span className="likes">
                                <i className="fas fa-heart"></i> {playlist.likes}
                              </span>
                              <span className="plays">
                                <i className="fas fa-play"></i> {playlist.plays}
                              </span>
                            </div>
                          </div>
                        </div>
                      );})
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Details panel */}
          <PlaylistDetails
            playlist={selectedPlaylist}
            communityPlaylist={selectedCommunityPlaylist}
            playlistData={playlistData}
            onStartPlaylist={handleStartPlaylist}
            onLike={selectedCommunityPlaylist ? () => handleLikePlaylist(selectedCommunityPlaylist.id, 'like') : undefined}
            onDislike={selectedCommunityPlaylist ? () => handleLikePlaylist(selectedCommunityPlaylist.id, 'dislike') : undefined}
            userLike={selectedCommunityPlaylist ? userLikes.get(selectedCommunityPlaylist.id) : undefined}
            onDelete={selectedCommunityPlaylist ? handleDeletePlaylist : undefined}
          />
        </div>
      </div>
    </div>
  );
}

export default PlaylistsPage;
