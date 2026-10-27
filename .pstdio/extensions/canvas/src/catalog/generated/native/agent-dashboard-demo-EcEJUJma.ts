// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./arrow-down-xxNhKH5c.ts";
import { t } from "./check-Bgh538vW.ts";
import { t as n } from "./circle-dashed-B1ik78oL.ts";
import { t as r } from "./clock-3-9usms91c.ts";
import { t as i } from "./play-crlvkPMv.ts";
import { t as a } from "./plus-CYkLGSPS.ts";
import { t as o } from "./rotate-ccw-YxjlnQSJ.ts";
import { i as s, o as c, r as l, s as u } from "./use-landing-styles-CQWLl3TI.ts";
import { t as d } from "./use-demo-cli-BF9LFxZh.ts";
import { i as f, t as p } from "./demo-workbench-CNySDkwL.ts";
import { useEffect as m, useState as h } from "react";
import { Badge as g, Box as _, Button as v, Code as y, HStack as b, Stack as x, Text as S } from "@chakra-ui/react";
import { SessionIndicator as C } from "@pstdio/ui";
import { Fragment as w, jsx as T, jsxs as E } from "react/jsx-runtime";
import { KanbanRendererBoard as D } from "@pstdio/ui/kanban-renderer";
// clients/landing-page/src/content/agent-board-content.ts
var O = [
	{
		id: "queued",
		label: "Queued",
		color: "gray"
	},
	{
		id: "running",
		label: "In progress",
		color: "blue"
	},
	{
		id: "review",
		label: "Ready for review",
		color: "green"
	}
], k = [
	"coding",
	"saving",
	"finished",
	"hook",
	"reviewing",
	"ready"
], A = [
	{
		id: "TOOL-18",
		title: "Add a color picker to the shader editor",
		agent: "Codex",
		stage: "queued"
	},
	{
		id: "TOOL-19",
		title: "Compare two savings scenarios",
		agent: "Claude Code",
		stage: "queued"
	},
	{
		id: "TOOL-16",
		title: "Use the icon set in the shader preview",
		agent: "Codex",
		stage: "coding"
	},
	{
		id: "TOOL-17",
		title: "Add a loan repayment command",
		agent: "OpenCode",
		stage: "saving"
	},
	{
		id: "TOOL-14",
		title: "Export icons as SVG",
		agent: "Claude Code",
		stage: "ready"
	},
	{
		id: "TOOL-15",
		title: "Plot compound growth over time",
		agent: "Codex",
		stage: "ready"
	}
], j = {
	queued: "Waiting to start",
	coding: "Building the change",
	saving: "Saving files and checking the result",
	finished: "Session completed",
	hook: "Hook triggered",
	reviewing: "Review session running",
	ready: "Review complete"
}, M = (e) => e === "queued" ? "queued" : [
	"hook",
	"reviewing",
	"ready"
].includes(e) ? "review" : "running", N = (e, t) => e !== "queued" && k.indexOf(e) >= k.indexOf(t), P = (e) => e !== "queued" && e !== "ready", F = (e) => e.agent === "Claude Code" ? "Codex" : "Claude Code", I = () => {
	let [e, t] = h(A), [n, r] = h("TOOL-16"), [i, a] = h(!0), [o, s] = h(!1), c = d("agents", (e) => {
		r(e.id), t((t) => t.map((t) => t.id === e.id ? {
			...t,
			stage: "coding"
		} : t)), a(!0);
	}), l = e.some((e) => P(e.stage));
	m(() => {
		let e = window.matchMedia("(prefers-reduced-motion: reduce)"), t = () => {
			e.matches && a(!1);
		};
		t(), e.addEventListener("change", t);
		let n = new IntersectionObserver(([e]) => s(e.isIntersecting));
		return n.observe(c.current), () => {
			n.disconnect(), e.removeEventListener("change", t);
		};
	}, [c]), m(() => {
		if (!i || !o || !l) return;
		let e = window.setInterval(() => {
			document.hidden || t((e) => e.map((e) => e.stage === "queued" || e.stage === "ready" ? e : {
				...e,
				stage: k[k.indexOf(e.stage) + 1]
			}));
		}, 2200);
		return () => window.clearInterval(e);
	}, [
		l,
		i,
		o
	]);
	let u = (e, n) => t((t) => t.map((t) => t.id === e ? {
		...t,
		stage: n
	} : t));
	return {
		hostRef: c,
		tasks: e,
		selected: e.find((e) => e.id === n),
		selectedId: n,
		playing: i,
		active: l,
		select: r,
		replay: () => {
			t(A), r("TOOL-16"), a(!0);
		},
		start: () => {
			u(n, "coding"), a(!0);
		},
		finish: () => {
			u(n, "finished"), a(!0);
		}
	};
}, L = {
	queued: "Queued",
	in_progress: "Running",
	completed: "Done",
	disconnected: "Paused"
}, R = (e) => {
	let { task: t, playing: n } = e, r = s(), i = N(t.stage, "finished"), a = n ? "in_progress" : "disconnected";
	t.stage === "queued" && (a = "queued"), i && (a = "completed");
	let o = N(t.stage, "reviewing"), c = "queued";
	return o && (c = n ? "in_progress" : "disconnected"), t.stage === "ready" && (c = "completed"), /* @__PURE__ */ E(x, {
		gap: "xs",
		width: "full",
		"aria-label": `Sessions for ${t.id}`,
		children: [/* @__PURE__ */ E(b, {
			css: r.sessionStatus,
			"data-status": a,
			children: [
				/* @__PURE__ */ T(C, {
					status: a,
					boxSize: "icon-sm"
				}),
				/* @__PURE__ */ E(S, {
					textStyle: "label/XS/regular",
					children: [t.agent, " · Build"]
				}),
				/* @__PURE__ */ T(S, {
					textStyle: "label/XS/regular",
					color: "fg.muted",
					children: L[a]
				})
			]
		}), N(t.stage, "hook") && /* @__PURE__ */ E(b, {
			css: r.sessionStatus,
			"data-status": c,
			children: [/* @__PURE__ */ T(C, {
				status: c,
				boxSize: "icon-sm"
			}), /* @__PURE__ */ E(S, {
				textStyle: "label/XS/regular",
				children: [F(t), " · Review"]
			})]
		})]
	});
}, z = (r) => {
	let { task: a, playing: o, highlighted: s, onStart: c, onFinish: u } = r, d = l(), m = N(a.stage, "hook");
	return /* @__PURE__ */ E(_, {
		css: d.panels,
		children: [/* @__PURE__ */ E(p, {
			title: `${a.id} · Agent sessions`,
			kind: "page",
			highlighted: s,
			children: [
				/* @__PURE__ */ T(S, {
					textStyle: "label/M/medium",
					children: a.title
				}),
				/* @__PURE__ */ T(R, {
					task: a,
					playing: o
				}),
				/* @__PURE__ */ T(S, {
					role: "status",
					textStyle: "paragraph/S/regular",
					color: "fg.muted",
					children: j[a.stage]
				}),
				(a.stage === "queued" || a.stage === "ready") && /* @__PURE__ */ E(v, {
					variant: "subtle",
					alignSelf: "start",
					onClick: c,
					children: [/* @__PURE__ */ T(i, {}), "Start session"]
				}),
				(a.stage === "coding" || a.stage === "saving") && /* @__PURE__ */ E(v, {
					variant: "subtle",
					alignSelf: "start",
					onClick: u,
					children: [/* @__PURE__ */ T(t, {}), "Complete session"]
				})
			]
		}), /* @__PURE__ */ E(p, {
			title: "When a session completes",
			kind: "hook",
			highlighted: s,
			children: [
				/* @__PURE__ */ E(b, {
					gap: "sm",
					children: [
						/* @__PURE__ */ T(f, { kind: "hook" }),
						/* @__PURE__ */ T(S, {
							textStyle: "mono/XS",
							children: "session.completed"
						}),
						/* @__PURE__ */ T(S, {
							textStyle: "label/S/regular",
							color: m ? "fg.success" : "fg.muted",
							children: m ? "Triggered" : "Listening"
						})
					]
				}),
				/* @__PURE__ */ T(e, { size: 16 }),
				/* @__PURE__ */ E(x, {
					gap: "md",
					"aria-label": "Hook actions",
					children: [/* @__PURE__ */ E(b, {
						gap: "sm",
						children: [T(m ? t : n, { size: 16 }), /* @__PURE__ */ E(S, {
							textStyle: "paragraph/S/regular",
							children: [
								"Move ",
								a.id,
								" to Ready for review"
							]
						})]
					}), /* @__PURE__ */ E(b, {
						gap: "sm",
						children: [N(a.stage, "reviewing") ? /* @__PURE__ */ T(t, { size: 16 }) : /* @__PURE__ */ T(n, { size: 16 }), /* @__PURE__ */ E(S, {
							textStyle: "paragraph/S/regular",
							children: [
								"Start a ",
								F(a),
								" review session"
							]
						})]
					})]
				})
			]
		})]
	});
}, B = [
	{
		kind: "command",
		title: "Ticket commands",
		description: "Actions you or your agent can run to keep the board up to date.",
		examples: [
			{
				title: "Create a ticket",
				detail: "Add a title, describe the work, and choose an initial status.",
				code: "pst tickets create --content \"# Add a color picker\" --status \"Queued\""
			},
			{
				title: "Update ticket status",
				detail: "Move a ticket to In progress when work starts, then Ready for review when the change is ready.",
				code: "pst tickets update --id TOOL-16 --status \"Ready for review\""
			},
			{
				title: "List tickets",
				detail: "Find the next ticket to work on or see which changes need review.",
				code: "pst tickets list --status \"Queued\""
			}
		]
	},
	{
		kind: "skill",
		title: "Agent skills",
		description: "Reusable instructions that teach agents how to handle your tickets.",
		examples: [{
			title: "Implement a ticket",
			detail: "Read the ticket and related code. Set the ticket to In progress, make the change, run the checks, and record the result before moving it to Ready for review."
		}, {
			title: "Review a change",
			detail: "Compare the change with the ticket requirements. Check the tests and edge cases, then add findings and update the ticket status."
		}]
	},
	{
		kind: "automation",
		title: "Scheduled work",
		description: "Run the same workflow at a time you choose.",
		examples: [{
			title: "Pick up queued tickets · Every weekday at 09:00",
			detail: "List queued tickets, choose the next unblocked ticket, and start an agent with the Implement a ticket skill."
		}, {
			title: "Prepare a review summary · Every weekday at 16:00",
			detail: "List tickets ready for review and summarize their changes, checks, and open questions."
		}]
	}
], V = (e) => {
	let { highlighted: t } = e, n = B.find((e) => e.kind === t);
	return /* @__PURE__ */ E(p, {
		title: n.title,
		kind: n.kind,
		highlighted: t,
		children: [/* @__PURE__ */ T(S, {
			textStyle: "paragraph/S/regular",
			color: "fg.muted",
			children: n.description
		}), n.examples.map((e) => /* @__PURE__ */ E(x, {
			gap: "sm",
			children: [
				/* @__PURE__ */ T(S, {
					as: "h2",
					textStyle: "label/M/medium",
					children: e.title
				}),
				/* @__PURE__ */ T(S, {
					textStyle: "paragraph/S/regular",
					children: e.detail
				}),
				"code" in e && /* @__PURE__ */ T(y, {
					whiteSpace: "pre-wrap",
					overflowWrap: "anywhere",
					children: e.code
				})
			]
		}, e.title))]
	}, n.kind);
}, H = (e) => {
	let { highlighted: t } = e, n = I(), i = u(), l = s(), d = O.map((e) => ({
		...e,
		canCreate: !1,
		actions: [],
		items: n.tasks.filter((t) => M(t.stage) === e.id).map((e) => ({
			id: e.id,
			cardProps: {
				eyebrow: e.id,
				title: e.title,
				onClick: () => n.select(e.id),
				customSlots: [/* @__PURE__ */ T(c, {
					kind: "skill",
					children: /* @__PURE__ */ T(_, {
						"data-demo-part": "skill",
						children: /* @__PURE__ */ T(R, {
							task: e,
							playing: n.playing
						})
					})
				}, "sessions"), /* @__PURE__ */ E(b, {
					gap: "xs",
					flexWrap: "wrap",
					children: [/* @__PURE__ */ T(v, {
						variant: "ghost",
						size: "2xs",
						"aria-label": `Open sessions for ${e.id}`,
						"data-agent-control": "session",
						onClick: () => n.select(e.id),
						children: "Sessions"
					}), /* @__PURE__ */ T(c, {
						kind: "hook",
						children: N(e.stage, "hook") && /* @__PURE__ */ T(g, {
							colorPalette: "green",
							"data-demo-part": "hook",
							children: "Hook fired"
						})
					})]
				}, "actions")]
			}
		}))
	}));
	return /* @__PURE__ */ T(x, {
		ref: n.hostRef,
		gap: "panel-gap",
		role: "group",
		"aria-label": "Coding agent workflow",
		children: t === "command" || t === "skill" || t === "automation" ? /* @__PURE__ */ T(V, { highlighted: t }) : /* @__PURE__ */ E(w, { children: [/* @__PURE__ */ E(p, {
			title: "Tool development",
			kind: "page",
			highlighted: t,
			children: [
				/* @__PURE__ */ E(b, {
					justify: "space-between",
					gap: "sm",
					flexWrap: "wrap",
					children: [
						/* @__PURE__ */ E(S, {
							textStyle: "label/M/medium",
							children: [n.tasks.length, " tickets · Agent sessions"]
						}),
						i ? /* @__PURE__ */ T(c, {
							kind: "command",
							children: /* @__PURE__ */ E(v, {
								variant: "outline",
								size: "xs",
								"data-demo-part": "command",
								children: [/* @__PURE__ */ T(a, {}), "Create ticket"]
							})
						}) : null,
						!i && !n.active && /* @__PURE__ */ E(v, {
							variant: "outline",
							onClick: n.replay,
							children: [/* @__PURE__ */ T(o, {}), "Replay workflow"]
						})
					]
				}),
				i && /* @__PURE__ */ T(c, {
					kind: "automation",
					children: /* @__PURE__ */ E(b, {
						textStyle: "label/XS",
						color: "fg.muted",
						"data-demo-part": "automation",
						children: [/* @__PURE__ */ T(r, { size: 14 }), "09:00 · Pick up queued tickets"]
					})
				}),
				i && /* @__PURE__ */ T(c, {
					kind: "hook",
					children: /* @__PURE__ */ T(g, {
						alignSelf: "start",
						colorPalette: "green",
						"data-demo-part": "hook",
						children: "session.completed → Ready for review"
					})
				}),
				/* @__PURE__ */ T(_, {
					css: l.agentBoard,
					role: "group",
					"aria-label": "Coding agent kanban board",
					children: /* @__PURE__ */ T(D, {
						columns: d,
						selectedItemId: n.selectedId
					})
				})
			]
		}), !i && /* @__PURE__ */ T(z, {
			task: n.selected,
			playing: n.playing,
			highlighted: t,
			onStart: n.start,
			onFinish: n.finish
		})] })
	});
};
export { H as AgentDashboardDemo };
