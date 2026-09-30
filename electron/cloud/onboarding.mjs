import fs from "node:fs";
import { randomBytes, createHash } from "node:crypto";
import { TencentLogin } from "./tencent-login.mjs";
import { CloudError, REGION } from "./tencent-api.mjs";
import { sourceZip } from "./zip.mjs";
import { syncURL } from "../cloud-sync.mjs";
import {
  deliveryChannel,
  deliveryReady,
  deliveryEnvironment,
  emailInput,
} from "./delivery.mjs";

const missing = (e) =>
  /ResourceNotFound|ResourceNotExist|NotExist|NoSuch/.test(e.code || "");
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const TIMERS = [
  { name: "veritas-morning", cron: "0 0 8 * * * *", mode: "morning" },
  { name: "veritas-evening", cron: "0 0 21 * * * *", mode: "evening" },
];
export function objectPolicy(plan) {
  return {
    version: "2.0",
    statement: [
      {
        effect: "allow",
        action: ["name/cos:GetObject", "name/cos:PutObject"],
        resource: [
          `qcs::cos:${REGION}:uid/${plan.appId}:${plan.bucket}/veritas/veritas-feed.json`,
        ],
      },
    ],
  };
}
function document(value) {
  try {
    return JSON.parse(decodeURIComponent(value));
  } catch {
    return null;
  }
}
function equal(a, b) {
  const canonical = (v) =>
    Array.isArray(v)
      ? v
          .map(canonical)
          .sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y)))
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.keys(v)
              .sort()
              .map((k) => [k, canonical(v[k])]),
          )
        : v;
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

export class CloudOnboarding {
  constructor({
    secrets,
    sync,
    getFeed,
    openExternal,
    fetcher = fetch,
    changed = () => {},
    login,
    pause = wait,
  }) {
    Object.assign(this, {
      secrets,
      sync,
      getFeed,
      openExternal,
      fetcher,
      changed,
      pause,
    });
    this.config = secrets.load();
    this.busy = false;
    this.info = {
      phase: this.config.plan?.completedAt ? "ready" : "idle",
      message: this.config.plan?.completedAt
        ? "已保存独立云服务，请验证提醒接收情况。"
        : "使用自己的腾讯云，独立开通早晚报。",
    };
    this.login = login || new TencentLogin({ openExternal, fetcher, changed });
  }
  status() {
    const p = this.config.plan;
    return {
      ...this.info,
      busy: this.busy,
      login: this.login.status(),
      pushConfigured: !!this.config.pushToken,
      channel: deliveryChannel(this.config),
      deliveryConfigured: deliveryReady(this.config),
      emailConfigured: !!this.config.email,
      emailRecipient: this.config.email?.to || "",
      warning: this.secrets.warning || "",
      receivedAt: p?.receivedAt || null,
      plan: p
        ? {
            appId: p.appId,
            functionName: p.functionName,
            bucket: p.bucket,
            roleName: p.roleName,
            policyName: p.policyName,
            completedAt: p.completedAt || null,
            region: REGION,
          }
        : null,
    };
  }
  update(info) {
    this.info = { ...this.info, ...info };
    this.changed();
  }
  save(patch) {
    this.secrets.save(patch);
    this.config = this.secrets.load();
  }
  checkpoint(patch) {
    this.save({ plan: { ...this.config.plan, ...patch } });
  }
  idle() {
    if (this.busy) throw new CloudError("正在开通或验证，请等待本次操作结束。");
  }
  async signIn() {
    this.idle();
    return this.login.start();
  }
  signOut() {
    this.idle();
    return this.login.logout();
  }
  bind({ token, channel = "pushplus", email }) {
    this.idle();
    if (channel === "email") {
      this.save({ channel, email: emailInput(email || {}) });
    } else if (channel === "pushplus") {
      token = String(token || "").trim();
      if (!/^[a-zA-Z0-9]{20,128}$/.test(token))
        throw new CloudError("请填写你本人 pushplus 的完整 Token。");
      this.save({ channel, pushToken: token });
    } else throw new CloudError("请选择电子邮件或 PushPlus");
    this.testAccepted = false;
    if (this.config.plan)
      this.checkpoint({ receivedAt: null, completedAt: null });
    this.update({
      phase: "idle",
      message: "接收配置已加密保存；点击开通或继续以应用到云端。",
    });
    return this.status();
  }
  async open(which) {
    const urls = {
      pushplus: "https://www.pushplus.plus/push1.html",
      scf: "https://console.cloud.tencent.com/scf/list?rid=4&ns=default",
      cos: "https://console.cloud.tencent.com/cos/bucket",
      cam: "https://console.cloud.tencent.com/cam/role",
      billing: "https://console.cloud.tencent.com/expense",
    };
    if (!urls[which]) throw new CloudError("页面类型无效。");
    await this.openExternal(urls[which]);
    return this.status();
  }
  ownAccount() {
    const api = this.login.api(),
      identity = this.login.identity;
    if (
      this.config.plan &&
      (this.config.plan.appId !== String(identity.AppId) ||
        this.config.plan.owner !== identity.OwnerUin)
    )
      throw new CloudError(
        "当前腾讯云账号与本机开通记录不一致，请退出后登录原账号。不会操作另一账号的资源。",
      );
    return api;
  }
  async functionInfo(api) {
    const p = this.config.plan;
    try {
      const result = await api.call("scf", "GetFunction", {
        FunctionName: p.functionName,
        Namespace: "default",
      });
      if (result.Description !== p.marker)
        throw new CloudError("同名函数不属于本次开通，已停止操作。");
      return result;
    } catch (e) {
      if (missing(e)) return null;
      throw e;
    }
  }
  async activeFunction(api) {
    for (let i = 0; i < 30; i++) {
      const fn = await this.functionInfo(api);
      if (fn?.Status === "Active") return fn;
      if (/Failed/.test(fn?.Status || ""))
        throw new CloudError("云函数未能就绪，请在控制台检查状态后继续。");
      await this.pause(2000);
    }
    throw new CloudError("云函数仍在准备，请稍后点击继续。");
  }
  async invoke(api, action) {
    const result = await api.call("scf", "Invoke", {
      FunctionName: this.config.plan.functionName,
      Namespace: "default",
      InvocationType: "RequestResponse",
      ClientContext: JSON.stringify({ action }),
    });
    if (result.Result?.RetCode !== 0)
      throw new CloudError("云函数验证未完成，请检查运行状态。");
    try {
      return JSON.parse(result.Result.RetMsg);
    } catch {
      throw new CloudError("云函数返回格式异常。");
    }
  }
  async deploy({ consent } = {}) {
    this.idle();
    if (consent !== true)
      throw new CloudError("请先确认资源、数据上传范围、每日提醒及按量费用。");
    const api = this.ownAccount();
    if (!deliveryReady(this.config))
      throw new CloudError("请先保存你自己的提醒接收配置。");
    if (
      this.sync.status().configured &&
      (!this.config.plan?.endpoint ||
        this.sync.status().endpoint !== this.config.plan.endpoint)
    )
      throw new CloudError(
        "当前已连接另一条云同步通道。请保留其配置并停止自动同步后，再独立开通。",
      );
    this.busy = true;
    try {
      if (!this.config.plan) {
        const id = randomBytes(8).toString("hex"),
          appId = String(this.login.identity.AppId);
        this.checkpoint({
          id,
          appId,
          owner: this.login.identity.OwnerUin,
          marker: `AI-VERITAS independent ${id}`,
          bucket: `veritas-${id}-${appId}`,
          functionName: `veritas-${id}`,
          roleName: `veritas-${id}`,
          policyName: `veritas-object-${id}`,
          secret: randomBytes(32).toString("hex"),
        });
      }
      const p = this.config.plan;
      this.update({
        phase: "deploying",
        message: "1/6 正在建立并核验私有存储…",
      });
      let acl;
      try {
        acl = await api.bucket("GET", p.bucket, { acl: true });
      } catch (e) {
        if (e.code !== "COS404") throw e;
        await api.bucket("PUT", p.bucket);
        acl = await api.bucket("GET", p.bucket, { acl: true });
      }
      const ids = [...acl.matchAll(/<ID>([^<]+)<\/ID>/g)].map((m) => m[1]);
      const owner = `qcs::cam::uin/${p.owner}:uin/${p.owner}`;
      if (
        !ids.length ||
        ids.some((id) => id !== owner) ||
        /<URI>|AllUsers|AuthenticatedUsers/.test(acl)
      )
        throw new CloudError("存储桶权限未通过私有性检查，已停止开通。");
      this.update({ message: "2/6 正在配置只读写本应用快照的执行权限…" });
      const trust = {
        version: "2.0",
        statement: [
          {
            action: "name/sts:AssumeRole",
            effect: "allow",
            principal: { service: ["scf.qcloud.com"] },
          },
        ],
      };
      let role;
      try {
        role = (await api.call("cam", "GetRole", { RoleName: p.roleName }))
          .RoleInfo;
      } catch (e) {
        if (!missing(e)) throw e;
      }
      if (role) {
        if (
          role.Description !== p.marker ||
          !equal(document(role.PolicyDocument), trust)
        )
          throw new CloudError("角色归属或信任范围不匹配，已停止开通。");
      } else {
        const created = await api.call("cam", "CreateRole", {
          RoleName: p.roleName,
          Description: p.marker,
          PolicyDocument: JSON.stringify(trust),
        });
        role = { RoleId: created.RoleId };
      }
      const policyDoc = objectPolicy(p);
      let policyId = p.policyId;
      if (!policyId) {
        const policies = await api.call("cam", "ListPolicies", {
          Scope: "Local",
          Keyword: p.policyName,
          Page: 1,
          Rp: 200,
        });
        const match = policies.List?.find((x) => x.PolicyName === p.policyName);
        if (match) policyId = match.PolicyId;
      }
      if (policyId) {
        const policy = await api.call("cam", "GetPolicy", {
          PolicyId: policyId,
        });
        if (
          policy.Description !== p.marker ||
          !equal(document(policy.PolicyDocument), policyDoc)
        )
          throw new CloudError("策略归属或权限范围不匹配，已停止开通。");
      } else {
        policyId = (
          await api.call("cam", "CreatePolicy", {
            PolicyName: p.policyName,
            Description: p.marker,
            PolicyDocument: JSON.stringify(policyDoc),
          })
        ).PolicyId;
      }
      if (!policyId || !role?.RoleId)
        throw new CloudError("角色或策略尚未确认，请稍后继续。");
      this.checkpoint({ policyId, roleId: role.RoleId });
      await api.call("cam", "AttachRolePolicy", {
        PolicyId: policyId,
        AttachRoleId: role.RoleId,
      });
      const attached = await api.call("cam", "ListAttachedRolePolicies", {
        RoleId: role.RoleId,
        Page: 1,
        Rp: 200,
      });
      if (
        attached.TotalNum !== 1 ||
        attached.List?.length !== 1 ||
        attached.List[0].PolicyId !== policyId
      )
        throw new CloudError(
          "专用角色存在额外权限或授权尚未生效，请在控制台核对后继续。",
        );
      this.update({ message: "3/6 正在部署你自己的提醒函数…" });
      const Environment = {
        Variables: [
          {
            Key: "VERITAS_COS_HOST",
            Value: `${p.bucket}.cos.${REGION}.myqcloud.com`,
          },
          { Key: "VERITAS_SYNC_SECRET", Value: p.secret },
          ...deliveryEnvironment(this.config),
          { Key: "TZ", Value: "Asia/Shanghai" },
        ],
      };
      let fn = await this.functionInfo(api);
      const entries = Object.fromEntries(
        ["index.py", "veritas_bridge.py", "veritas_sync.py"].map((name) => [
          name,
          fs.readFileSync(new URL(`runtime/${name}`, import.meta.url)),
        ]),
      );
      const zip = sourceZip(entries),
        runtimeHash = createHash("sha256").update(zip).digest("hex");
      if (!fn) {
        await api.call("scf", "CreateFunction", {
          FunctionName: p.functionName,
          Namespace: "default",
          Description: p.marker,
          Runtime: "Python3.10",
          Handler: "index.main_handler",
          Type: "Event",
          Timeout: 60,
          MemorySize: 128,
          Role: p.roleName,
          Environment,
          PublicNetConfig: { PublicNetStatus: "ENABLE" },
          AutoCreateClsTopic: "FALSE",
          CodeSource: "ZipFile",
          Code: { ZipFile: zip.toString("base64") },
        });
        fn = await this.activeFunction(api);
        this.checkpoint({ runtimeHash });
      }
      if (fn.Role !== p.roleName)
        throw new CloudError("执行角色与开通记录不一致，请在控制台核对。");
      if (this.config.plan.runtimeHash !== runtimeHash) {
        const backup = await api.call("scf", "PublishVersion", {
          FunctionName: p.functionName,
          Namespace: "default",
          Description: "Hades runtime upgrade backup",
        });
        if (!backup.FunctionVersion)
          throw new CloudError("旧提醒程序备份未确认，未替换代码");
        this.checkpoint({ runtimeBackupVersion: backup.FunctionVersion });
        await api.call("scf", "UpdateFunctionCode", {
          FunctionName: p.functionName,
          Namespace: "default",
          Handler: "index.main_handler",
          CodeSource: "ZipFile",
          Code: { ZipFile: zip.toString("base64") },
        });
        await this.activeFunction(api);
        this.checkpoint({ runtimeHash });
      }
      const current = Object.fromEntries(
        (fn.Environment?.Variables || []).map((v) => [v.Key, v.Value]),
      );
      if (
        Object.keys(current).length !== Environment.Variables.length ||
        Environment.Variables.some((v) => current[v.Key] !== v.Value)
      ) {
        await api.call("scf", "UpdateFunctionConfiguration", {
          FunctionName: p.functionName,
          Namespace: "default",
          Environment,
        });
        await this.activeFunction(api);
      }
      await api.call("scf", "PutReservedConcurrencyConfig", {
        FunctionName: p.functionName,
        Namespace: "default",
        ReservedConcurrencyMem: 128,
      });
      this.update({ message: "4/6 正在建立带签名校验的同步入口…" });
      fn = await this.activeFunction(api);
      let http = (fn.Triggers || []).find(
        (t) => t.TriggerName === "veritas-sync" && t.Type === "http",
      );
      if (!http) {
        http = (
          await api.call("scf", "CreateTrigger", {
            FunctionName: p.functionName,
            Namespace: "default",
            Type: "http",
            TriggerName: "veritas-sync",
            Enable: "OPEN",
            TriggerDesc: JSON.stringify({
              AuthType: "NONE",
              NetConfig: { EnableIntranet: false, EnableExtranet: true },
              CorsConfig: { Enable: false },
              ApiGwCompatible: true,
              EnableSimpleMode: false,
            }),
          })
        ).TriggerInfo;
      }
      const desc = document(http?.TriggerDesc);
      if (
        desc?.AuthType !== "NONE" ||
        !desc.NetConfig?.EnableExtranet ||
        desc.ApiGwCompatible !== true
      )
        throw new CloudError("同步入口设置尚未确认，请在控制台核对后继续。");
      if (http.Enable !== 1 && http.Enable !== "OPEN")
        await api.call("scf", "UpdateTrigger", {
          FunctionName: p.functionName,
          Namespace: "default",
          Type: "http",
          TriggerName: "veritas-sync",
          Enable: "OPEN",
        });
      const base = desc.NetConfig.ExtranetUrl;
      const endpoint = syncURL(new URL("/veritas-sync", base).href);
      this.checkpoint({ endpoint });
      this.sync.configure({ url: endpoint, secret: p.secret });
      this.update({ message: "5/6 正在上传快照并核验云端读取结果…" });
      const body = JSON.stringify(this.getFeed());
      this.sync.enqueue(JSON.parse(body));
      await this.sync.flush();
      if (this.sync.status().phase !== "synced")
        throw new CloudError(
          "首次同步尚未成功；请查看同步提示，稍后点击继续。",
        );
      const health = await this.invoke(api, "health");
      if (
        health.status !== "ready" ||
        health.sha256 !== createHash("sha256").update(body).digest("hex")
      )
        throw new CloudError(
          "云端读取结果尚未与本机快照一致，请稍后继续核验。",
        );
      this.update({ message: "6/6 正在开启并核验 08:00 晨报与 21:00 晚报…" });
      fn = await this.activeFunction(api);
      for (const timer of TIMERS) {
        const existing = (fn.Triggers || []).find(
          (t) => t.TriggerName === timer.name,
        );
        const args = {
          FunctionName: p.functionName,
          Namespace: "default",
          Type: "timer",
          TriggerName: timer.name,
          Enable: "OPEN",
          TriggerDesc: timer.cron,
          CustomArgument: JSON.stringify({ mode: timer.mode }),
        };
        if (!existing) await api.call("scf", "CreateTrigger", args);
        else {
          const cron = existing.TriggerDesc?.startsWith("{")
            ? document(existing.TriggerDesc)?.cron
            : existing.TriggerDesc;
          if (
            existing.Type !== "timer" ||
            cron !== timer.cron ||
            document(existing.CustomArgument)?.mode !== timer.mode
          )
            throw new CloudError("同名定时器设置不匹配，请在控制台核对。");
          await api.call("scf", "UpdateTrigger", args);
        }
      }
      fn = await this.activeFunction(api);
      if (
        !TIMERS.every((timer) =>
          (fn.Triggers || []).some(
            (t) =>
              t.TriggerName === timer.name &&
              t.Type === "timer" &&
              (t.Enable === 1 || t.Enable === "OPEN") &&
              (document(t.TriggerDesc)?.cron || t.TriggerDesc) === timer.cron &&
              document(t.CustomArgument)?.mode === timer.mode,
          ),
        )
      )
        throw new CloudError("定时器启用状态尚未确认，请稍后继续核验。");
      this.checkpoint({ completedAt: Date.now() });
      this.update({
        phase: "ready",
        message:
          "快照读写与两个定时器已核验。请发送测试提醒，确认你的微信可以接收。",
      });
    } catch (e) {
      this.update({
        phase: "error",
        message:
          e instanceof CloudError
            ? e.message
            : "开通尚未完成，进度已保留。请检查网络与云服务状态后继续。",
      });
    } finally {
      this.busy = false;
      this.changed();
    }
    return this.status();
  }
  async testMessage() {
    this.idle();
    const api = this.ownAccount();
    if (!this.config.plan?.completedAt)
      throw new CloudError("请先完成云服务开通与核验。");
    if (Date.now() - (this.lastTest || 0) < 60_000)
      throw new CloudError("请等待一分钟再测试，避免重复推送。");
    this.busy = true;
    this.lastTest = Date.now();
    try {
      await this.activeFunction(api);
      const result = await this.invoke(api, "test");
      const accepted = result.status === "accepted_not_delivery_confirmed";
      this.testAccepted = accepted;
      this.update({
        message: accepted
          ? "提醒服务已受理，请检查所选接收端；收到后点击“已收到”。"
          : "提醒被拒绝或结果未知，请检查接收配置。暂未确认送达。",
      });
    } catch (e) {
      this.update({
        message:
          e instanceof CloudError
            ? e.message
            : "测试提醒结果未知，请检查接收端后再决定是否重试。",
      });
    } finally {
      this.busy = false;
      this.changed();
    }
    return this.status();
  }
  confirmReceived() {
    this.idle();
    if (!this.testAccepted || !this.config.plan?.completedAt)
      throw new CloudError("请先点击发送测试提醒，并在实际收到后确认。");
    this.checkpoint({ receivedAt: Date.now() });
    this.update({
      message: "你已确认收到测试提醒。每日 08:00、21:00 由独立云服务发送快报。",
    });
    return this.status();
  }
  stop() {
    this.login.stop();
  }
}
