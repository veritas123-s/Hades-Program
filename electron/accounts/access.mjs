const publicActions = new Set([
  "state",
  "account.state",
  "account.login",
  "account.send",
  "account.resend",
  "account.verify",
  "account.activate",
  "account.cancel",
]);
export function requireAccount(accounts, action) {
  if (!accounts?.authenticated && !publicActions.has(action))
    throw Error("请先登录 Hades，才能使用个人功能");
}
export function lockedSnapshot(account, revision) {
  return { schemaVersion: 5, locked: true, account, revision };
}
