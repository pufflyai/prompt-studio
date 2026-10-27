// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./chevron-right-CRFNEcZT.ts";
import { _ as t, a as n, b as r, g as i, l as a, m as o, s, t as c, x as l, y as u } from "./core.esm-cje5eyjm.ts";
import { t as d } from "./use-virtualizer-DJbWYnTZ.ts";
import { c as f, n as p, o as m, s as h, t as g } from "./list-row-BhxGCvIh.ts";
import { t as _ } from "./drop-indicator-Bqz21pYA.ts";
import { a as v, i as y, t as b } from "./sortable.esm-R8iGneY7.ts";
import { Fragment as x, createContext as S, useContext as C, useEffect as w, useRef as T, useState as E } from "react";
import { Box as D, Flex as O, HStack as k, IconButton as A, Input as ee, Stack as j, Text as te, useRecipe as M } from "@chakra-ui/react";
import { Fragment as ne, jsx as N, jsxs as P } from "react/jsx-runtime";
// packages/ui/src/components/tree-list/tree-list-background.tsx
var re = (e) => {
	let { actions: t, children: n } = e;
	return /* @__PURE__ */ P(D, {
		position: "relative",
		flex: "1 0 auto",
		minH: "full",
		w: "full",
		minW: "0",
		maxW: "full",
		children: [/* @__PURE__ */ N(f, {
			actions: t,
			closeOnSelect: !1,
			children: /* @__PURE__ */ N(D, {
				position: "absolute",
				inset: "0",
				zIndex: 0,
				"aria-hidden": !0,
				"data-tree-list-background": "true"
			})
		}), /* @__PURE__ */ N(D, {
			position: "relative",
			zIndex: 1,
			w: "full",
			minW: "0",
			maxW: "full",
			children: n
		})]
	});
}, F = (e, t) => t.includes(e), ie = (e, t) => Array.isArray(t) ? t.includes(e) : t === e, ae = (e) => e.isNavigable || e.navigationIntent !== void 0, I = (e) => e.children ?? [], oe = (e) => I(e).length > 0 || e.isContainer === !0, L = (e) => {
	let { rows: t, sectionId: n, nodes: r, expandedNodeIds: i, level: a, parentNodeId: o } = e;
	for (let e of r) {
		t.push({
			kind: "node",
			key: `${n}:${e.id}`,
			sectionId: n,
			node: e,
			level: a,
			parentNodeId: o
		});
		let r = I(e);
		r.length !== 0 && F(e.id, i) && L({
			rows: t,
			sectionId: n,
			nodes: r,
			expandedNodeIds: i,
			level: a + 1,
			parentNodeId: e.id
		});
	}
}, R = (e, t, n) => {
	let r = [];
	for (let i of e) {
		let e = i.collapsible !== !1 && i.label !== void 0, a = !e || F(i.id, t);
		i.label && r.push({
			kind: "section-header",
			key: `header:${i.id}`,
			sectionId: i.id,
			section: i,
			collapsible: e,
			expanded: a
		}), a && (i.nodes.length === 0 ? i.emptyState && r.push({
			kind: "section-empty",
			key: `empty:${i.id}`,
			sectionId: i.id,
			emptyState: i.emptyState
		}) : L({
			rows: r,
			sectionId: i.id,
			nodes: i.nodes,
			expandedNodeIds: n,
			level: 0
		}));
	}
	return r;
}, z = (e) => e.kind === "node" ? e.node.id : e.key, se = (e) => e.kind === "node" ? e.node.disabled !== !0 : e.kind === "section-header" && e.collapsible, B = (e) => e.filter(se), ce = (e, t, n) => {
	let r = B(n), i = new Set(r.map(z));
	if (e && i.has(e)) return e;
	let a = (t ? [t].flat() : []).find((e) => i.has(e));
	if (a) return a;
	let o = r[0];
	return o ? z(o) : void 0;
}, le = (e) => {
	let { row: t, focusableRows: n, currentIndex: r, key: i } = e;
	if (i === "Enter" || i === " ") return {
		type: "toggle-section",
		sectionId: t.sectionId
	};
	if (i === "ArrowRight") {
		if (!t.expanded) return {
			type: "toggle-section",
			sectionId: t.sectionId
		};
		let e = n[r + 1];
		return e?.kind === "node" && e.sectionId === t.sectionId ? {
			type: "focus",
			rowId: e.node.id
		} : null;
	}
	return i === "ArrowLeft" && t.expanded ? {
		type: "toggle-section",
		sectionId: t.sectionId
	} : null;
}, ue = (e) => {
	let { row: t, focusableRows: n, currentIndex: r, expandedNodeIds: i, key: a } = e, o = F(t.node.id, i), s = oe(t.node);
	if (a === "ArrowRight") {
		if (!s) return null;
		if (!o) return {
			type: "toggle-node",
			nodeId: t.node.id
		};
		let e = n[r + 1];
		return e?.kind === "node" && e.parentNodeId === t.node.id ? {
			type: "focus",
			rowId: e.node.id
		} : null;
	}
	if (a === "ArrowLeft") {
		if (s && o) return {
			type: "toggle-node",
			nodeId: t.node.id
		};
		if (t.parentNodeId) return {
			type: "focus",
			rowId: t.parentNodeId
		};
	}
	return null;
}, de = (e) => {
	let { rows: t, focusedRowId: n, activeNodeId: r, expandedNodeIds: i, key: a } = e, o = B(t);
	if (o.length === 0) return null;
	let s = ce(n, r, t), c = Math.max(0, o.findIndex((e) => z(e) === s)), l = o[c];
	if (!l) return null;
	let u = (e) => {
		let t = Math.min(Math.max(e, 0), o.length - 1);
		return {
			type: "focus",
			rowId: z(o[t])
		};
	};
	return a === "ArrowDown" ? u(c + 1) : a === "ArrowUp" ? u(c - 1) : a === "Home" ? u(0) : a === "End" ? u(o.length - 1) : l.kind === "section-header" ? le({
		row: l,
		focusableRows: o,
		currentIndex: c,
		key: a
	}) : ue({
		row: l,
		focusableRows: o,
		currentIndex: c,
		expandedNodeIds: i,
		key: a
	});
}, fe = "application/x-pstdio-tree-node", pe = (e, t) => {
	e.setData(fe, t);
}, me = (e) => e.getData(fe) || void 0, he = (e) => {
	let { children: t, onMoveNode: n } = e;
	return /* @__PURE__ */ N(D, {
		p: "xs",
		w: "full",
		minW: "0",
		maxW: "full",
		minH: "full",
		flex: "1 0 auto",
		onDragOver: (e) => {
			n && (e.preventDefault(), e.dataTransfer.dropEffect = "move");
		},
		onDrop: (e) => {
			if (!n) return;
			e.preventDefault();
			let t = me(e.dataTransfer);
			t && n(t, void 0, "inside");
		},
		children: t
	});
}, ge = (e) => e <= 0 ? "sm" : `calc(var(--chakra-spacing-1) + ${e} * 12px)`, _e = (e) => {
	let { input: t, icon: n, level: r } = e, [i, a] = E(t.defaultValue ?? ""), [o, s] = E(), c = T(null), l = T(!1), u = async () => {
		if (!l.current) {
			l.current = !0, s(void 0);
			try {
				await t.onCommit(i.trim());
			} catch (e) {
				s(e instanceof Error ? e.message : "Could not create file."), queueMicrotask(() => c.current?.focus());
			} finally {
				l.current = !1;
			}
		}
	};
	return /* @__PURE__ */ P(O, {
		h: "1.75rem",
		w: "full",
		minW: "0",
		alignItems: "center",
		gap: "1",
		pr: "sm",
		pl: ge(r),
		onMouseDown: (e) => e.stopPropagation(),
		children: [n ? /* @__PURE__ */ N(D, {
			boxSize: "16px",
			color: "fg.muted",
			flexShrink: 0,
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			css: { "& > svg": {
				width: "16px",
				height: "16px"
			} },
			children: n
		}) : null, /* @__PURE__ */ N(ee, {
			ref: c,
			autoFocus: !0,
			size: "xs",
			value: i,
			"aria-label": t.ariaLabel,
			"aria-invalid": !!o || void 0,
			placeholder: t.placeholder,
			title: o,
			onChange: (e) => a(e.currentTarget.value),
			onBlur: () => {
				l.current || t.onCancel?.();
			},
			onKeyDown: (e) => {
				e.stopPropagation(), e.key === "Enter" && (e.preventDefault(), u()), e.key === "Escape" && !l.current && (e.preventDefault(), t.onCancel?.());
			}
		})]
	});
}, ve = (e, t, n, r, i) => {
	if (i.shiftKey && r && e.includes(r)) {
		let t = e.indexOf(r), i = e.indexOf(n);
		return e.slice(Math.min(t, i), Math.max(t, i) + 1);
	}
	return i.ctrlKey || i.metaKey ? t.includes(n) ? t.filter((e) => e !== n) : [...t, n] : [n];
}, ye = (e, t, n, r = []) => {
	let i = (e) => {
		if (e.some((e) => e.id === t)) return e;
		for (let t of e) {
			let e = i(t.children ?? []);
			if (e) return e;
		}
	};
	for (let a of e) {
		let e = i(a.nodes)?.filter((e) => !e.disabled);
		if (!e) continue;
		let o = e.findIndex((e) => e.id === t), s = e[o], c = e.flatMap((e, t) => r.includes(e.id) ? [t] : []), l = o;
		r.includes(t) && c.length && (l = n === -1 ? Math.min(...c) : Math.max(...c));
		let u = e[l + n];
		return !s?.canDrag || !u?.canDrop ? void 0 : {
			source: t,
			target: u.id,
			position: n === -1 ? "before" : "after"
		};
	}
}, V = S(void 0), be = S(void 0), xe = (e) => {
	let { tree: t, children: n } = e, r = T(void 0), i = [t.activeNodeId ?? []].flat(), a = R(t.sections, t.expandedSectionIds ?? [], t.expandedNodeIds ?? []).flatMap((e) => e.kind === "node" && !e.node.disabled ? [e.node.id] : []), o = (e, n, o) => {
		n.preventDefault(), n.shiftKey ? r.current ??= i[0] ?? o ?? e : r.current = e, t.onSelectionChange?.(ve(a, i, e, r.current, n));
	};
	return /* @__PURE__ */ N(be, {
		value: t.onMoveNode ? (e, n) => {
			if (n.target === n.currentTarget && n.altKey && (n.key === "ArrowUp" || n.key === "ArrowDown")) {
				n.preventDefault(), n.stopPropagation();
				let r = ye(t.sections, e, n.key === "ArrowUp" ? -1 : 1, t.moveSelection ? i : []);
				r && t.onMoveNode?.(r.source, r.target, r.position);
			}
		} : void 0,
		children: /* @__PURE__ */ N(V, {
			value: t.onSelectionChange ? {
				select: o,
				keyDown: (e, t) => {
					t.target === t.currentTarget && (t.key === " " || t.key === "Enter") && o(e, t);
				}
			} : void 0,
			children: n
		})
	});
}, Se = (e) => {
	let { sectionId: t, node: n, level: r, expandedNodeIds: i, activeNodeId: a, rowVariant: o, nodeGap: s, linkComponent: c, tabIndex: l, onFocus: u, onNavigate: d, onToggleNode: f, onMoveNode: p } = e, [m, h] = E(null), v = C(V), y = C(be);
	if (n.inlineInput) return /* @__PURE__ */ N(_e, {
		input: n.inlineInput,
		icon: n.icon,
		level: r
	});
	let b = oe(n), x = b && F(n.id, i), S = ie(n.id, a), w = n.disabled === !0, T = ae(n), D = !!(c && n.href && T && !b && !w), O = () => {
		w || (T && d ? (b && f?.(n.id), d({
			sectionId: t,
			nodeId: n.id,
			node: n,
			intent: n.navigationIntent
		})) : b ? f?.(n.id) : n.onActivate?.());
	}, k = (e) => {
		pe(e.dataTransfer, n.id), e.dataTransfer.effectAllowed = "move";
	}, A = (e) => {
		let t = e.currentTarget.getBoundingClientRect(), n = (e.clientY - t.top) / t.height;
		return b && n > .3 && n < .7 ? "inside" : e.clientY < t.top + t.height / 2 ? "before" : "after";
	}, ee = (e) => {
		p && (e.stopPropagation(), n.canDrop && (e.preventDefault(), e.dataTransfer.dropEffect = "move", h(A(e))));
	}, te = (e) => {
		if (!p || (e.stopPropagation(), !n.canDrop)) return;
		e.preventDefault(), h(null);
		let t = me(e.dataTransfer);
		t && t !== n.id && p(t, n.id, A(e));
	}, { inlineInput: M, rowVariant: ne, ...re } = {
		...n,
		actions: n.actions?.map((e) => ({
			...e,
			onAction: e.onAction ? (r) => e.onAction?.({
				sectionId: t,
				nodeId: n.id,
				...r
			}) : void 0
		}))
	}, I = {
		...re,
		depth: r,
		variant: ne ?? o,
		isSelected: S,
		isExpanded: x,
		showExpandToggle: b,
		expandOnClick: !v,
		tabIndex: l,
		"data-tree-list-focus-id": n.id,
		"aria-level": r + 1,
		"aria-expanded": b ? x : void 0,
		"data-tree-list-node-id": n.id,
		onFocus: u,
		onClick: v ? (e) => {
			w || v.select(n.id, e);
		} : void 0,
		onKeyDown: v || y ? (e) => {
			w || (y?.(n.id, e), e.defaultPrevented || v?.keyDown(n.id, e));
		} : void 0,
		onActivate: O,
		onToggleExpand: v ? () => f?.(n.id) : O
	}, L = D && c && n.href ? /* @__PURE__ */ N(c, {
		to: n.href,
		children: /* @__PURE__ */ N(g, {
			...I,
			asChild: !0
		})
	}) : /* @__PURE__ */ N(g, { ...I });
	return /* @__PURE__ */ P(j, {
		gap: s,
		w: "full",
		minW: "0",
		maxW: "full",
		position: "relative",
		bg: m === "inside" ? "bg.accent-subtle" : void 0,
		draggable: !!(p && n.canDrag),
		onDragStart: n.canDrag ? k : void 0,
		onDragOver: p ? ee : void 0,
		onDrop: p ? te : void 0,
		onDragLeave: (e) => {
			e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget) || h(null);
		},
		children: [L, m === "before" || m === "after" ? /* @__PURE__ */ N(_, {
			"data-tree-list-drop-indicator": m,
			...m === "before" ? {
				top: "0",
				transform: "translateY(-50%)"
			} : {
				bottom: "0",
				transform: "translateY(50%)"
			}
		}) : null]
	});
}, H = (e) => {
	let { open: t, children: n } = e, r = M({ key: "treeReveal" });
	return /* @__PURE__ */ N(D, {
		css: r(),
		"data-tree-reveal": "",
		"data-open": t,
		inert: !t,
		"aria-hidden": !t,
		children: /* @__PURE__ */ N(D, { children: n })
	});
}, Ce = "section:", U = (e) => `${Ce}${e}`, W = (e) => e.startsWith(Ce), G = (e) => e.slice(8), we = "after-section:", K = (e) => `${we}${e}`, q = (e) => e.startsWith(we), Te = (e) => e.slice(14), Ee = (e) => {
	if (W(e)) return G(e);
	if (q(e)) return Te(e);
}, J = (e, t) => {
	for (let n of e) {
		let e = n.nodes.findIndex((e) => e.id === t);
		if (e >= 0) return {
			section: n,
			index: e,
			node: n.nodes[e]
		};
	}
}, De = (e, t) => t?.(e) ?? !0, Y = (e, t, n, r) => {
	if (t === n) return !0;
	let i = Ee(n);
	if (W(t)) {
		if (i === void 0) return !1;
		let n = e.find((e) => e.id === G(t)), a = e.find((e) => e.id === i);
		return !n || !a || n.canReorder === !1 || a.canReorder === !1 ? !1 : De({
			source: {
				kind: "section",
				sectionId: n.id,
				id: n.id,
				moveScope: n.moveScope
			},
			destination: {
				kind: "section",
				sectionId: a.id,
				id: a.id,
				moveScope: a.moveScope
			}
		}, r);
	}
	let a = J(e, t);
	if (!a || a.node.canReorder === !1) return !1;
	let o = i === void 0 ? void 0 : e.find((e) => e.id === i), s = i === void 0 ? J(e, n) : void 0, c = o ?? s?.section;
	return !c || c.canReorder === !1 || s?.node.canReorder === !1 ? !1 : De({
		source: {
			kind: "node",
			sectionId: a.section.id,
			id: a.node.id,
			moveScope: a.node.moveScope ?? a.section.moveScope
		},
		destination: s ? {
			kind: "node",
			sectionId: c.id,
			id: s.node.id,
			moveScope: s.node.moveScope ?? c.moveScope
		} : {
			kind: "section",
			sectionId: c.id,
			id: c.id,
			moveScope: c.moveScope
		}
	}, r);
}, Oe = {
	modifiers: [({ transform: e }) => ({
		...e,
		x: 0
	})],
	autoScroll: { threshold: {
		x: 0,
		y: .2
	} },
	measuring: { droppable: { strategy: n.Always } }
}, ke = {
	before: {
		top: "0",
		transform: "translateY(-50%)"
	},
	after: {
		bottom: "0",
		transform: "translateY(50%)"
	},
	middle: {
		top: "50%",
		transform: "translateY(-50%)"
	}
}, X = (e) => {
	if (!(e instanceof Element)) return !0;
	let t = e.closest("button, a, input, textarea, select, [role=button]");
	return !t || t.hasAttribute("data-tree-list-focus-id");
}, Z = (e) => {
	let { edge: t } = e;
	return /* @__PURE__ */ N(_, {
		"data-tree-list-drop-indicator": t,
		...ke[t]
	});
}, Q = (e) => {
	let { id: t, disabled: n, indicator: r, handle: i, liftedBg: a, highlighted: o, children: s } = e, c = y({
		id: t,
		disabled: n
	}), l = r?.lineId === t ? r.edge : void 0, u = c.isDragging ? a : void 0;
	return /* @__PURE__ */ P(D, {
		ref: c.setNodeRef,
		position: "relative",
		w: "full",
		minW: "0",
		borderRadius: "xs",
		opacity: c.isDragging ? .5 : 1,
		bg: o ? "bg.accent-subtle" : u,
		"data-tree-list-drop-group": o ? "" : void 0,
		onPointerDownCapture: i === "self" ? (e) => {
			X(e.target) && c.listeners?.onPointerDown?.(e);
		} : void 0,
		children: [s(c.listeners), l ? /* @__PURE__ */ N(Z, { edge: l }) : null]
	});
}, Ae = (e) => {
	let { sectionId: t, nextSectionId: n, gap: r, indicator: i } = e, a = K(t), o = u({
		id: a,
		data: { nextSectionId: n }
	});
	return /* @__PURE__ */ N(D, {
		ref: o.setNodeRef,
		position: n ? "relative" : "absolute",
		top: n ? void 0 : "100%",
		w: "full",
		pt: n ? r : "xs",
		flexShrink: 0,
		children: i?.lineId === a ? /* @__PURE__ */ N(Z, { edge: "middle" }) : null
	});
}, je = (e) => {
	let { node: t, nodes: n, level: r = 0, focusRowId: i, onRowFocus: a, sortable: o, indicator: s = null, ...c } = e, l = I(t), u;
	i !== void 0 && (u = t.id === i ? 0 : -1);
	let d = /* @__PURE__ */ N(Se, {
		...c,
		node: t,
		level: r,
		tabIndex: u,
		onFocus: () => a?.(t.id)
	}), f = l.length ? /* @__PURE__ */ N(H, {
		open: c.expandedNodeIds.includes(t.id),
		children: /* @__PURE__ */ N(D, {
			pt: c.nodeGap,
			children: /* @__PURE__ */ N($, {
				...e,
				nodes: l,
				level: r + 1
			})
		})
	}) : null;
	return o && r === 0 ? /* @__PURE__ */ P(D, {
		position: "relative",
		minW: "0",
		children: [
			/* @__PURE__ */ N(Q, {
				id: t.id,
				disabled: t.canReorder === !1,
				indicator: s?.edge === "after" ? null : s,
				handle: "child",
				liftedBg: "bg.hover",
				children: (e) => /* @__PURE__ */ N(D, {
					onPointerDownCapture: (t) => {
						X(t.target) && e?.onPointerDown?.(t);
					},
					children: d
				})
			}),
			f,
			s?.lineId === t.id && s.edge === "after" ? /* @__PURE__ */ N(Z, { edge: "after" }) : null
		]
	}) : /* @__PURE__ */ P(D, {
		position: "relative",
		minW: "0",
		children: [
			d,
			f,
			s?.lineId === t.id ? /* @__PURE__ */ N(Z, { edge: s.edge }) : null
		]
	});
}, $ = (e) => {
	let { nodes: t, nodeGap: n } = e;
	return /* @__PURE__ */ N(j, {
		gap: n,
		w: "full",
		minW: "0",
		children: t.map((t) => /* @__PURE__ */ N(je, {
			...e,
			node: t
		}, t.id))
	});
}, Me = (e) => {
	let { sectionId: t, actions: n } = e, r = M({ key: "listRowAccessory" });
	return n.length === 0 ? null : /* @__PURE__ */ N(k, {
		gap: "0",
		css: r({ visibility: "hover" }),
		onClick: (e) => e.stopPropagation(),
		children: n.map((e) => e.menuItems && e.menuItems.length >= 8 ? /* @__PURE__ */ N(p, { action: e }, e.id) : e.menuItems && e.menuItems.length > 0 ? /* @__PURE__ */ N(h, {
			actions: m(e.menuItems),
			children: /* @__PURE__ */ N(A, {
				variant: "ghost",
				size: "2xs",
				"aria-label": e.label,
				children: e.icon
			})
		}, e.id) : /* @__PURE__ */ N(A, {
			variant: "ghost",
			size: "2xs",
			"aria-label": e.label,
			onClick: (n) => {
				n.stopPropagation(), e.onAction?.({ sectionId: t });
			},
			children: e.icon
		}, e.id))
	});
}, Ne = (t) => {
	let { section: n, collapsible: r, expanded: i, focusId: a, tabIndex: o, onFocus: s, onToggle: c, onContextMenu: l } = t, u = M({ key: "treeChevron" });
	if (n.inlineInput) return /* @__PURE__ */ N(_e, {
		input: n.inlineInput,
		level: 0
	});
	let d = m(n.contextMenuItems ?? []);
	return /* @__PURE__ */ N(f, {
		actions: d,
		children: /* @__PURE__ */ P(k, {
			className: "group",
			justify: "space-between",
			align: "center",
			w: "full",
			minW: "0",
			maxW: "full",
			px: "sm",
			py: "2xs",
			height: "7",
			cursor: r ? "pointer" : "default",
			tabIndex: r ? o : void 0,
			"data-tree-list-focus-id": r ? a : void 0,
			"aria-expanded": r ? i : void 0,
			_hover: r ? { bg: "bg.hover" } : void 0,
			_focusVisible: r ? { bg: "bg.hover" } : void 0,
			onFocus: r ? s : void 0,
			onClick: r ? c : void 0,
			onContextMenu: l ? (e) => {
				e.preventDefault(), l(e, n.id);
			} : void 0,
			children: [/* @__PURE__ */ P(k, {
				gap: "1",
				flex: "1",
				minW: "0",
				children: [
					n.icon,
					/* @__PURE__ */ N(te, {
						textStyle: "label/XS",
						textTransform: "uppercase",
						color: "fg.muted",
						letterSpacing: "0.08em",
						truncate: !0,
						children: n.label
					}),
					r ? /* @__PURE__ */ N(D, {
						color: "fg.muted",
						flexShrink: 0,
						children: /* @__PURE__ */ N(D, {
							asChild: !0,
							css: u(),
							"data-open": i,
							children: /* @__PURE__ */ N(e, { size: 14 })
						})
					}) : null
				]
			}), /* @__PURE__ */ N(Me, {
				sectionId: n.id,
				actions: n.actions ?? []
			})]
		})
	});
}, Pe = (e) => {
	let { row: t, expandedNodeIds: n, activeNodeId: r, focusRowId: i, rowVariant: a, nodeGap: o, linkComponent: s, onRowFocus: c, onNavigate: l, onToggleSection: u, onToggleNode: d, onSectionContextMenu: f, onMoveNode: p } = e;
	return t.kind === "section-header" ? /* @__PURE__ */ N(Ne, {
		section: t.section,
		collapsible: t.collapsible,
		expanded: t.expanded,
		focusId: t.key,
		tabIndex: t.key === i ? 0 : -1,
		onFocus: () => c(t.key),
		onToggle: () => u?.(t.sectionId),
		onContextMenu: f
	}) : t.kind === "section-empty" ? t.emptyState ?? null : /* @__PURE__ */ N(Se, {
		sectionId: t.sectionId,
		node: t.node,
		level: t.level,
		expandedNodeIds: n,
		activeNodeId: r,
		rowVariant: a,
		nodeGap: o,
		linkComponent: s,
		tabIndex: t.node.id === i ? 0 : -1,
		onFocus: () => c(t.node.id),
		onNavigate: l,
		onToggleNode: d,
		onMoveNode: p
	});
}, Fe = (e, t, n, r) => {
	if (e === t) return null;
	let i = n ? "before" : "after";
	return q(t) ? {
		kind: "section",
		id: Te(t),
		edge: "after",
		nextSectionId: r
	} : W(t) ? {
		kind: "section",
		id: G(t),
		edge: W(e) ? i : "inside"
	} : W(e) ? null : {
		kind: "node",
		id: t,
		edge: i
	};
}, Ie = (e, t, n, r) => {
	let i = G(t);
	if (n.kind !== "section" || n.edge === "inside" || n.id === i || !Y(e, t, U(n.id), r)) return null;
	let a = e.map((e) => e.id), o = a.filter((e) => e !== i);
	return o.splice(o.indexOf(n.id) + +(n.edge === "after"), 0, i), o.every((e, t) => e === a[t]) ? null : {
		kind: "section",
		nextSectionIds: o
	};
}, Le = (e, t, n, r) => {
	if (n.kind === "node") {
		let t = J(e, n.id);
		return t ? {
			sectionId: t.section.id,
			index: t.index + +(n.edge === "after")
		} : null;
	}
	let i = e.find((e) => e.id === n.id);
	if (!i) return null;
	if (n.edge === "inside" || !i.label) return {
		sectionId: i.id,
		index: i.nodes.length
	};
	let a = e.find((e) => e.id === n.nextSectionId);
	return a && !a.label && a.canReorder !== !1 && Y(e, t, U(a.id), r) ? {
		sectionId: a.id,
		index: 0
	} : void 0;
}, Re = (e, t, n, r, i) => {
	if (W(t)) return Ie(e, t, n, r);
	let a = J(e, t);
	if (!a || a.node.canReorder === !1 || !Y(e, t, n.kind === "node" ? n.id : K(n.id), r)) return null;
	let o = Le(e, t, n, r);
	if (o === null) return null;
	let s = a.section.nodes.map((e) => e.id).filter((e) => e !== t);
	if (!o) {
		if (!i || n.kind !== "section") return null;
		let r = e.map((e) => e.id);
		return r.splice(r.indexOf(n.id) + 1, 0, i), {
			kind: "node",
			orders: {
				[a.section.id]: s,
				[i]: [t]
			},
			looseSection: {
				id: i,
				afterSectionId: n.id,
				nextSectionIds: r
			}
		};
	}
	if (o.sectionId === a.section.id) {
		let e = o.index - +(a.index < o.index);
		return e === a.index ? null : (s.splice(e, 0, t), {
			kind: "node",
			orders: { [a.section.id]: s }
		});
	}
	let c = e.find((e) => e.id === o.sectionId)?.nodes.map((e) => e.id) ?? [];
	return c.splice(o.index, 0, t), {
		kind: "node",
		orders: {
			[a.section.id]: s,
			[o.sectionId]: c
		}
	};
}, ze = (e) => W(e) ? 2 : +!!q(e), Be = (e, t) => (n) => {
	let r = String(n.active.id), i = (n) => Y(e, r, String(n.id), t), s = n.pointerCoordinates && {
		x: n.collisionRect.left + n.collisionRect.width / 2,
		y: n.pointerCoordinates.y
	}, c = s ? o({
		...n,
		pointerCoordinates: s
	}).filter(i) : [];
	return c.length === 0 ? a(n).filter(i) : c.sort((e, t) => ze(String(e.id)) - ze(String(t.id)));
}, Ve = (e, t) => (e instanceof MouseEvent ? e.clientY : 0) + t, He = (e, t, n) => t ? Fe(e, String(t.id), n < t.rect.top + t.rect.height / 2, t.data.current?.nextSectionId) : null, Ue = () => `tree-list-loose:${crypto.randomUUID()}`, We = (e) => (t) => {
	let n = String(t.active.id), r = He(n, t.over, Ve(t.activatorEvent, t.delta.y));
	if (!r) return;
	let i = Re(e.sections, n, r, e.canMove, Ue());
	if (!i) return;
	if (i.kind === "section") {
		e.onReorderSections?.(i.nextSectionIds, G(n), r.id);
		return;
	}
	let a = i.looseSection;
	a && e.onReorderSections?.(a.nextSectionIds, a.id, a.afterSectionId);
	for (let [t, n] of Object.entries(i.orders)) e.onReorderNodes?.(t, n);
}, Ge = S(!1), Ke = (e) => e?.label ? e.id : void 0, qe = (e, t, n = []) => {
	if (!t) return null;
	let r = (e) => {
		let t = e.children, i = n.includes(e.id) ? t?.at(-1) : void 0;
		return i ? r(i) : e;
	};
	if (t.kind === "node") {
		let n = J(e, t.id);
		return n ? {
			lineId: t.edge === "after" ? r(n.node).id : t.id,
			edge: t.edge,
			groupId: Ke(n.section)
		} : null;
	}
	let i = e.find((e) => e.id === t.id);
	if (!i) return null;
	if (t.edge === "inside") {
		let e = i.nodes.at(-1);
		return {
			lineId: e ? r(e).id : U(i.id),
			edge: "after",
			groupId: Ke(i)
		};
	}
	return t.edge === "after" ? {
		lineId: K(i.id),
		edge: "middle"
	} : {
		lineId: U(i.id),
		edge: "before"
	};
}, Je = (e, t) => e ? [...e.querySelectorAll("[data-tree-list-focus-id]")].find((e) => e.dataset.treeListFocusId === t) ?? null : null, Ye = (e, t) => {
	if (e && t instanceof HTMLElement && e.contains(t)) return t.closest("[data-tree-list-focus-id]")?.dataset.treeListFocusId;
}, Xe = (e) => e instanceof HTMLElement ? e.isContentEditable ? !0 : [
	"INPUT",
	"TEXTAREA",
	"SELECT"
].includes(e.tagName) : !1, Ze = (e, t) => e.findIndex((e) => se(e) && z(e) === t), Qe = (e) => e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey && (e.key === "ArrowUp" || e.key === "ArrowDown"), $e = (e, t, n) => {
	let r = e.flatMap((e) => e.kind === "node" && !e.node.disabled ? [e.node.id] : []);
	return r[r.indexOf(t ?? "") + (n === "ArrowUp" ? -1 : 1)];
}, et = (e) => {
	let { rows: t, activeNodeId: n, expandedNodeIds: r, onToggleNode: i, onToggleSection: a, scrollToRow: o } = e, s = C(V), c = T(null), l = T(null), [u, d] = E(), [f, p] = E(), m = ce(u, n, t), h = JSON.stringify(B(t).map((e) => ({
		id: z(e),
		section: e.sectionId,
		level: e.kind === "node" ? e.level : 0,
		parent: e.kind === "node" ? e.parentNodeId : void 0
	})));
	w(() => {
		if (!u) return;
		if (!JSON.parse(h).some((e) => e.id === u)) {
			d(void 0);
			return;
		}
		let e = l.current;
		e && !e.isConnected && (l.current = null, e.ownerDocument.hasFocus() && e.ownerDocument.activeElement === e.ownerDocument.body && Je(c.current, u)?.focus());
	}, [u, h]), w(() => {
		if (!f) return;
		let e = requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				let e = Je(c.current, f);
				e && (e.focus(), p(void 0));
			});
		});
		return () => cancelAnimationFrame(e);
	}, [f]);
	let g = (e) => {
		d(e);
		let n = Je(c.current, e);
		if (n) {
			n.focus();
			return;
		}
		let r = Ze(t, e);
		r !== -1 && (o?.(r), p(e));
	};
	return {
		focusRowId: m,
		rootRef: c,
		handleKeyDown: (e) => {
			if (e.defaultPrevented || Xe(e.target)) return;
			if (s && Qe(e)) {
				let n = Ye(c.current, e.target) ?? m, r = $e(t, n, e.key);
				r && (s.select(r, e, n), g(r));
				return;
			}
			if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
			let o = de({
				rows: t,
				focusedRowId: Ye(c.current, e.target) ?? m,
				activeNodeId: n,
				expandedNodeIds: r,
				key: e.key
			});
			o && (e.preventDefault(), o.type === "toggle-node" ? i?.(o.nodeId) : o.type === "toggle-section" ? a?.(o.sectionId) : g(o.rowId));
		},
		onRowFocus: (e) => {
			l.current = c.current?.ownerDocument.activeElement, d(e);
		}
	};
}, tt = 32, nt = 4, rt = (e) => {
	let { sortable: t, row: n, indicator: r, children: i } = e;
	if (!t || n.kind === "section-empty") return i;
	if (n.kind === "node" && n.level > 0) return /* @__PURE__ */ P(D, {
		position: "relative",
		minW: "0",
		children: [i, r?.lineId === n.node.id ? /* @__PURE__ */ N(Z, { edge: r.edge }) : null]
	});
	let a = n.kind === "node" ? n.node.id : U(n.sectionId), o = n.kind === "node" ? n.node.canReorder === !1 : n.section.canReorder === !1;
	return /* @__PURE__ */ N(Q, {
		id: a,
		disabled: o,
		indicator: r,
		handle: "self",
		liftedBg: "bg.hover",
		highlighted: n.kind === "section-header" && r?.groupId === n.sectionId,
		children: () => i
	});
}, it = (e) => {
	let t = C(V), { rows: n, expandedNodeIds: r = [], activeNodeId: i, rowVariant: a = "tree", nodeGap: o = "0", linkComponent: s, onNavigate: c, onToggleSection: l, onToggleNode: u, onSectionContextMenu: f, onMoveNode: p, scrollRef: m, sortable: h = !1, indicator: g = null, sectionGap: _ = "0" } = e, { virtualizer: y, virtualItems: x, totalSize: S } = d({
		count: n.length,
		getScrollElement: () => m.current,
		estimateSize: () => tt,
		overscan: nt,
		getItemKey: (e) => n[e]?.key ?? e
	}), w = et({
		rows: n,
		activeNodeId: i,
		expandedNodeIds: r,
		onToggleNode: u,
		onToggleSection: l,
		scrollToRow: (e) => y.scrollToIndex(e, { align: "auto" })
	}), T = /* @__PURE__ */ N(D, {
		ref: w.rootRef,
		"data-tree-list-virtual": "",
		role: "listbox",
		"aria-multiselectable": !!t || void 0,
		w: "full",
		minW: "0",
		maxW: "full",
		position: "relative",
		style: { height: S },
		onKeyDown: w.handleKeyDown,
		children: x.map((e) => {
			let t = n[e.index];
			return t ? /* @__PURE__ */ P(D, {
				ref: y.measureElement,
				"data-index": e.index,
				"data-tree-list-row": t.kind,
				position: "absolute",
				top: "0",
				left: "0",
				w: "full",
				pb: e.index === n.length - 1 || h && t.sectionId !== n[e.index + 1]?.sectionId ? "0" : o,
				style: { transform: `translateY(${e.start}px)` },
				children: [/* @__PURE__ */ N(rt, {
					sortable: h,
					row: t,
					indicator: g,
					children: /* @__PURE__ */ N(Pe, {
						row: t,
						expandedNodeIds: r,
						activeNodeId: i,
						focusRowId: w.focusRowId,
						rowVariant: a,
						nodeGap: o,
						linkComponent: s,
						onRowFocus: w.onRowFocus,
						onNavigate: c,
						onToggleSection: l,
						onToggleNode: u,
						onSectionContextMenu: f,
						onMoveNode: p
					})
				}), h && t.sectionId !== n[e.index + 1]?.sectionId ? /* @__PURE__ */ N(Ae, {
					sectionId: t.sectionId,
					nextSectionId: n[e.index + 1]?.sectionId,
					gap: _,
					indicator: g
				}) : null]
			}, e.key) : null;
		})
	});
	return h ? /* @__PURE__ */ N(b, {
		items: n.flatMap((e) => e.kind === "section-header" ? [U(e.sectionId)] : e.kind === "node" && e.level === 0 ? [e.node.id] : []),
		strategy: v,
		children: T
	}) : T;
}, at = (e) => {
	let { section: t, sectionRows: n, expandedNodeIds: r, activeNodeId: i, rowVariant: a, nodeGap: o, linkComponent: s, onNavigate: c, onToggleSection: l, onToggleNode: u, onMoveNode: d, onSectionContextMenu: f, indicator: p, dragging: m, focusRowId: h, onRowFocus: g } = e, _ = n.find((e) => e.kind === "section-header"), y = n.filter((e) => e.kind === "node"), x = t.nodes.map((e) => e.id);
	return /* @__PURE__ */ N(Q, {
		id: U(t.id),
		disabled: t.canReorder === !1,
		indicator: p,
		handle: "child",
		highlighted: p?.groupId === t.id,
		children: (e) => /* @__PURE__ */ P(ne, { children: [
			_ && _.kind === "section-header" ? /* @__PURE__ */ N(D, {
				onPointerDownCapture: (t) => {
					X(t.target) && e?.onPointerDown?.(t);
				},
				children: /* @__PURE__ */ N(Ne, {
					section: _.section,
					collapsible: _.collapsible,
					expanded: _.expanded,
					focusId: _.key,
					tabIndex: _.key === h ? 0 : -1,
					onFocus: () => g(_.key),
					onToggle: () => l?.(_.sectionId),
					onContextMenu: f
				})
			}) : null,
			m && !_ && y.length === 0 ? /* @__PURE__ */ N(D, {
				h: "tree-empty-drop-zone",
				"data-tree-list-empty-drop-zone": ""
			}) : null,
			/* @__PURE__ */ N(H, {
				open: !_ || _.kind === "section-header" && _.expanded,
				children: /* @__PURE__ */ P(b, {
					items: x,
					strategy: v,
					children: [/* @__PURE__ */ N($, {
						sectionId: t.id,
						nodes: t.nodes,
						expandedNodeIds: r,
						activeNodeId: i,
						rowVariant: a,
						nodeGap: o,
						linkComponent: s,
						onNavigate: c,
						onToggleNode: u,
						onMoveNode: d,
						sortable: !0,
						indicator: p,
						focusRowId: h,
						onRowFocus: g
					}), t.nodes.length === 0 ? t.emptyState : null]
				})
			})
		] })
	});
}, ot = (e) => {
	let n = C(V), { sections: r, expandedSectionIds: a, expandedNodeIds: o, sectionGap: s, ...c } = e, { active: l, over: u } = i(), [d, f] = E(null);
	t({
		onDragMove: (e) => f(Ve(e.activatorEvent, e.delta.y)),
		onDragEnd: () => f(null),
		onDragCancel: () => f(null)
	});
	let p = qe(r, l && d !== null ? He(String(l.id), u, d) : null, o), m = R(r, a, o), h = et({
		rows: m,
		activeNodeId: c.activeNodeId,
		expandedNodeIds: o,
		onToggleNode: c.onToggleNode,
		onToggleSection: c.onToggleSection
	});
	return e.virtualize && e.scrollRef ? /* @__PURE__ */ N(it, {
		...e,
		rows: m,
		scrollRef: e.scrollRef,
		sortable: !0,
		indicator: p
	}) : /* @__PURE__ */ N(b, {
		items: r.map((e) => U(e.id)),
		strategy: v,
		children: /* @__PURE__ */ N(j, {
			ref: h.rootRef,
			role: "listbox",
			"aria-multiselectable": !!n || void 0,
			onKeyDown: h.handleKeyDown,
			gap: "0",
			w: "full",
			minW: "0",
			maxW: "full",
			position: "relative",
			children: r.map((e, t) => /* @__PURE__ */ P(x, { children: [/* @__PURE__ */ N(at, {
				section: e,
				sectionRows: m.filter((t) => t.sectionId === e.id),
				expandedNodeIds: o,
				rowVariant: c.rowVariant ?? "tree",
				nodeGap: c.nodeGap,
				activeNodeId: c.activeNodeId,
				linkComponent: c.linkComponent,
				onNavigate: c.onNavigate,
				onToggleSection: c.onToggleSection,
				onToggleNode: c.onToggleNode,
				onMoveNode: c.onMoveNode,
				onSectionContextMenu: c.onSectionContextMenu,
				indicator: p,
				dragging: !!l,
				focusRowId: h.focusRowId,
				onRowFocus: h.onRowFocus
			}), /* @__PURE__ */ N(Ae, {
				sectionId: e.id,
				nextSectionId: r[t + 1]?.id,
				gap: s,
				indicator: p
			})] }, e.id))
		})
	});
}, st = (e) => {
	let { sections: t, expandedSectionIds: n = [], expandedNodeIds: i = [], activeNodeId: a, rowVariant: o = "tree", sectionGap: u = "0", nodeGap: d = "0", linkComponent: f, onNavigate: p, onToggleSection: m, onToggleNode: h, onMoveNode: g, onSectionContextMenu: _, onReorderSections: v, onReorderNodes: y, canMove: b } = e, x = l(r(s, { activationConstraint: { distance: 4 } })), S = C(Ge), w = Be(t, b), T = We({
		sections: t,
		canMove: b,
		onReorderSections: (e) => v?.(e),
		onReorderNodes: y
	}), E = /* @__PURE__ */ N(ot, {
		sections: t,
		expandedSectionIds: n,
		expandedNodeIds: i,
		activeNodeId: a,
		rowVariant: o,
		sectionGap: u,
		nodeGap: d,
		linkComponent: f,
		onNavigate: p,
		onToggleSection: m,
		onToggleNode: h,
		onMoveNode: g,
		onSectionContextMenu: _,
		virtualize: e.virtualize,
		scrollRef: e.scrollRef
	});
	return S ? E : /* @__PURE__ */ N(c, {
		sensors: x,
		collisionDetection: w,
		onDragEnd: T,
		...Oe,
		children: E
	});
}, ct = (e) => {
	let { sections: t, expandedSectionIds: n = [], expandedNodeIds: r = [], activeNodeId: i, rowVariant: a = "tree", sectionGap: o = "0", nodeGap: s = "0", linkComponent: c, onNavigate: l, onToggleSection: u, onToggleNode: d, onSectionContextMenu: f, onMoveNode: p, virtualize: m, scrollRef: h } = e, g = R(t, n, r), _ = et({
		rows: g,
		activeNodeId: i,
		expandedNodeIds: r,
		onToggleNode: d,
		onToggleSection: u
	});
	return m && h ? /* @__PURE__ */ N(it, {
		...e,
		rows: g,
		scrollRef: h
	}) : /* @__PURE__ */ N(j, {
		ref: _.rootRef,
		role: "listbox",
		"aria-multiselectable": !!e.onSelectionChange || void 0,
		gap: o,
		w: "full",
		minW: "0",
		maxW: "full",
		overflowX: "hidden",
		onKeyDown: _.handleKeyDown,
		children: t.map((e) => {
			let t = g.filter((t) => t.sectionId === e.id);
			return /* @__PURE__ */ P(j, {
				gap: s,
				w: "full",
				minW: "0",
				maxW: "full",
				"data-testid": `tree-list-section-${e.id}`,
				children: [t.filter((e) => e.kind === "section-header").map((e) => /* @__PURE__ */ N(D, {
					w: "full",
					minW: "0",
					children: /* @__PURE__ */ N(Pe, {
						row: e,
						expandedNodeIds: r,
						activeNodeId: i,
						focusRowId: _.focusRowId,
						rowVariant: a,
						nodeGap: s,
						linkComponent: c,
						onRowFocus: _.onRowFocus,
						onNavigate: l,
						onToggleSection: u,
						onToggleNode: d,
						onSectionContextMenu: f,
						onMoveNode: p
					})
				}, e.key)), /* @__PURE__ */ P(H, {
					open: e.collapsible === !1 || e.label === void 0 || n.includes(e.id),
					children: [/* @__PURE__ */ N($, {
						sectionId: e.id,
						nodes: e.nodes,
						expandedNodeIds: r,
						activeNodeId: i,
						focusRowId: _.focusRowId,
						onRowFocus: _.onRowFocus,
						rowVariant: a,
						nodeGap: s,
						linkComponent: c,
						onNavigate: l,
						onToggleNode: d,
						onMoveNode: p
					}), e.nodes.length === 0 ? e.emptyState : null]
				})]
			}, e.id);
		})
	});
}, lt = (e) => {
	let t = e.draggable ? /* @__PURE__ */ N(st, {
		virtualize: e.virtualize,
		scrollRef: e.scrollRef,
		sections: e.sections,
		expandedSectionIds: e.expandedSectionIds,
		expandedNodeIds: e.expandedNodeIds,
		activeNodeId: e.activeNodeId,
		rowVariant: e.rowVariant,
		sectionGap: e.sectionGap,
		nodeGap: e.nodeGap,
		linkComponent: e.linkComponent,
		onNavigate: e.onNavigate,
		onToggleSection: e.onToggleSection,
		onToggleNode: e.onToggleNode,
		onSectionContextMenu: e.onSectionContextMenu,
		onReorderSections: e.onReorderSections,
		onReorderNodes: e.onReorderNodes,
		onMoveNode: e.onMoveNode,
		canMove: e.canMove
	}) : /* @__PURE__ */ N(ct, { ...e }), n = /* @__PURE__ */ N(xe, {
		tree: e,
		children: /* @__PURE__ */ P(he, {
			onMoveNode: e.onMoveNode,
			children: [e.leadingContent, t]
		})
	});
	return !e.backgroundContextActions || e.backgroundContextActions.length === 0 ? n : /* @__PURE__ */ N(re, {
		actions: e.backgroundContextActions,
		children: n
	});
};
export { lt as t };
