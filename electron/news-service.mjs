import { articleCover, loadNewsThumbnail } from "./news-images.mjs";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { beijingDay } from "../src/briefing.mjs";
import { decodeNews, decodeEntities } from "./news-text.mjs";
import { organizationName, activityDetails } from "./news-organizations.mjs";
import { validDay } from "../src/domain.mjs";
import { recentNews } from "../src/news-window.mjs";

export const WECHAT_SOURCES = [
  "上海交通大学",
  "上海交通大学医学院",
  "上交大",
  "易爱医",
  "小医生Joy",
  "交医大一时间",
  "青春交医",
  "卢小团",
  "交医社管小希",
  "荣昶博医计划",
  "SHSMU摇篮计划",
  "润哥杂货铺",
];
const domains = new Set([
  "news.sjtu.edu.cn",
  "www.shsmu.edu.cn",
  "weixin.sogou.com",
  "mp.weixin.qq.com",
]);
const clean = (s) =>
  decodeEntities(
    String(s || "")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]*>/g, "")
      .replace(
        /&(?:nbsp|amp|lt|gt|quot|apos);/g,
        (x) =>
          ({
            "&nbsp;": " ",
            "&amp;": "&",
            "&lt;": "<",
            "&gt;": ">",
            "&quot;": '"',
            "&apos;": "'",
          })[x],
      ),
  )
    .replace(/\s+/g, " ")
    .trim();
export function newsURL(raw) {
  const u = new URL(String(raw));
  if (
    u.protocol !== "https:" ||
    !domains.has(u.hostname) ||
    u.username ||
    u.password ||
    u.port
  )
    throw Error("仅支持学校新闻网、搜狗微信和微信文章的 HTTPS 地址");
  return u.href;
}
export function searchURL(source, page = 1) {
  const u = new URL("https://weixin.sogou.com/weixin");
  u.search = new URLSearchParams({
    type: "2",
    ie: "utf8",
    query: source,
    page: String(page),
  });
  return u.href;
}
function item(source, title, url, publishedAt, excerpt = "") {
  if (
    !title ||
    !Number.isFinite(publishedAt) ||
    publishedAt < Date.UTC(2020, 0, 1) ||
    publishedAt > Date.now() + 300000
  )
    return null;
  const id = createHash("sha256")
    .update(JSON.stringify([source, title, publishedAt]))
    .digest("hex");
  return {
    id,
    source,
    title: clean(title).slice(0, 300),
    url: newsURL(url),
    publishedAt,
    date: beijingDay(publishedAt),
    excerpt: clean(excerpt).slice(0, 1000),
    deletedAt: null,
    ...activityDetails(clean(title) + " " + clean(excerpt)),
  };
}
export function parseWechatIndex(html, source) {
  const items = [];
  for (const m of html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    const block = m[1],
      account = clean(
        block.match(
          /<span[^>]*class=["']all-time-y2["'][^>]*>([\s\S]*?)<\/span>/i,
        )?.[1],
      );
    if (account !== source) continue;
    const heading = block.match(
      /<h3[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i,
    )?.[1];
    const time = block.match(/timeConvert\(['"](\d{10})['"]\)/)?.[1];
    if (!heading || !time) continue;
    const title = clean(heading),
      url = searchURL(`${source} ${title}`);
    const row = item(
      source,
      title,
      url,
      Number(time) * 1000,
      block.match(/<p[^>]*class=["']txt-info["'][^>]*>([\s\S]*?)<\/p>/i)?.[1],
    );
    if (row)
      items.push({
        ...row,
        imageURL: articleCover(block, "https://weixin.sogou.com"),
        searchResult: true,
      });
  }
  return items;
}
export function parseUniversityIndex(html) {
  const rows = [];
  for (const m of html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    const block = m[1],
      href = block.match(/<a[^>]*href=["'](\/zhxw\/(\d{8})\/\d+\.html)["']/i);
    if (!href) continue;
    const title =
      block.match(/<p[^>]*class=["']dot["'][^>]*>([\s\S]*?)<\/p>/i)?.[1] ||
      block.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/i)?.[1];
    const day = href[2],
      time = Date.parse(
        `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6)}T00:00:00+08:00`,
      );
    const row = item(
      "交大新闻网",
      clean(title),
      new URL(href[1], "https://news.sjtu.edu.cn").href,
      time,
      block.match(/class=["']des[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1],
    );
    if (row)
      rows.push({
        ...row,
        imageURL: articleCover(block, "https://news.sjtu.edu.cn"),
        publishedPrecision: "day",
      });
  }
  return rows;
}
export function parseArticle(html, url) {
  const title =
    html.match(
      /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i,
    )?.[1] ||
    html.match(
      /<td[^>]*class=["']mod_font08 mod_bold mod_align["'][^>]*>([\s\S]*?)<\/td>/i,
    )?.[1] ||
    html.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/i)?.[1];
  const nickname = html.match(/var\s+nickname\s*=\s*["']([^"']+)["']/)?.[1];
  const unix = html.match(
    /(?:var\s+(?:create_time|ct)\s*=\s*["']?|data-publish-time=["'])(\d{10})/i,
  )?.[1];
  const date = (
    html.match(
      /<td[^>]*class=["']mod_font08_t[^"']*["'][^>]*>\s*(20\d\d-\d{2}-\d{2})\s*<\/td>/i,
    )?.[1] ||
    html.match(
      /(?:发布日期|发布时间|发布时间：|日期)[：:\s]*(20\d\d[-年]\d{1,2}[-月]\d{1,2})/,
    )?.[1]
  )?.replace(/[年月]/g, "-");
  const time = unix
    ? Number(unix) * 1000
    : date
      ? Date.parse(date + "T00:00:00+08:00")
      : NaN;
  const body =
    html.match(/<div[^>]*id=["']js_content["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ||
    html.match(
      /<div[^>]*id=["']vsb_content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    )?.[1] ||
    "";
  const parsed = item(
    clean(nickname) || "医学院新闻网",
    clean(title),
    url,
    time,
    clean(body).slice(0, 1000),
  );
  return parsed
    ? {
        ...parsed,
        imageURL: articleCover(html, url),
        publishedPrecision: unix ? "time" : "day",
      }
    : null;
}

export class NewsService {
  constructor({
    directory,
    fetcher = fetch,
    allowed = () => true,
    changed = () => {},
    summarize,
    openReader,
    nativeImage,
    imageFetcher = (...args) => fetch(...args),
  }) {
    Object.assign(this, {
      fetcher,
      allowed,
      changed,
      summarize,
      openReader,
      nativeImage,
      imageFetcher,
    });
    this.imageCache = new Map();
    this.file = path.join(directory, "campus-news.json");
    this.data = {
      version: 1,
      automatic: true,
      items: [],
      coverage: [],
      summary: null,
    };
    this.generation = 0;
    this.busy = false;
    if (fs.existsSync(this.file)) {
      try {
        if (fs.statSync(this.file).size > 8 * 1024 * 1024) throw Error();
        const d = JSON.parse(fs.readFileSync(this.file, "utf8"));
        if (d.version !== 1 || !Array.isArray(d.items) || d.items.length > 3000)
          throw Error();
        if (
          d.followedSources &&
          (!Array.isArray(d.followedSources) ||
            d.followedSources.length > 40 ||
            d.followedSources.some((x) => organizationName(x) !== x))
        )
          throw Error();
        this.data = d;
        if (this.data.summary?.kind !== "activities") this.data.summary = null;
      } catch {
        fs.copyFileSync(
          this.file,
          this.file + ".unreadable-" + Date.now(),
          fs.constants.COPYFILE_EXCL,
        );
        this.data.summaryError =
          "快讯缓存无法读取，原文件已另存保留；其他功能可继续使用";
      }
    }
  }
  save() {
    fs.writeFileSync(this.file + ".tmp", JSON.stringify(this.data), {
      mode: 0o600,
    });
    fs.renameSync(this.file + ".tmp", this.file);
  }
  status() {
    return {
      ...this.data,
      busy: this.busy,
      sources: this.sources(),
      recent: recentNews(this.data.items),
    };
  }
  sources() {
    return this.data.followedSources || WECHAT_SOURCES;
  }
  follow({ name }) {
    if (!this.allowed()) throw Error("请先登录");
    const source = organizationName(name),
      before = this.data.followedSources;
    if (this.sources().includes(source)) return this.status();
    if (this.sources().length >= 40) throw Error("最多关注40个组织");
    this.data.followedSources = [...this.sources(), source];
    try {
      this.save();
    } catch (error) {
      this.data.followedSources = before;
      throw error;
    }
    this.changed();
    return this.status();
  }
  unfollow({ name }) {
    const before = this.data.followedSources;
    this.data.followedSources = this.sources().filter(
      (x) => x !== organizationName(name),
    );
    try {
      this.save();
    } catch (error) {
      this.data.followedSources = before;
      throw error;
    }
    this.changed();
    return this.status();
  }
  activity({ id, date }) {
    if (!validDay(date)) throw Error("请选择有效活动日期");
    const row = this.data.items.find((x) => x.id === id && !x.deletedAt);
    if (!row) throw Error("消息不存在或已删除");
    Object.assign(row, {
      activityDate: date,
      activityEvidence: "使用者核对原文后确认",
      activityProvenance: "manual",
    });
    this.data.summary = null;
    this.save();
    this.changed();
    return this.status();
  }
  async image({ id }) {
    if (!this.allowed()) throw Error("请先登录");
    const row = this.data.items.find((x) => x.id === id && !x.deletedAt);
    if (!row?.imageURL) return { image: "" };
    const generation = this.generation;
    if (!this.imageCache.has(row.imageURL)) {
      if (this.imageCache.size >= 24)
        this.imageCache.delete(this.imageCache.keys().next().value);
      this.imageCache.set(
        row.imageURL,
        loadNewsThumbnail(
          row.imageURL,
          this.nativeImage,
          this.imageFetcher,
        ).catch(() => ""),
      );
    }
    const image = await this.imageCache.get(row.imageURL);
    return {
      image:
        generation === this.generation && this.allowed() && !row.deletedAt
          ? image
          : "",
    };
  }
  async open({ url }) {
    const safe = newsURL(url);
    this.reader?.close();
    this.reader = await this.openReader(safe);
    return { ok: true };
  }
  stop() {
    this.imageCache.clear();
    this.reader?.close();
    this.reader = null;
    clearInterval(this.interval);
    this.interval = null;
    this.generation++;
    this.controller?.abort();
  }
  start() {
    if (this.interval || !this.data.automatic) return;
    this.interval = setInterval(() => {
      if (this.allowed()) this.collect().catch(() => {});
    }, 3600000);
    this.interval.unref?.();
    if (
      this.allowed() &&
      (!this.data.lastAttempt || Date.now() - this.data.lastAttempt > 3600000)
    )
      queueMicrotask(() => this.collect().catch(() => {}));
  }
  configure({ automatic }) {
    if (typeof automatic !== "boolean") throw Error("自动采集选项无效");
    this.data.automatic = automatic;
    this.save();
    this.stop();
    this.interval = null;
    if (automatic) this.start();
    return this.status();
  }
  async read(url) {
    const r = await this.fetcher(newsURL(url), {
      redirect: "error",
      signal: AbortSignal.any([
        this.controller.signal,
        AbortSignal.timeout(12000),
      ]),
    });
    if (!r.ok) throw Error("来源暂不可用");
    const reader = r.body.getReader();
    let size = 0;
    const chunks = [];
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2 * 1024 * 1024) {
        await reader.cancel();
        throw Error("来源内容过大");
      }
      chunks.push(Buffer.from(value));
    }
    const html = decodeNews(
      Buffer.concat(chunks),
      r.headers.get("content-type") || "",
    );
    if (/请输入验证码|访问过于频繁|安全验证|antispider/i.test(html))
      throw Error("需要本人验证或稍后重试");
    return html;
  }
  merge(rows) {
    const prior = new Map(this.data.items.map((x) => [x.id, x]));
    for (const x of rows) {
      const old = prior.get(x.id);
      prior.set(x.id, {
        ...x,
        imageURL: x.imageURL || old?.imageURL || "",
        deletedAt: old?.deletedAt || null,
        ...(old?.activityProvenance === "manual"
          ? {
              activityDate: old.activityDate,
              activityEvidence: old.activityEvidence,
              activityProvenance: "manual",
            }
          : {}),
      });
    }
    this.data.items = [...prior.values()]
      .sort((a, b) => b.publishedAt - a.publishedAt)
      .slice(0, 3000);
  }
  async collect({ windowHours = 24 } = {}) {
    if (windowHours !== 24) throw Error("只支持最近24小时采集");
    if (this.busy) throw Error("正在采集，请等待");
    if (!this.allowed()) throw Error("请先登录");
    this.busy = true;
    this.controller = new AbortController();
    const generation = this.generation,
      coverage = [],
      rows = [];
    this.changed();
    try {
      try {
        const found = parseUniversityIndex(
          await this.read("https://news.sjtu.edu.cn/zhxw/index.html"),
        );
        if (!found.length) throw Error();
        rows.push(...found);
        coverage.push({
          source: "交大新闻网",
          status: "partial",
          count: found.length,
          note: "已读取综合新闻首页，非全站覆盖",
        });
      } catch {
        coverage.push({
          source: "交大新闻网",
          status: "unavailable",
          note: "未能验证新闻列表",
        });
      }
      try {
        const html = await this.read("https://www.shsmu.edu.cn/news/");
        const urls = [
          ...new Set(
            [...html.matchAll(/href=["'](info\/\d+\/\d+\.htm)["']/g)].map(
              (x) => new URL(x[1], "https://www.shsmu.edu.cn/news/").href,
            ),
          ),
        ].slice(0, 12);
        let count = 0;
        for (const url of urls) {
          try {
            const row = parseArticle(await this.read(url), url);
            if (row) {
              rows.push(row);
              count++;
            }
          } catch {}
        }
        coverage.push({
          source: "医学院新闻网",
          status: count ? "partial" : "unavailable",
          count,
          note: "首页最近12篇，只有明确发布日期的文章入库",
        });
      } catch {
        coverage.push({
          source: "医学院新闻网",
          status: "unavailable",
          note: "来源读取失败",
        });
      }
      for (const source of this.sources()) {
        if (generation !== this.generation || !this.allowed())
          return this.status();
        try {
          let count = 0;
          for (let page = 1; page <= 2; page++) {
            const html = await this.read(searchURL(source, page));
            if (!/news-list|没有找到|未找到/.test(html)) throw Error();
            const found = parseWechatIndex(html, source);
            rows.push(...found);
            count += found.length;
          }
          coverage.push({
            source,
            status: "partial",
            count,
            note: "公众号名称精确匹配；公开索引最近2页，索引可能延迟或遗漏",
          });
        } catch {
          coverage.push({
            source,
            status: "unavailable",
            note: "公开索引未通过检查，可能需要验证码；未判定为无新文章",
          });
        }
      }
      if (generation !== this.generation || !this.allowed())
        return this.status();
      const window = recentNews(rows);
      this.merge(
        [...window.groups, ...window.uncertainGroups].flatMap((x) => x.items),
      );
      this.data.coverage = coverage;
      this.data.lastAttempt = Date.now();
      this.save();
      const today = this.data.items.filter(
        (x) => x.activityDate === beijingDay() && !x.deletedAt,
      );
      if (today.length && this.summarize) {
        try {
          const digest = await this.summarize(today, coverage);
          if (
            generation === this.generation &&
            this.allowed() &&
            today.every((x) =>
              this.data.items.some(
                (current) => current.id === x.id && !current.deletedAt,
              ),
            )
          ) {
            this.data.summary = {
              date: beijingDay(),
              kind: "activities",
              text: digest,
              ids: today.map((x) => x.id),
            };
            this.data.summaryError = "";
            this.save();
          }
        } catch {
          this.data.summaryError = "AI 整理未完成，已保留原始消息";
        }
      }
      return this.status();
    } finally {
      this.busy = false;
      this.changed();
    }
  }
  async import({ url }) {
    if (this.busy) throw Error("请等待当前采集结束");
    if (!this.allowed()) throw Error("请先登录");
    this.controller = new AbortController();
    const safe = new URL(newsURL(url));
    if (safe.hostname !== "mp.weixin.qq.com")
      throw Error("请粘贴微信文章 HTTPS 链接");
    const generation = this.generation;
    this.busy = true;
    this.changed();
    try {
      const row = parseArticle(await this.read(safe.href), safe.href);
      if (generation !== this.generation || !this.allowed())
        throw Error("登录状态已变更，未保存文章");
      if (!row) throw Error("文章标题或发布日期未通过检查，未入库");
      this.merge([row]);
      this.data.summary = null;
      this.save();
      return this.status();
    } finally {
      this.busy = false;
      this.changed();
    }
  }
  remove({ id, restore = false }) {
    const x = this.data.items.find((x) => x.id === id);
    if (!x) throw Error("文章不存在");
    x.deletedAt = restore ? null : Date.now();
    this.data.summary = null;
    this.save();
    this.changed();
    return this.status();
  }
}
