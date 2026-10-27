// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { Button as e, Flex as t, Text as n } from "@chakra-ui/react";
import { jsx as r, jsxs as i } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/renderers/file/file-renderer-error-notice.tsx
var a = (a) => {
	let { message: o, onRetry: s } = a;
	return /* @__PURE__ */ i(t, {
		flex: "none",
		alignItems: "center",
		justifyContent: "space-between",
		gap: "sm",
		borderBottomWidth: "1px",
		borderColor: "border.muted",
		bg: "bg.muted",
		px: "sm",
		py: "xs",
		children: [/* @__PURE__ */ r(n, {
			color: "fg.muted",
			textStyle: "label/S/regular",
			children: o
		}), s ? /* @__PURE__ */ r(e, {
			size: "2xs",
			variant: "subtle",
			onClick: s,
			children: "Retry"
		}) : null]
	});
};
export { a as t };
