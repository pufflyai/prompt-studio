// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import * as e from "react";
import { NumberInput as t } from "@chakra-ui/react";
import { jsx as n, jsxs as r } from "react/jsx-runtime";
// packages/ui/src/components/primitives/number-input.tsx
var i = e.forwardRef(function(e, i) {
	let { children: a, ...o } = e;
	return /* @__PURE__ */ r(t.Root, {
		ref: i,
		variant: "outline",
		...o,
		children: [a, /* @__PURE__ */ r(t.Control, { children: [/* @__PURE__ */ n(t.IncrementTrigger, {}), /* @__PURE__ */ n(t.DecrementTrigger, {})] })]
	});
}), a = t.Input;
export { i as n, a as t };
