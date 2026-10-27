// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, m as t, p as n, r } from "./test-whhQHjQi.ts";
import { t as i } from "./chat-panel-DXY6mCVA.ts";
import { useState as a } from "react";
import { Box as o, Button as s } from "@chakra-ui/react";
import { jsx as c, jsxs as l } from "react/jsx-runtime";
var u = {
	title: "Patterns/Chat/Queued edit recovery",
	component: (e) => {
		let { draft: t = "", remaining: n = !1, remainingCount: r = 1, draftHasFiles: u = !1, draftWritable: d = !0, fail: f = !1 } = e, [p, m] = a(t), [h, g] = a([{
			id: "selected",
			position: 1,
			prompt: "Queued request",
			revision: "saved"
		}, ...n ? Array.from({ length: r }, (e, t) => ({
			id: `other-${t}`,
			position: t + 2,
			prompt: t ? "Third request" : "Other request",
			revision: `other-${t}`
		})) : []]);
		return /* @__PURE__ */ l(o, {
			h: "32rem",
			maxW: "40rem",
			children: [
				/* @__PURE__ */ c(s, {
					size: "xs",
					onClick: () => g((e) => e.filter((e) => e.id !== "selected")),
					children: "Send selected request"
				}),
				/* @__PURE__ */ c(s, {
					size: "xs",
					onClick: () => g((e) => e.map((e) => ({
						...e,
						revision: "changed"
					}))),
					children: "Change saved revision"
				}),
				/* @__PURE__ */ c(i, {
					messages: [],
					chatInputDefaultValue: p,
					onChatInputChange: d ? m : void 0,
					queuedFollowUps: h,
					canRestoreQueuedEditToDraft: !u,
					onQueuedFollowUpUpdate: () => {},
					onQueuedFollowUpMove: (e, t, n = 1, r) => {
						if (r?.items.some((e) => !h.some((t) => t.id === e.id))) throw Error("Queue membership changed.");
						g((r) => {
							let i = [...r], a = i.findIndex((t) => t.id === e), [o] = i.splice(a, 1);
							return i.splice(a + (t === "up" ? -n : n), 0, o), i;
						});
					},
					onQueuedFollowUpCreate: async (e, t) => {
						if (f) throw Error("Could not create. Your edit is kept.");
						g((e) => [...e, {
							id: "created",
							prompt: t,
							revision: "created"
						}]);
					}
				})
			]
		});
	}
}, d = async (t) => {
	let i = e(t);
	await n.click(i.getByRole("button", { name: "Edit queued message: Queued request" })), await n.click(i.getByRole("textbox")), await n.keyboard(" amended");
	let a = i.getByRole("button", {
		name: "Cancel",
		exact: !0
	});
	return await r(a.nextElementSibling).toBe(i.getByRole("button", {
		name: "Update",
		exact: !0
	})), await n.click(i.getByRole("button", { name: "Send selected request" })), i;
}, f = { play: async ({ canvasElement: e }) => {
	let t = await d(e);
	await r(t.queryByRole("button", {
		name: "Update",
		exact: !0
	})).not.toBeInTheDocument(), await r(t.queryByRole("button", { name: "Edit saved draft" })).not.toBeInTheDocument(), await r(t.getByRole("textbox")).toHaveTextContent("Queued request amended"), await r(t.getByRole("status", { name: "Queued edit notice" })).toHaveTextContent("moved to the draft"), await n.click(t.getByRole("textbox")), await n.keyboard(" changed"), await r(t.queryByRole("status", { name: "Queued edit notice" })).not.toBeInTheDocument();
} }, p = {
	args: { draft: "Independent draft" },
	play: async ({ canvasElement: e }) => {
		let t = await d(e), i = t.getByRole("button", {
			name: "Create new queue item",
			exact: !0
		});
		await r(i).toBeEnabled(), await r(t.getByRole("status", { name: "Queued edit notice" })).toHaveTextContent("sent"), await r(t.getByRole("button", { name: "Edit saved draft" })).toHaveTextContent("Independent draft"), await n.click(i), await r(t.getByRole("textbox")).toHaveTextContent("Independent draft"), await r(t.getByRole("button", { name: "Edit queued message: Queued request amended" })).toBeVisible();
	}
}, m = {
	args: { remaining: !0 },
	play: async ({ canvasElement: e }) => {
		let t = await d(e);
		await r(t.getByRole("button", {
			name: "Create new queue item",
			exact: !0
		})).toBeEnabled(), await r(t.getByRole("button", { name: "Edit queued message: Other request" })).toBeVisible();
	}
}, h = {
	args: { draftHasFiles: !0 },
	play: async ({ canvasElement: e }) => {
		let t = await d(e);
		await r(t.getByRole("button", {
			name: "Create new queue item",
			exact: !0
		})).toBeEnabled(), await r(t.getByRole("button", { name: "Edit saved draft" })).toBeVisible();
	}
}, g = {
	args: {
		draft: "Independent draft",
		fail: !0
	},
	play: async ({ canvasElement: e }) => {
		let t = await d(e);
		await n.click(t.getByRole("button", {
			name: "Create new queue item",
			exact: !0
		})), await r(t.getByRole("alert")).toHaveTextContent("Your edit is kept"), await r(t.getByRole("textbox")).toHaveTextContent("amended"), await n.click(t.getByRole("button", {
			name: "Cancel",
			exact: !0
		})), await r(t.getByRole("textbox")).toHaveTextContent("Independent draft");
	}
}, _ = { play: async ({ canvasElement: t }) => {
	let i = e(t);
	await n.click(i.getByRole("button", { name: "Edit queued message: Queued request" })), await n.click(i.getByRole("textbox")), await n.keyboard(" kept"), await n.click(i.getByRole("button", { name: "Change saved revision" })), await r(i.getByRole("button", {
		name: "Update",
		exact: !0
	})).toBeDisabled(), await r(i.getByRole("alert")).toHaveTextContent("request changed"), await r(i.queryByRole("button", {
		name: "Create new queue item",
		exact: !0
	})).not.toBeInTheDocument(), await r(i.getByRole("textbox")).toHaveTextContent("kept");
} }, v = {
	args: { draftWritable: !1 },
	play: async ({ canvasElement: e }) => {
		let t = await d(e);
		await r(t.getByRole("textbox")).toHaveTextContent("Queued request amended"), await r(t.getByRole("button", {
			name: "Create new queue item",
			exact: !0
		})).toBeEnabled();
	}
}, y = {
	args: {
		remaining: !0,
		remainingCount: 2
	},
	play: async ({ canvasElement: e }) => {
		let i = await d(e);
		await r(i.queryByRole("button", { name: "Drag queued follow-up 3" })).not.toBeInTheDocument(), await n.click(i.getByRole("button", { name: "Drag queued follow-up 1" })), await n.keyboard(" "), await n.keyboard("{End} "), await t(() => r(e.querySelector("[data-queued-follow-up-id]:last-child")).toHaveTextContent("Other request")), await r(i.queryByRole("alert")).not.toBeInTheDocument(), await r(i.getByRole("button", {
			name: "Create new queue item",
			exact: !0
		})).toBeEnabled();
	}
};
export { _ as ChangedRevision, h as DraftWithAttachments, f as EmptyDraft, g as FailedCreate, v as NoDraftWriter, p as OccupiedDraft, m as RemainingQueue, y as ReorderAfterSending, u as default };
