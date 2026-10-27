// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, r as t } from "./test-whhQHjQi.ts";
import { t as n } from "./arrow-up-right-CUuzCgQb.ts";
import { t as r } from "./chevron-down-ZmPqsMG0.ts";
import { t as i } from "./git-branch-BjWwGBn9.ts";
import { t as a } from "./full-conversation-normalized-BR4uyFU4.ts";
import { t as o } from "./chat-panel-CAnDU0Lx.ts";
import { a as s, i as c, n as l, o as u, s as d, t as f } from "./chat-history-story-CtaORc8W.ts";
import { t as p } from "./workspace-hub-BZBU-L1T.ts";
import { useEffect as m, useRef as ee, useState as h } from "react";
import { Box as g, Button as _, HStack as v, IconButton as y, Text as b } from "@chakra-ui/react";
import { Fragment as x, jsx as S, jsxs as C } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/components/chat-panel-work-timer-fixtures.tsx
var w = (e) => {
	let { messages: t, emptyStateTitle: n, emptyStateDescription: r, chatInputPlaceholder: i, actions: a, streamingStartedAt: s } = e, [c] = h(() => s ?? Date.now()), [l, u] = h(!1), [d, f] = h(0);
	return /* @__PURE__ */ C(x, { children: [
		/* @__PURE__ */ S(_, {
			size: "sm",
			variant: "outline",
			onClick: () => u((e) => !e),
			children: l ? "Show working indicator" : "Hide working indicator"
		}),
		/* @__PURE__ */ S(_, {
			size: "sm",
			variant: "outline",
			onClick: () => f((e) => e + 1),
			children: "Reopen conversation"
		}),
		/* @__PURE__ */ S(g, {
			flex: "1",
			minH: "0",
			children: /* @__PURE__ */ S(o, {
				messages: t,
				streaming: !0,
				streamingStartedAt: c,
				workspaceInitializing: l,
				emptyStateTitle: n,
				emptyStateDescription: r,
				chatInputPlaceholder: i,
				actions: a
			}, d)
		})
	] });
}, T = (e, t, n, r = 1) => {
	let i = e;
	for (let e = 0; e < r; e += 1) {
		let e = E(i, t, n);
		if (e === i) return i;
		i = e;
	}
	return i;
}, E = (e, t, n) => {
	let r = e.findIndex((e) => e.id === t);
	if (r === -1) return e;
	let i = n === "up" ? r - 1 : r + 1;
	if (i < 0 || i >= e.length) return e;
	let a = [...e], o = a[r];
	return a[r] = a[i], a[i] = o, a;
}, D = a, O = "I need a release checklist for this rollout and I want every detail captured in one place. Include pre-flight checks for database migrations, message queue lag, worker health, API latency budgets, and frontend error budgets. Add rollback steps with exact ownership, communication templates, and what metrics should trigger rollback automatically. Also include a section that explains canary rollout percentages by minute, regional sequencing, and how we handle failed verification gates. Please include dry-run instructions, expected command outputs, and post-deploy validation checks for auth, billing, and audit logs. Finally, provide a handoff note that the on-call engineer can use without extra context, including escalation paths and paging thresholds.", k = [{
	id: "long-user-prompt",
	role: "user",
	parts: [{
		type: "text",
		text: `${O} ${O}`
	}]
}, {
	id: "assistant-response-after-long-prompt",
	role: "assistant",
	parts: [{
		type: "text",
		text: "Acknowledged. I created a compact rollout checklist with owners, rollback triggers, and post-deploy validation steps so the response stays visible while you review the prompt."
	}]
}], te = [
	{
		id: "initial-user-prompt",
		role: "user",
		parts: [{
			type: "text",
			text: "Summarize the rollout status."
		}]
	},
	{
		id: "initial-assistant-response",
		role: "assistant",
		parts: [{
			type: "text",
			text: Array.from({ length: 18 }, (e, t) => `Rollout check ${t + 1}: the initial verification stayed healthy before the follow-up was sent.`).join("\n\n")
		}]
	},
	{
		id: "follow-up-user-prompt",
		role: "user",
		parts: [{
			type: "text",
			text: "Show me the detailed verification results."
		}]
	},
	{
		id: "follow-up-assistant-response",
		role: "assistant",
		parts: [{
			type: "text",
			text: Array.from({ length: 18 }, (e, t) => `Verification ${t + 1}: the service checks passed, latency stayed within budget, and no rollback signal was triggered.`).join("\n\n")
		}]
	}
], ne = {
	title: "Patterns/Chat/Chat Panel",
	component: o,
	parameters: {
		layout: "padded",
		actions: { argTypesRegex: "^on[A-Z].*" }
	}
}, A = {
	w: "960px",
	maxW: "100%",
	h: "680px",
	bg: "bg",
	borderWidth: "1px",
	borderColor: "border",
	borderRadius: "lg",
	p: "md"
}, j = /* @__PURE__ */ S(v, {
	gap: "1",
	children: /* @__PURE__ */ C(_, {
		size: "xs",
		variant: "outline",
		children: ["Opencode", /* @__PURE__ */ S(r, { size: 14 })]
	})
}), M = /* @__PURE__ */ C(_, {
	size: "xs",
	variant: "ghost",
	px: "2xs",
	children: [
		/* @__PURE__ */ S(i, { size: 14 }),
		/* @__PURE__ */ S(b, {
			textStyle: "label/XS/medium",
			color: "fg",
			ml: "2xs",
			children: "main"
		}),
		/* @__PURE__ */ S(r, { size: 14 })
	]
}), N = /* @__PURE__ */ S(y, {
	size: "xs",
	variant: "ghost",
	"aria-label": "Open workspace",
	children: /* @__PURE__ */ S(n, { size: 14 })
}), P = D.slice(-18), F = 10, I = 60, L = (e) => {
	if (!e) return [];
	let t = [];
	for (let n = 0; n < e.length; n += F) t.push(e.slice(n, n + F));
	return t;
}, R = (e) => e.type === "text", z = (e, t, n, r) => e.map((e) => {
	if (e.id !== t) return e;
	let i = e.parts[n];
	if (!i || !R(i)) return e;
	let a = [...e.parts];
	return a[n] = {
		...i,
		text: r
	}, {
		...e,
		parts: a
	};
}), re = (e) => e.parts.map((e, t) => ({
	part: e,
	idx: t
})).filter(({ part: e }) => R(e) && e.text.trim().length > 0), ie = (e, t) => {
	let n = new Set(t.map(({ idx: e }) => e));
	return {
		...e,
		parts: e.parts.map((e, t) => n.has(t) && R(e) ? {
			...e,
			text: ""
		} : e)
	};
}, ae = async (e) => {
	let { message: t, textPartEntries: n, isCancelled: r, onChunk: i } = e;
	for (let { part: e, idx: a } of n) {
		if (r()) return;
		let n = L(e.text), o = "";
		for (let e of n) {
			if (r()) return;
			o += e, i(t.id, a, o), await B(I);
		}
	}
}, oe = async (e) => {
	let { messages: t, isCancelled: n, onStart: r, onMessage: i, onChunk: a, onComplete: o } = e;
	r();
	for (let e of t) {
		if (n()) return;
		let t = re(e);
		t.length === 0 ? (i(e), await B(e.role === "user" ? V : H)) : (i(ie(e, t)), await ae({
			message: e,
			textPartEntries: t,
			isCancelled: n,
			onChunk: a
		}), await B(V));
	}
	n() || o();
}, B = (e) => new Promise((t) => setTimeout(t, e)), V = 200, H = 80, U = (e) => {
	e.current !== null && (clearInterval(e.current), e.current = null);
}, W = (e) => {
	let { timerRef: t, sourceText: n, onStart: r, onChunk: i, onComplete: a } = e;
	U(t);
	let o = L(n);
	if (o.length === 0) {
		a();
		return;
	}
	let s = "", c = 0;
	r(), t.current = setInterval(() => {
		s += o[c] ?? "", i(s), c += 1, c >= o.length && (U(t), a());
	}, I);
}, G = (e, t) => t.length === 0 ? `Mock response: I received "${e}" and generated a draft answer.` : `Mock response: I received "${e}" with ${t.length} attachment(s): ${t.join(", ")}.`, K = [
	{
		id: "queued-prompt-session-1-1",
		prompt: "Run the validation suite after the current implementation finishes.",
		position: 1
	},
	{
		id: "queued-prompt-session-1-2",
		prompt: "Prepare a concise review summary with changed files and validation output.",
		position: 2,
		attachments: [{
			id: "file-1",
			name: "review-notes.md",
			mediaType: "text/markdown"
		}]
	},
	{
		id: "queued-prompt-session-1-3",
		prompt: "Open the workspace diff and call out any risky UI regressions before wrapping up.",
		position: 3
	}
];
function q(e) {
	let { messages: t = [], onSubmitMessage: n, emptyStateTitle: r, emptyStateDescription: i, chatInputPlaceholder: a, actions: s, workspaceHub: c, queuedFollowUps: l, onQueuedFollowUpUpdate: u, onQueuedFollowUpRemove: d, onQueuedFollowUpMove: f, chatInputCommands: p } = e, [g, _] = h(t), [v, y] = h(!1), [b, x] = h(Date.now), [C, w] = h(t.length + 1), T = ee(null);
	return m(() => {
		U(T), _(t), w(t.length + 1);
	}, [t]), m(() => () => U(T), []), /* @__PURE__ */ S(o, {
		messages: g,
		streaming: v,
		streamingStartedAt: b,
		emptyStateTitle: r,
		emptyStateDescription: i,
		chatInputPlaceholder: a,
		onSubmitMessage: (e, t) => {
			n?.(e, t);
			let r = {
				id: `message-${C}`,
				role: "user",
				parts: [{
					type: "text",
					text: e
				}]
			}, i = G(e, t), a = `message-${C + 1}`, o = {
				id: a,
				role: "assistant",
				parts: [{
					type: "text",
					text: ""
				}]
			};
			w((e) => e + 2), _((e) => [
				...e,
				r,
				o
			]), W({
				timerRef: T,
				sourceText: i,
				onStart: () => {
					x(Date.now()), y(!0);
				},
				onChunk: (e) => {
					_((t) => z(t, a, 0, e));
				},
				onComplete: () => y(!1)
			});
		},
		actions: s,
		workspaceHub: c,
		queuedFollowUps: l,
		onQueuedFollowUpUpdate: u,
		onQueuedFollowUpRemove: d,
		onQueuedFollowUpMove: f,
		chatInputCommands: p
	});
}
function J(e) {
	let [t, n] = h(e.queuedFollowUps ?? []), r = (e, t) => {
		n((n) => n.map((n) => n.id === e ? {
			...n,
			prompt: t
		} : n));
	}, i = (e) => {
		n((t) => t.filter((t) => t.id !== e));
	}, a = (e, t, r) => {
		n((n) => T(n, e, t, r));
	};
	return /* @__PURE__ */ S(q, {
		...e,
		queuedFollowUps: t,
		onQueuedFollowUpUpdate: r,
		onQueuedFollowUpRemove: i,
		onQueuedFollowUpMove: a
	});
}
var Y = {
	render: (e) => /* @__PURE__ */ S(g, {
		...A,
		children: /* @__PURE__ */ S(q, { ...e })
	}),
	args: {
		messages: [],
		streaming: !1,
		emptyStateTitle: "No messages yet",
		emptyStateDescription: "Send a message to start this session.",
		chatInputPlaceholder: "Type a message...",
		actions: j,
		onSubmitMessage: (e, t) => {
			console.log("Submitted", {
				text: e,
				attachments: t
			});
		}
	}
}, X = {
	render: (e) => /* @__PURE__ */ S(g, {
		...A,
		children: /* @__PURE__ */ S(q, { ...e })
	}),
	args: {
		...Y.args,
		messages: D
	}
}, Z = {
	render: (e) => /* @__PURE__ */ S(g, {
		...A,
		children: /* @__PURE__ */ S(J, { ...e })
	}),
	args: {
		...X.args,
		queuedFollowUps: K,
		chatInputCommands: [{
			name: "/plan",
			description: "Select native planning."
		}, {
			name: "/compact",
			description: "Compact this thread."
		}]
	}
};
function se(e) {
	let { messages: t = [], emptyStateTitle: n, emptyStateDescription: r, chatInputPlaceholder: i, actions: a } = e, [s, c] = h([]), [l, u] = h(!0), [d, f] = h(Date.now);
	return m(() => {
		let e = !1;
		return (async () => {
			await oe({
				messages: t,
				isCancelled: () => e,
				onStart: () => {
					c([]), f(Date.now()), u(!0);
				},
				onMessage: (e) => {
					c((t) => [...t, e]);
				},
				onChunk: (e, t, n) => {
					c((r) => z(r, e, t, n));
				},
				onComplete: () => {
					u(!1);
				}
			});
		})(), () => {
			e = !0;
		};
	}, [t]), /* @__PURE__ */ S(o, {
		messages: s,
		streaming: l,
		streamingStartedAt: d,
		emptyStateTitle: n,
		emptyStateDescription: r,
		chatInputPlaceholder: i,
		actions: a
	});
}
var Q = {
	render: (e) => /* @__PURE__ */ S(g, {
		...A,
		children: /* @__PURE__ */ S(se, { ...e })
	}),
	args: {
		...Y.args,
		messages: P
	}
}, $ = {
	render: (e) => /* @__PURE__ */ S(g, {
		...A,
		display: "flex",
		flexDirection: "column",
		gap: "sm",
		children: /* @__PURE__ */ S(w, { ...e })
	}),
	args: {
		...X.args,
		messages: k
	}
}, ce = {
	...$,
	args: {
		...$.args,
		streamingStartedAt: Date.now() - 3e5
	}
}, le = {
	render: (e) => /* @__PURE__ */ S(g, {
		...A,
		children: /* @__PURE__ */ S(q, { ...e })
	}),
	args: {
		...Y.args,
		messages: k
	}
}, ue = {
	render: (e) => /* @__PURE__ */ S(g, {
		...A,
		children: /* @__PURE__ */ S(q, { ...e })
	}),
	args: {
		...Y.args,
		messages: te
	},
	play: async ({ canvasElement: n }) => {
		let r = e(n), i = (await r.findByText("Summarize the rollout status.")).closest(".ai-message__root"), a = (await r.findByText(/Rollout check 1:/)).closest(".ai-message__root"), o = (await r.findByText("Show me the detailed verification results.")).closest(".ai-message__root"), s = o?.closest("[data-part=\"content\"][role=\"list\"]")?.parentElement;
		if (!s || !i || !a || !o) throw Error("Expected the conversation viewport and both user turns");
		s.scrollTop = 0, s.dispatchEvent(new Event("scroll")), await new Promise((e) => requestAnimationFrame(() => requestAnimationFrame(() => e())));
		let c = s.getBoundingClientRect().top, l = a.getBoundingClientRect().top - c, u = o.getBoundingClientRect().top - c;
		s.scrollTop = l + 80, s.dispatchEvent(new Event("scroll")), await new Promise((e) => requestAnimationFrame(() => requestAnimationFrame(() => e()))), t(s.scrollTop).toBeGreaterThan(0), t(i.getBoundingClientRect().top).toBeGreaterThanOrEqual(c - 1), t(i.getBoundingClientRect().top).toBeLessThanOrEqual(c + 1), t(a.compareDocumentPosition(o) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(Node.DOCUMENT_POSITION_FOLLOWING), s.scrollTop = u + 80, s.dispatchEvent(new Event("scroll")), await new Promise((e) => requestAnimationFrame(() => requestAnimationFrame(() => e()))), t(o.getBoundingClientRect().top).toBeGreaterThanOrEqual(c - 1), t(o.getBoundingClientRect().top).toBeLessThanOrEqual(c + 1), t(i.getBoundingClientRect().bottom).toBeLessThanOrEqual(c + 1);
	}
}, de = {
	render: (e) => /* @__PURE__ */ S(g, {
		...A,
		children: /* @__PURE__ */ S(q, { ...e })
	}),
	args: {
		...X.args,
		streaming: !0,
		workspaceHub: /* @__PURE__ */ S(p, {
			workspaceControl: M,
			additions: 83,
			deletions: 9,
			action: N
		})
	}
}, fe = {
	render: (e) => /* @__PURE__ */ S(g, {
		...A,
		children: /* @__PURE__ */ S(J, { ...e })
	}),
	args: {
		...Z.args,
		streaming: !0,
		workspaceHub: /* @__PURE__ */ S(p, {
			workspaceControl: M,
			additions: 42,
			deletions: 6,
			action: N
		})
	}
}, pe = {
	render: () => /* @__PURE__ */ S(f, {}),
	play: d
}, me = {
	tags: ["!manifest"],
	render: () => /* @__PURE__ */ S(f, { prompts: Array.from({ length: 12 }, (e, t) => `Prompt ${t + 1}`) }),
	play: s
}, he = {
	tags: ["!manifest"],
	render: () => /* @__PURE__ */ S(f, { prompts: ["Earlier prompt", "First line\nSecond line"] }),
	play: u
}, ge = {
	render: () => /* @__PURE__ */ S(l, {}),
	play: c
};
export { X as Conversation, de as ConversationWithWorkspaceHub, Y as Empty, le as LongStickyUserPrompt, ue as OverflowingFollowUp, pe as PromptHistory, me as PromptHistoryFull, he as PromptHistoryMultiline, ge as PromptHistoryReset, Z as QueuedFollowUps, fe as QueuedFollowUpsWithWorkspaceHub, Q as Streaming, ce as WorkingIndicatorLongRun, $ as WorkingIndicatorVisibility, ne as default };
