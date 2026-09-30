import test from "node:test";
import assert from "node:assert/strict";
import { decodeNews, decodeEntities } from "../electron/news-text.mjs";
import {
  organizationName,
  followIntent,
  activityDetails,
} from "../electron/news-organizations.mjs";
import { publicLink } from "../electron/commands/links.mjs";
import { initialWorkspace } from "../src/platform/model.mjs";
import { widgetIntent, addWidget } from "../src/platform/widget-recipes.mjs";
test("网页编码和数字实体正确恢复中文，非法字节不作为快讯入库", () => {
  assert.equal(
    decodeNews(Buffer.from("中文活动"), "text/html; charset=utf-8"),
    "中文活动",
  );
  assert.equal(
    decodeNews(
      Buffer.from([0xd6, 0xd0, 0xce, 0xc4]),
      "text/html; charset=gb2312",
    ),
    "中文",
  );
  assert.equal(
    decodeEntities("&#20013;&#x6587;&mdash;活动&ldquo;讲座&rdquo;"),
    "中文—活动“讲座”",
  );
  assert.throws(
    () =>
      decodeNews(Buffer.from([0xff, 0xfe, 0xff]), "text/html; charset=utf-8"),
    /编码异常/,
  );
  assert.throws(() => publicLink("javascript:alert(1)"));
  assert.throws(() => publicLink("https://localhost/"));
  assert.throws(() => publicLink("https://user:pass@www.sjtu.edu.cn/"));
  assert.equal(
    publicLink("https://www.sjtu.edu.cn/?x=1&y=2"),
    "https://www.sjtu.edu.cn/?x=1&y=2",
  );
});
test("一句话关注只接受明确命令，活动必须有证据，发布日期不冒充活动日期", () => {
  assert.equal(followIntent("帮我关注荣昶博医计划公众号"), "荣昶博医计划");
  assert.equal(followIntent("关注公众号：测试组织"), "测试组织");
  assert.equal(followIntent("不要关注测试组织公众号"), null);
  assert.throws(() => organizationName("https://evil.example/"));
  assert.deepEqual(activityDetails("发布日期：2026年9月30日"), {});
  assert.equal(
    activityDetails("活动时间：2026年9月30日 18:00").activityDate,
    "2026-09-30",
  );
  assert.deepEqual(activityDetails("活动时间：2026年2月30日"), {});
  assert.deepEqual(activityDetails("讲座时间：9月30日"), {});
});
test("单句组件创建校验日期和类型，已有组件不重复，便笺原文不被覆盖", () => {
  const original = initialWorkspace();
  original.widgetData["quick-note"] = {
    version: 1,
    data: { text: "原始便笺" },
  };
  const configured = addWidget(
    original,
    widgetIntent("把随手记小组件添加到首页"),
  );
  assert.equal(configured.widgetData["quick-note"].data.text, "原始便笺");
  const repeated = addWidget(
    configured,
    widgetIntent("把随手记小组件添加到首页"),
  );
  assert.equal(
    repeated.widgets.order.filter((x) => x === "quick-note").length,
    1,
  );
  const countdown = addWidget(
    repeated,
    widgetIntent("添加一个考试倒计时小组件，日期2026-12-20，叫期末考试"),
    "custom-test",
  );
  assert.equal(countdown.widgetData["custom-test"].data.date, "2026-12-20");
  assert.equal(countdown.widgetData["custom-test"].data.title, "期末考试");
  assert.throws(
    () => widgetIntent("添加一个倒计时小组件，日期2026-02-30"),
    /准确日期/,
  );
  assert.throws(
    () =>
      addWidget(
        original,
        { kind: "javascript", code: "evil" },
        "custom-invalid",
      ),
    /类型无效/,
  );
  assert.equal(original.widgetData["custom-test"], undefined);
});
