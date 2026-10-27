// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, h as t, r as n } from "./test-whhQHjQi.ts";
import { t as r } from "./chat-panel-DXY6mCVA.ts";
import { Box as i } from "@chakra-ui/react";
import { jsx as a } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/components/queued-submission.stories.tsx
var o = {
	title: "Patterns/Chat/Queued submission",
	component: r,
	decorators: [(e) => /* @__PURE__ */ a(i, {
		h: "full",
		minH: "32rem",
		maxW: "40rem",
		children: /* @__PURE__ */ a(e, {})
	})],
	args: {
		messages: [],
		streaming: !0,
		queuedFollowUps: [{
			id: "saved",
			position: 1,
			revision: "saved",
			prompt: "Review the current changes"
		}, {
			id: "sending",
			prompt: "Add a browser check",
			sending: !0,
			attachments: [{
				id: "notes",
				name: "notes.txt"
			}]
		}],
		onQueuedFollowUpUpdate: e(),
		onQueuedFollowUpRemove: e(),
		onQueuedFollowUpMove: e()
	}
}, s = { play: async ({ canvasElement: e }) => {
	let r = t(e);
	await n(r.getByRole("button", { name: "Edit queued message: Review the current changes" })).toBeEnabled(), await n(r.getByRole("button", { name: "Edit queued message: Add a browser check" })).toBeDisabled(), await n(r.getByRole("button", { name: "Drag queued follow-up 2" })).toBeDisabled(), await n(r.getAllByRole("button", { name: "Remove queued follow-up" })).toHaveLength(1);
} };
export { s as Sending, o as default };
