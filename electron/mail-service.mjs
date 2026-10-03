import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

export const SJTU_IMAP = Object.freeze({ host: "mail.sjtu.edu.cn", port: 993 });
const MAX_SOURCE = 10 * 1024 * 1024;
const clean = (value, max = 500) =>
  String(value || "")
    .replace(/\0/g, "")
    .slice(0, max);
const address = (values = []) =>
  values
    .slice(0, 20)
    .map((x) => clean(x.name || x.address))
    .join("、");
const date = (value) =>
  value && Number.isFinite(new Date(value).getTime())
    ? new Date(value).toISOString()
    : "";

export function mailUsername(value) {
  const name = String(value || "").trim();
  if (!/^[a-zA-Z0-9_.-]{1,80}(?:@sjtu\.edu\.cn)?$/i.test(name))
    throw Error("请输入 jAccount 用户名或 @sjtu.edu.cn 邮箱");
  return name.replace(/@sjtu\.edu\.cn$/i, "");
}

// No filesystem, cloud export, SMTP, mailbox mutations, or credential logging.
export class MailService {
  constructor({
    owner,
    changed = () => {},
    clientFactory = (options) => new ImapFlow(options),
    parse = simpleParser,
  }) {
    this.owner = owner;
    this.changed = changed;
    this.clientFactory = clientFactory;
    this.parse = parse;
    this.generation = 0;
    this.credentials = null;
    this.client = null;
    this.data = {
      connected: false,
      busy: false,
      items: [],
      total: 0,
      unread: 0,
      checkedAt: null,
    };
  }
  status() {
    if (
      !this.owner() ||
      (this.credentials && this.credentials.owner !== this.owner())
    ) {
      this.disconnect();
    }
    return structuredClone(this.data);
  }
  disconnect() {
    this.generation++;
    this.client?.close();
    this.client = null;
    this.credentials = null;
    this.data = {
      connected: false,
      busy: false,
      items: [],
      total: 0,
      unread: 0,
      checkedAt: null,
    };
  }
  assertCurrent(generation, owner) {
    if (!owner || this.owner() !== owner || generation !== this.generation)
      throw Error("邮箱会话已结束，请重新连接");
  }
  async connect({ username, password }) {
    if (this.data.busy) throw Error("邮箱正在读取，请稍候");
    const owner = this.owner();
    if (!owner) throw Error("请先登录医栈通");
    const user = mailUsername(username);
    if (typeof password !== "string" || !password || password.length > 1024)
      throw Error("请填写邮箱密码");
    this.disconnect();
    this.credentials = { user, pass: password, owner };
    const generation = this.generation;
    try {
      return await this.refresh();
    } catch (error) {
      if (generation === this.generation) {
        this.disconnect();
        this.changed();
      }
      throw error;
    }
  }
  async session(operation) {
    const credentials = this.credentials;
    if (!credentials) throw Error("请先连接交大邮箱");
    if (this.data.busy) throw Error("邮箱正在读取，请稍候");
    const generation = this.generation;
    this.assertCurrent(generation, credentials.owner);
    const client = this.clientFactory({
      ...SJTU_IMAP,
      secure: true,
      tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" },
      auth: { user: credentials.user, pass: credentials.pass },
      logger: false,
      emitLogs: false,
      disableAutoIdle: true,
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });
    client.on("error", () => {});
    this.client = client;
    this.data.busy = true;
    this.changed();
    const timeout = setTimeout(() => client.close(), 30000);
    let lock;
    try {
      await client.connect();
      this.assertCurrent(generation, credentials.owner);
      lock = await client.getMailboxLock("INBOX", { readOnly: true });
      if (!client.mailbox?.readOnly) throw Error("邮箱服务器未开启只读访问");
      this.assertCurrent(generation, credentials.owner);
      const value = await operation(client);
      this.assertCurrent(generation, credentials.owner);
      return value;
    } catch (error) {
      this.assertCurrent(generation, credentials.owner);
      if (error.mailSafe) throw error;
      if (error.authenticationFailed)
        throw Error("邮箱认证失败，请核对 jAccount 邮箱密码及客户端访问设置");
      // Server errors can contain protocol lines and credentials; never forward them.
      throw Error("邮箱读取失败，请检查网络、密码及客户端访问设置后重试");
    } finally {
      clearTimeout(timeout);
      lock?.release();
      client.close();
      if (this.client === client) this.client = null;
      if (generation === this.generation) {
        this.data.busy = false;
        this.changed();
      }
    }
  }
  async refresh() {
    const generation = this.generation;
    const owner = this.credentials?.owner;
    const result = await this.session(async (client) => {
      const info = await client.status("INBOX", {
        messages: true,
        unseen: true,
      });
      const items = [];
      const total = client.mailbox.exists;
      const validity = String(client.mailbox.uidValidity);
      if (total) {
        for await (const message of client.fetch(
          `${Math.max(1, total - 199)}:${total}`,
          { uid: true, envelope: true, flags: true, size: true },
        )) {
          items.push({
            uid: message.uid,
            validity,
            subject: clean(message.envelope?.subject) || "（无主题）",
            from: address(message.envelope?.from),
            date: date(message.envelope?.date),
            unread: !message.flags?.has("\\Seen"),
            size: message.size,
          });
        }
      }
      return {
        connected: true,
        username: this.credentials.user,
        total,
        unread: info?.unseen ?? null,
        items: items.sort((a, b) => b.uid - a.uid),
        checkedAt: Date.now(),
      };
    });
    this.assertCurrent(generation, owner);
    Object.assign(this.data, result);
    this.changed();
    return this.status();
  }
  async read({ uid, validity }) {
    const item = this.data.items.find(
      (x) => x.uid === uid && x.validity === validity,
    );
    if (!item) throw Error("请刷新后选择邮件");
    return this.session(async (client) => {
      const fail = (message) => {
        throw Object.assign(Error(message), { mailSafe: true });
      };
      if (String(client.mailbox.uidValidity) !== validity)
        fail("收件箱已改变，请刷新后再打开邮件");
      const metadata = await client.fetchOne(
        uid,
        { size: true },
        { uid: true },
      );
      if (!metadata) fail("邮件已移走或删除，请刷新收件箱");
      if (!Number.isFinite(metadata.size) || metadata.size > MAX_SOURCE)
        fail("这封邮件超过 10 MB，请前往学校网页邮箱查看");
      // ImapFlow uses BODY.PEEK, preserving \Seen even when fetching full MIME.
      const message = await client.fetchOne(
        uid,
        { source: { start: 0, maxLength: MAX_SOURCE + 1 } },
        { uid: true },
      );
      if (!message?.source) fail("邮件已移走或删除，请刷新收件箱");
      if (
        message.source.length > MAX_SOURCE ||
        message.source.length < metadata.size
      )
        fail("邮件内容不完整，请前往学校网页邮箱查看");
      const parsed = await this.parse(message.source, {
        skipImageLinks: true,
        skipTextToHtml: true,
        maxHtmlLengthToParse: MAX_SOURCE,
      });
      return {
        ...item,
        text: clean(parsed.text, 200000),
        attachments: (parsed.attachments || []).slice(0, 100).map((x) => ({
          name: clean(x.filename) || "未命名附件",
          size: x.size,
        })),
      };
    });
  }
}
