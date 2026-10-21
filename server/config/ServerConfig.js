import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * サーバーの設定。環境変数で上書きできる（Render の「Environment」画面から設定する）。
 *
 *   PORT                 待ち受けるポート（Render が自動で設定する）
 *   ALLOWED_ORIGINS      接続を許すサイトのURL（カンマ区切り）。未設定なら「同じサイトから」だけ許す
 *   TURN_TIMEOUT_SEC     1手番の持ち時間（秒）
 *   MAX_ROOMS            同時に作れる部屋の数の上限
 *   MAX_CONNECTIONS      同時につなげる人数の上限（サーバー全体）
 *   MAX_CONNECTIONS_PER_IP  同じ住所（IP）から同時につなげる数の上限（学校などで1つの住所を大勢で使う場合を考えて多めに）
 *   TRUST_PROXY_HOPS     X-Forwarded-For に住所を書き足す中継（プロキシ）の段数。0 なら接続元の住所を使う。
 *                        Render では、記録の ws_connected の forwardedForEntries（自分のブラウザでつないだときの値）に合わせる
 *                        （手順は docs/DEPLOY_RENDER.md）
 *   LOG_LEVEL            記録する重さの下限（debug / info / warn / error / silent）。既定は info
 *   STATS_TOKEN          /api/stats を見るための合言葉。未設定なら /api/stats は閉じる（404）
 *   LOKI_URL             記録の送り先（…/loki/api/v1/push）。未設定なら Loki へは送らない
 *   LOKI_USER, LOKI_TOKEN  Loki の利用者番号と合言葉
 */
export function loadServerConfig(env = process.env) {
  const number = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  const count = (value, fallback) => {
    const n = Number(value);
    return value !== undefined && value !== '' && Number.isInteger(n) && n >= 0 ? n : fallback;
  };
  return Object.freeze({
    port: number(env.PORT, 8080),
    host: '0.0.0.0',
    publicRoot: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'),
    allowedOrigins: (env.ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean),
    turnTimeoutMs: number(env.TURN_TIMEOUT_SEC, 45) * 1000,
    disconnectGraceMs: 8000,          // 手番の人が切断したら、これだけ待って次の人へ
    lobbySeatGraceMs: 30000,          // 待合室で切断した人の席を空けるまで（画面の自動再接続は約23秒であきらめる）
    emptyRoomTtlMs: 10 * 60 * 1000,   // 誰もいなくなった部屋を消すまでの時間
    maxRooms: number(env.MAX_ROOMS, 300),
    maxConnections: number(env.MAX_CONNECTIONS, 1000),
    maxConnectionsPerAddress: number(env.MAX_CONNECTIONS_PER_IP, 50),
    trustProxyHops: count(env.TRUST_PROXY_HOPS, 0),
    heartbeatMs: 25000,               // 応答のない接続を切る間隔
    rateLimit: { perSecond: 40, burst: 80 },
    // 同じ住所から部屋を作れるのは、まとめて20回まで・その後は30秒に1回
    // （誰もいない部屋は10分残るので、1つの住所が埋められる部屋はおよそ40まで）
    roomCreateLimit: { perSecond: 1 / 30, burst: 20 },
    // 部屋番号を外せるのは、まとめて20回まで・その後は10秒に1回（総当たりで他人の部屋に入れないように）
    joinMissLimit: { perSecond: 1 / 10, burst: 20 },
    logLevel: env.LOG_LEVEL || 'info',
    statsToken: env.STATS_TOKEN || '',
    loki: Object.freeze({
      url: env.LOKI_URL || '',
      user: env.LOKI_USER || '',
      token: env.LOKI_TOKEN || '',
      labels: Object.freeze({ app: 'nervous-breakdown-internet' })
    })
  });
}
