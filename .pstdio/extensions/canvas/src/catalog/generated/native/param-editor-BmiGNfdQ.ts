// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./chevron-down-ZmPqsMG0.ts";
import { t } from "./param-editor-row-DC3JM-ZX.ts";
import { useState as n } from "react";
import { Button as r, Collapsible as i, Flex as a, Icon as o, Stack as s, Text as c } from "@chakra-ui/react";
import { jsx as l, jsxs as u } from "react/jsx-runtime";
// packages/ui/src/components/param-editor/param-editor-section.tsx
var d = (e) => {
	let { title: t, description: n } = e;
	return /* @__PURE__ */ u(s, {
		gap: "2xs",
		minW: "0",
		textAlign: "left",
		children: [/* @__PURE__ */ l(c, {
			textStyle: "label/M/medium",
			color: "fg",
			truncate: !0,
			children: t
		}), n ? /* @__PURE__ */ l(c, {
			textStyle: "label/XS/regular",
			color: "fg.muted",
			lineClamp: 2,
			children: n
		}) : null]
	});
}, f = (t) => {
	let { title: n, description: i, open: s, collapsible: c, onToggle: f } = t;
	return c ? /* @__PURE__ */ u(r, {
		"aria-expanded": s,
		borderRadius: "0",
		height: "auto",
		justifyContent: "space-between",
		minHeight: "2.25rem",
		onClick: f,
		px: "sm",
		py: "xs",
		size: "xs",
		variant: "ghost",
		width: "full",
		_expanded: { bg: "transparent" },
		children: [/* @__PURE__ */ l(d, {
			title: n,
			description: i
		}), /* @__PURE__ */ l(o, {
			as: e,
			boxSize: "14px",
			color: "fg.muted",
			flexShrink: 0,
			transform: s ? "rotate(0deg)" : "rotate(-90deg)",
			transition: "transform 120ms ease"
		})]
	}) : /* @__PURE__ */ l(a, {
		alignItems: "center",
		justifyContent: "space-between",
		minHeight: "2.25rem",
		px: "sm",
		py: "xs",
		children: /* @__PURE__ */ l(d, {
			title: n,
			description: i
		})
	});
}, p = (e) => {
	let { params: n, defaultValues: r, onChange: i, onOpenResource: a, readOnly: o, fullWidth: c, defaultCollapsed: u, isFirst: d, variant: f } = e, p = u || d ? "2xs" : "xs";
	return f === "small" && (p = "none"), /* @__PURE__ */ l(s, {
		gap: "0",
		py: p,
		children: n.map((e) => /* @__PURE__ */ l(t, {
			param: e,
			values: r,
			onChange: i,
			onOpenResource: a,
			readOnly: o,
			fullWidth: c,
			variant: f
		}, e.id))
	});
}, m = (e) => {
	let { title: t, description: r, params: a, defaultValues: o, onChange: c, onOpenResource: d, readOnly: m, fullWidth: h, collapsible: g, defaultCollapsed: _ = !1, isFirst: v = !1, variant: y = "default" } = e, [b, x] = n(!_), S = !!(t && g), C = !S || b;
	return /* @__PURE__ */ u(s, {
		as: "section",
		gap: "0",
		borderTopWidth: v ? "0" : "1px",
		borderColor: "border.subtle",
		minW: "0",
		children: [t ? /* @__PURE__ */ l(f, {
			title: t,
			description: r,
			open: C,
			collapsible: S,
			onToggle: () => x((e) => !e)
		}) : null, /* @__PURE__ */ l(i.Root, {
			open: C,
			children: /* @__PURE__ */ l(i.Content, { children: /* @__PURE__ */ l(p, {
				params: a,
				defaultValues: o,
				onChange: c,
				onOpenResource: d,
				readOnly: m,
				fullWidth: h,
				defaultCollapsed: _,
				isFirst: v,
				variant: y
			}) })
		})]
	});
}, h = (e) => {
	let { params: t = [], groups: n = [], defaultValues: r = {}, onChange: i, onOpenResource: a, readOnly: o, fullWidth: c = !1, variant: d = "default" } = e, f = i ?? (() => void 0);
	return /* @__PURE__ */ u(s, {
		flex: "1",
		maxW: "full",
		gap: "0",
		children: [t.length > 0 ? /* @__PURE__ */ l(m, {
			params: t,
			defaultValues: r,
			onChange: f,
			onOpenResource: a,
			readOnly: o,
			fullWidth: c,
			variant: d,
			isFirst: !0
		}) : null, n.map((e, n) => /* @__PURE__ */ l(m, {
			title: e.title,
			description: e.description,
			params: e.params,
			defaultValues: r,
			onChange: f,
			onOpenResource: a,
			readOnly: o,
			fullWidth: c,
			variant: d,
			collapsible: e.collapsible,
			defaultCollapsed: e.defaultCollapsed,
			isFirst: t.length === 0 && n === 0
		}, e.id))]
	});
};
export { h as t };
