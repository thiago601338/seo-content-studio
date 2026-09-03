# Revista Ideal IA Studio

Aplicacao de producao de artigos SEO para **Netlify + Supabase**, com OpenAI, WordPress e Google Drive.

O fluxo foi desenhado para nao obrigar a publicacao. Todo artigo gerado fica salvo na aba **Textos** e, em cada lote, voce escolhe os destinos:

- somente Textos;
- Textos + WordPress;
- Textos + Google Drive;
- Textos + WordPress + Google Drive.

## Recursos principais

- Geracao em lote com palavra-chave, titulo opcional, palavras de apoio, briefing opcional e URL correspondente.
- Tema e titulo automaticos quando os campos ficam vazios.
- Geracao previa de titulo + H2/H3.
- Editor de headings antes da redacao: editar, excluir, mudar H2/H3, mover e adicionar.
- Capa opcional e de 0 a 8 imagens no corpo.
- Aba **Textos** com biblioteca de tudo que ja foi gerado.
- Visualizacao do artigo, copiar texto, copiar HTML e baixar HTML.
- Publicacao WordPress opcional no momento da geracao ou depois, pela aba Textos.
- Google Drive opcional no momento da geracao ou depois, pela aba Textos.
- Google Docs com titulo, texto, links, capa e imagens internas.
- Documentos do Drive liberados automaticamente como **qualquer pessoa com o link pode visualizar**.
- Coluna com link do WordPress e coluna com link do Google Drive.
- Fila e historico no Supabase.
- Processamento longo em Netlify Background Functions.
- Varios sites WordPress.
- Supabase Auth + RLS.
- Credenciais WordPress e tokens Google OAuth criptografados com AES-256-GCM.

## Arquitetura

```text
React / Netlify
     |
     +---- Supabase Auth + Postgres + Storage
     |
     +---- Netlify Functions ---- OpenAI
     |                     |
     |                     +---- WordPress REST API (opcional)
     |                     +---- Google Drive + Google Docs (opcional)
     |
     +---- Aba Textos
```

As chaves privadas nao sao enviadas ao navegador.

---

## 1. GitHub

Crie um repositorio vazio e envie o conteudo desta pasta.

```bash
git init
git add .
git commit -m "Revista Ideal IA Studio 2.1.0"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/revistaideal-ai-studio.git
git push -u origin main
```

Nao envie `.env`.

---

## 2. Supabase

Crie um projeto e execute, nesta ordem, no **SQL Editor**:

```text
supabase/migrations/001_init.sql
supabase/migrations/002_texts_drive_destinations.sql
```

A segunda migration:

- permite artigos sem site WordPress;
- adiciona destinos WordPress/Drive;
- adiciona links do Google Drive;
- adiciona capa e midias geradas;
- cria tabelas seguras de OAuth do Google;
- cria o bucket `article-media` para as imagens geradas.

O bucket de imagens e publico porque o Google Docs precisa buscar essas imagens por URL ao montar o documento. Os nomes usam UUIDs de usuario/artigo e nao sao listados publicamente pela aplicacao.

Crie seu usuario em **Authentication -> Users**. Para uso privado, desative cadastro publico.

Copie:

- Project URL;
- Publishable Key;
- Secret Key.

---

## 3. Netlify

Importe o repositorio GitHub no Netlify. O `netlify.toml` ja configura:

- build: `npm run build`;
- publish: `dist`;
- functions: `netlify/functions`;
- scheduled queue dispatcher.

Cadastre as variaveis:

```text
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
OPENAI_API_KEY=sk-...
OPENAI_TEXT_MODEL=gpt-5.6-terra
OPENAI_IMAGE_MODEL=gpt-image-2
SITES_ENCRYPTION_KEY=...
INTERNAL_DISPATCH_SECRET=...
APP_URL=https://SEU-APP.netlify.app
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

Gerar chave de criptografia:

```bash
openssl rand -base64 32
```

Gerar segredo interno:

```bash
openssl rand -hex 32
```

---

## 4. Conectar Google Drive

No Google Cloud Console:

1. Crie ou selecione um projeto.
2. Ative **Google Drive API**.
3. Ative **Google Docs API**.
4. Configure a tela de consentimento OAuth.
5. Crie um **OAuth Client ID -> Web application**.
6. Em Authorized redirect URIs, cadastre exatamente:

```text
https://SEU-APP.netlify.app/api/google-drive-callback
```

7. Copie Client ID e Client Secret para `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no Netlify.
8. Configure `APP_URL` com a URL publica do app, sem barra final.
9. Faça um novo deploy.
10. Entre no sistema e abra **Configuracoes -> Google Drive -> Conectar Google Drive**.

A aplicacao solicita `drive.file`, que permite criar e administrar os arquivos usados pela propria aplicacao.

Quando um Google Doc e criado, a aplicacao cria uma permissao `anyone / reader`, portanto o link da coluna Drive abre para qualquer pessoa que receba esse link.

---

## 5. WordPress opcional

O WordPress nao e mais obrigatorio para gerar um artigo.

Para publicar em um site:

1. No WordPress, abra **Usuarios -> Perfil**.
2. Crie uma **Application Password**.
3. No app, abra **Sites WordPress**.
4. Cadastre URL, usuario e Application Password.
5. Teste/sincronize o site.

O companion plugin em `wordpress-connector/` continua opcional e serve para os metadados SEO do tema Revista Ideal.

---

## 6. Fluxo de uso

Na tela **Gerar artigos**:

1. Cole palavras-chave.
2. Opcionalmente informe titulos, palavras de apoio, briefing e URLs.
3. Monte a lista.
4. Gere os titulos + headings.
5. Edite/exclua H2/H3.
6. Configure texto, SEO e imagens.
7. Em **Destinos e publicacao**, escolha:
   - Salvar em Textos: sempre ativo;
   - Publicar no WordPress: opcional;
   - Criar Google Doc: opcional.
8. Gere os artigos.

### Se escolher somente Textos

O artigo e gerado normalmente e fica em **Textos**. Depois voce pode:

- abrir;
- copiar texto;
- copiar HTML;
- baixar HTML;
- escolher um WordPress e publicar;
- criar o Google Doc posteriormente.

### Se escolher Google Drive

O Google Doc recebe:

- titulo;
- excerpt, quando houver;
- texto completo;
- headings;
- hyperlinks;
- imagem de capa, se a capa foi ativada;
- imagens internas, se foram ativadas.

O link aparece na coluna **Google Drive** da aba Textos e tambem no historico.

---

## 7. Desenvolvimento local

Use Node.js 22.

```bash
npm install
cp .env.example .env
npm run dev
```

Validacao:

```bash
npm run typecheck
npm run build
```

---

## 8. Seguranca

- `SUPABASE_SECRET_KEY`, OpenAI e Google Client Secret ficam somente no Netlify.
- Application Passwords WordPress ficam criptografadas.
- Access/refresh tokens Google ficam criptografados.
- RLS protege sites, lotes, presets e artigos por usuario.
- A tabela de tokens Google nao e acessivel pelo navegador.
- Os Google Docs sao publicos por link somente quando voce manda criar o documento.
- O WordPress nunca recebe um artigo se **Publicar no WordPress** estiver desativado.
