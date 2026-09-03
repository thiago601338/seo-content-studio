import { Cloud, Copy, Download, ExternalLink, FileText, Globe2, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import type { ArticleRecord, DriveStatus, Site } from '../lib/types';

function stripHtml(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char] || char));
}

function articleDocumentHtml(article: ArticleRecord) {
  const title = article.generated_title || article.keyword || 'Artigo';
  const cover = article.cover_image_url ? `<figure><img src="${escapeHtml(article.cover_image_url)}" alt="${escapeHtml(title)}" /></figure>` : '';
  const excerpt = article.excerpt ? `<p><em>${escapeHtml(article.excerpt)}</em></p>` : '';
  return `<h1>${escapeHtml(title)}</h1>${cover}${excerpt}${article.generated_html || ''}`;
}

function wordCount(article: ArticleRecord) {
  return stripHtml(article.generated_html || '').trim().split(/\s+/).filter(Boolean).length;
}

export function TextsPage() {
  const [articles, setArticles] = useState<ArticleRecord[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [drive, setDrive] = useState<DriveStatus>({ connected: false, email: null, display_name: null });
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<ArticleRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [siteChoice, setSiteChoice] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    const [{ data }, { data: siteData }] = await Promise.all([
      supabase.from('articles').select('*, sites(name, base_url)').not('generated_html', 'is', null).order('created_at', { ascending: false }).limit(1000),
      supabase.from('sites').select('*').eq('active', true).order('name'),
    ]);
    setArticles((data || []) as ArticleRecord[]);
    setSites((siteData || []) as Site[]);
    try { setDrive(await api<DriveStatus>('/api/google-drive-status', undefined, 'GET')); } catch { setDrive({ connected: false, email: null, display_name: null }); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => articles.filter((a) => !search || `${a.generated_title || ''} ${a.keyword || ''}`.toLowerCase().includes(search.toLowerCase())), [articles, search]);

  async function sendDrive(article: ArticleRecord) {
    setBusy(`${article.id}:drive`); setMessage('');
    try {
      await api('/api/export-article', { article_id: article.id, destination: 'drive' });
      setMessage('Google Doc criado e liberado para qualquer pessoa com o link.');
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(''); }
  }

  async function sendWordPress(article: ArticleRecord) {
    const siteId = siteChoice[article.id] || article.site_id || sites[0]?.id || '';
    if (!siteId) { setMessage('Cadastre ou selecione um site WordPress.'); return; }
    setBusy(`${article.id}:wp`); setMessage('');
    try {
      await api('/api/export-article', { article_id: article.id, destination: 'wordpress', site_id: siteId });
      setMessage('Texto enviado ao WordPress.');
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(''); }
  }

  async function removeArticle(article: ArticleRecord) {
    if (!window.confirm(`Excluir definitivamente "${article.generated_title || article.keyword || 'este texto'}"?`)) return;
    setBusy(`${article.id}:delete`); setMessage('');
    try {
      await api('/api/delete-articles', { article_id: article.id });
      if (open?.id === article.id) setOpen(null);
      setMessage('Texto excluido.');
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(''); }
  }

  async function removeAll() {
    if (!articles.length) return;
    if (!window.confirm(`Excluir TODOS os ${articles.length} textos salvos? As imagens geradas tambem serao removidas do Storage. Posts no WordPress e Docs ja criados nao serao apagados.`)) return;
    setBusy('delete-all'); setMessage('');
    try {
      const result = await api<{ deleted: number }>('/api/delete-articles', { all_generated: true });
      setOpen(null);
      setMessage(`${result.deleted || 0} texto(s) excluido(s).`);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(''); }
  }

  function downloadHtml(article: ArticleRecord) {
    const title = article.generated_title || article.keyword || 'Artigo';
    const blob = new Blob([`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body>${articleDocumentHtml(article)}</body></html>`], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${(article.generated_title || 'artigo').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.html`; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="page-wrap texts-page">
      <header className="page-header"><div><span className="eyebrow">Biblioteca</span><h1>Textos</h1><p>Todos os textos gerados ficam aqui, mesmo quando voce nao publica em nenhum site.</p></div><div className="header-actions"><button className="btn ghost" onClick={load}><RefreshCw size={16} /> Atualizar</button><button className="btn ghost danger-text" disabled={!articles.length || busy === 'delete-all'} onClick={removeAll}><Trash2 size={16} /> {busy === 'delete-all' ? 'Excluindo...' : 'Excluir todos'}</button></div></header>
      {message && <div className="alert">{message}</div>}
      <section className="panel">
        <div className="toolbar"><label className="search-box"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar titulo ou palavra-chave" /></label><span className="muted">{visible.length} texto(s)</span></div>
        <div className="queue-table-wrap">
          <table className="queue-table texts-table">
            <thead><tr><th>Texto</th><th>Capa</th><th>WordPress</th><th>Google Drive</th><th>Criado</th><th>Acoes</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={6}>Carregando...</td></tr>}
              {!loading && !visible.length && <tr><td colSpan={6}>Nenhum texto gerado ainda.</td></tr>}
              {visible.map((article) => (
                <tr key={article.id}>
                  <td><strong>{article.generated_title || article.keyword || 'Sem titulo'}</strong><small>{article.keyword} · {wordCount(article)} palavras</small></td>
                  <td>{article.cover_image_url ? <img className="cover-thumb" src={article.cover_image_url} alt="" /> : <span className="muted">Sem capa</span>}</td>
                  <td>
                    {article.wp_post_url ? <a className="destination-link" href={article.wp_post_url} target="_blank" rel="noreferrer"><Globe2 size={14} /> Abrir post <ExternalLink size={12} /></a> : <div className="publish-inline"><select value={siteChoice[article.id] || article.site_id || sites[0]?.id || ''} onChange={(e) => setSiteChoice((all) => ({ ...all, [article.id]: e.target.value }))}><option value="">Escolher site</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select><button className="btn small ghost" disabled={busy === `${article.id}:wp`} onClick={() => sendWordPress(article)}>Publicar</button></div>}
                  </td>
                  <td>{article.drive_doc_url ? <a className="destination-link drive" href={article.drive_doc_url} target="_blank" rel="noreferrer"><Cloud size={14} /> Abrir documento <ExternalLink size={12} /></a> : <button className="btn small ghost" disabled={!drive.connected || busy === `${article.id}:drive`} onClick={() => sendDrive(article)}><Cloud size={14} /> {drive.connected ? 'Criar no Drive' : 'Drive desconectado'}</button>}</td>
                  <td>{new Date(article.created_at).toLocaleString('pt-BR')}</td>
                  <td><div className="table-actions"><button className="icon-btn" title="Abrir texto" onClick={() => setOpen(article)}><FileText size={16} /></button><button className="icon-btn" title="Copiar texto" onClick={() => navigator.clipboard.writeText(stripHtml(articleDocumentHtml(article)))}><Copy size={16} /></button><button className="icon-btn" title="Baixar HTML" onClick={() => downloadHtml(article)}><Download size={16} /></button><button className="icon-btn danger" disabled={busy === `${article.id}:delete`} title="Excluir texto" onClick={() => removeArticle(article)}><Trash2 size={16} /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {open && <div className="text-modal-backdrop" onClick={() => setOpen(null)}><section className="text-modal" onClick={(e) => e.stopPropagation()}><header><div><small>{open.keyword} · {wordCount(open)} palavras</small><h2>{open.generated_title}</h2></div><button className="icon-btn" onClick={() => setOpen(null)}><X size={18} /></button></header>{open.cover_image_url && <img className="modal-cover" src={open.cover_image_url} alt="" />}<article className="generated-article" dangerouslySetInnerHTML={{ __html: open.generated_html || '' }} /><footer><button className="btn ghost" onClick={() => navigator.clipboard.writeText(articleDocumentHtml(open))}><Copy size={16} /> Copiar HTML</button><button className="btn dark" onClick={() => navigator.clipboard.writeText(stripHtml(articleDocumentHtml(open)))}><Copy size={16} /> Copiar texto</button><button className="btn ghost danger-text" onClick={() => removeArticle(open)}><Trash2 size={16} /> Excluir</button></footer></section></div>}
    </div>
  );
}
