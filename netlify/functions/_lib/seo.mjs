const ARTICLE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'meta_description', 'excerpt', 'html_content', 'cover_prompt'],
  properties: {
    title: { type: 'string' },
    meta_description: { type: 'string' },
    excerpt: { type: 'string' },
    html_content: { type: 'string' },
    cover_prompt: { type: 'string' },
  },
}

function extractOutputText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim()
  const chunks = []
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === 'output_text' && content?.text) chunks.push(content.text)
    }
  }
  return chunks.join('\n').trim()
}

function normalizeUrl(value) {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('O link precisa começar com http:// ou https://')
  return url.toString()
}

export function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 90)
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[char]))
}

function escapeAttribute(value = '') {
  return escapeHtml(value).replace(/`/g, '&#96;')
}

export function finalizeArticleHtml(html, keyword, linkUrl) {
  const safeKeyword = escapeHtml(keyword)
  const safeUrl = escapeAttribute(normalizeUrl(linkUrl))
  const anchor = `<a href="${safeUrl}" target="_blank" rel="noopener">${safeKeyword}</a>`
  let output = String(html || '').trim()

  if (output.includes('[[ANCHOR_LINK]]')) {
    output = output.replace('[[ANCHOR_LINK]]', anchor)
  } else {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escaped, 'i')
    output = output.replace(regex, anchor)
  }

  return output
}

export function stripHtml(html = '') {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

export function countWords(text = '') {
  const clean = String(text).trim()
  return clean ? clean.split(/\s+/).length : 0
}

export async function generateSeoArticle({ keyword, linkUrl, keywordInTitle, index, quantity, previousTitles = [] }) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY não configurada no Netlify.')
  const model = process.env.OPENAI_TEXT_MODEL || 'gpt-5.6-sol'

  const titleRule = keywordInTitle
    ? `O título DEVE conter exatamente a expressão "${keyword}" de forma natural.`
    : `O título não precisa conter a expressão exata "${keyword}"; priorize naturalidade e apelo de busca.`

  const previous = previousTitles.length
    ? `Evite títulos ou ângulos parecidos com estes já criados no lote: ${previousTitles.map((t) => `"${t}"`).join(', ')}.`
    : 'Este é o primeiro artigo do lote.'

  const instructions = `
Você é um redator SEO sênior em português do Brasil. Produza conteúdo editorial útil, original, claro e pronto para publicação.
O objetivo é aumentar a chance de bom desempenho orgânico no Google por meio de qualidade, intenção de busca, cobertura semântica e boa experiência de leitura. Não prometa posicionamento.

Regras obrigatórias:
- escreva para humanos, sem keyword stuffing;
- responda à intenção de busca logo no começo e aprofunde o tema ao longo do texto;
- use informações plausíveis e duráveis; não invente estudos, estatísticas, especialistas, leis, cotações ou fatos atuais;
- não diga que é IA, não explique o processo e não inclua notas ao editor;
- entregue um artigo entre aproximadamente 1.200 e 1.600 palavras;
- não use <h1> no html_content, pois o título será publicado separadamente;
- use <p>, <h2>, <h3>, <ul>, <ol>, <strong> e <blockquote> apenas quando fizer sentido;
- inclua perguntas frequentes somente se melhorarem o conteúdo, evitando formato mecânico em todos os artigos;
- meta_description deve ter idealmente 140 a 160 caracteres, ser persuasiva e específica;
- excerpt deve ser um resumo curto de 1 a 2 frases;
- no html_content, use exatamente uma vez o token [[ANCHOR_LINK]] no lugar da palavra-chave, dentro de uma frase natural, preferencialmente no primeiro terço do artigo;
- não coloque [[ANCHOR_LINK]] em títulos ou subtítulos;
- não adicione outras tags <a>;
- cover_prompt deve descrever uma imagem editorial horizontal 16:9 relacionada ao assunto, sem texto, sem logotipos e sem marcas d'água.
`.trim()

  const input = `
Crie o artigo ${index} de ${quantity}.
Palavra-chave principal: "${keyword}"
URL que será aplicada posteriormente na palavra-chave: ${linkUrl}
${titleRule}
${previous}

Varie o enfoque, exemplos, estrutura e título em relação aos demais artigos do lote, mas mantenha relevância direta para a mesma palavra-chave.
`.trim()

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      instructions,
      input,
      text: {
        format: {
          type: 'json_schema',
          name: 'seo_article',
          strict: true,
          schema: ARTICLE_SCHEMA,
        },
      },
    }),
  })

  const raw = await response.text()
  if (!response.ok) {
    let detail = raw
    try { detail = JSON.parse(raw)?.error?.message || raw } catch {}
    throw new Error(`OpenAI (texto): ${detail}`)
  }

  const data = JSON.parse(raw)
  const text = extractOutputText(data)
  if (!text) throw new Error('A OpenAI não retornou o conteúdo estruturado do artigo.')

  let article
  try {
    article = JSON.parse(text)
  } catch {
    throw new Error('Não foi possível interpretar o JSON retornado pela OpenAI.')
  }

  const title = String(article.title || '').trim()
  if (!title) throw new Error('A OpenAI retornou um artigo sem título.')

  if (keywordInTitle && !title.toLocaleLowerCase('pt-BR').includes(keyword.toLocaleLowerCase('pt-BR'))) {
    article.title = `${keyword}: ${title}`
  }

  article.html_content = finalizeArticleHtml(article.html_content, keyword, linkUrl)
  return article
}

export async function generateCoverImage(prompt) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY não configurada no Netlify.')
  const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2'

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt: `${prompt}\nComposição editorial premium, horizontal, visual limpo, sem qualquer texto legível, sem logotipo e sem marca d'água.`,
      size: '1536x1024',
      quality: 'medium',
      output_format: 'webp',
    }),
  })

  const raw = await response.text()
  if (!response.ok) {
    let detail = raw
    try { detail = JSON.parse(raw)?.error?.message || raw } catch {}
    throw new Error(`OpenAI (imagem): ${detail}`)
  }

  const data = JSON.parse(raw)
  const base64 = data?.data?.[0]?.b64_json
  if (!base64) throw new Error('A OpenAI não retornou os bytes da imagem.')
  return Buffer.from(base64, 'base64')
}
