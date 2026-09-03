# Checklist de publicacao - Revista Ideal IA Studio 3.0

## Obrigatorio

- [ ] Criar um repositorio novo no GitHub e enviar o conteudo do ZIP para a raiz.
- [ ] Criar um projeto NOVO no Supabase para esta versao.
- [ ] Executar `supabase/000_SETUP_COMPLETO.sql` no SQL Editor.
- [ ] Criar/invitar seu usuario em Supabase Auth.
- [ ] Copiar URL, Publishable Key e Secret Key do Supabase.
- [ ] Criar/configurar uma OpenAI API Key com billing ativo.
- [ ] Gerar `SITES_ENCRYPTION_KEY` e `INTERNAL_DISPATCH_SECRET`.
- [ ] Importar o repositorio GitHub no Netlify.
- [ ] Cadastrar todas as variaveis obrigatorias mostradas em `.env.example`.
- [ ] Definir `APP_URL` com a URL final `.netlify.app`.
- [ ] Fazer um novo deploy depois de cadastrar as variaveis.
- [ ] Entrar no sistema com o usuario do Supabase Auth.
- [ ] Testar primeiro 1 artigo, sem WordPress, sem Drive e sem imagens.
- [ ] Conferir o fluxo `Na fila -> Em andamento -> Concluido`.
- [ ] Testar Pausar e Retomar.
- [ ] Conferir o artigo em `Textos` e testar Excluir.
- [ ] Somente depois testar lotes maiores.

## Google Drive - opcional

- [ ] Ativar Google Drive API e Google Docs API no Google Cloud.
- [ ] Criar OAuth Client ID Web.
- [ ] Cadastrar `https://SEU-SITE.netlify.app/api/google-drive-callback` como redirect URI.
- [ ] Cadastrar `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no Netlify.
- [ ] Fazer novo deploy e conectar em `Configuracoes`.

## WordPress - opcional

- [ ] Criar Application Password no usuario WordPress.
- [ ] Cadastrar o site na aba `Sites WordPress`.
- [ ] Testar conexao antes de publicar em lote.
