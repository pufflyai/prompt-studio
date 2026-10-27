// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./message-circle-DP0BFDQF.ts";
import { t } from "./minimize-2-n6cCtFPr.ts";
import { t as n } from "./minus-BdT0RA0-.ts";
import { t as r } from "./square-arrow-out-up-right-ChOYv0bR.ts";
import { c as i, d as a } from "./resource-registry-CVuZngrt.ts";
import { B as o, C as s, M as c, V as l, W as u, b as d, c as f, j as p, m, n as h, x as g, y as _ } from "./workbench-core-N58OeDyx.ts";
import { t as v } from "./controls-view-C3MypQJx.ts";
import { n as y } from "./mode-chrome-D8eccNh1.ts";
import { t as b } from "./command-palette-NaHQQpoD.ts";
import { t as x } from "./renderer-read-key-WONjLXkB.ts";
import { t as S } from "./use-workbench-store-BMaFgEbb.ts";
import { t as C } from "./icon-D3uE7jD-.ts";
import { r as w } from "./command-palette-params-BB-3_RFH.ts";
import { t as T } from "./command-menu-items-NsWn0jze.ts";
import { r as E, t as D } from "./resource-actions-B6hNjsqI.ts";
import { n as O, t as k } from "./resource-menu-BPUwurff.ts";
import { n as ee, r as A, t as te } from "./breadcrumb-view-24j_45nw.ts";
import { n as j } from "./workbench-theme-background-LZFbdbjE.ts";
import { n as ne } from "./panel-widget-open-DNEH0WG4.ts";
import { S as M, _ as N, a as re, b as ie, c as P, d as ae, f as oe, g as se, h as ce, i as le, l as ue, m as de, n as fe, o as pe, p as me, r as he, s as ge, t as _e, u as ve, v as ye, x as be, y as xe } from "./workbench-panels-BeesJIZi.ts";
import { t as Se } from "./shallow-BYHDNLn2.ts";
import { t as F } from "./use-panel-policy-BALwJ9k6.ts";
import { n as Ce } from "./use-page-params-BMVjuYZ6.ts";
import { n as we, t as Te } from "./use-tab-context-menu-CajLJvqn.ts";
import { b as Ee, c as De, m as Oe, n as ke, o as Ae, t as je, v as Me, x as Ne, y as Pe } from "./core.esm-cje5eyjm.ts";
import { i as Fe, n as Ie, r as I, t as Le } from "./kanban-view-COShTNns.ts";
import { t as Re } from "./renderer-read-notice-Ceo0RX8O.ts";
import { t as ze } from "./use-renderer-read-CxbGovUR.ts";
import { t as Be } from "./view-toolbar-actions-7QQU--AT.ts";
import { t as Ve } from "./tree-view-DU4i0smO.ts";
import { t as He } from "./workbench-theme-provider-CQSyY8qK.ts";
import { i as L, n as Ue, r as We, t as Ge } from "./workbench-panel-toggles-BmSTzznX.ts";
import { t as Ke } from "./overlay-layer-Cm28dnJ7.ts";
import { n as qe, t as Je } from "./file-renderer-view-BcV-KqFj.ts";
import { Fragment as Ye, createContext as Xe, createElement as Ze, useContext as Qe, useEffect as R, useId as $e, useLayoutEffect as et, useReducer as tt, useRef as z, useState as B, useSyncExternalStore as nt } from "react";
import { Box as V, Button as rt, CloseButton as it, Flex as H, Grid as at, HStack as U, IconButton as W, Menu as G, Portal as ot, Stack as st, Tabs as ct, Text as lt, useTabsContext as ut } from "@chakra-ui/react";
import { AttachedMenu as dt, AttachedPanel as ft, BubbleButton as pt, BubblePanel as mt, DropIndicator as ht, EmptyState as gt, Header as _t, ListRow as vt, PANEL_HEADER_CONTROL_SIZE as K, PANEL_HEADER_TAB_SIZE as yt, ResizableSplitLayout as bt, ResourceActionMenu as xt, ResourceContextMenu as St, ScrollArea as Ct, Toaster as wt, Tooltip as q, buildTabVisibilityMenuActions as Tt, defaultThemePreferences as Et, toaster as Dt } from "@pstdio/ui";
import { Fragment as Ot, jsx as J, jsxs as Y } from "react/jsx-runtime";
import { resourceKey as kt } from "@pstdio/sdk/extensions";
import { DataTable as At, DataTableSkeleton as jt, useDataTableViewStore as Mt } from "@pstdio/ui/data-table";
import { createPortal as Nt } from "react-dom";
// packages/pstdio-workbench/src/react/header/header-action-items.ts
var Pt = (e) => e.group === "kernel", Ft = (e) => e.group === "overflow" || Pt(e), It = (e, t) => {
	if (!t || e.length === 0) return e;
	let [n, ...r] = e;
	return n ? [{
		...n,
		separatorBefore: !0
	}, ...r] : r;
}, Lt = (e) => {
	let t = e.filter((e) => !Pt(e)), n = e.filter(Pt);
	return [...t, ...It(n, t.length > 0)];
}, Rt = (e) => ({
	inlineItems: e.filter((e) => !Ft(e)),
	overflowItems: Lt(e.filter(Ft))
}), zt = (e) => e.find((e) => e.overflowLabel)?.overflowLabel ?? "More header actions", Bt = (e) => e ? { resource: e } : void 0, Vt = (e) => {
	let { controlSize: t, item: n, onSelect: r } = e, i = () => r(n);
	return n.group === "primary" || !n.icon ? /* @__PURE__ */ Y(rt, {
		size: t,
		variant: n.group === "primary" ? "primary" : "subtle",
		disabled: n.disabled,
		onClick: i,
		children: [n.icon ? /* @__PURE__ */ J(C, {
			name: n.icon,
			size: 14
		}) : null, n.label]
	}, n.id) : /* @__PURE__ */ J(q, {
		content: n.label,
		children: /* @__PURE__ */ J(W, {
			size: t,
			variant: "ghost",
			"aria-label": n.label,
			disabled: n.disabled,
			onClick: i,
			children: /* @__PURE__ */ J(C, {
				name: n.icon,
				size: 16
			})
		})
	}, n.id);
}, Ht = (e) => {
	let { controlSize: t = "xs", menuPath: n, workbench: r } = e, i = S(r.commands.store, (e) => e.commands), a = S(r.context.store, (e) => e.values), o = S(r.layout.menuStore, (e) => e.itemsByPath), s = S(r.layout.store, (e) => e.layout), c = g(s, "primary"), l = be({
		itemsByPath: o,
		commands: i,
		contextValues: a
	}, n, { resource: c }), { inlineItems: u, overflowItems: d } = Rt(l), p = (e) => {
		let t = i[e.commandId]?.command, n = e.args, a = Bt(c);
		t && w(t.params) ? r.commandPalette.requestParams({
			record: { command: t },
			label: e.label,
			args: n,
			context: a
		}) : f(r, e.label, () => r.commands.executeCommand(e.commandId, n, a));
	};
	return l.length === 0 ? null : /* @__PURE__ */ Y(U, {
		flexShrink: 0,
		gap: "2xs",
		minW: "0",
		children: [u.map((e) => /* @__PURE__ */ J(Vt, {
			item: e,
			onSelect: p,
			controlSize: t
		}, e.id)), d.length > 0 ? /* @__PURE__ */ Y(G.Root, { children: [/* @__PURE__ */ J(G.Trigger, {
			asChild: !0,
			children: /* @__PURE__ */ J(W, {
				size: t,
				variant: "ghost",
				"aria-label": zt(d),
				children: /* @__PURE__ */ J(C, {
					name: "MoreHorizontal",
					size: 16
				})
			})
		}), /* @__PURE__ */ J(ot, { children: /* @__PURE__ */ J(G.Positioner, { children: /* @__PURE__ */ J(G.Content, {
			minW: "220px",
			bg: "bg",
			children: d.map((e) => /* @__PURE__ */ Y(Ye, { children: [e.separatorBefore ? /* @__PURE__ */ J(G.Separator, {}) : null, /* @__PURE__ */ J(G.Item, {
				value: e.id,
				disabled: e.disabled,
				asChild: !0,
				children: /* @__PURE__ */ J(vt, {
					asChild: !0,
					variant: "full-width",
					id: e.id,
					label: e.label,
					icon: e.icon ? /* @__PURE__ */ J(C, {
						name: e.icon,
						size: 16
					}) : void 0,
					disabled: e.disabled,
					endContent: T({
						readOnly: e.readOnly,
						disabledReason: e.description
					}),
					onActivate: () => p(e)
				})
			})] }, e.id))
		}) }) })] }) : null]
	});
}, Ut = Xe(null);
function Wt() {
	return Qe(Ut)?.defaultOptions ?? {};
}
// node_modules/.bun/@tanstack+react-hotkeys@0.10.0+bf16f8eded5e12ee/node_modules/@tanstack/react-hotkeys/dist/utils.js
function Gt(e) {
	return typeof e == "object" && !!e && "current" in e;
}
// node_modules/.bun/@tanstack+hotkeys@0.8.0/node_modules/@tanstack/hotkeys/dist/constants.js
function X() {
	if (typeof navigator > "u") return "linux";
	let e = navigator.platform?.toLowerCase() ?? "", t = navigator.userAgent?.toLowerCase() ?? "";
	return e.includes("mac") || t.includes("mac") ? "mac" : e.includes("win") || t.includes("win") ? "windows" : "linux";
}
var Kt = [
	"Control",
	"Alt",
	"Shift",
	"Meta"
];
new Set(Kt);
var qt = {
	Control: "Control",
	Ctrl: "Control",
	control: "Control",
	ctrl: "Control",
	Shift: "Shift",
	shift: "Shift",
	Alt: "Alt",
	Option: "Alt",
	alt: "Alt",
	option: "Alt",
	Command: "Meta",
	Cmd: "Meta",
	Meta: "Meta",
	command: "Meta",
	cmd: "Meta",
	meta: "Meta",
	OS: "Meta",
	os: "Meta",
	Win: "Meta",
	win: "Meta",
	CommandOrControl: "Mod",
	Mod: "Mod",
	commandorcontrol: "Mod",
	mod: "Mod"
};
function Jt(e, t = X()) {
	return e === "Mod" ? t === "mac" ? "Meta" : "Control" : e;
}
var Yt = /* @__PURE__ */ new Set(/* @__PURE__ */ "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")), Xt = /* @__PURE__ */ new Set([
	"0",
	"1",
	"2",
	"3",
	"4",
	"5",
	"6",
	"7",
	"8",
	"9"
]), Zt = /* @__PURE__ */ new Set([
	"F1",
	"F2",
	"F3",
	"F4",
	"F5",
	"F6",
	"F7",
	"F8",
	"F9",
	"F10",
	"F11",
	"F12"
]), Qt = /* @__PURE__ */ new Set([
	"ArrowUp",
	"ArrowDown",
	"ArrowLeft",
	"ArrowRight",
	"Home",
	"End",
	"PageUp",
	"PageDown"
]), $t = /* @__PURE__ */ new Set([
	"Enter",
	"Escape",
	"Space",
	"Tab",
	"Backspace",
	"Delete"
]), en = /* @__PURE__ */ new Set([
	"/",
	"[",
	"]",
	"\\",
	"=",
	"-",
	",",
	".",
	";",
	"`"
]), tn = {
	Backquote: "`",
	Backslash: "\\",
	BracketLeft: "[",
	BracketRight: "]",
	Comma: ",",
	Equal: "=",
	Minus: "-",
	Period: ".",
	Semicolon: ";",
	Slash: "/"
};
[
	...Yt,
	...Xt,
	...Zt,
	...Qt,
	...$t,
	...en
];
var nn = {
	Esc: "Escape",
	esc: "Escape",
	escape: "Escape",
	Return: "Enter",
	return: "Enter",
	enter: "Enter",
	" ": "Space",
	space: "Space",
	Spacebar: "Space",
	spacebar: "Space",
	tab: "Tab",
	backspace: "Backspace",
	Del: "Delete",
	del: "Delete",
	delete: "Delete",
	Up: "ArrowUp",
	up: "ArrowUp",
	arrowup: "ArrowUp",
	Down: "ArrowDown",
	down: "ArrowDown",
	arrowdown: "ArrowDown",
	Left: "ArrowLeft",
	left: "ArrowLeft",
	arrowleft: "ArrowLeft",
	Right: "ArrowRight",
	right: "ArrowRight",
	arrowright: "ArrowRight",
	home: "Home",
	end: "End",
	pageup: "PageUp",
	pagedown: "PageDown",
	PgUp: "PageUp",
	PgDn: "PageDown",
	pgup: "PageUp",
	pgdn: "PageDown"
};
function rn(e) {
	return /^\p{Letter}$/u.test(e);
}
function Z(e) {
	if (!e) return "";
	if (e in nn) return nn[e];
	if (rn(e)) {
		let t = e.toUpperCase();
		return t.length === 1 ? t : e;
	}
	let t = e.toUpperCase();
	return /^F([1-9]|1[0-2])$/.test(t) ? t : e;
}
// node_modules/.bun/@tanstack+hotkeys@0.8.0/node_modules/@tanstack/hotkeys/dist/parse.js
function an(e, t = X()) {
	let n = e.split("+"), r = /* @__PURE__ */ new Set(), i = "";
	for (let e = 0; e < n.length; e++) {
		let a = n[e].trim();
		if (e === n.length - 1) i = Z(a);
		else {
			let e = qt[a] ?? qt[a.toLowerCase()];
			if (e) {
				let n = Jt(e, t);
				r.add(n);
			} else n.length === 1 && (i = Z(a));
		}
	}
	return !i && n.length > 0 && (i = Z(n[n.length - 1].trim())), {
		key: i,
		ctrl: r.has("Control"),
		shift: r.has("Shift"),
		alt: r.has("Alt"),
		meta: r.has("Meta"),
		modifiers: Kt.filter((e) => r.has(e))
	};
}
function on(e, t = X()) {
	let n = e.ctrl ?? !1, r = e.shift ?? !1, i = e.alt ?? !1, a = e.meta ?? !1;
	e.mod && (Jt("Mod", t) === "Control" ? n = !0 : a = !0);
	let o = Kt.filter((e) => {
		switch (e) {
			case "Control": return n;
			case "Shift": return r;
			case "Alt": return i;
			case "Meta": return a;
			default: return !1;
		}
	});
	return {
		key: e.key,
		ctrl: n,
		shift: r,
		alt: i,
		meta: a,
		modifiers: o
	};
}
function sn(e, t) {
	let n = t === "mac" ? e.meta && !e.ctrl : e.ctrl && !e.meta, r = [];
	if (n) r.push("Mod"), e.alt && r.push("Alt"), e.shift && r.push("Shift");
	else for (let t of Kt) e.modifiers.includes(t) && r.push(t);
	return r.push(Z(e.key)), r.join("+");
}
function cn(e, t = X()) {
	return sn(an(e, t), t);
}
function ln(e, t = X()) {
	return sn(e, t);
}
function un(e, t = X()) {
	return typeof e == "string" ? cn(e, t) : ln(on(e, t), t);
}
// node_modules/.bun/@tanstack+hotkeys@0.8.0/node_modules/@tanstack/hotkeys/dist/format.js
function dn(e) {
	let t = [];
	for (let n of Kt) e.modifiers.includes(n) && t.push(n);
	return t.push(e.key), t.join("+");
}
// node_modules/.bun/@tanstack+hotkeys@0.8.0/node_modules/@tanstack/hotkeys/dist/match.js
function fn(e, t, n = X()) {
	let r = typeof t == "string" ? an(t, n) : t;
	if (e.ctrlKey !== r.ctrl || e.shiftKey !== r.shift || e.altKey !== r.alt || e.metaKey !== r.meta) return !1;
	let i = Z(e.key), a = r.key;
	if (i !== "Dead" && i.length === 1 && a.length === 1) {
		if (i.toUpperCase() === a.toUpperCase()) return !0;
		if (rn(i) && (/^[A-Za-z]$/.test(i) || !e.altKey)) return !1;
	}
	if (e.code && (i === "Dead" || i.length === 1 && a.length === 1)) {
		if (e.code.startsWith("Key")) {
			let t = e.code.slice(3);
			if (t.length === 1 && /^[A-Za-z]$/.test(t)) return t.toUpperCase() === a.toUpperCase();
		}
		if (e.code.startsWith("Digit")) {
			let t = e.code.slice(5);
			if (t.length === 1 && /^[0-9]$/.test(t)) return t === a;
		}
		return e.code in tn && tn[e.code] === a;
	}
	return i === a;
}
// node_modules/.bun/@tanstack+hotkeys@0.8.0/node_modules/@tanstack/hotkeys/dist/manager.utils.js
var pn = {
	preventDefault: !0,
	stopPropagation: !0,
	eventType: "keydown",
	enabled: !0,
	ignoreInputs: !0,
	conflictBehavior: "warn"
};
function mn(e) {
	return !(e.ctrl || e.meta || e.key === "Escape");
}
function hn(e) {
	if (!e) return !1;
	if (e instanceof HTMLInputElement) {
		let t = e.type.toLowerCase();
		return t !== "button" && t !== "submit" && t !== "reset";
	}
	return !!(e instanceof HTMLTextAreaElement || e instanceof HTMLSelectElement || e instanceof HTMLElement && e.isContentEditable);
}
function gn(e) {
	return typeof document > "u" ? null : typeof Document < "u" && e instanceof Document || typeof Node < "u" && e.nodeType === Node.DOCUMENT_NODE ? e.activeElement : typeof HTMLElement < "u" && e instanceof HTMLElement ? e.ownerDocument.activeElement ?? null : e.document.activeElement ?? null;
}
function _n(e, t, n) {
	let r = gn(t);
	return r && hn(r) && r !== n || e.composedPath().some((e) => hn(e) && e !== n) ? !0 : hn(e.target) && e.target !== n;
}
function vn(e, t) {
	return t === document || t === window ? e.currentTarget === t || e.currentTarget === document.documentElement : t === window ? e.currentTarget === window || e.currentTarget === document || e.currentTarget === document.documentElement : !!(t instanceof HTMLElement && (e.currentTarget === t || e.target instanceof Node && t.contains(e.target)));
}
function yn(e, t, n, r) {
	if (n !== "allow") {
		if (n === "warn") console.warn(`'${t}' is already registered. Multiple handlers will be triggered. Use conflictBehavior: 'replace' to replace the existing handler, or conflictBehavior: 'allow' to suppress this warning.`);
		else {
			if (n === "error") throw Error(`'${t}' is already registered. Use conflictBehavior: 'replace' to replace the existing handler, or conflictBehavior: 'allow' to allow multiple registrations.`);
			r(e);
		}
	}
}
// node_modules/.bun/@tanstack+store@0.11.0/node_modules/@tanstack/store/dist/alien.js
var Q = /* @__PURE__ */ function(e) {
	return e[e.None = 0] = "None", e[e.Mutable = 1] = "Mutable", e[e.Watching = 2] = "Watching", e[e.RecursedCheck = 4] = "RecursedCheck", e[e.Recursed = 8] = "Recursed", e[e.Dirty = 16] = "Dirty", e[e.Pending = 32] = "Pending", e;
}({});
/* @__NO_SIDE_EFFECTS__ */
function bn({ update: e, notify: t, unwatched: n }) {
	return {
		link: r,
		unlink: i,
		propagate: a,
		checkDirty: o,
		shallowPropagate: s
	};
	function r(e, t, n) {
		let r = t.depsTail;
		if (r !== void 0 && r.dep === e) return;
		let i = r === void 0 ? t.deps : r.nextDep;
		if (i !== void 0 && i.dep === e) {
			i.version = n, t.depsTail = i;
			return;
		}
		let a = e.subsTail;
		if (a !== void 0 && a.version === n && a.sub === t) return;
		let o = t.depsTail = e.subsTail = {
			version: n,
			dep: e,
			sub: t,
			prevDep: r,
			nextDep: i,
			prevSub: a,
			nextSub: void 0
		};
		i !== void 0 && (i.prevDep = o), r === void 0 ? t.deps = o : r.nextDep = o, a === void 0 ? e.subs = o : a.nextSub = o;
	}
	function i(e, t = e.sub) {
		let r = e.dep, i = e.prevDep, a = e.nextDep, o = e.nextSub, s = e.prevSub;
		return a === void 0 ? t.depsTail = i : a.prevDep = i, i === void 0 ? t.deps = a : i.nextDep = a, o === void 0 ? r.subsTail = s : o.prevSub = s, s === void 0 ? (r.subs = o) === void 0 && n(r) : s.nextSub = o, a;
	}
	function a(e) {
		let n = e.nextSub, r;
		top: do {
			let i = e.sub, a = i.flags;
			if (a & (Q.RecursedCheck | Q.Recursed | Q.Dirty | Q.Pending) ? a & (Q.RecursedCheck | Q.Recursed) ? a & Q.RecursedCheck ? !(a & (Q.Dirty | Q.Pending)) && c(e, i) ? (i.flags = a | (Q.Recursed | Q.Pending), a &= Q.Mutable) : a = Q.None : i.flags = a & ~Q.Recursed | Q.Pending : a = Q.None : i.flags = a | Q.Pending, a & Q.Watching && t(i), a & Q.Mutable) {
				let t = i.subs;
				if (t !== void 0) {
					let i = (e = t).nextSub;
					i !== void 0 && (r = {
						value: n,
						prev: r
					}, n = i);
					continue;
				}
			}
			if ((e = n) !== void 0) n = e.nextSub;
			else {
				for (; r !== void 0;) if (e = r.value, r = r.prev, e !== void 0) {
					n = e.nextSub;
					continue top;
				}
				break;
			}
		} while (1);
	}
	function o(t, n) {
		let r, i = 0, a = !1;
		top: do {
			let o = t.dep, c = o.flags;
			if (n.flags & Q.Dirty) a = !0;
			else if ((c & (Q.Mutable | Q.Dirty)) === (Q.Mutable | Q.Dirty)) {
				if (e(o)) {
					let e = o.subs;
					e.nextSub !== void 0 && s(e), a = !0;
				}
			} else if ((c & (Q.Mutable | Q.Pending)) === (Q.Mutable | Q.Pending)) {
				(t.nextSub !== void 0 || t.prevSub !== void 0) && (r = {
					value: t,
					prev: r
				}), t = o.deps, n = o, ++i;
				continue;
			}
			if (!a) {
				let e = t.nextDep;
				if (e !== void 0) {
					t = e;
					continue;
				}
			}
			for (; i--;) {
				let i = n.subs, o = i.nextSub !== void 0;
				if (o ? (t = r.value, r = r.prev) : t = i, a) {
					if (e(n)) {
						o && s(i), n = t.sub;
						continue;
					}
					a = !1;
				} else n.flags &= ~Q.Pending;
				n = t.sub;
				let c = t.nextDep;
				if (c !== void 0) {
					t = c;
					continue top;
				}
			}
			return a;
		} while (1);
	}
	function s(e) {
		do {
			let n = e.sub, r = n.flags;
			(r & (Q.Pending | Q.Dirty)) === Q.Pending && (n.flags = r | Q.Dirty, (r & (Q.Watching | Q.RecursedCheck)) === Q.Watching && t(n));
		} while ((e = e.nextSub) !== void 0);
	}
	function c(e, t) {
		let n = t.depsTail;
		for (; n !== void 0;) {
			if (n === e) return !0;
			n = n.prevDep;
		}
		return !1;
	}
}
// node_modules/.bun/@tanstack+store@0.11.0/node_modules/@tanstack/store/dist/atom.js
function xn(e, t, n) {
	let r = typeof e == "object", i = r ? e : void 0;
	return {
		next: (r ? e.next : e)?.bind(i),
		error: (r ? e.error : t)?.bind(i),
		complete: (r ? e.complete : n)?.bind(i)
	};
}
var Sn = [], Cn = 0, { link: wn, unlink: Tn, propagate: En, checkDirty: Dn, shallowPropagate: On } = /* @__PURE__ */ bn({
	update(e) {
		return e._update();
	},
	notify(e) {
		Sn[An++] = e, e.flags &= ~Q.Watching;
	},
	unwatched(e) {
		e.depsTail !== void 0 && (e.depsTail = void 0, e.flags = Q.Mutable | Q.Dirty, Mn(e));
	}
}), kn = 0, An = 0, $, jn = 0;
function Mn(e) {
	let t = e.depsTail, n = t === void 0 ? e.deps : t.nextDep;
	for (; n !== void 0;) n = Tn(n, e);
}
function Nn() {
	if (!(jn > 0)) {
		for (; kn < An;) {
			let e = Sn[kn];
			Sn[kn++] = void 0, e.notify();
		}
		kn = 0, An = 0;
	}
}
function Pn(e, t) {
	let n = typeof e == "function", r = e, i = {
		_snapshot: n ? void 0 : e,
		subs: void 0,
		subsTail: void 0,
		deps: void 0,
		depsTail: void 0,
		flags: n ? Q.None : Q.Mutable,
		get() {
			return $ !== void 0 && wn(i, $, Cn), i._snapshot;
		},
		subscribe(e) {
			let t = xn(e), n = { current: !1 }, r = Fn(() => {
				i.get(), n.current ? t.next?.(i._snapshot) : n.current = !0;
			});
			return { unsubscribe: () => {
				r.stop();
			} };
		},
		_update(e) {
			let a = $, o = t?.compare ?? Object.is;
			if (n) $ = i, ++Cn, i.depsTail = void 0;
			else if (e === void 0) return !1;
			n && (i.flags = Q.Mutable | Q.RecursedCheck);
			try {
				let t = i._snapshot, a = typeof e == "function" ? e(t) : e === void 0 && n ? r(t) : e;
				return t === void 0 || !o(t, a) ? (i._snapshot = a, !0) : !1;
			} finally {
				$ = a, n && (i.flags &= ~Q.RecursedCheck), Mn(i);
			}
		}
	};
	return n ? (i.flags = Q.Mutable | Q.Dirty, i.get = function() {
		let e = i.flags;
		if (e & Q.Dirty || e & Q.Pending && Dn(i.deps, i)) {
			if (i._update()) {
				let e = i.subs;
				e !== void 0 && On(e);
			}
		} else e & Q.Pending && (i.flags = e & ~Q.Pending);
		return $ !== void 0 && wn(i, $, Cn), i._snapshot;
	}) : i.set = function(e) {
		if (i._update(e)) {
			let e = i.subs;
			e !== void 0 && (En(e), On(e), Nn());
		}
	}, i;
}
function Fn(e) {
	let t = () => {
		let t = $;
		$ = n, ++Cn, n.depsTail = void 0, n.flags = Q.Watching | Q.RecursedCheck;
		try {
			return e();
		} finally {
			$ = t, n.flags &= ~Q.RecursedCheck, Mn(n);
		}
	}, n = {
		deps: void 0,
		depsTail: void 0,
		subs: void 0,
		subsTail: void 0,
		flags: Q.Watching | Q.RecursedCheck,
		notify() {
			let e = this.flags;
			e & Q.Dirty || e & Q.Pending && Dn(this.deps, this) ? t() : this.flags = Q.Watching;
		},
		stop() {
			this.flags = Q.None, this.depsTail = void 0, Mn(this);
		}
	};
	return t(), n;
}
// node_modules/.bun/@tanstack+store@0.11.0/node_modules/@tanstack/store/dist/store.js
var In = class {
	constructor(e, t) {
		this.atom = Pn(e), this.get = this.get.bind(this), this.setState = this.setState.bind(this), this.subscribe = this.subscribe.bind(this), t && (this.actions = t(this));
	}
	setState(e) {
		this.atom.set(e);
	}
	get state() {
		return this.atom.get();
	}
	get() {
		return this.state;
	}
	subscribe(e) {
		return this.atom.subscribe(xn(e));
	}
}, Ln = 0;
function Rn() {
	return `hotkey_${++Ln}`;
}
var zn = class e {
	static #e = null;
	#t;
	#n = /* @__PURE__ */ new Map();
	#r = /* @__PURE__ */ new Map();
	constructor() {
		this.registrations = new In(/* @__PURE__ */ new Map()), this.#t = X();
	}
	static getInstance() {
		return e.#e ||= new e(), e.#e;
	}
	static resetInstance() {
		e.#e &&= (e.#e.destroy(), null);
	}
	register(e, t, n = {}) {
		if (typeof document > "u" && !n.target) {
			let e = t;
			return {
				id: Rn(),
				unregister: () => {},
				get callback() {
					return e;
				},
				set callback(t) {
					e = t;
				},
				setOptions: () => {},
				get isActive() {
					return !1;
				}
			};
		}
		let r = Rn(), i = n.platform ?? this.#t, a = typeof e == "string" ? an(e, i) : on(e, i), o = typeof e == "string" ? e : dn(a), s = n.target ?? document, c = n.conflictBehavior ?? "warn", l = this.#d(o, s);
		l && yn(l.id, o, c, (e) => this.#i(e));
		let u = n.ignoreInputs ?? mn(a), d = {
			id: r,
			hotkey: o,
			parsedHotkey: a,
			callback: t,
			options: {
				...pn,
				requireReset: !1,
				...n,
				platform: i,
				ignoreInputs: u
			},
			hasFired: !1,
			triggerCount: 0,
			target: s
		};
		this.registrations.setState((e) => new Map(e).set(r, d)), this.#r.has(s) || this.#r.set(s, /* @__PURE__ */ new Set()), this.#r.get(s).add(r), this.#a(s);
		let f = this;
		return {
			get id() {
				return r;
			},
			unregister: () => {
				f.#i(r);
			},
			get callback() {
				return f.registrations.state.get(r)?.callback ?? t;
			},
			set callback(e) {
				let t = f.registrations.state.get(r);
				t && (t.callback = e);
			},
			setOptions: (e) => {
				f.registrations.setState((t) => {
					let n = t.get(r);
					if (n) {
						let i = new Map(t);
						return i.set(r, {
							...n,
							options: {
								...n.options,
								...e
							}
						}), i;
					}
					return t;
				});
			},
			get isActive() {
				return f.registrations.state.has(r);
			}
		};
	}
	#i(e) {
		let t = this.registrations.state.get(e);
		if (!t) return;
		let n = t.target;
		this.registrations.setState((t) => {
			let n = new Map(t);
			return n.delete(e), n;
		});
		let r = this.#r.get(n);
		r && (r.delete(e), r.size === 0 && this.#o(n));
	}
	#a(e) {
		if (typeof document > "u" || this.#n.has(e)) return;
		let t = this.#l(e), n = this.#u(e);
		e.addEventListener("keydown", t), e.addEventListener("keyup", n), this.#n.set(e, {
			keydown: t,
			keyup: n
		});
	}
	#o(e) {
		if (typeof document > "u") return;
		let t = this.#n.get(e);
		t && (e.removeEventListener("keydown", t.keydown), e.removeEventListener("keyup", t.keyup), this.#n.delete(e), this.#r.delete(e));
	}
	#s(e, t, n) {
		let r = this.#r.get(t);
		if (r) for (let i of r) {
			let r = this.registrations.state.get(i);
			if (r && vn(e, t) && r.options.enabled && !(r.options.ignoreInputs !== !1 && _n(e, t, r.target))) {
				if (n === "keydown") {
					if (r.options.eventType !== "keydown") continue;
					fn(e, r.parsedHotkey, r.options.platform) && (r.options.preventDefault && e.preventDefault(), r.options.stopPropagation && e.stopPropagation(), r.options.requireReset && r.hasFired || (this.#c(r, e), r.options.requireReset && (r.hasFired = !0)));
				} else r.options.eventType === "keyup" && fn(e, r.parsedHotkey, r.options.platform) && this.#c(r, e), r.options.requireReset && r.hasFired && this.#f(r, e) && (r.hasFired = !1);
			}
		}
	}
	#c(e, t) {
		e.options.preventDefault && t.preventDefault(), e.options.stopPropagation && t.stopPropagation(), e.triggerCount++, this.registrations.setState((e) => new Map(e));
		let n = {
			hotkey: e.hotkey,
			parsedHotkey: e.parsedHotkey
		};
		e.callback(t, n);
	}
	#l(e) {
		return (t) => {
			this.#s(t, e, "keydown");
		};
	}
	#u(e) {
		return (t) => {
			this.#s(t, e, "keyup");
		};
	}
	#d(e, t) {
		for (let n of this.registrations.state.values()) if (n.hotkey === e && n.target === t) return n;
		return null;
	}
	#f(e, t) {
		let n = e.parsedHotkey, r = Z(t.key), i = n.key.length === 1 ? n.key.toUpperCase() : n.key;
		return !!((r.length === 1 ? r.toUpperCase() : r) === i || n.ctrl && r === "Control" || n.shift && r === "Shift" || n.alt && r === "Alt" || n.meta && r === "Meta");
	}
	triggerRegistration(e) {
		let t = this.registrations.state.get(e);
		if (!t) return !1;
		let n = t.parsedHotkey, r = new KeyboardEvent(t.options.eventType ?? "keydown", {
			key: n.key,
			ctrlKey: n.ctrl,
			shiftKey: n.shift,
			altKey: n.alt,
			metaKey: n.meta,
			bubbles: !0,
			cancelable: !0
		});
		return t.triggerCount++, this.registrations.setState((e) => new Map(e)), t.callback(r, {
			hotkey: t.hotkey,
			parsedHotkey: t.parsedHotkey
		}), !0;
	}
	getRegistrationCount() {
		return this.registrations.state.size;
	}
	isRegistered(e, t) {
		for (let n of this.registrations.state.values()) if (n.hotkey === e && (t === void 0 || n.target === t)) return !0;
		return !1;
	}
	destroy() {
		for (let e of this.#n.keys()) this.#o(e);
		this.registrations.setState(() => /* @__PURE__ */ new Map()), this.#n.clear(), this.#r.clear();
	}
};
function Bn() {
	return zn.getInstance();
}
// node_modules/.bun/@tanstack+react-hotkeys@0.10.0+bf16f8eded5e12ee/node_modules/@tanstack/react-hotkeys/dist/useHotkeys.js
function Vn(e, t = {}) {
	let n = Wt().hotkey, r = Bn(), i = t.platform ?? n?.platform ?? X(), a = z(/* @__PURE__ */ new Map()), o = z(e), s = z([]), c = z(t), l = z(n), u = z(r), d = e.map((e) => un(e.hotkey, i));
	o.current = e, s.current = d, c.current = t, l.current = n, u.current = r, R(() => {
		let e = a.current, t = /* @__PURE__ */ new Map(), n = [];
		for (let e = 0; e < o.current.length; e++) {
			let t = o.current[e], r = s.current[e], i = {
				...l.current,
				...c.current,
				...t.options
			}, a = Gt(i.target) ? i.target.current : i.target ?? (typeof document < "u" ? document : null);
			if (!a) continue;
			let u = `${e}:${r}`;
			n.push({
				registrationKey: u,
				def: t,
				hotkeyStr: r,
				mergedOptions: i,
				resolvedTarget: a
			});
		}
		let r = new Set(n.map((e) => e.registrationKey));
		for (let [t, n] of e) !r.has(t) && n.handle.isActive && n.handle.unregister();
		for (let r of n) {
			let { registrationKey: n, def: i, hotkeyStr: a, mergedOptions: o, resolvedTarget: s } = r, c = e.get(n);
			if (c?.handle.isActive && c.target === s) {
				t.set(n, c);
				continue;
			}
			c?.handle.isActive && c.handle.unregister();
			let l = u.current.register(a, i.callback, {
				...o,
				target: s
			});
			t.set(n, {
				handle: l,
				target: s
			});
		}
		a.current = t;
	}), R(() => () => {
		for (let { handle: e } of a.current.values()) e.isActive && e.unregister();
		a.current = /* @__PURE__ */ new Map();
	}, []);
	for (let r = 0; r < e.length; r++) {
		let i = e[r], o = d[r], s = `${r}:${o}`, c = a.current.get(s)?.handle;
		if (c?.isActive) {
			c.callback = i.callback;
			let { target: e, ...r } = {
				...n,
				...t,
				...i.options
			};
			c.setOptions(r);
		}
	}
}
// packages/pstdio-workbench/src/react/keybindings/tanstack-hotkey-adapter.ts
var Hn = (e) => {
	Vn(e.map((e) => ({
		hotkey: e.hotkey,
		callback: (t) => {
			t.preventDefault(), e.execute();
		},
		options: {
			enabled: e.enabled,
			ignoreInputs: e.ignoreInputs,
			preventDefault: !0,
			stopPropagation: !0
		}
	})), {
		ignoreInputs: !0,
		preventDefault: !0,
		stopPropagation: !0
	});
}, Un = {
	alt: "Alt",
	cmd: "Meta",
	command: "Meta",
	ctrl: "Control",
	control: "Control",
	meta: "Meta",
	mod: "Mod",
	option: "Alt",
	shift: "Shift"
}, Wn = (e) => e.split("+").map((e) => {
	let t = e.trim();
	return Un[t.toLowerCase()] || (t.length === 1 ? t.toUpperCase() : t.slice(0, 1).toUpperCase() + t.slice(1));
}).join("+"), Gn = (e) => {
	let t = s(e).map(Wn);
	return t.length === 1 ? t[0] ?? "" : t;
}, Kn = (e) => {
	let { workbench: t, disabled: n = !1, commandIds: r } = e, i = r ? new Set(r) : void 0;
	return t.keybindings.listActiveKeybindings().flatMap((e, r) => {
		let a = e.action;
		if (a.kind === "command") {
			if (i && !i.has(a.commandId)) return [];
			let r = t.commands.getCommand(a.commandId);
			if (!r) return [];
			let o = !n && t.commands.isCommandVisible(r.command.id, a.args) && t.commands.isCommandEnabled(r.command.id, a.args);
			return [{
				id: r.command.id,
				hotkey: Gn(e.keybinding),
				enabled: o,
				ignoreInputs: !0,
				execute: async () => {
					if (a.args === void 0 && w(r.command.params)) {
						let e = t.getPrimaryResource();
						t.commandPalette.requestParams({
							record: r,
							label: r.command.label,
							context: e ? { resource: e } : void 0
						});
					} else return f(t, r.command.label, () => t.navigation.openTarget(a));
				}
			}];
		}
		return i ? [] : [{
			id: `workbench.keybinding.${r}`,
			hotkey: Gn(e.keybinding),
			enabled: !n,
			ignoreInputs: !0,
			execute: () => f(t, "Open", () => t.navigation.openTarget(a))
		}];
	});
}, qn = (e) => {
	let { workbench: t, disabled: n, commandIds: r } = e, [i, a] = B(() => Kn({
		workbench: t,
		disabled: n,
		commandIds: r
	}));
	return R(() => {
		let e = () => a(Kn({
			workbench: t,
			disabled: n,
			commandIds: r
		})), i = [
			t.keybindings.store,
			t.context.store,
			t.commands.store
		].map((t) => t.subscribe(e));
		return e(), () => {
			for (let e of i) e();
		};
	}, [
		t,
		n,
		r
	]), Hn(i), null;
}, Jn = (e) => {
	let { action: t, workbench: n } = e;
	f(n, t.title, () => n.commands.executeCommand(t.commandId, t.args));
}, Yn = (e) => {
	let { workbench: t } = e, n = z(/* @__PURE__ */ new Set());
	return R(() => {
		let e = (e) => {
			if (e.level === "error" || e.inlineTarget) {
				n.current.delete(e.id) && Dt.dismiss(e.id);
				return;
			}
			let r = e.actions?.[0], i = r ? {
				label: r.title,
				onClick: () => Jn({
					action: r,
					workbench: t
				})
			} : void 0, a = {
				id: e.id,
				type: e.level,
				title: e.title,
				description: e.message,
				action: i,
				closable: !0,
				onStatusChange: (n) => {
					n.status === "unmounted" && t.notifications.store.getState().notifications[e.id] === e && t.notifications.dismiss(e.id);
				}
			};
			n.current.has(e.id) ? Dt.update(e.id, a) : (n.current.add(e.id), Dt.create(a));
		};
		for (let n of t.notifications.listNotifications()) e(n);
		let r = t.notifications.subscribe((t) => {
			t.type === "show" ? e(t.notification) : (n.current.delete(t.id), Dt.dismiss(t.id));
		});
		return () => {
			r.dispose();
			for (let e of n.current) Dt.dismiss(e);
			n.current.clear();
		};
	}, [t]), null;
}, Xn = (e) => {
	let { panels: t, region: n, resource: r, workbench: i } = e, a = z(null), o = "Add panel";
	if (t.length === 0) return null;
	let s = (e) => ne({
		workbench: i,
		widget: e.contribution,
		region: n,
		resource: r,
		pinned: e.pinned,
		open: e.open
	}), c = /* @__PURE__ */ J(W, {
		ref: t.length > 1 ? a : void 0,
		size: K,
		variant: "ghost",
		"aria-label": o,
		flexShrink: 0,
		onClick: t.length === 1 ? () => s(t[0]) : void 0,
		children: /* @__PURE__ */ J(C, {
			name: "plus",
			size: 13
		})
	});
	return t.length === 1 ? /* @__PURE__ */ J(q, {
		content: o,
		children: c
	}) : /* @__PURE__ */ Y(G.Root, {
		positioning: {
			placement: "bottom-start",
			getAnchorElement: () => a.current
		},
		children: [/* @__PURE__ */ J(q, {
			content: o,
			children: /* @__PURE__ */ J(G.Trigger, {
				asChild: !0,
				children: c
			})
		}), /* @__PURE__ */ J(ot, { children: /* @__PURE__ */ J(G.Positioner, { children: /* @__PURE__ */ J(G.Content, {
			"aria-label": o,
			minW: "17.5rem",
			bg: "bg",
			children: t.map((e) => /* @__PURE__ */ J(G.Item, {
				value: `widget:${e.contribution.id}`,
				asChild: !0,
				children: /* @__PURE__ */ J(vt, {
					asChild: !0,
					variant: "full-width",
					label: e.contribution.title,
					icon: e.contribution.icon ? /* @__PURE__ */ J(C, {
						name: e.contribution.icon,
						size: 14
					}) : void 0,
					onActivate: () => s(e)
				})
			}, e.contribution.id))
		}) }) })]
	});
}, Zn = (e, t, n) => {
	let r, i = Math.hypot(e.x - t.x, e.y - t.y);
	for (let { id: t, rect: a } of n) {
		let n = Math.hypot(Math.max(a.left - e.x, 0, e.x - a.right), Math.max(a.top - e.y, 0, e.y - a.bottom));
		n < i && (r = t, i = n);
	}
	return r;
}, Qn = (e, t) => {
	let n = e.pointerCoordinates;
	if (!n || !t) return [];
	let r = Zn(n, t, e.droppableContainers.filter((t) => t.data.current?.panelRegion === e.active.data.current?.panelRegion).flatMap((t) => {
		let r = t.node.current?.closest("[data-workbench-panel-drop-frame=\"activity\"]")?.getBoundingClientRect(), i = e.droppableRects.get(t.id);
		return !i || !r || n.x < r.left || n.x > r.right || n.y < r.top || n.y > r.bottom ? [] : [{
			id: t.id,
			rect: i
		}];
	}));
	return r === void 0 ? [] : [{ id: r }];
}, $n = (e) => {
	let t = e.pointerCoordinates;
	if (!t) return [];
	let n = document.elementsFromPoint(t.x, t.y).map((e) => e.closest("[data-workbench-panel]")).find((e) => e && !e.closest("[inert]"))?.getAttribute("data-workbench-panel"), r = e.droppableContainers.filter((t) => {
		let r = t.node.current;
		return t.data.current?.widgetId && (!n || t.data.current.region === n) && t.id !== e.active.id && r?.getClientRects().length && !r.closest("[inert]");
	}), i = new Map(e.droppableRects);
	for (let e of r) {
		if (e.data.current?.region === "side") continue;
		let t = e.node.current, n = t.closest("[data-workbench-panel-drop-frame=\"side\"]")?.querySelector("[data-workbench-edge-drop=\"side\"][data-workbench-edge-position=\"left\"]")?.getBoundingClientRect(), r = t.closest("[data-workbench-panel-drop-frame=\"secondary\"]")?.querySelector("[data-workbench-edge-drop=\"secondary\"][data-workbench-edge-position=\"top\"]")?.getBoundingClientRect(), a = i.get(e.id);
		if (!a) continue;
		let o = n?.width ?? 0, s = r?.height ?? 0;
		i.set(e.id, {
			...a,
			left: a.left - o,
			top: a.top - s,
			width: a.width + o,
			height: a.height + s
		});
	}
	return Oe({
		...e,
		droppableContainers: r,
		droppableRects: i
	});
}, er = (e) => {
	let t = e.pointerCoordinates;
	return t ? e.droppableContainers.filter((e) => e.data.current?.panelPosition).flatMap((e) => {
		let { region: n, panelPosition: r } = e.data.current, i = e.node.current, a = i?.closest(`[data-workbench-panel-drop-frame="${n}"]`);
		if (!i || !a) return [];
		let o = a.getBoundingClientRect(), s = n === "secondary" ? i.closest("[data-workbench-panel-drop-frame=\"side\"]")?.querySelector("[data-workbench-edge-drop=\"side\"]")?.getBoundingClientRect() : void 0, c = {
			left: Math.min(o.left, s?.left ?? o.left),
			right: Math.max(o.right, s?.right ?? o.right)
		};
		if (t.x < c.left || t.x > c.right || t.y < o.top || t.y > o.bottom) return [];
		let l = {
			left: t.x - c.left,
			right: c.right - t.x,
			top: t.y - o.top,
			bottom: o.bottom - t.y
		}, u = r === "left" || r === "right", d = i.getBoundingClientRect(), f = l[r];
		return f > (u ? d.width : d.height) ? [] : [{
			id: e.id,
			data: {
				droppableContainer: e,
				value: f
			}
		}];
	}).sort((e, t) => e.data.value - t.data.value).slice(0, 1) : [];
}, tr = Xe({}), nr = () => Qe(tr), rr = (e) => {
	let { workbench: t, children: n } = e, [r, i] = B(), [s, u] = B(), [d, f] = B(), [p, m] = B(), h = z(void 0), g = Ne(Ee(Ae, { activationConstraint: { distance: 5 } }), Ee(De, { activationConstraint: { distance: 5 } })), _ = () => {
		h.current = void 0, i(void 0), u(void 0), f(void 0), m(void 0);
	}, v = (e) => {
		let n = e.over?.data.current;
		if (!n?.region || e.over?.id === e.active.id || !t.getPanelDestinations(String(e.active.id)).includes(n.region)) return;
		let r = t.layout.getLayout(), i = o(r, String(e.active.id))?.placement;
		if (!i) return;
		let a = n.region, s = r.regions[a].widgets, c = n.widgetId, u = e.active.rect.current.translated, d = u && e.over && u.left + u.width / 2 < e.over.rect.left + e.over.rect.width / 2, f = "end";
		c && (f = d ? { beforeWidgetId: c } : { afterWidgetId: c });
		let p = l(s, i, f), m = p.widgets.findIndex((e) => e.widgetId === i.widgetId), h = p.widgets[m + 1], g = p.widgets[m - 1];
		return {
			region: a,
			position: f,
			widgetId: h?.widgetId ?? g?.widgetId,
			edge: h ? "before" : "after",
			panelPosition: n.panelPosition
		};
	}, y = r ? o(t.layout.getLayout(), r)?.placement : void 0;
	return /* @__PURE__ */ J(tr, {
		value: {
			activeId: r,
			drop: p,
			activePanel: s,
			panelDrop: d,
			destinations: r ? t.getPanelDestinations(r) : []
		},
		children: /* @__PURE__ */ Y(je, {
			sensors: g,
			collisionDetection: (e) => {
				if (e.active.data.current?.panelRegion) return Qn(e, h.current);
				let n = t.getPanelDestinations(String(e.active.id)), r = $n(e).filter((e) => n.includes(e.data?.droppableContainer.data.current?.region));
				if (r.length) return r;
				let i = er(e);
				if (i.length) return i;
				let a = e.pointerCoordinates, o = a ? document.elementFromPoint(a.x, a.y)?.closest("[data-workbench-panel]")?.getAttribute("data-workbench-panel") : void 0;
				return Oe(e).filter((e) => e.data?.droppableContainer.data.current?.region === o).sort((t, n) => {
					let r = (t) => {
						let n = e.droppableRects.get(t);
						return n ? n.width * n.height : Infinity;
					};
					return r(t.id) - r(n.id);
				});
			},
			onDragStart: (e) => {
				if (e.active.data.current?.panelRegion) {
					let t = e.activatorEvent, n = "touches" in t ? t.touches[0] : t;
					h.current = {
						x: n.clientX,
						y: n.clientY
					}, u(e.active.data.current.panelRegion);
				} else i(String(e.active.id));
			},
			onDragOver: (e) => {
				m(v(e)), f(e.over?.data.current?.position);
			},
			onDragMove: (e) => {
				m(v(e)), f(e.over?.data.current?.position);
			},
			onDragCancel: _,
			onDragEnd: (e) => {
				if (e.active.data.current?.panelRegion) {
					let n = e.over?.data.current;
					_(), n?.position && n.panelRegion === e.active.data.current.panelRegion && t.shell.repositionPanel(n.panelRegion, n.position);
					return;
				}
				let n = v(e);
				_(), n && a(() => {
					n.panelPosition && n.panelPosition !== c(t.shell.getArrangement(), n.region) && t.shell.repositionPanel(n.region, n.panelPosition), t.movePanel(String(e.active.id), n.region, n.position), n.panelPosition && n.region === "side" && t.shell.setSidePanelPresentation("attached");
				});
			},
			children: [n, /* @__PURE__ */ J(V, {
				asChild: !0,
				pointerEvents: "none",
				children: /* @__PURE__ */ J(ke, {
					dropAnimation: null,
					children: y ? /* @__PURE__ */ J(V, {
						layerStyle: "floatingBar",
						textStyle: "label/XS/medium",
						children: y.title ?? y.resource?.label
					}) : null
				})
			})]
		})
	});
}, ir = (e) => {
	let { region: t, visible: n = !0 } = e, { activeId: r, drop: i, destinations: a } = nr(), o = $e(), s = !!(r && n), c = s && !!a?.includes(t), { setNodeRef: l } = Pe({
		id: o,
		data: { region: t },
		disabled: !c
	}), u = c && i?.region === t && !i.panelPosition;
	return /* @__PURE__ */ J(V, {
		ref: l,
		"data-workbench-tab-drop": t,
		"data-drop-active": u || void 0,
		position: "absolute",
		inset: "0",
		zIndex: "dropdown",
		pointerEvents: s ? "auto" : "none",
		visibility: s ? "visible" : "hidden",
		layerStyle: u ? "tabDropZone" : void 0
	});
}, ar = (e, t) => {
	let { workbench: n, placement: r, disabled: i = !1, sortable: a = !1, region: o, nextWidgetId: s, previousWidgetId: c } = e, l = A(r, n), { menu: u, show: d, onContextMenu: f } = Te(t, i), p = z(void 0), m = z({
		x: 0,
		y: 0
	}), h = z(!1), g = Me({
		id: r.widgetId,
		disabled: i || !a
	}), _ = Pe({
		id: r.widgetId,
		disabled: !o,
		data: {
			region: o,
			widgetId: r.widgetId
		}
	}), v = nr(), y = () => clearTimeout(p.current);
	return R(() => () => clearTimeout(p.current), []), {
		snapshot: l,
		menu: u,
		drag: g,
		target: _,
		drop: v.drop?.widgetId === r.widgetId ? v.drop : void 0,
		onContextMenu: f,
		onKeyDown: (e) => {
			e.key === "ContextMenu" || e.shiftKey && e.key === "F10" ? (e.preventDefault(), d(e.currentTarget)) : a && !i && e.altKey && (e.key === "ArrowLeft" && c && (e.preventDefault(), n.layout.reorderPanel(r.widgetId, { beforeWidgetId: c })), e.key === "ArrowRight" && s && (e.preventDefault(), n.layout.reorderPanel(r.widgetId, { afterWidgetId: s })));
		},
		onPointerDown: (e) => {
			if (h.current = !1, e.pointerType !== "touch") return;
			let t = e.currentTarget;
			m.current = {
				x: e.clientX,
				y: e.clientY
			}, p.current = setTimeout(() => {
				h.current = !0, d(t);
			}, 550);
		},
		onPointerMove: (e) => {
			Math.hypot(e.clientX - m.current.x, e.clientY - m.current.y) > 5 && y();
		},
		onPointerUp: y,
		onPointerCancel: y,
		onClick: (e) => {
			h.current && (e.preventDefault(), e.stopPropagation());
		}
	};
}, or = (e) => {
	let { indicator: t, icon: n } = e;
	return t ? /* @__PURE__ */ J(C, {
		name: t.icon,
		size: 12,
		flexShrink: 0,
		color: t.color ?? "fg.muted",
		"aria-label": t.label
	}) : n ? /* @__PURE__ */ J(C, {
		name: n,
		size: 12,
		flexShrink: 0,
		color: "fg.muted"
	}) : null;
}, sr = (e) => {
	let { workbench: t, placement: n, activeWidgetId: r, disabled: i = !1, sortable: a = !1 } = e, o = ut().getTriggerProps({ value: n.widgetId }).id, s = ar(e, o), { snapshot: c, drag: l, target: u, drop: d } = s, f = c.label ?? n.resource?.label ?? n.title ?? n.contributionId, p = `workbench-tab-label-${n.widgetId}`, m = z(null), h = t.layout.getWidget(n.contributionId), g = c.icon ?? ce(n, h, n.resource ? t.resources.getKind(n.resource.type, n.resource.extensionId)?.icon : void 0), _ = n.widgetId === r;
	return /* @__PURE__ */ Y(Ot, { children: [/* @__PURE__ */ Y(V, {
		ref: (e) => {
			l.setNodeRef(e), u.setNodeRef(e);
		},
		position: "relative",
		"data-workbench-tab": n.widgetId,
		minW: n.closable ? "tab-min" : void 0,
		flex: n.closable ? "1 1 0" : "0 0 auto",
		maxW: "fit-content",
		className: "group",
		children: [/* @__PURE__ */ J(q, {
			content: f,
			overflowRef: m,
			closeDelay: 150,
			positioning: { placement: "bottom" },
			children: /* @__PURE__ */ Y(ct.Trigger, {
				id: o,
				value: n.widgetId,
				"aria-labelledby": p,
				disabled: i,
				"aria-haspopup": "menu",
				"aria-expanded": s.menu.api.open,
				"aria-keyshortcuts": a ? "Alt+ArrowLeft Alt+ArrowRight Shift+F10" : "Shift+F10",
				fontStyle: n.tabRetention === "preview" ? "italic" : void 0,
				opacity: l.isDragging ? .5 : void 0,
				w: "full",
				...l.listeners,
				onKeyDown: s.onKeyDown,
				onContextMenu: s.onContextMenu,
				onPointerDown: s.onPointerDown,
				onPointerMove: s.onPointerMove,
				onPointerUp: s.onPointerUp,
				onPointerCancel: s.onPointerCancel,
				onClickCapture: s.onClick,
				children: [
					/* @__PURE__ */ J(or, {
						indicator: c.indicator,
						icon: g
					}),
					/* @__PURE__ */ J(lt, {
						asChild: !0,
						children: /* @__PURE__ */ J("span", {
							ref: m,
							id: p,
							"data-tab-label": !0,
							children: f
						})
					}),
					n.closable ? /* @__PURE__ */ J(it, {
						as: "span",
						role: "button",
						"aria-label": `Close ${f}`,
						"aria-disabled": i,
						"data-tab-close": !0,
						size: "2xs",
						boxSize: "4",
						minW: "4",
						p: "0",
						borderRadius: "2xs",
						flexShrink: 0,
						me: "-1",
						opacity: +!!_,
						pointerEvents: _ ? "auto" : "none",
						color: "fg.muted",
						_groupHover: {
							opacity: 1,
							pointerEvents: "auto"
						},
						_groupFocusWithin: {
							opacity: 1,
							pointerEvents: "auto"
						},
						onPointerDown: (e) => e.stopPropagation(),
						onMouseDown: (e) => e.stopPropagation(),
						onTouchStart: (e) => e.stopPropagation(),
						onClick: (e) => {
							e.stopPropagation(), !i && (n.placementIdentity ? t.closePlacement(n.placementIdentity) : t.layout.closePanel(n.widgetId));
						}
					}) : null
				]
			})
		}), /* @__PURE__ */ J(cr, { drop: d })]
	}), /* @__PURE__ */ J(we, {
		menu: s.menu,
		label: f,
		groups: c.menu ?? [],
		placement: n,
		workbench: t
	})] });
}, cr = (e) => {
	let { drop: t } = e;
	return t ? /* @__PURE__ */ J(ht, {
		orientation: "vertical",
		left: t.edge === "before" ? "0" : void 0,
		right: t.edge === "after" ? "0" : void 0
	}) : null;
}, lr = (e) => {
	let { activeWidgetId: t, disabled: n, panelRegion: r, placements: i, workbench: a } = e;
	return /* @__PURE__ */ J(ct.List, {
		h: "full",
		minH: "0",
		w: "full",
		alignItems: "center",
		gap: "2xs",
		justifyContent: "flex-start",
		children: i.map((e, o) => /* @__PURE__ */ J(sr, {
			workbench: a,
			placement: e,
			activeWidgetId: t,
			disabled: n,
			region: r,
			sortable: !!(r && a.getPanelDestinations(e.widgetId).length),
			previousWidgetId: i[o - 1]?.widgetId,
			nextWidgetId: i[o + 1]?.widgetId
		}, e.widgetId))
	});
}, ur = (e, t) => {
	let n = ce(t, e.layout.getWidget(t.contributionId), t.resource ? e.resources.getKind(t.resource.type, t.resource.extensionId)?.icon : void 0);
	return n ? /* @__PURE__ */ J(C, {
		name: n,
		size: 14
	}) : void 0;
}, dr = (e) => {
	let { workbench: t, region: n, state: r } = e, { commands: i, regionState: a, resource: o, tabStore: s, subPanelPlacements: c, visiblePlacements: l, leadingItems: u, panelRegion: d, eligibleSubPanels: p, showTabs: m, hasActions: h } = r, g = s.tabOverrides, _ = (e) => se(n, e), [v, y] = B(null), [b, x] = B(!1), [S, T] = B({
		x: 0,
		y: 0,
		width: 0,
		height: 0
	}), E = Tt(c, g, {
		onToggleTab: (e, t) => s.toggleTab(e, t),
		onResetAll: () => s.reset()
	}, _, {
		visibleIcon: /* @__PURE__ */ J(C, {
			name: "eye",
			size: 14
		}),
		hiddenIcon: /* @__PURE__ */ J(C, {
			name: "eye-off",
			size: 14
		}),
		resetIcon: /* @__PURE__ */ J(C, {
			name: "rotate-ccw",
			size: 14
		})
	}, (e) => ur(t, e)), D = E.length > 0, O = (e) => {
		if (!D) return;
		e.preventDefault();
		let t = ((e.target instanceof Element ? e.target.closest("[role=\"tab\"]") : void 0) ?? e.currentTarget).getBoundingClientRect();
		T({
			x: t.x,
			y: t.y,
			width: t.width,
			height: t.height
		}), x(!0);
	};
	R(() => {
		if (!v) return;
		let e = (e) => {
			e.deltaY === 0 || v.scrollWidth <= v.clientWidth || (v.scrollLeft += e.deltaY, e.preventDefault());
		};
		return v.addEventListener("wheel", e, { passive: !1 }), () => v.removeEventListener("wheel", e);
	}, [v]);
	let k = de(l, a.activeWidgetId);
	if (R(() => {
		if (!k || !v) return;
		let e = v.querySelector("[role=\"tab\"][aria-selected=\"true\"]");
		if (!e) return;
		let t = v.getBoundingClientRect().left + v.clientLeft, n = t + v.clientWidth, r = e.getBoundingClientRect(), i = r.left - t, a = r.right - n;
		i < 0 && a < 0 ? v.scrollLeft += Math.max(i, a) : i > 0 && a > 0 && (v.scrollLeft += Math.min(i, a));
	}, [k, v]), !m && !h) return null;
	let ee = (e) => {
		let n = i[e.commandId]?.command;
		n && w(n.params) ? t.commandPalette.requestParams({
			record: { command: n },
			label: e.label,
			args: e.args
		}) : f(t, e.label, () => t.commands.executeCommand(e.commandId, e.args));
	}, A = u.map((e) => /* @__PURE__ */ J(q, {
		content: e.label,
		children: /* @__PURE__ */ J(W, {
			size: K,
			variant: "ghost",
			"aria-label": e.label,
			disabled: e.disabled,
			flexShrink: 0,
			onPointerDown: (e) => e.stopPropagation(),
			onClick: (t) => {
				t.stopPropagation(), ee(e);
			},
			children: /* @__PURE__ */ J(C, {
				name: e.icon ?? "plus",
				size: 14
			})
		})
	}, e.id));
	return m ? /* @__PURE__ */ Y(U, {
		flex: "1",
		h: "full",
		minW: "0",
		gap: "2xs",
		children: [
			/* @__PURE__ */ Y(ct.Root, {
				value: k,
				onValueChange: (e) => {
					let r = l.find((t) => t.widgetId === e.value);
					r?.role === "location" ? t.layout.setRegionActiveWidget(n, r.widgetId) : t.layout.activatePanel(e.value);
				},
				variant: "subtle",
				colorPalette: "gray",
				justify: "start",
				size: yt,
				alignSelf: "stretch",
				flex: "0 1 auto",
				maxW: "full",
				minW: "0",
				h: "full",
				position: "relative",
				zIndex: "1",
				onContextMenu: D ? O : void 0,
				children: [/* @__PURE__ */ J(Ct, {
					viewportRef: y,
					size: "xs",
					h: "full",
					maxW: "full",
					minW: "0",
					showVerticalScrollbar: !1,
					showHorizontalScrollbar: !0,
					contentProps: {
						h: "full",
						w: "full",
						minW: "0!"
					},
					children: /* @__PURE__ */ J(lr, {
						disabled: !1,
						workbench: t,
						placements: l,
						activeWidgetId: k,
						panelRegion: d
					})
				}), D ? /* @__PURE__ */ J(G.Root, {
					open: b,
					onOpenChange: (e) => x(e.open),
					positioning: {
						placement: "bottom-start",
						getAnchorRect: () => S,
						offset: { mainAxis: 0 }
					},
					children: /* @__PURE__ */ J(ot, { children: /* @__PURE__ */ J(G.Positioner, { children: /* @__PURE__ */ J(G.Content, {
						minW: "220px",
						bg: "bg",
						children: E.map((e) => /* @__PURE__ */ J(G.Item, {
							value: e.key,
							asChild: !0,
							children: /* @__PURE__ */ J(vt, {
								asChild: !0,
								variant: "full-width",
								label: e.label,
								icon: e.icon,
								endContent: e.endContent,
								disabled: e.isDisabled,
								onActivate: e.onClick
							})
						}, e.key))
					}) }) })
				}) : null]
			}),
			d ? /* @__PURE__ */ J(Xn, {
				workbench: t,
				region: d,
				resource: o,
				panels: p
			}) : null,
			A
		]
	}) : /* @__PURE__ */ Y(U, {
		flex: "1",
		h: "full",
		minW: "0",
		gap: "2xs",
		children: [d ? /* @__PURE__ */ J(Xn, {
			workbench: t,
			region: d,
			resource: o,
			panels: p
		}) : null, A]
	});
}, fr = (e) => {
	let { workbench: t, region: n, visibilityStorageKey: r } = e, i = ae(t, n, r);
	return /* @__PURE__ */ J(dr, {
		...e,
		state: i
	});
}, pr = (e) => {
	let { workbench: t, region: n, visibilityStorageKey: r } = e, i = oe(t, n, r);
	return /* @__PURE__ */ J(dr, {
		...e,
		state: i
	});
}, mr = (e) => {
	let { region: t } = e, n = u.find((e) => e === t);
	return n ? /* @__PURE__ */ J(fr, {
		...e,
		region: n
	}) : /* @__PURE__ */ J(pr, { ...e });
}, hr = class extends Error {
	constructor() {
		super("The query revision changed. Reload the first page.");
	}
}, gr = (e, t) => {
	let n = e.page;
	if (!n || typeof n.revision != "string" || !Array.isArray(n.groups)) throw Error("A paged provider must return page metadata");
	if (t.revision !== void 0 && t.revision !== n.revision) throw new hr();
	if (e.rows.length > t.limit) throw Error("The provider exceeded the requested page limit");
	if (!Number.isSafeInteger(n.total) || !Number.isSafeInteger(n.filteredTotal) || n.filteredTotal < 0 || e.rows.length > n.filteredTotal || n.total < n.filteredTotal || n.groups.some((e) => !Number.isSafeInteger(e.count) || e.count < 0 || e.count > n.total)) throw Error("The provider returned inconsistent page counts");
	if (n.cursor !== null && (typeof n.cursor != "string" || !n.cursor)) throw Error("The provider must return a cursor or null");
	return {
		rows: e.rows,
		page: n
	};
}, _r = (e, t, n, r) => I([
	e.id,
	kt(t),
	n,
	e.contextKeys?.map((e) => r[e] ?? null)
]), vr = (e, t) => {
	if (e.columns) return e.columns;
	if (t) return t;
	let n = e.rows[0];
	return n ? Object.keys(n.values).map((e) => ({ id: e })) : [];
}, yr = Symbol("renderer row"), br = { get: (e) => e[yr] }, xr = (e, t) => ({
	data: e.map((e) => {
		let n = Object.fromEntries(t.map((t) => [t.id, e.values[t.id]]));
		return Object.defineProperty(n, yr, { value: e }), n;
	}),
	rowByData: br
}), Sr = (e, t) => e.map((e) => ({
	label: e.label,
	icon: e.icon,
	destructive: e.destructive,
	onSelect: (n) => {
		let r = n.flatMap((e) => {
			let n = t.get(e);
			return n ? [n] : [];
		});
		e.run(r);
	}
})), Cr = (e, t, n) => {
	let r = t.get(e)?.resource;
	return r ? n(r).filter((e) => !e.isDisabled).map((e) => ({
		label: e.label,
		icon: e.icon,
		onSelect: (t) => void e.onClick?.()
	})) : [];
}, wr = (e, t, n) => {
	let r = kt(t.resource) ?? t.resource?.id ?? "unscoped", i = e.contextKeys?.map((e) => n[e] ?? null), a = `pstdio:workbench:dataTableRenderer:${e.id}:${t.instanceId}:${r}`;
	return i?.length ? `${a}:${I(i)}` : a;
}, Tr = (e, t) => {
	let [n, r] = B({ scope: e });
	n.scope !== e && r({ scope: e });
	let i = n.scope === e ? n.columns ?? t ?? [] : t ?? [];
	return {
		columns: i,
		pending: (e, t, n) => !n && e !== void 0 && I(e) !== I(t),
		accept: (n, a) => {
			if (!a || !n) return;
			let o = vr(n, t).map(({ id: e, hidden: t }) => ({
				id: e,
				hidden: t
			}));
			I(o) !== I(i.map(({ id: e, hidden: t }) => ({
				id: e,
				hidden: t
			}))) && r({
				scope: e,
				columns: o
			});
		}
	};
}, Er = { rows: [] }, Dr = () => () => {}, Or = (e) => /* @__PURE__ */ J(V, {
	position: "relative",
	h: "full",
	minH: "0",
	minW: "0",
	overflow: "hidden",
	children: /* @__PURE__ */ J(st, {
		position: "absolute",
		inset: "0",
		minH: "0",
		minW: "0",
		gap: "0",
		bg: "bg",
		overflow: "hidden",
		children: e.children
	})
}), kr = (e, t, n) => {
	for (let r of e.columns ?? t ?? []) if (!(r.hidden || n.includes(r.id)) && r.stat && e.page?.statistics?.[r.id]?.type !== r.stat.type) throw Error(`The page provider did not return the requested ${r.id} statistic`);
}, Ar = (e, t, n, r) => {
	if (!(e.rows.length || e.page?.groups?.some((e) => e.field === n && e.count > 0) || t)) return /* @__PURE__ */ J(gt, {
		h: "full",
		title: r.emptyTitle ?? "No rows",
		description: r.emptyDescription
	});
}, jr = (e) => {
	let { workbench: t, contribution: n, placement: r } = e, i = Ce(t, r), a = E(t), o = S(t.context.store, Se((e) => Object.fromEntries((n.contextKeys ?? []).map((t) => [t, e.values[t]])))), s = S(t.modes.store, (e) => e.activeModeId), c = wr(n, r, o), l = n.viewsProvider, u = nt(l?.subscribe ?? Dr, l?.getSnapshot ?? (() => void 0), l?.getSnapshot ?? (() => void 0)), d = Mt(c, (e) => e.filter, n), p = Mt(c, (e) => e.sorts, n), m = Mt(c, (e) => e.settings, n), g = n.queryMode === "paged", _ = _r(n, r.resource, s, o), v = Tr(_, n.columns), y = Ie({
		identity: I([
			c,
			d,
			p,
			m,
			i
		]),
		scope: JSON.stringify([c, m.grouping]),
		fields: Fe(v.columns, m),
		initialPageSize: n.initialPageSize
	}), b = ze({
		workbench: t,
		ownerKey: x(r),
		queryKey: _,
		refreshKey: I([
			d,
			p,
			i,
			...g ? [
				m,
				y.request,
				y.key
			] : []
		]),
		load: async (e) => {
			let t = await n.executeQuery({
				pageParams: i,
				resource: r.resource,
				modeId: s,
				filter: d,
				sorts: p,
				settings: m,
				...g && { page: y.request }
			}, e);
			return g && m.showStats && kr(t, n.columns, m.hiddenColumns), g ? {
				...t,
				...y.accept(gr(t, y.request), e)
			} : {
				...t,
				position: void 0
			};
		},
		subscribe: (e) => {
			let r = () => {
				g && y.reset() || e();
			}, i = n.subscribe?.(r), a = h(t).onDidRefreshDataTableRenderer((e) => {
				e.dataTableRendererId === n.id && r();
			});
			return () => {
				typeof i == "function" ? i() : i?.dispose(), a.dispose();
			};
		}
	}), C = b.value ?? Er, w = b.error ? /* @__PURE__ */ J(Re, {
		error: b.error,
		retry: () => {
			g && y.reset() || b.retry();
		}
	}) : null, T = vr(C, n.columns);
	v.accept(b.value, g);
	let D = b.loading && !b.value || v.pending(b.value?.position?.fields, y.request.fields, b.error), O = xr(C.rows, T), k = Object.fromEntries(T.filter((e) => e.label).map((e) => [e.id, e.label])), ee = Object.fromEntries(T.filter((e) => e.description).map((e) => [e.id, e.description])), A = Object.fromEntries(T.filter((e) => e.icon).map((e) => [e.id, e.icon])), te = Object.fromEntries(T.filter((e) => e.stat).map((e) => [e.id, e.stat])), j = Object.fromEntries(T.filter((e) => e.renderer).map((e) => [e.id, e.renderer])), ne = (n.rowActions ?? []).map((e) => ({
		label: e.label,
		icon: e.icon,
		destructive: e.destructive,
		onSelect: (n) => {
			let r = O.rowByData.get(n);
			r && f(t, e.label, () => e.run(r));
		}
	})), M = Sr((n.selectionActions ?? []).map((e) => ({
		...e,
		run: (n) => f(t, e.label, () => e.run(n))
	})), O.rowByData), N = (e) => {
		let r = O.rowByData.get(e);
		r && n.onRowActivate && f(t, "Open row", () => n.onRowActivate(r));
	};
	if (D) {
		let e = (n.columns ?? []).filter((e) => !e.hidden && !m.hiddenColumns.includes(e.id)).map((e) => ({
			id: e.id,
			label: e.label ?? e.id
		}));
		return /* @__PURE__ */ J(Or, { children: /* @__PURE__ */ J(jt, { columns: e.length > 0 ? e : void 0 }) });
	}
	return !b.value && w ? w : l && !u ? /* @__PURE__ */ J(Or, { children: /* @__PURE__ */ J(jt, {}) }) : /* @__PURE__ */ Y(Or, { children: [w, /* @__PURE__ */ J(At, {
		page: y.controls(C.page, b.loading, g, b.value?.position),
		itemLabel: n.resourceKind ? t.resources.getKind(n.resourceKind)?.label : void 0,
		toolbarActions: /* @__PURE__ */ J(Be, {
			workbench: t,
			actions: n.toolbarActions,
			context: { resource: r.resource },
			renderParamField: e.renderParamField
		}),
		contentPlaceholder: Ar(C, y.search, m.grouping, n),
		data: O.data,
		getRowId: (e) => O.rowByData.get(e)?.id ?? "",
		toolbarStorageKey: c,
		viewsSource: u,
		defaultSettings: n.defaultSettings,
		defaultFilter: n.defaultFilter,
		defaultSorts: n.defaultSorts,
		defaultViews: n.defaultViews,
		defaultActiveViewId: n.defaultActiveViewId,
		columnTypes: Object.fromEntries(T.flatMap((e) => e.type ? [[e.id, e.type]] : [])),
		filterableColumns: T.filter((e) => e.filterable !== !1).map((e) => e.id),
		groupableColumns: T.filter((e) => e.groupable).map((e) => e.id),
		compactHeaders: k,
		columnDescriptions: ee,
		columnIcons: A,
		hiddenColumns: T.filter((e) => e.hidden).map((e) => e.id),
		columnStats: te,
		columnRenderers: j,
		initialPageSize: n.initialPageSize,
		pageSizeOptions: n.pageSizeOptions,
		selectionMode: n.selectionMode,
		selectionActions: M,
		rowActions: ne,
		getRowActions: (e) => Cr(e, O.rowByData, a),
		onRowClick: N,
		isRowInteractive: (e) => !!(O.rowByData.get(e) && n.onRowActivate),
		getCellContextMenuActions: (e) => Cr(e.row, O.rowByData, a),
		fullWidth: !0
	})] });
}, Mr = (e) => {
	let { view: t, workbench: n } = e, r = t.region.split("-")[0], i = r === "side" ? j.widget : j.panel;
	return /* @__PURE__ */ J(dt, {
		"data-workbench-panel-menu": `${r}-${t.side}`,
		"data-workbench-region": t.region,
		bg: i,
		children: /* @__PURE__ */ J(P, {
			workbench: n,
			region: t.region,
			title: t.label,
			transparent: !0
		})
	});
}, Nr = (e) => {
	let { content: t, view: n, workbench: r, contentMinSizePx: i = 120 } = e;
	return /* @__PURE__ */ J(bt, {
		minH: "0",
		minW: "0",
		resizableSide: n.side,
		resizablePanel: /* @__PURE__ */ J(Mr, {
			workbench: r,
			view: n
		}),
		contentPanel: t,
		collapsed: !n.has || n.collapsed,
		collapsible: n.collapsible,
		defaultSizePx: n.size.defaultPx,
		minSizePx: n.size.minPx,
		maxSizePx: n.size.maxPx,
		contentMinSizePx: i,
		resizeLabel: `Resize ${n.label}`,
		separator: "line",
		onSizeChange: (e) => r.layout.setRegionSize(n.region, e),
		onCollapsedChange: n.onCollapsedChange
	});
}, Pr = (e) => {
	let { children: t, panel: n, workbench: r } = e, [i, a] = N(r, n);
	return Nr({
		content: Nr({
			content: t,
			view: a,
			workbench: r
		}),
		view: i,
		workbench: r,
		contentMinSizePx: 120 + (a.has && !a.collapsed ? a.size.minPx + 1 : 0)
	});
}, Fr = (e) => {
	let { canAttach: t, view: n, workbench: r } = e, i = z(null), a = /* @__PURE__ */ J(W, {
		ref: i,
		variant: "ghost",
		size: K,
		"aria-label": `Open ${n.label}`,
		flexShrink: 0,
		onClick: t ? n.onOpen : void 0,
		children: /* @__PURE__ */ J(C, {
			name: n.side === "left" ? "PanelLeftOpen" : "PanelRightOpen",
			size: 14
		})
	});
	return t ? /* @__PURE__ */ J(q, {
		content: n.title,
		children: a
	}) : /* @__PURE__ */ Y(G.Root, {
		variant: "panel",
		positioning: {
			placement: n.side === "left" ? "bottom-start" : "bottom-end",
			offset: { mainAxis: 0 },
			flip: !1,
			fitViewport: !0,
			getAnchorElement: () => i.current
		},
		onExitComplete: () => i.current?.focus(),
		children: [/* @__PURE__ */ J(q, {
			content: n.title,
			children: /* @__PURE__ */ J(G.Trigger, {
				asChild: !0,
				children: a
			})
		}), /* @__PURE__ */ J(ot, { children: /* @__PURE__ */ J(G.Positioner, { children: /* @__PURE__ */ Y(G.Content, {
			"aria-label": `${n.label} controls`,
			"data-workbench-panel-menu-controls": n.region,
			children: [/* @__PURE__ */ Y(_t, {
				variant: "narrow",
				borderBottomWidth: "1px",
				borderColor: "border.subtle",
				flexShrink: 0,
				gap: "xs",
				children: [/* @__PURE__ */ J(C, {
					name: n.icon,
					size: 14
				}), /* @__PURE__ */ J(lt, {
					flex: "1",
					minW: "0",
					textStyle: "label/S/medium",
					truncate: !0,
					children: n.title
				})]
			}), /* @__PURE__ */ J(V, {
				flex: "1",
				minH: "0",
				minW: "0",
				overflowY: "auto",
				children: /* @__PURE__ */ J(P, {
					workbench: r,
					region: n.region,
					title: n.label,
					transparent: !0
				})
			})]
		}) }) })]
	});
}, Ir = (e) => {
	let { panel: t, workbench: n } = e, [r, i] = N(n, t), a = [r, i].filter((e) => e.has && e.collapsed);
	return a.length === 0 ? null : /* @__PURE__ */ J(U, {
		flexShrink: 0,
		gap: "2xs",
		minW: "0",
		children: a.map((e) => /* @__PURE__ */ J(Fr, {
			view: e,
			workbench: n,
			canAttach: e.canAttach
		}, e.region))
	});
}, Lr = (e) => {
	let { workbench: t, region: n, children: r, ...i } = e, a = F(t, n), o = ge(t, n);
	if (!a.showHeader) return null;
	let s = {
		secondary: "Bottom",
		side: "Side",
		main: "Main"
	}[n], c = {
		...i,
		"data-workbench-panel-header": n,
		"aria-label": `${s} panel header`,
		tabIndex: 0
	}, l = /* @__PURE__ */ J(pe, {
		workbench: t,
		region: n,
		...c,
		children: r
	});
	return /* @__PURE__ */ J(St, {
		actions: o,
		children: l
	});
}, Rr = (e) => e ? `calc(${e} + 0.75rem)` : "3", zr = (e) => e ? `calc(${e} + 1.5rem)` : "6", Br = () => /* @__PURE__ */ J(V, {
	flex: "1",
	minW: "0",
	children: /* @__PURE__ */ J(lt, {
		textStyle: "label/S/medium",
		color: "fg",
		truncate: !0,
		children: "Side Panel"
	})
}), Vr = (e) => {
	let { header: t } = e;
	return t ?? /* @__PURE__ */ J(Br, {});
}, Hr = (e) => {
	let { workbench: n, contentSlotRef: r, header: i } = e, a = S(n.modes.store, () => n.sidePanel.canFloat()), o = S(n.layout.store, () => n.sidePanel.getMode()), s = S(n.fullscreen.store, (e) => e.active), c = o === "attached" && !s;
	return /* @__PURE__ */ J(M, {
		workbench: n,
		region: "side",
		h: "full",
		minH: "0",
		minW: "0",
		w: "full",
		children: /* @__PURE__ */ Y(ft, {
			"data-testid": "workbench-side-panel-attached",
			"data-workbench-panel": "side",
			"data-workbench-region": "side",
			width: "full",
			minWidth: "0",
			bg: j.widget,
			layerStyle: "panel",
			header: c ? /* @__PURE__ */ Y(Lr, {
				workbench: n,
				region: "side",
				variant: "main",
				flexShrink: 0,
				gap: "sm",
				children: [
					/* @__PURE__ */ J(Vr, { header: i }),
					/* @__PURE__ */ J(Ir, {
						workbench: n,
						panel: "side"
					}),
					a ? /* @__PURE__ */ J(q, {
						content: "Float Side Panel",
						children: /* @__PURE__ */ J(W, {
							size: K,
							variant: "ghost",
							"aria-label": "Float Side Panel",
							onClick: () => n.shell.setSidePanelPresentation("floating"),
							children: /* @__PURE__ */ J(t, { size: 16 })
						})
					}) : null
				]
			}) : void 0,
			children: [/* @__PURE__ */ J(Pr, {
				workbench: n,
				panel: "side",
				children: /* @__PURE__ */ J(H, {
					position: "relative",
					flex: "1",
					minH: 0,
					direction: "column",
					children: /* @__PURE__ */ J(H, {
						ref: r,
						flex: "1",
						minH: 0,
						direction: "column"
					})
				})
			}), /* @__PURE__ */ J(ir, {
				region: "side",
				visible: c
			})]
		})
	});
}, Ur = (t) => {
	let { workbench: i, contentSlotRef: a, bottomOffset: o, header: s, bubbleIcon: c, onOpen: l, available: u = !0 } = t, d = S(i.layout.store, () => i.sidePanel.getMode()), f = S(i.fullscreen.store, (e) => e), p = S(i.modes.store, () => i.sidePanel.canFloat()), m = F(i, "side"), h = u && p && (f.active ? f.sideOpen : d === "floating"), g = z(null), _ = z(f);
	return et(() => {
		let e = _.current;
		if (_.current = f, !e.active || !f.active || !e.sideOpen || f.sideOpen) return;
		let t = requestAnimationFrame(() => g.current?.focus({ preventScroll: !0 }));
		return () => cancelAnimationFrame(t);
	}, [f]), /* @__PURE__ */ Y(Ot, { children: [u && p && m.canOpen && (f.active || d !== "attached") ? /* @__PURE__ */ J(pt, {
		ref: g,
		isOpen: h,
		"aria-label": "Open Side Panel",
		containerProps: { bottom: zr(o) },
		tooltip: "Open Side Panel",
		onClick: f.active ? () => i.commands.executeCommand("workbench.showFullscreenSide") : l ?? (() => i.shell.setSidePanelPresentation("floating")),
		children: c ?? /* @__PURE__ */ J(e, {
			size: 20,
			strokeWidth: 2
		})
	}) : null, /* @__PURE__ */ J(mt, {
		isOpen: h,
		"aria-label": "Side Panel",
		testId: "workbench-side-panel-floating",
		closeLabel: "Close Side Panel",
		containerProps: {
			"data-workbench-panel": "side",
			bottom: Rr(o),
			bg: j.widget
		},
		popOutLabel: "Reattach Side Panel",
		header: h ? /* @__PURE__ */ Y(Lr, {
			workbench: i,
			region: "side",
			variant: "main",
			gap: "sm",
			children: [
				/* @__PURE__ */ J(Vr, { header: s }),
				f.active ? null : /* @__PURE__ */ J(q, {
					content: "Reattach Side Panel",
					children: /* @__PURE__ */ J(W, {
						size: K,
						variant: "ghost",
						"aria-label": "Reattach Side Panel",
						onClick: () => i.shell.setSidePanelPresentation("attached"),
						children: /* @__PURE__ */ J(r, { size: 16 })
					})
				}),
				m.canClose ? /* @__PURE__ */ J(q, {
					content: "Close Side Panel",
					children: /* @__PURE__ */ J(W, {
						size: K,
						variant: "ghost",
						"aria-label": "Close Side Panel",
						onClick: () => f.active ? i.fullscreen.hideSide() : i.shell.setRegionOpen("side", !1),
						children: /* @__PURE__ */ J(n, { size: 16 })
					})
				}) : null
			]
		}) : null,
		onPopOut: () => i.sidePanel.setMode("attached"),
		menu: h ? /* @__PURE__ */ J(Vr, { header: s }) : void 0,
		overlay: /* @__PURE__ */ J(ir, {
			region: "side",
			visible: h
		}),
		children: /* @__PURE__ */ J(M, {
			workbench: i,
			region: "side",
			display: "flex",
			flex: "1",
			minH: "0",
			children: /* @__PURE__ */ J(H, {
				ref: a,
				flex: "1",
				minH: 0,
				direction: "column"
			})
		})
	})] });
}, Wr = (e) => {
	let t = S(e.themes.store, (e) => e.themes);
	return [...Et, ...t];
}, Gr = (e) => {
	let { children: t, ...n } = e;
	return /* @__PURE__ */ J(V, {
		...n,
		children: t
	});
}, Kr = (e) => {
	let { workbench: t } = e, n = S(t.breadcrumbs.store, (e) => e.items) ?? [], r = S(t.resources.preview.store, (e) => e.changes), { placement: a, snapshot: o, resourcePresentation: s } = ee(t);
	E(t);
	let c = a?.resource ?? n.at(-1)?.resource, l = c ? i(c, r) : void 0, u = [
		...k(t, l, o, a),
		...O(t, { menu: n.at(-1)?.menu }, l, a),
		...D(t, l).map((e) => ({
			...e,
			group: {
				id: "location",
				label: "Location"
			}
		}))
	];
	if (n.length === 0 || u.length === 0) return null;
	let d = s.label ?? l?.label ?? l?.id ?? l?.type, f = l ? `Actions for ${d}` : "Page actions";
	return /* @__PURE__ */ J(xt, {
		actions: u,
		positioning: { placement: "bottom-start" },
		children: /* @__PURE__ */ J(W, {
			size: "xs",
			variant: "ghost",
			"aria-label": f,
			"data-workbench-breadcrumb-resource-actions": "",
			children: /* @__PURE__ */ J(C, {
				name: "ChevronDown",
				size: 14
			})
		})
	});
}, qr = (e) => {
	let { workbench: t } = e, n = S(t.pageLocations.historyStore, (e) => e);
	return /* @__PURE__ */ Y(U, {
		gap: "2xs",
		flexShrink: 0,
		children: [/* @__PURE__ */ J(q, {
			content: "Navigate back",
			children: /* @__PURE__ */ J(W, {
				size: "xs",
				variant: "ghost",
				"aria-label": "Navigate back",
				disabled: !n.canGoBack,
				onClick: () => t.pageLocations.goBack(),
				children: /* @__PURE__ */ J(C, {
					name: "ArrowLeft",
					size: 14
				})
			})
		}), /* @__PURE__ */ J(q, {
			content: "Navigate forward",
			children: /* @__PURE__ */ J(W, {
				size: "xs",
				variant: "ghost",
				"aria-label": "Navigate forward",
				disabled: !n.canGoForward,
				onClick: () => t.pageLocations.goForward(),
				children: /* @__PURE__ */ J(C, {
					name: "ArrowRight",
					size: 14
				})
			})
		})]
	});
}, Jr = (e) => {
	let { workbench: t, hasNav: n, panelControls: r = !0 } = e, i = y(t, "nav"), a = S(t.fullscreen.store, (e) => e.active);
	return /* @__PURE__ */ Y(_t, {
		"data-workbench-region": "nav",
		display: "flex",
		variant: "main",
		padding: i ? "0" : void 0,
		bg: j.main,
		position: "relative",
		flexShrink: 0,
		gap: "xs",
		overflow: "hidden",
		overflowY: "hidden",
		children: [
			/* @__PURE__ */ Y(V, {
				display: i !== void 0 || a ? "none" : "contents",
				children: [/* @__PURE__ */ J(Ht, {
					workbench: t,
					menuPath: _
				}), /* @__PURE__ */ J(qr, { workbench: t })]
			}),
			/* @__PURE__ */ J(V, {
				display: n && !a ? "block" : "none",
				flex: i ? "1" : void 0,
				h: "full",
				minW: "0",
				maxW: i ? void 0 : "60%",
				overflow: "hidden",
				children: /* @__PURE__ */ J(P, {
					workbench: t,
					region: "nav",
					title: "Nav Chrome"
				})
			}),
			/* @__PURE__ */ Y(V, {
				display: i !== void 0 || a ? "none" : "contents",
				children: [
					n ? null : /* @__PURE__ */ J(V, {
						h: "full",
						minW: "0",
						maxW: "60%",
						overflow: "hidden",
						children: /* @__PURE__ */ J(te, { workbench: t })
					}),
					/* @__PURE__ */ J(U, {
						"data-workbench-breadcrumb-action-slot": "",
						flexShrink: 0,
						gap: "2xs",
						h: "6",
						justifyContent: "center",
						minW: "6",
						children: /* @__PURE__ */ J(Kr, { workbench: t })
					}),
					/* @__PURE__ */ J(V, {
						flex: "1",
						minW: "0"
					}),
					/* @__PURE__ */ J(Ht, {
						workbench: t,
						menuPath: d
					})
				]
			}),
			a || i === !1 ? /* @__PURE__ */ J(V, {
				flex: "1",
				minW: "0"
			}) : null,
			r && !a ? /* @__PURE__ */ J(Ge, { workbench: t }) : null,
			r || a ? /* @__PURE__ */ J(Ue, { workbench: t }) : null
		]
	});
}, Yr = {
	left: {
		top: "0",
		bottom: "0",
		left: "0"
	},
	right: {
		top: "0",
		bottom: "0",
		right: "0"
	},
	top: {
		top: "0",
		left: "0",
		right: "0"
	},
	bottom: {
		bottom: "0",
		left: "0",
		right: "0"
	}
}, Xr = (e) => {
	let { edge: t, region: n, panel: r } = e, { drop: i, panelDrop: a } = nr(), { setNodeRef: o } = Pe({
		id: `edge:${r ? "panel" : "tab"}:${n}:${t}`,
		data: r ? {
			panelRegion: n,
			position: t
		} : {
			region: n,
			panelPosition: t
		}
	}), s = r ? a === t : i?.region === n && i.panelPosition === t, c = t === "left" || t === "right", l = r ? `panel-${t}` : n;
	return /* @__PURE__ */ Y(Ot, { children: [r ? null : /* @__PURE__ */ J(V, {
		ref: o,
		"data-workbench-edge-hit": n,
		"data-workbench-edge-position": t,
		position: "absolute",
		...Yr[t],
		w: c ? "12" : "full",
		h: c ? "full" : "12",
		zIndex: "overlay"
	}), r || s ? /* @__PURE__ */ J(V, {
		ref: r ? o : void 0,
		"data-workbench-edge-drop": l,
		"data-workbench-edge-position": t,
		"data-drop-active": s || void 0,
		position: "relative",
		flexShrink: 0,
		w: c ? "12" : "full",
		h: c ? "full" : "12",
		layerStyle: "panelDropZone"
	}) : null] });
}, Zr = (e) => {
	let { workbench: t, region: n, children: r } = e, { activeId: i, destinations: a, activePanel: o } = nr();
	S(t.modes.store, (e) => e.activeModeId);
	let s = n === "secondary" && o === "main" ? "main" : n, l = S(t.layout.store, Se((e) => {
		let r = p(e.layout.arrangement), l = c(r, s);
		if (o === s) return t.shell.getPanelPositions(s).filter((e) => e !== l);
		if (!o && i && (n === "side" || n === "secondary") && a?.includes(n)) {
			let a = t.shell.getPanelPolicy(n).open, o = e.layout.regions[n].widgets, s = o.length === 1 && o[0]?.widgetId === i, c = t.shell.getPanelPositions(n);
			if (!a) return c.length ? c : [r[n]];
			if (s) return c.filter((e) => e !== l);
		}
		return [];
	})), u = Object.fromEntries(l.map((e) => [e, /* @__PURE__ */ J(Xr, {
		edge: e,
		region: s,
		panel: !!o
	}, e)]));
	return /* @__PURE__ */ Y(H, {
		"data-workbench-panel-drop-frame": n,
		position: "relative",
		direction: "column",
		flex: "1",
		h: "full",
		minH: "0",
		minW: "0",
		w: "full",
		children: [
			u.top,
			/* @__PURE__ */ Y(H, {
				flex: "1",
				minH: "0",
				minW: "0",
				children: [
					u.left,
					/* @__PURE__ */ J(H, {
						flex: "1",
						minH: "0",
						minW: "0",
						position: "relative",
						children: r
					}),
					u.right
				]
			}),
			u.bottom,
			n === "activity" && o ? /* @__PURE__ */ J(V, {
				"data-workbench-panel-drag-shield": "",
				"aria-hidden": !0,
				layerStyle: "panelDragging",
				position: "absolute",
				inset: "0",
				zIndex: "overlay"
			}) : null
		]
	});
}, Qr = /* @__PURE__ */ new WeakSet(), $r = (e, t = {}) => {
	Qr.has(e) || (Qr.add(e), h(e).setControlsRendererImplementation(({ workbench: e, instance: n, controlsRendererId: r }) => {
		let i = h(e).getControlsRenderer(r);
		return i ? Ze(v, {
			workbench: e,
			contribution: i,
			placement: n,
			renderParamField: t.renderParamField
		}) : null;
	}));
}, ei = /* @__PURE__ */ new WeakSet(), ti = (e, t = {}) => {
	ei.has(e) || (ei.add(e), h(e).setDataTableRendererImplementation(({ workbench: e, instance: n, dataTableRendererId: r }) => {
		let i = h(e).getDataTableRenderer(r);
		return i ? Ze(jr, {
			workbench: e,
			contribution: i,
			placement: n,
			renderParamField: t.renderParamField
		}) : null;
	}));
}, ni = /* @__PURE__ */ new WeakSet(), ri = (e) => {
	ni.has(e) || (ni.add(e), e.resources.onWillRemove((e) => (qe(kt(e)), [])), h(e).setFileRendererImplementation(({ workbench: e, instance: t, fileRendererId: n }) => {
		let r = h(e).getFileRenderer(n);
		return r ? Ze(Je, {
			workbench: e,
			contribution: r,
			placement: t
		}) : null;
	}));
}, ii = /* @__PURE__ */ new WeakSet(), ai = (e, t = {}) => {
	ii.has(e) || (ii.add(e), h(e).setKanbanRendererImplementation(({ workbench: e, instance: n, kanbanRendererId: r }) => {
		let i = h(e).getKanbanRenderer(r);
		return i ? Ze(Le, {
			workbench: e,
			contribution: i,
			placement: n,
			renderParamField: t.renderParamField
		}) : null;
	}));
}, oi = /* @__PURE__ */ new WeakMap(), si = (e, t, n) => {
	let r = e.layout.getPanel(t)?.config;
	if (r && typeof r == "object" && "viewContextId" in r) {
		let e = r.viewContextId;
		if (typeof e == "string") return e;
	}
	return n;
}, ci = (e, t = {}) => {
	let n = oi.get(e);
	if (n) {
		n.renderParamField = t.renderParamField, n.onSidenavContextActionsChange = t.onSidenavContextActionsChange;
		return;
	}
	let r = {
		renderParamField: t.renderParamField,
		onSidenavContextActionsChange: t.onSidenavContextActionsChange
	};
	oi.set(e, r), h(e).setTreeRendererImplementation(({ workbench: e, panel: t, instance: n, treeId: i }) => Ze(Ve, {
		workbench: e,
		treeViewId: i,
		placement: n,
		readOwnerKey: x(n),
		resource: n.resource,
		viewId: si(e, n.panelId, n.viewId),
		renderParamField: r.renderParamField,
		onSidenavContextActionsChange: t.region === "sidenav" ? r.onSidenavContextActionsChange : void 0
	}));
}, li = (e) => S(e.fileIconThemes.store, (e) => e.themes), ui = (e, t) => {
	if (t.actions.length) return {
		...e,
		[t.ownerId]: t.actions
	};
	let { [t.ownerId]: n, ...r } = e;
	return r;
}, di = (e) => {
	let [t, n] = tt(ui, {}), r = y(e, "sidenav"), i = S(e.layout.store, (e) => {
		let t = e.layout.regions.sidenav;
		return t.activeWidgetId ?? t.widgets[0]?.widgetId;
	}), a = r === void 0 ? i : r;
	return {
		contextActions: a ? t[a] ?? [] : [],
		onSidenavContextActionsChange: n
	};
}, fi = (e) => {
	let t = y(e, "status"), n = S(e.statusBar.store, (e) => e.items), r = re(e);
	S(e.context.store, (e) => e.values);
	let i = S(e.modes.store, (e) => e.activeModeId);
	return {
		hasNavWidgets: L(e, "nav"),
		hasActivityBarWidgets: L(e, "activity"),
		hasSidenavWidgets: L(e, "sidenav"),
		hasSecondaryHeaderWidgets: L(e, "secondary-header"),
		hasSecondaryWidgets: L(e, "secondary", { locationScoped: !0 }),
		hasSecondaryMenus: ye(e, "secondary"),
		hasSideHeaderWidgets: L(e, "side-header"),
		hasSideWidgets: L(e, "side", { locationScoped: !0 }),
		hasSideMenus: ye(e, "side"),
		hasStatusWidgets: r || (t === void 0 ? i === e.modes.getActiveModeId() && Object.keys(n).length > 0 && e.statusBar.listVisibleItems().length > 0 : t !== !1)
	};
}, pi = (e) => {
	let t = S(e.layout.store, (e) => e.layout.arrangement);
	return p(t);
}, mi = (e) => {
	let { workbench: t, activityVisible: n, children: r } = e, { activity: i } = pi(t);
	return /* @__PURE__ */ J(Zr, {
		workbench: t,
		region: "activity",
		children: /* @__PURE__ */ Y(H, {
			position: "relative",
			h: "full",
			w: "full",
			minH: "0",
			minW: "0",
			direction: {
				left: "row",
				right: "row-reverse",
				top: "column",
				bottom: "column-reverse"
			}[i],
			children: [/* @__PURE__ */ J(fe, {
				workbench: t,
				visible: n
			}), /* @__PURE__ */ J(H, {
				flex: "1",
				minH: "0",
				minW: "0",
				overflow: "hidden",
				position: "relative",
				children: r
			})]
		})
	});
}, hi = (e, t) => S(e.modes.store, Se(() => e.layout.getRegionSettings(t))), gi = (e) => {
	let { workbench: t, region: n } = e;
	return t.layout.getRegionHeaderBorderBottom(n) ? /* @__PURE__ */ J(V, {
		position: "absolute",
		insetInline: "0",
		bottom: "0",
		h: "1px",
		bg: "border.subtle",
		pointerEvents: "none",
		zIndex: "0"
	}) : null;
}, _i = (e) => {
	let t = F(e, "secondary"), n = L(e, "secondary", { locationScoped: !0 }), r = ve(e, "secondary"), i = ye(e, "secondary"), a = L(e, "secondary-header"), o = S(e.layout.store, () => xe(e, "secondary-header", "secondary")), s = S(e.layout.store, (e) => e.layout.regions.secondary.visible);
	return {
		has: t.provided && !t.canClose || n || a || r || i,
		hasHeader: a,
		collapsible: o,
		collapsed: !s,
		onCollapsedChange: (t) => {
			(!t || o) && e.shell.setRegionOpen("secondary", !t);
		}
	};
}, vi = (e) => ({
	hasMainHeader: L(e, "main-header"),
	secondaryPanel: _i(e)
}), yi = (e) => {
	let { workbench: t, hasSecondaryHeader: n } = e, r = F(t, "secondary");
	return /* @__PURE__ */ Y(M, {
		workbench: t,
		region: "secondary",
		"data-workbench-panel": "secondary",
		"data-workbench-region": "secondary",
		as: "section",
		bg: j.panel,
		layerStyle: "panel",
		flex: "1",
		h: "full",
		minH: "0",
		minW: "0",
		overflow: "hidden",
		display: "flex",
		flexDirection: "column",
		w: "full",
		position: "relative",
		children: [
			/* @__PURE__ */ Y(Lr, {
				workbench: t,
				region: "secondary",
				"data-workbench-panel-header": "secondary",
				variant: "main",
				bg: j.panel,
				position: "relative",
				flexShrink: 0,
				gap: "xs",
				overflow: "hidden",
				overflowY: "hidden",
				children: [
					/* @__PURE__ */ J(mr, {
						workbench: t,
						region: "secondary"
					}),
					/* @__PURE__ */ J(V, {
						display: n ? "block" : "none",
						flex: "1",
						h: "full",
						minW: "0",
						overflow: "hidden",
						children: /* @__PURE__ */ J(P, {
							workbench: t,
							region: "secondary-header",
							title: "Secondary Panel header"
						})
					}),
					/* @__PURE__ */ J(Ir, {
						workbench: t,
						panel: "secondary"
					}),
					/* @__PURE__ */ J(gi, {
						workbench: t,
						region: "secondary-header"
					})
				]
			}),
			/* @__PURE__ */ J(ir, {
				region: "secondary",
				visible: r.open
			}),
			/* @__PURE__ */ J(V, {
				flex: "1",
				minH: "0",
				minW: "0",
				overflow: "hidden",
				children: /* @__PURE__ */ J(Pr, {
					workbench: t,
					panel: "secondary",
					children: /* @__PURE__ */ J(P, {
						workbench: t,
						region: "secondary",
						title: "Secondary Panel"
					})
				})
			})
		]
	});
}, bi = {
	defaultPx: 240,
	minPx: 128,
	maxPx: 420
}, xi = 240, Si = m("main"), Ci = (e, t, n) => ({
	defaultPx: t ?? e?.defaultPx ?? n.defaultPx,
	minPx: e?.minPx ?? n.minPx,
	maxPx: e ? e.maxPx : n.maxPx
}), wi = (e) => {
	let { workbench: t, hasMainHeader: n } = e, r = me(t, "main");
	return /* @__PURE__ */ Y(Lr, {
		workbench: t,
		region: "main",
		"data-workbench-panel-header": "main",
		variant: "main",
		bg: j.main,
		position: "relative",
		flexShrink: 0,
		gap: "xs",
		overflow: "hidden",
		overflowY: "hidden",
		children: [
			/* @__PURE__ */ J(mr, {
				workbench: t,
				region: "main"
			}),
			/* @__PURE__ */ J(V, {
				flex: n || !r ? "1" : "0",
				h: "full",
				minW: "0",
				overflow: "hidden",
				children: /* @__PURE__ */ J(P, {
					workbench: t,
					region: "main-header",
					title: "Main header"
				})
			}),
			/* @__PURE__ */ J(Ht, {
				workbench: t,
				menuPath: Si,
				controlSize: K
			}),
			/* @__PURE__ */ J(Ir, {
				workbench: t,
				panel: "main"
			}),
			/* @__PURE__ */ J(gi, {
				workbench: t,
				region: "main-header"
			})
		]
	});
}, Ti = (e) => {
	let { workbench: t } = e, n = S(t.layout.store, () => t.shell.getArrangement().secondary), r = F(t, "secondary"), i = S(t.fullscreen.store, (e) => e.active), a = S(t.pages.store, (e) => e.activePageId), o = hi(t, "secondary"), s = vi(t), c = L(t, "main", { locationScoped: !0 }), l = F(t, "main"), { hasMainHeader: u, secondaryPanel: d } = s, f = S(t.layout.store, (e) => e.layout.regions.secondary.size), p = Ci(o?.size ?? t.layout.getRegionSize("secondary"), f, bi), m = /* @__PURE__ */ J(M, {
		workbench: t,
		region: "main",
		"data-workbench-region": "main",
		bg: j.main,
		flex: "1",
		h: "full",
		minH: "0",
		minW: "0",
		w: "full",
		overflow: "hidden",
		children: /* @__PURE__ */ J(P, {
			workbench: t,
			region: "main",
			title: "Main"
		})
	}), h = /* @__PURE__ */ J(Pr, {
		workbench: t,
		panel: "main",
		children: m
	}), g = /* @__PURE__ */ Y(at, {
		"data-workbench-panel": "main",
		"data-workbench-page": a,
		gridTemplateRows: "auto minmax(0, 1fr)",
		h: "full",
		minH: "0",
		minW: "0",
		w: "full",
		bg: j.main,
		layerStyle: c || u || l.showHeader ? "panel" : void 0,
		position: "relative",
		children: [
			/* @__PURE__ */ J(V, {
				display: i ? "none" : "contents",
				children: /* @__PURE__ */ J(wi, {
					workbench: t,
					hasMainHeader: u
				})
			}),
			/* @__PURE__ */ J(ir, { region: "main" }),
			/* @__PURE__ */ J(V, {
				gridRow: "2",
				h: "full",
				minH: "0",
				minW: "0",
				overflow: "hidden",
				children: h
			})
		]
	});
	return /* @__PURE__ */ J(Zr, {
		workbench: t,
		region: "secondary",
		children: /* @__PURE__ */ J(bt, {
			as: "main",
			minH: "0",
			minW: "0",
			resizableSide: n,
			contentPanel: g,
			resizablePanel: /* @__PURE__ */ J(yi, {
				workbench: t,
				hasSecondaryHeader: d.hasHeader
			}),
			collapsed: i || !d.has || d.collapsed,
			resizable: r.resizable,
			collapsible: r.canClose && d.collapsible,
			defaultSizePx: p.defaultPx,
			minSizePx: p.minPx,
			maxSizePx: p.maxPx,
			contentMinSizePx: xi,
			resizeLabel: "Resize Secondary Panel",
			onSizeChange: (e) => t.shell.setRegionSize("secondary", e),
			onCollapsedChange: d.onCollapsedChange
		})
	});
}, Ei = 420, Di = 320, Oi = (e) => {
	let { workbench: t, sidePanelHost: n } = e;
	return n ? Nt(/* @__PURE__ */ J(P, {
		workbench: t,
		region: "side",
		title: "Side Panel",
		transparent: !0
	}), n) : null;
}, ki = (e) => {
	let { workbench: t, hasSideHeader: n } = e;
	return /* @__PURE__ */ Y(V, {
		alignItems: "center",
		display: "flex",
		flex: "1",
		h: "full",
		minW: "0",
		overflow: "hidden",
		w: "full",
		children: [/* @__PURE__ */ J(mr, {
			workbench: t,
			region: "side"
		}), n ? /* @__PURE__ */ J(V, {
			flex: "1",
			h: "full",
			minW: "0",
			overflow: "hidden",
			children: /* @__PURE__ */ J(P, {
				workbench: t,
				region: "side-header",
				title: "Side Panel header",
				transparent: !0
			})
		}) : null]
	});
}, Ai = (e) => {
	let { workbench: t, attached: n, contentPanel: r, contentMinSizePx: i, header: a, onAttachedSlotChange: o, onCollapse: s } = e, c = S(t.layout.store, () => t.shell.getArrangement().side), l = F(t, "side"), u = S(t.layout.store, (e) => e.layout.regions.side.size), d = hi(t, "side"), f = d?.size ?? t.layout.getRegionSize("side"), p = d?.collapsible ?? t.layout.getRegionCollapsible("side");
	return /* @__PURE__ */ J(Zr, {
		workbench: t,
		region: "side",
		children: /* @__PURE__ */ J(bt, {
			h: "full",
			minH: "0",
			minW: "0",
			w: "full",
			resizableSide: c,
			contentPanel: r,
			resizablePanel: /* @__PURE__ */ J(Hr, {
				workbench: t,
				contentSlotRef: o,
				header: a
			}),
			collapsed: !n,
			defaultSizePx: u ?? f?.defaultPx ?? Ei,
			minSizePx: f?.minPx ?? Di,
			maxSizePx: f?.maxPx,
			resizable: l.resizable,
			collapsible: l.canClose && p,
			onSizeChange: (e) => t.shell.setRegionSize("side", e),
			contentMinSizePx: i,
			resizeLabel: "Resize Side Panel",
			onCollapsedChange: (e) => {
				n && e && s();
			}
		})
	});
}, ji = "a[href],button,input,select,textarea,iframe,[contenteditable='true'],[role='button'],[role='checkbox'],[role='menuitem'],[role='option'],[role='radio'],[role='switch'],[tabindex]:not([tabindex='-1'])", Mi = (e) => typeof e?.closest == "function", Ni = (e, t) => e === t ? !0 : Mi(e) ? !e.closest(ji) : !1, Pi = (e) => {
	e?.focus({ preventScroll: !0 });
}, Fi = (e) => {
	let { children: t } = e, n = z(null);
	return et(() => {
		Pi(n.current);
	}, []), /* @__PURE__ */ J(H, {
		ref: n,
		h: "full",
		minH: "0",
		minW: "0",
		w: "full",
		tabIndex: -1,
		outline: "none",
		onPointerDown: (e) => {
			Ni(e.target, e.currentTarget) && Pi(e.currentTarget);
		},
		children: t
	});
}, Ii = (e) => {
	let { workbench: t, showAttachedSidePanel: n, contentFrame: r, sideHeader: i, contentMinSizePx: a, onAttachedSlotChange: o } = e;
	return /* @__PURE__ */ J(Fi, { children: /* @__PURE__ */ J(Ai, {
		workbench: t,
		attached: n,
		contentPanel: r,
		contentMinSizePx: a,
		header: i,
		onAttachedSlotChange: o,
		onCollapse: () => t.shell.setRegionOpen("side", !1)
	}) });
}, Li = 250, Ri = 200, zi = 320, Bi = (e, t) => {
	let n = e.layout.getRegionSize("sidenav");
	return {
		defaultPx: t ?? n?.defaultPx ?? Li,
		minPx: n?.minPx ?? Ri,
		maxPx: n?.maxPx
	};
}, Vi = () => {
	if (typeof document > "u") return null;
	let e = document.createElement("div");
	return e.style.display = "contents", e.dataset.workbenchSidePanelHost = "", e;
}, Hi = (e) => {
	let { workbench: t, renderParamField: n, sidePanelBubbleIcon: r, onOpenSidePanel: i, titleBar: a, panelControlsPlacement: o } = e, s = pi(t), { contextActions: c, onSidenavContextActionsChange: l } = di(t);
	ci(t, {
		renderParamField: n,
		onSidenavContextActionsChange: l
	}), ai(t, { renderParamField: n }), ti(t, { renderParamField: n }), ri(t), $r(t, { renderParamField: n });
	let [u, d] = B(null), [f, p] = B(null), m = z(null);
	m.current ||= Vi();
	let h = S(t.commandPalette.store, (e) => e.open), g = S(t.commandPalette.store, (e) => e.initialQuery), _ = S(t.layout.store, (e) => e.layout.regions.sidenav.visible), v = ve(t, "side"), y = S(t.layout.store, () => t.sidePanel.getMode()), x = S(t.fullscreen.store, (e) => e), C = y;
	x.active && (C = x.sideOpen ? "floating" : "closed");
	let { hasActivityBarWidgets: w, hasNavWidgets: T, hasSideHeaderWidgets: E, hasSideWidgets: D, hasSideMenus: O, hasSidenavWidgets: k, hasStatusWidgets: ee } = fi(t), A = !x.active && w, te = !x.active && ee, ne = F(t, "side"), M = F(t, "sidenav"), N = ne.provided && !ne.canClose || E || D || v || O, re = k, P = xe(t, "sidenav"), ae = Bi(t, S(t.layout.store, (e) => e.layout.regions.sidenav.size)), oe = N && C === "attached", se = t.shell.setRegionOpen, ce = E || v ? /* @__PURE__ */ J(ki, {
		workbench: t,
		hasSideHeader: E
	}) : void 0, ue = u;
	C === "floating" ? ue = f : C === "closed" && (ue = m.current?.parentElement ?? u), et(() => {
		let e = m.current;
		e && ie(e, ue);
	}, [ue]);
	let de = /* @__PURE__ */ Y(H, {
		direction: "column",
		h: "full",
		minH: "0",
		minW: "0",
		w: "full",
		children: [/* @__PURE__ */ J(Jr, {
			workbench: t,
			hasNav: T,
			panelControls: o !== "host"
		}), /* @__PURE__ */ J(H, {
			flex: "1",
			minH: "0",
			minW: "0",
			overflow: "hidden",
			children: /* @__PURE__ */ J(Ti, { workbench: t })
		})]
	}), fe = /* @__PURE__ */ J(Zr, {
		workbench: t,
		region: "sidenav",
		children: /* @__PURE__ */ J(bt, {
			flex: "1",
			minH: "0",
			minW: "0",
			resizablePanel: /* @__PURE__ */ J(he, {
				workbench: t,
				contextActions: c
			}),
			resizableSide: s.sidenav,
			contentPanel: /* @__PURE__ */ J(Ii, {
				workbench: t,
				showAttachedSidePanel: oe,
				contentFrame: de,
				sideHeader: ce,
				contentMinSizePx: zi,
				onAttachedSlotChange: d
			}),
			collapsed: x.active || !re || !_,
			resizable: M.resizable,
			collapsible: M.canClose && P,
			defaultSizePx: ae.defaultPx,
			minSizePx: ae.minPx,
			maxSizePx: ae.maxPx,
			contentMinSizePx: zi,
			resizeLabel: "Resize sidenav",
			onSizeChange: (e) => t.shell.setRegionSize("sidenav", e),
			onCollapsedChange: (e) => {
				(!e || P) && se("sidenav", !e);
			}
		})
	}), pe = /* @__PURE__ */ Y(H, {
		position: "relative",
		h: "full",
		minH: "0",
		minW: "0",
		w: "full",
		bg: j.main,
		color: "fg",
		children: [/* @__PURE__ */ J(mi, {
			workbench: t,
			activityVisible: A,
			children: fe
		}), /* @__PURE__ */ J(Ke, { workbench: t })]
	});
	return /* @__PURE__ */ Y(Gr, {
		h: "full",
		minH: "0",
		minW: "0",
		w: "full",
		children: [/* @__PURE__ */ Y(H, {
			direction: "column",
			h: "full",
			minH: "0",
			minW: "0",
			position: "relative",
			w: "full",
			children: [
				/* @__PURE__ */ J(H, {
					display: x.active ? "none" : "contents",
					children: a
				}),
				/* @__PURE__ */ J(H, {
					flex: "1",
					minH: "0",
					minW: "0",
					overflow: "hidden",
					pt: "panel-gap",
					pb: te ? "0" : "panel-gap",
					pr: "panel-gap",
					pl: A ? "0" : "panel-gap",
					children: pe
				}),
				/* @__PURE__ */ J(le, {
					workbench: t,
					visible: te
				}),
				/* @__PURE__ */ J(Ur, {
					workbench: t,
					available: N,
					bubbleIcon: r,
					onOpen: i,
					contentSlotRef: p,
					bottomOffset: te ? _e : void 0,
					header: ce
				}),
				/* @__PURE__ */ J(b, {
					workbench: t,
					open: h,
					initialQuery: g,
					renderParamField: n,
					onClose: () => t.commandPalette.close()
				}),
				/* @__PURE__ */ J(qn, { workbench: t }),
				/* @__PURE__ */ J(We, { workbench: t }),
				/* @__PURE__ */ J(Yn, { workbench: t })
			]
		}), /* @__PURE__ */ J(Oi, {
			workbench: t,
			sidePanelHost: m.current
		})]
	});
}, Ui = (e) => {
	let t = Wr(e.workbench), n = S(e.workbench.modes.store, (e) => e.activeModeId ? e.modes[e.activeModeId] : void 0), r = li(e.workbench);
	return /* @__PURE__ */ Y(He, {
		themePreferences: t,
		fileIconThemePreferences: r,
		defaultThemePreference: n?.defaultTheme,
		preferenceScope: n?.defaultTheme ? n.id : void 0,
		themeStorage: e.themeStorage,
		children: [/* @__PURE__ */ J(rr, {
			workbench: e.workbench,
			children: /* @__PURE__ */ J(ue, {
				workbench: e.workbench,
				children: /* @__PURE__ */ J(Hi, { ...e })
			})
		}), /* @__PURE__ */ J(wt, {})]
	});
};
export { Yn as i, Wr as n, gr as r, Ui as t };
