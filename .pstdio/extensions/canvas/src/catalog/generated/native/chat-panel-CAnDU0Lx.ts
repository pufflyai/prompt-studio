// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./arrow-down-xxNhKH5c.ts";
import { t } from "./arrow-up-DUoQ-jFn.ts";
import { t as n } from "./check-Bgh538vW.ts";
import { t as r } from "./copy-COTDVt4R.ts";
import { t as i } from "./grip-vertical-C8TSneyx.ts";
import { t as a } from "./message-circle-DP0BFDQF.ts";
import { t as o } from "./trash-2-C03vrbuo.ts";
import { b as s, h as c, i as l, m as u, s as d, t as f, v as p, x as m, y as h } from "./core.esm-cje5eyjm.ts";
import { t as g } from "./scroll-area-I7hjn89T.ts";
import { t as _ } from "./tooltip-BweQW627.ts";
import { t as v } from "./ai-message-3J9aywD3.ts";
import { t as y } from "./empty-state-C7gtd4pd.ts";
import { at as b, ct as x } from "./list-marker-width-plugin-q77pywDH.ts";
import { r as S } from "./chat-link-anchor-kdoOkLgc.ts";
import { o as C } from "./question-prompt-DIqKf96x.ts";
import { i as w, n as T, r as E, t as D } from "./chat-input-D_XW8kA_.ts";
import { n as ee, t as O } from "./use-virtualizer-DJbWYnTZ.ts";
import { t as k } from "./drop-indicator-Bqz21pYA.ts";
import { n as A, t as j } from "./chat-question-navigation-DvO6NA0-.ts";
import { a as M, n as N, o as P, r as F, t as I } from "./message-types-D5cSq-0y.ts";
import { t as L } from "./queued-follow-up-D4i5QouN.ts";
import * as R from "react";
import { Fragment as te, createContext as z, useCallback as B, useContext as ne, useEffect as V, useImperativeHandle as re, useLayoutEffect as H, useMemo as ie, useRef as U, useState as W } from "react";
import { AbsoluteCenter as ae, Box as G, Button as oe, Flex as se, HStack as ce, IconButton as K, Spinner as le, Stack as ue, Text as q, chakra as de, useSlotRecipe as J } from "@chakra-ui/react";
import { Fragment as fe, jsx as Y, jsxs as X } from "react/jsx-runtime";
// node_modules/.bun/use-stick-to-bottom@1.1.3+b1ab299f0a400331/node_modules/use-stick-to-bottom/dist/useStickToBottom.js
var pe = {
	damping: .7,
	stiffness: .05,
	mass: 1.25
}, me = 70, Z = 1e3 / 60, he = 350, Q = !1;
globalThis.document?.addEventListener("mousedown", () => {
	Q = !0;
}), globalThis.document?.addEventListener("mouseup", () => {
	Q = !1;
}), globalThis.document?.addEventListener("click", () => {
	Q = !1;
});
var ge = (e = {}) => {
	let [t, n] = W(!1), [r, i] = W(e.initial !== !1), [a, o] = W(!1), s = U(null);
	s.current = e;
	let c = B(() => {
		if (!Q) return !1;
		let e = window.getSelection();
		if (!e || !e.rangeCount) return !1;
		let t = e.getRangeAt(0);
		return t.commonAncestorContainer.contains(g.current) || g.current?.contains(t.commonAncestorContainer);
	}, []), l = B((e) => {
		d.isAtBottom = e, i(e);
	}, []), u = B((e) => {
		d.escapedFromLock = e, n(e);
	}, []), d = ie(() => {
		let n;
		return {
			escapedFromLock: t,
			isAtBottom: r,
			resizeDifference: 0,
			accumulated: 0,
			velocity: 0,
			listeners: /* @__PURE__ */ new Set(),
			get scrollTop() {
				return g.current?.scrollTop ?? 0;
			},
			set scrollTop(e) {
				g.current && (g.current.scrollTop = e, d.ignoreScrollToTop = g.current.scrollTop);
			},
			get targetScrollTop() {
				return !g.current || !_.current ? 0 : g.current.scrollHeight - 1 - g.current.clientHeight;
			},
			get calculatedTargetScrollTop() {
				if (!g.current || !_.current) return 0;
				let { targetScrollTop: t } = this;
				if (!e.targetScrollTop) return t;
				if (n?.targetScrollTop === t) return n.calculatedScrollTop;
				let r = Math.max(Math.min(e.targetScrollTop(t, {
					scrollElement: g.current,
					contentElement: _.current
				}), t), 0);
				return n = {
					targetScrollTop: t,
					calculatedScrollTop: r
				}, requestAnimationFrame(() => {
					n = void 0;
				}), r;
			},
			get scrollDifference() {
				return this.calculatedTargetScrollTop - this.scrollTop;
			},
			get isNearBottom() {
				return this.scrollDifference <= me;
			}
		};
	}, []), f = B((e = {}) => {
		typeof e == "string" && (e = { animation: e }), e.preserveScrollPosition || l(!0);
		let t = Date.now() + (Number(e.wait) || 0), n = ye(s.current, e.animation), { ignoreEscapes: r = !1 } = e, i, a = d.calculatedTargetScrollTop;
		e.duration instanceof Promise ? e.duration.finally(() => {
			i = Date.now();
		}) : i = t + (e.duration ?? 0);
		let o = async () => {
			let e = new Promise(requestAnimationFrame).then(() => {
				if (!d.isAtBottom) return d.animation = void 0, !1;
				let { scrollTop: l } = d, u = performance.now(), p = (u - (d.lastTick ?? u)) / Z;
				if (d.animation ||= {
					behavior: n,
					promise: e,
					ignoreEscapes: r
				}, d.animation.behavior === n && (d.lastTick = u), c() || t > Date.now()) return o();
				if (l < Math.min(a, d.calculatedTargetScrollTop)) {
					if (d.animation?.behavior === n) {
						if (n === "instant") return d.scrollTop = d.calculatedTargetScrollTop, o();
						d.velocity = (n.damping * d.velocity + n.stiffness * d.scrollDifference) / n.mass, d.accumulated += d.velocity * p, d.scrollTop += d.accumulated, d.scrollTop !== l && (d.accumulated = 0);
					}
					return o();
				}
				return i > Date.now() ? (a = d.calculatedTargetScrollTop, o()) : (d.animation = void 0, d.scrollTop < d.calculatedTargetScrollTop ? f({
					animation: ye(s.current, s.current.resize),
					ignoreEscapes: r,
					duration: Math.max(0, i - Date.now()) || void 0
				}) : d.isAtBottom);
			});
			return e.then((e) => (requestAnimationFrame(() => {
				d.animation || (d.lastTick = void 0, d.velocity = 0);
			}), e));
		};
		return e.wait !== !0 && (d.animation = void 0), d.animation?.behavior === n ? d.animation.promise : o();
	}, [
		l,
		c,
		d
	]), p = B(() => {
		u(!0), l(!1);
	}, [u, l]), m = B(({ target: e }) => {
		if (e !== g.current) return;
		let { scrollTop: t, ignoreScrollToTop: n } = d, { lastScrollTop: r = t } = d;
		d.lastScrollTop = t, d.ignoreScrollToTop = void 0, n && n > t && (r = n), o(d.isNearBottom), setTimeout(() => {
			if (d.resizeDifference || t === n) return;
			if (c()) {
				u(!0), l(!1);
				return;
			}
			let e = t > r, i = t < r;
			d.animation?.ignoreEscapes ? d.scrollTop = r : (i && (u(!0), l(!1)), e && u(!1), !d.escapedFromLock && d.isNearBottom && l(!0));
		}, 1);
	}, [
		u,
		l,
		c,
		d
	]), h = B(({ target: e, deltaY: t }) => {
		let n = e;
		for (; !["scroll", "auto"].includes(getComputedStyle(n).overflow);) {
			if (!n.parentElement) return;
			n = n.parentElement;
		}
		n === g.current && t < 0 && g.current.scrollHeight > g.current.clientHeight && !d.animation?.ignoreEscapes && (u(!0), l(!1));
	}, [
		u,
		l,
		d
	]), g = _e((e) => {
		g.current?.removeEventListener("scroll", m), g.current?.removeEventListener("wheel", h), e?.addEventListener("scroll", m, { passive: !0 }), e?.addEventListener("wheel", h, { passive: !0 });
	}, []), _ = _e((e) => {
		if (d.resizeObserver?.disconnect(), !e) return;
		let t;
		d.resizeObserver = new ResizeObserver(([e]) => {
			let { height: n } = e.contentRect, r = n - (t ?? n);
			if (d.resizeDifference = r, d.scrollTop > d.targetScrollTop && (d.scrollTop = d.targetScrollTop), o(d.isNearBottom), r >= 0) {
				let e = ye(s.current, t ? s.current.resize : s.current.initial);
				f({
					animation: e,
					wait: !0,
					preserveScrollPosition: !0,
					duration: e === "instant" ? void 0 : he
				});
			} else d.isNearBottom && (u(!1), l(!0));
			t = n, requestAnimationFrame(() => {
				setTimeout(() => {
					d.resizeDifference === r && (d.resizeDifference = 0);
				}, 1);
			});
		}), d.resizeObserver?.observe(e);
	}, []);
	return {
		contentRef: _,
		scrollRef: g,
		scrollToBottom: f,
		stopScroll: p,
		isAtBottom: r || a,
		isNearBottom: a,
		escapedFromLock: t,
		state: d
	};
};
function _e(e, t) {
	let n = B((t) => (n.current = t, e(t)), t);
	return n;
}
var ve = /* @__PURE__ */ new Map();
function ye(...e) {
	let t = { ...pe }, n = !1;
	for (let r of e) r === "instant" ? n = !0 : typeof r == "object" && (n = !1, t.damping = r.damping ?? t.damping, t.stiffness = r.stiffness ?? t.stiffness, t.mass = r.mass ?? t.mass);
	let r = JSON.stringify(t);
	return ve.has(r) || ve.set(r, Object.freeze(t)), n ? "instant" : ve.get(r);
}
// node_modules/.bun/use-stick-to-bottom@1.1.3+b1ab299f0a400331/node_modules/use-stick-to-bottom/dist/StickToBottom.js
var be = z(null), xe = typeof window < "u" ? H : V;
function Se({ instance: e, children: t, resize: n, initial: r, mass: i, damping: a, stiffness: o, targetScrollTop: s, contextRef: c, ...l }) {
	let u = U(null), d = ge({
		mass: i,
		damping: a,
		stiffness: o,
		resize: n,
		initial: r,
		targetScrollTop: R.useCallback((e, t) => (y?.targetScrollTop ?? s)?.(e, t) ?? e, [s])
	}), { scrollRef: f, contentRef: p, scrollToBottom: m, stopScroll: h, isAtBottom: g, escapedFromLock: _, state: v } = e ?? d, y = ie(() => ({
		scrollToBottom: m,
		stopScroll: h,
		scrollRef: f,
		isAtBottom: g,
		escapedFromLock: _,
		contentRef: p,
		state: v,
		get targetScrollTop() {
			return u.current;
		},
		set targetScrollTop(e) {
			u.current = e;
		}
	}), [
		m,
		g,
		p,
		f,
		h,
		_,
		v
	]);
	return re(c, () => y, [y]), xe(() => {
		f.current && getComputedStyle(f.current).overflow === "visible" && (f.current.style.overflow = "auto");
	}, []), R.createElement(be.Provider, { value: y }, R.createElement("div", { ...l }, typeof t == "function" ? t(y) : t));
}
(function(e) {
	function t({ children: e, scrollClassName: t, ...n }) {
		let r = $();
		return R.createElement("div", {
			ref: r.scrollRef,
			style: {
				height: "100%",
				width: "100%",
				scrollbarGutter: "stable both-edges"
			},
			className: t
		}, R.createElement("div", {
			...n,
			ref: r.contentRef
		}, typeof e == "function" ? e(r) : e));
	}
	e.Content = t;
})(Se ||= {});
function $() {
	let e = ne(be);
	if (!e) throw Error("use-stick-to-bottom component context must be used within a StickToBottom component");
	return e;
}
// packages/ui/src/components/chat-ui/components/use-conversation-visibility.ts
var Ce = () => {
	let { scrollRef: e, stopScroll: t, scrollToBottom: n } = $();
	H(() => {
		let r = e.current;
		if (!r) return;
		let i = !1, a = {
			top: r.scrollTop,
			atTail: !0
		}, o = 0, s = () => {
			i || r.getClientRects().length === 0 || (a = {
				top: r.scrollTop,
				atTail: r.scrollHeight - r.clientHeight - r.scrollTop < 3
			});
		}, c = new ResizeObserver(() => {
			if (r.getClientRects().length === 0) i = !0, t();
			else if (i) {
				i = !1;
				let e = a;
				t(), r.scrollTop = e.top, o = requestAnimationFrame(() => {
					e.atTail ? n("instant") : r.scrollTop = e.top;
				});
			}
		});
		return r.addEventListener("scroll", s), c.observe(r), () => {
			cancelAnimationFrame(o), c.disconnect(), r.removeEventListener("scroll", s);
		};
	}, [
		e,
		t,
		n
	]);
}, we = de(Se, { base: {
	position: "relative",
	flex: 1,
	overflow: "hidden",
	height: "full"
} }, {
	forwardProps: ["initial", "resize"],
	defaultProps: {
		"aria-roledescription": "conversation",
		initial: "instant",
		resize: "instant",
		role: "log"
	}
}), Te = (e) => {
	let { children: t, ...n } = e, { contentRef: r, scrollRef: i } = $();
	return Ce(), /* @__PURE__ */ Y(g, {
		...n,
		height: "full",
		width: "full",
		showHorizontalScrollbar: !1,
		viewportRef: i,
		contentRef: r,
		verticalScrollbarProps: { zIndex: 2 },
		contentProps: {
			layerStyle: "chatContent",
			py: "sm",
			"aria-live": "polite",
			role: "list"
		},
		children: t
	});
}, Ee = {
	axis: "horizontal",
	bottom: "md",
	zIndex: 2
}, De = {
	Root: we,
	Viewport: Te,
	ScrollToBottom: (t) => {
		let { isAtBottom: n, scrollToBottom: r } = $();
		return !n && /* @__PURE__ */ Y(ae, {
			...Ee,
			children: /* @__PURE__ */ Y(K, {
				rounded: "full",
				onClick: () => r(),
				variant: "outline",
				size: "xs",
				...t,
				children: /* @__PURE__ */ Y(e, { size: 16 })
			})
		});
	}
}, Oe = (e) => {
	let { previousUserMessageCount: t, userMessageCount: n } = e;
	return t !== 0 && n > t;
}, ke = (e) => {
	let t = e.conversationKey ?? null;
	return e.state.conversationKey === t ? {
		shouldScroll: Oe({
			previousUserMessageCount: e.state.userMessageCount,
			userMessageCount: e.userMessageCount
		}),
		state: {
			conversationKey: t,
			userMessageCount: Math.max(e.state.userMessageCount, e.userMessageCount)
		}
	} : {
		shouldScroll: !1,
		state: {
			conversationKey: t,
			userMessageCount: e.userMessageCount
		}
	};
}, Ae = (e) => {
	let t = ke(e);
	return t.shouldScroll && e.scrollToBottom("instant"), t;
};
function je(e) {
	let { conversationKey: t, userMessageCount: n } = e, { scrollToBottom: r } = $(), i = U({
		conversationKey: t ?? null,
		userMessageCount: n
	});
	return V(() => {
		let e = Ae({
			state: i.current,
			conversationKey: t,
			userMessageCount: n,
			scrollToBottom: r
		});
		i.current = e.state;
	}, [
		t,
		n,
		r
	]), null;
}
// packages/ui/src/components/chat-ui/components/chat-message-animation.ts
var Me = {
	animationName: "message-fade-in",
	animationDuration: "200ms",
	animationTimingFunction: "ease-out"
}, Ne = (e) => {
	let t = /* @__PURE__ */ new Set(), n = new Set(e.state.seenKeys);
	for (let r of e.itemKeys) e.state.initialized && !n.has(r) && t.add(r), n.add(r);
	return {
		animatedKeys: t,
		state: {
			initialized: !0,
			seenKeys: n
		}
	};
}, Pe = (e, t) => {
	if (e.length !== t.length) return !1;
	for (let n = 0; n < e.length; n += 1) if (e[n] !== t[n]) return !1;
	return !0;
}, Fe = (e) => {
	let t = U({
		initialized: !1,
		seenKeys: /* @__PURE__ */ new Set()
	}), n = U(null);
	if (n.current && Pe(n.current.itemKeys, e)) return n.current.animatedKeys;
	let r = Ne({
		itemKeys: e,
		state: t.current
	});
	return t.current = r.state, n.current = {
		itemKeys: [...e],
		animatedKeys: r.animatedKeys
	}, r.animatedKeys;
}, Ie = (e) => e.type === "text", Le = (e) => (e.parts ?? []).filter(Ie).map((e) => e.text.trim()).filter(Boolean).join("\n\n"), Re = (e, t, n) => e.delivery === "unsent" ? "Not sent" : e.createdAt ? new Intl.DateTimeFormat(t, {
	hour: "numeric",
	minute: "2-digit",
	timeZone: n
}).format(new Date(e.createdAt)) : "", ze = (e) => {
	let { message: t, alwaysVisible: i = !1, copyAlwaysVisible: a = i } = e, [o, s] = W(!1), c = U(null), l = Le(t), u = Re(t);
	return V(() => () => {
		c.current !== null && window.clearTimeout(c.current);
	}, []), !l && !u ? null : /* @__PURE__ */ X(ce, {
		"data-chat-message-action-panel": "true",
		gap: "2xs",
		minH: "6",
		opacity: i ? "1" : "0",
		pointerEvents: i ? "auto" : "none",
		transition: "opacity 120ms ease",
		css: Be,
		children: [u ? /* @__PURE__ */ Y(q, {
			textStyle: "label/XS/regular",
			color: "fg.muted",
			children: u
		}) : null, l ? /* @__PURE__ */ Y(G, {
			opacity: a ? "1" : "0",
			pointerEvents: a ? "auto" : "none",
			transition: "opacity 120ms ease",
			css: Be,
			children: /* @__PURE__ */ Y(_, {
				content: o ? "Copied" : "Copy message",
				children: /* @__PURE__ */ Y(K, {
					"aria-label": o ? "Copied" : "Copy message",
					variant: "ghost",
					size: "2xs",
					onClick: async () => {
						if (l) try {
							await navigator.clipboard.writeText(l), s(!0), c.current !== null && window.clearTimeout(c.current), c.current = window.setTimeout(() => s(!1), 1200);
						} catch {
							s(!1);
						}
					},
					children: Y(o ? n : r, { size: 12 })
				})
			})
		}) : null]
	});
}, Be = {
	"[data-chat-message-with-actions]:hover &, [data-chat-message-with-actions]:focus-within &": {
		opacity: 1,
		pointerEvents: "auto"
	},
	".ai-message__root:hover &, .ai-message__root:focus-within &": {
		opacity: 1,
		pointerEvents: "auto"
	},
	"[data-scope='ai-message'][data-part='root']:hover &, [data-scope='ai-message'][data-part='root']:focus-within &": {
		opacity: 1,
		pointerEvents: "auto"
	}
}, Ve = (e) => {
	let { message: t, streaming: n, hideQuestionForms: r = !1, animate: i = !1, showAssistantActions: a } = e, o = N(t.role), s = o === "user" || o === "assistant" && a;
	return /* @__PURE__ */ Y(v.Root, {
		from: o,
		...i ? Me : void 0,
		children: /* @__PURE__ */ X(v.Content, {
			from: o,
			children: [/* @__PURE__ */ Y(P, {
				message: t,
				streaming: n && o === "assistant",
				hideQuestionForms: r
			}), s ? /* @__PURE__ */ Y(ze, {
				message: t,
				alwaysVisible: o === "user",
				copyAlwaysVisible: o !== "user"
			}) : null]
		})
	});
}, He = (e) => {
	let { expanded: t, label: n, onClick: r, actionPanel: i } = e, a = J({ key: "stickyUserMessage" })({ expanded: t });
	return /* @__PURE__ */ X(se, {
		css: a.footer,
		children: [i, /* @__PURE__ */ Y(oe, {
			size: "2xs",
			variant: "outline",
			pointerEvents: "auto",
			onClick: r,
			children: n
		})]
	});
}, Ue = (e, t) => {
	let n = I(e), r = e.map((e) => ({
		type: "response",
		key: e.id,
		message: e,
		userIndex: null,
		showAssistantActions: e.id === n,
		isActiveTurn: t.length === 0
	}));
	for (let [e, n] of t.entries()) {
		let i = r.length, a = I(n.responses);
		r.push({
			type: "user",
			key: n.userMessage.id,
			message: n.userMessage,
			endIndex: i + n.responses.length
		});
		for (let o of n.responses) r.push({
			type: "response",
			key: o.id,
			message: o,
			userIndex: i,
			showAssistantActions: o.id === a,
			isActiveTurn: e === t.length - 1
		});
	}
	return r;
}, We = (e, t) => {
	let n = e[t];
	return n?.type === "user" ? t : n?.userIndex ?? null;
}, Ge = (e, t) => {
	let n = e[t + 1];
	return !!n && (n.type === "user" || We(e, t) === null);
}, Ke = 1, qe = (e, t) => {
	let n = Math.max(0, e.scrollHeight - e.clientHeight);
	return t === 0 || n <= Ke ? !1 : t < 0 ? e.scrollTop > Ke : e.scrollTop < n - Ke;
}, Je = (e) => {
	qe(e.currentTarget, e.deltaY) && e.stopPropagation();
};
function Ye(e) {
	let { message: t, expanded: n, animate: r, onToggle: i } = e, a = U(null), o = U(null), s = U(null), [c, l] = W(!1), u = c && n, d = J({ key: "stickyUserMessage" })({ expanded: u }), f = {
		css: d.viewport,
		"data-sticky-user-message-content": u ? "expanded" : "collapsed",
		onWheel: u ? Je : void 0
	};
	H(() => {
		let e = o.current, t = s.current, n = () => {
			l(e.getBoundingClientRect().height > t.getBoundingClientRect().height + 1);
		}, r = new ResizeObserver(n);
		return r.observe(e), r.observe(t), n(), () => r.disconnect();
	}, []), H(() => {
		u || (a.current.scrollTop = 0);
	}, [u]);
	let p = /* @__PURE__ */ Y(ze, {
		message: t,
		alwaysVisible: !0,
		copyAlwaysVisible: !1
	});
	return /* @__PURE__ */ Y(v.Root, {
		from: "user",
		delivery: t.delivery ?? "sent",
		...r ? Me : void 0,
		children: /* @__PURE__ */ X(v.Content, {
			from: "user",
			css: d.root,
			children: [
				/* @__PURE__ */ Y(G, {
					ref: s,
					css: d.preview,
					"aria-hidden": "true"
				}),
				/* @__PURE__ */ Y(g, {
					viewportRef: a,
					showVerticalScrollbar: u,
					viewportProps: f,
					children: /* @__PURE__ */ Y(G, {
						ref: o,
						css: d.body,
						children: /* @__PURE__ */ Y(P, { message: t })
					})
				}),
				c ? null : /* @__PURE__ */ Y(G, {
					css: d.actions,
					children: p
				}),
				c ? /* @__PURE__ */ Y(He, {
					expanded: u,
					label: u ? "Show less" : "Show more",
					onClick: () => i(t.id),
					actionPanel: p
				}) : null
			]
		})
	});
}
// packages/ui/src/components/chat-ui/components/use-chat-tail-ready.ts
var Xe = 3, Ze = 20, Qe = 1, $e = (e, t) => Math.abs(e.scrollTop - t.scrollTop) <= Qe && Math.abs(e.totalSize - t.totalSize) <= Qe, et = (e) => !!e && e.scrollHeight <= e.clientHeight, tt = (e) => ({
	scrollTop: e?.scrollTop ?? 0,
	totalSize: e?.scrollHeight ?? 0
}), nt = (e) => {
	let { onReady: t, scrollRef: n } = e, r = U(t);
	V(() => {
		r.current = t;
	}, [t]), H(() => {
		if (typeof requestAnimationFrame > "u" || et(n.current)) {
			r.current?.();
			return;
		}
		let e = 0, t = 0, i = 0, a = null, o = () => {
			t += 1;
			let s = tt(n.current);
			i = a && $e(s, a) ? i + 1 : 0, a = s, i >= Xe || t >= Ze ? r.current?.() : e = requestAnimationFrame(o);
		};
		return e = requestAnimationFrame(o), () => cancelAnimationFrame(e);
	}, [n]);
}, rt = 360, it = 4, at = 8, ot = (e) => {
	let { leadingResponses: t, groups: n, streaming: r, hideActiveQuestionForms: i, expandedStickyMessageIds: a, onToggleStickyMessage: o, onReady: s } = e, { scrollRef: c } = $(), l = Ue(t, n), u = Fe(l.map((e) => e.key)), d = c.current?.clientHeight || 1, f = Math.max(t.length + n.length - 1, 0), { virtualizer: p, virtualItems: m, totalSize: h, measurements: g } = O({
		count: l.length,
		getScrollElement: () => c.current,
		estimateSize: (e) => rt + (Ge(l, e) ? at : 0),
		getItemKey: (e) => l[e].key,
		overscan: it,
		initialRect: {
			width: 0,
			height: d
		},
		initialOffset: () => Math.max(l.length * rt + f * at - d, 0),
		rangeExtractor: (e) => {
			let t = ee(e), n = We(l, e.startIndex);
			return n !== null && !t.includes(n) && t.unshift(n), t;
		}
	});
	return nt({
		onReady: s,
		scrollRef: c
	}), /* @__PURE__ */ Y(G, {
		px: "xs",
		children: /* @__PURE__ */ Y(G, {
			position: "relative",
			width: "100%",
			style: { height: h },
			children: m.map((e) => {
				let t = l[e.index];
				if (t.type === "user") {
					let n = (g[t.endIndex]?.end ?? h) - (Ge(l, t.endIndex) ? at : 0);
					return /* @__PURE__ */ Y(G, {
						position: "absolute",
						left: "0",
						width: "100%",
						zIndex: 1,
						pointerEvents: "none",
						style: {
							top: e.start,
							height: Math.max(e.size, n - e.start)
						},
						children: /* @__PURE__ */ Y(G, {
							ref: p.measureElement,
							"data-index": e.index,
							"data-chat-message-list-item": "user",
							"data-chat-message-id": t.key,
							position: "sticky",
							top: "0",
							pointerEvents: "auto",
							pb: Ge(l, e.index) ? "xs" : void 0,
							children: /* @__PURE__ */ Y(Ye, {
								message: t.message,
								expanded: a.has(t.key),
								animate: u.has(t.key),
								onToggle: o
							})
						})
					}, e.key);
				}
				return /* @__PURE__ */ Y(G, {
					ref: p.measureElement,
					"data-index": e.index,
					"data-chat-message-list-item": t.type,
					"data-chat-message-id": t.key,
					position: "absolute",
					left: "0",
					width: "100%",
					pb: Ge(l, e.index) ? "xs" : void 0,
					style: { top: e.start },
					children: /* @__PURE__ */ Y(Ve, {
						message: t.message,
						streaming: r && t.isActiveTurn && t.showAssistantActions,
						hideQuestionForms: !t.isActiveTurn || i,
						animate: u.has(t.key),
						showAssistantActions: t.showAssistantActions
					})
				}, e.key);
			})
		})
	});
}, st = (e) => {
	let { queuedFollowUps: t, defaultValue: n, onChange: r, onSubmit: i, onUpdate: a, onCreate: o, onRestoreDraft: s, canRestoreDraft: c = !1, disabled: l = !1, onSelect: u, onDiscard: d } = e, [f, p] = W(null), [m, h] = W({}), [g, _] = W(null), [v, y] = W(0), [b, x] = W({}), [S, C] = W(null), [w, E] = W(!1), [D, ee] = W(null), [O, k] = W(null), A = t.find((e) => e.id === f?.id), j = !(!f || A), M = !!(f && A && f.revision && f.revision !== A.revision), N = f ? m[f.id]?.text ?? f.prompt : n, P = g?.text === n ? g.state : void 0, F = f ? m[f.id]?.state : P, I = (e) => {
		p(e), C(null), k(null), u?.(e), y((e) => e + 1);
	};
	V(() => {
		!f || A || w || l || D === f.id || (ee(f.id), c && r && !n.trim() && !t.length && (s?.(f.id), _({
			text: N,
			state: F ?? T(N)
		}), x((e) => ({
			...e,
			draft: e[f.id]
		})), r(N), h((e) => {
			let t = { ...e };
			return delete t[f.id], t;
		}), p(null), C(null), u?.(null), y((e) => e + 1), k("This request was sent. Your edit moved to the draft.")));
	}, [
		f,
		A,
		w,
		l,
		D,
		c,
		n,
		t.length,
		s,
		N,
		F,
		r,
		u
	]);
	let L = (e) => {
		f ? h((t) => ({
			...t,
			[f.id]: {
				text: e,
				state: T(e)
			}
		})) : (e !== n && k(null), r?.(e));
	}, R = (e, t) => {
		f ? h((n) => ({
			...n,
			[f.id]: {
				text: e,
				state: t
			}
		})) : _({
			text: e,
			state: t
		});
	}, te = () => {
		f && (d?.(f.id), h((e) => {
			let t = { ...e };
			return delete t[f.id], t;
		})), I(null);
	}, z = async (e, t, n) => {
		if (n) return i?.(e, t, n);
		if (!f) return i?.(e, t);
		if (M || w) throw Error("Select the saved request again before updating.");
		E(!0);
		try {
			if (j) {
				if (!o) throw Error("This conversation cannot create a new queue item.");
				await o(f.id, e);
			} else await a?.(f.id, e);
			h((e) => {
				let t = { ...e };
				return delete t[f.id], t;
			}), I(null);
		} catch (e) {
			throw C(e instanceof Error ? e.message : "Could not update. Your edit is kept."), e;
		} finally {
			E(!1);
		}
	}, B = f?.id ?? "draft";
	return {
		initialSelection: b[B],
		changeSelection: (e) => x((t) => ({
			...t,
			[B]: e
		})),
		draftValue: n,
		change: L,
		changeState: R,
		edit: (e) => {
			w || I(e);
		},
		selectDraft: () => {
			w || I(null);
		},
		discard: te,
		editingItem: f,
		editingItemId: f?.id ?? null,
		focusSignal: v,
		inputValue: N,
		editorState: F,
		isEditing: !!f,
		submit: z,
		error: S,
		notice: O ?? (j ? "This request was sent. Create a new queue item to keep your edits." : null),
		createNew: j,
		updating: w,
		stale: M,
		dirtyItemIds: Object.keys(m).filter((e) => m[e].text !== t.find((t) => t.id === e)?.prompt)
	};
}, ct = (e) => {
	let { conversationKey: t, recentUserMessages: n, actions: r, attachmentActions: i, attachedResources: a, attachmentList: o, chatInputAutoFocus: s, chatInputPlaceholder: c, chatInputQuestionPrompt: l, composerDecision: u, chatInputCommands: d, inputDisabled: f, submitDisabled: p, onAttachFiles: m, onAttachText: h, onClearAttachments: g, onInterrupt: _, queuedComposer: v, streaming: y } = e, { editing: b, hasQueuedFollowUps: x } = e, S = v.createNew ? "Create new queue item" : "Update", C = v.updating ? "Saving…" : S;
	return /* @__PURE__ */ X(G, {
		onKeyDown: (e) => {
			e.key !== "Escape" || e.defaultPrevented || e.nativeEvent.isComposing || !b || f || v.updating || !e.currentTarget.contains(e.target) || (e.preventDefault(), e.stopPropagation(), v.discard());
		},
		children: [/* @__PURE__ */ Y(D, {
			recentUserMessages: n,
			placeholder: c,
			defaultState: v.editorState ?? T(v.inputValue),
			streaming: !b && y,
			onSubmit: v.submit,
			onInterrupt: b ? void 0 : _,
			onAttachFiles: m,
			onAttachText: h,
			onChange: v.change,
			onEditorStateChange: v.changeState,
			initialSelection: v.initialSelection,
			onSelectionChange: v.changeSelection,
			actions: r,
			submitActions: b ? /* @__PURE__ */ Y(oe, {
				size: "xs",
				variant: "ghost",
				onClick: v.discard,
				disabled: v.updating || f,
				children: "Cancel"
			}) : null,
			attachmentActions: i,
			attachedResources: a,
			onClearAttachments: g,
			attachmentList: o,
			isDisabled: f || v.updating,
			submitDisabled: p || b && v.stale,
			attachedToTop: !b && x,
			questionPrompt: l,
			decision: u,
			autoFocus: s,
			focusSignal: v.focusSignal,
			submitTitle: b ? S : void 0,
			submitLabel: b ? C : void 0,
			retainTextUntilAcknowledged: b,
			commands: d
		}, `${t ?? ""}:${v.editingItemId ?? "draft"}`), /* @__PURE__ */ Y(lt, {
			queuedComposer: v,
			editing: b
		})]
	});
}, lt = (e) => {
	let { queuedComposer: t, editing: n } = e, r = n && t.stale, i = t.error ?? (r ? "This request changed. Your edit is kept; select the saved request again before updating." : t.notice);
	if (!i) return null;
	let a = !!(t.error || r);
	return /* @__PURE__ */ Y(q, {
		mt: "2xs",
		color: a ? "fg.error" : "fg.muted",
		textStyle: "label/S/regular",
		role: a ? "alert" : "status",
		"aria-label": "Queued edit notice",
		children: i
	});
}, ut = (e, { context: t }, n) => {
	if (![
		"ArrowUp",
		"ArrowDown",
		"Home",
		"End"
	].includes(e.code)) return;
	e.preventDefault();
	let r = t.droppableContainers.getEnabled().sort((e, t) => Number(e.data.current?.order) - Number(t.data.current?.order)), i = r.findIndex((e) => e.id === t.over?.id) + (e.code === "ArrowUp" ? -1 : 1);
	e.code === "Home" && (i = 0), e.code === "End" && (i = r.length - 1);
	let a = r[Math.max(0, Math.min(r.length - 1, i))], o = a && t.droppableRects.get(a.id);
	if (o) return n?.(a.id), {
		x: o.left + (o.width - (t.collisionRect?.width ?? 0)) / 2,
		y: o.top + (o.height - (t.collisionRect?.height ?? 0)) / 2
	};
}, dt = (e) => {
	let { item: t, index: n, kind: r } = e, i = h({
		id: `${t.id}:${r}`,
		disabled: !!(t.sending || t.steeringDelivery),
		data: {
			item: t,
			kind: r,
			order: n * 3 + [
				"before",
				"combine",
				"after"
			].indexOf(r)
		}
	}), a = {
		before: {
			top: "0",
			height: "25%"
		},
		combine: {
			top: "25%",
			height: "50%"
		},
		after: {
			bottom: "0",
			height: "25%"
		}
	}[r];
	return /* @__PURE__ */ Y(G, {
		ref: i.setNodeRef,
		position: "absolute",
		insetX: "0",
		pointerEvents: "none",
		...a
	});
}, ft = (e) => {
	let { visible: n, targeted: r, reason: i } = e, a = h({
		id: "queue-send-now",
		disabled: !n,
		data: {
			kind: "steer",
			order: -1
		}
	}), o = J({ recipe: L })();
	return n ? /* @__PURE__ */ Y(G, {
		ref: a.setNodeRef,
		css: o.sendNowHit,
		children: /* @__PURE__ */ X(G, {
			css: o.sendNow,
			bottom: "0",
			title: i ?? void 0,
			"aria-disabled": !!i,
			"data-targeted": r && !i,
			"data-queue-send-now": !0,
			children: [/* @__PURE__ */ Y(t, { size: 14 }), /* @__PURE__ */ Y(q, { children: "drop here to send now" })]
		})
	}) : null;
}, pt = (e) => {
	let { item: t, index: n, editor: r, source: a, destination: s, unavailableReason: c, editing: l, onEdit: u, onRemove: d } = e, f = !!(t.sending || t.steeringDelivery), m = p({
		id: t.id,
		data: { item: t },
		disabled: f
	}), h = J({ recipe: L })(), [g, _] = W(!1), [v, y] = W(!1), b = U(void 0), x = U(null);
	V(() => () => clearTimeout(b.current), []), V(() => {
		l && x.current?.scrollIntoView({ block: "nearest" });
	}, [l]);
	let S = () => {
		clearTimeout(b.current), _(!0);
	}, C = !r;
	return /* @__PURE__ */ X(G, {
		className: "group",
		ref: (e) => {
			m.setNodeRef(e), x.current = e;
		},
		css: h.row,
		"data-drag-source": a,
		"data-combine-target": s === "combine" && !c,
		"data-queued-follow-up-id": t.id,
		"aria-busy": t.sending || void 0,
		onPointerEnter: S,
		onPointerLeave: () => {
			b.current = setTimeout(() => _(!1), 150);
		},
		onPointerDown: (e) => {
			e.pointerType === "touch" && S();
		},
		onFocusCapture: () => y(!0),
		onBlurCapture: (e) => {
			e.currentTarget.contains(e.relatedTarget) || y(!1);
		},
		onClick: (e) => {
			!t.sending && C && !e.target.closest("button") && u?.(t);
		},
		children: [
			/* @__PURE__ */ Y(K, {
				ref: m.setActivatorNodeRef,
				...m.listeners,
				...m.attributes,
				"aria-label": `Drag queued follow-up ${n + 1}`,
				size: "2xs",
				variant: "ghost",
				css: h.handle,
				disabled: f,
				onClick: (e) => e.stopPropagation(),
				children: /* @__PURE__ */ Y(i, { size: 14 })
			}),
			/* @__PURE__ */ X(ue, {
				flex: "1",
				minW: "0",
				gap: "2xs",
				children: [r ?? /* @__PURE__ */ Y(G, {
					asChild: !0,
					css: h.content,
					children: /* @__PURE__ */ X("button", {
						type: "button",
						disabled: t.sending,
						"aria-label": `Edit queued message: ${t.prompt}`,
						onClick: () => u?.(t),
						children: [/* @__PURE__ */ Y(q, {
							lineClamp: 2,
							children: t.prompt
						}), /* @__PURE__ */ Y(q, {
							color: "fg.muted",
							textStyle: "label/XS",
							lineClamp: 1,
							children: s === "combine" ? c ?? "Release to combine" : [
								t.sending ? "Sending…" : null,
								t.model,
								...Object.values(t.params ?? {}).map(String),
								...t.attachments?.map((e) => e.name) ?? []
							].filter(Boolean).join(" · ") || "Saved request"
						})]
					})
				}), t.steeringDelivery ? /* @__PURE__ */ Y(q, {
					css: h.notice,
					children: "Delivery is unconfirmed. Saved input is kept and will not be replayed."
				}) : null]
			}),
			d && !r && !f ? /* @__PURE__ */ Y(ce, {
				css: h.actions,
				"data-visible": g || v || l,
				children: /* @__PURE__ */ Y(K, {
					"aria-label": "Remove queued follow-up",
					size: "2xs",
					variant: "destructive-ghost",
					onClick: (e) => {
						e.stopPropagation(), d(t.id);
					},
					children: /* @__PURE__ */ Y(o, { size: 14 })
				})
			}) : null,
			/* @__PURE__ */ Y(dt, {
				item: t,
				index: n,
				kind: "before"
			}),
			/* @__PURE__ */ Y(dt, {
				item: t,
				index: n,
				kind: "combine"
			}),
			/* @__PURE__ */ Y(dt, {
				item: t,
				index: n,
				kind: "after"
			}),
			s === "before" ? /* @__PURE__ */ Y(k, { top: "0" }) : null,
			s === "after" ? /* @__PURE__ */ Y(k, { bottom: "0" }) : null
		]
	});
}, mt = (e) => JSON.stringify([e.model, Object.entries(e.params ?? {}).sort(([e], [t]) => e.localeCompare(t))]), ht = (e) => {
	let { items: t, editingItemId: n, editor: r, retainedEditor: i, retainedEditorPosition: a, dirtyItemIds: o = [], steeringUnavailableReason: p, onEdit: h, onRemove: _, onMove: v, onSteer: y, onCombine: b } = e, x = J({ recipe: L })(), [S, C] = W(null), w = m(s(d, { activationConstraint: { distance: 4 } }), s(l, { coordinateGetter: (e, t) => ut(e, t, C) })), [T, E] = W(null), [D, ee] = W([]), [O, k] = W(null), [A, j] = W(null), [M, N] = W(!1);
	if (!t.length && !i) return null;
	let P = gt(t, a), F = T?.steeringUnavailableReason ?? p ?? (T && o.includes(T.id) ? "Update or Cancel this edit before sending." : null) ?? (y ? null : "This conversation cannot accept live input."), I = !!(T && y && !p), R = (e) => !T || T.id === e.id ? "Choose another request." : o.includes(T.id) || o.includes(e.id) ? "Update or Cancel the edits first." : mt(T) === mt(e) ? e.steeringDelivery ? "Delivery is still being confirmed." : null : "Model and thinking settings must match.", z = (e, t, n) => {
		let r = D.filter((e) => !e.sending && !e.steeringDelivery), i = r.findIndex((t) => t.id === e.id), a = r.findIndex((e) => e.id === t.id);
		if (i < 0 || a < 0 || i === a) return;
		let o = a + +(n === "after"), s = o - +(i < o);
		if (s !== i) return v?.(e.id, s < i ? "up" : "down", Math.abs(s - i), {
			source: e,
			items: D
		});
	}, B = (e, t) => {
		if (t.kind === "steer") {
			if (!F) return y?.(e);
			j(F);
		} else if (t.item) return t.kind === "combine" ? R(t.item) ? void 0 : b?.(e, t.item) : z(e, t.item, t.kind);
	};
	return /* @__PURE__ */ Y(f, {
		sensors: w,
		collisionDetection: (e) => {
			if (!e.pointerCoordinates && S !== null) return [{ id: S }];
			let t = u(e);
			return t.length ? t : c(e);
		},
		autoScroll: !0,
		onDragStart: (e) => {
			C(null), E(e.active.data.current?.item ?? null), ee(t), j(null);
		},
		onDragOver: (e) => k(e.over?.data.current ?? null),
		onDragCancel: () => {
			C(null), E(null), k(null);
		},
		onDragEnd: (e) => {
			let t = T, n = e.over?.data.current;
			E(null), k(null), t && n && !M && (N(!0), Promise.resolve().then(() => B(t, n)).catch((e) => j(e instanceof Error ? e.message : "Could not change the queue. Saved input is kept.")).finally(() => N(!1)));
		},
		children: /* @__PURE__ */ X(G, {
			css: x.root,
			"data-send-now-visible": I,
			"aria-busy": M,
			children: [
				/* @__PURE__ */ Y(ft, {
					visible: I,
					targeted: O?.kind === "steer",
					reason: F
				}),
				/* @__PURE__ */ X(g, {
					maxH: "queue-viewport",
					minH: "0",
					viewportProps: { maxH: "queue-viewport" },
					children: [t.map((e, t) => /* @__PURE__ */ X(te, { children: [i && t === P ? /* @__PURE__ */ Y(_t, { children: i }) : null, /* @__PURE__ */ Y(pt, {
						item: e,
						index: t,
						source: T?.id === e.id,
						destination: O?.item?.id === e.id ? O.kind : void 0,
						unavailableReason: O?.kind === "combine" ? R(e) : null,
						editing: n === e.id,
						editor: n === e.id ? r : void 0,
						onEdit: h,
						onRemove: _
					})] }, e.id)), i && P === t.length ? /* @__PURE__ */ Y(_t, { children: i }) : null]
				}),
				A ? /* @__PURE__ */ Y(q, {
					css: x.notice,
					role: "alert",
					children: A
				}) : null
			]
		})
	});
}, gt = (e, t = Infinity) => {
	let n = e.findIndex((e) => (e.position ?? Infinity) > t);
	return n < 0 ? e.length : n;
}, _t = (e) => {
	let { children: t } = e, n = J({ recipe: L })();
	return /* @__PURE__ */ Y(G, {
		css: n.row,
		children: /* @__PURE__ */ Y(G, {
			flex: "1",
			minW: "0",
			children: t
		})
	});
}, vt = (e) => {
	let { composerHeader: t, composerFallback: n, chatInputQuestionPrompt: r, composerDecision: i, hasWorkspaceHub: a, onQueuedFollowUpMove: o, onQueuedFollowUpRemove: s, onQueuedFollowUpUpdate: c, onQueuedFollowUpSteer: l, onQueuedFollowUpCombine: u, queueSteeringUnavailableReason: d, unsavedQueueItemIds: f = [], queuedComposer: p, queuedFollowUps: m, workspaceHub: h } = e, g = J({ recipe: L })(), _ = J({ recipe: E })({ workspace: a }), v = m.length > 0, y = !!(r || i), b = p.isEditing && !y, x = /* @__PURE__ */ Y(ct, {
		...e,
		editing: b,
		hasQueuedFollowUps: v
	});
	return /* @__PURE__ */ Y(ue, {
		p: "xs",
		gap: "0",
		children: /* @__PURE__ */ X(G, {
			className: "ps-chat-composer__workspace",
			css: _.workspace,
			children: [
				h,
				t,
				n,
				!n && /* @__PURE__ */ X(fe, { children: [/* @__PURE__ */ Y(ht, {
					items: m,
					editor: b ? x : void 0,
					retainedEditor: b && p.createNew ? x : void 0,
					retainedEditorPosition: p.editingItem?.position,
					dirtyItemIds: [...p.dirtyItemIds, ...f],
					steeringUnavailableReason: d,
					onSteer: l,
					onCombine: u,
					editingItemId: p.editingItemId,
					onEdit: c ? p.edit : void 0,
					onRemove: s,
					onMove: o
				}), b && /* @__PURE__ */ Y(G, {
					css: g.draft,
					asChild: !0,
					children: /* @__PURE__ */ Y("button", {
						type: "button",
						onClick: p.selectDraft,
						"aria-label": "Edit saved draft",
						children: p.draftValue || "Saved draft · select to edit"
					})
				})] }),
				!b && (!n || y) && x
			]
		})
	});
}, yt = (e) => {
	let t = Math.max(0, Math.floor(e));
	if (t < 60) return `${t}s`;
	let n = Math.floor(t / 60);
	return n < 60 ? `${n}m ${String(t % 60).padStart(2, "0")}s` : `${Math.floor(n / 60)}h ${String(n % 60).padStart(2, "0")}m`;
}, bt = (e) => {
	let { startedAt: t, hidden: n = !1 } = e, [r] = W(Date.now), [i, a] = W(Date.now);
	return V(() => {
		if (n) return;
		let e = () => a(Date.now());
		e();
		let t = setInterval(e, 1e3);
		return () => clearInterval(t);
	}, [n]), n ? null : /* @__PURE__ */ X(ce, {
		gap: "2xs",
		px: "sm",
		py: "xs",
		children: [/* @__PURE__ */ Y(le, {
			size: "xs",
			color: "fg.muted"
		}), /* @__PURE__ */ Y(q, {
			fontFamily: "mono",
			fontSize: "xs",
			color: "fg.muted",
			letterSpacing: "-0.2px",
			children: yt((i - (t ?? r)) / 1e3)
		})]
	});
}, xt = (e) => {
	let { conversationKey: t, linkHandler: n, messages: r, loading: i = !1, streaming: o = !1, streamingStartedAt: s, emptyStateTitle: c, emptyStateDescription: l, emptyStateContent: u, loaderComponent: d, chatInputPlaceholder: f, chatInputDefaultValue: p = "", onSubmitMessage: m, onInterrupt: h, onAttachFiles: g, onAttachText: _, onChatInputChange: v, actions: T, attachmentActions: E, composerHeader: D, composerFallback: ee, hideComposer: O = !1, attachedResources: k, onClearAttachments: N, attachmentList: P, approvalPrompt: I, conversationNotices: L, workspaceHub: R, workspaceInitializing: te = !1, inputDisabled: z = !1, submitDisabled: B = !1, chatInputQuestionPrompt: ne, composerDecision: V, chatInputAutoFocus: re = !1, queuedFollowUps: H = [], onQueuedFollowUpUpdate: ie, onQueuedFollowUpCreate: U, onQueuedFollowUpRestoreDraft: ae, canRestoreQueuedEditToDraft: oe, onQueuedFollowUpSelect: ce, onQueuedFollowUpDiscard: K, onQueuedFollowUpSteer: le, onQueuedFollowUpCombine: ue, queueSteeringUnavailableReason: q, unsavedQueueItemIds: de, onQueuedFollowUpRemove: J, onQueuedFollowUpMove: pe, chatInputCommands: me = [] } = e, Z = M(r, { streaming: o }), he = Z.length > 0, Q = t ?? Z[0]?.id, ge = he ? Q ?? "active-conversation" : null, _e = Z.reduce((e, t) => e + +(t.role === "user"), 0), { groups: ve, leadingResponses: ye } = F(Z), [be, xe] = W(() => /* @__PURE__ */ new Set()), [Se, $] = W(null), Ce = !he && i ? d : u ?? /* @__PURE__ */ Y(y, {
		icon: /* @__PURE__ */ Y(a, {
			size: 48,
			strokeWidth: 1.5
		}),
		title: c,
		description: l
	}), we = !!R, Te = A(r, t ?? r[0]?.id), Ee = Te.prompt ?? ne ?? C(r), Oe = !!Ee, ke = o && he && !te && !Ee, Ae = !ge || Se === ge, Me = st({
		queuedFollowUps: H,
		defaultValue: p,
		onChange: v,
		onSubmit: m,
		onUpdate: ie,
		onCreate: U,
		onRestoreDraft: ae,
		canRestoreDraft: oe,
		disabled: z,
		onSelect: ce,
		onDiscard: K
	});
	return /* @__PURE__ */ Y(b, {
		value: x(r, n),
		children: /* @__PURE__ */ Y(S, {
			handler: n,
			children: /* @__PURE__ */ Y(j, {
				value: Te.value,
				children: /* @__PURE__ */ X(se, {
					position: "relative",
					direction: "column",
					w: "full",
					h: "full",
					overflow: "hidden",
					children: [/* @__PURE__ */ X(De.Root, { children: [
						/* @__PURE__ */ Y(je, {
							conversationKey: Q ?? null,
							userMessageCount: _e
						}),
						/* @__PURE__ */ Y(De.Viewport, {
							visibility: Ae ? "visible" : "hidden",
							children: he ? /* @__PURE__ */ X(fe, { children: [/* @__PURE__ */ Y(ot, {
								leadingResponses: ye,
								groups: ve,
								streaming: o,
								hideActiveQuestionForms: Oe,
								expandedStickyMessageIds: be,
								onToggleStickyMessage: (e) => {
									xe((t) => {
										let n = new Set(t);
										return n.has(e) ? n.delete(e) : n.add(e), n;
									});
								},
								onReady: () => $(ge)
							}, ge), L] }) : /* @__PURE__ */ X(fe, { children: [L, Ce] })
						}),
						Ae ? /* @__PURE__ */ Y(De.ScrollToBottom, { "aria-label": "Scroll to latest message" }) : null
					] }, Q), !O && /* @__PURE__ */ X(G, {
						layerStyle: "chatContent",
						flexShrink: "0",
						children: [
							I,
							o ? /* @__PURE__ */ Y(bt, {
								startedAt: s,
								hidden: !ke
							}, Q) : null,
							/* @__PURE__ */ Y(vt, {
								conversationKey: t ?? r[0]?.id,
								recentUserMessages: w(r),
								actions: T,
								attachmentActions: E,
								composerHeader: D,
								composerFallback: ee,
								attachedResources: k,
								attachmentList: P,
								chatInputAutoFocus: re,
								chatInputPlaceholder: f,
								chatInputQuestionPrompt: Ee,
								composerDecision: Te.prompt ? void 0 : V,
								chatInputCommands: me,
								hasWorkspaceHub: we,
								inputDisabled: z,
								submitDisabled: B,
								onAttachFiles: g,
								onAttachText: _,
								onClearAttachments: N,
								onInterrupt: h,
								onQueuedFollowUpMove: pe,
								onQueuedFollowUpRemove: J,
								onQueuedFollowUpUpdate: ie,
								onQueuedFollowUpSteer: le,
								onQueuedFollowUpCombine: ue,
								queueSteeringUnavailableReason: q,
								unsavedQueueItemIds: de,
								queuedComposer: Me,
								queuedFollowUps: H,
								streaming: o,
								workspaceHub: R
							})
						]
					})]
				})
			})
		})
	});
};
export { De as n, xt as t };
