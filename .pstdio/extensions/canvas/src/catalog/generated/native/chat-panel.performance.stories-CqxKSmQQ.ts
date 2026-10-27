// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./chat-panel-CAnDU0Lx.ts";
import { t } from "./ai-message-3J9aywD3.ts";
import { a as n, c as r, i, l as a, n as o, o as s, r as c, s as l, t as u, u as d } from "./chat-performance-story-utils-BZGYQfkk.ts";
import { useEffect as f, useRef as p, useState as m } from "react";
import { Button as h, HStack as g, Skeleton as _, Stack as v } from "@chakra-ui/react";
import { jsx as y, jsxs as b } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/components/chat-skeleton.tsx
var x = (e) => {
	let { widths: t } = e;
	return /* @__PURE__ */ y(v, {
		gap: "xs",
		w: "full",
		children: t.map((e, t) => /* @__PURE__ */ y(_, {
			height: "3",
			width: e,
			borderRadius: "xs"
		}, `${e}-${t}`))
	});
}, S = () => /* @__PURE__ */ b(v, {
	minH: "full",
	py: "xs",
	gap: "0",
	children: [/* @__PURE__ */ y(t.Root, {
		from: "user",
		children: /* @__PURE__ */ y(t.Content, {
			from: "user",
			children: /* @__PURE__ */ y(x, { widths: ["72%", "46%"] })
		})
	}), /* @__PURE__ */ y(t.Root, {
		from: "assistant",
		children: /* @__PURE__ */ y(t.Content, {
			from: "assistant",
			children: /* @__PURE__ */ y(x, { widths: [
				"76%",
				"62%",
				"40%"
			] })
		})
	})]
}), C = {
	title: "Patterns/Chat/Chat Panel Performance",
	component: e,
	parameters: {
		layout: "fullscreen",
		controls: { disable: !0 },
		docs: { description: { component: "Performance benchmarks for ChatPanel mount, streaming, and session switching. Excluded from agent manifests." } }
	},
	tags: ["!manifest"]
}, w = a({
	sessionId: "perf-large",
	turns: 500,
	textRepeat: 4,
	toolCallsPerTurn: 3
}), T = r(), E = 3, D = a({
	sessionId: "perf-stream-seed",
	turns: 500 - E,
	textRepeat: 1,
	toolCallsPerTurn: 2
}), O = a({
	sessionId: "perf-stream-tail",
	turns: E,
	textRepeat: 1,
	toolCallsPerTurn: 2
});
function k() {
	let [t, r] = m([]), [i, a] = m(null), s = p(!1);
	return f(() => {
		if (s.current) return;
		s.current = !0;
		let e = !1;
		return (async () => {
			if (await n(), e) return;
			let t = l({
				scenario: "large-conversation",
				label: "Large chat mount",
				messageCount: w.length,
				startMarkName: "chat-perf:large-conversation-mount-start"
			});
			a({
				id: t,
				readyMarkName: "chat-perf:large-conversation-ready"
			}), r(w);
		})(), () => {
			e = !0;
		};
	}, []), /* @__PURE__ */ b(o, {
		scenario: "large-conversation",
		activeLabel: "Large conversation",
		messageCount: t.length,
		children: [/* @__PURE__ */ y(u, {
			measurement: i,
			messageCount: t.length
		}), /* @__PURE__ */ y(e, {
			messages: t,
			loading: t.length === 0,
			streaming: !1,
			loaderComponent: /* @__PURE__ */ y(S, {}),
			...c
		})]
	});
}
function A() {
	let [t, r] = m(null), [i, a] = m(!0), [s, d] = m(null), _ = p(!1), v = p(0);
	f(() => {
		if (_.current) return;
		_.current = !0;
		let e = v.current + 1;
		v.current = e;
		let t = !1;
		return (async () => {
			if (await n(), t || v.current !== e) return;
			let i = T.primarySession, o = l({
				scenario: "session-switching",
				label: "Initial session mount",
				messageCount: i.messages.length
			});
			d({
				id: o,
				readyMarkName: "chat-perf:session-switch-ready"
			}), r(i), a(!1);
		})(), () => {
			t = !0;
		};
	}, []);
	let x = (e) => {
		let t = v.current + 1;
		v.current = t;
		let i = l({
			scenario: "session-switching",
			label: `${e.label} switch`,
			messageCount: e.messages.length,
			startMarkName: "chat-perf:session-switch-start"
		});
		d({
			id: i,
			readyMarkName: "chat-perf:session-switch-ready"
		}), a(!0), r(null), (async () => {
			await n(), v.current === t && (r(e), a(!1));
		})();
	}, C = /* @__PURE__ */ b(g, {
		gap: "xs",
		children: [/* @__PURE__ */ y(h, {
			size: "xs",
			onClick: () => x(T.primarySession),
			children: "Primary"
		}), /* @__PURE__ */ y(h, {
			size: "xs",
			onClick: () => x(T.secondarySession),
			children: "Secondary"
		})]
	}), w = t?.messages ?? [];
	return /* @__PURE__ */ b(o, {
		scenario: "session-switching",
		activeLabel: t?.label ?? "Loading session",
		messageCount: w.length,
		actions: C,
		children: [/* @__PURE__ */ y(u, {
			measurement: s,
			messageCount: w.length
		}), /* @__PURE__ */ y(e, {
			messages: w,
			loading: i,
			streaming: !1,
			loaderComponent: /* @__PURE__ */ y(S, {}),
			...c
		})]
	});
}
function j() {
	let [t, r] = m([]), [a, h] = m(!1), [g, _] = m(null), v = p(!1);
	return f(() => {
		if (v.current) return;
		v.current = !0;
		let e = !1;
		return (async () => {
			if (await n(), e) return;
			let t = l({
				scenario: "streaming",
				label: "Seed chat mount",
				messageCount: D.length
			});
			_({ id: t }), r(D), h(!0), await n(), await n(), performance.mark("chat-perf:stream-start"), await s({
				messages: O,
				isCancelled: () => e,
				appendMessage: (e) => r((t) => [...t, e]),
				updateText: (e, t, n) => r((r) => d(r, e, t, n))
			}), !e && (h(!1), i("chat-perf:stream-complete"));
		})(), () => {
			e = !0;
		};
	}, []), /* @__PURE__ */ b(o, {
		scenario: "streaming",
		activeLabel: "Streaming conversation",
		messageCount: t.length,
		children: [/* @__PURE__ */ y(u, {
			measurement: g,
			messageCount: t.length
		}), /* @__PURE__ */ y(e, {
			messages: t,
			loading: t.length === 0,
			streaming: a,
			loaderComponent: /* @__PURE__ */ y(S, {}),
			...c
		})]
	});
}
var M = { render: () => /* @__PURE__ */ y(k, {}) }, N = { render: () => /* @__PURE__ */ y(A, {}) }, P = { render: () => /* @__PURE__ */ y(j, {}) };
export { M as LargeConversation, N as SessionSwitching, P as StreamingScenario, C as default };
