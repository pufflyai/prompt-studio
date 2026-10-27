// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, r as t, t as n } from "./param-editor-field-DNMN3OG9.ts";
import { Box as r, HStack as i, Stack as a, Text as o, VStack as s } from "@chakra-ui/react";
import { jsx as c, jsxs as l } from "react/jsx-runtime";
// packages/ui/src/components/param-editor/param-editor-horizontal.tsx
var u = (e) => {
	let { children: t } = e;
	return /* @__PURE__ */ c(o, {
		minH: "0.75rem",
		textStyle: "label/XS",
		color: "fg.muted",
		lineHeight: "1",
		letterSpacing: "0.08em",
		textTransform: "uppercase",
		children: t
	});
}, d = (e) => {
	let { group: t, params: r, fieldProps: a, variant: o, width: d = "auto" } = e;
	return /* @__PURE__ */ l(s, {
		as: "section",
		"aria-label": t.title,
		gap: o === "small" ? "2xs" : "xs",
		alignItems: "start",
		minW: "0",
		width: d,
		children: [/* @__PURE__ */ c(u, { children: t.title }), /* @__PURE__ */ c(i, {
			gap: o === "small" ? "2xs" : "xs",
			flexWrap: "wrap",
			alignItems: "start",
			minW: "0",
			width: d,
			children: r.map((e) => /* @__PURE__ */ c(n, {
				param: e,
				...a
			}, e.id))
		})]
	});
}, f = (o) => {
	let { params: s = [], groups: u = [], defaultValues: f, onChange: p, onOpenResource: m, readOnly: h, variant: g = "default" } = o, _ = s.filter(e), v = u.map((t) => ({
		...t,
		params: t.params.filter(e)
	})), y = {
		defaultValues: f,
		onChange: p,
		onOpenResource: m,
		readOnly: h,
		presentation: "horizontal",
		size: g === "small" ? "xs" : "sm"
	}, b = _.filter((e) => !t(e)), x = _.filter(t), S = v.map((e) => ({
		group: e,
		params: e.params.filter((e) => !t(e))
	})).filter(({ params: e }) => e.length > 0), C = v.map((e) => ({
		group: e,
		params: e.params.filter(t)
	})).filter(({ params: e }) => e.length > 0), w = g === "small" ? "xs" : "sm", T = b.length > 0 || S.length > 0;
	return /* @__PURE__ */ l(a, {
		flex: "1",
		maxW: "full",
		gap: w,
		minW: "0",
		children: [
			T ? /* @__PURE__ */ l(i, {
				gap: w,
				flexWrap: "wrap",
				alignItems: "start",
				minW: "0",
				children: [b.map((e) => /* @__PURE__ */ c(n, {
					param: e,
					...y
				}, e.id)), S.map(({ group: e, params: t }) => /* @__PURE__ */ c(d, {
					group: e,
					params: t,
					fieldProps: y,
					variant: g
				}, e.id))]
			}) : null,
			x.map((e) => /* @__PURE__ */ c(r, {
				width: "full",
				minW: "0",
				children: /* @__PURE__ */ c(n, {
					param: e,
					...y
				})
			}, e.id)),
			C.map(({ group: e, params: t }) => /* @__PURE__ */ c(d, {
				group: e,
				params: t,
				fieldProps: y,
				variant: g,
				width: "full"
			}, `${e.id}-rich`))
		]
	});
};
export { f as t };
