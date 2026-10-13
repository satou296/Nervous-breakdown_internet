/**
 * 手のポーズ定義（関節の曲げ角度 [rad]）。
 * fingers は人差し指→小指の順、各指は [付け根, 第2関節, 第1関節]。
 */
export const HAND_POSES = Object.freeze({
  /** 人差し指だけ伸ばして指さす */
  point: Object.freeze({
    fingers: [[0.02, 0.05, 0.05], [1.45, 1.55, 1.2], [1.45, 1.55, 1.2], [1.45, 1.55, 1.2]],
    spread: [0, 0, 0, 0],
    thumb: { curls: [0.35, 0.55], yaw: 0.3, roll: -0.5 }
  }),
  /** 力を抜いて開いた手 */
  open: Object.freeze({
    fingers: [[0.16, 0.2, 0.14], [0.19, 0.2, 0.14], [0.22, 0.2, 0.14], [0.25, 0.2, 0.14]],
    spread: [0.09, 0.03, -0.03, -0.09],
    thumb: { curls: [0.1, 0.12], yaw: 0.85, roll: -0.3 }
  })
});

/** 指の骨格寸法（メートル相当） */
export const FINGER_SHAPES = Object.freeze([
  { x: 0.029, lengths: [0.042, 0.026, 0.022], radius: 0.0095 },   // 人差し指
  { x: 0.0095, lengths: [0.046, 0.029, 0.023], radius: 0.0097 },  // 中指
  { x: -0.0095, lengths: [0.043, 0.027, 0.022], radius: 0.0094 }, // 薬指
  { x: -0.028, lengths: [0.034, 0.021, 0.018], radius: 0.0083 }   // 小指
]);

export const THUMB_SHAPE = Object.freeze({
  position: [0.04, -0.008, 0.026], lengths: [0.034, 0.028], radius: 0.0112
});
