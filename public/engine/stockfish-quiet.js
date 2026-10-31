// Runs Stockfish in this worker and passes on only what a batch search needs: for each multipv line, the
// last complete "info ... pv" of the search, sent right before "bestmove". Stockfish prints a line per depth
// and per variation; with several workers that came to thousands of messages a second for the page to
// handle, which kept it from painting. Other output (uciok, readyok, options, bestmove) goes through as is.
//
// The .wasm path comes in the URL hash (Stockfish reads it from there): stockfish-quiet.js#<wasm url>.
var latest = {};
var post = self.postMessage.bind(self);
self.postMessage = function (line) {
  if (typeof line === 'string' && line.indexOf('info ') === 0) {
    if (line.indexOf(' pv ') > -1 && line.indexOf('bound') === -1) {
      var m = / multipv (\d+)/.exec(line);
      latest[m ? m[1] : '1'] = line;
    }
    return;
  }
  if (typeof line === 'string' && line.indexOf('bestmove') === 0) {
    Object.keys(latest)
      .sort(function (a, b) { return a - b; })
      .forEach(function (k) { post(latest[k]); });
    latest = {};
  }
  post(line);
};
importScripts('/stockfish/stockfish-19-lite-single.js');
