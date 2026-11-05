export function swipeAxis(dx: number, dy: number): "x" | "y" | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 10) return null;
  return Math.abs(dx) > Math.abs(dy) * 1.2 ? "x" : "y";
}
export function swipeDestination(
  offset: number,
  actionsWidth: number,
  rowWidth: number,
  fullDelete: boolean
): "closed" | "open" | "delete" {
  if (fullDelete && -offset >= Math.max(rowWidth * 0.75, actionsWidth + 30))
    return "delete";
  return -offset >= actionsWidth * 0.4 ? "open" : "closed";
}
