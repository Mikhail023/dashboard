/** Seconds in JS, milliseconds in CSS. Keep interaction timings in one place. */
export const durations = {
  instant: 0.16,
  fast: 0.23,
  normal: 0.38,
  slow: 0.54,
} as const;
export const easing = [0.22, 1, 0.36, 1] as const;
export const springs = {
  snappy: { type: "spring", stiffness: 520, damping: 42, mass: 0.7 },
  smooth: { type: "spring", stiffness: 360, damping: 36, mass: 0.9 },
  gentle: { type: "spring", stiffness: 280, damping: 32, mass: 1 },
} as const;
export const offsets = { page: 16, surface: 11, press: 0.97 } as const;
export const staggerDelay = (index: number) => Math.min(index, 5) * 0.045;
