/**
 * 20 fixed paylines. Each line lists the row index (0 = top, 1 = middle, 2 = bottom)
 * for reels 1..5. Wins are evaluated left to right starting from reel 1.
 */
export const PAYLINES: number[][] = [
  [1, 1, 1, 1, 1], //  1  middle
  [0, 0, 0, 0, 0], //  2  top
  [2, 2, 2, 2, 2], //  3  bottom
  [0, 1, 2, 1, 0], //  4  V
  [2, 1, 0, 1, 2], //  5  Λ
  [0, 0, 1, 0, 0], //  6
  [2, 2, 1, 2, 2], //  7
  [1, 0, 0, 0, 1], //  8
  [1, 2, 2, 2, 1], //  9
  [1, 0, 1, 0, 1], // 10
  [1, 2, 1, 2, 1], // 11
  [0, 1, 1, 1, 0], // 12
  [2, 1, 1, 1, 2], // 13
  [0, 1, 0, 1, 0], // 14
  [2, 1, 2, 1, 2], // 15
  [1, 1, 0, 1, 1], // 16
  [1, 1, 2, 1, 1], // 17
  [0, 0, 2, 0, 0], // 18
  [2, 2, 0, 2, 2], // 19
  [0, 2, 0, 2, 0], // 20
];

export const LINE_COUNT = PAYLINES.length;
