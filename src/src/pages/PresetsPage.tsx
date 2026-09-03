import { Copy, FileText, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

type Preset = { id: string; name: string; config: Record<string, any>; created_at: string };

export function PresetsPage() {
  const { user } = useAuth();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [name, setName] = useState('');
  const [configText, setConfigText] = useState(JSON.stringify({ tone: 'editorial', word_count: 800, body_images: 2 }, null, 2));
  const [message, setMessage] = useState('');
  async function load() { const { data } = await supabase.from('presets').select('*').order('created_at', { ascending: false }); setPresets((data || []) as Preset[]); }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!user || !name.trim()) return;
    try {
      const config = JSON.parse(configText);
      const { error } = await supabase.from('presets').insert({ user_id: user.id, name: name.trim(), config });
      if (error) throw error; setName(''); setMessage('Modelo salvo.'); load();
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  }
  async function remove(id: string) { await supabase.from('presets').delete().eq('id', id); load(); }

  return <div className="page-wrap"><header className="page-header"><div><span className="eyebrow"><FileText size={14} /> Presets</span><h1>Modelos de configuracao</h1><p>Guarde configuracoes recorrentes para diferentes tipos de artigo e clientes.</p></div></header><div className="sites-layout"><section className="panel site-form"><div className="panel-static-title"><strong>Novo modelo</strong><Plus size={18} /></div><label className="field"><span>Nome</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest post 800 palavras" /></label><label className="field"><span>Configuracao JSON</span><textarea rows={18} className="code-textarea" value={configText} onChange={(e) => setConfigText(e.target.value)} /></label>{message && <div className="mini-alert">{message}</div>}<button className="btn primary full" onClick={save}><Save size={16} /> Salvar modelo</button></section><div className="site-cards">{presets.map((preset) => <article className="panel preset-card" key={preset.id}><div><strong>{preset.name}</strong><small>{new Date(preset.created_at).toLocaleString('pt-BR')}</small></div><pre>{JSON.stringify(preset.config, null, 2)}</pre><div className="site-actions"><button className="btn ghost small" onClick={() => { navigator.clipboard.writeText(JSON.stringify(preset.config)); setMessage('Configuracao copiada.'); }}><Copy size={14} /> Copiar</button><button className="btn ghost small danger-text" onClick={() => remove(preset.id)}><Trash2 size={14} /> Excluir</button></div></article>)}</div></div></div>;
}
