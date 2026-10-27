// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./param-editor-label-BDQjmLHj.ts";
import { t } from "./param-editor-read-only-value-c3lD-see.ts";
import { n, t as r } from "./selection-menu-DxyS5y7W.ts";
import { useEffect as i, useState as a } from "react";
import { Box as o, Flex as s } from "@chakra-ui/react";
import { Fragment as c, jsx as l, jsxs as u } from "react/jsx-runtime";
// packages/ui/src/components/param-editor/inputs/selection-input.tsx
var d = (e, t, n) => n ? [...e, ...t.filter((t) => !e.some((e) => e.id === t)).map((e) => ({
	id: e,
	name: e
}))] : e, f = (f) => {
	let { id: p, defaultValue: m, name: h, options: g, onChange: _, description: v, readOnly: y, hideLabel: b = !1, multiSelect: x = !1, placeholder: S, fullWidth: C = !1, clearable: w = !1, disabled: T = !1, searchable: E = !1, allowCustomValues: D = !1, searchPlaceholder: O, emptyText: k, group: A, size: j = "sm" } = f, [M, N] = a(m), [P, F] = a(A?.defaultValue ?? "");
	i(() => {
		N(m);
	}, [m]), i(() => {
		F(A?.defaultValue ?? "");
	}, [A?.defaultValue]);
	let I = x ? Array.isArray(M) ? M : [] : typeof M == "string" && M ? [M] : [], L = d(g, I, D), R = () => {
		let e = I.map((e) => L.find((t) => t.id === e)?.name).filter((e) => !!e);
		return e.length === 0 ? S || "Select" : e.length <= 3 ? e.join(", ") : `${e.slice(0, 3).join(", ")} +${(e.length - 3).toString()}`;
	}, z = (e) => {
		N(e), _(p, e);
	}, B = (e) => {
		z(x ? I.includes(e) ? I.filter((t) => t !== e) : [...I, e] : w && I.includes(e) ? "" : e);
	}, V = (e) => {
		A && e !== P && (F(e), _(A.id, e));
	}, H = I.length === 1 ? g.find((e) => e.id === I[0]) : void 0, U = b ? null : /* @__PURE__ */ l(e, {
		name: h,
		description: v
	});
	if (y) {
		let e = /* @__PURE__ */ l(t, { children: R() });
		return C ? /* @__PURE__ */ u(o, { children: [U ? /* @__PURE__ */ l(o, {
			mb: "xs",
			children: U
		}) : null, e] }) : /* @__PURE__ */ l(o, { children: /* @__PURE__ */ u(s, {
			alignItems: "center",
			justifyContent: "space-between",
			minHeight: "2rem",
			gap: "xs",
			children: [U, e]
		}) });
	}
	let W = /* @__PURE__ */ l(r, {
		triggerLabel: /* @__PURE__ */ u(c, { children: [n(H, "14px"), /* @__PURE__ */ l(o, {
			as: "span",
			truncate: !0,
			children: R()
		})] }),
		options: L,
		allowCustomValues: D,
		selectedIds: I,
		multiSelect: x,
		reselectable: w,
		disabled: T,
		searchable: E,
		searchPlaceholder: O,
		emptyText: k,
		group: A ? {
			...A,
			defaultValue: P
		} : void 0,
		fullWidth: C,
		size: j,
		onToggle: B,
		onGroupChange: V
	});
	return C ? /* @__PURE__ */ u(o, { children: [U ? /* @__PURE__ */ l(o, {
		mb: "xs",
		children: U
	}) : null, W] }) : /* @__PURE__ */ l(o, { children: /* @__PURE__ */ u(s, {
		alignItems: "center",
		justifyContent: "space-between",
		minHeight: "2rem",
		gap: "xs",
		children: [U ? /* @__PURE__ */ l(o, {
			flexShrink: 0,
			children: U
		}) : null, W]
	}) });
};
export { f as t };
