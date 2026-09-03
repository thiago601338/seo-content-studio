import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { PresetsPage } from './pages/PresetsPage';
import { QueuePage } from './pages/QueuePage';
import { SettingsPage } from './pages/SettingsPage';
import { SitesPage } from './pages/SitesPage';
import { TextsPage } from './pages/TextsPage';
import { WriterPage } from './pages/WriterPage';

export function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="boot-screen">Carregando Revista Ideal IA Studio...</div>;
  if (!user) return <LoginPage />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<WriterPage />} />
        <Route path="textos" element={<TextsPage />} />
        <Route path="fila" element={<QueuePage />} />
        <Route path="sites" element={<SitesPage />} />
        <Route path="modelos" element={<PresetsPage />} />
        <Route path="configuracoes" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
