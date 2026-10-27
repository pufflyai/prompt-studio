// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, m as t, p as n, r } from "./test-whhQHjQi.ts";
import { t as i } from "./chat-panel-CAnDU0Lx.ts";
import { useState as a } from "react";
import { Box as o, Button as s, HStack as c, Text as l } from "@chakra-ui/react";
import { jsx as u, jsxs as d } from "react/jsx-runtime";
var f = {
	title: "Patterns/Chat/Queued conversation",
	component: (e) => {
		let { count: t = 2, fail: n = !1, unsupported: r = !1, liveInputHandler: f = !0 } = e, [p, m] = a(Array.from({ length: t }, (e, t) => ({
			id: `item-${t}`,
			position: t + 1,
			revision: `saved-${t}`,
			prompt: `Queued message ${t + 1}`,
			model: "Codex",
			params: { thinking: "high" },
			attachments: t === 1 ? [{
				id: "attachment",
				name: "notes.txt",
				mediaType: "text/plain"
			}] : []
		}))), [h, g] = a("Unsent draft"), [_, v] = a(null), [y, b] = a({}), [x, S] = a(""), C = _ ? y[_.id] ?? {
			model: _.model ?? "Codex",
			params: _.params ?? {},
			attachments: _.attachments ?? []
		} : void 0, w = (e) => {
			_ && C && b((t) => ({
				...t,
				[_.id]: {
					...C,
					...e
				}
			}));
		};
		return /* @__PURE__ */ d(o, {
			h: "32rem",
			w: "full",
			maxW: "40rem",
			display: "flex",
			flexDirection: "column",
			children: [/* @__PURE__ */ u(i, {
				messages: [],
				streaming: !0,
				chatInputDefaultValue: h,
				onChatInputChange: g,
				queuedFollowUps: p,
				onQueuedFollowUpSelect: v,
				onQueuedFollowUpDiscard: (e) => b((t) => {
					let n = { ...t };
					return delete n[e], n;
				}),
				unsavedQueueItemIds: Object.keys(y),
				queueSteeringUnavailableReason: r ? "This harness cannot accept live input." : null,
				actions: C ? /* @__PURE__ */ d(c, { children: [/* @__PURE__ */ u(s, {
					size: "xs",
					variant: "ghost",
					onClick: () => w({ model: C.model === "Codex" ? "Claude" : "Codex" }),
					children: C.model
				}), /* @__PURE__ */ u(s, {
					size: "xs",
					variant: "ghost",
					onClick: () => w({ params: { thinking: C.params.thinking === "high" ? "low" : "high" } }),
					children: String(C.params.thinking)
				})] }) : void 0,
				attachmentActions: C ? /* @__PURE__ */ u(s, {
					size: "xs",
					variant: "ghost",
					onClick: () => w({ attachments: [...C.attachments, {
						id: "new",
						name: "context.txt"
					}] }),
					children: "Attach context"
				}) : void 0,
				attachmentList: C?.attachments.length ? /* @__PURE__ */ u(c, { children: C.attachments.map((e) => /* @__PURE__ */ u(s, {
					size: "xs",
					variant: "ghost",
					onClick: () => w({ attachments: C.attachments.filter((t) => t.id !== e.id) }),
					children: e.name
				}, e.id)) }) : void 0,
				onQueuedFollowUpUpdate: async (e, t) => {
					if (n) throw Error("Could not save. Your edit is kept.");
					m((n) => n.map((n) => n.id === e ? {
						...n,
						...y[e],
						prompt: t,
						revision: crypto.randomUUID()
					} : n)), b((t) => {
						let n = { ...t };
						return delete n[e], n;
					});
				},
				onQueuedFollowUpRemove: (e) => m((t) => t.filter((t) => t.id !== e)),
				onQueuedFollowUpMove: (e, t, n = 1) => m((r) => {
					let i = [...r], a = i.findIndex((t) => t.id === e), [o] = i.splice(a, 1);
					return i.splice(a + (t === "up" ? -n : n), 0, o), i;
				}),
				onQueuedFollowUpCombine: (e, t) => m((n) => {
					let r = n.filter((n) => n.id === e.id || n.id === t.id);
					return n.filter((t) => t.id !== e.id).map((n) => n.id === t.id ? {
						...n,
						prompt: r.map((e) => e.prompt).join("\n\n"),
						attachments: [...new Map([...t.attachments ?? [], ...e.attachments ?? []].map((e) => [e.id, e])).values()],
						revision: crypto.randomUUID()
					} : n);
				}),
				onQueuedFollowUpSteer: f ? async (e) => {
					m((t) => t.filter((t) => t.id !== e.id)), S(`Accepted: ${e.prompt}`);
				} : void 0
			}), /* @__PURE__ */ u(l, {
				textStyle: "label/XS",
				children: x
			})]
		});
	}
}, p = { play: async ({ canvasElement: t }) => {
	let i = e(t);
	await n.click(i.getByRole("button", { name: "Edit queued message: Queued message 2" })), await r(i.getByRole("button", {
		name: "Update",
		exact: !0
	})).toBeVisible(), await r(i.getByRole("textbox")).toHaveTextContent("Queued message 2"), await r(i.getByRole("button", { name: "Edit saved draft" })).toHaveTextContent("Unsent draft");
} }, m = {
	tags: ["!manifest"],
	play: async ({ canvasElement: t }) => {
		let i = e(t);
		await n.click(i.getByRole("button", { name: "Edit queued message: Queued message 2" })), await n.click(i.getByRole("textbox")), await n.keyboard(" amended"), await n.click(i.getByRole("button", {
			name: "Codex",
			exact: !0
		})), await n.click(i.getByRole("button", { name: "Attach context" })), await n.click(i.getByRole("button", { name: "Edit queued message: Queued message 1" })), await n.click(i.getByRole("button", { name: "Edit saved draft" })), await r(i.getByRole("textbox")).toHaveTextContent("Unsent draft"), await n.click(i.getByRole("button", { name: "Edit queued message: Queued message 2" })), await r(i.getByRole("textbox")).toHaveTextContent("amended"), await r(i.getByRole("button", {
			name: "Claude",
			exact: !0
		})).toBeVisible(), await r(i.getByRole("button", {
			name: "context.txt",
			exact: !0
		})).toBeVisible();
	}
}, h = {
	args: { fail: !0 },
	play: async ({ canvasElement: t }) => {
		let i = e(t);
		await n.click(i.getByRole("button", { name: "Edit queued message: Queued message 2" })), await n.click(i.getByRole("textbox")), await n.keyboard(" kept"), await n.click(i.getByRole("button", {
			name: "Update",
			exact: !0
		})), await r(i.getByRole("alert")).toHaveTextContent("Your edit is kept"), await r(i.getByRole("textbox")).toHaveTextContent("kept");
	}
}, g = { play: async ({ canvasElement: t }) => {
	let i = e(t);
	await n.click(i.getByRole("button", { name: "Edit queued message: Queued message 2" })), await n.click(i.getByRole("textbox")), await n.keyboard(" saved"), await n.click(i.getByRole("button", {
		name: "Update",
		exact: !0
	})), await r(i.getByRole("textbox")).toHaveTextContent("Unsent draft"), await n.click(i.getByRole("button", { name: "Edit queued message: Queued message 2 saved" })), await r(i.getByRole("textbox")).toHaveTextContent("Queued message 2 saved");
} }, _ = { args: { count: 20 } }, v = {
	args: { unsupported: !0 },
	play: async ({ canvasElement: i }) => {
		let a = e(i);
		await n.click(a.getByRole("button", { name: "Drag queued follow-up 1" })), await n.keyboard(" "), await t(() => r(i.querySelector("[data-queued-follow-up-id][data-drag-source=true]")).toBeInTheDocument()), await r(i.querySelector("[data-queue-send-now]")).not.toBeInTheDocument(), await n.keyboard("{End}"), await n.keyboard(" "), await t(() => r(i.querySelector("[data-queued-follow-up-id]:last-child")).toHaveTextContent("Queued message 1")), await r(a.queryByRole("alert")).not.toBeInTheDocument();
	}
}, y = {
	args: { liveInputHandler: !1 },
	play: v.play
}, b = { play: async ({ canvasElement: i }) => {
	let a = e(i);
	await n.click(a.getByRole("button", { name: "Edit queued message: Queued message 2" })), await n.click(a.getByRole("textbox")), await n.keyboard(" keep this edit"), await n.click(a.getByRole("button", { name: "Drag queued follow-up 2" })), await n.keyboard(" "), await t(() => r(i.querySelector("[data-queue-send-now]")).toBeInTheDocument()), await n.keyboard("{Escape}"), await t(() => r(i.querySelector("[data-queue-send-now]")).not.toBeInTheDocument()), await r(a.getByRole("button", {
		name: "Update",
		exact: !0
	})).toBeVisible(), await r(a.getByRole("textbox")).toHaveTextContent("keep this edit"), await n.click(a.getByRole("textbox")), await n.keyboard("{Escape}"), await r(a.getByRole("textbox")).toHaveTextContent("Unsent draft");
} }, x = { play: async ({ canvasElement: i }) => {
	let a = e(i);
	await n.click(a.getByRole("button", { name: "Edit queued message: Queued message 2" })), await n.click(a.getByRole("button", {
		name: "Codex",
		exact: !0
	})), await n.click(a.getByRole("button", {
		name: "high",
		exact: !0
	})), await n.click(a.getByRole("button", { name: "Attach context" })), await n.click(a.getByRole("textbox")), await n.keyboard(" discarded{Escape}"), await t(() => r(a.queryByRole("button", {
		name: "Update",
		exact: !0
	})).not.toBeInTheDocument()), await r(a.getByRole("textbox")).toHaveTextContent("Unsent draft"), await n.click(a.getByRole("button", { name: "Edit queued message: Queued message 2" })), await r(a.getByRole("textbox")).toHaveTextContent("Queued message 2"), await r(a.getByRole("textbox")).not.toHaveTextContent("discarded"), await r(a.getByRole("button", {
		name: "Codex",
		exact: !0
	})).toBeVisible(), await r(a.getByRole("button", {
		name: "high",
		exact: !0
	})).toBeVisible(), await r(a.queryByRole("button", {
		name: "context.txt",
		exact: !0
	})).not.toBeInTheDocument(), await r(a.getByRole("button", {
		name: "notes.txt",
		exact: !0
	})).toBeVisible();
} };
export { b as EscapeCancelsDragBeforeEdit, x as EscapeCancelsEdit, h as FailedUpdate, p as InlineEditor, y as NoLiveInputHandler, _ as Overflow, g as SavedUpdate, m as SwitchingTargets, v as Unsupported, f as default };
