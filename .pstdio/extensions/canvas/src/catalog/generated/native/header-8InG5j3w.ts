// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import * as e from "react";
import { HStack as t } from "@chakra-ui/react";
import { jsx as n } from "react/jsx-runtime";
// packages/ui/src/components/layout/header.tsx
var r = {
	main: {
		h: "2.5rem",
		px: "xs"
	},
	narrow: {
		h: "2rem",
		px: "xs"
	},
	input: {
		h: "3rem",
		px: "0"
	}
}, i = e.forwardRef(function(e, i) {
	let { variant: a = "main", children: o, ...s } = e;
	return /* @__PURE__ */ n(t, {
		ref: i,
		as: "header",
		alignItems: "center",
		borderWidth: "0",
		...r[a],
		...s,
		children: o
	});
});
export { i as t };
