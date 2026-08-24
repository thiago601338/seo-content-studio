import React, { useEffect, useMemo, useState } from 'react'
import DOMPurify from 'dompurify'

const API = '/api'

function getPassword() {
  return sessionStorage.getItem('seo_app_password') || ''
}

async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {})
  headers.set('x-app-password', getPassword())
  if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json')

  const response = await fetch(`${API}${path}`, { ...options, headers })
  let data = null
  const type = response.headers.get('content-type') || ''
  if (type.includes('application/json')) data = await response.json()
  if (!response.ok) throw new Error(data?.error || `Erro ${response.status}`)
  return data
}

function formatDate(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function htmlToPlain(html) {
  const doc = new DOMParser().parseFromString(html || '', 'text/html')
  return doc.body.innerText.trim()
}

async function copyRichText(title, html) {
  const rich = `<h1>${escapeHtml(title)}</h1>${html}`
  const plain = `${title}\n\n${htmlToPlain(html)}`
  if (navigator.clipboard?.write && window.ClipboardItem) {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([rich], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      }),
    ])
    return
  }
  await navigator.clipboard.writeText(plain)
}

function escapeHtml(value = '') {
  return value.replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]))
}

export default function App() {
  const [unlocked, setUnlocked] = useState(Boolean(getPassword()))
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [tab, setTab] = useState('create')
  const [articles, setArticles] = useState([])
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [message, setMessage] = useState('')
  const [job, setJob] = useState(null)
  const [form, setForm] = useState({
    quantity: 1,
    createCover: true,
    keyword: '',
    linkUrl: '',
    keywordInTitle: true,
  })

  const sanitizedArticle = useMemo(
    () => DOMPurify.sanitize(selected?.html_content || ''),
    [selected],
  )

  useEffect(() => {
    if (!unlocked) return
    loadHistory().catch(() => {
      sessionStorage.removeItem('seo_app_password')
      setUnlocked(false)
    })
  }, [unlocked])

  useEffect(() => {
    if (!job?.id || ['completed', 'completed_with_errors', 'failed'].includes(job.status)) return
    const timer = setInterval(async () => {
      try {
        const data = await apiFetch(`/job?id=${encodeURIComponent(job.id)}`)
        setJob(data.job)
        if (['completed', 'completed_with_errors', 'failed'].includes(data.job.status)) {
          await loadHistory()
        }
      } catch (error) {
        setMessage(error.message)
      }
    }, 2500)
    return () => clearInterval(timer)
  }, [job?.id, job?.status])

  async function unlock(event) {
    event.preventDefault()
    setLoginError('')
    sessionStorage.setItem('seo_app_password', loginPassword)
    try {
      await apiFetch('/health')
      setUnlocked(true)
    } catch (error) {
      sessionStorage.removeItem('seo_app_password')
      setLoginError(error.message)
    }
  }

  async function loadHistory(query = search) {
    setLoadingHistory(true)
    try {
      const data = await apiFetch(`/articles?search=${encodeURIComponent(query || '')}`)
      setArticles(data.articles || [])
    } finally {
      setLoadingHistory(false)
    }
  }

  async function openArticle(id) {
    setMessage('')
    try {
      const data = await apiFetch(`/article?id=${encodeURIComponent(id)}`)
      setSelected(data.article)
    } catch (error) {
      setMessage(error.message)
    }
  }

  async function startGeneration(event) {
    event.preventDefault()
    setMessage('')
    setSelected(null)

    try {
      const created = await apiFetch('/start-job', {
        method: 'POST',
        body: JSON.stringify({
          quantity: Number(form.quantity),
          createCover: Boolean(form.createCover),
          keyword: form.keyword.trim(),
          linkUrl: form.linkUrl.trim(),
          keywordInTitle: Boolean(form.keywordInTitle),
        }),
      })

      setJob(created.job)
      await apiFetch('/generate-background', {
        method: 'POST',
        body: JSON.stringify({ jobId: created.job.id }),
      })
      setMessage('Geração iniciada. Você pode continuar usando o painel enquanto os textos são criados.')
    } catch (error) {
      setMessage(error.message)
    }
  }

  async function removeArticle(id) {
    if (!confirm('Excluir este texto do histórico?')) return
    try {
      await apiFetch('/delete-article', {
        method: 'POST',
        body: JSON.stringify({ id }),
      })
      if (selected?.id === id) setSelected(null)
      await loadHistory()
    } catch (error) {
      setMessage(error.message)
    }
  }

  function logout() {
    sessionStorage.removeItem('seo_app_password')
    setUnlocked(false)
    setLoginPassword('')
    setArticles([])
    setSelected(null)
  }

  if (!unlocked) {
    return (
      <main className="login-shell">
        <form className="login-card" onSubmit={unlock}>
          <div className="brand-mark">S</div>
          <p className="eyebrow">SEO CONTENT STUDIO</p>
          <h1>Entre no sistema</h1>
          <p className="muted">A senha protege sua chave da OpenAI e o histórico de textos.</p>
          <label>
            Senha do sistema
            <input
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              autoFocus
              required
              placeholder="••••••••••••"
            />
          </label>
          {loginError && <div className="error-box">{loginError}</div>}
          <button className="primary full" type="submit">Entrar</button>
        </form>
      </main>
    )
  }

  const progress = job ? Math.round(((job.completed_count + job.failed_count) / Math.max(job.quantity, 1)) * 100) : 0

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand-row">
            <div className="brand-mark small">S</div>
            <div>
              <strong>SEO Studio</strong>
              <span>Conteúdo com IA</span>
            </div>
          </div>
          <nav>
            <button className={tab === 'create' ? 'active' : ''} onClick={() => setTab('create')}>Criar textos</button>
            <button className={tab === 'history' ? 'active' : ''} onClick={() => { setTab('history'); loadHistory() }}>Meus textos</button>
          </nav>
        </div>
        <button className="logout" onClick={logout}>Sair</button>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">PAINEL DE CONTEÚDO</p>
            <h1>{tab === 'create' ? 'Criar novos textos' : 'Biblioteca de textos'}</h1>
          </div>
          <div className="status-pill"><span /> API protegida</div>
        </header>

        {message && <div className="notice">{message}</div>}

        {tab === 'create' ? (
          <section className="create-grid">
            <form className="panel form-panel" onSubmit={startGeneration}>
              <div className="panel-heading">
                <div>
                  <h2>Nova geração</h2>
                  <p>Preencha somente o necessário. O restante da estratégia SEO é aplicado automaticamente.</p>
                </div>
              </div>

              <div className="fields-grid">
                <label>
                  Quantidade de textos
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    required
                  />
                </label>

                <label>
                  Palavra-chave
                  <input
                    type="text"
                    value={form.keyword}
                    onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                    placeholder="Ex.: vestido para casamento"
                    required
                  />
                </label>

                <label className="span-2">
                  Link para inserir na palavra-chave
                  <input
                    type="url"
                    value={form.linkUrl}
                    onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
                    placeholder="https://seusite.com.br/pagina"
                    required
                  />
                </label>

                <label className="switch-card">
                  <span>
                    <strong>Criar imagem de capa</strong>
                    <small>Imagem horizontal pronta para o artigo</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={form.createCover}
                    onChange={(e) => setForm({ ...form, createCover: e.target.checked })}
                  />
                </label>

                <label className="switch-card">
                  <span>
                    <strong>Palavra-chave no título</strong>
                    <small>Força a expressão exata no título</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={form.keywordInTitle}
                    onChange={(e) => setForm({ ...form, keywordInTitle: e.target.checked })}
                  />
                </label>
              </div>

              <div className="seo-rules">
                <span>✓ Estrutura H2/H3</span>
                <span>✓ Meta description</span>
                <span>✓ Link aplicado na palavra-chave</span>
                <span>✓ Sem keyword stuffing</span>
              </div>

              <button className="primary generate" type="submit">Gerar textos</button>
            </form>

            <div className="side-column">
              <section className="panel compact-panel">
                <p className="eyebrow">PADRÃO AUTOMÁTICO</p>
                <h3>SEO pensado para conteúdo útil</h3>
                <p>Os artigos são orientados por intenção de busca, profundidade temática, leitura natural e organização pronta para CMS.</p>
              </section>

              {job && (
                <section className="panel job-panel">
                  <div className="job-head">
                    <div>
                      <p className="eyebrow">ÚLTIMA GERAÇÃO</p>
                      <h3>{job.keyword}</h3>
                    </div>
                    <span className={`job-status ${job.status}`}>{job.status.replaceAll('_', ' ')}</span>
                  </div>
                  <div className="progress-track"><div style={{ width: `${progress}%` }} /></div>
                  <div className="job-numbers">
                    <span>{job.completed_count} concluídos</span>
                    <span>{job.failed_count} falhas</span>
                    <strong>{progress}%</strong>
                  </div>
                  {job.error_message && <p className="job-error">{job.error_message}</p>}
                </section>
              )}
            </div>
          </section>
        ) : (
          <section className="history-layout">
            <div className="panel history-panel">
              <div className="history-tools">
                <div>
                  <h2>Textos salvos</h2>
                  <p>{articles.length} encontrados</p>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); loadHistory(search) }}>
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por título ou palavra-chave" />
                  <button type="submit">Buscar</button>
                </form>
              </div>

              <div className="article-list">
                {loadingHistory && <div className="empty">Carregando...</div>}
                {!loadingHistory && articles.length === 0 && <div className="empty">Nenhum texto encontrado.</div>}
                {!loadingHistory && articles.map((article) => (
                  <article key={article.id} className={`article-row ${selected?.id === article.id ? 'selected' : ''}`} onClick={() => openArticle(article.id)}>
                    <div className="thumb">
                      {article.cover_image_url ? <img src={article.cover_image_url} alt="" /> : <span>TXT</span>}
                    </div>
                    <div className="article-row-main">
                      <div className="article-row-top">
                        <h3>{article.title}</h3>
                        <time>{formatDate(article.created_at)}</time>
                      </div>
                      <p>{article.meta_description}</p>
                      <div className="article-meta">
                        <span>{article.keyword}</span>
                        <span>{article.word_count || 0} palavras</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <aside className="panel preview-panel">
              {!selected ? (
                <div className="empty preview-empty">
                  <strong>Selecione um texto</strong>
                  <span>O conteúdo completo aparecerá aqui.</span>
                </div>
              ) : (
                <>
                  {selected.cover_image_url && <img className="cover-preview" src={selected.cover_image_url} alt={selected.title} />}
                  <div className="preview-header">
                    <p className="eyebrow">{selected.keyword}</p>
                    <h2>{selected.title}</h2>
                    <p className="meta-description">{selected.meta_description}</p>
                    <div className="preview-actions">
                      <button className="primary" onClick={async () => { await copyRichText(selected.title, selected.html_content); setMessage('Texto formatado copiado.') }}>Copiar texto</button>
                      <button onClick={async () => { await navigator.clipboard.writeText(selected.html_content); setMessage('HTML copiado.') }}>Copiar HTML</button>
                      {selected.cover_image_url && <button onClick={() => window.open(selected.cover_image_url, '_blank', 'noopener,noreferrer')}>Abrir capa</button>}
                      <button className="danger" onClick={() => removeArticle(selected.id)}>Excluir</button>
                    </div>
                  </div>
                  <div className="article-content" dangerouslySetInnerHTML={{ __html: sanitizedArticle }} />
                </>
              )}
            </aside>
          </section>
        )}
      </main>
    </div>
  )
}
