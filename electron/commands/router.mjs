export function makeRouter(groups, context) {
  const commands = new Map();
  for (const { names, execute } of groups) {
    for (const name of names) {
      if (commands.has(name) || typeof execute !== "function")
        throw new Error("桌面操作重复或无效");
      commands.set(name, execute);
    }
  }
  return {
    names: [...commands.keys()],
    execute(action, payload = {}) {
      if (!commands.has(action)) throw new Error("不支持的操作");
      if (!payload || typeof payload !== "object" || Array.isArray(payload))
        throw new Error("操作参数无效");
      return commands.get(action)(action, payload, context);
    },
  };
}
