// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./chat-panel-DXY6mCVA.ts";
import { useState as t } from "react";
import { Button as n } from "@chakra-ui/react";
import { Fragment as r, jsx as i, jsxs as a } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/components/chat-panel-images.stories.tsx
var o = {
	title: "Chat/ChatPanel/Images",
	component: e
}, s = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9i8AAAAASUVORK5CYII=", c = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", l = { args: {
	messages: [
		{
			id: "user",
			role: "user",
			parts: [{
				type: "text",
				text: "Show the screenshot."
			}]
		},
		{
			id: "tool",
			role: "assistant",
			parts: [{
				type: "tool",
				tool: "view_image",
				callId: "image-1",
				status: "completed",
				state: {
					input: { path: "/tmp/long question.png" },
					output: [{
						type: "image",
						source: "/tmp/long question.png",
						src: s,
						mimeType: "image/png"
					}]
				}
			}]
		},
		{
			id: "answer",
			role: "assistant",
			parts: [{
				type: "text",
				text: "![Long question opened](/tmp/long%20question.png)"
			}]
		}
	],
	chatInputPlaceholder: "Message the agent...",
	emptyStateTitle: "",
	emptyStateDescription: ""
} }, u = { args: {
	...l.args,
	messages: [{
		id: "answer",
		role: "assistant",
		parts: [{
			type: "text",
			text: "![Workspace preview][preview]\n\n[preview]: screenshots/preview.png"
		}]
	}],
	linkHandler: {
		resolveHref: ({ source: e }) => `workspace://${e}`,
		open: () => {},
		async resolveImageSource(e) {
			return this.resolveHref({
				source: e,
				origin: "markdown"
			}) ? s : null;
		}
	}
} }, d = { args: {
	...l.args,
	messages: [{
		id: "versions",
		role: "assistant",
		parts: [
			{
				type: "tool",
				tool: "view_image",
				status: "completed",
				state: { output: [{
					type: "image",
					source: "/tmp/preview.png",
					src: s
				}] }
			},
			{
				type: "text",
				text: "![First capture](/tmp/preview.png)"
			},
			{
				type: "tool",
				tool: "view_image",
				status: "completed",
				state: { output: [{
					type: "image",
					source: "/tmp/preview.png",
					src: c
				}] }
			},
			{
				type: "text",
				text: "![Second capture](/tmp/preview.png)"
			}
		]
	}]
} };
async function f(e) {
	return this.resolveHref({
		source: e,
		origin: "markdown"
	})?.startsWith("workspace://second/") ? c : s;
}
var p = {
	resolveHref: ({ source: e }) => `workspace://first/${e}`,
	resolveImageSource: f,
	open: () => {}
}, m = {
	...p,
	resolveHref: ({ source: e }) => `workspace://second/${e}`
};
function h() {
	let [o, s] = t(p);
	return /* @__PURE__ */ a(r, { children: [/* @__PURE__ */ i(n, {
		onClick: () => s(m),
		children: "Switch workspace"
	}), /* @__PURE__ */ i(e, {
		...u.args,
		linkHandler: o
	})] });
}
var g = { render: () => /* @__PURE__ */ i(h, {}) };
export { l as CapturedLocalImage, d as RepeatedImageCapture, u as WorkspaceImage, g as WorkspaceSwitch, o as default };
