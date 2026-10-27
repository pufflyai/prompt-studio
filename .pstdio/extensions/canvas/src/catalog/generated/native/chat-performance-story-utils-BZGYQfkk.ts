// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { i as e, n as t, r as n, t as r } from "./performance-panel-svo9U_q5.ts";
import { Profiler as i, useEffect as a, useState as o } from "react";
import { Box as s, HStack as c, Stack as l, Text as u } from "@chakra-ui/react";
import { jsx as d, jsxs as f } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/performance/chat-performance-fixtures.ts
var p = 4, m = 3, h = [
	"Please inspect the current implementation, explain the relevant tradeoffs, and keep the work scoped to the existing architecture.",
	"Use the repository conventions, keep the behavior easy to verify, and include enough context that the next person can reason about the change.",
	"When the implementation touches shared surfaces, call out the risks and make the validation path explicit."
], g = [
	"I traced the data flow through the route, store, and rendering layer, then narrowed the behavior to the smallest surface that needs to change.",
	"The implementation keeps the happy path direct while preserving the existing component and package boundaries.",
	"The remaining risk is concentrated in the expensive rendering path, so the benchmark should capture both initial load and incremental updates."
], _ = (e, t) => [
	`Reference: [session hydration notes](https://example.com/${e}/sessions/${t}) and [stream replay trace](https://example.com/${e}/stream/${t}).`,
	[
		"| Surface | Load | Risk |",
		"| --- | ---: | --- |",
		`| transcript | ${t + 1}20 rows | markdown parse pressure |`,
		`| tools | ${t % 4 + 3} calls | timeline layout churn |`,
		"| stream | 384 byte chunks | repeated text updates |"
	].join("\n"),
	"- [x] Keep REST hydration and SSE replay visible in the fixture\n- [ ] Capture browser long tasks\n- [ ] Compare session switch and stream update costs",
	[
		"```ts",
		`const sessionId = "${e}";`,
		`const turnIndex = ${t};`,
		"const shouldMeasure = messages.length > 100 && streaming === false;",
		"```"
	].join("\n")
], v = (e, t, n, r) => Array.from({ length: t }, (t, i) => `${`${e[i % e.length]} (${i + 1})`}\n\n${_(n, r).join("\n\n")}`).join("\n\n"), y = (e, t) => Array.from({ length: 8 }, (n, r) => `packages/ui/src/components/chat-ui/${e}-${t}-${String(r + 1).padStart(2, "0")}.tsx:${12 + r}: rendered sample ${r + 1}`).join("\n"), b = (e) => [
	"--- a/packages/ui/src/components/chat-ui/session-row.tsx",
	"+++ b/packages/ui/src/components/chat-ui/session-row.tsx",
	"@@ -1,4 +1,5 @@",
	" export const SessionRow = () => {",
	"-  return <Row />;",
	"+  const measured = true;",
	"+  return <Row measured={measured} />;",
	" };",
	`# turn ${e}`
].join("\n"), x = [
	"read",
	"grep",
	"bash",
	"todo_write",
	"edit",
	"apply_patch",
	"glob",
	"skill"
], S = (e, t, n) => {
	switch (n) {
		case "read": return {
			input: { filePath: `packages/ui/src/components/chat-ui/session-${t}.tsx` },
			output: { filePath: `packages/ui/src/components/chat-ui/session-${t}.tsx` }
		};
		case "grep": return {
			input: {
				pattern: "RichMessage|ToolInvocationTimeline|useStickToBottom",
				path: "packages/ui/src"
			},
			output: { stdout: y(e, t) }
		};
		case "bash": return {
			input: {
				cwd: `/tmp/${e}`,
				command: "bun run --cwd packages/ui test"
			},
			output: {
				stdout: "139 tests passed\nstorybook build complete\nchat perf fixture generated",
				exitCode: 0
			}
		};
		case "todo_write": return {
			input: { todos: [
				{
					content: "Collect frame timing baseline",
					status: "completed"
				},
				{
					content: "Inspect markdown parse cost",
					status: "in_progress"
				},
				{
					content: "Compare streaming chunk sizes",
					status: "pending"
				}
			] },
			output: { todos: [
				{
					content: "Collect frame timing baseline",
					status: "completed"
				},
				{
					content: "Inspect markdown parse cost",
					status: "completed"
				},
				{
					content: "Compare streaming chunk sizes",
					status: "pending"
				}
			] }
		};
		case "edit": return {
			input: {
				filePath: "packages/ui/src/components/chat-ui/chat-panel.tsx",
				old_string: "const merged = mergeReasoningToolOnlyMessages(messages);",
				new_string: "const merged = mergeReasoningToolOnlyMessages(messages);"
			},
			output: {
				oldString: "const grouped = groupMessagesByTurn(messages);",
				newString: "const grouped = groupMessagesByTurn(merged);"
			}
		};
		case "apply_patch": return {
			input: { diff: b(t) },
			output: { metadata: { files: [{ filePath: "packages/ui/src/components/chat-ui/session-row.tsx" }] } }
		};
		case "glob": return {
			input: { pattern: "packages/ui/src/components/chat-ui/**/*.tsx" },
			output: { stdout: "packages/ui/src/components/chat-ui/components/chat-panel.tsx\npackages/ui/src/components/chat-ui/components/message-parts-renderer.tsx\npackages/ui/src/components/chat-ui/components/tool-invocation-timeline.tsx" }
		};
		case "skill": return {
			input: { name: "performance-benchmarking" },
			output: { stdout: "<skill_content name=\"performance-benchmarking\">\nMeasure user-visible timing first, then correlate with React and browser traces.\n</skill_content>" }
		};
	}
}, C = (e, t, n) => {
	let r = x[(t + n) % x.length], i = S(e, t, r), a = r === "grep" || r === "glob" || r === "skill" ? "read" : "other";
	return {
		type: "tool",
		tool: r,
		callId: `${e}-tool-${t}-${n}`,
		actionType: r === "bash" ? "execute" : a,
		status: "completed",
		state: {
			status: "completed",
			...i
		}
	};
}, w = (e, t, n) => ({
	id: `${e}-user-${t}`,
	role: "user",
	index: t * 2,
	parts: [{
		type: "text",
		text: v(h, n, e, t)
	}]
}), T = (e) => {
	let { sessionId: t, turn: n, textRepeat: r, toolCallsPerTurn: i } = e;
	return {
		id: `${t}-assistant-${n}`,
		role: "assistant",
		index: n * 2 + 1,
		parts: [
			{
				type: "reasoning",
				text: v(g, Math.max(1, Math.ceil(r / 2)), t, n)
			},
			...Array.from({ length: i }, (e, r) => C(t, n, r)),
			{
				type: "text",
				text: v(g, r, t, n)
			},
			{
				type: "token_usage",
				inputTokens: 1e3 + n * 17,
				outputTokens: 500 + n * 11,
				cacheReadTokens: 250
			}
		]
	};
}, E = (e) => {
	let t = e.textRepeat ?? p, n = e.toolCallsPerTurn ?? m, r = [];
	for (let i = 0; i < e.turns; i += 1) r.push(w(e.sessionId, i, t)), r.push(T({
		sessionId: e.sessionId,
		turn: i,
		textRepeat: t,
		toolCallsPerTurn: n
	}));
	return r;
}, D = () => ({
	primarySession: {
		id: "perf-session-primary",
		label: "Primary session",
		messages: E({
			sessionId: "perf-primary",
			turns: 500,
			textRepeat: 2,
			toolCallsPerTurn: 3
		})
	},
	secondarySession: {
		id: "perf-session-secondary",
		label: "Secondary session",
		messages: E({
			sessionId: "perf-secondary",
			turns: 500,
			textRepeat: 2,
			toolCallsPerTurn: 4
		})
	}
}), O = (e) => e.type === "text", k = (e) => ({
	...e,
	parts: e.parts.map((e) => O(e) ? {
		...e,
		text: ""
	} : e)
}), A = (e, t, n, r) => e.map((e) => {
	if (e.id !== t) return e;
	let i = e.parts[n];
	if (!i || !O(i)) return e;
	let a = [...e.parts];
	return a[n] = {
		...i,
		text: r
	}, {
		...e,
		parts: a
	};
}), j = () => typeof window > "u" ? null : (window.__chatPanelMountMetrics ??= [], window.__chatPanelPendingMountMetrics ??= {}, {
	metrics: window.__chatPanelMountMetrics,
	pending: window.__chatPanelPendingMountMetrics
}), M = (e) => {
	e && typeof performance < "u" && performance.mark(e);
}, N = (e) => {
	let t = j(), n = typeof performance > "u" ? 0 : performance.now(), r = `${e.scenario}:${Math.round(n)}:${Math.random().toString(16).slice(2)}`;
	return t && (t.pending[r] = {
		scenario: e.scenario,
		label: e.label,
		messageCount: e.messageCount,
		startedAtMs: n
	}, M(e.startMarkName)), r;
}, P = (e) => {
	let t = () => {
		let t = j();
		if (!t) return;
		let n = t.pending[e.id];
		if (!n) return;
		let r = performance.now(), i = e.messageCount, a = r - n.startedAtMs;
		t.metrics.push({
			id: e.id,
			scenario: n.scenario,
			label: n.label,
			totalMs: a,
			messageCount: i,
			perMessageMs: i > 0 ? a / i : null,
			startedAtMs: n.startedAtMs,
			completedAtMs: r
		}), delete t.pending[e.id], M(e.readyMarkName);
	};
	typeof requestAnimationFrame > "u" ? t() : requestAnimationFrame(() => requestAnimationFrame(t));
}, F = (e) => typeof window > "u" ? null : window.__chatPanelMountMetrics?.filter((t) => t.scenario === e).at(-1) ?? null, I = () => typeof window > "u" ? null : (window.__chatPanelPerf ??= [], window.__chatPanelPerf), L = (t) => {
	if (typeof window > "u" || typeof performance > "u") return {
		latestMountMetric: null,
		framesPerSecond: null,
		averageFramesPerSecond: null,
		frameRateSamples: []
	};
	let n = e();
	return {
		latestMountMetric: F(t),
		framesPerSecond: n.framesPerSecond,
		averageFramesPerSecond: n.averageFramesPerSecond,
		frameRateSamples: n.frameRateSamples
	};
}, R = (e) => {
	let { scenario: i, messageCount: s } = e, [c, l] = o(() => L(i)), u = c.latestMountMetric;
	return a(() => {
		I(), n(), l(L(i));
		let e = window.setInterval(() => {
			l(L(i));
		}, 250);
		return () => window.clearInterval(e);
	}, [i]), /* @__PURE__ */ d(r, {
		subtitle: u?.label ?? "mount pending",
		badgeLabel: `${s} messages`,
		metrics: [{
			label: "Mount total",
			value: t(u?.totalMs ?? null)
		}, {
			label: "Mount / message",
			value: t(u?.perMessageMs ?? null)
		}],
		framesPerSecond: c.framesPerSecond,
		averageFramesPerSecond: c.averageFramesPerSecond,
		frameRateSamples: c.frameRateSamples,
		testId: "chat-perf-panel"
	});
}, z = {
	emptyStateTitle: "No messages",
	emptyStateDescription: "",
	chatInputPlaceholder: "Benchmark prompt"
}, B = {
	w: "100vw",
	h: "100vh",
	minH: "0",
	bg: "bg",
	display: "grid",
	gridTemplateRows: "auto minmax(0, 1fr)"
}, V = (e) => {
	if (typeof performance > "u") return;
	let t = () => performance.mark(e);
	typeof requestAnimationFrame > "u" ? t() : requestAnimationFrame(() => requestAnimationFrame(t));
}, H = () => new Promise((e) => {
	typeof requestAnimationFrame > "u" ? e() : requestAnimationFrame(() => e());
}), U = (e, t) => {
	let n = [];
	for (let r = 0; r < e.length; r += t) n.push(e.slice(r, r + t));
	return n;
}, W = (e) => e.parts.map((e, t) => ({
	part: e,
	partIndex: t
})).filter((e) => e.part.type === "text"), G = async (e) => {
	let { messageId: t, partIndex: n, text: r, isCancelled: i, updateText: a } = e, o = "";
	for (let e of U(r, 384)) {
		if (i()) return;
		o += e, a(t, n, o), await H();
	}
}, K = async (e) => {
	let { message: t, isCancelled: n, appendMessage: r, updateText: i } = e, a = W(t);
	if (a.length === 0) r(t), await H();
	else {
		r(k(t)), await H();
		for (let e of a) await G({
			messageId: t.id,
			partIndex: e.partIndex,
			text: e.part.text,
			isCancelled: n,
			updateText: i
		});
	}
}, q = async (e) => {
	for (let t of e.messages) {
		if (e.isCancelled()) return;
		await K({
			...e,
			message: t
		});
	}
};
function J(e) {
	let { measurement: t, messageCount: n } = e;
	return a(() => {
		t && n !== 0 && P({
			id: t.id,
			messageCount: n,
			readyMarkName: t.readyMarkName
		});
	}, [t, n]), null;
}
function Y(e) {
	let { scenario: t, activeLabel: n, messageCount: r, actions: a, children: o } = e;
	return /* @__PURE__ */ f(s, {
		...B,
		"data-testid": "chat-perf-shell",
		"data-scenario": t,
		children: [/* @__PURE__ */ f(c, {
			justify: "space-between",
			gap: "md",
			px: "md",
			py: "sm",
			borderBottomWidth: "1px",
			borderColor: "border",
			bg: "bg.subtle",
			children: [/* @__PURE__ */ f(c, {
				gap: "md",
				align: "center",
				flex: "1",
				minW: "0",
				children: [/* @__PURE__ */ f(l, {
					gap: "0",
					minW: "0",
					children: [/* @__PURE__ */ d(u, {
						textStyle: "label/S/medium",
						children: n
					}), /* @__PURE__ */ f(u, {
						textStyle: "label/XS/regular",
						color: "fg.muted",
						"data-testid": "chat-perf-message-count",
						children: [r, " messages"]
					})]
				}), a]
			}), /* @__PURE__ */ d(R, {
				scenario: t,
				messageCount: r
			})]
		}), /* @__PURE__ */ d(s, {
			minH: "0",
			p: "md",
			children: /* @__PURE__ */ d(i, {
				id: t,
				onRender: (e, t, n, r, i, a) => {
					I()?.push({
						scenario: e,
						phase: t,
						actualDuration: n,
						baseDuration: r,
						commitTime: a
					});
				},
				children: o
			})
		})]
	});
}
export { H as a, D as c, V as i, E as l, Y as n, q as o, z as r, N as s, J as t, A as u };
