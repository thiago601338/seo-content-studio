# Atualizacao 3.1.0 - imagens mais rapidas

Nao existe migration nova do Supabase para esta versao.

## O que mudou

- `Rapida` passa a ser o modo padrao do Media Hub.
- Qualidade `low` no modo rapido.
- Imagens retornam em JPEG comprimido.
- Prompts de imagem sao encurtados no modo rapido.
- Ate 2 imagens do mesmo artigo sao geradas ao mesmo tempo.
- A fila atualiza o status a cada 10 segundos enquanto a OpenAI ainda esta renderizando.
- `Equilibrada` e `Qualidade maxima` continuam disponiveis.

## Como atualizar

1. Extraia o ZIP da versao 3.1.0.
2. No GitHub, substitua os arquivos do projeto pelos arquivos desta versao.
3. Confirme que `package.json` mostra `"version": "3.1.0"`.
4. Nao rode nenhum SQL novo.
5. No Netlify, use `Deploys -> Trigger deploy -> Clear cache and deploy site`.
6. Depois do deploy, abra o sistema e pressione `Ctrl + F5`.
7. Em `Gerar artigos -> Media Hub`, mantenha `Velocidade das imagens = Rapida - recomendada`.

## Jobs que ja estavam rodando

Uma Function que ja estava executando antes do novo deploy continua com o codigo antigo ate terminar. Se um artigo estiver preso na etapa antiga de imagem, pause esse artigo, aguarde o novo deploy e clique em Retomar. O job retomado usa a versao nova.

Jobs que ainda estiverem apenas `Na fila` usarao a versao nova quando forem iniciados depois do deploy.
