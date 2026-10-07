import { expect, test } from 'vitest';

import { homography } from './stageView';

const square = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

/** Where the matrix3d of a homography takes a point. */
function apply(matrix: string, { x, y }: { x: number; y: number }) {
  const m = matrix.slice('matrix3d('.length, -1).split(',').map(Number);
  const w = m[3]! * x + m[7]! * y + m[15]!;
  return { x: (m[0]! * x + m[4]! * y + m[12]!) / w, y: (m[1]! * x + m[5]! * y + m[13]!) / w };
}

test('takes four points onto four others', () => {
  // A trapezium, as the stage looks seen from an angle.
  const floor = [
    { x: 30, y: 10 },
    { x: 70, y: 10 },
    { x: 100, y: 60 },
    { x: 0, y: 60 },
  ];
  const matrix = homography(square, floor)!;
  square.forEach((point, index) => {
    const moved = apply(matrix, point);
    expect(moved.x).toBeCloseTo(floor[index]!.x, 3);
    expect(moved.y).toBeCloseTo(floor[index]!.y, 3);
  });
});
