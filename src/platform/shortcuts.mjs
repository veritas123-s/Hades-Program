export function commandKey(platform = globalThis.window?.veritas?.platform) {
  return platform === "darwin" ? "⌘" : "Ctrl";
}
