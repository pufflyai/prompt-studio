// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./chevrons-down-up-Bpa99miB.ts";
import { t } from "./chevrons-up-down-DlTkvZ9f.ts";
import { t as n } from "./circle-check-QpR5K4qp.ts";
import { t as r } from "./message-circle-warning-BbjMz0mI.ts";
import { t as i } from "./trash-2-C03vrbuo.ts";
import { n as a, r as o } from "./mappers-07bJ6k9J.ts";
import { i as s } from "./seed-DSxmxcWD.ts";
import { n as c, t as l } from "./planner-Bje3Dhof.ts";
import { t as u } from "./workflow-statuses-BkOMtUf-.ts";
import { n as d } from "./timeline-presentation-D6H7HEWi.ts";
import { useEffect as f, useRef as p, useState as m } from "react";
import { Box as h, Editable as g, Flex as _, Icon as v, IconButton as y, Text as b, chakra as ee, useRecipe as x } from "@chakra-ui/react";
import { Tooltip as S, psTheme as te } from "@pstdio/ui";
import { jsx as C, jsxs as w } from "react/jsx-runtime";
// extensions/pstdio-planner/src/data/review-request-storage.ts
var T = (e) => e.errors.length > 0 || e.requests.some((e) => e.state === "open"), ne = {
	danger: "red.fg",
	warning: "orange.fg"
}, E = new Intl.DateTimeFormat(void 0, {
	weekday: "short",
	month: "short",
	day: "numeric",
	timeZone: "UTC"
}), D = (e) => E.format(/* @__PURE__ */ new Date(`${e}T00:00:00Z`));
function re(e, t) {
	return t ? "Complete" : e < 0 ? `${-e} ${-e === 1 ? "day" : "days"} late` : e === 0 ? "Due today" : `${e} ${e === 1 ? "day" : "days"} left`;
}
// extensions/pstdio-planner/src/timeline/model/days.ts
var O = 864e5, k = (e) => e.slice(0, 10), A = (e, t) => k(new Date(Date.parse(`${e}T00:00:00Z`) + t * O).toISOString()), j = (e, t) => Math.round((Date.parse(`${t}T00:00:00Z`) - Date.parse(`${e}T00:00:00Z`)) / O);
// extensions/pstdio-planner/src/timeline/model/milestone-eta.ts
function M(e, t) {
	let n = t.find((e) => a(e) === "complexity") ?? t.find(({ name: e }) => e.trim().toLowerCase() === "complexity"), r = new Map([...n?.options ?? []].sort((e, t) => e.sortOrder - t.sortOrder).map(({ id: e }, t) => [e, t + 1])), i = Math.ceil((r.size || 1) / 2), o = (e) => e.tagIds.map((e) => r.get(e)).find((e) => e !== void 0) ?? i, s = e.reduce((e, t) => e + o(t), 0);
	return {
		completedComplexity: e.filter(({ done: e }) => e).reduce((e, t) => e + o(t), 0),
		totalComplexity: s
	};
}
function ie(e, t, n, r) {
	let { completedComplexity: i } = M(e, t), a = new Set(e.map(({ id: e }) => e)), o = n.filter(({ ticketId: e }) => a.has(e)).map(({ createdAt: e }) => Date.parse(e)), s = Math.min(...o);
	return !i || !Number.isFinite(s) || r <= s ? null : {
		msPerComplexity: (r - s) / i,
		startedAt: new Date(s).toISOString()
	};
}
function ae(e, t, n) {
	if (!e.length) return null;
	let { completedComplexity: r, totalComplexity: i } = M(e, t), a = i - r;
	return a && !n ? null : {
		remainingMs: a * (n?.msPerComplexity ?? 0),
		completedComplexity: r,
		totalComplexity: i,
		startedAt: n?.startedAt ?? null
	};
}
// extensions/pstdio-planner/src/timeline/model/section-summary.ts
var oe = (e) => !e.done && e.flags.some((e) => e === "human-needed" || e === "blocked" || e === "waiting" || e === "out-of-order");
function N(e, t, n) {
	let { deadline: r, rows: i } = e;
	return {
		...e,
		counts: {
			total: i.length,
			done: i.filter((e) => e.done).length,
			humanNeeded: i.filter((e) => e.flags.includes("human-needed")).length,
			blocked: i.filter((e) => e.flags.includes("blocked")).length,
			atRisk: r ? i.filter(oe).length : 0
		},
		eta: r ? ae(i, t, n) : null
	};
}
// extensions/pstdio-planner/src/timeline/model/state.ts
function P(e, t, n = u()) {
	let r = e.statusId ?? "", i = n.activeStatusIds.includes(r);
	return n.completedStatusIds.includes(r) ? "done" : t.humanNeeded ? "await-input" : t.inputReceived && !i ? "input-received" : !t.unmet && (n.blockedStatusIds.includes(r) || e.blockedReason?.trim()) ? "blocked" : i ? "in-progress" : "not-started";
}
// extensions/pstdio-planner/src/timeline/model/build-plan.ts
var F = 7, I = (e, t) => t.workflow.completedStatusIds.includes(e.statusId ?? ""), L = (e, t) => ({
	id: e.id,
	shorthand: e.shorthand,
	done: I(e, t)
}), R = (e, t) => l(e.dependsOn).flatMap((e) => t.tickets.get(e) ?? []);
function z(e) {
	return [...e.deadlines.map(({ id: e }) => e), null].map((t) => ({
		deadline: e.deadlines.find(({ id: e }) => e === t),
		ticketIds: e.order.filter((e) => e.deadlineId === t).map(({ ticketId: e }) => e)
	}));
}
function B(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let t of e.tickets) for (let e of l(t.dependsOn)) n.set(e, [...n.get(e) ?? [], t]);
	return {
		workflow: e.workflow ?? u(),
		tickets: new Map(e.tickets.map((e) => [e.id, e])),
		statuses: new Map(e.statuses.map((e) => [e.id, e])),
		steps: new Map(t.flatMap(({ ticketIds: e }) => e).map((e, t) => [e, t + 1])),
		dependents: n,
		today: e.today,
		requests: e.requests ?? /* @__PURE__ */ new Map(),
		gates: e.gates ?? /* @__PURE__ */ new Set(),
		trackOptionIds: new Set(e.track?.options.map(({ id: e }) => e))
	};
}
var V = (e, t) => t.requests.get(e.id) ?? {
	requests: [],
	errors: []
}, H = (e, t) => T(V(e, t));
function U(e, t) {
	let n = [], r = /* @__PURE__ */ new Set([e.id]), i = e.parentId ? t.tickets.get(e.parentId) : void 0;
	for (; i && !r.has(i.id);) r.add(i.id), n.unshift(i), i = i.parentId ? t.tickets.get(i.parentId) : void 0;
	return n.map((e) => L(e, t));
}
function W(e, t, n, r) {
	if (I(e, r)) return [];
	let i = [], a = R(e, r).some((e) => !I(e, r));
	return t && t.date < r.today ? i.push("overdue") : t && j(r.today, t.date) <= F && i.push("due-soon"), H(e, r) ? i.push("human-needed") : !a && (r.workflow.blockedStatusIds.includes(e.statusId ?? "") || e.blockedReason?.trim()) && i.push("blocked"), a && i.push("waiting"), n.length > 0 && i.push("out-of-order"), i;
}
function G(e, t, n) {
	let r = n.steps.get(e.id) ?? 0, i = R(e, n), a = i.filter((e) => !I(e, n) && (n.steps.get(e.id) ?? 0) > r), s = I(e, n) ? void 0 : e.blockedReason?.trim() || void 0, { requests: l, errors: u } = V(e, n), d = W(e, t, a.map((e) => L(e, n)), n), f = d.includes("human-needed"), p = n.gates.has(e.id), m = n.statuses.get(e.statusId ?? "");
	return {
		id: e.id,
		shorthand: e.shorthand,
		title: e.title,
		state: P(e, {
			humanNeeded: f,
			inputReceived: !f && l.some((e) => e.state === "answered"),
			unmet: d.includes("waiting")
		}, n.workflow),
		trackId: o(e).find((e) => n.trackOptionIds.has(e)) ?? null,
		requests: l,
		requestErrors: u,
		instructions: e.content ?? "",
		status: m ? {
			id: m.id,
			name: m.name,
			icon: m.icon,
			color: m.color
		} : null,
		done: I(e, n),
		step: r,
		ancestors: U(e, n),
		...p ? { gate: !0 } : {},
		deadlineId: t?.id ?? null,
		dependsOn: i.map((e) => L(e, n)),
		blocks: (n.dependents.get(e.id) ?? []).filter((e) => !I(e, n)).map((e) => L(e, n)),
		laterDependencies: a.map((e) => L(e, n)),
		...s ? { blockedReason: s } : {},
		tagIds: o(e),
		flags: d,
		target: c(e)
	};
}
function K(e) {
	let t = z(e.plan), n = B({
		...e,
		tickets: s(e.tickets)
	}, t), r = t.map(({ deadline: t, ticketIds: r }) => {
		let i = r.flatMap((e) => {
			let r = n.tickets.get(e);
			return r ? [G(r, t, n)] : [];
		});
		return {
			deadline: t ? {
				...t,
				daysLeft: j(e.today, t.date)
			} : null,
			rows: i
		};
	}), i = ie(r.flatMap(({ rows: e }) => e), e.tags, e.attempts ?? [], e.now ?? Date.parse(`${e.today}T00:00:00Z`));
	return {
		pace: i,
		statuses: e.statuses,
		today: e.today,
		sections: r.map((t) => N(t, e.tags, i)),
		tags: e.tags,
		trackProperty: e.track
	};
}
// extensions/pstdio-planner/src/timeline/view/drag.ts
var q = (e, t) => e?.deadlineId === t.deadlineId && e?.beforeId === t.beforeId && e?.trackId === t.trackId;
// extensions/pstdio-planner/src/timeline/model/milestone-visibility.ts
function J(e, t) {
	return e.deadline ? t.showPassedMilestones === !1 && e.deadline.daysLeft < 0 ? !1 : t.showCompletedMilestones !== !1 || e.counts.total === 0 || e.counts.done !== e.counts.total : !0;
}
// extensions/pstdio-planner/src/timeline/model/filter.ts
function se(e, t, n = {}) {
	return e.sections.filter((e) => J(e, n)).flatMap((n) => {
		let r = n.rows.filter((e) => t.has(e.id));
		return n.rows.length > 0 && r.length === 0 ? [] : [N({
			...n,
			rows: r
		}, e.tags, e.pace)];
	});
}
var Y = (e) => e.counts.total > 0 && e.counts.done === e.counts.total;
// extensions/pstdio-planner/src/timeline/view/inline-edit.tsx
function X(e) {
	let { value: t, label: n, placeholder: r, color: i, onSave: a } = e, [o, s] = m(t);
	f(() => s(t), [t]);
	let c = (e) => {
		let n = e.trim();
		n === t ? s(t) : a(n).catch(() => s(t));
	};
	return /* @__PURE__ */ w(g.Root, {
		value: o,
		placeholder: r,
		activationMode: "click",
		submitMode: "both",
		size: "sm",
		minW: "0",
		w: "auto",
		textStyle: "label/S/medium",
		color: i,
		onValueChange: (e) => s(e.value),
		onValueCommit: (e) => c(e.value),
		onValueRevert: () => s(t),
		children: [/* @__PURE__ */ C(g.Preview, {
			"aria-label": `Edit ${n}`,
			truncate: !0,
			minW: "0",
			px: "2xs",
			cursor: "text"
		}), /* @__PURE__ */ C(g.Input, {
			"aria-label": n,
			px: "2xs",
			minW: "12ch"
		})]
	});
}
function ce(e) {
	let { value: t, display: n, label: r, color: i, onSave: a } = e, [o, s] = m(), c = p(!1);
	if (o === void 0) return /* @__PURE__ */ C(b, {
		as: "button",
		"aria-label": `Change ${r}`,
		textStyle: "label/S/medium",
		color: i,
		whiteSpace: "nowrap",
		cursor: "text",
		onClick: () => {
			c.current = !0, s(t);
		},
		children: n
	});
	let l = (e) => {
		c.current && (c.current = !1, s(void 0), e && /^\d{4}-\d{2}-\d{2}$/.test(o) && o !== t && a(o));
	};
	return /* @__PURE__ */ C(ee.input, {
		type: "date",
		autoFocus: !0,
		"aria-label": r,
		value: o,
		w: "112px",
		textStyle: "label/XS/regular",
		bg: "bg",
		borderWidth: "1px",
		borderColor: "border",
		borderRadius: "sm",
		onChange: (e) => s(e.currentTarget.value),
		onBlur: () => l(!0),
		onKeyDown: (e) => {
			(e.key === "Enter" || e.key === "Escape") && (e.preventDefault(), l(e.key === "Enter"));
		}
	});
}
// extensions/pstdio-planner/src/timeline/view/milestone-eta.tsx
function le(e) {
	if (!e) return "ETA —";
	if (!e.remainingMs) return "Done";
	let t = Math.ceil(e.remainingMs / 6e4);
	if (t < 60) return `ETA ~${t}m`;
	let n = Math.ceil(t / 60);
	return n < 24 ? `ETA ~${n}h` : `ETA ~${Math.ceil(n / 24)}d`;
}
function ue(e) {
	let { eta: t } = e, n = "An estimate needs a completed ticket and a recorded work start in the project.";
	return t && (n = `${t.completedComplexity} of ${t.totalComplexity} complexity points complete.`, t.startedAt && t.remainingMs && (n += ` Estimated time remaining for matching milestone tickets at the project's pace since ${new Date(t.startedAt).toLocaleString()}. Includes time spent waiting.`)), /* @__PURE__ */ C(S, {
		content: n,
		children: /* @__PURE__ */ C(b, {
			tabIndex: 0,
			"aria-label": "Milestone estimate",
			textStyle: "label/XS/medium",
			color: "fg.muted",
			whiteSpace: "nowrap",
			flexShrink: "0",
			children: le(t)
		})
	});
}
// extensions/pstdio-planner/src/timeline/view/section-header.tsx
function de(e) {
	let { entry: t } = e, { done: n, total: r } = t.section.counts;
	return /* @__PURE__ */ C(S, {
		content: `${n} of ${r} tickets done`,
		children: /* @__PURE__ */ C(h, {
			role: "progressbar",
			"aria-label": "Milestone progress",
			"aria-valuemin": 0,
			"aria-valuemax": r || 1,
			"aria-valuenow": n,
			"aria-valuetext": `${n} of ${r} tickets done`,
			tabIndex: 0,
			w: "64px",
			h: "4px",
			bg: "bg.emphasized",
			borderRadius: "0",
			overflow: "hidden",
			flexShrink: "0",
			children: /* @__PURE__ */ C(h, {
				w: `${r ? n / r * 100 : 0}%`,
				h: "full",
				bg: "green.fg",
				borderRadius: "0"
			})
		})
	});
}
function fe(e) {
	let { deadlineId: t, label: n, onDelete: r } = e, a = x({ recipe: te.getRecipe("button") }), [o, s] = m(!1);
	return /* @__PURE__ */ C(S, {
		content: o ? "Click again to delete; its tickets become unscheduled" : "Delete milestone",
		children: /* @__PURE__ */ C(y, {
			size: "2xs",
			css: a({
				variant: "destructive-ghost",
				size: "2xs"
			}),
			"aria-label": o ? `Confirm deleting ${n}` : `Delete ${n}`,
			onBlur: () => s(!1),
			onMouseLeave: () => s(!1),
			onClick: () => o ? r(t) : s(!0),
			children: /* @__PURE__ */ C(v, { as: i })
		})
	});
}
function pe(i) {
	let { entry: a, onToggle: o, onDelete: s, onRenameDeadline: c, onReview: l } = i, { deadline: u, counts: d } = a.section, f = Y(a.section), p = u ? u.name ?? D(u.date) : "Unscheduled";
	return /* @__PURE__ */ w(_, {
		align: "center",
		gap: "xs",
		h: "full",
		minW: "0",
		pr: "sm",
		bg: "bg",
		children: [
			/* @__PURE__ */ C(S, {
				content: `${a.collapsed ? "Expand" : "Collapse"} ${p}`,
				children: /* @__PURE__ */ C(y, {
					size: "2xs",
					variant: "ghost",
					color: "fg.subtle",
					"aria-label": `${a.collapsed ? "Expand" : "Collapse"} ${p}`,
					onClick: () => o(u?.id ?? null),
					children: /* @__PURE__ */ C(v, { as: a.collapsed ? t : e })
				})
			}),
			u ? /* @__PURE__ */ C(X, {
				value: u.name ?? "",
				placeholder: D(u.date),
				label: `${p} milestone name`,
				color: "fg.muted",
				onSave: (e) => c(u.id, e)
			}) : /* @__PURE__ */ C(b, {
				textStyle: "label/S/medium",
				color: "fg.muted",
				px: "2xs",
				children: "Unscheduled"
			}),
			d.humanNeeded > 0 ? /* @__PURE__ */ C(S, {
				content: `${d.humanNeeded} tickets need attention · open them`,
				children: /* @__PURE__ */ w(y, {
					size: "2xs",
					variant: "ghost",
					color: "orange.fg",
					"aria-label": `Open ${d.humanNeeded} tickets needing attention in ${p}`,
					onClick: () => l(u?.id ?? null),
					children: [/* @__PURE__ */ C(v, { as: r }), /* @__PURE__ */ C(b, {
						textStyle: "label/XS/medium",
						children: d.humanNeeded
					})]
				})
			}) : null,
			f ? /* @__PURE__ */ C(S, {
				content: "Milestone complete",
				children: /* @__PURE__ */ C(h, {
					role: "img",
					"aria-label": "Milestone complete",
					tabIndex: 0,
					display: "flex",
					color: "green.fg",
					children: /* @__PURE__ */ C(v, {
						as: n,
						boxSize: "15px"
					})
				})
			}) : null,
			/* @__PURE__ */ C(h, {
				flex: "1",
				minW: "16px",
				h: "1px",
				bg: "border",
				mx: "xs"
			}),
			u ? /* @__PURE__ */ C(ue, { eta: a.section.eta }) : null,
			/* @__PURE__ */ C(de, { entry: a }),
			u ? /* @__PURE__ */ C(fe, {
				deadlineId: u.id,
				label: p,
				onDelete: s
			}) : null
		]
	});
}
// extensions/pstdio-planner/src/timeline/view/plan-state.ts
function me(e, t) {
	let n = /* @__PURE__ */ new Map(), r = new Map(t?.sections.flatMap(({ rows: e }) => e).map((e) => [e.id, e])), i = (e, t, i) => {
		let a = [...r.get(e)?.[t] ?? []], o = /* @__PURE__ */ new Set([e]);
		for (; a.length;) {
			let e = a.pop();
			e && !o.has(e.id) && (o.add(e.id), n.set(e.id, i), a.push(...r.get(e.id)?.[t] ?? []));
		}
	};
	return e && (i(e.id, "dependsOn", "needed-first"), i(e.id, "blocks", "waits-on-selected"), n.set(e.id, "selected")), n;
}
function he(e) {
	let [t, n] = m(), [r, i] = m();
	return f(() => {
		let e = () => {
			n(void 0), i(void 0);
		};
		return document.addEventListener("dragend", e), () => document.removeEventListener("dragend", e);
	}, []), {
		dragId: t,
		dropTarget: t && r?.beforeId !== t ? r : void 0,
		setDragId: n,
		setDropTarget: (e) => i((t) => q(t, e) ? t : e),
		drop: async () => {
			let a = r;
			if (n(void 0), i(void 0), t && a && a.beforeId !== t) try {
				a.trackId !== void 0 && await e.commands["timeline.track.assign"]({
					ticket: t,
					track: a.trackId ?? "none"
				}), await e.commands["timeline.plan.move"]({
					ticket: t,
					deadline: a.deadlineId ?? "none",
					before: a.beforeId
				});
			} catch {}
		}
	};
}
function ge(e, t) {
	let { value: n, toggle: r } = d(), i = new Set(n.collapsedMilestones);
	return {
		shown: e?.sections.filter((e) => J(e, n)) ?? [],
		sections: (e ? se(e, t, n) : []).map((e) => ({
			section: e,
			rows: e.rows,
			collapsed: i.has(e.deadline?.id ?? "none")
		})),
		toggle: (e) => r("collapsedMilestones", e ?? "none")
	};
}
// extensions/pstdio-planner/src/timeline/model/tracks.ts
var Z = {
	id: "unassigned",
	label: "Unassigned"
}, Q = (e) => e.options.map(({ id: e, name: t }) => ({
	id: e,
	label: t
}));
function $(e) {
	return {
		list: e,
		indexOf: (t) => Math.max(0, e.findIndex(({ id: e }) => e === (t.trackId ?? Z.id)))
	};
}
function _e(e, t) {
	let n = e ? Q(e) : [];
	return (!n.length || t.some(({ trackId: e }) => !n.some(({ id: t }) => t === e))) && n.push(Z), $(n);
}
export { D as _, me as a, pe as c, Y as d, q as f, re as g, j as h, Z as i, ce as l, A as m, $ as n, he as o, K as p, Q as r, ge as s, _e as t, X as u, ne as v };
