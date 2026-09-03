# 3.0.2

- Corrige tipagem de `import.meta.env` no build Vite/TypeScript.
- Move a configuracao `background = true` de `process-article` para `netlify.toml`, evitando incompatibilidade de tipos com versoes antigas de `@netlify/functions`.
- Mantem `/api/process-article` como Background Function via configuracao do Netlify.

# Changelog

## 3.0.0

- Interface e fluxo mantidos a partir do Revista Ideal IA Studio 2.1 enviado como referencia.
- Ate 120 artigos por lote e limite absoluto de 800 palavras por artigo.
- Campo Quantidade para gerar varias abordagens a partir de uma unica entrada.
- Variacoes do mesmo termo recebem orientacao editorial distinta para reduzir repeticao entre artigos.
- Opcao de exigir a palavra-chave no titulo quando o titulo for automatico.
- Direcionamento geral livre para a IA e briefing individual por linha.
- Geracao previa de titulo, H2 e H3 com editor de estrutura.
- Biblioteca Textos com exclusao individual e Exclusao de todos.
- Fila persistente no Supabase com estados na fila, em andamento, pausado, concluido, erro e cancelado.
- Pausa e retomada imediatas por artigo e em massa, usando run_version para invalidar workers antigos.
- Checkpoints de texto e midia para retomar sem recomecar o que ja foi salvo.
- Dispatcher redundante da fila e processamento controlado em pequenos grupos.
- WordPress e Google Drive continuam opcionais.
- Novo SQL unico `supabase/000_SETUP_COMPLETO.sql` para instalacao em projeto Supabase novo.


## 2.1.0

- Nova aba `Textos` com biblioteca independente do WordPress.
- Geracao de artigo sem selecionar ou publicar em site.
- Destinos independentes: Textos, WordPress e Google Drive.
- Publicacao WordPress pode acontecer na geracao ou depois.
- OAuth 2.0 do Google Drive no backend Netlify.
- Criacao automatica de Google Docs.
- Compartilhamento automatico `anyone / reader`.
- Coluna com link do Google Drive.
- Capa e imagens internas inseridas no Google Doc.
- Midias geradas persistidas no Supabase Storage.
- Retry pode retomar destinos sem precisar perder o texto ja salvo.

## 2.0.0

- Aplicacao separada do WordPress, preparada para Netlify + Supabase.
- Autenticacao via Supabase Auth.
- Varios sites WordPress por usuario.
- Credenciais WordPress criptografadas no backend.
- Geracao em lote com palavra-chave, link, titulo, apoio e briefing opcionais.
- Geracao previa e edicao de H2/H3.
- Fila e historico persistidos no Supabase.
- Processamento longo via Netlify Background Functions.
- Geracao de texto com OpenAI e imagens com GPT Image.
- Publicacao via WordPress REST API e Application Passwords.
