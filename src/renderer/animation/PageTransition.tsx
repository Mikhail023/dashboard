import { useEffect, useRef, type ReactNode } from "react";
import { motion, useIsPresent } from "motion/react";
import { useMotionReduced } from "./MotionProvider";
import { fade, fadeUp } from "./variants";
import { transitions } from "./transitions";
/** Exit pages leave normal flow immediately, so navigation never waits for an animation. */
export default function PageTransition({ children }: { children: ReactNode }) {
  const present = useIsPresent();
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useMotionReduced();
  useEffect(() => {
    if (ref.current) ref.current.inert = !present;
  }, [present]);
  return (
    <motion.div
      ref={ref}
      className="route-surface"
      data-exiting={!present || undefined}
      aria-hidden={!present || undefined}
      variants={reduced ? fade : fadeUp}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={reduced ? transitions.exit : transitions.normal}
    >
      {children}
    </motion.div>
  );
}
