# SEO Content Studio

Sistema privado para gerar artigos SEO em lote usando a API da OpenAI, com histórico no Supabase e deploy no Netlify.

## O que o sistema faz

Na tela de criação você informa somente:

- quantidade de textos (1 a 120);
- se deve criar imagem de capa;
- palavra-chave;
- URL que será aplicada nessa palavra-chave;
- se o título deve conter a palavra-chave exata.

O sistema então:

1. cria artigos em português do Brasil com até 800 palavras (alvo aproximado de 650 a 780);
2. estrutura o conteúdo com introdução, H2/H3, listas quando úteis e boa escaneabilidade;
3. cria meta description e resumo;
4. insere exatamente um link na palavra-chave, de forma natural;
5. evita keyword stuffing e repetição mecânica;
6. varia o ângulo e o título dos textos de um mesmo lote;
7. opcionalmente gera uma capa 16:9 usando a API de imagens da OpenAI;
8. salva tudo no Supabase;
9. mostra o progresso do lote;
10. mantém uma aba de histórico com busca, visualização, copiar texto formatado, copiar HTML e excluir.

> Importante: nenhuma técnica garante posição no Google. O prompt foi construído para priorizar conteúdo útil, intenção de busca, profundidade temática e leitura natural — fatores que aumentam a qualidade editorial sem prometer ranking.

---

# 1. Criar o projeto no Supabase

1. Entre no Supabase e crie um projeto.
2. Abra **SQL Editor**.
3. Copie todo o conteúdo de `supabase/schema.sql`.
4. Execute o SQL.

Esse SQL cria:

- `article_jobs`: controla os lotes de geração;
- `articles`: guarda os textos;
- bucket `article-images`: guarda as capas.

O navegador não acessa as tabelas diretamente. Toda leitura/escrita passa pelas Functions do Netlify.

## Dados que você precisa copiar do Supabase

No painel do projeto, pegue:

- **Project URL** -> será `SUPABASE_URL`;
- **Secret key** (`sb_secret_...`) -> será `SUPABASE_SECRET_KEY`.

Use a nova **Secret key**, e não coloque essa chave no frontend.

---

# 2. Criar a chave da OpenAI

Crie uma API key na plataforma da OpenAI.

Você precisará dela como:

`OPENAI_API_KEY`

O projeto usa por padrão:

- texto: `gpt-5.6-sol`;
- imagem: `gpt-image-2`.

Os dois modelos podem ser trocados depois somente alterando variáveis no Netlify, sem mexer no código.

---

# 3. Colocar o projeto no Netlify

A forma recomendada é subir esta pasta para um repositório GitHub e conectar o repositório ao Netlify.

O arquivo `netlify.toml` já está configurado com:

- build: `npm run build`;
- pasta publicada: `dist`;
- Functions: `netlify/functions`.

## Variáveis de ambiente no Netlify

Abra:

**Project configuration -> Environment variables**

Crie estas variáveis:

```env
OPENAI_API_KEY=sk-...
OPENAI_TEXT_MODEL=gpt-5.6-sol
OPENAI_IMAGE_MODEL=gpt-image-2
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
APP_PASSWORD=UMA-SENHA-FORTE-SO-SUA
```

`APP_PASSWORD` é a senha usada para entrar no painel. Ela também impede que uma pessoa que descubra a URL do site use sua API da OpenAI.

Depois das variáveis, faça um novo deploy.

---

# 4. Como usar

1. Abra o endereço do Netlify.
2. Digite a senha definida em `APP_PASSWORD`.
3. Na aba **Criar textos**, informe os cinco campos.
4. Clique em **Gerar textos**.
5. O processamento ocorre em Background Function e o painel mostra o andamento.
6. Abra **Meus textos**.
7. Clique em qualquer artigo.
8. Use:
   - **Copiar texto** para colar formatado em editores como WordPress;
   - **Copiar HTML** para usar no editor HTML do CMS.

As capas ficam armazenadas no Supabase Storage e aparecem junto do artigo.

---

# Segurança

- A `OPENAI_API_KEY` nunca é enviada para o navegador.
- A `SUPABASE_SECRET_KEY` nunca é enviada para o navegador.
- O backend exige `APP_PASSWORD` em todas as rotas.
- As tabelas do Supabase ficam com RLS ativado e sem acesso para `anon`/`authenticated`.
- A Secret key do Supabase é usada somente nas Netlify Functions.

Para um sistema com vários usuários, o próximo passo recomendado é trocar a senha única por Supabase Auth e políticas por usuário.

---

# Estrutura

```text
seo-content-studio/
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   └── styles.css
├── netlify/
│   └── functions/
│       ├── _lib/
│       │   ├── http.mjs
│       │   ├── seo.mjs
│       │   └── supabase.mjs
│       ├── article.mjs
│       ├── articles.mjs
│       ├── delete-article.mjs
│       ├── generate-background.mjs
│       ├── health.mjs
│       ├── job.mjs
│       └── start-job.mjs
├── supabase/
│   └── schema.sql
├── .env.example
├── index.html
├── netlify.toml
├── package.json
└── README.md
```

# Desenvolvimento local

Com Node.js instalado:

```bash
npm install
npm run dev
```

Para testar as Functions localmente com comportamento mais próximo do Netlify, use o Netlify CLI e as mesmas variáveis do `.env.example`.

## Atualização para 120 textos por lote

Se você já executou o `supabase/schema.sql` anteriormente, rode uma vez no SQL Editor do Supabase o arquivo:

`supabase/update-limit-120.sql`

O processamento de lotes grandes é dividido automaticamente em blocos menores para reduzir o risco de timeout das Background Functions do Netlify. Cada artigo é orientado a ficar entre cerca de 650 e 780 palavras, com limite máximo de 800 palavras no conteúdo.
