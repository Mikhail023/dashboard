import logo from "../../лого.png";
import { splashTiming } from "../shared/splash";
import "./splash.css";

declare global {
  interface Window {
    dashboardSplash?: { onComplete(callback: () => void): () => void };
  }
}

const params = new URLSearchParams(window.location.search);
const root = document.documentElement;
const accent = params.get("accent");

root.dataset.theme = params.get("theme") === "dark" ? "dark" : "light";
if (accent) root.style.setProperty("--splash-accent", accent);
root.style.setProperty("--splash-fade-out", `${splashTiming.fadeOutMs}ms`);

for (const logoImage of document.querySelectorAll<HTMLImageElement>(
  ".splash-logo-image, .splash-piece",
))
  logoImage.src = logo;

window.dashboardSplash?.onComplete(() => {
  document.body.classList.add("is-completing");
});
