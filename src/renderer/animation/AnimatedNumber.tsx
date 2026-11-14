import { useEffect, useRef } from "react";
import { animate } from "motion/react";
import { useMotionReduced } from "./MotionProvider";
import { transitions } from "./transitions";
const defaultFormat = (value: number) => String(Math.round(value));
/** Writes a single text node, avoiding React/store updates on every animation frame. */
export default function AnimatedNumber({
  value,
  format = defaultFormat,
}: {
  value: number;
  format?: (value: number) => string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const current = useRef(value);
  const formatter = useRef(format);
  formatter.current = format;
  const reduced = useMotionReduced();
  useEffect(() => {
    const from = current.current;
    if (reduced || from === value) {
      current.current = value;
      if (ref.current) ref.current.textContent = formatter.current(value);
      return;
    }
    const controls = animate(from, value, {
      ...transitions.normal,
      onUpdate: (next) => {
        current.current = next;
        if (ref.current) ref.current.textContent = formatter.current(next);
      },
    });
    return () => controls.stop();
  }, [value, reduced]);
  return (
    <span ref={ref} aria-label={format(value)}>
      {format(value)}
    </span>
  );
}
