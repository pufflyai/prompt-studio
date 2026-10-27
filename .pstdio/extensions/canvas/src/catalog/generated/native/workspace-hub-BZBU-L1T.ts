// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./triangle-alert-DcqN2fDE.ts";
import { Flex as t, HStack as n, Spinner as r, Text as i } from "@chakra-ui/react";
import { jsx as a, jsxs as o } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/components/workspace-hub.tsx
var s = (t) => {
	let { status: s, statusLabel: c, additions: l, deletions: u } = t;
	return s === "loading" ? /* @__PURE__ */ o(n, {
		gap: "2xs",
		minW: "0",
		children: [/* @__PURE__ */ a(r, {
			size: "xs",
			color: "fg.muted"
		}), /* @__PURE__ */ a(i, {
			textStyle: "label/XS/regular",
			color: "fg.muted",
			truncate: !0,
			children: c ?? "Setting up workspace..."
		})]
	}) : s === "error" ? /* @__PURE__ */ o(n, {
		gap: "2xs",
		minW: "0",
		children: [/* @__PURE__ */ a(e, {
			size: 14,
			color: "var(--chakra-colors-fg-error)"
		}), /* @__PURE__ */ a(i, {
			textStyle: "label/XS/regular",
			color: "fg.error",
			truncate: !0,
			children: c ?? "Workspace setup failed"
		})]
	}) : l <= 0 && u <= 0 ? null : /* @__PURE__ */ o(n, {
		gap: "2xs",
		children: [/* @__PURE__ */ o(i, {
			textStyle: "label/XS/medium",
			color: "fg.success",
			children: ["+", l]
		}), /* @__PURE__ */ o(i, {
			textStyle: "label/XS/medium",
			color: "fg.error",
			children: ["−", u]
		})]
	});
}, c = (e) => {
	let { workspaceControl: r, additions: i, deletions: c, action: l, status: u = "ready", statusLabel: d } = e;
	return /* @__PURE__ */ o(t, {
		align: "center",
		justify: "space-between",
		gap: "sm",
		minW: "0",
		pl: "xs",
		pr: "2xs",
		py: "2xs",
		children: [/* @__PURE__ */ o(n, {
			gap: "sm",
			minW: "0",
			children: [r, /* @__PURE__ */ a(s, {
				status: u,
				statusLabel: d,
				additions: i,
				deletions: c
			})]
		}), l ? /* @__PURE__ */ a(t, {
			flexShrink: 0,
			children: l
		}) : null]
	});
};
export { c as t };
