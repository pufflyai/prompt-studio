// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { Box as e } from "@chakra-ui/react";
import { jsx as t } from "react/jsx-runtime";
// packages/ui/src/components/collection-view/collection-view-search.ts
var n = (e) => e.trim().toLowerCase(), r = (e, t) => {
	let r = n(t), i = [];
	if (!r) return i;
	let a = e.toLowerCase(), o = a.indexOf(r);
	for (; o !== -1;) i.push([o, o + r.length]), o = a.indexOf(r, o + r.length);
	return i;
}, i = (e, t, r) => {
	let i = n(t);
	return i ? e.filter((e) => r(e).some((e) => e.toLowerCase().includes(i))) : e;
}, a = (n) => {
	let { text: i, query: a } = n, o = r(i, a);
	if (o.length === 0) return i;
	let s = [], c = 0;
	for (let [e, t] of o) e > c && s.push({
		text: i.slice(c, e),
		match: !1,
		start: c
	}), s.push({
		text: i.slice(e, t),
		match: !0,
		start: e
	}), c = t;
	return c < i.length && s.push({
		text: i.slice(c),
		match: !1,
		start: c
	}), s.map((n) => n.match ? /* @__PURE__ */ t(e, {
		as: "mark",
		bg: "bg.warning",
		color: "inherit",
		borderRadius: "2xs",
		children: n.text
	}, n.start) : n.text);
};
export { i as n, a as t };
