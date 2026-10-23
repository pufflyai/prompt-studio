import type { Json } from "pstdio-sync-contracts";

export const projectionStringTag = "\u0001s";
export const projectionBytesTag = "\u0001b";
export const projectionFoldedTag = "\u0001f";
const keyPrefix = "\u0001k";

const needsEncoding = (value: string) => {
  for (const character of value) {
    const point = character.codePointAt(0)!;
    if (point === 0 || point > 127) return true;
  }
  return false;
};

const characterBytes = (characters: Iterable<string>) => {
  const bytes: number[] = [];
  for (const character of characters) {
    const point = character.codePointAt(0)!;
    if (point < 0x80) bytes.push(point);
    else if (point < 0x800) bytes.push(0xc0 | (point >> 6), 0x80 | (point & 63));
    else if (point < 0x10000) bytes.push(0xe0 | (point >> 12), 0x80 | ((point >> 6) & 63), 0x80 | (point & 63));
    else bytes.push(0xf0 | (point >> 18), 0x80 | ((point >> 12) & 63), 0x80 | ((point >> 6) & 63), 0x80 | (point & 63));
  }
  return Buffer.from(bytes).toString("hex");
};
// WTF-8 retains lone surrogates while sharing ordinary UTF-8's code point order.
export const projectionStringBytes = (value: string) => characterBytes(value);
// Encode each UTF-16 unit independently so substring matching also retains half-surrogate matches.
export const projectionSubstringBytes = (value: string) => characterBytes(value.split(""));

export const projectionKey = (key: string) =>
  key.startsWith("\u0001") || needsEncoding(key) ? keyPrefix + Buffer.from(key, "utf16le").toString("hex") : key;
const originalKey = (key: string) =>
  key.startsWith(keyPrefix) ? Buffer.from(key.slice(keyPrefix.length), "hex").toString("utf16le") : key;

export const encodeProjectionValue = (value: Json) => {
  let result: Json = value;
  if (typeof value === "string" && needsEncoding(value)) {
    result = {
      [projectionStringTag]: Buffer.from(value, "utf16le").toString("hex"),
      [projectionBytesTag]: projectionStringBytes(value),
      [projectionFoldedTag]: projectionSubstringBytes(value.toLowerCase()),
    };
  } else if (Array.isArray(value)) {
    const items: Json[] = [];
    for (const item of value) items.push(encodeProjectionValue(item));
    result = items;
  } else if (value !== null && typeof value === "object") {
    const object: Record<string, Json> = {};
    for (const [key, item] of Object.entries(value))
      Object.defineProperty(object, projectionKey(key), {
        value: encodeProjectionValue(item),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    result = object;
  }
  return result;
};

export const decodeProjectionValue = (value: Json) => {
  let result: Json = value;
  if (Array.isArray(value)) {
    const items: Json[] = [];
    for (const item of value) items.push(decodeProjectionValue(item));
    result = items;
  } else if (value !== null && typeof value === "object") {
    if (Object.hasOwn(value, projectionStringTag))
      return Buffer.from(value[projectionStringTag] as string, "hex").toString("utf16le");
    const object: Record<string, Json> = {};
    for (const [key, item] of Object.entries(value))
      Object.defineProperty(object, originalKey(key), {
        value: decodeProjectionValue(item),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    result = object;
  }
  return result;
};
