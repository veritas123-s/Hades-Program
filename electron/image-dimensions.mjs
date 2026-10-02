// Bound decompression before passing public images to the native decoder.
export function imageDimensions(b) {
  if (
    b.length >= 24 &&
    b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    b.toString("ascii", 12, 16) === "IHDR"
  )
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b.length >= 10 && /^GIF8[79]a$/.test(b.toString("ascii", 0, 6)))
    return [b.readUInt16LE(6), b.readUInt16LE(8)];
  if (
    b.length >= 30 &&
    b.toString("ascii", 0, 4) === "RIFF" &&
    b.toString("ascii", 8, 12) === "WEBP"
  ) {
    const type = b.toString("ascii", 12, 16);
    if (type === "VP8X")
      return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
    if (type === "VP8 " && b.subarray(23, 26).equals(Buffer.from([157, 1, 42])))
      return [b.readUInt16LE(26) & 16383, b.readUInt16LE(28) & 16383];
    if (type === "VP8L" && b[20] === 47) {
      const v = b.readUInt32LE(21);
      return [1 + (v & 16383), 1 + ((v >>> 14) & 16383)];
    }
  }
  if (b.length >= 4 && b[0] === 255 && b[1] === 216) {
    for (let i = 2; i + 4 < b.length;) {
      if (b[i] !== 255) return null;
      while (b[i] === 255) i++;
      const marker = b[i++];
      if (marker === 217 || marker === 218) return null;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      const size = b.readUInt16BE(i);
      if (size < 2 || i + size > b.length) return null;
      if (
        [
          192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
        ].includes(marker) &&
        size >= 8
      )
        return [b.readUInt16BE(i + 5), b.readUInt16BE(i + 3)];
      i += size;
    }
  }
  return null;
}
