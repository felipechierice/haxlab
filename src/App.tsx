import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import HomePage from './pages/HomePage';
import GameModesPage from './pages/GameModesPage';
import PlaylistsPage from './pages/PlaylistsPage';
import SettingsPage from './pages/SettingsPage';
import AppSettingsPage from './pages/AppSettingsPage';
import GamePage from './pages/GamePage';
import CreditsPage from './pages/CreditsPage';
import ChangelogsPage from './pages/ChangelogsPage';
import { extrapolation } from './extrapolation';
import { checkVersionAndResetIfNeeded } from './version';

function App() {
  // Verificar versão e resetar configs se necessário, depois inicializar extrapolation
  useEffect(() => {
    // Verifica se a versão mudou - se sim, configs já foram resetadas
    checkVersionAndResetIfNeeded();
    
    // Inicializar extrapolation do localStorage (pode estar vazio se foi resetado)
    const savedExtrapolation = localStorage.getItem('extrapolation');
    if (savedExtrapolation) {
      extrapolation.setExtrapolation(parseInt(savedExtrapolation));
    }
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/modes" element={<GameModesPage />} />
        <Route path="/playlists" element={<PlaylistsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/app-settings" element={<AppSettingsPage />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="/credits" element={<CreditsPage />} />
        <Route path="/changelogs" element={<ChangelogsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
