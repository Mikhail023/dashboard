import type { Variants } from "motion/react";
import { offsets } from "./tokens";
export const fade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: offsets.page, scale: 0.985 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8, scale: 0.99 },
};
export const surface: Variants = {
  hidden: { opacity: 0, scale: 0.965, y: offsets.surface },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.99 },
};
