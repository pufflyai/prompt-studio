// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { Grid as e, Icon as t, chakra as n } from "@chakra-ui/react";
import { jsx as r } from "react/jsx-runtime";
// packages/ui/src/components/primitives/icon-picker-grid.tsx
var i = n("button", { base: {
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	boxSize: "tag-icon-cell",
	borderRadius: "compact",
	color: "fg.muted",
	cursor: "pointer",
	_hover: { bg: "bg.hover" }
} }), a = (n) => {
	let { value: a, options: o, color: s, disabled: c, onChange: l } = n, u = s ? `${s}.500` : "fg", d = s ? `${s}.500/15` : "bg.active";
	return /* @__PURE__ */ r(e, {
		templateColumns: "repeat(8, 1fr)",
		gap: "3xs",
		justifyItems: "center",
		children: o.map((e) => {
			let n = e.value === a;
			return /* @__PURE__ */ r(i, {
				type: "button",
				disabled: c,
				color: n ? u : void 0,
				bg: n ? d : void 0,
				_hover: n ? { bg: d } : void 0,
				"aria-label": e.label,
				"aria-pressed": n,
				onClick: () => l(e.value),
				children: /* @__PURE__ */ r(t, {
					as: e.icon,
					boxSize: "icon-xs"
				})
			}, e.value ?? "none");
		})
	});
};
export { a as t };
