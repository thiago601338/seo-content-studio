import { CheckCircle2, Globe2, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import type { Site } from '../lib/types';

type FormState = { id?: string; name: string; base_url: string; wp_username: string; app_password: string; default_category_id: number | ''; default_author_id: number | '' };
const empty: FormState = { name: '', base_url: 'https://', wp_username: '', app_password: '', default_category_id: '', default_author_id: '' };

export function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function load() { const { data } = await supabase.from('sites').select('*').order('name'); setSites((data || []) as Site[]); }
  useEffect(() => { load(); }, []);

  function edit(site: Site) {
    setForm({ id: site.id, name: site.name, base_url: site.base_url, wp_username: site.wp_username, app_password: '', default_category_id: site.default_category_id || '', default_author_id: site.default_author_id || '' });
    setMessage(''); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage('Testando conexao com o WordPress...');
    try {
      const { site } = await api<{ site: Site }>('/api/site-save', form);
      setMessage(`Conectado com sucesso a ${site.name}.`); setForm(empty); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setSaving(false); }
  }

  async function test(site: Site) {
    setMessage(`Atualizando dados de ${site.name}...`);
    try { await api('/api/site-test', { id: site.id }); setMessage('Conexao validada e categorias/autores atualizados.'); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  }

  async function remove(site: Site) {
    if (!window.confirm(`Remover ${site.name} da aplicacao?`)) return;
    const { error } = await supabase.from('sites').delete().eq('id', site.id);
    setMessage(error ? error.message : 'Site removido.'); load();
  }

  return (
    <div className="page-wrap">
      <header className="page-header"><div><span className="eyebrow"><Globe2 size={14} /> Integracoes</span><h1>Sites WordPress</h1><p>Conecte um ou varios portais usando REST API + Application Password.</p></div><button className="btn ghost" onClick={() => setForm(empty)}><Plus size={16} /> Novo site</button></header>
      <div className="sites-layout">
        <form className="panel site-form" onSubmit={save}>
          <div className="panel-static-title"><strong>{form.id ? 'Editar conexao' : 'Adicionar WordPress'}</strong>{form.id && <button type="button" className="icon-btn" onClick={() => setForm(empty)}><X size={16} /></button>}</div>
          <label className="field"><span>Nome interno</span><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Revista Ideal" /></label>
          <label className="field"><span>URL do site</span><input required type="url" value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} placeholder="https://revistaideal.com.br" /></label>
          <label className="field"><span>Usuario WordPress</span><input required value={form.wp_username} onChange={(e) => setForm({ ...form, wp_username: e.target.value })} /></label>
          <label className="field"><span>Application Password</span><input type="password" required={!form.id} value={form.app_password} onChange={(e) => setForm({ ...form, app_password: e.target.value })} placeholder={form.id ? 'deixe vazio para manter a atual' : 'xxxx xxxx xxxx xxxx xxxx xxxx'} /><small>Crie em WordPress → Usuarios → Perfil → Senhas de aplicacao.</small></label>
          {form.id && <><label className="field"><span>Categoria padrao</span><select value={form.default_category_id} onChange={(e) => setForm({ ...form, default_category_id: e.target.value ? Number(e.target.value) : '' })}><option value="">Sem padrao</option>{sites.find((s) => s.id === form.id)?.metadata?.categories?.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label><label className="field"><span>Autor padrao</span><select value={form.default_author_id} onChange={(e) => setForm({ ...form, default_author_id: e.target.value ? Number(e.target.value) : '' })}><option value="">Usuario da conexao</option>{sites.find((s) => s.id === form.id)?.metadata?.authors?.map((a) => <option value={a.id} key={a.id}>{a.name}</option>)}</select></label></>}
          {message && <div className="mini-alert">{message}</div>}
          <button className="btn primary full" disabled={saving}><Save size={16} /> {saving ? 'Validando...' : 'Salvar e testar conexao'}</button>
        </form>

        <div className="site-cards">
          {!sites.length && <div className="panel empty-card"><Globe2 size={38} /><strong>Nenhum site cadastrado</strong><p>Adicione o primeiro WordPress ao lado.</p></div>}
          {sites.map((site) => <article className="panel site-card" key={site.id}>
            <div className="site-card-top"><span className="site-icon"><Globe2 size={20} /></span><div><strong>{site.name}</strong><a href={site.base_url} target="_blank" rel="noreferrer">{site.base_url}</a></div><span className="badge green"><CheckCircle2 size={13} /> Ativo</span></div>
            <div className="site-stats"><span><b>{site.metadata?.categories?.length || 0}</b><small>Categorias</small></span><span><b>{site.metadata?.authors?.length || 0}</b><small>Autores</small></span><span><b>{site.metadata?.connector ? 'Sim' : 'Nao'}</b><small>Connector SEO</small></span></div>
            <div className="site-actions"><button className="btn ghost small" onClick={() => edit(site)}>Editar</button><button className="btn ghost small" onClick={() => test(site)}><RefreshCw size={14} /> Sincronizar</button><button className="btn ghost small danger-text" onClick={() => remove(site)}><Trash2 size={14} /> Remover</button></div>
          </article>)}
        </div>
      </div>
    </div>
  );
}
