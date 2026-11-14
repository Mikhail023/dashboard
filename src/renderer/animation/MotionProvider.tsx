import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { MotionConfig } from "motion/react";
import { durations, easing } from "./tokens";
import { transitions } from "./transitions";
const ReducedMotion = createContext(false);
export const useMotionReduced = () => useContext(ReducedMotion);
export default function MotionProvider({ children }: { children: ReactNode }) {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.motion = reduced ? "reduced" : "full";
    for (const [name, duration] of Object.entries(durations))
      root.style.setProperty(`--motion-${name}`, `${duration * 1000}ms`);
    root.style.setProperty(
      "--motion-ease",
      `cubic-bezier(${easing.join(",")})`,
    );
  }, [reduced]);
  return (
    <ReducedMotion.Provider value={reduced}>
      <MotionConfig reducedMotion="user" transition={transitions.normal}>
        {children}
      </MotionConfig>
    </ReducedMotion.Provider>
  );
}
