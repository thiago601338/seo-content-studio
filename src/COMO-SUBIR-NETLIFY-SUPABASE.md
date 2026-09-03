# COMO SUBIR O REVISTA IDEAL IA STUDIO

Este projeto foi preparado para rodar em:

- GitHub: codigo-fonte;
- Netlify: frontend + Functions;
- Supabase: login, banco, fila e Storage;
- OpenAI API: textos e imagens;
- Google Drive/Docs: opcional;
- WordPress: opcional.

> IMPORTANTE: se voce ja usava o sistema antigo deste chat, crie um PROJETO SUPABASE NOVO para esta versao. O esquema de banco e diferente e reaproveitar as tabelas antigas pode causar conflito.

---

## 1. Extraia o ZIP

Extraia a pasta do projeto no computador. Na raiz devem aparecer arquivos como:

```text
.github/
netlify/
public/
src/
supabase/
wordpress-connector/
.env.example
index.html
netlify.toml
package.json
vite.config.ts
```

Nao envie uma pasta extra envolvendo tudo. No GitHub, `package.json` e `netlify.toml` devem ficar na raiz do repositorio.

---

## 2. Crie o repositorio no GitHub

Crie um repositorio novo, de preferencia privado.

Nome sugerido:

```text
revistaideal-ai-studio
```

Depois envie TODO o conteudo da pasta extraida para a raiz do repositorio.

Se usar Git pelo terminal:

```bash
git init
git add .
git commit -m "Revista Ideal IA Studio"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/revistaideal-ai-studio.git
git push -u origin main
```

Nunca envie um arquivo `.env` com chaves reais. O `.gitignore` ja bloqueia esse arquivo.

---

## 3. Crie um NOVO projeto no Supabase

No Supabase:

1. New project;
2. escolha a organizacao;
3. nomeie o projeto;
4. defina uma senha forte do banco;
5. aguarde a criacao terminar.

Depois abra:

```text
SQL Editor -> New query
```

Dentro deste projeto existe o arquivo:

```text
supabase/000_SETUP_COMPLETO.sql
```

Abra esse arquivo, copie TODO o conteudo, cole no SQL Editor e clique em `Run`.

Esse SQL cria:

- sites;
- site_secrets;
- presets;
- batches;
- articles;
- fila persistente;
- estados `queued`, `processing`, `paused`, `completed`, `error` e `cancelled`;
- controles para pausa/retomada;
- conexao Google Drive;
- bucket `article-media`;
- RLS e permissoes.

---

## 4. Crie seu usuario de login

No Supabase abra:

```text
Authentication -> Users
```

Adicione/invite o seu e-mail e conclua a definicao da senha.

O sistema NAO usa mais `APP_PASSWORD`. O login agora e feito por e-mail e senha do Supabase Auth.

Para um sistema privado, nao deixe cadastro publico aberto para qualquer pessoa.

---

## 5. Copie as chaves do Supabase

No Supabase, use o botao `Connect` ou:

```text
Settings -> API Keys
```

Voce vai precisar de:

### URL do projeto

Exemplo:

```text
https://abcdefgh.supabase.co
```

Ela sera usada duas vezes:

```text
VITE_SUPABASE_URL
SUPABASE_URL
```

### Publishable key

Comeca normalmente com:

```text
sb_publishable_
```

Use em:

```text
VITE_SUPABASE_PUBLISHABLE_KEY
```

Essa chave pode ir para o frontend porque o acesso real aos dados e protegido por login + RLS.

### Secret key

Comeca normalmente com:

```text
sb_secret_
```

Use em:

```text
SUPABASE_SECRET_KEY
```

Essa chave e secreta e deve existir SOMENTE nas variaveis do Netlify.

---

## 6. Crie a chave da OpenAI API

Na OpenAI Platform:

1. configure Billing;
2. crie uma API Key;
3. guarde a chave `sk-...`.

Variavel:

```text
OPENAI_API_KEY
```

Modelos padrao deste projeto:

```text
OPENAI_TEXT_MODEL=gpt-5.6-terra
OPENAI_IMAGE_MODEL=gpt-image-2
```

No painel do sistema voce ainda pode escolher GPT-5.6 Terra, Sol ou Luna para cada lote.

---

## 7. Gere os dois segredos internos

Voce precisa de:

```text
SITES_ENCRYPTION_KEY
INTERNAL_DISPATCH_SECRET
```

### No Windows PowerShell

Para gerar `SITES_ENCRYPTION_KEY` com exatamente 32 bytes em Base64:

```powershell
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

Copie apenas a ultima linha mostrada pelo PowerShell.

Para `INTERNAL_DISPATCH_SECRET`:

```powershell
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
-join ($bytes | ForEach-Object { $_.ToString('x2') })
```

Guarde os dois valores. Nao os coloque no GitHub.

---

## 8. Importe o GitHub no Netlify

No Netlify:

```text
Add new project -> Import an existing project -> GitHub
```

Selecione o repositorio criado.

O arquivo `netlify.toml` ja define:

```text
Build command: npm run build
Publish directory: dist
Functions: netlify/functions
Node: 22
```

Nao mude essas configuracoes sem necessidade.

---

## 9. Cadastre as variaveis no Netlify

No projeto do Netlify abra:

```text
Project configuration -> Environment variables
```

Adicione:

```text
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
OPENAI_API_KEY=sk-...
OPENAI_TEXT_MODEL=gpt-5.6-terra
OPENAI_IMAGE_MODEL=gpt-image-2
SITES_ENCRYPTION_KEY=SEU_VALOR_BASE64
INTERNAL_DISPATCH_SECRET=SEU_SEGREDO_HEX
```

Depois que o Netlify criar a URL final do site, adicione tambem:

```text
APP_URL=https://nome-do-site.netlify.app
```

Nao use barra `/` no final.


Se o Netlify oferecer escolha de escopo, a opcao mais simples e usar **All scopes**. Se preferir separar: `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` precisam do escopo **Builds**; as chaves secretas e os segredos internos precisam do escopo **Functions**. Nunca use `SUPABASE_SECRET_KEY` ou `OPENAI_API_KEY` como variavel `VITE_*`.

Depois de adicionar ou alterar variaveis, faca um novo deploy.

---

## 10. Primeiro teste

Abra o endereco `.netlify.app`.

Entre com o e-mail e senha que voce criou no Supabase Auth.

Teste primeiro assim:

1. 1 palavra-chave;
2. sem WordPress;
3. sem Google Drive;
4. 500 a 800 palavras;
5. sem imagem de corpo;
6. capa desativada no primeiro teste;
7. gere o titulo + headings;
8. gere o artigo.

Abra `Fila e historico` e confira:

```text
Na fila -> Em andamento -> Concluido
```

Depois abra `Textos` e confira o artigo.

---

## 11. O que esta versao suporta

- ate 120 artigos por lote;
- campo Quantidade para criar ate 120 variacoes a partir de uma unica entrada;
- opcao de exigir a palavra-chave no titulo automatico;
- no maximo 800 palavras por artigo;
- hard cap de 800 palavras tambem no backend;
- varias palavras-chave e URLs alinhadas;
- titulo opcional;
- palavras de apoio;
- briefing por texto;
- direcionamento geral para todo o lote;
- tema e titulo automaticos quando ficam vazios;
- geracao previa de H2/H3;
- o planejamento previo e opcional; sem preview, o backend cria titulo + H2/H3 depois que o artigo ja entrou na fila, inclusive em lotes grandes;
- editar, excluir, mover e trocar H2/H3 antes de escrever;
- capa opcional;
- ate 8 imagens internas;
- texto sempre salvo na aba Textos;
- copiar texto;
- copiar HTML;
- baixar HTML;
- excluir um texto;
- excluir todos os textos;
- fila persistente no Supabase;
- posicao na fila;
- pausar um item;
- retomar um item;
- pausar todos;
- retomar pausados;
- continuar geracao mesmo depois de atualizar/fechar a pagina;
- publicar no WordPress opcionalmente;
- criar Google Docs opcionalmente;
- links do WordPress e Drive na biblioteca.

---

## 12. Google Drive - opcional

So faca depois que o sistema basico estiver funcionando.

No Google Cloud:

1. crie/selecione um projeto;
2. ative Google Drive API;
3. ative Google Docs API;
4. configure OAuth consent;
5. crie `OAuth Client ID -> Web application`;
6. adicione como redirect URI EXATAMENTE:

```text
https://SEU-SITE.netlify.app/api/google-drive-callback
```

No Netlify adicione:

```text
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
APP_URL=https://SEU-SITE.netlify.app
```

Faca novo deploy.

Depois entre no sistema:

```text
Configuracoes -> Google Drive -> Conectar Google Drive
```

---

## 13. WordPress - opcional

No WordPress:

```text
Usuarios -> Perfil -> Application Passwords
```

Crie uma senha de aplicativo.

No IA Studio abra:

```text
Sites WordPress
```

Cadastre:

- nome;
- URL do site;
- usuario;
- Application Password.

Teste a conexao.

O plugin em:

```text
wordpress-connector/revistaideal-ai-connector.php
```

continua opcional e pode ser instalado se voce quiser integrar metadados adicionais do tema/plugin Revista Ideal.

---

## 14. Se der tela em branco

No Netlify abra:

```text
Deploys -> deploy mais recente -> Deploy log
```

Procure o primeiro erro.

Tambem abra o site e use:

```text
F12 -> Console
```

Se aparecer erro de Supabase, confira principalmente:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Se aparecer erro nas Functions, confira:

```text
SUPABASE_URL
SUPABASE_SECRET_KEY
OPENAI_API_KEY
INTERNAL_DISPATCH_SECRET
```

---

## 15. Se a fila nao continuar sozinha

Confira se existe no Netlify:

```text
INTERNAL_DISPATCH_SECRET
```

O sistema inicia alguns artigos simultaneamente e os demais ficam em `Na fila`. Conforme cada artigo termina, outro e chamado automaticamente. Existe tambem um dispatcher agendado como redundancia.

---

## 16. Atualizacoes futuras

Como Netlify esta conectado ao GitHub, para atualizar o sistema depois basta substituir/editar os arquivos no repositorio e fazer commit/push.

Cada push na branch principal gera um novo deploy automaticamente.
