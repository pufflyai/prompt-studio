// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { Button as e, Stack as t, Text as n } from "@chakra-ui/react";
import { AlertMessage as r } from "@pstdio/ui";
import { jsx as i, jsxs as a } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/shared/projects/project-setup-status.tsx
var o = (o) => {
	let { error: s, retrying: c, onRetry: l } = o;
	return /* @__PURE__ */ i(r, {
		status: "error",
		variant: "subtle",
		role: "alert",
		title: "Project setup did not finish",
		endElement: /* @__PURE__ */ i(e, {
			loading: c,
			onClick: l,
			children: "Retry setup"
		}),
		children: /* @__PURE__ */ a(t, {
			gap: "xs",
			minW: "0",
			children: [/* @__PURE__ */ i(n, { children: "Agents and extension commands cannot run in this folder until setup finishes. Fix the problem below, then retry. If it mentions Git or GitHub, check that Git is installed and that this computer is online." }), /* @__PURE__ */ i(n, {
				textStyle: "mono/XS",
				whiteSpace: "pre-wrap",
				wordBreak: "break-word",
				children: s
			})]
		})
	});
};
export { o as t };
