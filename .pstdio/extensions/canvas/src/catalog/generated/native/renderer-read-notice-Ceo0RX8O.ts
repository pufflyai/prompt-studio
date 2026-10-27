// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { Button as e } from "@chakra-ui/react";
import { AlertMessage as t } from "@pstdio/ui";
import { jsx as n } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/renderers/renderer-read-notice.tsx
var r = (r) => {
	let { error: i, retry: a } = r;
	return /* @__PURE__ */ n(t, {
		status: "error",
		title: "Could not load this view",
		endElement: /* @__PURE__ */ n(e, {
			onClick: a,
			children: "Retry"
		}),
		children: i
	});
};
export { r as t };
