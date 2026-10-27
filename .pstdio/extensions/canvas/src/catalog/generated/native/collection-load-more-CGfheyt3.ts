// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./chevron-down-ZmPqsMG0.ts";
import { Button as t, Icon as n } from "@chakra-ui/react";
import { jsx as r, jsxs as i } from "react/jsx-runtime";
// packages/ui/src/components/collection-view/collection-load-more.tsx
var a = (a) => /* @__PURE__ */ i(t, {
	type: "button",
	variant: "ghost",
	size: "2xs",
	width: "full",
	loading: a.loading,
	onClick: a.onLoadMore,
	children: [/* @__PURE__ */ r(n, {
		as: e,
		boxSize: "3"
	}), a.label]
});
export { a as t };
