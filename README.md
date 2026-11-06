# Zugzwang

Analisador de partidas do Chess.com e do Lichess, 100% no navegador.

- Importa partidas pelas APIs públicas (Chess.com PubAPI e Lichess `/api/games/user`).
- Game Review com Stockfish 19 (WASM, single-thread) em Web Worker: precisão, classificação dos lances, gráfico de avaliação, linhas do motor e exploração de variantes.
- Estatísticas: resultados, rating, aberturas, padrões de erro por fase e por tempo no relógio.
- Partidas e análises ficam no IndexedDB do navegador. Interface em inglês e português.

## Uso

```sh
npm install      # também copia o Stockfish para public/stockfish
npm run dev
npm test         # testes unitários
RUN_ENGINE=1 npm test   # inclui o teste de integração com o Stockfish real
```

## Notas

- Precisão e classificação seguem as fórmulas do Lichess (win% e precisão por lance); os limiares de
  classificação imitam o Game Review do Chess.com, então os números ficam próximos, não idênticos.
- Nomes de aberturas: dataset CC0 [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings)
  (`data-src/`), convertido por `node scripts/build-openings.mjs` em `public/data/openings.json`.
- Puzzles: subconjunto da base CC0 do [Lichess](https://database.lichess.org/#puzzles) (~96 mil puzzles bem
  avaliados, divididos por faixa de rating em `public/data/puzzles/`). Para regenerar:
  `curl -LO --output-dir data-src https://database.lichess.org/lichess_db_puzzle.csv.zst` e
  `node --max-old-space-size=6000 scripts/build-puzzles.mjs`. Quando o subconjunto não tem puzzle inédito para o
  tema/dificuldade, o app busca na API do Lichess. Todo puzzle mostrado e toda tentativa ficam no IndexedDB.
- Pica-pau (Woodpecker Method): conjuntos fixos de puzzles (por tema/rating ou a partir dos que você errou) resolvidos
  em ciclos com ordem embaralhada; erro encerra o puzzle e cada ciclo mira metade do tempo do anterior.
- Sprint: resolver o máximo de puzzles em 3 min, 5 min ou sem relógio, com dificuldade crescente e fim no terceiro
  erro. Guarda recorde por modo, não altera o rating e os puzzles errados entram nos conjuntos de errados do Pica-pau.
- Cada tentativa guarda tempo até o resultado e até o fim da linha, tempo por lance, lances errados, temas, cor e
  tamanho do puzzle; a aba Estatísticas de puzzles agrega isso por tema, rating, tamanho, fase, cor e tempo gasto.
- Stockfish é GPL-3.0; é carregado como arquivo separado a partir de `public/stockfish`.

## Peças e tabuleiro

O botão de engrenagem na revisão da partida escolhe as cores do tabuleiro e o conjunto de peças.

Para usar seus próprios conjuntos (pastas ignoradas pelo git):

- Peças: `public/pieces/local/<nome>/` com 12 PNGs `wp.png wn.png wb.png wr.png wq.png wk.png bp.png bn.png bb.png br.png bq.png bk.png`.
- Tabuleiros: uma imagem do tabuleiro inteiro em `public/boards/local/<nome>.png`.