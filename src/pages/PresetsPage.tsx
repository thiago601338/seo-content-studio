import { Copy, Layers3, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { WriterConfig } from '../lib/types';
import { normalizeWriterConfig, profileSummary, readLocalWriterConfig, toProfileConfig } from '../lib/writerConfig';

type ConfigProfile = {
  id: string;
  user_id: string;
  name: string;
  config: Partial<WriterConfig>;
  created_at: string;
  updated_at?: string;
};

export function PresetsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<ConfigProfile[]>([]);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const activeProfileId = useMemo(() => localStorage.getItem('ri-writer-profile-id') || '', [profiles]);

  async function load() {
    const { data, error } = await supabase.from('presets').select('*').order('name');
    if (error) { setMessage(error.message); return; }
    setProfiles((data || []) as ConfigProfile[]);
  }

  useEffect(() => { load(); }, [user?.id]);

  async function createFromCurrent() {
    if (!user) return;
    const cleanName = name.trim();
    if (!cleanName) { setMessage('Digite um nome para o perfil.'); return; }
    const config = toProfileConfig(readLocalWriterConfig());
    const { data, error } = await supabase.from('presets').insert({ user_id: user.id, name: cleanName, config }).select('*').single();
    if (error || !data) { setMessage(error?.message || 'Nao foi possivel criar o perfil.'); return; }
    localStorage.setItem('ri-writer-profile-id', data.id);
    setName('');
    setMessage(`Perfil ${data.name} criado. Ele ja esta selecionado no gerador.`);
    await load();
  }

  function useProfile(profile: ConfigProfile) {
    const config = normalizeWriterConfig(profile.config);
    localStorage.setItem('ri-writer-profile-id', profile.id);
    localStorage.setItem('ri-writer-config', JSON.stringify(config));
    navigate('/');
  }

  async function duplicate(profile: ConfigProfile) {
    if (!user) return;
    const base = `${profile.name} - copia`;
    let candidate = base;
    let index = 2;
    const names = new Set(profiles.map((item) => item.name.toLowerCase()));
    while (names.has(candidate.toLowerCase())) { candidate = `${base} ${index}`; index += 1; }
    const { data, error } = await supabase.from('presets').insert({ user_id: user.id, name: candidate, config: toProfileConfig(normalizeWriterConfig(profile.config)) }).select('*').single();
    if (error || !data) { setMessage(error?.message || 'Nao foi possivel duplicar o perfil.'); return; }
    setMessage(`Perfil duplicado como ${candidate}.`);
    await load();
  }

  async function rename(profile: ConfigProfile) {
    const next = window.prompt('Novo nome do perfil:', profile.name)?.trim();
    if (!next || next === profile.name) return;
    const { error } = await supabase.from('presets').update({ name: next, updated_at: new Date().toISOString() }).eq('id', profile.id);
    if (error) { setMessage(error.message); return; }
    setMessage('Perfil renomeado.');
    await load();
  }

  async function remove(profile: ConfigProfile) {
    if (!window.confirm(`Excluir o perfil "${profile.name}"? Os textos ja gerados nao serao apagados.`)) return;
    const { error } = await supabase.from('presets').delete().eq('id', profile.id);
    if (error) { setMessage(error.message); return; }
    if (localStorage.getItem('ri-writer-profile-id') === profile.id) localStorage.removeItem('ri-writer-profile-id');
    setMessage('Perfil excluido.');
    await load();
  }

  return (
    <div className="page-wrap">
      <header className="page-header">
        <div>
          <span className="eyebrow"><Layers3 size={14} /> Perfis</span>
          <h1>Perfis de configuracao</h1>
          <p>Crie configuracoes diferentes para clientes, tipos de texto, imagens e destinos. Ao escolher um perfil no gerador, tudo e aplicado automaticamente.</p>
        </div>
      </header>

      <section className="panel profile-create-panel">
        <div className="profile-create-copy">
          <span className="profile-selector-icon"><Sparkles size={20} /></span>
          <div><strong>Criar perfil com a configuracao atual</strong><small>Usa as preferencias que estao salvas atualmente no Gerador de artigos. Depois, ao editar configuracoes com esse perfil ativo, ele e atualizado automaticamente.</small></div>
        </div>
        <div className="profile-create-controls">
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') createFromCurrent(); }} placeholder="Ex.: Blog SEO 800 palavras" />
          <button className="btn primary" type="button" onClick={createFromCurrent}><Plus size={16} /> Criar perfil</button>
        </div>
      </section>

      {message && <div className="mini-alert profile-page-message">{message}</div>}

      {!profiles.length ? (
        <section className="panel empty-card"><Layers3 size={32} /><strong>Nenhum perfil criado</strong><p>Configure o gerador como quiser e salve seu primeiro perfil.</p></section>
      ) : (
        <div className="profile-grid">
          {profiles.map((profile) => {
            const summary = profileSummary(profile.config);
            const active = profile.id === activeProfileId;
            return (
              <article className={`panel config-profile-card ${active ? 'active' : ''}`} key={profile.id}>
                <div className="config-profile-top">
                  <div><span className="profile-card-icon"><Layers3 size={17} /></span><div><strong>{profile.name}</strong><small>{active ? 'Perfil ativo no gerador' : `Atualizado ${new Date(profile.updated_at || profile.created_at).toLocaleString('pt-BR')}`}</small></div></div>
                  {active && <span className="badge green">ATIVO</span>}
                </div>
                <div className="profile-summary-grid">
                  <span><small>Palavras</small><b>{summary.words}</b></span>
                  <span><small>Tom</small><b>{summary.tone}</b></span>
                  <span><small>Tipo</small><b>{summary.type}</b></span>
                  <span><small>Imagens</small><b>{summary.images}</b></span>
                  <span><small>Destino</small><b>{summary.destinations}</b></span>
                  <span><small>Modelo</small><b>{summary.model}</b></span>
                </div>
                <div className="profile-card-actions">
                  <button className="btn dark small" type="button" onClick={() => useProfile(profile)}><Sparkles size={14} /> Usar e editar</button>
                  <button className="btn ghost small" type="button" onClick={() => duplicate(profile)}><Copy size={14} /> Duplicar</button>
                  <button className="btn ghost small" type="button" onClick={() => rename(profile)}><Pencil size={14} /> Renomear</button>
                  <button className="btn ghost small danger-text" type="button" onClick={() => remove(profile)}><Trash2 size={14} /> Excluir</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
