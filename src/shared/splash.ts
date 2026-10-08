/** Shared timing for the native splash window and its renderer entry point. */
// Set to false for diagnostics or a build that should open directly to Dashboard.
export const splashEnabled = true;

export const splashTiming = {
  minimumVisibleMs: 1_700,
  fadeOutMs: 260,
} as const;

export type SplashAppearance = {
  dark: boolean;
  accent: string;
};
