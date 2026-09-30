const mailbox = (value) => {
  const text = String(value || "").trim();
  if (
    text.length > 254 ||
    !/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(text)
  )
    throw Error("请填写有效的邮箱地址");
  return text;
};
export function deliveryChannel(config) {
  return config.channel || (config.pushToken ? "pushplus" : "email");
}
export function emailInput(input) {
  const host = String(input.host || "")
    .trim()
    .toLowerCase();
  if (
    !/^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/.test(host) ||
    !host.includes(".") ||
    host.includes("..")
  )
    throw Error("请填写邮箱服务商的 SMTP 主机名");
  const port = Number(input.port || 465);
  if (![465, 587].includes(port))
    throw Error("仅支持加密 SMTP 端口 465 或 587");
  const password = String(input.password || "");
  if (!password || password.length > 512 || /[\r\n\0]/.test(password))
    throw Error("请填写邮箱客户端授权码");
  return {
    host,
    port,
    user: mailbox(input.user),
    to: mailbox(input.to),
    password,
  };
}
export function deliveryReady(config) {
  return deliveryChannel(config) === "pushplus"
    ? !!config.pushToken
    : !!config.email;
}
export function deliveryEnvironment(config) {
  const channel = deliveryChannel(config);
  if (!deliveryReady(config)) throw Error("请先保存提醒接收配置");
  const values = { DELIVERY_CHANNEL: channel };
  if (channel === "pushplus") values.PUSHPLUS_TOKEN = config.pushToken;
  else {
    const e = emailInput(config.email);
    Object.assign(values, {
      SMTP_HOST: e.host,
      SMTP_PORT: String(e.port),
      SMTP_USER: e.user,
      SMTP_PASSWORD: e.password,
      EMAIL_TO: e.to,
    });
  }
  return Object.entries(values).map(([Key, Value]) => ({ Key, Value }));
}
