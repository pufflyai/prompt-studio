// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./dist-C9uI5FTb.ts";
import { createContext as t, createElement as n, useContext as r, useEffect as i, useState as a } from "react";
import { Box as o, Code as s, Heading as c, Stack as l, Text as u, chakra as d } from "@chakra-ui/react";
import { jsx as f, jsxs as p } from "react/jsx-runtime";
// scripts/design/native-document-blocks.tsx
var m = t({}), h = {}, g = () => null, _ = (t) => {
	let { of: s } = t, c = r(m), [l, d] = a(), [h, g] = a("");
	return i(() => {
		let t = !0, n = e(s, c);
		return n.load().then(() => {
			t && d(() => n);
		}).catch((e) => {
			t && g(String(e));
		}), () => {
			t = !1;
		};
	}, [s, c]), /* @__PURE__ */ p(o, {
		w: "full",
		borderWidth: "1px",
		borderColor: "border.subtle",
		borderRadius: "xs",
		display: "flow-root",
		children: [h && /* @__PURE__ */ f(u, {
			role: "alert",
			color: "fg.error",
			children: h
		}), l && n(l)]
	});
}, v = (e) => /* @__PURE__ */ f(o, {
	as: "pre",
	p: "md",
	bg: "bg.subtle",
	textStyle: "mono/S",
	whiteSpace: "pre-wrap",
	overflowWrap: "anywhere",
	children: e.code
}), y = {
	h1: (e) => /* @__PURE__ */ f(c, {
		as: "h1",
		textStyle: "heading/L",
		children: e.children
	}),
	h2: (e) => /* @__PURE__ */ f(c, {
		as: "h2",
		textStyle: "heading/M",
		children: e.children
	}),
	h3: (e) => /* @__PURE__ */ f(c, {
		as: "h3",
		textStyle: "heading/S",
		children: e.children
	}),
	p: (e) => /* @__PURE__ */ f(u, {
		textStyle: "paragraph/M/regular",
		children: e.children
	}),
	ul: (e) => /* @__PURE__ */ f(d.ul, {
		ps: "lg",
		children: e.children
	}),
	ol: (e) => /* @__PURE__ */ f(d.ol, {
		ps: "lg",
		children: e.children
	}),
	code: (e) => /* @__PURE__ */ f(s, {
		whiteSpace: "pre-wrap",
		overflowWrap: "anywhere",
		children: e.children
	})
}, b = (e) => {
	let { component: t, annotations: n = h } = e;
	return /* @__PURE__ */ f(m, {
		value: n,
		children: /* @__PURE__ */ f(l, {
			p: "lg",
			gap: "md",
			children: /* @__PURE__ */ f(t, { components: y })
		})
	});
};
export { v as i, b as n, g as r, _ as t };
