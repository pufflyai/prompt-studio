// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./shield-check-8abL6TC4.ts";
import { i as t, t as n } from "./review-request-summary-Dm_YOaPy.ts";
import { t as r } from "./ticket-board-Clw0UQea.ts";
import { useEffect as i, useState as a } from "react";
import { Box as o, Flex as s, Icon as c, Text as l } from "@chakra-ui/react";
import { DropIndicator as u, ResourceContextMenu as d, Tooltip as f, getIconComponent as p } from "@pstdio/ui";
import { jsx as m, jsxs as h } from "react/jsx-runtime";
import { CollectionBadge as g, KanbanRendererCard as _, collectDisplayBadges as v, getAttributeValue as y, renderBadgeListDisplay as b } from "@pstdio/ui/kanban-renderer";
// extensions/pstdio-planner/src/timeline/view/status-icon.tsx
function x(e) {
	let { row: t } = e, n = t.status?.name ?? "No status", r = t.dependsOn.filter(({ done: e }) => !e).map(({ shorthand: e }) => e), i = [
		n,
		r.length ? `Needs ${r.join(", ")}` : "",
		t.blockedReason ?? ""
	].filter(Boolean).join(" · ");
	return /* @__PURE__ */ m(f, {
		content: i,
		children: /* @__PURE__ */ m(o, {
			as: "span",
			role: "img",
			"aria-label": n,
			tabIndex: 0,
			color: t.status?.color ? `${t.status.color}.fg` : "fg.muted",
			display: "inline-flex",
			flexShrink: "0",
			children: /* @__PURE__ */ m(c, {
				as: p(t.status?.icon ?? "circle"),
				boxSize: "4"
			})
		})
	});
}
function S(e) {
	let { row: r, onOpen: i } = e, a = t({
		requests: r.requests,
		errors: r.requestErrors
	});
	return a ? /* @__PURE__ */ m(g, {
		label: String(a.count),
		icon: n,
		color: a.color,
		tooltip: a.tooltip,
		onClick: i
	}) : null;
}
// extensions/pstdio-planner/src/timeline/view/graph-geometry.ts
var C = {
	width: 240,
	height: 68
}, w = 32, T = 40, E = 56, D = 16, O = (e, t, n) => Math.max(72, e - t / n);
function k(e) {
	let t = 72 + e.filter((e) => e === 0).length * 36, n = 72, r = t + 16;
	return {
		tracks: e.map((e) => {
			if (e === 0) {
				let e = {
					x: n,
					width: 36
				};
				return n += 36, e;
			}
			let t = {
				x: r,
				width: e * (C.width + w) - w
			};
			return r += t.width + w + 24, t;
		}),
		contentLeft: t
	};
}
function A(e, t) {
	let n = 16;
	return {
		boxes: e.map((e) => {
			let r = e.collapsed ? 0 : Math.max(t[e.startRow + e.rowCount] - t[e.startRow], E), i = {
				...e,
				top: n,
				bodyTop: n + 42,
				height: 42 + r
			};
			return n += i.height + D, i;
		}),
		height: n
	};
}
function j(e, t = /* @__PURE__ */ new Map()) {
	let { tracks: n, contentLeft: r } = k(e.trackLanes), i = Array.from({ length: Math.max(0, ...e.bands.map((e) => e.startRow + e.rowCount)) }, () => C.height);
	for (let n of e.nodes) i[n.row] = Math.max(i[n.row], t.get(n.id) ?? C.height);
	let a = [0];
	for (let e of i) a.push(a.at(-1) + e + T);
	let { boxes: o, height: s } = A(e.bands, a), c = (e) => o.find((t) => e >= t.startRow && e < t.startRow + t.rowCount) ?? o[0];
	return {
		bands: o,
		tracks: n,
		positions: new Map(e.nodes.map((e) => {
			let r = c(e.row);
			return [e.id, {
				x: n[e.track].x + e.lane * (C.width + w),
				y: r.bodyTop + a[e.row] - a[r.startRow] + 20,
				width: C.width,
				height: t.get(e.id) ?? C.height
			}];
		})),
		contentLeft: r,
		width: Math.max(r, ...n.map((e) => e.x + e.width)) + 16,
		height: s
	};
}
// extensions/pstdio-planner/src/timeline/view/graph-layers.ts
var M = {
	milestone: 3,
	arrows: 4,
	node: 5,
	hierarchyArrows: 6,
	hierarchyNode: 7,
	gutter: 8,
	date: 9,
	tracks: 10,
	milestonePreview: 11
};
// extensions/pstdio-planner/src/timeline/view/ticket-card-interaction.tsx
function N(e, t) {
	let [n, r] = a([]), [o, s] = a(), l = e?.host, u = t?.resource;
	return i(() => {
		let e = !0;
		if (!l || !u) return;
		let t = () => l.call("resources.actions", {
			operation: "list",
			resource: u
		}).then((t) => {
			e && r(t.map((e) => ({
				...e,
				icon: e.icon ? /* @__PURE__ */ m(c, {
					as: p(e.icon),
					boxSize: "4"
				}) : void 0,
				onClick: async () => {
					s(void 0);
					try {
						await l.call("resources.actions", {
							operation: "execute",
							resource: u,
							key: e.key
						});
					} catch (e) {
						s(String(e));
					}
				}
			})));
		}).catch((t) => {
			e && s(String(t));
		}), n = l.onEvent("resources.actions", () => void t());
		return t(), () => {
			e = !1, n();
		};
	}, [l, u]), {
		actions: n,
		onBadgeChange: async (n, r) => {
			if (e && t) {
				s(void 0);
				try {
					await e.client.commands["set-ticket-attribute"]({
						rowId: t.id,
						attributeId: n,
						value: r
					});
				} catch (e) {
					s(String(e));
				}
			}
		},
		error: o
	};
}
function P(e) {
	let { error: t } = e;
	return t ? /* @__PURE__ */ m(l, {
		role: "alert",
		color: "fg.error",
		textStyle: "paragraph/S/regular",
		children: t
	}) : null;
}
// extensions/pstdio-planner/src/timeline/view/graph-card.tsx
function F(e) {
	let { row: t, x: n, y: i, relation: a, dropBefore: s, interaction: c, ...l } = e, f = c?.rows.get(t.id), p = N(c, f), g = c?.attributes ?? [], x = c?.displayProperties ?? r, w = t.status ? [{
		attributeId: "status",
		label: t.status.name,
		icon: t.status.icon,
		color: t.status.color
	}] : [], T = f ? v(f, g, x.filter((e) => ![
		"id",
		"needsAttention",
		"reviewRequests"
	].includes(e))) : w, E = f ? g.filter(({ id: e, displayable: t }) => t && !["needsAttention", "reviewRequests"].includes(e) && c?.displayProperties.includes(e)).map((e) => b(e, y(f, e), f, void 0, (t) => {
		let n = f.attributes[e.display.itemsAttributeId].find((e) => e.id === t)?.target;
		return n ? () => void c?.host.call("navigation.open", { target: n }) : void 0;
	})) : [], D = () => {
		c ? c.host.call("navigation.open", { target: t.target }) : l.onSelect(t.id);
	}, O = t.flags.includes("waiting"), k = 1;
	return O && (k = .8), t.done && (k = .6), /* @__PURE__ */ m(d, {
		actions: p.actions,
		keepMountedWhenEmpty: !0,
		children: /* @__PURE__ */ h(o, {
			"data-ticket": t.id,
			role: "button",
			tabIndex: 0,
			"aria-label": `${t.shorthand} ${t.title}`,
			onKeyDown: (e) => {
				e.target === e.currentTarget && (e.key === "Enter" || e.key === " ") && (e.preventDefault(), D());
			},
			position: "absolute",
			left: `${n}px`,
			top: `${i}px`,
			w: `${C.width}px`,
			zIndex: a ? M.hierarchyNode : M.node,
			opacity: k,
			title: `${t.shorthand} ${t.title}`,
			onDragOver: (e) => {
				e.preventDefault(), e.stopPropagation(), l.onDragOver();
			},
			onDrop: (e) => {
				e.preventDefault(), e.stopPropagation(), l.onDrop();
			},
			children: [
				s ? /* @__PURE__ */ m(u, { top: "-12px" }) : null,
				/* @__PURE__ */ m(_, {
					eyebrow: !c || c.displayProperties.includes("id") ? [...t.ancestors, t].map(({ shorthand: e }) => e).join("/") : void 0,
					title: t.title,
					isSelected: a === "selected",
					badges: T,
					onBadgeChange: c ? p.onBadgeChange : void 0,
					customSlots: [
						...E,
						x.includes("needsAttention") ? /* @__PURE__ */ m(S, {
							row: t,
							onOpen: l.onOpenRequests ? () => l.onOpenRequests?.(t) : void 0
						}, "review") : null,
						t.gate ? /* @__PURE__ */ m(I, {}, "gate") : null
					],
					onClick: D,
					draggable: !0,
					onDragStart: (e) => {
						e.dataTransfer.effectAllowed = "move", e.dataTransfer.setData("text/plain", t.id), l.onDragStart(t.id);
					}
				}),
				/* @__PURE__ */ m(P, { error: p.error })
			]
		})
	});
}
function I() {
	return /* @__PURE__ */ m(f, {
		content: "Agent gate · review dependencies and update the plan",
		children: /* @__PURE__ */ h(s, {
			role: "img",
			"aria-label": "Agent gate",
			tabIndex: 0,
			gap: "2xs",
			color: "fg.accent",
			children: [/* @__PURE__ */ m(c, {
				as: e,
				boxSize: "14px"
			}), /* @__PURE__ */ m(l, {
				textStyle: "label/XS/medium",
				children: "GATE"
			})]
		})
	});
}
export { O as a, j as i, M as n, S as o, C as r, x as s, F as t };
