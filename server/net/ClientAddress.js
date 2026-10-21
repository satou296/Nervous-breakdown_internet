import { BlockList, isIP } from 'node:net';

/** インターネット上の利用者を指さない住所（社内・家庭内・プロキシなど） */
const NON_PUBLIC = new BlockList();
for (const [prefix, bits] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.168.0.0', 16]]) {
  NON_PUBLIC.addSubnet(prefix, bits, 'ipv4');
}
for (const [prefix, bits] of [['::', 127], ['fc00::', 7], ['fe80::', 10]]) {
  NON_PUBLIC.addSubnet(prefix, bits, 'ipv6');
}

/**
 * 接続してきた人の住所（IP）を、接続数や回数の上限を数える単位として読み取る。
 *
 * trustProxyHops … 手前にいる、X-Forwarded-For に住所を書き足すプロキシの段数（Render などの中継）。
 *   0 なら接続元の住所をそのまま使う。n なら X-Forwarded-For の右から n 番目を使う
 *   （それより左は利用者が自分で書けるので信用しない）。
 *
 * 読み取れないとき、またはインターネット上の住所でないとき（段数の設定違いでプロキシの住所を
 * 拾った場合など）は null を返す。null の人には住所ごとの上限をかけない（全員が同じ住所に見えて、
 * 普通に遊ぶ人までまとめて締め出すのを防ぐ）。
 * IPv6 は1人が /64 をまるごと使えるので、上位 64 ビットを1人として数える。
 */
export function resolveClientAddress(req, { trustProxyHops = 0 } = {}) {
  const raw = trustProxyHops > 0
    ? forwardedEntries(req).at(-trustProxyHops)
    : req.socket?.remoteAddress;
  return raw === undefined ? null : toCountingKey(raw);
}

/** X-Forwarded-For の件数（段数を確かめるための記録用。住所そのものは記録しない） */
export function forwardedEntryCount(req) {
  return forwardedEntries(req).length;
}

function forwardedEntries(req) {
  const header = req.headers?.['x-forwarded-for'];
  if (!header) return [];
  return [header].flat().join(',').split(',').map(s => s.trim()).filter(Boolean);
}

function toCountingKey(raw) {
  const address = raw.startsWith('::ffff:') && isIP(raw.slice(7)) === 4 ? raw.slice(7) : raw;
  const family = isIP(address);
  if (family === 0) return null;
  const type = family === 4 ? 'ipv4' : 'ipv6';
  if (NON_PUBLIC.check(address, type)) return null;
  return family === 4 ? address : `${expandIpv6(address).slice(0, 4).join(':')}::/64`;
}

/** IPv6 を省略のない8つの区切りにする（例：2001:db8::1 → 2001,db8,0,0,0,0,0,1） */
function expandIpv6(address) {
  const [head, tail = ''] = address.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups = address.includes('::') ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right] : left;
  return groups.map(g => parseInt(g, 16).toString(16));
}
