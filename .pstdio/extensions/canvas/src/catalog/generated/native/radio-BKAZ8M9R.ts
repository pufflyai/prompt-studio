// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import * as e from "react";
import { RadioGroup as t } from "@chakra-ui/react";
import { jsx as n, jsxs as r } from "react/jsx-runtime";
// packages/ui/src/components/primitives/radio.tsx
var i = e.forwardRef(function(e, i) {
	let { children: a, inputProps: o, rootRef: s, ...c } = e;
	return /* @__PURE__ */ r(t.Item, {
		ref: s,
		...c,
		children: [
			/* @__PURE__ */ n(t.ItemHiddenInput, {
				ref: i,
				...o
			}),
			/* @__PURE__ */ n(t.ItemIndicator, {
				bg: "bg",
				borderColor: "border",
				color: "fg.button.primary.default",
				transition: "border-color 0.2s ease-in-out",
				boxShadow: "none",
				_hover: { borderColor: "border.accent-light" },
				_active: { borderColor: "border.accent-light" },
				_focusVisible: {
					borderColor: "border.accent-light",
					outline: "none",
					boxShadow: "none"
				},
				_checked: {
					bg: "bg.button.primary.default",
					borderColor: "bg.button.primary.default",
					color: "fg.button.primary.default",
					_hover: { borderColor: "bg.button.primary.default" },
					_active: { borderColor: "bg.button.primary.default" }
				}
			}),
			a ? /* @__PURE__ */ n(t.ItemText, { children: a }) : null
		]
	});
}), a = t.Root;
export { a as n, i as t };
