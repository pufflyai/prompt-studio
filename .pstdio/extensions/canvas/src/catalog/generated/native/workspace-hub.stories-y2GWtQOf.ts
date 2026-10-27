// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./arrow-up-right-CUuzCgQb.ts";
import { t } from "./chevron-down-ZmPqsMG0.ts";
import { t as n } from "./git-branch-BjWwGBn9.ts";
import { t as r } from "./workspace-hub-BZBU-L1T.ts";
import { Button as i, IconButton as a, Text as o } from "@chakra-ui/react";
import { jsx as s, jsxs as c } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/components/workspace-hub.stories.tsx
var l = {
	title: "Patterns/Chat/Workspace Hub",
	component: r,
	parameters: { layout: "padded" }
}, u = /* @__PURE__ */ c(i, {
	size: "xs",
	variant: "ghost",
	px: "2xs",
	children: [
		/* @__PURE__ */ s(n, { size: 14 }),
		/* @__PURE__ */ s(o, {
			textStyle: "label/XS/medium",
			color: "fg",
			ml: "2xs",
			children: "main"
		}),
		/* @__PURE__ */ s(t, { size: 14 })
	]
}), d = /* @__PURE__ */ s(a, {
	size: "xs",
	variant: "ghost",
	"aria-label": "Open workspace",
	children: /* @__PURE__ */ s(e, { size: 14 })
}), f = { args: {
	workspaceControl: u,
	additions: 83,
	deletions: 9,
	action: d
} }, p = { args: {
	workspaceControl: u,
	additions: 148,
	deletions: 37,
	action: d
} }, m = { args: {
	workspaceControl: u,
	additions: 0,
	deletions: 0,
	action: d
} }, h = { args: {
	workspaceControl: u,
	additions: 0,
	deletions: 0,
	status: "loading",
	statusLabel: "Setting up workspace — installing dependencies",
	action: d
} }, g = { args: {
	workspaceControl: u,
	additions: 0,
	deletions: 0,
	status: "error",
	statusLabel: "Setup failed — bun install could not resolve dependencies",
	action: d
} };
export { f as Default, m as NoChanges, h as SettingUp, g as SetupFailed, p as WithChanges, l as default };
