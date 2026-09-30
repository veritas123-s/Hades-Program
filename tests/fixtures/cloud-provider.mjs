import { createHash } from "node:crypto";
export function fakeCloud() {
  const state = {
    calls: [],
    identity: { AppId: 1250000000, OwnerUin: "100000000001" },
    role: null,
    policy: null,
    fn: null,
    body: null,
    testCount: 0,
    failAction: "",
    badHealth: false,
    publicBucket: false,
  };
  const ok = (v) => Response.json({ Response: structuredClone(v) });
  const fail = (code) =>
    ok({ Error: { Code: code, Message: "DO_NOT_LEAK_UPSTREAM" } });
  async function fetcher(url, options) {
    if (options.redirect !== "error")
      throw new Error("Redirects must be blocked");
    if (url === "https://cli.cloud.tencent.com/get_temp_cred")
      return Response.json({
        SecretId: "synthetic-cloud-id",
        SecretKey: "synthetic-cloud-secret",
        Token: "synthetic-cloud-session",
        ExpiresAt: Math.floor(Date.now() / 1000) + 3600,
      });
    if (
      /^https:\/\/veritas-[a-f0-9]{16}-1250000000\.cos\.ap-shanghai\.myqcloud\.com\//.test(
        url,
      )
    ) {
      state.calls.push({
        action: `COS ${options.method}`,
        headers: options.headers,
      });
      if (options.method === "PUT") {
        if (options.headers["x-cos-acl"] !== "private")
          throw new Error("Bucket must be private");
        state.bucketCreated = true;
        return new Response("", { status: 200 });
      }
      if (!state.bucketCreated) return new Response("", { status: 404 });
      return new Response(
        `<AccessControlPolicy><Owner><ID>qcs::cam::uin/100000000001:uin/100000000001</ID></Owner>${state.publicBucket ? "<URI>AllUsers</URI>" : ""}</AccessControlPolicy>`,
      );
    }
    if (url === "https://synthetic.ap-shanghai.tencentscf.com/veritas-sync") {
      state.calls.push({ action: "sync" });
      if (state.failAction === "sync") return new Response("", { status: 503 });
      state.body = options.body;
      return Response.json({
        status: "stored",
        sha256: createHash("sha256").update(options.body).digest("hex"),
        generated_at: JSON.parse(options.body).generated_at,
      });
    }
    if (!/^https:\/\/(scf|cam)\.tencentcloudapi\.com\/$/.test(url))
      throw new Error("Unexpected network endpoint");
    const action = options.headers["X-TC-Action"],
      p = JSON.parse(options.body);
    state.calls.push({ action, p, headers: options.headers });
    if (state.failAction === action) return fail("UnauthorizedOperation");
    switch (action) {
      case "GetUserAppId":
        return ok(state.identity);
      case "GetRole":
        return state.role
          ? ok({ RoleInfo: state.role })
          : fail("ResourceNotFound.Role");
      case "CreateRole":
        state.role = { ...p, RoleId: "42" };
        return ok({ RoleId: "42" });
      case "ListPolicies":
        return ok({ List: state.policy ? [state.policy] : [] });
      case "GetPolicy":
        return ok(state.policy);
      case "CreatePolicy":
        state.policy = { ...p, PolicyId: 123 };
        return ok({ PolicyId: 123 });
      case "AttachRolePolicy":
        return ok({});
      case "ListAttachedRolePolicies":
        return ok({ List: [{ PolicyId: 123 }], TotalNum: 1 });
      case "GetFunction":
        return state.fn ? ok(state.fn) : fail("ResourceNotFound.Function");
      case "CreateFunction":
        state.fn = { ...p, Status: "Active", Triggers: [] };
        return ok({});
      case "UpdateFunctionConfiguration":
        state.fn.Environment = p.Environment;
        return ok({});
      case "PublishVersion":
        return ok({ FunctionVersion: "1" });
      case "UpdateFunctionCode":
        state.fn.Code = p.Code;
        return ok({});
      case "PutReservedConcurrencyConfig":
        return ok({});
      case "CreateTrigger": {
        const trigger = { ...p, Enable: p.Enable === "OPEN" ? 1 : 0 };
        if (p.Type === "http") {
          const d = JSON.parse(p.TriggerDesc);
          d.NetConfig.ExtranetUrl =
            "https://synthetic.ap-shanghai.tencentscf.com";
          trigger.TriggerDesc = JSON.stringify(d);
        }
        state.fn.Triggers.push(trigger);
        return ok({ TriggerInfo: trigger });
      }
      case "UpdateTrigger": {
        const t = state.fn.Triggers.find(
          (t) => t.TriggerName === p.TriggerName,
        );
        Object.assign(t, p, { Enable: p.Enable === "OPEN" ? 1 : 0 });
        return ok({});
      }
      case "Invoke": {
        const request = JSON.parse(p.ClientContext);
        const result =
          request.action === "health"
            ? {
                status: "ready",
                sha256: state.badHealth
                  ? "wrong"
                  : createHash("sha256").update(state.body).digest("hex"),
              }
            : { status: "accepted_not_delivery_confirmed" };
        if (request.action === "test") state.testCount++;
        return ok({ Result: { RetCode: 0, RetMsg: JSON.stringify(result) } });
      }
      default:
        throw new Error("Unknown fake API action " + action);
    }
  }
  return { state, fetcher };
}
export function memoryVault() {
  return {
    data: {},
    load() {
      return structuredClone(this.data);
    },
    save(p) {
      this.data = { ...this.data, ...structuredClone(p) };
    },
    clear() {
      this.data = {};
    },
  };
}
