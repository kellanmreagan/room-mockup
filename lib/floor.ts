export type FloorPoint = {
  /** Percent of the stage width (0–100). */
  x: number;
  /** Percent of the stage height (0–100). */
  y: number;
};

/** back-left, back-right, front-right, front-left */
export type FloorQuad = [FloorPoint, FloorPoint, FloorPoint, FloorPoint];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Bottom 45% of the image as a trapezoid: back edge narrower, at ~55% height.
 */
export function defaultFloorQuad(): FloorQuad {
  return [
    { x: 20, y: 55 },
    { x: 80, y: 55 },
    { x: 96, y: 98 },
    { x: 4, y: 98 },
  ];
}

/**
 * Sort four clicked points into back-left, back-right, front-right, front-left
 * by y then x (smaller y is farther back on the photo).
 */
export function sortClickedPoints(points: readonly FloorPoint[]): FloorQuad {
  if (points.length !== 4) {
    throw new Error("Floor quad needs exactly 4 points.");
  }
  const sorted = [...points].sort((a, b) => a.y - b.y || a.x - b.x);
  const back = [sorted[0], sorted[1]].sort((a, b) => a.x - b.x);
  const front = [sorted[2], sorted[3]].sort((a, b) => a.x - b.x);
  return [back[0], back[1], front[1], front[0]];
}

function edgeX(a: FloorPoint, b: FloorPoint, y: number): number {
  const dy = b.y - a.y;
  if (Math.abs(dy) < 1e-6) return (a.x + b.x) / 2;
  const t = clamp((y - a.y) / dy, 0, 1);
  return a.x + t * (b.x - a.x);
}

/**
 * Scale an item from its bottom-center y: interpolate floor width at that y
 * between the back edge and the front edge. scale = floorWidthAtY / frontEdgeWidth.
 * Clamped to [0.25, 1.2]. No quad → 1.
 */
export function perspectiveScale(quad: FloorQuad | null, bottomCenterY: number): number {
  if (!quad) return 1;
  const [backLeft, backRight, frontRight, frontLeft] = quad;
  const leftX = edgeX(backLeft, frontLeft, bottomCenterY);
  const rightX = edgeX(backRight, frontRight, bottomCenterY);
  const floorWidthAtY = Math.abs(rightX - leftX);
  const frontEdgeWidth = Math.abs(frontRight.x - frontLeft.x);
  if (frontEdgeWidth < 1e-6) return 1;
  return clamp(floorWidthAtY / frontEdgeWidth, 0.25, 1.2);
}

/** Approximate bottom edge as a fraction of overlay width (percent of stage). */
export function itemBottomY(placement: { y: number; width: number }): number {
  return clamp(placement.y + placement.width * 0.65, 0, 100);
}

export function scaleForPlacement(
  quad: FloorQuad | null,
  placement: { y: number; width: number },
): number {
  return perspectiveScale(quad, itemBottomY(placement));
}
