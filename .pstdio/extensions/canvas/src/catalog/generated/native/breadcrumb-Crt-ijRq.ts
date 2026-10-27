// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { c as e } from "./list-row-BhxGCvIh.ts";
import * as t from "react";
import { Breadcrumb as n, chakra as r } from "@chakra-ui/react";
import { jsx as i, jsxs as a } from "react/jsx-runtime";
// packages/ui/src/components/primitives/breadcrumb.tsx
var o = {
	alignItems: "center",
	display: "inline-flex",
	gap: "2xs",
	minW: "0",
	maxW: "100%",
	overflow: "hidden",
	outline: "none",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
	_active: { outline: "none" },
	_focus: { outline: "none" },
	_focusVisible: { outline: "none" }
}, s = {
	...o,
	color: "fg",
	cursor: "default",
	textDecoration: "none",
	_hover: { textDecoration: "none" }
}, c = (e) => !!(e.url || e.onClick), l = (e) => {
	let { item: t, isCurrent: r, linkComponent: a } = e;
	return r && !c(t) ? /* @__PURE__ */ i(n.CurrentLink, {
		...s,
		tabIndex: t.contextMenuActions?.length ? 0 : void 0,
		children: t.title
	}) : t.url && a ? /* @__PURE__ */ i(n.Link, {
		asChild: !0,
		...o,
		children: /* @__PURE__ */ i(a, {
			to: t.url,
			children: t.title
		})
	}) : t.url ? /* @__PURE__ */ i(n.Link, {
		href: t.url,
		...o,
		children: t.title
	}) : t.onClick ? /* @__PURE__ */ i(n.Link, {
		as: "button",
		type: "button",
		onClick: t.onClick,
		...o,
		children: t.title
	}) : /* @__PURE__ */ i(n.Link, {
		as: "span",
		...s,
		tabIndex: t.contextMenuActions?.length ? 0 : void 0,
		children: t.title
	});
}, u = (t) => {
	let { item: n } = t, a = /* @__PURE__ */ i(l, { ...t });
	return n.contextMenuActions?.length ? /* @__PURE__ */ i(e, {
		actions: n.contextMenuActions,
		positioning: { placement: "bottom-start" },
		children: /* @__PURE__ */ i(r.span, {
			display: "inline-flex",
			minW: "0",
			tabIndex: -1,
			children: a
		})
	}) : a;
}, d = (e) => {
	let { separator: t } = e;
	return t === void 0 ? /* @__PURE__ */ i(n.Separator, { flexShrink: 0 }) : /* @__PURE__ */ i(n.Separator, {
		flexShrink: 0,
		children: t
	});
}, f = t.forwardRef(function(e, r) {
	let { separator: o, separatorGap: s, items: c, linkComponent: l, ...f } = e;
	return /* @__PURE__ */ i(n.Root, {
		ref: r,
		...f,
		children: /* @__PURE__ */ i(n.List, {
			gap: s,
			flexWrap: "nowrap",
			minW: "0",
			maxW: "100%",
			overflow: "hidden",
			children: c.map((e, r) => {
				let s = r === c.length - 1;
				return /* @__PURE__ */ a(t.Fragment, { children: [/* @__PURE__ */ i(n.Item, {
					minW: "0",
					flexShrink: +!!s,
					overflow: "hidden",
					children: /* @__PURE__ */ i(u, {
						item: e,
						isCurrent: s,
						linkComponent: l
					})
				}), s ? null : /* @__PURE__ */ i(d, { separator: o })] }, r);
			})
		})
	});
});
export { f as t };
