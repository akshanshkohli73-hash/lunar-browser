export interface ViewBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
/** CSS pixels at shell zoom=1 are Electron content-view DIPs, not physical pixels. */
export function clampBounds(
  rect: ViewBounds,
  content: { width: number; height: number },
): ViewBounds | null {
  if (
    ![
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      content.width,
      content.height,
    ].every(Number.isFinite)
  )
    return null;
  if (
    rect.width < 0 ||
    rect.height < 0 ||
    content.width < 0 ||
    content.height < 0
  )
    return null;
  const x = Math.min(content.width, Math.max(0, Math.round(rect.x)));
  const y = Math.min(content.height, Math.max(0, Math.round(rect.y)));
  const right = Math.min(content.width, Math.round(rect.x + rect.width));
  const bottom = Math.min(content.height, Math.round(rect.y + rect.height));
  return {
    x,
    y,
    width: Math.max(0, right - x),
    height: Math.max(0, bottom - y),
  };
}
export function sameBounds(a: ViewBounds | null, b: ViewBounds): boolean {
  return (
    !!a &&
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height
  );
}
export function nextActiveAfterClose(
  ids: string[],
  activeId: string | null,
  closing: string,
): string | null {
  if (activeId !== closing) return activeId;
  const index = ids.indexOf(closing);
  return ids[index + 1] ?? ids[index - 1] ?? null;
}
export function isPermutation(ids: string[], proposed: string[]): boolean {
  return (
    ids.length === proposed.length &&
    new Set(proposed).size === proposed.length &&
    proposed.every((id) => ids.includes(id))
  );
}
