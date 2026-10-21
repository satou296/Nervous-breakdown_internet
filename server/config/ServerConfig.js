import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * サーバーの設定。環境変数で上書きできる（Render の「Environment」画面から設定する）。
 *
 *   PORT                 待ち受けるポート（Render が自動で設定する）
 *   ALLOWED_ORIGINS      接続を許すサイトのURL（カンマ区切り）。未設定なら「同じサイトから」だけ許す
 *   TURN_TIMEOUT_SEC     1手番の持ち時間（秒）
 *   MAX_ROOMS            同時に作れる部屋の数の上限
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
    heartbeatMs: 25000,               // 応答のない接続を切る間隔
    rateLimit: { perSecond: 40, burst: 80 },
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
