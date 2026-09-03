import { Cloud, FileUp, Image, Link2, ListTree, Plus, Rocket, Save, Settings2, Sparkles, WandSparkles } from 'lucide-react';
import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArticleRow } from '../components/ArticleRow';
import { OutlineCard } from '../components/OutlineCard';
import { SectionCard } from '../components/SectionCard';
import { useAuth } from '../context/AuthContext';
import { api, triggerBackground } from '../lib/api';
import { alignedFlexible, alignedLines, lines, parseCsv } from '../lib/csv';
import { supabase } from '../lib/supabase';
import type { ArticleDraftRow, Outline, Site, WriterConfig } from '../lib/types';

function id() { return crypto.randomUUID(); }
function emptyRow(): ArticleDraftRow { return { local_id: id(), selected: true, keyword: '', target_url: '', requested_title: '', topic: '', support_keywords: '' }; }
function csvValues(value: string) { return value.split(',').map((v) => v.trim()).filter(Boolean); }
const MAX_BATCH = 120;
const MAX_WORDS = 800;
const MIN_WORDS = 300;

const defaultConfig: WriterConfig = {
  site_id: '', publish_to_wordpress: false, save_to_drive: false, word_count: 800, keyword_in_title: true, content_type: 'auto', search_intent: 'auto', tone: 'editorial', point_of_view: 'auto', target_country: 'Brasil', readability: 'standard',
  structure_depth: 'balanced', allow_h3: true, include_faq: false, include_takeaways: false, intro_hook: 'auto', web_research: false, reasoning_effort: 'low', model: 'gpt-5.6-terra',
  cover_image: true, body_images: 2, image_size: '1536x1024', image_quality: 'medium', image_style: 'fotografia editorial realista', internal_links: 2, extra_links: [],
  include_conclusion: true, use_lists: true, use_tables: false, use_bold: true, category_id: '', author_id: '', publication_status: 'draft', schedule_start: '', interval_minutes: 0, sponsored: false, notes: '',
};

export function WriterPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sites, setSites] = useState<Site[]>([]);
  const [rows, setRows] = useState<ArticleDraftRow[]>([emptyRow()]);
  const [config, setConfig] = useState<WriterConfig>(() => {
    const saved = JSON.parse(localStorage.getItem('ri-writer-config') || '{}');
    return { ...defaultConfig, ...saved, word_count: Math.max(MIN_WORDS, Math.min(MAX_WORDS, Number(saved.word_count || defaultConfig.word_count))) };
  });
  const [bulk, setBulk] = useState({ keywords: '', titles: '', support: '', topics: '', links: '' });
  const [quantity, setQuantity] = useState(1);
  const [extraAnchors, setExtraAnchors] = useState('');
  const [extraUrls, setExtraUrls] = useState('');
  const [message, setMessage] = useState('');
  const [planningAll, setPlanningAll] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const selectedSite = useMemo(() => sites.find((s) => s.id === config.site_id), [sites, config.site_id]);

  useEffect(() => {
    supabase.from('sites').select('*').eq('active', true).order('name').then(({ data }) => {
      const list = (data || []) as Site[]; setSites(list);
      if (!config.site_id && list[0]) setConfig((c) => ({ ...c, site_id: list[0].id }));
    });
  }, []);

  function updateConfig<K extends keyof WriterConfig>(key: K, value: WriterConfig[K]) { setConfig((c) => ({ ...c, [key]: value })); }
  function updateRow(localId: string, next: ArticleDraftRow) { setRows((all) => all.map((row) => row.local_id === localId ? next : row)); }
  function removeRow(localId: string) { setRows((all) => all.filter((row) => row.local_id !== localId)); }

  function mountBulkRows() {
    const k = alignedFlexible(bulk.keywords), t = alignedLines(bulk.titles), s = alignedLines(bulk.support), b = alignedLines(bulk.topics), l = alignedFlexible(bulk.links);
    const sourceCount = Math.max(k.length, t.length, s.length, b.length, l.length);
    if (!sourceCount) { setRows([emptyRow()]); return; }
    const requestedCount = sourceCount === 1 ? Math.max(1, Math.min(MAX_BATCH, Number(quantity || 1))) : sourceCount;
    if (sourceCount > 1 && quantity > 1) setMessage('Como voce informou varias linhas, a quantidade e definida pelas proprias linhas. O campo Quantidade serve para criar variacoes quando existe apenas uma entrada.');
    if (requestedCount > MAX_BATCH || sourceCount > MAX_BATCH) setMessage(`O limite por lote e de ${MAX_BATCH} textos. As primeiras ${MAX_BATCH} linhas foram mantidas.`);
    const safeCount = Math.min(requestedCount, MAX_BATCH);
    setRows(Array.from({ length: safeCount }, (_, i) => {
      const sourceIndex = sourceCount === 1 ? 0 : i;
      return {
        local_id: id(), selected: true, keyword: k[sourceIndex] || '', requested_title: t[sourceIndex] || '', support_keywords: s[sourceIndex] || '', topic: b[sourceIndex] || '', target_url: l[sourceIndex] || '',
      };
    }).filter((r) => r.keyword || r.requested_title || r.support_keywords || r.topic || r.target_url));
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    const parsed = parseCsv(await file.text()); if (!parsed.length) return;
    const headers = parsed[0].map((h) => h.toLowerCase().trim());
    const indexOf = (...names: string[]) => headers.findIndex((h) => names.includes(h));
    const ki = indexOf('palavra-chave', 'palavra chave', 'keyword'), ti = indexOf('titulo', 'título', 'title'), si = indexOf('apoio', 'palavras de apoio', 'support'), bi = indexOf('tema', 'briefing', 'topic'), li = indexOf('link', 'url');
    const body = parsed.slice(1).map((r) => ({ local_id: id(), selected: true, keyword: r[ki] || '', requested_title: r[ti] || '', support_keywords: r[si] || '', topic: r[bi] || '', target_url: r[li] || '' }));
    if (body.length > MAX_BATCH) setMessage(`O CSV possui ${body.length} linhas. O limite por lote e de ${MAX_BATCH}; as demais foram ignoradas.`);
    setRows(body.length ? body.slice(0, MAX_BATCH) : [emptyRow()]);
    event.target.value = '';
  }

  function variationInstruction(row: ArticleDraftRow) {
    const signature = (item: ArticleDraftRow) => [item.keyword, item.target_url, item.requested_title, item.topic, item.support_keywords].map((value) => (value || '').trim().toLowerCase()).join('||');
    const siblings = rows.filter((item) => signature(item) === signature(row));
    if (siblings.length <= 1) return '';
    const index = Math.max(0, siblings.findIndex((item) => item.local_id === row.local_id)) + 1;
    return `Este artigo e a variacao ${index} de ${siblings.length} para a mesma entrada. Crie um angulo editorial, titulo, introducao, exemplos e organizacao de headings claramente diferentes das outras variacoes. Nao diga ao leitor que o texto e uma variacao e nao sacrifique a intencao de busca.`;
  }

  function notesForRow(row: ArticleDraftRow, baseNotes = config.notes) {
    return [baseNotes?.trim(), variationInstruction(row)].filter(Boolean).join('\n\n');
  }

  function outlineBody(row: ArticleDraftRow) {
    return {
      keyword: row.keyword, target_url: row.target_url, requested_title: row.requested_title, topic: row.topic,
      support_keywords: csvValues(row.support_keywords), config: { ...config, notes: notesForRow(row) },
    };
  }

  async function plan(row: ArticleDraftRow) {
    updateRow(row.local_id, { ...row, planning: true, error: '' });
    try {
      const { outline } = await api<{ outline: Outline }>('/api/generate-outline', outlineBody(row));
      updateRow(row.local_id, { ...row, planning: false, error: '', outline, requested_title: row.requested_title || outline.title, topic: row.topic || outline.suggested_topic });
      return outline;
    } catch (error) {
      updateRow(row.local_id, { ...row, planning: false, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  async function planAll() {
    setPlanningAll(true); setMessage('');
    const selected = rows.filter((r) => r.selected).slice(0, MAX_BATCH);
    for (let i = 0; i < selected.length; i += 4) {
      await Promise.allSettled(selected.slice(i, i + 4).map((row) => plan(row)));
    }
    setPlanningAll(false);
  }

  function buildExtraLinks() {
    const anchors = alignedFlexible(extraAnchors), urls = alignedFlexible(extraUrls); const max = Math.max(anchors.length, urls.length);
    return Array.from({ length: max }, (_, i) => ({ anchor: anchors[i] || '', url: urls[i] || '' })).filter((p) => p.anchor && p.url);
  }

  async function generateArticles() {
    if (!user) return;
    if (config.publish_to_wordpress && !config.site_id) { setMessage('Para publicar no WordPress, selecione um site. Se quiser apenas o texto, desative a publicacao.'); return; }
    const chosen = rows.filter((r) => r.selected);
    if (chosen.length > MAX_BATCH) { setMessage(`Selecione no maximo ${MAX_BATCH} artigos por lote.`); return; }
    if (!chosen.length) { setMessage('Selecione pelo menos um artigo.'); return; }
    const invalid = chosen.find((r) => !(r.keyword || r.topic || r.requested_title || r.target_url) || (r.target_url && !r.keyword));
    if (invalid) { setMessage('Revise as linhas: toda URL precisa ter a palavra-chave/ancora correspondente.'); return; }

    setPublishing(true); setMessage('Criando a fila...');
    try {
      // A estrutura previa e opcional. Se uma linha ainda nao tiver outline,
      // o worker cria titulo + H2/H3 no backend depois que o item entra na fila.
      // Assim lotes grandes aparecem imediatamente em Fila e historico e nao
      // dependem de manter esta pagina aberta durante o planejamento.
      const prepared = chosen.slice(0, MAX_BATCH);

      const finalConfig = { ...config, word_count: Math.max(MIN_WORDS, Math.min(MAX_WORDS, Number(config.word_count || MAX_WORDS))), extra_links: buildExtraLinks() };
      localStorage.setItem('ri-writer-config', JSON.stringify(finalConfig));
      const { data: batch, error: batchError } = await supabase.from('batches').insert({ user_id: user.id, name: `Lote ${new Date().toLocaleString('pt-BR')}`, config: finalConfig }).select('*').single();
      if (batchError || !batch) throw batchError || new Error('Falha ao criar lote.');

      const start = config.schedule_start ? new Date(config.schedule_start) : null;
      const payloads = prepared.map((row, index) => ({
        user_id: user.id,
        batch_id: batch.id,
        site_id: config.site_id || null,
        publish_to_wordpress: config.publish_to_wordpress,
        save_to_drive: config.save_to_drive,
        keyword: row.keyword,
        target_url: row.target_url,
        requested_title: row.requested_title || row.outline?.title || '',
        topic: row.topic || row.outline?.suggested_topic || '',
        support_keywords: csvValues(row.support_keywords || row.outline?.support_keywords?.join(',') || ''),
        outline: row.outline || {},
        config: { ...finalConfig, notes: notesForRow(row, finalConfig.notes) },
        scheduled_at: start ? new Date(start.getTime() + index * Number(config.interval_minutes || 0) * 60000).toISOString() : null,
        status: 'queued',
        progress: 0,
        progress_label: 'Na fila',
      }));
      const { data: articles, error: articleError } = await supabase.from('articles').insert(payloads).select('id');
      if (articleError || !articles) throw articleError || new Error('Falha ao criar fila.');

      setMessage(`${articles.length} artigo(s) enviado(s) para a fila. O sistema processa alguns por vez e mantem os demais aguardando.`);
      await Promise.allSettled(articles.slice(0, 3).map((article) => triggerBackground(article.id)));
      navigate('/fila');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally { setPublishing(false); }
  }

  return (
    <div className="page-wrap writer-page">
      <header className="page-header"><div><span className="eyebrow"><Sparkles size={14} /> Conteudo em escala</span><h1>Gerador de artigos SEO</h1><p>Monte o lote, aprove a estrutura H2/H3 e escolha o destino: somente Textos, Google Drive e/ou WordPress.</p></div><button className="btn ghost" onClick={() => localStorage.setItem('ri-writer-config', JSON.stringify(config))}><Save size={16} /> Salvar preferencias</button></header>

      <div className="writer-layout">
        <div className="writer-main">
          <SectionCard title="Artigos em lote" description={`Cole listas alinhadas ou importe CSV. Titulo e briefing podem ficar vazios. Ate ${MAX_BATCH} textos por lote.`} icon={<ListTree size={18} />}>
            <div className="quick-quantity"><label className="field"><span>Quantidade de textos</span><input type="number" min={1} max={MAX_BATCH} value={quantity} onChange={(e) => setQuantity(Math.max(1, Math.min(MAX_BATCH, Number(e.target.value) || 1)))} /></label><small>Se houver apenas uma entrada, o sistema cria essa quantidade de variacoes. Com varias linhas, cada linha vale um texto.</small></div>
            <div className="bulk-grid labels"><span>Palavras-chave</span><span>Titulos opcionais</span><span>Palavras de apoio</span><span>Tema / briefing opcional</span><span>Links respectivos</span></div>
            <div className="bulk-grid">
              <textarea value={bulk.keywords} onChange={(e) => setBulk({ ...bulk, keywords: e.target.value })} placeholder={'curso de ingles\nmontador de moveis\nseguranca do trabalho'} />
              <textarea value={bulk.titles} onChange={(e) => setBulk({ ...bulk, titles: e.target.value })} placeholder={'deixe vazio para a IA\nTitulo manual opcional'} />
              <textarea value={bulk.support} onChange={(e) => setBulk({ ...bulk, support: e.target.value })} placeholder={'ingles online, aulas\nmoveis planejados'} />
              <textarea value={bulk.topics} onChange={(e) => setBulk({ ...bulk, topics: e.target.value })} placeholder={'deixe vazio para a IA inferir'} />
              <textarea value={bulk.links} onChange={(e) => setBulk({ ...bulk, links: e.target.value })} placeholder={'https://site.com/a\nhttps://site.com/b'} />
            </div>
            <div className="action-row"><button className="btn dark" type="button" onClick={mountBulkRows}><WandSparkles size={16} /> Montar lista</button><label className="btn ghost file-btn"><FileUp size={16} /> Importar CSV<input type="file" accept=".csv,text/csv" onChange={importCsv} /></label><button className="btn ghost" type="button" disabled={rows.length >= MAX_BATCH} onClick={() => setRows((r) => r.length >= MAX_BATCH ? r : [...r, emptyRow()])}><Plus size={16} /> Adicionar linha</button></div>

            <div className="article-grid-head"><span>#</span><span>Palavra-chave</span><span>Titulo</span><span>Apoio</span><span>Tema</span><span>Link</span><span>Status</span></div>
            <div className="article-rows">{rows.map((row, index) => <ArticleRow key={row.local_id} row={row} index={index} onChange={(next) => updateRow(row.local_id, next)} onRemove={() => removeRow(row.local_id)} />)}</div>
            <div className="action-row spread"><span className="muted">{rows.filter((r) => r.selected).length} selecionado(s) de {MAX_BATCH} max.</span><button className="btn primary" type="button" disabled={planningAll} onClick={planAll}><Sparkles size={16} /> {planningAll ? 'Gerando estruturas...' : 'Gerar titulos + headings'}</button></div>
          </SectionCard>

          <SectionCard title="Direcionamento geral da IA" description="Estas instrucoes valem para todos os textos do lote e podem ser tao especificas quanto voce quiser." icon={<Sparkles size={18} />} accent>
            <label className="field"><span>Como a IA deve escrever</span><textarea rows={7} value={config.notes} onChange={(e) => updateConfig('notes', e.target.value)} placeholder="Ex.: linguagem natural, paragrafos de no maximo 2 frases, sem conclusao generica, mencionar determinada empresa como referencia, evitar listas, escrever para publico de Maceio..." /></label>
            <div className="mini-alert">O briefing de cada linha continua valendo para aquele texto. Este campo funciona como uma orientacao geral para o lote inteiro.</div>
          </SectionCard>

          {rows.some((r) => r.outline) && <SectionCard title="Estruturas antes da redacao" description="Edite, exclua, transforme H2/H3 e reordene antes de gerar o texto." icon={<WandSparkles size={18} />}>
            <div className="outline-list">{rows.map((row, index) => <OutlineCard key={row.local_id} row={row} index={index} onChange={(next) => updateRow(row.local_id, next)} onRegenerate={() => plan(row)} />)}</div>
          </SectionCard>}

          <SectionCard title="Links extras" description="Opcional. Uma ancora por linha e a URL correspondente na mesma posicao." icon={<Link2 size={18} />} defaultOpen={false}>
            <div className="two-col"><label className="field"><span>Palavras/ancoras</span><textarea rows={5} value={extraAnchors} onChange={(e) => setExtraAnchors(e.target.value)} placeholder={'agencia de seo\ncurso de ingles'} /></label><label className="field"><span>URLs respectivas</span><textarea rows={5} value={extraUrls} onChange={(e) => setExtraUrls(e.target.value)} placeholder={'https://exemplo.com/seo\nhttps://exemplo.com/ingles'} /></label></div>
          </SectionCard>
        </div>

        <aside className="writer-settings">
          <SectionCard title="Configuracoes principais" icon={<Settings2 size={18} />}>
            <label className="field"><span>Site WordPress (opcional)</span><select value={config.site_id} onChange={(e) => updateConfig('site_id', e.target.value)}><option value="">Selecione...</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
            {!sites.length && <div className="mini-alert">Cadastre um site na aba <b>Sites WordPress</b>.</div>}
            <div className="two-col compact"><label className="field"><span>Palavras (max. 800)</span><input type="number" min={MIN_WORDS} max={MAX_WORDS} value={config.word_count} onChange={(e) => updateConfig('word_count', Math.max(MIN_WORDS, Math.min(MAX_WORDS, Number(e.target.value))))} /></label><label className="field"><span>Profundidade</span><select value={config.structure_depth} onChange={(e) => updateConfig('structure_depth', e.target.value)}><option value="compact">Compacta</option><option value="balanced">Equilibrada</option><option value="deep">Detalhada</option></select></label></div>
            <div className="toggle-list"><label><input type="checkbox" checked={config.keyword_in_title} onChange={(e) => updateConfig('keyword_in_title', e.target.checked)} /><span>Ao criar titulo automaticamente, incluir a palavra-chave principal</span></label></div>
            <label className="field"><span>Tipo de artigo</span><select value={config.content_type} onChange={(e) => updateConfig('content_type', e.target.value)}><option value="auto">Automatico</option><option value="editorial">Artigo editorial</option><option value="guide">Guia / tutorial</option><option value="news">Noticia</option><option value="comparison">Comparativo</option><option value="list">Lista</option><option value="review">Review</option><option value="local">Conteudo local</option></select></label>
            <label className="field"><span>Intencao de busca</span><select value={config.search_intent} onChange={(e) => updateConfig('search_intent', e.target.value)}><option value="auto">Detectar automaticamente</option><option value="informational">Informacional</option><option value="commercial">Comercial</option><option value="transactional">Transacional</option><option value="navigational">Navegacional</option></select></label>
            <label className="field"><span>Tom editorial</span><select value={config.tone} onChange={(e) => updateConfig('tone', e.target.value)}><option value="editorial">Editorial natural</option><option value="journalistic">Jornalistico</option><option value="friendly">Conversacional</option><option value="technical">Tecnico</option><option value="persuasive">Persuasivo</option></select></label>
            <label className="field"><span>Gancho da introducao</span><select value={config.intro_hook} onChange={(e) => updateConfig('intro_hook', e.target.value)}><option value="auto">Automatico</option><option value="question">Pergunta</option><option value="fact">Fato ou dado</option><option value="story">Historia curta</option><option value="direct">Direto ao ponto</option></select></label>
            <div className="toggle-list"><label><input type="checkbox" checked={config.web_research} onChange={(e) => updateConfig('web_research', e.target.checked)} /><span>Pesquisar na web antes de escrever</span></label><label><input type="checkbox" checked={config.allow_h3} onChange={(e) => updateConfig('allow_h3', e.target.checked)} /><span>Permitir H3</span></label><label><input type="checkbox" checked={config.include_faq} onChange={(e) => updateConfig('include_faq', e.target.checked)} /><span>Permitir FAQ</span></label></div>
          </SectionCard>

          <SectionCard title="IA e linguagem" description="Modelo, raciocinio e perfil de leitura." icon={<Sparkles size={18} />} defaultOpen={false}>
            <label className="field"><span>Modelo de texto</span><select value={config.model} onChange={(e) => updateConfig('model', e.target.value)}><option value="gpt-5.6-terra">GPT-5.6 Terra — equilibrio</option><option value="gpt-5.6-sol">GPT-5.6 Sol — qualidade maxima</option><option value="gpt-5.6-luna">GPT-5.6 Luna — alto volume</option></select></label>
            <label className="field"><span>Esforco de raciocinio</span><select value={config.reasoning_effort} onChange={(e) => updateConfig('reasoning_effort', e.target.value as WriterConfig['reasoning_effort'])}><option value="none">Nenhum</option><option value="low">Baixo</option><option value="medium">Medio</option><option value="high">Alto</option></select></label>
            <label className="field"><span>Ponto de vista</span><select value={config.point_of_view} onChange={(e) => updateConfig('point_of_view', e.target.value)}><option value="auto">Automatico</option><option value="third">Terceira pessoa</option><option value="first_plural">Primeira pessoa do plural</option><option value="second">Direto com o leitor</option></select></label>
            <label className="field"><span>Pais-alvo</span><input value={config.target_country} onChange={(e) => updateConfig('target_country', e.target.value)} /></label>
            <label className="field"><span>Nivel de leitura</span><select value={config.readability} onChange={(e) => updateConfig('readability', e.target.value)}><option value="simple">Simples</option><option value="standard">Padrao editorial</option><option value="advanced">Avancado / tecnico</option></select></label>
          </SectionCard>

          <SectionCard title="Media Hub" description="Capa e imagens geradas automaticamente." icon={<Image size={18} />} accent>
            <div className="toggle-list"><label><input type="checkbox" checked={config.cover_image} onChange={(e) => updateConfig('cover_image', e.target.checked)} /><span>Gerar imagem de capa</span></label></div>
            <div className="two-col compact"><label className="field"><span>Imagens no corpo</span><input type="number" min={0} max={8} value={config.body_images} onChange={(e) => updateConfig('body_images', Number(e.target.value))} /></label><label className="field"><span>Qualidade</span><select value={config.image_quality} onChange={(e) => updateConfig('image_quality', e.target.value)}><option value="low">Baixa</option><option value="medium">Media</option><option value="high">Alta</option></select></label></div>
            <label className="field"><span>Proporcao / tamanho</span><select value={config.image_size} onChange={(e) => updateConfig('image_size', e.target.value)}><option value="1536x1024">Horizontal 3:2</option><option value="1024x1024">Quadrada</option><option value="1024x1536">Vertical 2:3</option></select></label>
            <label className="field"><span>Estilo visual</span><input value={config.image_style} onChange={(e) => updateConfig('image_style', e.target.value)} /></label>
          </SectionCard>

          <SectionCard title="Estrutura e SEO" icon={<ListTree size={18} />} defaultOpen={false}>
            <label className="field"><span>Links internos automaticos</span><input type="number" min={0} max={5} value={config.internal_links} onChange={(e) => updateConfig('internal_links', Number(e.target.value))} /></label>
            <div className="toggle-list"><label><input type="checkbox" checked={config.include_conclusion} onChange={(e) => updateConfig('include_conclusion', e.target.checked)} /><span>Encerramento natural</span></label><label><input type="checkbox" checked={config.use_lists} onChange={(e) => updateConfig('use_lists', e.target.checked)} /><span>Permitir listas</span></label><label><input type="checkbox" checked={config.use_tables} onChange={(e) => updateConfig('use_tables', e.target.checked)} /><span>Permitir tabelas</span></label><label><input type="checkbox" checked={config.use_bold} onChange={(e) => updateConfig('use_bold', e.target.checked)} /><span>Usar negrito com moderacao</span></label></div>
          </SectionCard>

          <SectionCard title="Destinos e publicacao" description="O texto sempre fica salvo na aba Textos. Os outros destinos sao opcionais." icon={<Rocket size={18} />} accent>
            <div className="destination-toggles">
              <label className="destination-choice always"><span className="destination-icon"><ListTree size={17} /></span><span><b>Salvar em Textos</b><small>Sempre ativo. Voce pode copiar, baixar ou publicar depois.</small></span><input type="checkbox" checked readOnly /></label>
              <label className={`destination-choice ${config.publish_to_wordpress ? 'active' : ''}`}><span className="destination-icon"><Rocket size={17} /></span><span><b>Publicar no WordPress</b><small>Envie para o site agora ou deixe desativado para publicar depois.</small></span><input type="checkbox" checked={config.publish_to_wordpress} onChange={(e) => updateConfig('publish_to_wordpress', e.target.checked)} /></label>
              <label className={`destination-choice ${config.save_to_drive ? 'active' : ''}`}><span className="destination-icon"><Cloud size={17} /></span><span><b>Criar Google Doc</b><small>O documento recebe capa e imagens quando elas forem geradas.</small></span><input type="checkbox" checked={config.save_to_drive} onChange={(e) => updateConfig('save_to_drive', e.target.checked)} /></label>
            </div>
            {config.publish_to_wordpress && <>
              <label className="field"><span>Categoria</span><select value={config.category_id} onChange={(e) => updateConfig('category_id', e.target.value ? Number(e.target.value) : '')}><option value="">Automatica / padrao</option>{selectedSite?.metadata?.categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <label className="field"><span>Autor</span><select value={config.author_id} onChange={(e) => updateConfig('author_id', e.target.value ? Number(e.target.value) : '')}><option value="">Padrao do site</option>{selectedSite?.metadata?.authors?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
              <label className="field"><span>Status no WordPress</span><select value={config.publication_status} onChange={(e) => updateConfig('publication_status', e.target.value as WriterConfig['publication_status'])}><option value="draft">Rascunho</option><option value="review">Pendente de revisao</option><option value="publish">Publicar / agendar</option><option value="private">Privado</option></select></label>
              <label className="field"><span>Comecar em (opcional)</span><input type="datetime-local" value={config.schedule_start} onChange={(e) => updateConfig('schedule_start', e.target.value)} /></label>
              <label className="field"><span>Intervalo entre artigos (minutos)</span><input type="number" min={0} value={config.interval_minutes} onChange={(e) => updateConfig('interval_minutes', Number(e.target.value))} /></label>
              <div className="toggle-list"><label><input type="checkbox" checked={config.sponsored} onChange={(e) => updateConfig('sponsored', e.target.checked)} /><span>Conteudo patrocinado / publieditorial</span></label></div>
            </>}
            {config.save_to_drive && <div className="mini-alert">O Google Drive precisa estar conectado em <b>Configuracoes</b>. O arquivo sera criado como Google Docs e compartilhado como "qualquer pessoa com o link pode visualizar".</div>}
            {message && <div className="mini-alert">{message}</div>}
            <button className="btn dark full big" type="button" disabled={publishing} onClick={generateArticles}><Rocket size={18} /> {publishing ? 'Enviando para a fila...' : 'Gerar artigos selecionados'}</button>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}
