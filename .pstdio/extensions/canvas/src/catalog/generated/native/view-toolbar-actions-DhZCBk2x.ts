// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./use-workbench-store-BMaFgEbb.ts";
import { r as t, t as n } from "./tree-params-dialog-nUfbs7k9.ts";
import { useState as r } from "react";
import { Button as i, HStack as a, Separator as o, Text as s } from "@chakra-ui/react";
import { Fragment as c, jsx as l, jsxs as u } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/renderers/view-toolbar-actions.tsx
var d = (d) => {
	let { workbench: f, actions: p, context: m, renderParamField: h } = d, [g, _] = r(null), [v, y] = r();
	e(f.context.store, (e) => e.values), e(f.commands.store, (e) => e.commands);
	let b = t({
		workbench: f,
		actions: p,
		context: m,
		onRequestParams: _,
		onCommandError: (e) => y(e instanceof Error ? e.message : String(e))
	});
	return /* @__PURE__ */ u(c, { children: [/* @__PURE__ */ u(a, {
		gap: "xs",
		children: [
			b.length > 0 ? /* @__PURE__ */ l(o, {
				orientation: "vertical",
				height: "{spacing.lg}"
			}) : null,
			b.map((e) => /* @__PURE__ */ u(i, {
				size: "xs",
				variant: p?.find((t) => t.id === e.id)?.presentation === "primary" ? "primary" : "outline",
				disabled: e.disabled,
				onClick: () => {
					y(void 0), e.onAction?.();
				},
				children: [e.icon, e.label]
			}, e.id)),
			v ? /* @__PURE__ */ l(s, {
				role: "alert",
				textStyle: "paragraph/XS/regular",
				color: "fg.error",
				children: v
			}) : null
		]
	}), /* @__PURE__ */ l(n, {
		workbench: f,
		request: g,
		renderParamField: h,
		onClose: () => _(null)
	})] });
};
export { d as t };
