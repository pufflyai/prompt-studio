// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, h as t, m as n, p as r, r as i } from "./test-whhQHjQi.ts";
import { t as a } from "./chevron-down-ZmPqsMG0.ts";
import { t as o } from "./chevron-right-CRFNEcZT.ts";
import { n as s, t as c } from "./chevrons-right-left-Cdgz6T4J.ts";
import { t as l } from "./plus-CYkLGSPS.ts";
import { t as u } from "./tooltip-BweQW627.ts";
import { n as d, t as f } from "./canvas-BXvXw29d.ts";
import { t as p } from "./drop-indicator-Bqz21pYA.ts";
import { t as m } from "./kanban-renderer-card-DtFLg3Jg.ts";
import { useEffect as h, useEffectEvent as g, useImperativeHandle as _, useLayoutEffect as v, useRef as y, useState as b } from "react";
import { Box as x, Button as S, Flex as C, Icon as w, IconButton as T, Input as ee, Text as E, chakra as D, createSlotRecipeContext as te, defineSlotRecipe as ne } from "@chakra-ui/react";
import { Fragment as O, jsx as k, jsxs as A } from "react/jsx-runtime";
// packages/ui/src/theme/primitives/dependency-timeline.ts
var j = {
	cardWidth: 240,
	cardHeight: 68,
	laneGap: 32,
	trackGap: 24,
	rowGap: 40,
	headerHeight: 42,
	emptyHeight: 56,
	bandGap: 16,
	padding: 16,
	trackHeaderHeight: 32,
	newTrackWidth: 120,
	gutterWidth: 72,
	lineX: 58,
	collapsedTrackWidth: 36,
	cardInset: 20,
	markerSize: 12
}, re = {
	"--dependency-timeline-gutter": `${j.gutterWidth}px`,
	"--dependency-timeline-section-header": `${j.headerHeight}px`,
	"--dependency-timeline-track-header": `${j.trackHeaderHeight}px`,
	"--dependency-timeline-card": `${j.cardWidth}px`,
	"--dependency-timeline-marker": `${j.markerSize}px`
}, M = {
	width: j.cardWidth,
	height: j.cardHeight
}, N = j.laneGap, P = j.trackGap, ie = j.rowGap, F = j.headerHeight, ae = j.emptyHeight, oe = j.bandGap, I = j.padding, L = j.trackHeaderHeight, se = j.newTrackWidth, R = j.gutterWidth, z = j.lineX, B = j.collapsedTrackWidth, ce = (e, t, n) => Math.max(R, e - t / n), V = (e, t, n) => {
	if (n < R) return;
	let r = -1, i = Infinity;
	for (let [t, a] of e.entries()) {
		let e = Math.max(a.x - n, n - a.x - a.width, 0);
		e < i && (r = t, i = e);
	}
	return t[r]?.id;
};
function le(e) {
	let t = R + e.filter((e) => e === 0).length * B, n = R, r = t + I;
	return {
		tracks: e.map((e) => {
			if (e === 0) {
				let e = {
					x: n,
					width: B
				};
				return n += B, e;
			}
			let t = {
				x: r,
				width: e * (M.width + N) - N
			};
			return r += t.width + N + P, t;
		}),
		contentLeft: t
	};
}
function ue(e, t) {
	let n = I;
	return {
		boxes: e.map((e) => {
			let r = e.collapsed ? 0 : Math.max(t[e.startRow + e.rowCount] - t[e.startRow], ae), i = {
				...e,
				top: n,
				bodyTop: n + F,
				height: F + r
			};
			return n += i.height + oe, i;
		}),
		height: n
	};
}
function de(e, t = /* @__PURE__ */ new Map()) {
	let { tracks: n, contentLeft: r } = le(e.trackLanes), i = Array.from({ length: Math.max(0, ...e.bands.map((e) => e.startRow + e.rowCount)) }, () => M.height);
	for (let n of e.nodes) i[n.row] = Math.max(i[n.row], t.get(n.id) ?? M.height);
	let a = [0];
	for (let e of i) a.push(a.at(-1) + e + ie);
	let { boxes: o, height: s } = ue(e.bands, a), c = (e) => o.find((t) => e >= t.startRow && e < t.startRow + t.rowCount) ?? o[0];
	return {
		bands: o,
		tracks: n,
		positions: new Map(e.nodes.map((e) => {
			let r = c(e.row);
			return [e.id, {
				x: n[e.track].x + e.lane * (M.width + N),
				y: r.bodyTop + a[e.row] - a[r.startRow] + j.cardInset,
				width: M.width,
				height: t.get(e.id) ?? M.height
			}];
		})),
		contentLeft: r,
		width: Math.max(r, ...n.map((e) => e.x + e.width)) + I,
		height: s
	};
}
// packages/ui/src/theme/recipes/dependency-timeline.ts
var fe = ne({
	slots: [
		"root",
		"tracks",
		"gutterCorner",
		"track",
		"trackName",
		"trackLabel",
		"columns",
		"columnLabel",
		"separator",
		"content",
		"item",
		"section",
		"sectionHeader",
		"sectionLabel",
		"date",
		"marker",
		"gutter",
		"line",
		"preview",
		"highlight",
		"highlightRow",
		"highlightTrack",
		"highlightCell"
	],
	base: {
		root: {
			...re,
			h: "full",
			minH: "0",
			minW: "0",
			position: "relative"
		},
		tracks: {
			position: "sticky",
			top: "0",
			zIndex: "10",
			h: "var(--dependency-timeline-track-header)",
			bg: "bg"
		},
		gutterCorner: {
			position: "sticky",
			left: "0",
			zIndex: "1",
			w: "var(--dependency-timeline-gutter)",
			h: "full",
			bg: "bg"
		},
		track: {
			position: "absolute",
			top: "2xs",
			display: "flex",
			alignItems: "center",
			"& button": {
				color: "fg.subtle",
				flexShrink: "0"
			},
			"& svg": { boxSize: "icon-2xs" }
		},
		trackName: {
			position: "sticky",
			left: "var(--dependency-timeline-gutter)",
			display: "flex",
			alignItems: "center",
			gap: "2xs",
			minW: "0",
			maxW: "full"
		},
		trackLabel: {
			textStyle: "label/S/medium",
			color: "fg.muted",
			minW: "0",
			px: "2xs",
			truncate: !0
		},
		columns: {
			position: "absolute",
			top: "0",
			display: "flex",
			flexDirection: "column",
			zIndex: "1",
			bg: "bg.subtle",
			pointerEvents: "none"
		},
		columnLabel: {
			position: "sticky",
			top: "calc(var(--dependency-timeline-track-header) + {spacing.md})",
			mt: "md",
			alignSelf: "center",
			writingMode: "vertical-rl",
			textStyle: "label/S/medium",
			color: "fg.muted",
			whiteSpace: "nowrap"
		},
		separator: {
			position: "absolute",
			top: "0",
			borderLeftWidth: "1px",
			borderStyle: "dashed",
			borderColor: "border.subtle"
		},
		content: { position: "relative" },
		item: {
			position: "absolute",
			w: "var(--dependency-timeline-card)",
			zIndex: "5",
			"&[data-related]": { zIndex: "7" }
		},
		section: {
			position: "absolute",
			left: "0",
			right: "xs"
		},
		sectionHeader: {
			position: "sticky",
			top: "var(--dependency-timeline-track-header)",
			zIndex: "3",
			display: "flex",
			h: "var(--dependency-timeline-section-header)"
		},
		sectionLabel: {
			position: "sticky",
			left: "var(--dependency-timeline-gutter)",
			flexShrink: "0",
			minW: "0"
		},
		date: {
			position: "sticky",
			left: "0",
			top: "var(--dependency-timeline-track-header)",
			zIndex: "9",
			flexShrink: "0",
			display: "flex",
			alignItems: "center",
			w: "var(--dependency-timeline-gutter)",
			h: "var(--dependency-timeline-section-header)",
			bg: "bg",
			textStyle: "label/S/medium",
			whiteSpace: "nowrap"
		},
		marker: {
			position: "absolute",
			top: "50%",
			transform: "translate(-50%, -50%)",
			boxSize: "var(--dependency-timeline-marker)",
			borderRadius: "full",
			borderWidth: "2px",
			borderColor: "bg",
			pointerEvents: "none"
		},
		gutter: {
			position: "sticky",
			left: "0",
			zIndex: "8",
			w: "var(--dependency-timeline-gutter)",
			bg: "bg"
		},
		line: {
			position: "absolute",
			borderLeftWidth: "2px",
			borderColor: "border",
			pointerEvents: "none"
		},
		preview: {
			position: "absolute",
			zIndex: "11",
			right: "xs",
			h: "var(--dependency-timeline-section-header)",
			display: "flex",
			alignItems: "center",
			gap: "sm",
			px: "sm",
			borderWidth: "1px",
			borderStyle: "dashed",
			borderColor: "bg.accent-primary.default",
			borderRadius: "md",
			bg: "bg",
			color: "fg.muted",
			cursor: "pointer"
		},
		highlight: {
			position: "absolute",
			inset: "0",
			pointerEvents: "none",
			zIndex: "2"
		},
		highlightRow: {
			position: "absolute",
			left: "var(--dependency-timeline-gutter)",
			bg: "bg.accent-subtle/50"
		},
		highlightTrack: {
			position: "absolute",
			top: "0",
			bg: "bg.accent-subtle/50"
		},
		highlightCell: {
			position: "absolute",
			bg: "bg.accent-subtle"
		}
	},
	variants: {
		lineStyle: {
			solid: { line: { borderStyle: "solid" } },
			dotted: { line: { borderStyle: "dotted" } }
		},
		markerStyle: { ghost: { marker: {
			bg: "bg",
			borderStyle: "dashed",
			borderColor: "bg.accent-primary.default"
		} } }
	},
	defaultVariants: { lineStyle: "solid" }
}), { withProvider: H, withContext: U } = te({ recipe: fe }), pe = H("div", "root"), me = U("div", "tracks"), he = U("div", "gutterCorner"), ge = U("div", "track"), _e = U("div", "trackName"), ve = U("div", "trackLabel"), ye = U("div", "columns"), be = U("div", "columnLabel"), xe = U("div", "separator"), Se = U("div", "content"), Ce = U("div", "item"), we = U("div", "section"), Te = U("div", "sectionHeader"), Ee = U("div", "sectionLabel"), De = U("div", "date"), W = H("div", "marker"), Oe = U("div", "gutter"), G = H("div", "line"), ke = U("div", "preview"), Ae = U("div", "highlight"), je = U("div", "highlightRow"), Me = U("div", "highlightTrack"), Ne = U("div", "highlightCell"), Pe = (e) => {
	let { box: t, dropTarget: n, sections: r, tracks: i, draggedId: a, width: o, height: s } = e;
	if (!n) return null;
	let c = t.bands.find(({ sectionId: e }) => e === n.sectionId);
	if (!c) return null;
	let l = n.trackId ?? r.flatMap(({ items: e }) => e).find(({ id: e }) => e === a)?.trackId, u = t.tracks[i.findIndex(({ id: e }) => e === l)];
	return /* @__PURE__ */ A(Ae, {
		"aria-hidden": "true",
		children: [/* @__PURE__ */ k(je, {
			"data-drop-milestone": c.sectionId ?? "unassigned",
			top: `${c.top}px`,
			w: `${o - R}px`,
			h: `${c.height}px`
		}), u ? /* @__PURE__ */ A(O, { children: [/* @__PURE__ */ k(Me, {
			"data-drop-track": l,
			left: `${u.x}px`,
			w: `${u.width}px`,
			h: `${s}px`
		}), /* @__PURE__ */ k(Ne, {
			"data-drop-cell": !0,
			left: `${u.x}px`,
			top: `${c.bodyTop}px`,
			w: `${u.width}px`,
			h: `${c.top + c.height - c.bodyTop}px`
		})] }) : null]
	});
};
// packages/ui/src/components/dependency-timeline/edge-path.ts
function Fe(e, t) {
	let n = e.y > t.y, r = e.x + e.width / 2, i = t.x + t.width / 2, a = n ? e.y : e.y + e.height, o = n ? t.y + t.height : t.y, s = Math.max(24, Math.abs(o - a) / 2) * (n ? -1 : 1), c = n ? 6 : -6;
	return {
		upward: n,
		path: `M ${r} ${a} C ${r} ${a + s}, ${i} ${o - s}, ${i} ${o}`,
		head: `M ${i - 4} ${o + c} L ${i} ${o} L ${i + 4} ${o + c}`
	};
}
// packages/ui/src/components/dependency-timeline/timeline-layers.ts
var K = {
	arrows: 4,
	hierarchyArrows: 6
}, Ie = ({ left: e, top: t, width: n, height: r, zoom: i }) => ({
	x: e / i - M.width,
	y: t / i - L - M.width,
	width: n / i + M.width * 2,
	height: r / i + M.width * 2
}), q = (e, t) => e.x <= t.x + t.width && e.x + e.width >= t.x && e.y <= t.y + t.height && e.y + e.height >= t.y, Le = (e, t, n) => q({
	x: Math.min(e.x, t.x),
	y: Math.min(e.y, t.y),
	width: Math.max(e.x + e.width, t.x + t.width) - Math.min(e.x, t.x),
	height: Math.max(e.y + e.height, t.y + t.height) - Math.min(e.y, t.y)
}, n), Re = (e, t, n, r) => e.filter(({ id: e }) => r.has(e) || t.has(e) && q(t.get(e), n));
// packages/ui/src/components/dependency-timeline/timeline-edges.tsx
function ze(e) {
	let { items: t, positions: n, width: r, height: i, selectedId: a, bounds: o } = e, s = new Set(t.filter(({ related: e }) => e).map(({ id: e }) => e)), c = t.flatMap((e) => e.dependencies.flatMap((t) => {
		let r = n.get(t.id), i = n.get(e.id);
		return r && i && Le(r, i, o) ? [{
			key: `${t.id}-${e.id}`,
			done: !!t.done,
			related: s.has(e.id) && s.has(t.id),
			...Fe(r, i)
		}] : [];
	})), l = [{
		key: "background",
		zIndex: K.arrows,
		edges: c.filter((e) => !a || !e.related)
	}, {
		key: "hierarchy",
		zIndex: K.hierarchyArrows,
		edges: a ? c.filter((e) => e.related) : []
	}];
	return /* @__PURE__ */ k(O, { children: l.map((e) => /* @__PURE__ */ k(D.svg, {
		"data-edge-layer": e.key,
		position: "absolute",
		top: "0",
		left: "0",
		width: `${r}px`,
		height: `${i}px`,
		pointerEvents: "none",
		zIndex: e.zIndex,
		children: e.edges.map((e) => /* @__PURE__ */ k(Be, {
			edge: e,
			selected: !!a
		}, e.key))
	}, e.key)) });
}
function Be(e) {
	let { edge: t, selected: n } = e, r = t.upward ? "orange.fg" : "fg.subtle", i = t.related ? "fg" : r;
	return /* @__PURE__ */ A("g", {
		opacity: n && !t.related ? .2 : 1,
		children: [/* @__PURE__ */ k(D.path, {
			d: t.path,
			fill: "none",
			stroke: t.related && !t.upward ? i : r,
			strokeWidth: t.related ? 2 : 1.25,
			strokeDasharray: t.upward || t.done ? "4 4" : void 0
		}), /* @__PURE__ */ k(D.path, {
			d: t.head,
			fill: "none",
			stroke: t.related && !t.upward ? i : r,
			strokeWidth: 1.5
		})]
	});
}
// packages/ui/src/components/dependency-timeline/timeline-days.ts
var J = 864e5, Y = (e, t) => new Date(Date.parse(`${e}T00:00:00Z`) + t * J).toISOString().slice(0, 10), Ve = (e, t) => Math.round((Date.parse(`${t}T00:00:00Z`) - Date.parse(`${e}T00:00:00Z`)) / J), X = 40;
function He(e, t, n) {
	if (e.length === 0) return n;
	let r = e[0], i = e[e.length - 1];
	if (t <= r.y) return Y(r.date, -Math.max(1, Math.round((r.y - t) / X)));
	if (t >= i.y) return Y(i.date, Math.max(1, Math.round((t - i.y) / X)));
	let a = e.findIndex((e) => e.y > t), o = e[a - 1], s = e[a], c = Ve(o.date, s.date);
	if (c < 2) return s.date;
	let l = Math.round((t - o.y) / (s.y - o.y) * c);
	return Y(o.date, Math.min(c - 1, Math.max(1, l)));
}
// packages/ui/src/components/dependency-timeline/timeline-gutter.tsx
var Ue = new Intl.DateTimeFormat(void 0, {
	weekday: "short",
	month: "short",
	day: "numeric",
	timeZone: "UTC"
}), We = (e, t, n, r) => {
	let [i, a] = b(), o = y(null), s = y(null);
	return {
		ghost: i,
		ghostRef: o,
		gutterRef: s,
		move: (i) => {
			let o = (i.clientY - (s.current?.getBoundingClientRect().top ?? 0)) / r, c = e.some((e) => Math.abs(e.y - o) < F / 2 + 4);
			a(n || c ? void 0 : {
				y: o,
				date: He(e, o, t)
			});
		},
		leave: (e) => {
			let t = e.relatedTarget, n = (e) => t instanceof Node && e?.contains(t);
			!n(o.current) && !n(s.current) && a(void 0);
		}
	};
}, Ge = (e) => {
	let { bands: t, sections: n, today: r, height: i, contentLeft: a, zoom: s, dropTarget: c, onCreateSection: u } = e, d = t.flatMap((e) => {
		let t = n.find(({ id: t }) => t === e.sectionId);
		return t?.date ? [{
			y: e.top + F / 2,
			date: t.date
		}] : [];
	}), { ghost: f, ghostRef: p, gutterRef: m, move: h, leave: g } = We(d, r, c !== void 0, s), _ = d[0]?.y ?? I, v = d.at(-1)?.y ?? I;
	return /* @__PURE__ */ A(O, { children: [/* @__PURE__ */ A(Oe, {
		ref: m,
		h: `${i}px`,
		cursor: f && u ? "pointer" : void 0,
		"aria-label": "Milestone timeline",
		"data-canvas-control": u ? "" : void 0,
		onMouseMove: u ? h : void 0,
		onMouseLeave: g,
		onClick: () => f && u?.(f.date),
		children: [
			/* @__PURE__ */ k(G, {
				left: `${z - 1}px`,
				top: `${_}px`,
				h: `${v - _}px`,
				lineStyle: "solid"
			}),
			/* @__PURE__ */ k(G, {
				left: `${z - 1}px`,
				top: `${v}px`,
				h: `${Math.max(0, i - v)}px`,
				lineStyle: "dotted"
			}),
			f && u ? /* @__PURE__ */ k(W, {
				left: `${z}px`,
				top: `${f.y}px`,
				markerStyle: "ghost"
			}) : null
		]
	}), f && u ? /* @__PURE__ */ A(ke, {
		ref: p,
		role: "button",
		tabIndex: 0,
		"data-canvas-control": !0,
		"aria-label": `Create milestone on ${f.date}`,
		left: `${a}px`,
		top: `${f.y - F / 2}px`,
		onMouseLeave: g,
		onClick: () => u(f.date),
		onKeyDown: (e) => {
			(e.key === "Enter" || e.key === " ") && (e.preventDefault(), u(f.date));
		},
		children: [
			/* @__PURE__ */ k(w, {
				as: o,
				boxSize: "icon-xs"
			}),
			/* @__PURE__ */ k(w, {
				as: l,
				boxSize: "icon-xs"
			}),
			/* @__PURE__ */ A(E, {
				textStyle: "label/S/medium",
				children: ["New milestone · ", Ue.format(/* @__PURE__ */ new Date(`${f.date}T00:00:00Z`))]
			})
		]
	}) : null] });
}, Ke = (e) => {
	let { items: t, sections: n, box: r, dropTarget: i, onDropTarget: a, onDrop: o } = e;
	return /* @__PURE__ */ k(O, { children: t.map((e) => {
		let t = r.positions.get(e.id);
		if (!t) return null;
		let s = n.find(({ items: t }) => t.some(({ id: t }) => t === e.id));
		return /* @__PURE__ */ A(Ce, {
			"data-timeline-item": e.id,
			"data-canvas-control": !0,
			"data-related": e.related ? "" : void 0,
			left: `${t.x}px`,
			top: `${t.y}px`,
			onDragOver: (t) => {
				a && (t.preventDefault(), t.stopPropagation(), a({
					sectionId: s.id,
					trackId: e.trackId,
					beforeId: e.id
				}));
			},
			onDrop: (e) => {
				o && (e.preventDefault(), e.stopPropagation(), o());
			},
			children: [i?.beforeId === e.id && i.sectionId === s.id ? /* @__PURE__ */ k(p, { top: "-sm" }) : null, e.content]
		}, e.id);
	}) });
}, qe = new Intl.DateTimeFormat(void 0, {
	month: "short",
	day: "numeric",
	timeZone: "UTC"
}), Je = (e) => {
	let { section: t, onDropTarget: n, onDrop: r } = e;
	return /* @__PURE__ */ A(De, {
		"data-canvas-control": !0,
		onDragOver: (e) => {
			n && (e.preventDefault(), e.stopPropagation(), n({ sectionId: t.id }));
		},
		onDrop: (e) => {
			r && (e.preventDefault(), e.stopPropagation(), r());
		},
		children: [/* @__PURE__ */ k(x, {
			w: `${z - 10}px`,
			textAlign: "right",
			pr: "2xs",
			children: t.dateLabel ?? qe.format(/* @__PURE__ */ new Date(`${t.date}T00:00:00Z`))
		}), /* @__PURE__ */ k(W, {
			"aria-hidden": "true",
			left: `${z}px`,
			bg: t.complete ? "green.fg" : t.dateTone ?? "fg.muted"
		})]
	});
}, Ye = (e) => {
	let { band: t, section: n, box: r, tracks: i, width: a, headerLeft: o, zoom: s, onDropTarget: c, onDrop: l } = e;
	return /* @__PURE__ */ A(we, {
		"data-timeline-section": n.id ?? "unassigned",
		top: `${t.top}px`,
		h: `${t.height}px`,
		onDragOver: (e) => {
			if (!c) return;
			e.preventDefault();
			let t = (e.clientX - (e.currentTarget.parentElement?.getBoundingClientRect().left ?? 0)) / s;
			c({
				sectionId: n.id,
				trackId: V(r.tracks, i, t)
			});
		},
		onDrop: (e) => {
			l && (e.preventDefault(), l());
		},
		children: [
			n.date ? /* @__PURE__ */ k(Je, {
				section: n,
				onDropTarget: c,
				onDrop: l
			}) : null,
			/* @__PURE__ */ A(Te, {
				mt: n.date ? `-${F}px` : void 0,
				children: [
					/* @__PURE__ */ k(x, {
						flexShrink: "0",
						w: `${R}px`,
						pointerEvents: "none"
					}),
					/* @__PURE__ */ k(x, {
						flexShrink: "0",
						w: `${r.contentLeft - R}px`,
						pointerEvents: "none"
					}),
					/* @__PURE__ */ k(Ee, {
						w: `${Math.max(320, a - o - I / 2)}px`,
						"data-canvas-control": !0,
						children: n.header
					})
				]
			}),
			t.rowCount === 0 && !t.collapsed ? /* @__PURE__ */ k(x, {
				pl: `${r.contentLeft}px`,
				children: n.emptyContent
			}) : null
		]
	});
}, Xe = (e) => {
	let { box: t, sections: n } = e;
	return /* @__PURE__ */ k(O, { children: t.bands.map((t) => {
		let r = n.find(({ id: e }) => e === t.sectionId);
		return r ? /* @__PURE__ */ k(Ye, {
			...e,
			band: t,
			section: r
		}, t.sectionId ?? "none") : null;
	}) });
}, Ze = (e) => {
	let { tracks: t, boxes: n, width: r, contentLeft: i, onToggleTrack: a, onAddTrack: o } = e, d = Math.max(i, ...n.map((e) => e.x + e.width));
	return /* @__PURE__ */ A(me, {
		w: `${r}px`,
		"data-canvas-control": !0,
		children: [
			/* @__PURE__ */ k(he, {}),
			t.map((e, t) => /* @__PURE__ */ k(ge, {
				left: `${n[t].x}px`,
				w: `${n[t].width}px`,
				justifyContent: e.collapsed ? "center" : void 0,
				role: "group",
				"aria-label": `${e.label} track header`,
				children: e.collapsed ? /* @__PURE__ */ k(u, {
					content: `Expand ${e.label}`,
					children: /* @__PURE__ */ k(T, {
						size: "2xs",
						variant: "ghost",
						"aria-label": `Expand ${e.label}`,
						onClick: () => a?.(e.id),
						children: /* @__PURE__ */ k(s, {})
					})
				}) : /* @__PURE__ */ A(_e, { children: [e.name ?? /* @__PURE__ */ k(ve, { children: e.label }), a ? /* @__PURE__ */ k(u, {
					content: `Collapse ${e.label}`,
					children: /* @__PURE__ */ k(T, {
						size: "2xs",
						variant: "ghost",
						"aria-label": `Collapse ${e.label}`,
						onClick: () => a(e.id),
						children: /* @__PURE__ */ k(c, {})
					})
				}) : null] })
			}, e.id)),
			o ? /* @__PURE__ */ A(S, {
				position: "absolute",
				left: `${d + P}px`,
				top: "2xs",
				size: "2xs",
				variant: "ghost",
				onClick: o,
				children: [/* @__PURE__ */ k(l, {}), "New track"]
			}) : null
		]
	});
}, Qe = (e) => {
	let { tracks: t, boxes: n, height: r, contentLeft: i } = e, a = n.filter((e) => e.x > i).sort((e, t) => e.x - t.x).slice(1);
	return /* @__PURE__ */ A(O, { children: [t.map((e, t) => e.collapsed ? /* @__PURE__ */ k(ye, {
		left: `${n[t].x}px`,
		w: `${n[t].width}px`,
		h: `${r}px`,
		children: /* @__PURE__ */ k(be, { children: e.label })
	}, e.id) : null), a.map((e) => /* @__PURE__ */ k(xe, {
		left: `${e.x - P / 2}px`,
		h: `${r}px`
	}, e.x))] });
};
// packages/ui/src/components/dependency-timeline/use-timeline-window.ts
function $e(e) {
	let [t, n] = b({
		left: 0,
		top: 0,
		focusedId: void 0
	});
	return h(() => {
		let t = e.current;
		if (!t) return;
		let r = 0, i = () => {
			cancelAnimationFrame(r), r = requestAnimationFrame(() => {
				let e = t.ownerDocument.activeElement, r = e instanceof HTMLElement ? e.closest("[data-timeline-item]")?.dataset.timelineItem : void 0, i = {
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
// packages/ui/src/components/dependency-timeline/timeline-content.tsx
var et = (e) => {
	let { viewport: t, box: n, width: r, height: i, canvasWidth: a, canvasHeight: o, zoom: s, sections: c, tracks: l, selectedId: u, draggedId: d, onContext: f } = e, p = $e(t), m = ce(n.contentLeft, p.left, s), h = Ie({
		...p,
		width: r,
		height: i,
		zoom: s
	}), g = c.flatMap(({ items: e }) => e).filter(({ id: e }) => n.positions.has(e)), _ = Re(g, n.positions, h, /* @__PURE__ */ new Set([
		u,
		d,
		p.focusedId
	]));
	return /* @__PURE__ */ A(Se, {
		w: `${a}px`,
		h: `${o}px`,
		onContextMenu: (e) => {
			if (!f || e.target.closest("[data-canvas-control],button,input,[role=menuitem],[data-part=preview]")) return;
			let r = e.currentTarget.getBoundingClientRect();
			if ((e.clientX - t.current.getBoundingClientRect().left) / s < R) return;
			e.preventDefault();
			let i = (e.clientX - r.left) / s, a = (e.clientY - r.top) / s, o = n.bands.find((e) => a >= e.top && a <= e.top + e.height);
			f({
				x: e.clientX,
				y: e.clientY,
				trackId: V(n.tracks, l, i),
				sectionId: o?.sectionId
			});
		},
		children: [
			/* @__PURE__ */ k(Ge, {
				...e,
				bands: n.bands,
				height: o,
				contentLeft: n.contentLeft
			}),
			/* @__PURE__ */ k(Qe, {
				tracks: l,
				boxes: n.tracks,
				height: o,
				contentLeft: n.contentLeft
			}),
			/* @__PURE__ */ k(Pe, {
				...e,
				width: a,
				height: o
			}),
			/* @__PURE__ */ k(Xe, {
				...e,
				width: r / s,
				headerLeft: m
			}),
			/* @__PURE__ */ k(ze, {
				bounds: h,
				items: g,
				positions: n.positions,
				width: n.width,
				height: n.height,
				selectedId: u
			}),
			/* @__PURE__ */ k(Ke, {
				...e,
				items: _
			})
		]
	});
};
// packages/ui/src/components/dependency-timeline/dependency-order.ts
function tt(e, t, n) {
	let r = new Set(e.map(t)), i = /* @__PURE__ */ new Set(), a = [...e], o = [];
	for (; a.length > 0;) {
		let e = a.findIndex((e) => n(e).every((n) => !r.has(n) || i.has(n) || n === t(e))), [s] = a.splice(Math.max(e, 0), 1);
		i.add(t(s)), o.push(s);
	}
	return o;
}
// packages/ui/src/components/dependency-timeline/timeline-layout.ts
var Z = (e, t) => `${e}:${t}`, nt = (e, t, n, r) => !e.taken.get(Z(t, n))?.has(r);
function rt(e, t, n, r) {
	if (r !== void 0 && nt(e, t, n, r)) return r;
	let i = 0;
	for (; !nt(e, t, n, i);) i += 1;
	return i;
}
function it(e, t, n, r) {
	let i = t.dependencies.flatMap(({ id: t }) => e.placed.get(t) ?? []), a = i.find((e) => e.track === n)?.lane, o = Math.max(r, ...i.map((e) => e.row + 1)), s = rt(e, n, o, a), c = {
		id: t.id,
		track: n,
		row: o,
		lane: s
	};
	return e.placed.set(t.id, c), e.taken.set(Z(n, o), /* @__PURE__ */ new Set([...e.taken.get(Z(n, o)) ?? [], s])), c;
}
function at(e, t) {
	let n = new Map(t.map((e, t) => [e.id, t])), r = {
		placed: /* @__PURE__ */ new Map(),
		taken: /* @__PURE__ */ new Map()
	}, i = [], a = [], o = 0;
	for (let s of e) {
		let e = /* @__PURE__ */ new Map(), c = s.items.filter((e) => {
			let r = n.get(e.trackId);
			return r !== void 0 && !t[r].collapsed;
		});
		for (let t of s.collapsed ? [] : tt(c, ({ id: e }) => e, ({ dependencies: e }) => e.map(({ id: e }) => e))) {
			let a = n.get(t.trackId), s = it(r, t, a, e.get(a) ?? o);
			i.push(s), e.set(a, s.row);
		}
		let l = e.size ? Math.max(...e.values()) - o + 1 : 0;
		a.push({
			sectionId: s.id,
			startRow: o,
			rowCount: l,
			collapsed: !!s.collapsed
		}), o += l;
	}
	return {
		nodes: i,
		bands: a,
		trackLanes: t.map(({ collapsed: e }, t) => e ? 0 : Math.max(1, ...i.filter((e) => e.track === t).map(({ lane: e }) => e + 1)))
	};
}
// packages/ui/src/components/dependency-timeline/use-timeline-anchor.ts
function ot(e) {
	let t = y(void 0), n = y(void 0), r = g(() => {
		let r = e.current;
		if (!r || t.current) return;
		let i = r.getBoundingClientRect(), a = [...r.querySelectorAll("[data-timeline-item]")].find((e) => {
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
	return v(() => {
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
// packages/ui/src/components/dependency-timeline/use-item-heights.ts
function st(e, t) {
	let [n, r] = b(/* @__PURE__ */ new Map()), i = ot(e), a = g((e) => {
		let t = e.map((e) => ({
			id: e.target.dataset.timelineItem,
			height: Math.ceil(e.borderBoxSize[0]?.blockSize ?? e.contentRect.height)
		}));
		t.some(({ id: e, height: t }) => n.get(e) !== t) && (i(), r((e) => {
			let n = new Map(e);
			for (let { id: e, height: r } of t) n.set(e, r);
			return n;
		}));
	});
	return h(() => {
		let n = e.current;
		if (!n) return;
		let i = new Set(t.split(","));
		r((e) => [...e.keys()].every((e) => i.has(e)) ? e : new Map([...e].filter(([e]) => i.has(e))));
		let o = new ResizeObserver(a), s = /* @__PURE__ */ new Set(), c = () => {
			let e = new Set(n.querySelectorAll("[data-timeline-item]"));
			for (let t of s) e.has(t) || (o.unobserve(t), s.delete(t));
			for (let t of e) i.has(t.dataset.timelineItem) && !s.has(t) && (o.observe(t), s.add(t));
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
// packages/ui/src/components/dependency-timeline/use-reveal-item.ts
function ct(e) {
	let { ref: t, selectedId: n, box: r, zoom: i } = e, { x: a, y: o, width: s, height: c } = (n ? r.positions.get(n) : void 0) ?? {}, l = g(() => i);
	h(() => {
		let e = t.current;
		if (!n || !e || a === void 0 || o === void 0 || s === void 0 || c === void 0) return;
		let r = l(), i = Math.min(e.scrollLeft, (a - R - I) * r), u = Math.min(e.scrollTop, (o - F - I) * r);
		e.scrollTo({
			left: Math.max(i, (a + s + I) * r - e.clientWidth),
			top: Math.max(u, (o + c + L + I) * r - e.clientHeight),
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
// packages/ui/src/components/dependency-timeline/use-timeline-camera.ts
var lt = (e) => {
	let [{ zoom: t }, n] = b({ zoom: 1 }), r = y(1), i = y(void 0);
	return v(() => {
		let t = i.current;
		t && e.current?.scrollTo({
			left: -t.x,
			top: -t.y
		}), i.current = void 0;
	}), {
		zoom: t,
		onPan: (t) => {
			i.current ? i.current = {
				...i.current,
				x: Math.min(0, i.current.x + t.x),
				y: Math.min(0, i.current.y + t.y)
			} : e.current?.scrollBy({
				left: -t.x,
				top: -t.y
			});
		},
		onZoom: (t) => {
			let a = i.current ?? {
				x: -e.current.scrollLeft,
				y: -e.current.scrollTop,
				zoom: r.current
			}, o = d(a, t);
			i.current = {
				...o,
				x: Math.min(0, o.x),
				y: Math.min(0, o.y)
			}, r.current = o.zoom, n({ zoom: o.zoom });
		},
		onReset: () => {
			i.current = {
				x: 0,
				y: 0,
				zoom: 1
			}, r.current = 1, n({ zoom: 1 });
		}
	};
};
// packages/ui/src/components/dependency-timeline/use-timeline-size.ts
function ut() {
	let e = y(null), [t, n] = b({
		width: 0,
		height: 0
	});
	return h(() => {
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
// packages/ui/src/components/dependency-timeline/dependency-timeline.tsx
var Q = (e) => {
	let { ref: t, sections: n, tracks: r, selectedId: i, "aria-label": a = "Dependency timeline" } = e, { ref: o, width: s, height: c } = ut(), l = lt(o), { zoom: u } = l, d = at(n, r), p = de(d, st(o, d.nodes.map(({ id: e }) => e).join(",")));
	_(t, () => o.current), ct({
		ref: o,
		selectedId: i,
		box: p,
		zoom: u
	});
	let m = Math.max(p.width + (e.onAddTrack ? se : 0), s / u), h = Math.max(p.height, c / u - L);
	return /* @__PURE__ */ k(pe, { children: /* @__PURE__ */ k(f, {
		ref: o,
		"aria-label": a,
		"data-timeline-viewport": !0,
		variant: "pan",
		...l,
		children: /* @__PURE__ */ A(x, {
			"data-timeline-scale": !0,
			css: { zoom: u },
			w: `${m}px`,
			children: [/* @__PURE__ */ k(Ze, {
				...e,
				boxes: p.tracks,
				width: m,
				contentLeft: p.contentLeft
			}), /* @__PURE__ */ k(et, {
				...e,
				box: p,
				viewport: o,
				width: s,
				height: c,
				canvasWidth: m,
				canvasHeight: h,
				zoom: u
			})]
		})
	}) });
}, dt = () => {
	let [e, t] = b("");
	return /* @__PURE__ */ k(ee, {
		"aria-label": "Timeline draft",
		value: e,
		onChange: (e) => t(e.currentTarget.value)
	});
}, ft = (e) => {
	let { label: t, collapsed: n, onToggle: r } = e;
	return /* @__PURE__ */ A(C, {
		h: "full",
		bg: "bg",
		align: "center",
		gap: "sm",
		children: [/* @__PURE__ */ k(T, {
			size: "2xs",
			variant: "ghost",
			"aria-label": `${n ? "Expand" : "Collapse"} ${t}`,
			onClick: r,
			children: k(n ? o : a, {})
		}), /* @__PURE__ */ k(E, {
			textStyle: "label/S/medium",
			children: t
		})]
	});
}, $ = (e) => {
	let { large: t = !1, empty: n = !1, selectedId: r, onContext: i, onCreateSection: a } = e, [o, s] = b(r), [c, l] = b(), [u, d] = b(), [f, p] = b([]), [h, g] = b([]), [_, v] = b({}), y = t ? Array.from({ length: 1e3 }, (e, t) => ({
		id: `work-${t}`,
		title: `Work item ${t + 1}`,
		trackId: "api",
		sectionId: "preview",
		dependencies: t ? [{ id: `work-${t - 1}` }] : []
	})) : [
		{
			id: "api",
			title: "Build the shared API",
			trackId: "api",
			sectionId: "preview",
			dependencies: []
		},
		{
			id: "preview",
			title: "Preview the working component",
			trackId: "design",
			sectionId: "preview",
			dependencies: [{
				id: "api",
				done: !0
			}]
		},
		{
			id: "ship",
			title: "Ship the component after reviewing the preview",
			trackId: "api",
			sectionId: "launch",
			dependencies: [{ id: "preview" }]
		}
	], S = (n ? [] : y).map((e) => ({
		...e,
		..._[e.id],
		related: o !== void 0,
		content: /* @__PURE__ */ k(m, {
			title: e.title,
			eyebrow: e.id.toUpperCase(),
			isSelected: o === e.id,
			onClick: () => s(e.id),
			draggable: !0,
			onDragStart: (t) => {
				t.dataTransfer.setData("text/plain", e.id), l(e.id);
			},
			customSlots: e.id === "api" ? [/* @__PURE__ */ k(dt, {}, "draft")] : void 0
		})
	})), C = (e, t) => e.includes(t) ? e.filter((e) => e !== t) : [...e, t];
	return /* @__PURE__ */ k(x, {
		h: "600px",
		children: /* @__PURE__ */ k(Q, {
			"aria-label": "Release timeline",
			today: "2026-10-10",
			selectedId: o,
			draggedId: c,
			dropTarget: u,
			tracks: [{
				id: "api",
				label: "API"
			}, {
				id: "design",
				label: "Design"
			}].map((e) => ({
				...e,
				collapsed: f.includes(e.id)
			})),
			sections: [{
				id: "preview",
				label: "Preview",
				date: "2026-10-15"
			}, {
				id: "launch",
				label: "Launch",
				date: "2026-10-22"
			}].map((e) => ({
				...e,
				collapsed: h.includes(e.id),
				header: /* @__PURE__ */ k(ft, {
					label: e.label,
					collapsed: h.includes(e.id),
					onToggle: () => g((t) => C(t, e.id))
				}),
				items: S.filter((t) => t.sectionId === e.id)
			})),
			onToggleTrack: (e) => p((t) => C(t, e)),
			onContext: i,
			onCreateSection: a,
			onDropTarget: d,
			onDrop: () => {
				c && u && v((e) => ({
					...e,
					[c]: {
						sectionId: u.sectionId,
						trackId: u.trackId ?? S.find(({ id: e }) => e === c).trackId
					}
				})), l(void 0), d(void 0);
			}
		})
	});
}, pt = {
	title: "Components/Layout/Dependency Timeline",
	component: Q,
	render: (e) => /* @__PURE__ */ k($, {
		onContext: e.onContext,
		onCreateSection: e.onCreateSection,
		selectedId: e.selectedId
	}),
	args: {
		onContext: e(),
		onCreateSection: e()
	},
	parameters: {
		layout: "fullscreen",
		docs: { description: { component: "A dependency timeline with milestone sections and collapsible tracks, built on Canvas. Supply item content and section headers; the component owns layout, measured card heights, dependency edges, windowing, and navigation. Callers own data, saved presentation, and actions. Use the exported DependencyTimeline component and TimelineItem/TimelineSection/TimelineTrack types." } }
	}
}, mt = { play: async ({ canvasElement: e }) => {
	let n = t(e);
	await r.type(n.getByRole("textbox", { name: "Timeline draft" }), "Keep this draft"), await r.click(n.getByRole("button", {
		name: "Zoom out",
		exact: !0
	})), await i(n.getByRole("textbox", { name: "Timeline draft" })).toHaveValue("Keep this draft"), await i(n.getByRole("button", { name: /Reset zoom to 100%, current zoom 90%/ })).toBeVisible();
} }, ht = { play: async ({ canvasElement: e }) => {
	let n = t(e);
	await r.click(n.getByRole("button", {
		name: "Collapse API",
		exact: !0
	})), await i(n.getByRole("button", {
		name: "Expand API",
		exact: !0
	})).toBeVisible(), await i(n.queryByRole("textbox", { name: "Timeline draft" })).toBeNull(), await r.click(n.getByRole("button", {
		name: "Expand API",
		exact: !0
	})), await r.click(n.getByRole("button", {
		name: "Collapse Preview",
		exact: !0
	})), await i(n.queryByRole("textbox", { name: "Timeline draft" })).toBeNull(), await r.click(n.getByRole("button", {
		name: "Expand Preview",
		exact: !0
	})), await i(n.getByRole("textbox", { name: "Timeline draft" })).toBeVisible();
} }, gt = { render: () => /* @__PURE__ */ k($, { empty: !0 }) }, _t = {
	render: () => /* @__PURE__ */ k(x, {
		h: "400px",
		children: /* @__PURE__ */ k(Q, {
			today: "2026-10-10",
			tracks: [],
			sections: [{
				id: "release",
				header: "Release",
				items: [{
					id: "orphan",
					trackId: "missing",
					dependencies: [],
					content: "Unassigned item"
				}]
			}]
		})
	}),
	play: async ({ canvasElement: e }) => {
		let n = t(e);
		await i(n.getByText("Release")).toBeVisible(), await i(n.queryByText("Unassigned item")).toBeNull();
	}
}, vt = { args: { selectedId: "ship" } }, yt = {
	tags: ["!manifest"],
	render: () => /* @__PURE__ */ k($, { large: !0 }),
	play: async ({ canvasElement: e }) => {
		let t = e.querySelector("[data-timeline-viewport]");
		await n(() => i(t.querySelectorAll("[data-timeline-item]").length).toBeLessThan(15)), await i(t.querySelectorAll("[data-edge-layer] path").length).toBeLessThan(60), t.scrollTop = t.scrollHeight, await n(() => i(t.querySelector("[data-timeline-item=\"work-999\"]")).not.toBeNull()), await i(t.querySelectorAll("[data-edge-layer] path").length).toBeGreaterThan(0), await i(t.querySelectorAll("[data-edge-layer] path").length).toBeLessThan(60);
	}
}, bt = { render: () => /* @__PURE__ */ k(x, {
	h: "400px",
	children: /* @__PURE__ */ k(Q, {
		today: "2026-10-10",
		tracks: [{
			id: "work",
			label: "Work"
		}],
		sections: []
	})
}) };
export { ht as CollapsibleTracksAndMilestones, gt as Empty, yt as LargePlan, bt as Minimal, _t as NoTracks, mt as ReleasePlan, vt as SelectedDependencies, pt as default };
