// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./param-editor-label-BDQjmLHj.ts";
import { t } from "./selection-menu-DxyS5y7W.ts";
import { useEffect as n, useState as r } from "react";
import { Box as i, Button as a, Flex as o } from "@chakra-ui/react";
import { jsx as s, jsxs as c } from "react/jsx-runtime";
// packages/ui/src/components/param-editor/param-editor-control-item.tsx
var l = (t) => {
	let { name: n, description: r, hideLabel: a = !1, fullWidth: l = !1, orientation: u = "auto", labelTrailing: d, children: f } = t, p = a || !n ? null : /* @__PURE__ */ s(e, {
		name: n,
		description: r
	});
	return (u === "auto" ? l ? "stacked" : "inline" : u) === "stacked" ? /* @__PURE__ */ c(i, {
		minW: "0",
		children: [p || d ? /* @__PURE__ */ c(o, {
			alignItems: "center",
			justifyContent: "space-between",
			gap: "xs",
			mb: "xs",
			minW: "0",
			children: [p, d]
		}) : null, f]
	}) : /* @__PURE__ */ c(o, {
		alignItems: "center",
		justifyContent: "space-between",
		minHeight: "2rem",
		gap: "xs",
		minW: "0",
		children: [p, /* @__PURE__ */ c(o, {
			alignItems: "center",
			gap: "xs",
			minW: "0",
			children: [d, f]
		})]
	});
}, u = (e) => {
	let { id: i, name: c, description: u, defaultValue: d, options: f, onChange: p, readOnly: m, presentation: h = "stacked" } = e, [g, _] = r(d);
	n(() => {
		_(d);
	}, [d]);
	let v = (e) => {
		_(e), p(i, e);
	}, y = h === "horizontal", b = f.find((e) => e.id === g)?.name ?? c;
	if (y) return /* @__PURE__ */ s(t, {
		triggerLabel: b,
		options: f,
		selectedIds: g ? [g] : [],
		multiSelect: !1,
		reselectable: !0,
		disabled: m,
		onToggle: v
	});
	let x = /* @__PURE__ */ s(o, {
		gap: "xs",
		wrap: "wrap",
		children: f.map((e) => /* @__PURE__ */ s(a, {
			size: "xs",
			variant: g === e.id ? "subtle" : "outline",
			disabled: e.disabled || m,
			_hover: {
				bg: "bg.hover",
				borderColor: "border.accent-light"
			},
			_active: {
				bg: "bg.active",
				borderColor: "border.accent-light"
			},
			_focusVisible: {
				borderColor: "border.accent-light",
				outline: "none",
				boxShadow: "none"
			},
			onClick: () => v(e.id),
			children: e.name
		}, e.id))
	});
	return /* @__PURE__ */ s(l, {
		name: c,
		description: u,
		orientation: "stacked",
		children: x
	});
};
export { l as n, u as t };
