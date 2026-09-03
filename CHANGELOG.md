# Changelog

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
