# SEO Content Studio

Sistema privado para gerar artigos SEO em lote usando a API da OpenAI, com histórico no Supabase e deploy no Netlify.

## O que o sistema faz

Na tela de criação você informa somente:

- quantidade de textos (1 a 120);
- se deve criar imagem de capa;
- palavra-chave;
- URL que será aplicada nessa palavra-chave;
- se o título deve conter a palavra-chave exata;
- um **direcionamento livre para a IA**, onde você pode determinar tom, público, formato, abordagem, estrutura, pontos obrigatórios e até um alvo menor de palavras.

O sistema então:

1. cria artigos em português do Brasil com até 800 palavras (alvo aproximado de 650 a 780);
2. estrutura o conteúdo com introdução, H2/H3, listas quando úteis e boa escaneabilidade;
3. cria meta description e resumo;
4. insere exatamente um link na palavra-chave, de forma natural;
5. evita keyword stuffing e repetição mecânica;
6. varia o ângulo e o título dos textos de um mesmo lote;
7. opcionalmente gera uma capa 16:9 usando a API de imagens da OpenAI;
8. salva tudo no Supabase;
9. mantém uma área persistente de **Gerações**, mostrando todos os lotes **na fila**, **em andamento**, **pausando** ou **pausados**, inclusive depois de atualizar a página;
10. permite **Pausar**, **Retomar** e **Pausar todas** as gerações ativas;
11. mantém uma aba de histórico com busca, visualização, copiar texto formatado, copiar HTML, excluir individualmente e **Excluir todos**.

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
3. Na aba **Criar textos**, informe os campos básicos e, se quiser, escreva o **Direcionamento para a IA**.
4. Clique em **Gerar textos**.
5. O processamento ocorre em Background Function e a área **Gerações** mostra todos os lotes ativos. Eles não somem quando outro lote é criado ou quando a página é atualizada.
6. Para interromper temporariamente um lote, use **Pausar**. Se um artigo já estiver sendo criado, ele pode terminar antes da pausa; nenhum novo artigo será iniciado depois que a pausa for reconhecida. Use **Retomar** para continuar.
7. Abra **Meus textos**.
8. Clique em qualquer artigo.
9. Use:
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
│       ├── delete-all-articles.mjs
│       ├── generate-background.mjs
│       ├── health.mjs
│       ├── job.mjs
│       ├── jobs.mjs
│       ├── pause-job.mjs
│       ├── resume-job.mjs
│       └── start-job.mjs
├── supabase/
│   ├── schema.sql
│   ├── update-limit-120.sql
│   ├── update-direcionamento.sql
│   └── update-fila-pausa.sql
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

## Atualização: direcionamento livre e exclusão de textos

Se seu Supabase já estava configurado antes desta versão, execute **uma única vez** no SQL Editor:

`supabase/update-direcionamento.sql`

Depois substitua os arquivos do GitHub pelos desta versão e aguarde o novo deploy do Netlify. Não é necessário recriar o projeto, as chaves ou as tabelas.

Na aba **Meus textos**, cada item agora possui um botão **Excluir**, e no topo há **Excluir todos**. Ao excluir um artigo, a imagem de capa vinculada também é apagada do Storage. A exclusão total é bloqueada enquanto houver uma geração em andamento, para evitar que novos textos reapareçam durante a limpeza.


## Atualização: gerações persistentes, fila e pausa

Se o Supabase já estava configurado antes desta versão, execute **uma única vez** no SQL Editor:

`supabase/update-fila-pausa.sql`

Depois publique os arquivos desta versão no GitHub/Netlify. Não é necessário recriar o Supabase nem alterar as chaves.

A área **Gerações** consulta os jobs diretamente no Supabase a cada poucos segundos, portanto todos os lotes com status **Na fila**, **Em andamento**, **Pausando** ou **Pausada** continuam visíveis mesmo depois de recarregar o site.

A pausa é cooperativa: se a solicitação chegar enquanto a OpenAI já está criando um texto (ou uma capa), esse item pode terminar e ser salvo. O worker então reconhece a pausa e não inicia o próximo item. Isso evita interromper um artigo pela metade e permite retomar do ponto já concluído.

## Correção: pausa imediata + exclusão com geração ativa

Esta versão corrige dois comportamentos da versão anterior:

- **Pausa imediata:** o job muda para `paused` na própria requisição de pausa. A coluna `run_version` invalida workers antigos, impedindo que uma execução anterior grave novos textos após a pausa.
- **Excluir todos:** a exclusão não é mais bloqueada por jobs ativos. O backend apaga somente os textos que já existiam no instante do clique; se uma geração continuar ativa, textos criados depois desse instante podem voltar a aparecer.
- **Excluir um texto:** uma falha ao remover a imagem do Storage não impede a exclusão do texto da biblioteca.

Para atualizar uma instalação existente, execute primeiro `supabase/update-pausa-exclusao-fix.sql` no SQL Editor do Supabase e depois publique esta versão no Netlify.
