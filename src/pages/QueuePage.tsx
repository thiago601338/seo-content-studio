import { Cloud, ExternalLink, Globe2, Pause, Play, RefreshCw, RotateCcw, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import type { ArticleRecord, Site } from '../lib/types';

function badgeClass(status: ArticleRecord['status']) {
  if (status === 'completed') return 'green';
  if (status === 'error' || status === 'cancelled') return 'red';
  if (status === 'processing') return 'blue';
  if (status === 'paused') return 'orange';
  return '';
}

export function QueuePage() {
  const [articles, setArticles] = useState<ArticleRecord[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [siteChoice, setSiteChoice] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    const [{ data }, { data: siteData }] = await Promise.all([
      supabase.from('articles').select('*, sites(name, base_url)').order('created_at', { ascending: false }).limit(1000),
      supabase.from('sites').select('*').eq('active', true).order('name'),
    ]);
    setArticles((data || []) as ArticleRecord[]);
    setSites((siteData || []) as Site[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const channel = supabase.channel('article-queue').on('postgres_changes', { event: '*', schema: 'public', table: 'articles' }, () => load()).subscribe();
    const timer = window.setInterval(load, 5000);
    return () => { supabase.removeChannel(channel); window.clearInterval(timer); };
  }, []);

  const visible = useMemo(() => articles.filter((a) => !search || `${a.keyword} ${a.generated_title || ''} ${a.sites?.name || ''}`.toLowerCase().includes(search.toLowerCase())), [articles, search]);
  const queuedOrder = useMemo(() => [...articles].filter((a) => a.status === 'queued').sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()), [articles]);
  const queuedPosition = useMemo(() => new Map(queuedOrder.map((a, index) => [a.id, index + 1])), [queuedOrder]);
  const counts = useMemo(() => ({
    queued: articles.filter((a) => a.status === 'queued').length,
    processing: articles.filter((a) => a.status === 'processing').length,
    paused: articles.filter((a) => a.status === 'paused').length,
    error: articles.filter((a) => a.status === 'error').length,
  }), [articles]);

  async function control(article: ArticleRecord, action: 'pause' | 'resume') {
    setBusy(`${article.id}:${action}`); setMessage('');
    try {
      await api('/api/article-control', { article_id: article.id, action });
      setMessage(action === 'pause' ? 'Geracao pausada. O item que ja estava sendo processado pode terminar a chamada atual da IA, mas nenhum novo resultado sera salvo depois da pausa.' : 'Geracao retomada e devolvida para a fila.');
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(''); }
  }

  async function controlAll(action: 'pause_all' | 'resume_all') {
    setBusy(action); setMessage('');
    try {
      const result = await api<{ count: number }>('/api/article-control', { action });
      setMessage(action === 'pause_all' ? `${result.count || 0} item(ns) pausado(s).` : `${result.count || 0} item(ns) retomado(s).`);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(''); }
  }

  async function retry(article: ArticleRecord) {
    await control(article, 'resume');
  }


  async function publish(article: ArticleRecord) {
    const siteId = siteChoice[article.id] || article.site_id || sites[0]?.id || '';
    if (!siteId) { setMessage('Cadastre ou selecione um site WordPress para publicar.'); return; }
    setBusy(`${article.id}:wp`); setMessage('');
    try {
      const result = await api<{ wordpress: { id: number; url: string; status?: string } }>('/api/export-article', { article_id: article.id, destination: 'wordpress', site_id: siteId });
      const publishedUrl = result.wordpress?.url || '';
      setArticles((all) => all.map((item) => item.id === article.id ? { ...item, site_id: siteId, wp_post_id: result.wordpress?.id || item.wp_post_id, wp_post_url: publishedUrl || item.wp_post_url } : item));
      setMessage(publishedUrl ? `Publicado. O link ja esta disponivel na coluna Publicacao: ${publishedUrl}` : 'Publicado no WordPress.');
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(''); }
  }

  async function remove(article: ArticleRecord) {
    if (!window.confirm('Excluir este artigo da fila, do historico e da aba Textos? Posts ja publicados e documentos do Drive nao serao apagados.')) return;
    setBusy(`${article.id}:delete`); setMessage('');
    try {
      await api('/api/delete-articles', { article_id: article.id });
      setMessage('Registro excluido.');
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(''); }
  }

  return (
    <div className="page-wrap">
      <header className="page-header"><div><span className="eyebrow">Operacao</span><h1>Fila e historico</h1><p>As geracoes em andamento, em fila e pausadas ficam salvas aqui mesmo se voce fechar ou atualizar a pagina.</p></div><div className="header-actions"><button className="btn ghost" onClick={load}><RefreshCw size={16} /> Atualizar</button></div></header>
      {message && <div className="alert">{message}</div>}

      <div className="queue-summary">
        <div><b>{counts.processing}</b><span>Em andamento</span></div>
        <div><b>{counts.queued}</b><span>Na fila</span></div>
        <div><b>{counts.paused}</b><span>Pausados</span></div>
        <div><b>{counts.error}</b><span>Com erro</span></div>
        <div className="queue-summary-actions">
          <button className="btn ghost small" disabled={!counts.processing && !counts.queued || busy === 'pause_all'} onClick={() => controlAll('pause_all')}><Pause size={15} /> {busy === 'pause_all' ? 'Pausando...' : 'Pausar ativos'}</button>
          <button className="btn ghost small" disabled={!counts.paused || busy === 'resume_all'} onClick={() => controlAll('resume_all')}><Play size={15} /> {busy === 'resume_all' ? 'Retomando...' : 'Retomar pausados'}</button>
        </div>
      </div>

      <section className="panel">
        <div className="toolbar"><label className="search-box"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por palavra-chave, titulo ou site" /></label><span className="muted">{visible.length} registro(s)</span></div>
        <div className="queue-table-wrap">
          <table className="queue-table">
            <thead><tr><th>Artigo</th><th>Site</th><th>Publicacao</th><th>Drive</th><th>Status</th><th>Progresso</th><th>Agendamento</th><th>Acoes</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={8}>Carregando...</td></tr>}
              {!loading && !visible.length && <tr><td colSpan={8}>Nenhum artigo encontrado.</td></tr>}
              {visible.map((article) => (
                <tr key={article.id}>
                  <td><strong>{article.generated_title || article.keyword || 'Sem titulo'}</strong><small>{article.keyword}</small>{article.error && <em className="error-text">{article.error}</em>}</td>
                  <td>{article.sites?.name || (article.publish_to_wordpress ? 'Site pendente' : 'Somente texto')}</td>
                  <td>{article.wp_post_url ? <a className="destination-link" href={article.wp_post_url} target="_blank" rel="noreferrer"><Globe2 size={14} /> Ver publicacao <ExternalLink size={12} /></a> : article.generated_html && ['completed', 'error'].includes(article.status) ? <div className="publish-inline"><select value={siteChoice[article.id] || article.site_id || sites[0]?.id || ''} onChange={(e) => setSiteChoice((all) => ({ ...all, [article.id]: e.target.value }))}><option value="">Escolher site</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select><button className="btn small ghost" disabled={busy === `${article.id}:wp`} onClick={() => publish(article)}>{busy === `${article.id}:wp` ? 'Publicando...' : 'Publicar'}</button></div> : '-'}</td>
                  <td>{article.drive_doc_url ? <a className="destination-link drive" href={article.drive_doc_url} target="_blank" rel="noreferrer"><Cloud size={14} /> Abrir</a> : '-'}</td>
                  <td><span className={`badge ${badgeClass(article.status)}`}>{article.progress_label || article.status}</span>{article.status === 'queued' && <small>Posicao {queuedPosition.get(article.id) || '-'}</small>}</td>
                  <td><div className="progress"><span style={{ width: `${article.progress}%` }} /></div><small>{article.progress}%</small></td>
                  <td>{article.scheduled_at ? new Date(article.scheduled_at).toLocaleString('pt-BR') : '-'}</td>
                  <td><div className="table-actions">
                    {article.wp_post_url && <a className="icon-btn" href={article.wp_post_url} target="_blank" rel="noreferrer" title="Abrir post"><ExternalLink size={16} /></a>}
                    {['queued', 'processing'].includes(article.status) && <button className="icon-btn" disabled={busy === `${article.id}:pause`} onClick={() => control(article, 'pause')} title="Pausar"><Pause size={16} /></button>}
                    {article.status === 'paused' && <button className="icon-btn" disabled={busy === `${article.id}:resume`} onClick={() => control(article, 'resume')} title="Retomar"><Play size={16} /></button>}
                    {article.status === 'error' && <button className="icon-btn" disabled={busy === `${article.id}:resume`} onClick={() => retry(article)} title="Tentar novamente"><RotateCcw size={16} /></button>}
                    <button className="icon-btn danger" disabled={busy === `${article.id}:delete`} onClick={() => remove(article)} title="Excluir"><Trash2 size={16} /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
