// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./QueryClientProvider-LIjzams-.ts";
import { t } from "./queryClient-BgKKh9f4.ts";
import { n, t as r } from "./session-attachment-list-BGLYBlSE.ts";
import { useState as i } from "react";
import { Box as a } from "@chakra-ui/react";
import { Fragment as o, jsx as s, jsxs as c } from "react/jsx-runtime";
import { ChatPanel as l } from "@pstdio/ui/chat-ui";
// packages/pstdio-dashboard/src/modules/sessions/components/session-attachment-controls.stories.tsx
var u = [{
	file_id: "file-notes",
	name: "release-notes.txt",
	mime_type: "text/plain",
	size_bytes: 2400,
	hash: "hash-notes",
	url: "/v1/projects/project/session-attachments/file-notes/content",
	created_at: "2026-06-17T10:00:00.000Z",
	updated_at: "2026-06-17T10:00:00.000Z"
}, {
	file_id: "file-diagram",
	name: "flow.png",
	mime_type: "image/png",
	size_bytes: 4096,
	hash: "hash-diagram",
	url: "/v1/projects/project/session-attachments/file-diagram/content",
	created_at: "2026-06-17T10:00:00.000Z",
	updated_at: "2026-06-17T10:00:00.000Z"
}], d = {
	title: "Modules/Sessions/Session Attachments",
	component: n,
	parameters: { layout: "padded" },
	decorators: [(n) => /* @__PURE__ */ s(e, {
		client: new t(),
		children: /* @__PURE__ */ s(a, {
			maxW: "560px",
			children: /* @__PURE__ */ s(n, {})
		})
	})]
}, f = (e) => {
	let { initialAttachments: t = [], uploading: a = !1 } = e, [l, u] = i(t);
	return /* @__PURE__ */ c(o, { children: [/* @__PURE__ */ s(r, {
		attachments: l,
		onRemove: (e) => u((t) => t.filter((t) => t.file_id !== e))
	}), /* @__PURE__ */ s(n, {
		projectId: "project",
		uploading: a,
		onAttachFiles: (e) => {
			let t = e.map((e) => ({
				file_id: crypto.randomUUID(),
				name: e.name,
				mime_type: e.type || null,
				size_bytes: e.size,
				hash: null,
				url: `/v1/projects/project/session-attachments/${crypto.randomUUID()}/content`,
				created_at: (/* @__PURE__ */ new Date()).toISOString(),
				updated_at: (/* @__PURE__ */ new Date()).toISOString()
			}));
			u((e) => [...e, ...t]);
		}
	})] });
}, p = { render: () => /* @__PURE__ */ s(f, { initialAttachments: u }) }, m = { render: () => /* @__PURE__ */ s(f, {
	initialAttachments: u.slice(0, 1),
	uploading: !0
}) }, h = { render: () => /* @__PURE__ */ s(f, { initialAttachments: u }) }, g = { render: () => /* @__PURE__ */ s(a, {
	h: "520px",
	children: /* @__PURE__ */ s(l, {
		conversationKey: "submitted-attachment-story",
		messages: [{
			id: "submitted-user",
			role: "user",
			parts: [
				{
					type: "text",
					text: "Use these attachments to review the release plan."
				},
				{
					type: "file",
					fileId: "file-notes",
					filename: "release-notes.txt",
					mediaType: "text/plain",
					size: 2400,
					url: "/v1/projects/project/session-attachments/file-notes/content"
				},
				{
					type: "file",
					fileId: "file-diagram",
					filename: "flow.png",
					mediaType: "image/png",
					size: 4096,
					url: "/v1/projects/project/session-attachments/file-diagram/content"
				}
			]
		}],
		emptyStateTitle: "No messages",
		emptyStateDescription: "No messages",
		chatInputPlaceholder: "Reply to the agent...",
		actions: /* @__PURE__ */ s(f, {})
	})
}) };
export { p as DraftAttachments, h as SubmitErrorRecoverable, g as SubmittedUserTurn, m as Uploading, d as default };
