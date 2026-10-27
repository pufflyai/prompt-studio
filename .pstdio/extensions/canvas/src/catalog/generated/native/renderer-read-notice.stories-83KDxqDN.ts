// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./renderer-read-notice-Ceo0RX8O.ts";
import { Stack as t, Text as n } from "@chakra-ui/react";
import { jsx as r, jsxs as i } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/renderers/renderer-read-notice.stories.tsx
var a = {
	title: "Renderers/Read failure",
	component: e,
	args: {
		error: "The view could not be refreshed. Try again.",
		retry: () => {}
	}
}, o = {}, s = { render: (a) => /* @__PURE__ */ i(t, {
	gap: "md",
	children: [/* @__PURE__ */ r(e, { ...a }), /* @__PURE__ */ r(n, { children: "Previously loaded content remains visible." })]
}) };
export { o as InitialFailure, s as RetainedContent, a as default };
