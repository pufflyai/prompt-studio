// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
// packages/pstdio-file-types/src/index.ts
var e = {
	avif: "image/avif",
	bmp: "image/bmp",
	gif: "image/gif",
	heic: "image/heic",
	ico: "image/x-icon",
	jpeg: "image/jpeg",
	jpg: "image/jpeg",
	png: "image/png",
	tif: "image/tiff",
	tiff: "image/tiff",
	webp: "image/webp"
}, t = Object.keys(e), n = (e) => {
	let t = (e.split(/[\\/]/).pop() ?? e).split(".").pop();
	return t ? t.toLowerCase() : "";
}, r = (t) => e[n(t)] ?? null, i = (e) => r(e) !== null, a = 1e3, o = /* @__PURE__ */ new Set([
	"bun.lock",
	"bun.lockb",
	"package-lock.json",
	"pnpm-lock.yaml",
	"yarn.lock"
]), s = /* @__PURE__ */ new Set([
	...t,
	"pdf",
	"zip",
	"tar",
	"gz",
	"tgz",
	"rar",
	"7z",
	"exe",
	"dll",
	"so",
	"dylib",
	"wasm",
	"class",
	"jar",
	"mp3",
	"mp4",
	"mov",
	"ogg",
	"wav",
	"webm",
	"flac",
	"ttf",
	"otf",
	"woff",
	"woff2",
	"eot"
]), c = (e) => (e.additions ?? 0) + (e.deletions ?? 0), l = (e) => c(e) > a, u = (e) => {
	let t = e.split(/[\\/]/).pop() ?? e;
	return o.has(t) || t.endsWith(".min.js") || t.endsWith(".generated.ts");
}, d = (e) => {
	let t = n(e);
	return t.length > 0 && s.has(t);
}, f = i;
export { f as a, u as i, c as n, l as o, d as r, a as t };
