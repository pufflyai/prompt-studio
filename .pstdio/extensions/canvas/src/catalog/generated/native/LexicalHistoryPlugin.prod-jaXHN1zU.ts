// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { $ as e, A as t, C as n, Gn as r, Gt as i, Jt as a, Lt as o, Rn as s, Sn as c, Tn as l, Wt as u, Xn as d, Y as f, dt as p, en as m, gt as h, in as g, it as _, j as v, jn as y, jt as b, nn as x, st as S, tn as C, tt as w, w as T } from "./rich-text-theme-C7PhYVHR.ts";
import { t as E } from "./LexicalComposerContext.prod-C-LZ0eF8.ts";
import D, { useCallback as O, useEffect as k, useLayoutEffect as A, useMemo as j, useRef as M, useState as N } from "react";
import { jsx as P } from "react/jsx-runtime";
// node_modules/.bun/@lexical+react@0.40.0+60fa178158e73238/node_modules/@lexical/react/LexicalTypeaheadMenuPlugin.prod.mjs
var F = "startTransition", I = typeof window < "u" && window.document !== void 0 && window.document.createElement !== void 0, L = I ? A : k, R = class {
	key;
	ref;
	constructor(e) {
		this.key = e, this.ref = { current: null }, this.setRefElement = this.setRefElement.bind(this);
	}
	setRefElement(e) {
		this.ref = { current: e };
	}
}, z = (e) => {
	let t = document.getElementById("typeahead-menu");
	if (!t) return;
	let n = t.getBoundingClientRect();
	n.top + n.height > window.innerHeight && t.scrollIntoView({ block: "center" }), n.top < 0 && t.scrollIntoView({ block: "center" }), e.scrollIntoView({ block: "nearest" });
};
function B(e, t) {
	let n = e.getBoundingClientRect(), r = t.getBoundingClientRect();
	return n.top >= r.top - 6 && n.top <= r.bottom + 6;
}
function V(e, t, n, r) {
	let [i] = E();
	k(() => {
		if (t != null && e != null) {
			let e = i.getRootElement(), a = e == null ? document.body : function(e) {
				let t = getComputedStyle(e), n = t.position === "absolute", r = /(auto|scroll)/;
				if (t.position === "fixed") return document.body;
				for (let i = e; i = i.parentElement;) if (t = getComputedStyle(i), (!n || t.position !== "static") && r.test(t.overflow + t.overflowY + t.overflowX)) return i;
				return document.body;
			}(e), o = !1, s = B(t, a), c = function() {
				o ||= (window.requestAnimationFrame(function() {
					n(), o = !1;
				}), !0);
				let e = B(t, a);
				e !== s && (s = e, r?.(e));
			}, l = new ResizeObserver(n);
			return window.addEventListener("resize", n), document.addEventListener("scroll", c, {
				capture: !0,
				passive: !0
			}), l.observe(t), () => {
				l.unobserve(t), window.removeEventListener("resize", n), document.removeEventListener("scroll", c, !0);
			};
		}
	}, [
		t,
		i,
		r,
		n,
		e
	]);
}
var H = y("SCROLL_TYPEAHEAD_OPTION_INTO_VIEW_COMMAND");
function U({ close: t, editor: n, anchorElementRef: i, resolution: a, options: s, menuRenderFn: l, onSelectOption: u, shouldSplitNodeWithQuery: d = !1, commandPriority: f = 1, preselectFirstItem: m = !0 }) {
	let [h, _] = N(null), v = h === null ? null : Math.min(s.length - 1, h), y = a.match && a.match.matchingString;
	k(() => {
		m && _(0);
	}, [y, m]);
	let x = O((e) => {
		n.update(() => {
			u(e, a.match != null && d ? function(e) {
				let t = c();
				if (!b(t) || !t.isCollapsed()) return null;
				let n = t.anchor;
				if (n.type !== "text") return null;
				let r = n.getNode();
				if (!r.isSimpleText()) return null;
				let i = n.offset, a = r.getTextContent().slice(0, i), o = e.replaceableString.length, s = i - function(e, t, n) {
					let r = n;
					for (let n = r; n <= t.length; n++) e.slice(-n) === t.substring(0, n) && (r = n);
					return r;
				}(a, e.matchingString, o);
				if (s < 0) return null;
				let l;
				return s === 0 ? [l] = r.splitText(i) : [, l] = r.splitText(s, i), l;
			}(a.match) : null, t, a.match ? a.match.matchingString : "");
		});
	}, [
		n,
		d,
		a.match,
		u,
		t
	]), C = O((e) => {
		let t = n.getRootElement();
		t !== null && (t.setAttribute("aria-activedescendant", "typeahead-item-" + e), _(e));
	}, [n]);
	return k(() => () => {
		let e = n.getRootElement();
		e !== null && e.removeAttribute("aria-activedescendant");
	}, [n]), L(() => {
		s === null ? _(null) : v === null && m && C(0);
	}, [
		s,
		v,
		C,
		m
	]), k(() => o(n.registerCommand(H, ({ option: e }) => !(!e.ref || e.ref.current == null) && (z(e.ref.current), !0), f)), [
		n,
		C,
		f
	]), k(() => o(n.registerCommand(r, (e) => {
		let t = e;
		if (s !== null && s.length) {
			let e = v === null || v === s.length - 1 ? 0 : v + 1;
			C(e);
			let r = s[e];
			if (!r) return C(-1), t.preventDefault(), t.stopImmediatePropagation(), !0;
			r.ref && r.ref.current && n.dispatchCommand(H, {
				index: e,
				option: r
			}), t.preventDefault(), t.stopImmediatePropagation();
		}
		return !0;
	}, f), n.registerCommand(g, (e) => {
		let t = e;
		if (s !== null && s.length) {
			let e = v === null || v === 0 ? s.length - 1 : v - 1;
			C(e);
			let n = s[e];
			if (!n) return C(-1), t.preventDefault(), t.stopImmediatePropagation(), !0;
			n.ref && n.ref.current && z(n.ref.current), t.preventDefault(), t.stopImmediatePropagation();
		}
		return !0;
	}, f), n.registerCommand(e, (e) => {
		let n = e;
		return n.preventDefault(), n.stopImmediatePropagation(), t(), !0;
	}, f), n.registerCommand(S, (e) => {
		let t = e;
		return s !== null && v !== null && s[v] != null && (t.preventDefault(), t.stopImmediatePropagation(), x(s[v]), !0);
	}, f), n.registerCommand(p, (e) => s !== null && v !== null && s[v] != null && (e !== null && (e.preventDefault(), e.stopImmediatePropagation()), x(s[v]), !0), f)), [
		x,
		t,
		n,
		s,
		v,
		C,
		f
	]), l(i, j(() => ({
		options: s,
		selectOptionAndCleanUp: x,
		selectedIndex: v,
		setHighlightedIndex: _
	}), [
		x,
		v,
		s
	]), a.match ? a.match.matchingString : "");
}
function W(e, t) {
	t != null && (e.className = t), e.setAttribute("aria-label", "Typeahead menu"), e.setAttribute("role", "listbox"), e.style.display = "block", e.style.position = "absolute";
}
y("SCROLL_TYPEAHEAD_OPTION_INTO_VIEW_COMMAND");
function G({ options: e, onQueryChange: t, onSelectOption: n, onOpen: r, onClose: i, menuRenderFn: a, triggerFn: o, anchorClassName: s, commandPriority: u = 1, parent: d, preselectFirstItem: f = !0, ignoreEntityBoundary: p = !1 }) {
	let [m] = E(), [h, g] = N(null), _ = function(e, t, n, r = I ? document.body : void 0, i = !0) {
		let [a] = E(), o = I ? document.createElement("div") : null, s = M(o), c = O(() => {
			if (s.current === null || r === void 0) return;
			s.current.style.top = s.current.style.bottom;
			let t = a.getRootElement(), o = s.current, c = o.firstChild;
			if (t !== null && e !== null) {
				let { left: a, top: l, width: u, height: d } = e.getRect(), f = s.current.offsetHeight;
				if (o.style.top = `${l + f + 3 + (i ? window.pageYOffset : 0)}px`, o.style.left = `${a + window.pageXOffset}px`, o.style.height = `${d}px`, o.style.width = `${u}px`, c !== null) {
					c.style.top = `${l}`;
					let e = c.getBoundingClientRect(), n = e.height, r = e.width, s = t.getBoundingClientRect();
					a + r > s.right && (o.style.left = `${s.right - r + window.pageXOffset}px`), (l + n > window.innerHeight || l + n > s.bottom) && l - s.top > n + d && (o.style.top = `${l - n - d + (i ? window.pageYOffset : 0)}px`);
				}
				o.isConnected || (W(o, n), r.append(o)), o.setAttribute("id", "typeahead-menu"), t.setAttribute("aria-controls", "typeahead-menu");
			}
		}, [
			a,
			e,
			i,
			n,
			r
		]);
		k(() => {
			let t = a.getRootElement();
			return e !== null && c(), () => {
				t !== null && t.removeAttribute("aria-controls");
				let e = s.current;
				e !== null && e.isConnected && (e.remove(), e.removeAttribute("id"));
			};
		}, [
			a,
			c,
			e
		]);
		let l = O((n) => {
			e !== null && (n || t(null));
		}, [e, t]);
		return V(e, s.current, c, l), o != null && o === s.current && (W(o, n), r?.append(o)), s;
	}(h, g, s, d), v = O(() => {
		g(null), i != null && h !== null && i();
	}, [i, h]), y = O((e) => {
		g(e), r != null && h === null && r(e);
	}, [r, h]);
	return k(() => {
		let e = m.registerUpdateListener(() => {
			m.getEditorState().read(() => {
				if (!m.isEditable()) return void v();
				if (m.isComposing()) return;
				let e = m._window || window, n = e.document.createRange(), r = c(), i = function(e) {
					let t = null;
					return e.getEditorState().read(() => {
						let e = c();
						b(e) && (t = function(e) {
							let t = e.anchor;
							if (t.type !== "text") return null;
							let n = t.getNode();
							if (!n.isSimpleText()) return null;
							let r = t.offset;
							return n.getTextContent().slice(0, r);
						}(e));
					}), t;
				}(m);
				if (!b(r) || !r.isCollapsed() || i === null || n === null) return void v();
				let a = o(i, m);
				if (t(a ? a.matchingString : null), a !== null && (p || !function(e, t) {
					return t === 0 && e.getEditorState().read(() => {
						let e = c();
						if (b(e)) {
							let t = e.anchor.getNode().getPreviousSibling();
							return x(t) && t.isTextEntity();
						}
						return !1;
					});
				}(m, a.leadOffset)) && function(e, t, n) {
					let r = l(n);
					if (r === null || !r.isCollapsed) return !1;
					let i = r.anchorNode, a = e, o = r.anchorOffset;
					if (i == null || o == null) return !1;
					try {
						t.setStart(i, a), t.setEnd(i, o);
					} catch {
						return !1;
					}
					return !0;
				}(a.leadOffset, n, e) !== null) return s = () => y({
					getRect: () => n.getBoundingClientRect(),
					match: a
				}), void (F in D ? D[F](s) : s());
				var s;
				v();
			});
		});
		return () => {
			e();
		};
	}, [
		m,
		o,
		t,
		h,
		v,
		y,
		p
	]), k(() => m.registerEditableListener((e) => {
		e || v();
	}), [m, v]), h === null || m === null || _.current === null ? null : P(U, {
		close: v,
		resolution: h,
		editor: m,
		anchorElementRef: _,
		options: e,
		menuRenderFn: a,
		shouldSplitNodeWithQuery: !0,
		onSelectOption: n,
		commandPriority: u,
		preselectFirstItem: f
	});
}
// node_modules/.bun/@lexical+history@0.40.0/node_modules/@lexical/history/LexicalHistory.prod.mjs
function K(e, t, n, r, i) {
	if (e === null || n.size === 0 && r.size === 0 && !i) return 0;
	let a = t._selection, o = e._selection;
	if (i) return 1;
	if (!(b(a) && b(o) && o.isCollapsed() && a.isCollapsed())) return 0;
	let s = function(e, t, n) {
		let r = e._nodeMap, i = [];
		for (let e of t) {
			let t = r.get(e);
			t !== void 0 && i.push(t);
		}
		for (let [e, t] of n) {
			if (!t) continue;
			let n = r.get(e);
			n === void 0 || h(n) || i.push(n);
		}
		return i;
	}(t, n, r);
	if (s.length === 0) return 0;
	if (s.length > 1) {
		let n = t._nodeMap, r = n.get(a.anchor.key), i = n.get(o.anchor.key);
		return r && i && !e._nodeMap.has(r.__key) && x(r) && r.__text.length === 1 && a.anchor.offset === 1 ? 2 : 0;
	}
	let c = s[0], l = e._nodeMap.get(c.__key);
	if (!x(l) || !x(c) || l.__mode !== c.__mode) return 0;
	let u = l.__text, d = c.__text;
	if (u === d) return 0;
	let f = a.anchor, p = o.anchor;
	if (f.key !== p.key || f.type !== "text") return 0;
	let m = f.offset, g = p.offset, _ = d.length - u.length;
	return _ === 1 && g === m - 1 ? 2 : _ === -1 && g === m + 1 ? 3 : _ === -1 && g === m ? 4 : 0;
}
function q(e, t) {
	let n = Date.now(), r = 0;
	return (i, a, o, s, c, l) => {
		let u = Date.now();
		if (l.has("historic")) return r = 0, n = u, 2;
		let d = K(i, a, s, c, e.isComposing()), f = (() => {
			let f = o === null || o.editor === e, p = l.has(w);
			if (!p && f && l.has("history-merge")) return 0;
			if (i === null) return 1;
			let m = a._selection;
			if (!(s.size > 0 || c.size > 0)) return m === null ? 2 : 0;
			let h = typeof t == "number" ? t : t.peek();
			return !1 === p && d !== 0 && d === r && u < n + h && f || s.size === 1 && function(e, t, n) {
				let r = t._nodeMap.get(e), i = n._nodeMap.get(e), a = t._selection, o = n._selection;
				return !(b(a) && b(o) && a.anchor.type === "element" && a.focus.type === "element" && o.anchor.type === "text" && o.focus.type === "text" || !x(r) || !x(i) || r.__parent !== i.__parent) && JSON.stringify(t.read(() => r.exportJSON())) === JSON.stringify(n.read(() => i.exportJSON()));
			}(Array.from(s)[0], i, a) ? 0 : 1;
		})();
		return n = u, r = d, f;
	};
}
function J(e) {
	e.undoStack = [], e.redoStack = [], e.current = null;
}
function Y(e, t, n) {
	let r = q(e, n);
	return o(e.registerCommand(d, () => (function(e, t) {
		let n = t.redoStack, r = t.undoStack;
		if (r.length !== 0) {
			let i = t.current, a = r.pop();
			i !== null && (n.push(i), e.dispatchCommand(m, !0)), r.length === 0 && e.dispatchCommand(s, !1), t.current = a || null, a && a.editor.setEditorState(a.editorState, { tag: "historic" });
		}
	}(e, t), !0), 0), e.registerCommand(_, () => (function(e, t) {
		let n = t.redoStack, r = t.undoStack;
		if (n.length !== 0) {
			let i = t.current;
			i !== null && (r.push(i), e.dispatchCommand(s, !0));
			let a = n.pop();
			n.length === 0 && e.dispatchCommand(m, !1), t.current = a || null, a && a.editor.setEditorState(a.editorState, { tag: "historic" });
		}
	}(e, t), !0), 0), e.registerCommand(u, () => (J(t), !1), 0), e.registerCommand(a, () => (J(t), e.dispatchCommand(m, !1), e.dispatchCommand(s, !1), !0), 0), e.registerUpdateListener(({ editorState: n, prevEditorState: i, dirtyLeaves: a, dirtyElements: o, tags: c }) => {
		let l = t.current, u = t.redoStack, d = t.undoStack, f = l === null ? null : l.editorState;
		if (l !== null && n === f) return;
		let p = r(i, n, l, a, o, c);
		if (p === 1) u.length !== 0 && (t.redoStack = [], e.dispatchCommand(m, !1)), l !== null && (d.push({ ...l }), e.dispatchCommand(s, !0));
		else if (p === 2) return;
		t.current = {
			editor: e,
			editorState: n
		};
	}));
}
function X() {
	return {
		current: null,
		redoStack: [],
		undoStack: []
	};
}
var Z = f({
	build: (e, { delay: t, createInitialHistoryState: n, disabled: r }) => v({
		delay: t,
		disabled: r,
		historyState: n(e)
	}),
	config: C({
		createInitialHistoryState: X,
		delay: 300,
		disabled: typeof window > "u"
	}),
	name: "@lexical/history/History",
	register: (e, n, r) => {
		let i = r.getOutput();
		return t(() => i.disabled.value ? void 0 : Y(e, i.historyState.value, i.delay));
	}
});
f({
	dependencies: [i(Z, {
		createInitialHistoryState: () => {
			throw Error("SharedHistory did not inherit parent history");
		},
		disabled: !0
	})],
	name: "@lexical/history/SharedHistory",
	register(e, r, i) {
		let { output: a } = i.getDependency(Z), o = function(e) {
			return e ? T(e, Z.name) : null;
		}(e._parentEditor);
		if (!o) return () => {};
		let s = o.output;
		return t(() => n(() => {
			a.delay.value = s.delay.value, a.historyState.value = s.historyState.value, a.disabled.value = s.disabled.value;
		}));
	}
});
// node_modules/.bun/@lexical+react@0.40.0+60fa178158e73238/node_modules/@lexical/react/LexicalHistoryPlugin.prod.mjs
function Q({ delay: e, externalHistoryState: t }) {
	let [n] = E();
	return function(e, t, n = 1e3) {
		let r = j(() => t || X(), [t]);
		k(() => Y(e, r, n), [
			n,
			e,
			r
		]);
	}(n, t, e), null;
}
export { G as n, R as r, Q as t };
