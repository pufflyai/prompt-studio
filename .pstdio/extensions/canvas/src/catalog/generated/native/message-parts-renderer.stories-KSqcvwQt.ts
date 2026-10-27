// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./full-conversation-normalized-BR4uyFU4.ts";
import { t } from "./ai-message-3J9aywD3.ts";
import { n, o as r } from "./message-types-AeVrnPRD.ts";
import { Box as i, Stack as a } from "@chakra-ui/react";
import { jsx as o, jsxs as s } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/components/message-parts-renderer.stories.tsx
var c = e, l = (e) => (e.parts ?? []).some((e) => e.type === "text" && "text" in e), u = (e) => (e.parts ?? []).some((e) => e.type === "reasoning" || e.type === "tool"), d = c.find((e) => e.role === "assistant" && u(e)) ?? c[0], f = c.find((e) => e.role === "user" && l(e)) ?? c[0], p = {
	id: "assistant-token-usage",
	role: "assistant",
	parts: [{
		type: "text",
		text: "Request completed without exposing provider token metadata."
	}, {
		type: "token_usage",
		inputTokens: 12840,
		outputTokens: 912,
		cacheReadTokens: 6400
	}]
}, m = {
	id: "user-with-attachments",
	role: "user",
	parts: [
		{
			type: "text",
			text: "What do you see in these?"
		},
		{
			type: "file",
			fileId: "img-1",
			filename: "diagram.png",
			mediaType: "image/png",
			url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
		},
		{
			type: "file",
			fileId: "doc-1",
			filename: "notes.txt",
			mediaType: "text/plain",
			url: "/files/notes.txt"
		}
	]
}, h = {
	title: "Patterns/Chat/Message Parts Renderer",
	component: r,
	parameters: { layout: "padded" }
}, g = (e) => {
	let { message: s } = e, c = n(s.role);
	return /* @__PURE__ */ o(i, {
		maxW: "960px",
		w: "full",
		borderWidth: "1px",
		borderRadius: "md",
		bg: "bg",
		p: "md",
		children: /* @__PURE__ */ o(a, {
			gap: "sm",
			children: /* @__PURE__ */ o(t.Root, {
				from: c,
				children: /* @__PURE__ */ o(t.Content, {
					from: c,
					children: /* @__PURE__ */ o(r, { message: s })
				})
			})
		})
	});
}, _ = { render: () => /* @__PURE__ */ o(g, { message: d }) }, v = { render: () => /* @__PURE__ */ o(g, { message: f }) }, y = { render: () => /* @__PURE__ */ o(g, { message: p }) }, b = { render: () => /* @__PURE__ */ o(g, { message: m }) }, x = { render: () => /* @__PURE__ */ s(a, {
	gap: "sm",
	children: [
		/* @__PURE__ */ o(g, { message: {
			id: "error-permission",
			role: "system",
			parts: [{
				type: "error",
				errorType: "permission",
				message: "Permission denied while reading session output."
			}]
		} }),
		/* @__PURE__ */ o(g, { message: {
			id: "error-timeout",
			role: "assistant",
			parts: [{
				type: "error",
				errorType: "timeout",
				message: "Request timed out after 30s."
			}]
		} }),
		/* @__PURE__ */ o(g, { message: {
			id: "error-crash",
			role: "assistant",
			parts: [{
				type: "error",
				errorType: "crash"
			}]
		} }),
		/* @__PURE__ */ o(g, { message: {
			id: "error-other",
			role: "assistant",
			parts: [{
				type: "error",
				errorType: "other",
				message: "Error: Was there a typo in the url or port?"
			}]
		} })
	]
}) };
export { _ as AssistantReasoningAndToolParts, x as ErrorParts, y as HiddenTokenUsageParts, b as UserAttachmentParts, v as UserTextParts, h as default };
