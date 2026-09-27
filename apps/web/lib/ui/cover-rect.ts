export type Size = { width: number; height: number };

/** Where a photo lands when it is cropped to cover a frame (the same maths as object-fit: cover). */
export function coverRect(frame: Size, photoAspect: number, focus: { x: number; y: number }) {
  const width = Math.max(frame.width, frame.height * photoAspect);
  const height = width / photoAspect;
  return { left: (frame.width - width) * focus.x, top: (frame.height - height) * focus.y, width, height };
}
