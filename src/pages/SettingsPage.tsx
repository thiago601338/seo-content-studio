import { Cloud, KeyRound, Link2, Server, ShieldCheck, Unplug } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { DriveStatus } from '../lib/types';

export function SettingsPage() {
  const [drive, setDrive] = useState<DriveStatus>({ connected: false, email: null, display_name: null });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadDrive() {
    try {
      const data = await api<DriveStatus>('/api/google-drive-status', undefined, 'GET');
      setDrive(data);
    } catch {
      setDrive({ connected: false, email: null, display_name: null });
    }
  }

  useEffect(() => {
    loadDrive();
    const params = new URLSearchParams(window.location.search);
    if (params.get('drive') === 'connected') setMessage('Google Drive conectado com sucesso.');
    if (params.get('drive') === 'error') setMessage(params.get('message') || 'Falha ao conectar o Google Drive.');
  }, []);

  async function connectDrive() {
    setBusy(true); setMessage('');
    try {
      const { url } = await api<{ url: string }>('/api/google-drive-auth-start');
      window.location.href = url;
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); setBusy(false); }
  }

  async function disconnectDrive() {
    if (!window.confirm('Desconectar o Google Drive desta aplicacao?')) return;
    setBusy(true); setMessage('');
    try { await api('/api/google-drive-settings', undefined, 'DELETE'); setMessage('Google Drive desconectado.'); await loadDrive(); }
    catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }

  return (
    <div className="page-wrap">
      <header className="page-header"><div><span className="eyebrow">Infraestrutura</span><h1>Configuracoes</h1><p>Conecte servicos e mantenha as chaves sensiveis somente no backend do Netlify.</p></div></header>
      {message && <div className="alert">{message}</div>}

      <section className="panel drive-panel">
        <div className="drive-panel-main"><span className="info-icon"><Cloud /></span><div><h2>Google Drive</h2><p>Opcional. Quando ativado em uma geracao, o sistema cria um Google Doc com o texto, capa e imagens internas e libera o documento para qualquer pessoa com o link.</p>{drive.connected ? <strong>Conectado: {drive.email || drive.display_name || 'Conta Google'}</strong> : <strong>Drive ainda nao conectado.</strong>}</div></div>
        <div className="drive-panel-actions">{!drive.connected ? <button className="btn dark" disabled={busy} onClick={connectDrive}><Link2 size={16} /> Conectar Google Drive</button> : <><span className="drive-connected-note">Novos documentos serao criados no Meu Drive.</span><button className="btn ghost danger-text" disabled={busy} onClick={disconnectDrive}><Unplug size={16} /> Desconectar</button></>}</div>
      </section>

      <div className="settings-info-grid">
        <section className="panel info-panel"><span className="info-icon"><KeyRound /></span><h2>OpenAI</h2><p>Configure <code>OPENAI_API_KEY</code>, <code>OPENAI_TEXT_MODEL</code> e <code>OPENAI_IMAGE_MODEL</code> nas variaveis de ambiente do Netlify.</p><strong>Padrao recomendado</strong><small>gpt-5.6-terra para texto e gpt-image-2 para imagens.</small></section>
        <section className="panel info-panel"><span className="info-icon"><Server /></span><h2>Supabase</h2><p>O navegador usa somente a publishable key. A secret key fica restrita as Netlify Functions.</p><strong>Banco</strong><small>Execute as migrations 001_init.sql e 002_texts_drive_destinations.sql.</small></section>
        <section className="panel info-panel"><span className="info-icon"><ShieldCheck /></span><h2>Seguranca</h2><p>Application Passwords do WordPress e tokens OAuth do Google Drive sao criptografados com AES-256-GCM antes de serem salvos.</p><strong>Importante</strong><small>Nao altere SITES_ENCRYPTION_KEY sem migrar as credenciais existentes.</small></section>
      </div>
      <section className="panel env-panel"><h2>Variaveis necessarias no Netlify</h2><pre>{`VITE_SUPABASE_URL=...\nVITE_SUPABASE_PUBLISHABLE_KEY=...\nSUPABASE_URL=...\nSUPABASE_SECRET_KEY=...\nOPENAI_API_KEY=...\nOPENAI_TEXT_MODEL=gpt-5.6-terra\nOPENAI_IMAGE_MODEL=gpt-image-2\nSITES_ENCRYPTION_KEY=...\nINTERNAL_DISPATCH_SECRET=...\nAPP_URL=https://seu-app.netlify.app\nGOOGLE_CLIENT_ID=...\nGOOGLE_CLIENT_SECRET=...`}</pre></section>
    </div>
  );
}
