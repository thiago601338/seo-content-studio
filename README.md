# Revista Ideal IA Studio 3.0

Sistema completo de producao de artigos SEO para **Netlify + Supabase + OpenAI**, baseado no layout e no fluxo do Revista Ideal IA Studio enviado como referencia.

## Principais recursos

- ate **120 artigos por lote**;
- campo **Quantidade** para gerar variacoes de uma unica palavra-chave sem repetir linhas;
- opcao para obrigar a **palavra-chave no titulo** quando o titulo for automatico;
- limite de **800 palavras por artigo** no painel, prompt e backend;
- listas de palavras-chave, titulos, palavras de apoio, briefings e URLs;
- titulo/tema automaticos quando os campos ficam vazios;
- **Direcionamento geral da IA** para controlar estilo e regras de todo o lote;
- geracao previa de titulo + H2/H3;
- planejamento previo e opcional: se voce nao gerar a estrutura na tela, o worker cria titulo + H2/H3 automaticamente depois que o item ja esta salvo na fila;
- editor de headings antes da redacao;
- capa opcional + 0 a 8 imagens internas;
- biblioteca **Textos**;
- copiar texto, copiar HTML e baixar HTML;
- **Excluir** um texto ou **Excluir todos**;
- fila persistente no Supabase;
- posicao da fila e atualizacao em tempo real;
- **Pausar/Retomar individualmente**;
- **Pausar ativos/Retomar pausados** em massa;
- checkpoint de texto e imagens para retomada segura;
- WordPress opcional;
- Google Drive/Docs opcional;
- Auth do Supabase + RLS;
- credenciais e tokens criptografados no backend.

## Instalacao

Leia primeiro:

```text
COMO-SUBIR-NETLIFY-SUPABASE.md
```

Para um projeto novo do Supabase, execute:

```text
supabase/000_SETUP_COMPLETO.sql
```

## Estrutura

```text
React / Vite / Netlify
        |
        +-- Supabase Auth
        +-- Supabase Postgres + Realtime
        +-- Supabase Storage
        |
        +-- Netlify Functions
              |
              +-- OpenAI Responses API
              +-- OpenAI Image API
              +-- WordPress REST API (opcional)
              +-- Google Drive/Docs APIs (opcional)
```

## Variaveis principais

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
SUPABASE_URL
SUPABASE_SECRET_KEY
OPENAI_API_KEY
OPENAI_TEXT_MODEL=gpt-5.6-terra
OPENAI_IMAGE_MODEL=gpt-image-2
SITES_ENCRYPTION_KEY
INTERNAL_DISPATCH_SECRET
APP_URL
```

Google Drive, se usado:

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
```

Nunca envie chaves reais para o GitHub.


## Atualizacao 3.0.1 - Supabase existente

O instalador `supabase/000_SETUP_COMPLETO.sql` agora detecta automaticamente a tabela `articles` do SEO Content Studio antigo (sem `user_id`), arquiva as tabelas legadas com sufixo de data/hora e cria o schema novo sem apagar os textos antigos.

## Correcao de build 3.0.2

Se o Netlify mostrar `Property env does not exist on type ImportMeta` ou erro de tipo em `background`, use esta versao 3.0.2 completa. O arquivo `src/vite-env.d.ts` declara as variaveis Vite e a funcao `process-article` e marcada como background pelo `netlify.toml`.
## Imagens mais rapidas (3.1.0)

O Media Hub agora inicia em **Rapida — recomendada**. Nesse modo, as imagens usam qualidade `low`, JPEG comprimido e geracao paralela em pequenos blocos. O modo Equilibrada usa qualidade media e o modo Qualidade maxima prioriza acabamento, mas pode levar bem mais tempo.

A OpenAI informa que `quality=low` e a opcao mais rapida para GPT Image e que prompts complexos podem levar ate cerca de 2 minutos; por isso o modo rapido tambem reduz a complexidade do prompt visual.



## Perfis de configuracao (v3.2.0)

A aba **Perfis** permite manter configuracoes separadas por cliente ou tipo de conteudo. No Gerador de artigos, escolha o perfil ativo no topo da pagina. As configuracoes sao carregadas imediatamente e, enquanto o perfil permanecer ativo, qualquer alteracao de texto, IA, imagens, SEO, publicacao, Drive ou direcionamento geral e salva automaticamente naquele perfil.
