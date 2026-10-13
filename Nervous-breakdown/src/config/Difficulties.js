/**
 * 難易度の定義。カードの漂い方（drift）・回転の速さ・カードの選び方（interaction）を宣言的に決める。
 * 新しい難易度は、ここにエントリを追加するだけで増やせる。
 *
 * drift.type: 'calm'  … 定位置のまわりで小さく揺れる
 *             'roam'  … 決められた範囲の中を上下左右に大きく動き回る
 * travel.type: （省略）  … 定位置は動かない
 *              'waypoint' … 定位置そのものが浮遊範囲の中をランダムに渡り歩く
 * interaction: 'point' … カーソルを合わせてクリックで選ぶ
 *              'reach' … 腕を伸ばし、手のひらで触れたカードを左クリックで選ぶ（腕に当たったカードは弾かれて散らばる）
 * holdOnTouch: 手のひらが触れたカードをその場に止めるか（reach のときだけ意味がある）
 */
export const DIFFICULTIES = Object.freeze({
  normal: Object.freeze({
    id: 'normal',
    label: 'ふつう',
    drift: Object.freeze({ type: 'calm', amplitude: { x: 0.28, y: 0.2, z: 0.28 } }),
    spinScale: 1,
    interaction: 'point'
  }),
  hard: Object.freeze({
    id: 'hard',
    label: 'むずかしい',
    drift: Object.freeze({
      type: 'roam',
      range: { x: 1.15, y: 0.55, z: 0.7 },   // 定位置からこの距離までの範囲で動き回る
      speed: { min: 0.28, max: 0.5 }         // 動きの速さ（周波数 rad/s の目安）
    }),
    spinScale: 1.35,
    interaction: 'point'
  }),
  expert: Object.freeze({
    id: 'expert',
    label: '達人',
    drift: Object.freeze({
      type: 'roam',
      range: { x: 1.0, y: 0.5, z: 0.6 },
      speed: { min: 0.22, max: 0.4 }       // 腕で触る分、むずかしいより少しゆっくり
    }),
    spinScale: 1.35,
    interaction: 'reach',
    holdOnTouch: true
  }),
  master: Object.freeze({
    id: 'master',
    label: '極',
    // むずかしいと同じ速さで揺れ動きながら、定位置そのものも範囲内をランダムに渡り歩く
    drift: Object.freeze({
      type: 'roam',
      range: { x: 1.15, y: 0.55, z: 0.7 },
      speed: { min: 0.28, max: 0.5 }
    }),
    travel: Object.freeze({ type: 'waypoint', speed: { min: 0.35, max: 0.75 } }),
    spinScale: 1.35,
    interaction: 'reach',
    holdOnTouch: false   // 触れても止まらない。クリックで選ばれて初めて止まる
  })
});

export const DEFAULT_DIFFICULTY_ID = 'normal';

export function getDifficulty(id) {
  const difficulty = DIFFICULTIES[id];
  if (!difficulty) throw new Error(`未知の難易度です: ${id}`);
  return difficulty;
}
