# Atualizacao 3.2.0 - Perfis de configuracao

Esta versao nao exige SQL novo e nao exige novas variaveis do Netlify.

## Como atualizar

1. Substitua os arquivos do repositorio pelos arquivos desta versao.
2. Confirme que `package.json` mostra `3.2.0`.
3. Faça commit no GitHub.
4. No Netlify, use `Deploys -> Trigger deploy -> Clear cache and deploy site`.
5. Abra o sistema e use `Ctrl + F5`.

## Como usar

1. Abra **Gerar artigos**.
2. No topo, use **Perfil de configuracao**.
3. Para criar um perfil, configure o gerador como quiser, escreva um nome e clique em **Criar perfil**.
4. Quando um perfil esta ativo, qualquer alteracao de configuracao e salva automaticamente nele.
5. Trocar o perfil no seletor aplica imediatamente todas as configuracoes daquele perfil.
6. Na aba **Perfis**, voce pode usar, duplicar, renomear ou excluir perfis.

Os perfis guardam configuracoes, nao os dados especificos do lote. Palavras-chave, titulos, links principais e briefings por linha continuam sendo informados a cada lote.
