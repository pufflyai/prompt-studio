// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { i as e, t } from "./session-indicator-7-mIGr-J.ts";
import { HStack as n, Text as r } from "@chakra-ui/react";
import { jsx as i, jsxs as a } from "react/jsx-runtime";
// packages/ui/src/components/primitives/session-indicator.stories.tsx
var o = {
	title: "Components/Feedback/Session Indicator",
	component: t
}, s = { args: { status: "in_progress" } }, c = { args: {
	status: "in_progress",
	color: "fg.muted"
} }, l = { args: { status: "awaiting_input" } }, u = { args: { status: "queued" } }, d = { args: { status: "completed" } }, f = { args: { status: "failed" } }, p = { args: { status: "cancelled" } }, m = { args: { status: "disconnected" } }, h = { args: {} }, g = { render: () => /* @__PURE__ */ i(n, {
	gap: "md",
	children: [...e, void 0].map((e) => /* @__PURE__ */ a(n, {
		gap: "xs",
		children: [/* @__PURE__ */ i(t, { status: e }), /* @__PURE__ */ i(r, {
			textStyle: "label/S/regular",
			children: e ?? "undefined"
		})]
	}, e ?? "undefined"))
}) };
export { g as AllStatuses, l as AwaitingInput, p as Cancelled, d as Completed, m as Disconnected, f as Failed, s as InProgress, c as MutedInProgress, u as Queued, h as Undefined, o as default };
