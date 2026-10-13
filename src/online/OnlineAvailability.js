/**
 * このページがオンライン対戦サーバーから配信されているかを確かめる。
 * GitHub Pages などファイルを置くだけの場所では false になり、オンライン対戦の選択肢を隠す。
 */
export async function isOnlineAvailable({ fetchImpl = globalThis.fetch, timeoutMs = 6000 } = {}) {
  if (typeof fetchImpl !== 'function' || typeof WebSocket === 'undefined') return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl('/api/online', { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) return false;
    const body = await res.json();
    return body?.online === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
