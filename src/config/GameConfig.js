/**
 * ゲーム全体の調整値。マジックナンバーはすべてここに集約する。
 */
const prefersReducedMotion = typeof matchMedia === 'function'
  && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 3D空間上のカードの大きさ（ポーカーサイズ 63×88mm の比率） */
export const CARD_SIZE = Object.freeze({ width: 0.62, height: 0.868 });

/** カードのテクスチャ解像度 */
export const CARD_TEXTURE_SIZE = Object.freeze({ width: 320, height: 448 });

/** 選べる枚数 → 使う最大ランク（4スート × ランク数 = 枚数） */
export const DECK_OPTIONS = Object.freeze({ 20: 5, 32: 8, 52: 13 });
export const ATTRACT_DECK_SIZE = 52;

/** 進行のテンポ（ミリ秒） */
export const TIMING = Object.freeze({
  dealSettleMs: 900,
  resolveDelayMs: 1550,   // めくった2枚目が「拡大表示 → 下部へ移動」を終えてから判定する
  matchCollectDelayMs: 650,
  missHideDelayMs: 1250,
  gameOverDelayMs: 1300,
  cpuThinkMs: 900,
  cpuAimMs: 700,
  cpuBetweenPicksMs: 900,
  toastMs: 1100
});

/** アニメーション */
export const MOTION = Object.freeze({
  scale: prefersReducedMotion ? 0.4 : 1,
  /** めくったカード：拡大表示 → 少し見せる → 画面下部へ */
  reveal: Object.freeze({ presentSec: 0.6, holdSec: 0.45, dockSec: 0.4, spinTurns: 1, arcHeight: 0.12 }),
  collectSec: 0.85,
  returnScaleRate: 4,
  hoverScale: 0.1,
  followRate: 1.5,
  spinRecoverRate: 0.9,
  /** 浮遊中の向き：うら面をプレイヤーへ向けたまま面内で回り、少しだけ傾く（おもて面は見せない） */
  float: Object.freeze({
    wobble: Object.freeze({ angle: 0.38, speed: Object.freeze({ min: 0.35, max: 0.8 }) }),
    maxTilt: 1.0,     // 傾きの上限（ラジアン）。π/2 未満なら、おもて面はこちらを向かない
    turnRate: 7       // 目標の向きへ追いつく速さ
  })
});

/** カードが浮遊する空間（奥ほど広がる台形の箱） */
export const FLOAT_AREA = Object.freeze({
  nearZ: -2.4,
  depth: 5.2,
  baseHalfWidth: 1.5,
  widthGrowth: 0.44,
  minY: 1.2,
  baseHeight: 1.25,
  heightGrowth: 0.22,
  minSpacing: 1.05
});

/**
 * めくったカードの置き場所（カメラ基準のローカル座標）。
 * present … 画面中央に大きく見せる位置
 * docks   … 他のカードを選ぶ邪魔にならない画面下部の位置（1枚目・2枚目）
 */
export const REVEAL_LAYOUT = Object.freeze({
  present: Object.freeze({ position: [0, 0.02, -1.3], scale: 1 }),
  docks: Object.freeze([
    Object.freeze({ position: [-0.19, -0.55, -1.55], scale: 0.36 }),
    Object.freeze({ position: [0.19, -0.55, -1.55], scale: 0.36 })
  ])
});

export const TABLE = Object.freeze({ z: -4.8, top: 0.82, radius: 3.6 });

export const CAMERA = Object.freeze({
  position: [0, 1.55, 0.6],
  fov: 62,
  portraitFov: 74,
  near: 0.04,
  far: 60,
  yawLimit: 1.05,
  pitchMin: -0.6,
  pitchMax: 0.45,
  initialPitch: 0.04,
  dragSensitivity: 0.0035,
  keySpeed: 1.2,
  smoothing: 10
});

export const POINTER = Object.freeze({ dragThresholdPx: 7 });

/** 達人モードの腕（長さはメートル、速さは m/s） */
export const ARM = Object.freeze({
  maxReach: 9.5,          // いちばん奥のカードまで届く長さ
  extendSpeed: 3.4,       // W / S 長押しで伸び縮みする速さ
  relaxSpeed: 6,          // 操作できないときに元に戻る速さ
  shoulder: [0.27, -0.4, -0.16], // カメラ基準の肩の位置（伸びた腕はここから出る）
  /* 当たり判定 */
  armRadius: 0.1,
  cardRadius: 0.35,
  palmRadius: 0.6,        // 手のひらがカード中心からこの距離に入ったら「触れている」
  impulseBase: 2.2,       // 当たったときに弾く強さ
  impulseFromSpeed: 0.6,  // 腕を速く動かすほど強く弾く
  maxImpulse: 7,
  spinKick: 2.5,
  knockDrag: 1.6,         // 弾かれたカードが止まるまでの減速
  /* 見た目：伸ばすほど腕と手を透かして、視界を遮らないようにする */
  minOpacity: 0.28,       // いちばん透かしたときの不透明度
  fadeOverReach: 0.8,     // この長さまで伸ばすと最も透ける
  /* 見た目：素肌の腕。画面の外の肩から手首までつなぎ、どこまでも伸びているように見せる */
  skinRadius: 0.032,      // 腕の太さ
  beyondShoulder: 1.5,    // 肩よりさらに奥（画面の外）まで腕を延ばす長さ
  leftShoulder: [-0.3, -0.42, -0.14] // 左手の肩の位置（カメラ基準）
});

export const CPU = Object.freeze({ rememberChance: 0.78 });

export const PILES = Object.freeze({
  handCardScale: 0.11,
  handStackStep: 0.0016,
  table: { x: 0.9, z: -7.25, seatSpacingX: -1.2, stackStep: 0.0035 } // 最大3人分がテーブルに収まる間隔
});
