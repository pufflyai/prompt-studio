// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { Box as e, defineRecipe as t, useRecipe as n } from "@chakra-ui/react";
import { jsx as r } from "react/jsx-runtime";
// packages/ui/src/theme/recipes/simple-card.ts
var i = t({
	base: {
		borderWidth: "1px",
		borderColor: "border.subtle",
		borderRadius: "xs",
		bg: "bg",
		"--simple-card-body-padding": "{spacing.md}"
	},
	variants: { variant: {
		outline: {},
		action: {
			"--simple-card-body-padding": "{spacing.xs}",
			borderWidth: "0",
			borderColor: "transparent",
			bg: "bg.muted",
			cursor: "pointer",
			textAlign: "left",
			focusVisibleRing: "outside",
			_hover: { bg: "bg.hover" },
			_active: { bg: "bg.active" }
		}
	} },
	defaultVariants: { variant: "outline" }
}), a = (t) => {
	let { children: a, ...o } = t, s = n({ recipe: i }), [c, l] = s.splitVariantProps(o);
	return /* @__PURE__ */ r(e, {
		css: s(c),
		...l,
		children: a
	});
}, o = (t) => {
	let { children: n, ...i } = t;
	return /* @__PURE__ */ r(e, {
		p: "var(--simple-card-body-padding, var(--chakra-spacing-md))",
		...i,
		children: n
	});
};
export { o as n, a as t };
