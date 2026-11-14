import { useEffect, useRef } from "react";
import { animate } from "motion/react";
import { useMotionReduced } from "./MotionProvider";
import { durations, easing } from "./tokens";
/** Only a genuine increase triggers feedback; mounting/history browsing stays still. */
export function useValueFeedback<T extends HTMLElement>(
  value: number,
  completed = false,
) {
  const ref = useRef<T>(null);
  const previous = useRef(value);
  const reduced = useMotionReduced();
  useEffect(() => {
    const increased = value > previous.current;
    previous.current = value;
    if (!increased || reduced || !ref.current) return;
    const node = ref.current;
    const control = animate(
      node,
      { scale: [1, completed ? 1.08 : 1.035, 1] },
      { duration: durations.normal, ease: easing },
    );
    return () => {
      control.stop();
      node.style.transform = "";
    };
  }, [value, completed, reduced]);
  return ref;
}
