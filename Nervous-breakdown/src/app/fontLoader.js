/**
 * カードの文字に使う Web フォントを待つ（最大 timeoutMs）。失敗しても先に進む。
 */
export function waitForFont(spec, sample, timeoutMs) {
  if (!document.fonts?.load) return Promise.resolve();
  const timeout = new Promise(resolve => setTimeout(resolve, timeoutMs));
  return Promise.race([document.fonts.load(spec, sample), timeout]).catch(() => {});
}
