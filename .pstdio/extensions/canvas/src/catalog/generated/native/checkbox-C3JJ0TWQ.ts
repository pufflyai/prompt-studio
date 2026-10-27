// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import * as e from "react";
import { Checkbox as t } from "@chakra-ui/react";
import { jsx as n, jsxs as r } from "react/jsx-runtime";
// packages/ui/src/components/primitives/checkbox.tsx
var i = e.forwardRef(function(e, i) {
	let { icon: a, children: o, inputProps: s, rootRef: c, disabled: l = !1, readOnly: u = !1, ...d } = e, f = l ? "not-allowed" : u ? "default" : "pointer";
	return /* @__PURE__ */ r(t.Root, {
		ref: c,
		disabled: l,
		readOnly: u,
		cursor: f,
		...d,
		children: [
			/* @__PURE__ */ n(t.HiddenInput, {
				ref: i,
				...s
			}),
			/* @__PURE__ */ n(t.Control, {
				bg: "bg",
				borderColor: "border",
				color: "fg.button.primary.default",
				cursor: f,
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
				},
				_indeterminate: {
					bg: "bg.button.primary.default",
					borderColor: "bg.button.primary.default",
					color: "fg.button.primary.default",
					_hover: { borderColor: "bg.button.primary.default" },
					_active: { borderColor: "bg.button.primary.default" }
				},
				children: a ? /* @__PURE__ */ n(t.Indicator, { children: a }) : /* @__PURE__ */ n(t.Indicator, {})
			}),
			o != null && /* @__PURE__ */ n(t.Label, {
				cursor: f,
				children: o
			})
		]
	});
});
export { i as t };
