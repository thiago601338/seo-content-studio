export const outlineSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['suggested_topic', 'title', 'search_intent', 'support_keywords', 'headings'],
  properties: {
    suggested_topic: { type: 'string' },
    title: { type: 'string' },
    search_intent: { type: 'string' },
    support_keywords: {
      type: 'array',
      items: { type: 'string' },
    },
    headings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['level', 'text'],
        properties: {
          level: { type: 'string', enum: ['h2', 'h3'] },
          text: { type: 'string' },
        },
      },
    },
  },
};

export const articleSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'title',
    'excerpt',
    'seo_title',
    'seo_description',
    'tags',
    'category_id',
    'body_html',
    'cover_image_prompt',
    'cover_image_alt',
    'body_images',
    'internal_links',
  ],
  properties: {
    title: { type: 'string' },
    excerpt: { type: 'string' },
    seo_title: { type: 'string' },
    seo_description: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    category_id: { type: 'integer', minimum: 0 },
    body_html: { type: 'string' },
    cover_image_prompt: { type: 'string' },
    cover_image_alt: { type: 'string' },
    body_images: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['slot', 'prompt', 'alt'],
        properties: {
          slot: { type: 'integer' },
          prompt: { type: 'string' },
          alt: { type: 'string' },
        },
      },
    },
    internal_links: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['url', 'anchor'],
        properties: {
          url: { type: 'string' },
          anchor: { type: 'string' },
        },
      },
    },
  },
};

export type OutlineInput = {
  keyword?: string;
  targetUrl?: string;
  requestedTitle?: string;
  topic?: string;
  supportKeywords?: string[];
  wordCount?: number;
  keywordInTitle?: boolean;
  contentType?: string;
  searchIntent?: string;
  tone?: string;
  pointOfView?: string;
  targetCountry?: string;
  readability?: string;
  structureDepth?: string;
  allowH3?: boolean;
  includeFaq?: boolean;
  includeTakeaways?: boolean;
  introHook?: string;
  notes?: string;
};

export function outlinePrompt(input: OutlineInput) {
  const depthRule = input.structureDepth === 'deep'
    ? 'Crie de 7 a 12 headings no total.'
    : input.structureDepth === 'compact'
      ? 'Crie de 3 a 5 headings no total.'
      : 'Crie de 4 a 8 headings no total.';

  const instructions = `
Voce e um editor SEO experiente de um portal brasileiro. Planeje o artigo, mas NAO escreva o texto completo.

Regras obrigatorias:
- O titulo e o H1 do WordPress; nunca crie H1 dentro de headings.
- Se titulo estiver vazio, crie um titulo editorial natural. Se houver titulo manual, preserve exatamente.
- ${input.keywordInTitle !== false && input.keyword ? `Quando o titulo for gerado automaticamente, inclua naturalmente a expressao exata \"${input.keyword}\" no titulo.` : 'Nao e obrigatorio colocar a palavra-chave principal no titulo.'}
- Se tema/briefing estiver vazio, infira um tema forte a partir da palavra-chave, URL e intencao de busca.
- headings pode conter apenas H2 e H3 e deve ficar na ordem final do artigo.
- Cada H3 precisa pertencer ao H2 anterior.
- Nao repita a palavra-chave de forma artificial.
- Nao crie "Conclusao" por padrao; so use se o contexto realmente pedir.
- ${depthRule}
- ${input.allowH3 === false ? 'Use somente H2.' : 'Use H3 apenas quando houver subtopico real.'}
- ${input.includeFaq ? 'Inclua uma secao de perguntas frequentes quando fizer sentido.' : 'Nao crie FAQ automaticamente.'}
- ${input.includeTakeaways ? 'Pode incluir uma secao curta de pontos principais quando fizer sentido.' : 'Nao force uma secao de pontos principais.'}
- Escreva tudo em portugues brasileiro natural.
`;

  const user = [
    `Palavra-chave principal: ${input.keyword || 'nao informada'}`,
    `URL associada: ${input.targetUrl || 'nao informada'}`,
    `Titulo manual: ${input.requestedTitle || 'GERAR AUTOMATICAMENTE'}`,
    `Tema/briefing: ${input.topic || 'GERAR AUTOMATICAMENTE'}`,
    `Palavras de apoio: ${(input.supportKeywords || []).join(', ') || 'nenhuma'}`,
    `Tamanho aproximado futuro: ${Math.max(300, Math.min(800, Number(input.wordCount || 800)))} palavras (nunca ultrapassar 800)`,
    `Tipo de conteudo: ${input.contentType || 'automatico'}`,
    `Intencao de busca: ${input.searchIntent || 'automatico'}`,
    `Tom: ${input.tone || 'editorial'}`,
    `Ponto de vista: ${input.pointOfView || 'automatico'}`,
    `Pais-alvo: ${input.targetCountry || 'Brasil'}`,
    `Legibilidade: ${input.readability || 'padrao'}`,
    `Gancho de abertura: ${input.introHook || 'automatico'}`,
    `Orientacoes extras: ${input.notes || 'nenhuma'}`,
  ].join('\n');

  return { instructions, user };
}

export function articlePrompt(input: {
  keyword: string;
  targetUrl: string;
  title: string;
  topic: string;
  supportKeywords: string[];
  outline: { headings?: Array<{ level: 'h2' | 'h3'; text: string }> };
  config: Record<string, any>;
  categories: Array<{ id: number; name: string }>;
  recentPosts: Array<{ url: string; title: string }>;
}) {
  const cfg = input.config || {};
  const headings = (input.outline?.headings || []).map((h) => `${h.level.toUpperCase()}: ${h.text}`).join('\n');
  const categories = input.categories.map((c) => `${c.id} = ${c.name}`).join('\n') || 'nenhuma';
  const internalCandidates = input.recentPosts.slice(0, 50).map((p) => `${p.title} | ${p.url}`).join('\n') || 'nenhum';
  const imageCount = Math.max(0, Math.min(8, Number(cfg.body_images || 0)));
  const wordTarget = Math.max(300, Math.min(800, Number(cfg.word_count || 800)));
  const internalCount = Math.max(0, Math.min(5, Number(cfg.internal_links || 0)));

  const instructions = `
Voce escreve artigos SEO para um portal brasileiro com padrao editorial profissional. Gere o artigo final em HTML limpo para WordPress.

Regras de escrita:
- Portugues brasileiro natural, claro e editorial.
- Paragrafos curtos, normalmente 1 a 3 frases, sem ritmo mecanico.
- Nao use frases vazias como "no mundo atual", "em um cenario cada vez mais" ou conclusoes genericas.
- Nao invente estatisticas, estudos, leis, datas ou falas. Se pesquisa web estiver ativa, use fatos verificaveis e atuais.
- O titulo e o H1 do WordPress. NAO inclua <h1> no body_html.
- O campo title final deve preservar o titulo aprovado informado abaixo.
- Use SOMENTE as headings aprovadas abaixo, na mesma ordem. Nao recrie headings que foram excluidas pelo editor.
- Preserve o texto das headings aprovadas, salvo pequenos ajustes gramaticais indispensaveis.
- Use <h2>, <h3>, <p>, <ul>, <ol>, <strong>, <em>, <blockquote> e <table> apenas quando configurado e realmente util.
- Nao coloque links em headings.
- A palavra-chave principal deve aparecer naturalmente; evite keyword stuffing.
- Se houver URL associada, a palavra-chave principal deve aparecer no corpo como ancora natural para essa URL. O backend tambem validara isso.
- Gere exatamente ${imageCount} sugestoes de imagem interna. No body_html, posicione os marcadores [[IMAGE_1]], [[IMAGE_2]]... em locais naturais entre secoes, nunca dentro de tags.
- Gere um prompt de capa editorial sem texto escrito na imagem, salvo se o briefing pedir explicitamente.
- Para imagens, nao invente logotipos nem marcas nao solicitadas.
- Se nenhuma categoria for adequada, retorne category_id = 0.
- Selecione no maximo ${internalCount} links internos entre os candidatos fornecidos, somente quando forem semanticamente relevantes. Retorne URL e uma ancora curta que realmente possa aparecer no texto.
- SEO title deve ser atraente e objetivo; meta description deve resumir a pagina naturalmente.
- O corpo do artigo deve ter no maximo 800 palavras. Mire em aproximadamente ${wordTarget} palavras e NUNCA ultrapasse 800, mesmo que o briefing peca mais.
- Se precisar escolher entre extensao e qualidade, priorize clareza, naturalidade e informacao util dentro do limite.
`;

  const user = `
Palavra-chave principal: ${input.keyword || 'nao informada'}
URL correspondente: ${input.targetUrl || 'nenhuma'}
Titulo aprovado: ${input.title || 'criar automaticamente'}
Tema/briefing: ${input.topic || 'inferir automaticamente'}
Palavras de apoio: ${input.supportKeywords.join(', ') || 'nenhuma'}
Tamanho desejado: cerca de ${wordTarget} palavras; limite absoluto: 800 palavras
Tipo de conteudo: ${cfg.content_type || 'automatico'}
Intencao: ${cfg.search_intent || 'automatico'}
Tom: ${cfg.tone || 'editorial'}
Ponto de vista: ${cfg.point_of_view || 'automatico'}
Legibilidade: ${cfg.readability || 'padrao'}
Gancho da introducao: ${cfg.intro_hook || 'automatico'}
Conclusao: ${cfg.include_conclusion === false ? 'nao criar secao exclusiva de conclusao' : 'pode encerrar naturalmente'}
FAQ: ${cfg.include_faq ? 'permitido conforme outline' : 'nao criar se nao estiver no outline'}
Listas: ${cfg.use_lists === false ? 'evitar' : 'usar apenas quando melhorarem a leitura'}
Tabelas: ${cfg.use_tables ? 'permitidas quando realmente uteis' : 'nao usar'}
Negrito: ${cfg.use_bold === false ? 'evitar' : 'usar com moderacao'}
Orientacoes extras: ${cfg.notes || 'nenhuma'}

HEADINGS APROVADAS:
${headings || '(nenhuma heading aprovada; escreva o artigo sem criar H2/H3)'}

CATEGORIAS DISPONIVEIS:
${categories}

CANDIDATOS A LINK INTERNO:
${internalCandidates}
`;

  return { instructions, user };
}
