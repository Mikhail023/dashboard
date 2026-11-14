import type { Transition } from "motion/react";
import { durations, easing } from "./tokens";
export const transitions = {
  fast: { duration: durations.fast, ease: easing },
  normal: { duration: durations.normal, ease: easing },
  exit: { duration: durations.instant, ease: easing },
  slow: { duration: durations.slow, ease: easing },
} satisfies Record<string, Transition>;
