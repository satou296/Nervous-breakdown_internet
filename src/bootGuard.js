/**
 * 起動の見張り（モジュールではない普通の <script>。main.js より先に読む）。
 * three.js や src/ のモジュールが読み込めない・古いブラウザで解釈できないときは main.js が動かず、
 * main().catch にも届かないので、ここで「読み込み中」の表示を案内に差し替える。
 * 起動を終えた後（#loading が隠れた後）のエラーには関わらない。
 * モジュールではないので strings.js を読めず、案内の文言は index.html の data-failed-text に置く。
 */
(() => {
  const loading = document.getElementById('loading');
  if (!loading) return;
  window.addEventListener('error', event => {
    if (loading.hidden) return;
    // フォントなど画面の飾りが読めないだけなら、ゲームは動くので案内しない
    const fatal = event instanceof ErrorEvent || event.target instanceof HTMLScriptElement;
    if (fatal) loading.textContent = loading.dataset.failedText;
  }, true); // capture にすると、伝わらない script の読み込み失敗も拾える
})();
