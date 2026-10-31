# TODO

Ordenado por prioridade: primeiro o que tem mais impacto com menos esforço.

## 1. Ganhos rápidos

- [x] **Armazenamento persistente**: chamar `navigator.storage.persist()` na inicialização para o navegador não apagar o IndexedDB por falta de espaço.
- [x] **Persistir filtros**: adicionar `persist` ao store de filtros (`src/lib/hooks.ts`) para eles sobreviverem ao reload. Manter a página da lista ao voltar de uma partida.
- [x] **Lance atual na URL** (`/game/:id?ply=23`): o Voltar do navegador volta à posição, o reload mantém o lance e dá para compartilhar o link.
- [x] **Seta → dentro de variante**: hoje não faz nada (`step` em `GameReview.tsx`). Deve avançar se houver lance à frente.
- [x] **Cancelar importação**: passar um `AbortController` do `SyncProvider` para `syncAccount` (que já aceita `signal`) e mostrar o botão "Cancelar".
- [ ] **Unificar profundidade do motor**: remover o `DepthSelect` da revisão ou fazê-lo usar as mesmas opções do popover do header (hoje 12–20 vs. 10–20).
- [x] **Copiar PGN / FEN e abrir no Lichess** na revisão da partida.
- [x] **Atalhos de teclado visíveis**: `?` abre um modal com todos os atalhos (incluindo `f` para virar o tabuleiro).
- [ ] **Estimativa antes de analisar em lote**: mostrar no botão "Analisar N pendentes" o tempo aproximado (usar a última velocidade medida ou uma estimativa por profundidade/workers).
- [x] **Sincronizar tudo**: botão para sincronizar todas as contas + sincronização automática ao abrir o app se a última tiver mais de X horas.
- [ ] **Partida anterior / próxima** na revisão, respeitando os filtros atuais; opção de analisar automaticamente ao abrir uma partida não analisada.
- [x] **Navegação das estatísticas no celular**: a barra lateral é `hidden lg:block`; adicionar um seletor fixo ou abas horizontais no topo.

## 2. Alto impacto, esforço médio

- [x] **Exportar / importar dados**: backup em JSON de todas as tabelas (partidas, análises, puzzles, tentativas, Pica-pau) e restauração a partir do arquivo.
- [x] **Filtros na URL**: query string como fonte de verdade dos filtros (lista de partidas e estatísticas), permitindo salvar e compartilhar visões.
- [ ] **Das estatísticas para as partidas**: clicar numa abertura, fase, dia da semana, horário etc. abre a lista de partidas já filtrada (depende dos filtros na URL).
- [ ] **Ordenação das colunas** da lista de partidas: data, precisão, rating do adversário, número de lances.
- [ ] **Novos filtros**: abertura, adversário, faixa de rating do adversário, analisadas / não analisadas, faixa de precisão; filtro de cor também nas estatísticas.
- [ ] **Importar partidas mais antigas**: hoje, depois da primeira importação só vêm partidas mais novas (`importer.ts`). Permitir ampliar o período para trás.
- [x] **Resumo de análise leve**: `useAnalyses()` carrega todas as análises completas (com as linhas do motor de cada posição). Guardar um resumo (precisão, contagem por classificação) numa tabela separada para a lista, estatísticas e amigos.
- [ ] **Escolha de promoção** ao jogar variantes (hoje sempre dama).
- [ ] **Puzzles a partir dos próprios erros**: transformar erros graves das partidas analisadas em puzzles ("encontre o lance certo") e permitir montar conjuntos do Pica-pau com eles.

## 3. Maior esforço / refinamento

- [ ] **Home como painel**: últimas partidas, rating, puzzles e pendências de análise; importação de contas vai para uma página "Contas".
- [ ] **Onboarding / estado vazio**: guia curto (importar → analisar → estatísticas) ou conta de demonstração para quem chega pela primeira vez.
- [ ] **Explorador de repertório**: árvore de aberturas com as próprias partidas (lance → partidas, % de pontos, precisão média), destacando onde sai da teoria e onde mais perde.
- [ ] **Revisão em lote**: listas como "10 partidas com pior precisão" e "partidas decididas por um único erro grave".
- [ ] **Relatório semanal / mensal** a partir de `src/stats/insights.ts`: volume, evolução da precisão, abertura problemática, erro mais comum.
- [ ] **Comparar períodos ou contas**: este mês vs. anterior, Chess.com vs. Lichess.
- [ ] **Amigos**: comparação lado a lado (precisão, aberturas em comum, desempenho por ritmo) e ranking do grupo.
- [ ] **Paginação no Dexie**: a lista carrega e ordena todas as partidas na memória; paginar direto na consulta.
- [ ] **Árvore de variantes**: várias variantes por partida, mantidas ao navegar.
- [ ] **Desenhar setas e círculos** com o botão direito no tabuleiro.
- [ ] **Modal de confirmação próprio** (ou "desfazer") no lugar do `confirm()` nativo ao remover conta.
- [ ] **Tema claro** / seguir `prefers-color-scheme`.
- [ ] **PWA**: manifest + service worker para instalar e usar puzzles e revisão offline.
- [ ] **Sons e animações de lance** opcionais na revisão e nos puzzles.
