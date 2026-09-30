import test from "node:test";
import assert from "node:assert/strict";
import {
  deliveryChannel,
  deliveryReady,
  emailInput,
  deliveryEnvironment,
} from "../electron/cloud/delivery.mjs";
test("new reminders default to email while existing PushPlus users retain delivery", () => {
  assert.equal(deliveryChannel({}), "email");
  assert.equal(deliveryChannel({ pushToken: "legacy" }), "pushplus");
  assert.equal(deliveryReady({}), false);
});
test("mail configuration only permits TLS ports and cannot inject headers", () => {
  const input = {
    host: "smtp.qq.com",
    port: 465,
    user: "synthetic@example.com",
    to: "receiver@example.com",
    password: "synthetic-only",
  };
  assert.equal(emailInput(input).port, 465);
  for (const patch of [
    { port: 25 },
    { to: "x@example.com\r\nBcc:other@example.com" },
    { host: "https://host.example" },
    { password: "" },
  ])
    assert.throws(() => emailInput({ ...input, ...patch }));
  const env = deliveryEnvironment({ channel: "email", email: input });
  assert.equal(env.find((x) => x.Key === "DELIVERY_CHANNEL").Value, "email");
  assert.ok(!env.some((x) => x.Key === "PUSHPLUS_TOKEN"));
  const push = deliveryEnvironment({
    channel: "pushplus",
    pushToken: "synthetic",
  });
  assert.ok(!push.some((x) => x.Key.startsWith("SMTP")));
});
