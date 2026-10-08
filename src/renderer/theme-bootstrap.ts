const params = new URLSearchParams(window.location.search);
const theme = params.get("theme");
const accent = params.get("accent");
const root = document.documentElement;

root.classList.toggle(
  "dark",
  theme === "dark" ||
    (theme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches),
);

if (accent && /^#[0-9a-fA-F]{6}$/.test(accent)) {
  root.dataset.accent = "custom";
  root.style.setProperty("--accent-base", accent);
  const rgb = [1, 3, 5]
    .map((i) => parseInt(accent.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const luminance = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  root.style.setProperty("--accent-ink", luminance > 0.179 ? "#101418" : "#ffffff");
}
