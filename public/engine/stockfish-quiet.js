// Runs Stockfish in this worker and passes on only what a batch search needs: for each multipv line, the
// last complete "info ... pv" of the search, sent right before "bestmove". Stockfish prints a line per depth
// and per variation; with several workers that came to thousands of messages a second for the page to
// handle, which kept it from painting. Other output (uciok, readyok, options, bestmove) goes through as is.
//
// Stockfish derives its .wasm URL from the script's own location (this file's, so .../stockfish-quiet.wasm,
// which doesn't exist) unless given one in the URL hash, which a worker's location doesn't reliably keep.
// So any .wasm it fetches is redirected to the real file here.
var WASM_URL = '/stockfish/stockfish-19-lite-single.wasm';
var realFetch = self.fetch.bind(self);
self.fetch = function (input, init) {
  var url = typeof input === 'string' ? input : input && input.url;
  return realFetch(/\.wasm(\?|#|$)/.test(url || '') ? WASM_URL : input, init);
};

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
