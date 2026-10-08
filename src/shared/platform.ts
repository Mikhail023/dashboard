export const isMac = () => window.dashboard.platform === "darwin";
export const commandKey = () => (isMac() ? "⌘" : "Ctrl");
export const commandPressed = (
  event: Pick<KeyboardEvent, "metaKey" | "ctrlKey">,
) => (isMac() ? event.metaKey : event.ctrlKey);
