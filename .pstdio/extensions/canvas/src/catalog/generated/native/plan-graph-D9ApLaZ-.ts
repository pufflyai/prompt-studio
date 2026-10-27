// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./chevron-right-CRFNEcZT.ts";
import { n as t, t as n } from "./chevrons-right-left-Cdgz6T4J.ts";
import { t as r } from "./minus-BdT0RA0-.ts";
import { t as i } from "./plus-CYkLGSPS.ts";
import { _ as a, c as o, d as s, f as c, g as l, h as u, l as d, m as f, u as p, v as m } from "./tracks-EnwyuZ-9.ts";
import { a as h, i as g, n as _, r as v, t as y } from "./graph-card-CCSH6w7n.ts";
import { n as b } from "./timeline-presentation-D6H7HEWi.ts";
import { useEffect as x, useEffectEvent as S, useLayoutEffect as C, useRef as w, useState as T } from "react";
import { Box as E, Button as D, Flex as O, Icon as k, IconButton as A, Text as j, chakra as M } from "@chakra-ui/react";
import { Tooltip as N } from "@pstdio/ui";
import { Fragment as P, jsx as F, jsxs as I } from "react/jsx-runtime";
// extensions/pstdio-planner/src/timeline/model/dependency-order.ts
function L(e, t, n) {
	let r = new Set(e.map(t)), i = /* @__PURE__ */ new Set(), a = [...e], o = [];
	for (; a.length > 0;) {
		let e = a.findIndex((e) => n(e).every((n) => !r.has(n) || i.has(n) || n === t(e))), [s] = a.splice(Math.max(e, 0), 1);
		i.add(t(s)), o.push(s);
	}
	return o;
}
// extensions/pstdio-planner/src/timeline/model/graph-layout.ts
var R = (e, t) => `${e}:${t}`, z = (e, t, n, r) => !e.taken.get(R(t, n))?.has(r);
function B(e, t, n, r) {
	if (r !== void 0 && z(e, t, n, r)) return r;
	let i = 0;
	for (; !z(e, t, n, i);) i += 1;
	return i;
}
function ee(e, t, n, r) {
	let i = t.dependsOn.flatMap(({ id: t }) => e.placed.get(t) ?? []), a = i.find((e) => e.track === n)?.lane, o = Math.max(r, ...i.map((e) => e.row + 1)), s = B(e, n, o, a), c = {
		id: t.id,
		track: n,
		row: o,
		lane: s
	};
	return e.placed.set(t.id, c), e.taken.set(R(n, o), /* @__PURE__ */ new Set([...e.taken.get(R(n, o)) ?? [], s])), c;
}
function te(e, t) {
	let n = {
		placed: /* @__PURE__ */ new Map(),
		taken: /* @__PURE__ */ new Map()
	}, r = [], i = [], a = 0;
	for (let o of e) {
		let e = /* @__PURE__ */ new Map(), s = o.rows.filter((e) => !t.collapsedTracks?.has(t.trackOf(e)));
		for (let i of o.collapsed ? [] : L(s, ({ id: e }) => e, ({ dependsOn: e }) => e.map(({ id: e }) => e))) {
			let o = t.trackOf(i), s = ee(n, i, o, e.get(o) ?? a);
			r.push(s), e.set(o, s.row);
		}
		let c = e.size ? Math.max(...e.values()) - a + 1 : 0;
		i.push({
			deadlineId: o.deadlineId,
			startRow: a,
			rowCount: c,
			collapsed: !!o.collapsed
		}), a += c;
	}
	return {
		nodes: r,
		bands: i,
		trackLanes: Array.from({ length: t.tracks }, (e, n) => t.collapsedTracks?.has(n) ? 0 : Math.max(1, ...r.filter((e) => e.track === n).map(({ lane: e }) => e + 1)))
	};
}
// extensions/pstdio-planner/src/timeline/view/drop-region.ts
function ne(e, t, n, r) {
	if (!n) return;
	let i = e.bands.find((e) => e.deadlineId === n.deadlineId), a = n.trackId === void 0 ? r : n.trackId, o = a === null ? "unassigned" : a, s = e.tracks[t.indexOf(o ?? "")];
	return i ? {
		band: i,
		track: s,
		trackId: o
	} : void 0;
}
// extensions/pstdio-planner/src/timeline/view/drop-highlight.tsx
function re(e) {
	let { region: t, width: n, height: r } = e;
	if (!t) return null;
	let { band: i, track: a, trackId: o } = t;
	return /* @__PURE__ */ I(E, {
		position: "absolute",
		inset: "0",
		pointerEvents: "none",
		zIndex: "2",
		"aria-hidden": "true",
		children: [/* @__PURE__ */ F(E, {
			"data-drop-milestone": i.deadlineId ?? "unassigned",
			position: "absolute",
			left: "72px",
			top: `${i.top}px`,
			w: `${n - 72}px`,
			h: `${i.height}px`,
			bg: "bg.accent-subtle/50"
		}), a ? /* @__PURE__ */ I(P, { children: [/* @__PURE__ */ F(E, {
			"data-drop-track": o,
			position: "absolute",
			left: `${a.x}px`,
			top: "0",
			w: `${a.width}px`,
			h: `${r}px`,
			bg: "bg.accent-subtle/50"
		}), /* @__PURE__ */ F(E, {
			"data-drop-cell": !0,
			position: "absolute",
			left: `${a.x}px`,
			top: `${i.bodyTop}px`,
			w: `${a.width}px`,
			h: `${i.top + i.height - i.bodyTop}px`,
			bg: "bg.accent-subtle"
		})] }) : null]
	});
}
// extensions/pstdio-planner/src/timeline/view/graph-band.tsx
function ie(e, t) {
	return t ? "fg.muted" : e.daysLeft === 0 ? "orange.fg" : e.daysLeft < 0 ? "red.fg" : "fg.muted";
}
function ae(e) {
	let { deadline: t, complete: n, over: r, onDrop: i, onRedate: o } = e, s = ie(t, n);
	return /* @__PURE__ */ I(O, {
		position: "sticky",
		left: "0",
		top: "32px",
		zIndex: _.date,
		flexShrink: "0",
		w: "72px",
		h: "42px",
		bg: "bg",
		align: "center",
		onDragOver: (e) => {
			e.preventDefault(), e.stopPropagation(), r({ deadlineId: t.id });
		},
		onDrop: (e) => {
			e.preventDefault(), e.stopPropagation(), i();
		},
		children: [/* @__PURE__ */ F(N, {
			content: `${t.date} · ${l(t.daysLeft, n)}`,
			children: /* @__PURE__ */ F(E, {
				w: "48px",
				textAlign: "right",
				pr: "2xs",
				children: /* @__PURE__ */ F(d, {
					value: t.date,
					display: a(t.date).split(", ").pop() ?? t.date,
					label: `${t.name ?? t.date} date`,
					color: s,
					onSave: (e) => o(t.id, e)
				})
			})
		}), /* @__PURE__ */ F(E, {
			"aria-hidden": "true",
			position: "absolute",
			left: "58px",
			top: "50%",
			transform: "translate(-50%, -50%)",
			boxSize: "12px",
			borderRadius: "full",
			borderWidth: "2px",
			borderColor: "bg",
			bg: n ? "green.fg" : s
		})]
	});
}
function oe(e) {
	let { band: t, entry: n, viewWidth: r, contentLeft: i, headerLeft: a, zoom: l, dropTarget: u, over: d, trackAt: f, ...p } = e, m = n.section.deadline;
	return /* @__PURE__ */ I(E, {
		position: "absolute",
		left: "0",
		right: "8px",
		top: `${t.top}px`,
		h: `${t.height}px`,
		onDragOver: (e) => {
			e.preventDefault();
			let n = (e.clientX - (e.currentTarget.parentElement?.getBoundingClientRect().left ?? 0)) / l, r = {
				deadlineId: t.deadlineId,
				trackId: f(n)
			};
			c(u, r) || d(r);
		},
		onDrop: (e) => {
			e.preventDefault(), p.onDrop();
		},
		children: [
			m ? /* @__PURE__ */ F(ae, {
				deadline: m,
				complete: s(n.section),
				over: d,
				onDrop: p.onDrop,
				onRedate: p.onRedate
			}) : null,
			/* @__PURE__ */ I(O, {
				position: "sticky",
				top: "32px",
				zIndex: _.milestone,
				h: "42px",
				mt: m ? "-42px" : void 0,
				children: [
					/* @__PURE__ */ F(E, {
						flexShrink: "0",
						w: "72px",
						pointerEvents: "none"
					}),
					/* @__PURE__ */ F(E, {
						flexShrink: "0",
						w: `${i - 72}px`,
						pointerEvents: "none"
					}),
					/* @__PURE__ */ F(E, {
						position: "sticky",
						left: "72px",
						flexShrink: "0",
						w: `${Math.max(320, r - a - 8)}px`,
						minW: "0",
						children: /* @__PURE__ */ F(o, {
							entry: n,
							onToggle: p.onToggle,
							onDelete: p.onDelete,
							onRenameDeadline: p.onRenameDeadline,
							onReview: p.onReview
						})
					})
				]
			}),
			t.rowCount === 0 && !t.collapsed && !m ? /* @__PURE__ */ F(j, {
				textAlign: "center",
				pt: "md",
				pl: `${i}px`,
				textStyle: "label/S/regular",
				color: "fg.subtle",
				children: "Every ticket has a deadline"
			}) : null
		]
	});
}
// extensions/pstdio-planner/src/timeline/view/edge-path.ts
function V(e, t) {
	let n = e.y > t.y, r = e.x + e.width / 2, i = t.x + t.width / 2, a = n ? e.y : e.y + e.height, o = n ? t.y + t.height : t.y, s = Math.max(24, Math.abs(o - a) / 2) * (n ? -1 : 1), c = n ? 6 : -6;
	return {
		upward: n,
		path: `M ${r} ${a} C ${r} ${a + s}, ${i} ${o - s}, ${i} ${o}`,
		head: `M ${i - 4} ${o + c} L ${i} ${o} L ${i + 4} ${o + c}`
	};
}
// extensions/pstdio-planner/src/timeline/view/graph-edges.tsx
function H(e) {
	let { rows: t, positions: n, width: r, height: i, selectedId: a, relatedIds: o } = e, s = t.flatMap((e) => e.dependsOn.flatMap((t) => {
		let r = n.get(t.id), i = n.get(e.id);
		return r && i ? [{
			key: `${t.id}-${e.id}`,
			done: t.done,
			related: o.has(e.id) && o.has(t.id),
			...V(r, i)
		}] : [];
	})), c = [{
		key: "background",
		zIndex: _.arrows,
		edges: s.filter((e) => !a || !e.related)
	}, {
		key: "hierarchy",
		zIndex: _.hierarchyArrows,
		edges: a ? s.filter((e) => e.related) : []
	}];
	return /* @__PURE__ */ F(P, { children: c.map((e) => /* @__PURE__ */ F(M.svg, {
		"data-edge-layer": e.key,
		position: "absolute",
		top: "0",
		left: "0",
		width: `${r}px`,
		height: `${i}px`,
		pointerEvents: "none",
		zIndex: e.zIndex,
		children: e.edges.map((e) => /* @__PURE__ */ F(U, {
			edge: e,
			selected: !!a
		}, e.key))
	}, e.key)) });
}
function U(e) {
	let { edge: t, selected: n } = e, r = t.upward ? m.warning : "fg.subtle", i = t.related ? "fg" : r;
	return /* @__PURE__ */ I("g", {
		opacity: n && !t.related ? .2 : 1,
		children: [/* @__PURE__ */ F(M.path, {
			d: t.path,
			fill: "none",
			stroke: t.related && !t.upward ? i : r,
			strokeWidth: t.related ? 2 : 1.25,
			strokeDasharray: t.upward || t.done ? "4 4" : void 0
		}), /* @__PURE__ */ F(M.path, {
			d: t.head,
			fill: "none",
			stroke: t.related && !t.upward ? i : r,
			strokeWidth: 1.5
		})]
	});
}
// extensions/pstdio-planner/src/timeline/model/calendar.ts
var W = 40;
function G(e, t, n) {
	if (e.length === 0) return n;
	let r = e[0], i = e[e.length - 1];
	if (t <= r.y) return f(r.date, -Math.max(1, Math.round((r.y - t) / W)));
	if (t >= i.y) return f(i.date, Math.max(1, Math.round((t - i.y) / W)));
	let a = e.findIndex((e) => e.y > t), o = e[a - 1], s = e[a], c = u(o.date, s.date);
	if (c < 2) return s.date;
	let l = Math.round((t - o.y) / (s.y - o.y) * c);
	return f(o.date, Math.min(c - 1, Math.max(1, l)));
}
// extensions/pstdio-planner/src/timeline/view/graph-timeline.tsx
var K = ({ top: e, height: t, dotted: n }) => /* @__PURE__ */ F(E, {
	position: "absolute",
	left: "57px",
	top: `${e}px`,
	h: `${Math.max(0, t)}px`,
	borderLeftWidth: "2px",
	borderStyle: n ? "dotted" : "solid",
	borderColor: "border",
	pointerEvents: "none"
}), q = ({ y: e, color: t, ghost: n }) => /* @__PURE__ */ F(E, {
	position: "absolute",
	left: "58px",
	top: `${e}px`,
	transform: "translate(-50%, -50%)",
	boxSize: "12px",
	borderRadius: "full",
	borderWidth: "2px",
	borderStyle: n ? "dashed" : "solid",
	borderColor: n ? "bg.accent-primary.default" : "bg",
	bg: n ? "bg" : t,
	pointerEvents: "none"
});
function se(e, t, n, r) {
	let [i, a] = T(), o = w(null), s = w(null);
	return {
		ghost: i,
		ghostRef: o,
		gutterRef: s,
		move: (i) => {
			let o = (i.clientY - (s.current?.getBoundingClientRect().top ?? 0)) / r, c = e.some((e) => Math.abs(e.y - o) < 25);
			a(n || c ? void 0 : {
				y: o,
				date: G(e, o, t)
			});
		},
		leave: (e) => {
			let t = e.relatedTarget, n = (e) => t instanceof Node && e?.contains(t);
			!n(o.current) && !n(s.current) && a(void 0);
		}
	};
}
function ce(t) {
	let { bands: n, sections: r, today: o, height: s, contentLeft: c, zoom: l, dropTarget: u, onCreate: d } = t, f = n.flatMap((e) => {
		let t = r.find(({ deadline: t }) => t?.id === e.deadlineId);
		return t?.deadline ? [{
			band: e,
			section: t,
			y: e.top + 21
		}] : [];
	}), { ghost: p, ghostRef: m, gutterRef: h, move: g, leave: v } = se(f.map(({ y: e, section: t }) => ({
		y: e,
		date: t.deadline.date
	})), o, u !== void 0, l), y = f[0]?.y ?? 16, b = f[f.length - 1]?.y ?? 16;
	return /* @__PURE__ */ I(P, { children: [/* @__PURE__ */ I(E, {
		ref: h,
		position: "sticky",
		left: "0",
		zIndex: _.gutter,
		w: "72px",
		h: `${s}px`,
		bg: "bg",
		cursor: p ? "pointer" : void 0,
		"aria-label": "Milestone timeline",
		"data-canvas-control": !0,
		onMouseMove: g,
		onMouseLeave: v,
		onClick: () => p && d(p.date),
		children: [
			/* @__PURE__ */ F(K, {
				top: y,
				height: b - y
			}),
			/* @__PURE__ */ F(K, {
				top: b,
				height: s - b,
				dotted: !0
			}),
			p ? /* @__PURE__ */ F(q, {
				y: p.y,
				color: "bg",
				ghost: !0
			}) : null
		]
	}), p ? /* @__PURE__ */ I(O, {
		ref: m,
		role: "button",
		"data-canvas-control": !0,
		"aria-label": `Create milestone on ${p.date}`,
		position: "absolute",
		zIndex: _.milestonePreview,
		left: `${c}px`,
		right: "8px",
		top: `${p.y - 21}px`,
		h: "42px",
		align: "center",
		gap: "sm",
		px: "sm",
		borderWidth: "1px",
		borderStyle: "dashed",
		borderColor: "bg.accent-primary.default",
		borderRadius: "md",
		bg: "bg",
		color: "fg.muted",
		cursor: "pointer",
		onMouseLeave: v,
		onClick: () => d(p.date),
		children: [
			/* @__PURE__ */ F(k, {
				as: e,
				boxSize: "14px"
			}),
			/* @__PURE__ */ F(k, {
				as: i,
				boxSize: "14px"
			}),
			/* @__PURE__ */ I(j, {
				textStyle: "label/S/medium",
				children: ["New milestone · ", a(p.date)]
			})
		]
	}) : null] });
}
// extensions/pstdio-planner/src/timeline/view/graph-tracks.tsx
function le(e) {
	let { track: t, onRename: n } = e;
	return t.id === "unassigned" ? /* @__PURE__ */ F(j, {
		textStyle: "label/S/medium",
		color: "fg.muted",
		truncate: !0,
		minW: "0",
		px: "2xs",
		children: t.label
	}) : /* @__PURE__ */ F(p, {
		value: t.label,
		label: `${t.label} track name`,
		color: "fg.muted",
		onSave: (e) => n(t.id, e)
	});
}
function ue(e) {
	let { tracks: r, boxes: a, width: o, contentLeft: s, collapsed: c, onToggle: l, onRename: u, onNewTrack: d } = e, f = Math.max(s, ...a.map((e) => e.x + e.width));
	return /* @__PURE__ */ I(E, {
		position: "sticky",
		top: "0",
		zIndex: _.tracks,
		w: `${o}px`,
		h: "32px",
		bg: "bg",
		children: [
			/* @__PURE__ */ F(E, {
				position: "sticky",
				left: "0",
				zIndex: "1",
				w: "72px",
				h: "full",
				bg: "bg"
			}),
			r.map((e, n) => c.has(e.id) ? /* @__PURE__ */ F(O, {
				position: "absolute",
				left: `${a[n].x}px`,
				w: `${a[n].width}px`,
				top: "4px",
				justify: "center",
				children: /* @__PURE__ */ F(N, {
					content: `Expand ${e.label}`,
					children: /* @__PURE__ */ F(A, {
						size: "2xs",
						variant: "ghost",
						color: "fg.subtle",
						"aria-label": `Expand ${e.label}`,
						onClick: () => l(e.id),
						children: /* @__PURE__ */ F(t, { size: 12 })
					})
				})
			}, e.id) : null),
			r.map((e, t) => c.has(e.id) ? null : /* @__PURE__ */ F(O, {
				position: "absolute",
				left: `${a[t].x}px`,
				w: `${a[t].width}px`,
				top: "4px",
				role: "group",
				"aria-label": `${e.label} track header`,
				children: /* @__PURE__ */ I(O, {
					position: "sticky",
					left: "72px",
					align: "center",
					gap: "2xs",
					minW: "0",
					maxW: "full",
					children: [/* @__PURE__ */ F(le, {
						track: e,
						onRename: u
					}), /* @__PURE__ */ F(N, {
						content: `Collapse ${e.label}`,
						children: /* @__PURE__ */ F(A, {
							size: "2xs",
							variant: "ghost",
							color: "fg.subtle",
							flexShrink: "0",
							"aria-label": `Collapse ${e.label}`,
							onClick: () => l(e.id),
							children: /* @__PURE__ */ F(n, { size: 12 })
						})
					})]
				})
			}, e.id)),
			/* @__PURE__ */ I(D, {
				position: "absolute",
				left: `${f + 24}px`,
				top: "4px",
				size: "2xs",
				variant: "ghost",
				color: "fg.subtle",
				onClick: d,
				children: [/* @__PURE__ */ F(i, { size: 12 }), "New track"]
			})
		]
	});
}
function de(e) {
	let { boxes: t, height: n, contentLeft: r } = e;
	return t.filter((e) => e.x > r).sort((e, t) => e.x - t.x).slice(1).map((e) => /* @__PURE__ */ F(E, {
		position: "absolute",
		top: "0",
		left: `${e.x - 12}px`,
		h: `${n}px`,
		borderLeftWidth: "1px",
		borderStyle: "dashed",
		borderColor: "border.subtle"
	}, e.x));
}
function fe(e) {
	let { tracks: t, boxes: n, height: r, collapsed: i } = e;
	return t.map((e, t) => i.has(e.id) ? /* @__PURE__ */ F(O, {
		position: "absolute",
		top: "0",
		left: `${n[t].x}px`,
		w: `${n[t].width}px`,
		h: `${r}px`,
		direction: "column",
		zIndex: "1",
		bg: "bg.subtle",
		pointerEvents: "none",
		children: /* @__PURE__ */ F(j, {
			position: "sticky",
			top: "48px",
			mt: "16px",
			alignSelf: "center",
			writingMode: "vertical-rl",
			textStyle: "label/S/medium",
			color: "fg.muted",
			whiteSpace: "nowrap",
			children: e.label
		})
	}, e.id) : null);
}
// extensions/pstdio-planner/src/timeline/view/graph-window.ts
var pe = ({ left: e, top: t, width: n, height: r, zoom: i }) => ({
	x: e / i - v.width,
	y: t / i - 32 - v.width,
	width: n / i + v.width * 2,
	height: r / i + v.width * 2
}), me = (e, t) => e.x <= t.x + t.width && e.x + e.width >= t.x && e.y <= t.y + t.height && e.y + e.height >= t.y, he = (e, t, n, r) => e.filter(({ id: e }) => r.has(e) || t.has(e) && me(t.get(e), n));
// extensions/pstdio-planner/src/timeline/view/use-canvas-window.ts
function ge(e) {
	let [t, n] = T({
		left: 0,
		top: 0,
		focusedId: void 0
	});
	return x(() => {
		let t = e.current;
		if (!t) return;
		let r = 0, i = () => {
			cancelAnimationFrame(r), r = requestAnimationFrame(() => {
				let e = t.ownerDocument.activeElement, r = e instanceof HTMLElement ? e.closest("[data-ticket]")?.dataset.ticket : void 0, i = {
					left: t.scrollLeft,
					top: t.scrollTop,
					focusedId: r
				};
				n((e) => e.left === i.left && e.top === i.top && e.focusedId === r ? e : i);
			});
		};
		return i(), t.addEventListener("scroll", i, { passive: !0 }), t.addEventListener("focusin", i), t.addEventListener("focusout", i), () => {
			cancelAnimationFrame(r), t.removeEventListener("scroll", i), t.removeEventListener("focusin", i), t.removeEventListener("focusout", i);
		};
	}, [e]), t;
}
// extensions/pstdio-planner/src/timeline/view/graph-content.tsx
function J(e, t) {
	c(e.dropTarget, t) || e.onDragTarget(t);
}
function _e(e) {
	let { props: t, graph: n, width: r, zoom: i, headerLeft: a } = e, { sections: o, dropTarget: s, ...c } = t, { box: l, trackAt: u } = n, d = (e) => J(t, e);
	return /* @__PURE__ */ F(P, { children: l.bands.map((e) => {
		let t = o.find(({ section: t }) => (t.deadline?.id ?? null) === e.deadlineId);
		return t ? /* @__PURE__ */ F(oe, {
			band: e,
			entry: t,
			viewWidth: r,
			contentLeft: l.contentLeft,
			zoom: i,
			headerLeft: a,
			dropTarget: s,
			over: d,
			trackAt: u,
			onDrop: c.onDrop,
			onToggle: c.onToggle,
			onDelete: c.onDelete,
			onRenameDeadline: c.onRenameDeadline,
			onRedate: c.onRedate,
			onReview: c.onReview
		}, e.deadlineId ?? "none") : null;
	}) });
}
function ve(e) {
	let { props: t, graph: n, visibleRows: r = n.rows } = e, { relations: i, selectedId: a, dropTarget: o, ...s } = t, { box: l, rows: u } = n, d = (e) => J(t, e);
	return /* @__PURE__ */ I(P, { children: [/* @__PURE__ */ F(H, {
		rows: u,
		positions: l.positions,
		width: l.width,
		height: l.height,
		selectedId: a,
		relatedIds: new Set(i.keys())
	}), r.map((e) => {
		let n = l.positions.get(e.id), r = {
			deadlineId: e.deadlineId,
			beforeId: e.id,
			trackId: e.trackId
		};
		return n ? /* @__PURE__ */ F(y, {
			row: e,
			interaction: t.cardInteraction,
			x: n.x,
			y: n.y,
			relation: i.get(e.id),
			dropBefore: c(o, r),
			onSelect: s.onSelect,
			onOpenRequests: s.onOpenRequests,
			onDragStart: s.onDragStart,
			onDragOver: () => d(r),
			onDrop: s.onDrop
		}, e.id) : null;
	})] });
}
function ye(e) {
	let { props: t, graph: n, collapsed: r, region: i, viewport: a } = e, { sections: o, tracks: s, today: c, dropTarget: l, ...u } = t, { box: d, trackAt: f } = n, { width: p, height: m, canvasWidth: g, canvasHeight: _, zoom: v } = a, y = ge(a.ref), b = h(d.contentLeft, y.left, v), x = pe({
		...y,
		width: p * v,
		height: m * v,
		zoom: v
	}), S = he(n.rows, d.positions, x, /* @__PURE__ */ new Set([
		t.selectedId,
		t.dragId,
		y.focusedId
	]));
	return /* @__PURE__ */ I(E, {
		position: "relative",
		w: `${g}px`,
		h: `${_}px`,
		onContextMenu: (e) => {
			let t = e.currentTarget.getBoundingClientRect(), n = e.currentTarget.closest("[data-timeline-viewport]")?.getBoundingClientRect().left ?? t.left;
			if ((e.clientX - n) / v < 72 || e.target.closest("[data-ticket], [data-canvas-control], button, input, [role=menuitem], [data-part=preview]")) return;
			e.preventDefault();
			let r = (e.clientX - t.left) / v, i = d.bands.find((n) => (e.clientY - t.top) / v >= n.top && (e.clientY - t.top) / v <= n.top + n.height);
			u.onContext({
				x: e.clientX,
				y: e.clientY,
				trackId: f(r) ?? void 0,
				deadlineId: i?.deadlineId
			});
		},
		children: [
			/* @__PURE__ */ F(ce, {
				bands: d.bands,
				sections: o.map(({ section: e }) => e),
				today: c,
				height: _,
				contentLeft: d.contentLeft,
				zoom: v,
				dropTarget: l,
				onCreate: u.onCreateDeadline
			}),
			/* @__PURE__ */ F(fe, {
				tracks: s.list,
				boxes: d.tracks,
				height: _,
				collapsed: r
			}),
			/* @__PURE__ */ F(de, {
				boxes: d.tracks,
				height: _,
				contentLeft: d.contentLeft
			}),
			/* @__PURE__ */ F(re, {
				region: i,
				width: g,
				height: _
			}),
			/* @__PURE__ */ F(_e, {
				props: t,
				graph: n,
				width: p,
				zoom: v,
				headerLeft: b
			}),
			/* @__PURE__ */ F(ve, {
				props: t,
				graph: n,
				visibleRows: S
			})
		]
	});
}
// extensions/pstdio-planner/src/timeline/view/use-canvas-pan.ts
var be = "[data-ticket], [data-canvas-control], button, input, textarea, a, [role=button], [role=menuitem], [data-part=preview]";
function Y(e, t) {
	let [n, r] = [...e.values()], i = t.getBoundingClientRect();
	return {
		distance: Math.hypot(r.x - n.x, r.y - n.y),
		anchor: {
			x: (n.x + r.x) / 2 - i.left,
			y: (n.y + r.y) / 2 - i.top
		}
	};
}
function xe(e, t, n) {
	let r = w(void 0), i = w(/* @__PURE__ */ new Map()), a = w(void 0), o = w(!1), [s, c] = T(!1), l = (e) => {
		a.current = {
			...Y(i.current, e),
			zoom: t,
			left: e.scrollLeft,
			top: e.scrollTop
		}, r.current = void 0;
		for (let t of i.current.keys()) e.setPointerCapture(t);
	}, u = (e) => {
		if (!i.current.delete(e.pointerId) && r.current?.pointerId !== e.pointerId) return;
		r.current = void 0, a.current = void 0, c(!1);
		let [t] = i.current;
		if (t) {
			let [n, i] = t;
			r.current = {
				pointerId: n,
				...i,
				left: e.currentTarget.scrollLeft,
				top: e.currentTarget.scrollTop
			};
		}
		e.currentTarget.hasPointerCapture(e.pointerId) && e.currentTarget.releasePointerCapture(e.pointerId);
	};
	return {
		panning: s,
		handlers: {
			onClickCapture: (e) => {
				e.currentTarget.contains(e.target) && o.current && e.detail > 0 && (e.preventDefault(), e.stopPropagation());
			},
			onKeyDown: (e) => {
				if (e.target !== e.currentTarget) return;
				let t = {
					ArrowLeft: [-80, 0],
					ArrowRight: [80, 0],
					ArrowUp: [0, -80],
					ArrowDown: [0, 80]
				}[e.key];
				t && (e.preventDefault(), e.currentTarget.scrollBy({
					left: t[0],
					top: t[1]
				}));
			},
			onPointerDownCapture: (e) => {
				if (e.button === 0 && e.currentTarget.contains(e.target)) {
					if (i.current.size === 0 && (o.current = !1), e.pointerType === "touch") {
						if (i.current.size === 2) {
							e.preventDefault();
							return;
						}
						if (i.current.set(e.pointerId, {
							x: e.clientX,
							y: e.clientY
						}), i.current.size === 2) {
							l(e.currentTarget), e.preventDefault();
							return;
						}
					}
					e.target.closest(be) || (r.current = {
						pointerId: e.pointerId,
						x: e.clientX,
						y: e.clientY,
						left: e.currentTarget.scrollLeft,
						top: e.currentTarget.scrollTop
					}, e.currentTarget.focus({
						preventScroll: !0,
						focusVisible: !1
					}), e.currentTarget.setPointerCapture(e.pointerId), e.preventDefault());
				}
			},
			onPointerMoveCapture: (t) => {
				if (i.current.has(t.pointerId) && i.current.set(t.pointerId, {
					x: t.clientX,
					y: t.clientY
				}), a.current && e.current) {
					let r = Y(i.current, e.current);
					o.current = !0, c(!0), n(a.current.zoom * r.distance / a.current.distance, r.anchor, a.current), t.preventDefault();
					return;
				}
				let s = r.current;
				if (!s || s.pointerId !== t.pointerId || !e.current) return;
				let l = t.clientX - s.x, u = t.clientY - s.y;
				!o.current && Math.hypot(l, u) < 4 || (o.current = !0, c(!0), e.current.scrollLeft = s.left - l, e.current.scrollTop = s.top - u);
			},
			onPointerUpCapture: u,
			onPointerCancelCapture: u,
			onLostPointerCapture: (e) => {
				e.target === e.currentTarget && u(e);
			}
		}
	};
}
// extensions/pstdio-planner/src/timeline/view/canvas-zoom.ts
var X = .25;
function Z(e) {
	return Math.min(1, Math.max(X, e));
}
function Se(e, t) {
	let n = [
		1,
		16,
		t.pageHeight
	], r = t.y * (n[t.mode] ?? 1);
	return Z(e * Math.exp(-r / 1e3));
}
function Q(e) {
	let t = e.to / e.from, n = e.anchor ?? {
		x: e.width / 2,
		y: e.height / 2
	}, r = e.targetAnchor ?? n;
	return {
		left: Math.max(0, (e.left + n.x) * t - r.x),
		top: Math.max(0, (e.top + n.y) * t - r.y)
	};
}
// extensions/pstdio-planner/src/timeline/view/use-canvas-zoom.ts
function Ce(e) {
	let [{ zoom: t }, n] = T({ zoom: 1 }), r = w(1), i = w(void 0), a = (t, a, o) => {
		let s = Z(t);
		if (s === r.current && !o) return;
		let c = e.current;
		if (c) {
			let e = i.current ? Q(i.current) : {
				left: c.scrollLeft,
				top: c.scrollTop
			}, t = {
				left: o?.left ?? e.left,
				top: o?.top ?? e.top,
				width: c.clientWidth,
				height: c.clientHeight,
				from: o?.zoom ?? r.current,
				to: s,
				anchor: o?.anchor ?? a,
				targetAnchor: a
			};
			s === r.current && !i.current ? c.scrollTo(Q(t)) : i.current = t;
		}
		r.current = s, n({ zoom: s });
	}, o = S((t) => {
		let n = e.current;
		if (!n) return;
		if (t.preventDefault(), !t.ctrlKey) {
			let e = [
				1,
				16,
				n.clientHeight
			][t.deltaMode] ?? 1;
			n.scrollBy({
				left: t.deltaX * e,
				top: t.deltaY * e
			});
			return;
		}
		let i = n.getBoundingClientRect();
		a(Se(r.current, {
			y: t.deltaY,
			mode: t.deltaMode,
			pageHeight: n.clientHeight
		}), {
			x: t.clientX - i.left,
			y: t.clientY - i.top
		});
	});
	return x(() => {
		let t = e.current;
		if (t) return t.addEventListener("wheel", o, { passive: !1 }), () => t.removeEventListener("wheel", o);
	}, [e]), C(() => {
		i.current &&= (e.current?.scrollTo(Q(i.current)), void 0);
	}), {
		zoom: t,
		change: a
	};
}
// extensions/pstdio-planner/src/timeline/view/use-canvas-anchor.ts
function $(e) {
	let t = w(void 0), n = w(void 0), r = S(() => {
		let r = e.current;
		if (!r || t.current) return;
		let i = r.getBoundingClientRect(), a = [...r.querySelectorAll("[data-ticket]")].find((e) => {
			let t = e.getBoundingClientRect();
			return t.bottom > i.top && t.top < i.bottom && t.right > i.left && t.left < i.right;
		});
		t.current = {
			card: a,
			top: a?.getBoundingClientRect().top ?? 0,
			scrollTop: r.scrollTop,
			bottom: r.scrollTop > 0 && (r.scrollTop === n.current || r.scrollHeight - r.clientHeight - r.scrollTop <= 1)
		};
	});
	return C(() => {
		let r = t.current, i = e.current;
		if (t.current = void 0, r && i) {
			if (r.bottom) i.scrollTop = i.scrollHeight, n.current = i.scrollTop;
			else if (n.current = void 0, r.card?.isConnected) {
				let e = r.card.getBoundingClientRect().top - r.top + i.scrollTop - r.scrollTop;
				i.scrollTop += e;
			}
		}
	}), r;
}
// extensions/pstdio-planner/src/timeline/view/use-card-heights.ts
function we(e, t) {
	let [n, r] = T(/* @__PURE__ */ new Map()), i = $(e), a = S((e) => {
		let t = e.map((e) => ({
			id: e.target.dataset.ticket,
			height: Math.ceil(e.borderBoxSize[0]?.blockSize ?? e.contentRect.height)
		}));
		t.some(({ id: e, height: t }) => n.get(e) !== t) && (i(), r((e) => {
			let n = new Map(e);
			for (let { id: e, height: r } of t) n.set(e, r);
			return n;
		}));
	});
	return x(() => {
		let n = e.current;
		if (!n) return;
		let i = new Set(t.split(","));
		r((e) => [...e.keys()].every((e) => i.has(e)) ? e : new Map([...e].filter(([e]) => i.has(e))));
		let o = new ResizeObserver(a), s = /* @__PURE__ */ new Set(), c = () => {
			let e = new Set(n.querySelectorAll("[data-ticket]"));
			for (let t of s) e.has(t) || (o.unobserve(t), s.delete(t));
			for (let t of e) i.has(t.dataset.ticket) && !s.has(t) && (o.observe(t), s.add(t));
		};
		c();
		let l = new MutationObserver(c);
		return l.observe(n, {
			childList: !0,
			subtree: !0
		}), () => {
			o.disconnect(), l.disconnect();
		};
	}, [e, t]), n;
}
// extensions/pstdio-planner/src/timeline/view/use-reveal-card.ts
function Te(e) {
	let { ref: t, selectedId: n, box: r, zoom: i } = e, { x: a, y: o, width: s, height: c } = (n ? r.positions.get(n) : void 0) ?? {}, l = S(() => i);
	x(() => {
		let e = t.current;
		if (!n || !e || a === void 0 || o === void 0 || s === void 0 || c === void 0) return;
		let r = l(), i = Math.min(e.scrollLeft, (a - 72 - 16) * r), u = Math.min(e.scrollTop, (o - 42 - 16) * r);
		e.scrollTo({
			left: Math.max(i, (a + s + 16) * r - e.clientWidth),
			top: Math.max(u, (o + c + 32 + 16) * r - e.clientHeight),
			behavior: "smooth"
		});
	}, [
		n,
		a,
		o,
		s,
		c,
		t
	]);
}
// extensions/pstdio-planner/src/timeline/view/use-size.ts
function Ee() {
	let e = w(null), [t, n] = T({
		width: 0,
		height: 0
	});
	return x(() => {
		let t = e.current;
		if (!t) return;
		let r = new ResizeObserver(([e]) => n({
			width: e.contentRect.width,
			height: e.contentRect.height
		}));
		return r.observe(t), () => r.disconnect();
	}, []), {
		ref: e,
		...t
	};
}
// extensions/pstdio-planner/src/timeline/view/zoom-controls.tsx
function De(e) {
	let { zoom: t, onChange: n } = e;
	return /* @__PURE__ */ I(O, {
		role: "group",
		"aria-label": "Timeline zoom",
		position: "absolute",
		left: "50%",
		transform: "translateX(-50%)",
		bottom: "sm",
		zIndex: "10",
		align: "center",
		gap: "2xs",
		p: "2xs",
		bg: "bg",
		borderWidth: "1px",
		borderColor: "border",
		borderRadius: "md",
		children: [
			/* @__PURE__ */ F(N, {
				content: "Zoom out",
				children: /* @__PURE__ */ F(A, {
					size: "xs",
					variant: "ghost",
					"aria-label": "Zoom out",
					disabled: t <= X,
					onClick: () => n(t - .1),
					children: /* @__PURE__ */ F(r, { size: 14 })
				})
			}),
			/* @__PURE__ */ F(N, {
				content: "Reset to 100%",
				children: /* @__PURE__ */ I(D, {
					size: "xs",
					variant: "ghost",
					"aria-label": `Reset zoom to 100%, current zoom ${Math.round(t * 100)}%`,
					onClick: () => n(1),
					children: [Math.round(t * 100), "%"]
				})
			}),
			/* @__PURE__ */ F(N, {
				content: "Zoom in",
				children: /* @__PURE__ */ F(A, {
					size: "xs",
					variant: "ghost",
					"aria-label": "Zoom in",
					disabled: t >= 1,
					onClick: () => n(t + .1),
					children: /* @__PURE__ */ F(i, { size: 14 })
				})
			})
		]
	});
}
// extensions/pstdio-planner/src/timeline/view/plan-graph.tsx
function Oe(e, t, n, r) {
	let i = te(e.map(({ section: e, rows: t, collapsed: n }) => ({
		deadlineId: e.deadline?.id ?? null,
		collapsed: n,
		rows: t
	})), {
		tracks: t.list.length,
		trackOf: t.indexOf,
		collapsedTracks: new Set(t.list.flatMap((e, t) => n.has(e.id) ? [t] : []))
	}), a = we(r, i.nodes.map(({ id: e }) => e).join(",")), o = g(i, a);
	return {
		box: o,
		trackAt: (e) => {
			let n = o.tracks.findIndex((t) => e >= t.x && e <= t.x + t.width), r = t.list[Math.max(0, n)]?.id;
			return r === "unassigned" ? null : r;
		},
		rows: e.flatMap((e) => e.collapsed ? [] : e.rows).filter(({ id: e }) => o.positions.has(e))
	};
}
function ke(e) {
	let { sections: t, tracks: n, selectedId: r, ...i } = e, { ref: a, width: o, height: s } = Ee(), { zoom: c, change: l } = Ce(a), { panning: u, handlers: d } = xe(a, c, l), f = b(), p = new Set(f.value.collapsedTracks), m = (e) => f.toggle("collapsedTracks", e), { box: h, trackAt: g, rows: _ } = Oe(t, n, p, a), v = t.flatMap(({ section: e }) => e.rows).find(({ id: t }) => t === e.dragId)?.trackId, y = ne(h, n.list.map(({ id: e }) => e), e.dropTarget, v);
	Te({
		ref: a,
		selectedId: r,
		box: h,
		zoom: c
	});
	let x = Math.max(h.width + 120, o / c), S = Math.max(h.height, s / c - 32);
	return /* @__PURE__ */ I(E, {
		h: "full",
		minH: "0",
		minW: "0",
		position: "relative",
		children: [/* @__PURE__ */ F(E, {
			ref: a,
			"data-timeline-viewport": !0,
			h: "full",
			minH: "0",
			minW: "0",
			overflow: "hidden",
			position: "relative",
			isolation: "isolate",
			cursor: u ? "grabbing" : "grab",
			userSelect: u ? "none" : void 0,
			touchAction: "none",
			role: "region",
			"aria-label": "Project Timeline canvas",
			tabIndex: 0,
			...d,
			children: /* @__PURE__ */ I(E, {
				style: { zoom: c },
				w: `${x}px`,
				children: [/* @__PURE__ */ F(ue, {
					tracks: n.list,
					boxes: h.tracks,
					width: x,
					contentLeft: h.contentLeft,
					collapsed: p,
					onToggle: m,
					onRename: i.onRenameTrack,
					onNewTrack: i.onNewTrack
				}), /* @__PURE__ */ F(ye, {
					props: e,
					region: y,
					graph: {
						box: h,
						trackAt: g,
						rows: _
					},
					collapsed: p,
					viewport: {
						ref: a,
						width: o / c,
						height: s / c,
						canvasWidth: x,
						canvasHeight: S,
						zoom: c
					}
				})]
			})
		}), /* @__PURE__ */ F(De, {
			zoom: c,
			onChange: l
		})]
	});
}
export { ke as t };
