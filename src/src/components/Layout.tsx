import { FileText, Files, Globe2, History, LogOut, Settings, Sparkles, WandSparkles } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const nav = [
  { to: '/', label: 'Gerar artigos', icon: WandSparkles },
  { to: '/textos', label: 'Textos', icon: Files },
  { to: '/fila', label: 'Fila e historico', icon: History },
  { to: '/sites', label: 'Sites WordPress', icon: Globe2 },
  { to: '/modelos', label: 'Modelos', icon: FileText },
  { to: '/configuracoes', label: 'Configuracoes', icon: Settings },
];

export function Layout() {
  const { user, signOut } = useAuth();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><Sparkles size={20} /></span>
          <span><b>Revista Ideal</b><small>IA Studio</small></span>
        </div>
        <nav className="side-nav">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'active' : ''}>
              <Icon size={18} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-card"><small>Conectado como</small><span>{user?.email}</span></div>
          <button type="button" className="side-logout" onClick={() => signOut()}><LogOut size={17} /> Sair</button>
        </div>
      </aside>
      <main className="main"><Outlet /></main>
    </div>
  );
}
