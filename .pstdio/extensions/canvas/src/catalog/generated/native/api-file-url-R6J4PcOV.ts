// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./useQuery-OeRqqLZF.ts";
import { t } from "./useQueries-B-OSez1o.ts";
import { t as n } from "./api-BQ3Fs8xe.ts";
import { PstdioApiError as r } from "@pstdio/sdk/client";
// packages/pstdio-dashboard/src/lib/api-file-blob.ts
var i = /* @__PURE__ */ new Set([
	"image/png",
	"image/jpeg",
	"image/gif",
	"image/webp",
	"image/avif",
	"image/bmp",
	"image/x-icon",
	"text/plain"
]), a = (e) => i.has(e.type.split(";", 1)[0] ?? "") ? e : new Blob([e], { type: "application/octet-stream" }), o = "api-file-url", s = (e) => e.startsWith("/v1/"), c = (e) => {
	let { baseUrl: t, token: i } = n();
	return {
		queryKey: [o, e],
		queryFn: async ({ signal: n }) => {
			let o = await fetch(`${t}${e}`, {
				headers: i ? { authorization: `Bearer ${i}` } : {},
				signal: n
			});
			if (!o.ok) throw new r(`Request failed: ${o.status}`, o.status);
			let s = await o.blob();
			return n.throwIfAborted(), URL.createObjectURL(a(s));
		},
		staleTime: Infinity
	};
}, l = (t) => {
	let n = s(t), { data: r } = e({
		...c(t),
		enabled: n
	});
	return n ? r : t;
}, u = (e) => [...new Set(e.flatMap((e) => e.parts.flatMap((e) => e.type === "file" && s(e.url) ? [e.url] : [])))], d = (e) => {
	let n = u(e), r = t({
		queries: n.map(c),
		combine: (e) => e.map((e) => e.data)
	});
	if (n.length === 0) return e;
	let i = new Map(n.map((e, t) => [e, r[t] ?? ""]));
	return e.map((e) => ({
		...e,
		parts: e.parts.map((e) => e.type === "file" && i.has(e.url) ? {
			...e,
			url: i.get(e.url) ?? ""
		} : e)
	}));
};
export { d as n, l as r, o as t };
