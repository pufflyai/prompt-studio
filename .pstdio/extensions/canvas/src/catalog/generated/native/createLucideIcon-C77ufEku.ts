// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { createElement as e, forwardRef as t } from "react";
// node_modules/.bun/lucide-react@0.557.0+b1ab299f0a400331/node_modules/lucide-react/dist/esm/shared/src/utils.js
var n = (e) => e.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase(), r = (e) => e.replace(/^([A-Z])|[\s-_]+(\w)/g, (e, t, n) => n ? n.toUpperCase() : t.toLowerCase()), i = (e) => {
	let t = r(e);
	return t.charAt(0).toUpperCase() + t.slice(1);
}, a = (...e) => e.filter((e, t, n) => !!e && e.trim() !== "" && n.indexOf(e) === t).join(" ").trim(), o = (e) => {
	for (let t in e) if (t.startsWith("aria-") || t === "role" || t === "title") return !0;
}, s = {
	xmlns: "http://www.w3.org/2000/svg",
	width: 24,
	height: 24,
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 2,
	strokeLinecap: "round",
	strokeLinejoin: "round"
}, c = t(({ color: t = "currentColor", size: n = 24, strokeWidth: r = 2, absoluteStrokeWidth: i, className: c = "", children: l, iconNode: u, ...d }, f) => e("svg", {
	ref: f,
	...s,
	width: n,
	height: n,
	stroke: t,
	strokeWidth: i ? Number(r) * 24 / Number(n) : r,
	className: a("lucide", c),
	...!l && !o(d) && { "aria-hidden": "true" },
	...d
}, [...u.map(([t, n]) => e(t, n)), ...Array.isArray(l) ? l : [l]])), l = (r, o) => {
	let s = t(({ className: t, ...s }, l) => e(c, {
		ref: l,
		iconNode: o,
		className: a(`lucide-${n(i(r))}`, `lucide-${r}`, t),
		...s
	}));
	return s.displayName = i(r), s;
};
export { c as n, l as t };
