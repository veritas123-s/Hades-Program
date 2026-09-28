import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { ASSET_ID } from "../src/themes/custom.mjs";
export class ThemeAssets {
  constructor(directory, nativeImage) {
    this.directory = path.join(directory, "theme-backgrounds");
    this.nativeImage = nativeImage;
  }
  encode(bytes) {
    if (bytes.length > 20_000_000) throw Error("请选择20MB以内的图片");
    const png = bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpeg = bytes[0] === 255 && bytes[1] === 216;
    const webp =
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP";
    if (!png && !jpeg && !webp) throw Error("仅支持 PNG、JPEG 和 WebP 图片");
    let image = this.nativeImage.createFromBuffer(bytes);
    if (image.isEmpty()) throw Error("图片无法读取");
    const size = image.getSize();
    if (size.width > 16000 || size.height > 16000) throw Error("图片尺寸过大");
    if (size.width > 2560 || size.height > 2560)
      image = image.resize(
        size.width >= size.height ? { width: 2560 } : { height: 2560 },
      );
    const output = image.toPNG();
    if (output.length > 8_000_000)
      throw Error("图片转换后过大，请选择更小的图片");
    return output;
  }
  store(bytes) {
    const id = createHash("sha256").update(bytes).digest("hex") + ".png";
    fs.mkdirSync(this.directory, { recursive: true });
    if (!fs.existsSync(path.join(this.directory, id)))
      fs.writeFileSync(path.join(this.directory, id), bytes, { flag: "wx" });
    return id;
  }
  importFile(file) {
    if (fs.statSync(file).size > 20_000_000)
      throw Error("请选择20MB以内的图片");
    return this.store(this.encode(fs.readFileSync(file)));
  }
  read(id) {
    if (!ASSET_ID.test(id)) throw Error("背景图标识无效");
    return fs.readFileSync(path.join(this.directory, id));
  }
  ids(state) {
    return [
      ...new Set(
        [
          state.workspace.appearance.image,
          ...state.workspace.customThemes.map((x) => x.appearance.image),
        ].filter((x) => ASSET_ID.test(x)),
      ),
    ];
  }
  export(state) {
    return Object.fromEntries(
      this.ids(state).map((id) => [id, this.read(id).toString("base64")]),
    );
  }
  prepareRestore(raw, state) {
    const assets = [];
    for (const id of this.ids(state)) {
      const encoded = raw.themeAssets?.[id];
      if (encoded === undefined) {
        this.read(id);
        continue;
      }
      if (
        typeof encoded !== "string" ||
        encoded.length > 11_000_000 ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)
      )
        throw Error("备份背景图无效");
      const bytes = Buffer.from(encoded, "base64");
      if (createHash("sha256").update(bytes).digest("hex") + ".png" !== id)
        throw Error("备份背景图校验失败");
      if (
        bytes.length > 8_000_000 ||
        !bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      )
        throw Error("备份背景图必须为有效 PNG");
      this.encode(bytes);
      assets.push(bytes);
    }
    return () => assets.forEach((bytes) => this.store(bytes));
  }
}
