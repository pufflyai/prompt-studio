// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { i as e, t } from "./rolldown-runtime-CwxnZyOB.ts";
import { a as n, c as r, d as i, i as a, l as o, r as s, s as c, u as l } from "./assembly-layout-BE5FCzRo.ts";
import { n as u, r as d, t as f } from "./demo-cli-commands-D1MXwSgH.ts";
import { c as p, o as m, s as h } from "./demo-workbench-CNySDkwL.ts";
import { t as g } from "./landing-assembly-DfV4OwkL.ts";
import { t as _ } from "./assembly-cursor-BojyTSnt.ts";
import { t as v } from "./tool-board-CNs1WwWZ.ts";
import { useId as y, useLayoutEffect as b, useRef as x, useState as S } from "react";
import { Box as C, chakra as w, useSlotRecipe as T } from "@chakra-ui/react";
import { jsx as E, jsxs as D } from "react/jsx-runtime";
// clients/landing-page/src/content/tool-interactions.ts
var O = {
	icons: [
		{
			agent: 1,
			kind: "click",
			selector: "[data-icon-id=\"component\"]"
		},
		{
			agent: 0,
			kind: "type",
			selector: "[aria-label=\"Icon name\"]",
			edit: "icon-name"
		},
		{
			agent: 2,
			kind: "click",
			selector: "button[type=\"submit\"]"
		},
		{
			agent: 1,
			kind: "cli",
			command: {
				tool: "icons",
				id: "component",
				name: "component-glow"
			}
		}
	],
	shaders: [
		{
			agent: 1,
			kind: "type",
			selector: "[aria-label=\"Fragment shader code\"]",
			edit: "shader"
		},
		{
			agent: 0,
			kind: "key",
			selector: "[role=\"slider\"][aria-label=\"Shader scale\"]",
			key: "ArrowRight"
		},
		{
			agent: 2,
			kind: "key",
			selector: "[role=\"slider\"][aria-label=\"Shader speed\"]",
			key: "ArrowRight"
		},
		{
			agent: 0,
			kind: "cli",
			command: {
				tool: "shaders",
				scale: 16,
				speed: 1.2
			}
		}
	],
	agents: [
		{
			agent: 0,
			kind: "click",
			selector: "[data-agent-control=\"session\"]",
			index: 0
		},
		{
			agent: 2,
			kind: "click",
			selector: "[data-agent-control=\"session\"]",
			index: 1
		},
		{
			agent: 1,
			kind: "click",
			selector: "[data-agent-control=\"session\"]",
			index: 2
		},
		{
			agent: 2,
			kind: "cli",
			command: {
				tool: "agents",
				id: "TOOL-18"
			}
		}
	],
	formulas: [
		{
			agent: 2,
			kind: "click",
			selector: "[aria-label=\"Choose a formula\"] button",
			index: 1
		},
		{
			agent: 0,
			kind: "key",
			selector: "[role=\"slider\"]",
			key: "ArrowRight"
		},
		{
			agent: 1,
			kind: "click",
			selector: "[aria-label=\"Choose a formula\"] button",
			index: 2
		},
		{
			agent: 2,
			kind: "cli",
			command: {
				tool: "formulas",
				id: "loan",
				inputs: {
					principal: 3e5,
					rate: 4,
					years: 20
				}
			}
		}
	]
}, k = 1.3, A = (e, t, n, r) => {
	let i = Math.max(0, Math.min(1, n)), a = i * i * (3 - 2 * i), o = Math.hypot(t.x - e.x, t.y - e.y) || 1, s = Math.sin(Math.PI * a) * r;
	return {
		x: e.x + (t.x - e.x) * a - (t.y - e.y) / o * s,
		y: e.y + (t.y - e.y) * a + (t.x - e.x) / o * s
	};
}, j = (e, t) => {
	let n = e instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
	Object.getOwnPropertyDescriptor(n, "value").set.call(e, t), e.dispatchEvent(new Event("input", { bubbles: !0 })), e.setSelectionRange(t.length, t.length);
}, M = (e, t, n) => {
	let r = e.getBoundingClientRect(), i = t.getBoundingClientRect(), a = r.height / e.clientHeight, o = Number.parseFloat(getComputedStyle(t).lineHeight), s = n ? i.bottom - o * a : i.top;
	!n && i.height > r.height && i.top < r.bottom && i.bottom > r.top || (i.bottom > r.bottom ? e.scrollTop += (i.bottom - r.bottom + 8) / a : s < r.top && (e.scrollTop += (s - r.top - 8) / a));
}, N = (e, t) => {
	let n = e.querySelector("[data-tool-preview]"), r, i = 0, a = 0, o, s = () => {
		o?.target.removeAttribute("data-agent-owner"), o = void 0, r = void 0, i = 0, a = 0, delete e.dataset.assemblyAction;
	}, c = (e, t = !1) => {
		for (let r = e.parentElement; r && n.contains(r); r = r.parentElement) !r.clientHeight || r.scrollHeight <= r.clientHeight || ["visible", "clip"].includes(getComputedStyle(r).overflowY) || M(r, e, t);
	}, l = (t, r) => {
		let { left: i, right: a, top: o, bottom: s } = t.getBoundingClientRect();
		for (let e = t.parentElement; e && n.contains(e); e = e.parentElement) {
			if (getComputedStyle(e).overflow === "visible") continue;
			let t = e.getBoundingClientRect();
			i = Math.max(i, t.left), a = Math.min(a, t.right), o = Math.max(o, t.top), s = Math.min(s, t.bottom);
		}
		let c = new DOMPoint(r ? i + Math.min(30, (a - i) / 2) : (i + a) / 2, (o + s) / 2).matrixTransform(e.getScreenCTM().inverse());
		return {
			x: c.x - 5,
			y: c.y - 5
		};
	}, p = (e, t) => {
		if (e.action.kind !== "type") return;
		let n = e.action.edit === "shader" ? "\n// Codex: brighten the ribbon colours." : "-spark", r = Math.floor(n.length * Math.min(1, t));
		e.action.edit === "shader" && r > 0 && (r = Math.max(3, r));
		let i = e.initialText + n.slice(0, r);
		t >= 1 && e.action.edit === "shader" && (i = i.replace("glow * 0.55", "glow * 0.85"));
		let a = e.target;
		a.value !== i && j(a, i), e.action.edit === "shader" && c(a, !0);
	}, m = (e, r) => {
		if (r.kind === "cli") {
			let i = t[r.agent].element;
			i.querySelector("[data-cursor-command]").textContent = "$ ▍";
			let a = i.querySelector("[data-cursor-result]");
			a.textContent = "", a.removeAttribute("aria-label"), o = {
				action: r,
				target: n.firstElementChild,
				from: { ...t[r.agent].position },
				started: e,
				duration: d(r.command).length * 55 + 1600,
				phase: "act",
				initialText: "",
				applied: !1
			};
			return;
		}
		let i = n.querySelectorAll(r.selector)[r.index ?? 0];
		if (!i || i.hasAttribute("disabled")) return;
		c(i, r.kind === "type" && i instanceof HTMLTextAreaElement);
		let a = { ...t[r.agent].position }, s = l(i, !1);
		o = {
			action: r,
			target: i,
			from: a,
			started: e,
			duration: (700 + Math.hypot(a.x - s.x, a.y - s.y) * .5) * k,
			phase: "approach",
			initialText: "",
			applied: !1
		};
	}, h = (e, n, r) => {
		let i = t[e.action.agent];
		i.position = A(e.from, l(e.target, !1), r, 28), !(r < 1) && (e.phase = "act", e.started = n, e.duration = e.action.kind === "type" ? 2200 : 550, e.initialText = e.target.value ?? "", e.target.dataset.agentOwner = i.element.dataset.cursorName);
	}, g = (e, n, r) => {
		if (e.action.kind === "cli") {
			let r = d(e.action.command), i = Math.min(r.length, Math.floor((n - e.started) / 55)), a = t[e.action.agent].element, o = a.querySelector("[data-cursor-command]");
			if (o.textContent = `$ ${r.slice(0, i)}${i < r.length ? "▍" : ""}`, o.scrollLeft = i < r.length ? o.scrollWidth : 0, i === r.length && !e.applied) {
				e.applied = !0, e.target.dispatchEvent(new CustomEvent(f, { detail: e.action.command }));
				let t = a.querySelector("[data-cursor-result]");
				t.textContent = "✓", t.setAttribute("aria-label", u(e.action.command));
			}
		} else _(e, r);
		r < 1 || (e.target.removeAttribute("data-agent-owner"), o = void 0, i++, a = n + 600);
	}, _ = (e, n) => {
		let r = e.action.kind === "type";
		t[e.action.agent].position = l(e.target, r), r ? p(e, n) : n > .35 && !e.applied && (e.applied = !0, e.action.kind === "click" ? e.target.click() : e.action.kind === "key" && (e.target.dispatchEvent(new FocusEvent("focusin", { bubbles: !0 })), e.target.dispatchEvent(new KeyboardEvent("keydown", {
			key: e.action.key,
			bubbles: !0
		})), e.target.dispatchEvent(new FocusEvent("focusout", { bubbles: !0 }))));
	};
	return {
		update: (t, n, c) => {
			if (!n) {
				s();
				return;
			}
			r !== n && (s(), r = n, a = t + 700);
			let l = O[r];
			if (!o && i < l.length && t >= a) {
				let e = l[i];
				if (!c(e.agent)) return;
				m(t, e);
			}
			if (!o) return;
			let u = o, d = (t - u.started) / u.duration;
			return u.phase === "approach" ? h(u, t, d) : g(u, t, d), e.dataset.assemblyAction = `${r}:${i}:${u.phase}:${u.action.kind}`, u.action.agent;
		},
		mode: (e) => o?.action.agent !== e || o.phase !== "act" ? "pointer" : o.action.kind === "cli" ? "chat" : o.action.kind === "type" ? "text" : "pointer",
		pressed: (e) => !!(o?.action.agent === e && o.phase === "act" && ["click", "key"].includes(o.action.kind) && o.applied),
		done: () => !(!r || i !== O[r].length || o),
		reset: s
	};
}, P = /* @__PURE__ */ e((/* @__PURE__ */ t(((e, t, n) => {
	(function(n, r) {
		typeof e == "object" && typeof t == "object" ? t.exports = r() : typeof define == "function" && define.amd ? define("Matter", [], r) : typeof e == "object" ? e.Matter = r() : n.Matter = r();
	})(n, function() {
		return (function(e) {
			var t = {};
			function n(r) {
				if (t[r]) return t[r].exports;
				var i = t[r] = {
					i: r,
					l: !1,
					exports: {}
				};
				return e[r].call(i.exports, i, i.exports, n), i.l = !0, i.exports;
			}
			return n.m = e, n.c = t, n.d = function(e, t, r) {
				n.o(e, t) || Object.defineProperty(e, t, {
					enumerable: !0,
					get: r
				});
			}, n.r = function(e) {
				typeof Symbol < "u" && Symbol.toStringTag && Object.defineProperty(e, Symbol.toStringTag, { value: "Module" }), Object.defineProperty(e, "__esModule", { value: !0 });
			}, n.t = function(e, t) {
				if (t & 1 && (e = n(e)), t & 8 || t & 4 && typeof e == "object" && e && e.__esModule) return e;
				var r = Object.create(null);
				if (n.r(r), Object.defineProperty(r, "default", {
					enumerable: !0,
					value: e
				}), t & 2 && typeof e != "string") for (var i in e) n.d(r, i, function(t) {
					return e[t];
				}.bind(null, i));
				return r;
			}, n.n = function(e) {
				var t = e && e.__esModule ? function() {
					return e.default;
				} : function() {
					return e;
				};
				return n.d(t, "a", t), t;
			}, n.o = function(e, t) {
				return Object.prototype.hasOwnProperty.call(e, t);
			}, n.p = "", n(n.s = 20);
		})([
			(function(e, t) {
				var n = {};
				e.exports = n, (function() {
					n._baseDelta = 1e3 / 60, n._nextId = 0, n._seed = 0, n._nowStartTime = +/* @__PURE__ */ new Date(), n._warnedOnce = {}, n._decomp = null, n.extend = function(e, t) {
						var r, i;
						typeof t == "boolean" ? (r = 2, i = t) : (r = 1, i = !0);
						for (var a = r; a < arguments.length; a++) {
							var o = arguments[a];
							if (o) for (var s in o) i && o[s] && o[s].constructor === Object && (!e[s] || e[s].constructor === Object) ? (e[s] = e[s] || {}, n.extend(e[s], i, o[s])) : e[s] = o[s];
						}
						return e;
					}, n.clone = function(e, t) {
						return n.extend({}, t, e);
					}, n.keys = function(e) {
						if (Object.keys) return Object.keys(e);
						var t = [];
						for (var n in e) t.push(n);
						return t;
					}, n.values = function(e) {
						var t = [];
						if (Object.keys) {
							for (var n = Object.keys(e), r = 0; r < n.length; r++) t.push(e[n[r]]);
							return t;
						}
						for (var i in e) t.push(e[i]);
						return t;
					}, n.get = function(e, t, n, r) {
						t = t.split(".").slice(n, r);
						for (var i = 0; i < t.length; i += 1) e = e[t[i]];
						return e;
					}, n.set = function(e, t, r, i, a) {
						var o = t.split(".").slice(i, a);
						return n.get(e, t, 0, -1)[o[o.length - 1]] = r, r;
					}, n.shuffle = function(e) {
						for (var t = e.length - 1; t > 0; t--) {
							var r = Math.floor(n.random() * (t + 1)), i = e[t];
							e[t] = e[r], e[r] = i;
						}
						return e;
					}, n.choose = function(e) {
						return e[Math.floor(n.random() * e.length)];
					}, n.isElement = function(e) {
						return typeof HTMLElement < "u" ? e instanceof HTMLElement : !!(e && e.nodeType && e.nodeName);
					}, n.isArray = function(e) {
						return Object.prototype.toString.call(e) === "[object Array]";
					}, n.isFunction = function(e) {
						return typeof e == "function";
					}, n.isPlainObject = function(e) {
						return typeof e == "object" && e.constructor === Object;
					}, n.isString = function(e) {
						return toString.call(e) === "[object String]";
					}, n.clamp = function(e, t, n) {
						return e < t ? t : e > n ? n : e;
					}, n.sign = function(e) {
						return e < 0 ? -1 : 1;
					}, n.now = function() {
						if (typeof window < "u" && window.performance) {
							if (window.performance.now) return window.performance.now();
							if (window.performance.webkitNow) return window.performance.webkitNow();
						}
						return Date.now ? Date.now() : /* @__PURE__ */ new Date() - n._nowStartTime;
					}, n.random = function(t, n) {
						return t = t === void 0 ? 0 : t, n = n === void 0 ? 1 : n, t + e() * (n - t);
					};
					var e = function() {
						return n._seed = (n._seed * 9301 + 49297) % 233280, n._seed / 233280;
					};
					n.colorToNumber = function(e) {
						return e = e.replace("#", ""), e.length == 3 && (e = e.charAt(0) + e.charAt(0) + e.charAt(1) + e.charAt(1) + e.charAt(2) + e.charAt(2)), parseInt(e, 16);
					}, n.logLevel = 1, n.log = function() {
						console && n.logLevel > 0 && n.logLevel <= 3 && console.log.apply(console, ["matter-js:"].concat(Array.prototype.slice.call(arguments)));
					}, n.info = function() {
						console && n.logLevel > 0 && n.logLevel <= 2 && console.info.apply(console, ["matter-js:"].concat(Array.prototype.slice.call(arguments)));
					}, n.warn = function() {
						console && n.logLevel > 0 && n.logLevel <= 3 && console.warn.apply(console, ["matter-js:"].concat(Array.prototype.slice.call(arguments)));
					}, n.warnOnce = function() {
						var e = Array.prototype.slice.call(arguments).join(" ");
						n._warnedOnce[e] || (n.warn(e), n._warnedOnce[e] = !0);
					}, n.deprecated = function(e, t, r) {
						e[t] = n.chain(function() {
							n.warnOnce("🔅 deprecated 🔅", r);
						}, e[t]);
					}, n.nextId = function() {
						return n._nextId++;
					}, n.indexOf = function(e, t) {
						if (e.indexOf) return e.indexOf(t);
						for (var n = 0; n < e.length; n++) if (e[n] === t) return n;
						return -1;
					}, n.map = function(e, t) {
						if (e.map) return e.map(t);
						for (var n = [], r = 0; r < e.length; r += 1) n.push(t(e[r]));
						return n;
					}, n.topologicalSort = function(e) {
						var t = [], r = [], i = [];
						for (var a in e) !r[a] && !i[a] && n._topologicalSort(a, r, i, e, t);
						return t;
					}, n._topologicalSort = function(e, t, r, i, a) {
						var o = i[e] || [];
						r[e] = !0;
						for (var s = 0; s < o.length; s += 1) {
							var c = o[s];
							r[c] || t[c] || n._topologicalSort(c, t, r, i, a);
						}
						r[e] = !1, t[e] = !0, a.push(e);
					}, n.chain = function() {
						for (var e = [], t = 0; t < arguments.length; t += 1) {
							var n = arguments[t];
							n._chained ? e.push.apply(e, n._chained) : e.push(n);
						}
						var r = function() {
							for (var t, n = Array(arguments.length), r = 0, i = arguments.length; r < i; r++) n[r] = arguments[r];
							for (r = 0; r < e.length; r += 1) {
								var a = e[r].apply(t, n);
								a !== void 0 && (t = a);
							}
							return t;
						};
						return r._chained = e, r;
					}, n.chainPathBefore = function(e, t, r) {
						return n.set(e, t, n.chain(r, n.get(e, t)));
					}, n.chainPathAfter = function(e, t, r) {
						return n.set(e, t, n.chain(n.get(e, t), r));
					}, n.setDecomp = function(e) {
						n._decomp = e;
					}, n.getDecomp = function() {
						var e = n._decomp;
						try {
							!e && typeof window < "u" && (e = window.decomp), !e && typeof globalThis < "u" && (e = globalThis.decomp);
						} catch {
							e = null;
						}
						return e;
					};
				})();
			}),
			(function(e, t) {
				var n = {};
				e.exports = n, (function() {
					n.create = function(e) {
						var t = {
							min: {
								x: 0,
								y: 0
							},
							max: {
								x: 0,
								y: 0
							}
						};
						return e && n.update(t, e), t;
					}, n.update = function(e, t, n) {
						e.min.x = Infinity, e.max.x = -Infinity, e.min.y = Infinity, e.max.y = -Infinity;
						for (var r = 0; r < t.length; r++) {
							var i = t[r];
							i.x > e.max.x && (e.max.x = i.x), i.x < e.min.x && (e.min.x = i.x), i.y > e.max.y && (e.max.y = i.y), i.y < e.min.y && (e.min.y = i.y);
						}
						n && (n.x > 0 ? e.max.x += n.x : e.min.x += n.x, n.y > 0 ? e.max.y += n.y : e.min.y += n.y);
					}, n.contains = function(e, t) {
						return t.x >= e.min.x && t.x <= e.max.x && t.y >= e.min.y && t.y <= e.max.y;
					}, n.overlaps = function(e, t) {
						return e.min.x <= t.max.x && e.max.x >= t.min.x && e.max.y >= t.min.y && e.min.y <= t.max.y;
					}, n.translate = function(e, t) {
						e.min.x += t.x, e.max.x += t.x, e.min.y += t.y, e.max.y += t.y;
					}, n.shift = function(e, t) {
						var n = e.max.x - e.min.x, r = e.max.y - e.min.y;
						e.min.x = t.x, e.max.x = t.x + n, e.min.y = t.y, e.max.y = t.y + r;
					};
				})();
			}),
			(function(e, t) {
				var n = {};
				e.exports = n, (function() {
					n.create = function(e, t) {
						return {
							x: e || 0,
							y: t || 0
						};
					}, n.clone = function(e) {
						return {
							x: e.x,
							y: e.y
						};
					}, n.magnitude = function(e) {
						return Math.sqrt(e.x * e.x + e.y * e.y);
					}, n.magnitudeSquared = function(e) {
						return e.x * e.x + e.y * e.y;
					}, n.rotate = function(e, t, n) {
						var r = Math.cos(t), i = Math.sin(t);
						n ||= {};
						var a = e.x * r - e.y * i;
						return n.y = e.x * i + e.y * r, n.x = a, n;
					}, n.rotateAbout = function(e, t, n, r) {
						var i = Math.cos(t), a = Math.sin(t);
						r ||= {};
						var o = n.x + ((e.x - n.x) * i - (e.y - n.y) * a);
						return r.y = n.y + ((e.x - n.x) * a + (e.y - n.y) * i), r.x = o, r;
					}, n.normalise = function(e) {
						var t = n.magnitude(e);
						return t === 0 ? {
							x: 0,
							y: 0
						} : {
							x: e.x / t,
							y: e.y / t
						};
					}, n.dot = function(e, t) {
						return e.x * t.x + e.y * t.y;
					}, n.cross = function(e, t) {
						return e.x * t.y - e.y * t.x;
					}, n.cross3 = function(e, t, n) {
						return (t.x - e.x) * (n.y - e.y) - (t.y - e.y) * (n.x - e.x);
					}, n.add = function(e, t, n) {
						return n ||= {}, n.x = e.x + t.x, n.y = e.y + t.y, n;
					}, n.sub = function(e, t, n) {
						return n ||= {}, n.x = e.x - t.x, n.y = e.y - t.y, n;
					}, n.mult = function(e, t) {
						return {
							x: e.x * t,
							y: e.y * t
						};
					}, n.div = function(e, t) {
						return {
							x: e.x / t,
							y: e.y / t
						};
					}, n.perp = function(e, t) {
						return t = t === !0 ? -1 : 1, {
							x: t * -e.y,
							y: t * e.x
						};
					}, n.neg = function(e) {
						return {
							x: -e.x,
							y: -e.y
						};
					}, n.angle = function(e, t) {
						return Math.atan2(t.y - e.y, t.x - e.x);
					}, n._temp = [
						n.create(),
						n.create(),
						n.create(),
						n.create(),
						n.create(),
						n.create()
					];
				})();
			}),
			(function(e, t, n) {
				var r = {};
				e.exports = r;
				var i = n(2), a = n(0);
				(function() {
					r.create = function(e, t) {
						for (var n = [], r = 0; r < e.length; r++) {
							var i = e[r], a = {
								x: i.x,
								y: i.y,
								index: r,
								body: t,
								isInternal: !1
							};
							n.push(a);
						}
						return n;
					}, r.fromPath = function(e, t) {
						var n = /L?\s*([-\d.e]+)[\s,]*([-\d.e]+)*/gi, i = [];
						return e.replace(n, function(e, t, n) {
							i.push({
								x: parseFloat(t),
								y: parseFloat(n)
							});
						}), r.create(i, t);
					}, r.centre = function(e) {
						for (var t = r.area(e, !0), n = {
							x: 0,
							y: 0
						}, a, o, s, c = 0; c < e.length; c++) s = (c + 1) % e.length, a = i.cross(e[c], e[s]), o = i.mult(i.add(e[c], e[s]), a), n = i.add(n, o);
						return i.div(n, 6 * t);
					}, r.mean = function(e) {
						for (var t = {
							x: 0,
							y: 0
						}, n = 0; n < e.length; n++) t.x += e[n].x, t.y += e[n].y;
						return i.div(t, e.length);
					}, r.area = function(e, t) {
						for (var n = 0, r = e.length - 1, i = 0; i < e.length; i++) n += (e[r].x - e[i].x) * (e[r].y + e[i].y), r = i;
						return t ? n / 2 : Math.abs(n) / 2;
					}, r.inertia = function(e, t) {
						for (var n = 0, r = 0, a = e, o, s, c = 0; c < a.length; c++) s = (c + 1) % a.length, o = Math.abs(i.cross(a[s], a[c])), n += o * (i.dot(a[s], a[s]) + i.dot(a[s], a[c]) + i.dot(a[c], a[c])), r += o;
						return t / 6 * (n / r);
					}, r.translate = function(e, t, n) {
						n = n === void 0 ? 1 : n;
						for (var r = e.length, i = t.x * n, a = t.y * n, o = 0; o < r; o++) e[o].x += i, e[o].y += a;
						return e;
					}, r.rotate = function(e, t, n) {
						if (t !== 0) {
							for (var r = Math.cos(t), i = Math.sin(t), a = n.x, o = n.y, s = e.length, c, l, u, d = 0; d < s; d++) c = e[d], l = c.x - a, u = c.y - o, c.x = a + (l * r - u * i), c.y = o + (l * i + u * r);
							return e;
						}
					}, r.contains = function(e, t) {
						for (var n = t.x, r = t.y, i = e.length, a = e[i - 1], o, s = 0; s < i; s++) {
							if (o = e[s], (n - a.x) * (o.y - a.y) + (r - a.y) * (a.x - o.x) > 0) return !1;
							a = o;
						}
						return !0;
					}, r.scale = function(e, t, n, a) {
						if (t === 1 && n === 1) return e;
						a ||= r.centre(e);
						for (var o, s, c = 0; c < e.length; c++) o = e[c], s = i.sub(o, a), e[c].x = a.x + s.x * t, e[c].y = a.y + s.y * n;
						return e;
					}, r.chamfer = function(e, t, n, r, o) {
						typeof t == "number" ? t = [t] : t ||= [8], n = n === void 0 ? -1 : n, r ||= 2, o ||= 14;
						for (var s = [], c = 0; c < e.length; c++) {
							var l = e[c - 1 >= 0 ? c - 1 : e.length - 1], u = e[c], d = e[(c + 1) % e.length], f = t[c < t.length ? c : t.length - 1];
							if (f === 0) s.push(u);
							else {
								var p = i.normalise({
									x: u.y - l.y,
									y: l.x - u.x
								}), m = i.normalise({
									x: d.y - u.y,
									y: u.x - d.x
								}), h = Math.sqrt(2 * f ** 2), g = i.mult(a.clone(p), f), _ = i.normalise(i.mult(i.add(p, m), .5)), v = i.sub(u, i.mult(_, h)), y = n;
								n === -1 && (y = f ** .32 * 1.75), y = a.clamp(y, r, o), y % 2 == 1 && (y += 1);
								for (var b = Math.acos(i.dot(p, m)) / y, x = 0; x < y; x++) s.push(i.add(i.rotate(g, b * x), v));
							}
						}
						return s;
					}, r.clockwiseSort = function(e) {
						var t = r.mean(e);
						return e.sort(function(e, n) {
							return i.angle(t, e) - i.angle(t, n);
						}), e;
					}, r.isConvex = function(e) {
						var t = 0, n = e.length, r, i, a, o;
						if (n < 3) return null;
						for (r = 0; r < n; r++) if (i = (r + 1) % n, a = (r + 2) % n, o = (e[i].x - e[r].x) * (e[a].y - e[i].y), o -= (e[i].y - e[r].y) * (e[a].x - e[i].x), o < 0 ? t |= 1 : o > 0 && (t |= 2), t === 3) return !1;
						return t !== 0 || null;
					}, r.hull = function(e) {
						var t = [], n = [], r, a;
						for (e = e.slice(0), e.sort(function(e, t) {
							var n = e.x - t.x;
							return n === 0 ? e.y - t.y : n;
						}), a = 0; a < e.length; a += 1) {
							for (r = e[a]; n.length >= 2 && i.cross3(n[n.length - 2], n[n.length - 1], r) <= 0;) n.pop();
							n.push(r);
						}
						for (a = e.length - 1; a >= 0; --a) {
							for (r = e[a]; t.length >= 2 && i.cross3(t[t.length - 2], t[t.length - 1], r) <= 0;) t.pop();
							t.push(r);
						}
						return t.pop(), n.pop(), t.concat(n);
					};
				})();
			}),
			(function(e, t, n) {
				var r = {};
				e.exports = r;
				var i = n(3), a = n(2), o = n(7), s = n(0), c = n(1), l = n(11);
				(function() {
					r._timeCorrection = !0, r._inertiaScale = 4, r._nextCollidingGroupId = 1, r._nextNonCollidingGroupId = -1, r._nextCategory = 1, r._baseDelta = 1e3 / 60, r.create = function(t) {
						var n = {
							id: s.nextId(),
							type: "body",
							label: "Body",
							parts: [],
							plugin: {},
							angle: 0,
							vertices: i.fromPath("L 0 0 L 40 0 L 40 40 L 0 40"),
							position: {
								x: 0,
								y: 0
							},
							force: {
								x: 0,
								y: 0
							},
							torque: 0,
							positionImpulse: {
								x: 0,
								y: 0
							},
							constraintImpulse: {
								x: 0,
								y: 0,
								angle: 0
							},
							totalContacts: 0,
							speed: 0,
							angularSpeed: 0,
							velocity: {
								x: 0,
								y: 0
							},
							angularVelocity: 0,
							isSensor: !1,
							isStatic: !1,
							isSleeping: !1,
							motion: 0,
							sleepThreshold: 60,
							density: .001,
							restitution: 0,
							friction: .1,
							frictionStatic: .5,
							frictionAir: .01,
							collisionFilter: {
								category: 1,
								mask: 4294967295,
								group: 0
							},
							slop: .05,
							timeScale: 1,
							render: {
								visible: !0,
								opacity: 1,
								strokeStyle: null,
								fillStyle: null,
								lineWidth: null,
								sprite: {
									xScale: 1,
									yScale: 1,
									xOffset: 0,
									yOffset: 0
								}
							},
							events: null,
							bounds: null,
							chamfer: null,
							circleRadius: 0,
							positionPrev: null,
							anglePrev: 0,
							parent: null,
							axes: null,
							area: 0,
							mass: 0,
							inertia: 0,
							deltaTime: 1e3 / 60,
							_original: null
						}, r = s.extend(n, t);
						return e(r, t), r;
					}, r.nextGroup = function(e) {
						return e ? r._nextNonCollidingGroupId-- : r._nextCollidingGroupId++;
					}, r.nextCategory = function() {
						return r._nextCategory <<= 1, r._nextCategory;
					};
					var e = function(e, t) {
						t ||= {}, r.set(e, {
							bounds: e.bounds || c.create(e.vertices),
							positionPrev: e.positionPrev || a.clone(e.position),
							anglePrev: e.anglePrev || e.angle,
							vertices: e.vertices,
							parts: e.parts || [e],
							isStatic: e.isStatic,
							isSleeping: e.isSleeping,
							parent: e.parent || e
						}), i.rotate(e.vertices, e.angle, e.position), l.rotate(e.axes, e.angle), c.update(e.bounds, e.vertices, e.velocity), r.set(e, {
							axes: t.axes || e.axes,
							area: t.area || e.area,
							mass: t.mass || e.mass,
							inertia: t.inertia || e.inertia
						});
						var n = e.isStatic ? "#14151f" : s.choose([
							"#f19648",
							"#f5d259",
							"#f55a3c",
							"#063e7b",
							"#ececd1"
						]), o = e.isStatic ? "#555" : "#ccc", u = e.isStatic && e.render.fillStyle === null ? 1 : 0;
						e.render.fillStyle = e.render.fillStyle || n, e.render.strokeStyle = e.render.strokeStyle || o, e.render.lineWidth = e.render.lineWidth || u, e.render.sprite.xOffset += -(e.bounds.min.x - e.position.x) / (e.bounds.max.x - e.bounds.min.x), e.render.sprite.yOffset += -(e.bounds.min.y - e.position.y) / (e.bounds.max.y - e.bounds.min.y);
					};
					r.set = function(e, t, n) {
						for (var i in typeof t == "string" && (i = t, t = {}, t[i] = n), t) if (Object.prototype.hasOwnProperty.call(t, i)) switch (n = t[i], i) {
							case "isStatic":
								r.setStatic(e, n);
								break;
							case "isSleeping":
								o.set(e, n);
								break;
							case "mass":
								r.setMass(e, n);
								break;
							case "density":
								r.setDensity(e, n);
								break;
							case "inertia":
								r.setInertia(e, n);
								break;
							case "vertices":
								r.setVertices(e, n);
								break;
							case "position":
								r.setPosition(e, n);
								break;
							case "angle":
								r.setAngle(e, n);
								break;
							case "velocity":
								r.setVelocity(e, n);
								break;
							case "angularVelocity":
								r.setAngularVelocity(e, n);
								break;
							case "speed":
								r.setSpeed(e, n);
								break;
							case "angularSpeed":
								r.setAngularSpeed(e, n);
								break;
							case "parts":
								r.setParts(e, n);
								break;
							case "centre":
								r.setCentre(e, n);
								break;
							default: e[i] = n;
						}
					}, r.setStatic = function(e, t) {
						for (var n = 0; n < e.parts.length; n++) {
							var r = e.parts[n];
							t ? (r.isStatic || (r._original = {
								restitution: r.restitution,
								friction: r.friction,
								mass: r.mass,
								inertia: r.inertia,
								density: r.density,
								inverseMass: r.inverseMass,
								inverseInertia: r.inverseInertia
							}), r.restitution = 0, r.friction = 1, r.mass = r.inertia = r.density = Infinity, r.inverseMass = r.inverseInertia = 0, r.positionPrev.x = r.position.x, r.positionPrev.y = r.position.y, r.anglePrev = r.angle, r.angularVelocity = 0, r.speed = 0, r.angularSpeed = 0, r.motion = 0) : r._original &&= (r.restitution = r._original.restitution, r.friction = r._original.friction, r.mass = r._original.mass, r.inertia = r._original.inertia, r.density = r._original.density, r.inverseMass = r._original.inverseMass, r.inverseInertia = r._original.inverseInertia, null), r.isStatic = t;
						}
					}, r.setMass = function(e, t) {
						e.inertia = e.inertia / (e.mass / 6) * (t / 6), e.inverseInertia = 1 / e.inertia, e.mass = t, e.inverseMass = 1 / e.mass, e.density = e.mass / e.area;
					}, r.setDensity = function(e, t) {
						r.setMass(e, t * e.area), e.density = t;
					}, r.setInertia = function(e, t) {
						e.inertia = t, e.inverseInertia = 1 / e.inertia;
					}, r.setVertices = function(e, t) {
						e.vertices = t[0].body === e ? t : i.create(t, e), e.axes = l.fromVertices(e.vertices), e.area = i.area(e.vertices), r.setMass(e, e.density * e.area);
						var n = i.centre(e.vertices);
						i.translate(e.vertices, n, -1), r.setInertia(e, r._inertiaScale * i.inertia(e.vertices, e.mass)), i.translate(e.vertices, e.position), c.update(e.bounds, e.vertices, e.velocity);
					}, r.setParts = function(e, t, n) {
						var a;
						for (t = t.slice(0), e.parts.length = 0, e.parts.push(e), e.parent = e, a = 0; a < t.length; a++) {
							var o = t[a];
							o !== e && (o.parent = e, e.parts.push(o));
						}
						if (e.parts.length !== 1) {
							if (n = n === void 0 || n, n) {
								var s = [];
								for (a = 0; a < t.length; a++) s = s.concat(t[a].vertices);
								i.clockwiseSort(s);
								var c = i.hull(s), l = i.centre(c);
								r.setVertices(e, c), i.translate(e.vertices, l);
							}
							var u = r._totalProperties(e);
							e.area = u.area, e.parent = e, e.position.x = u.centre.x, e.position.y = u.centre.y, e.positionPrev.x = u.centre.x, e.positionPrev.y = u.centre.y, r.setMass(e, u.mass), r.setInertia(e, u.inertia), r.setPosition(e, u.centre);
						}
					}, r.setCentre = function(e, t, n) {
						n ? (e.positionPrev.x += t.x, e.positionPrev.y += t.y, e.position.x += t.x, e.position.y += t.y) : (e.positionPrev.x = t.x - (e.position.x - e.positionPrev.x), e.positionPrev.y = t.y - (e.position.y - e.positionPrev.y), e.position.x = t.x, e.position.y = t.y);
					}, r.setPosition = function(e, t, n) {
						var r = a.sub(t, e.position);
						n ? (e.positionPrev.x = e.position.x, e.positionPrev.y = e.position.y, e.velocity.x = r.x, e.velocity.y = r.y, e.speed = a.magnitude(r)) : (e.positionPrev.x += r.x, e.positionPrev.y += r.y);
						for (var o = 0; o < e.parts.length; o++) {
							var s = e.parts[o];
							s.position.x += r.x, s.position.y += r.y, i.translate(s.vertices, r), c.update(s.bounds, s.vertices, e.velocity);
						}
					}, r.setAngle = function(e, t, n) {
						var r = t - e.angle;
						n ? (e.anglePrev = e.angle, e.angularVelocity = r, e.angularSpeed = Math.abs(r)) : e.anglePrev += r;
						for (var o = 0; o < e.parts.length; o++) {
							var s = e.parts[o];
							s.angle += r, i.rotate(s.vertices, r, e.position), l.rotate(s.axes, r), c.update(s.bounds, s.vertices, e.velocity), o > 0 && a.rotateAbout(s.position, r, e.position, s.position);
						}
					}, r.setVelocity = function(e, t) {
						var n = e.deltaTime / r._baseDelta;
						e.positionPrev.x = e.position.x - t.x * n, e.positionPrev.y = e.position.y - t.y * n, e.velocity.x = (e.position.x - e.positionPrev.x) / n, e.velocity.y = (e.position.y - e.positionPrev.y) / n, e.speed = a.magnitude(e.velocity);
					}, r.getVelocity = function(e) {
						var t = r._baseDelta / e.deltaTime;
						return {
							x: (e.position.x - e.positionPrev.x) * t,
							y: (e.position.y - e.positionPrev.y) * t
						};
					}, r.getSpeed = function(e) {
						return a.magnitude(r.getVelocity(e));
					}, r.setSpeed = function(e, t) {
						r.setVelocity(e, a.mult(a.normalise(r.getVelocity(e)), t));
					}, r.setAngularVelocity = function(e, t) {
						var n = e.deltaTime / r._baseDelta;
						e.anglePrev = e.angle - t * n, e.angularVelocity = (e.angle - e.anglePrev) / n, e.angularSpeed = Math.abs(e.angularVelocity);
					}, r.getAngularVelocity = function(e) {
						return (e.angle - e.anglePrev) * r._baseDelta / e.deltaTime;
					}, r.getAngularSpeed = function(e) {
						return Math.abs(r.getAngularVelocity(e));
					}, r.setAngularSpeed = function(e, t) {
						r.setAngularVelocity(e, s.sign(r.getAngularVelocity(e)) * t);
					}, r.translate = function(e, t, n) {
						r.setPosition(e, a.add(e.position, t), n);
					}, r.rotate = function(e, t, n, i) {
						if (!n) r.setAngle(e, e.angle + t, i);
						else {
							var a = Math.cos(t), o = Math.sin(t), s = e.position.x - n.x, c = e.position.y - n.y;
							r.setPosition(e, {
								x: n.x + (s * a - c * o),
								y: n.y + (s * o + c * a)
							}, i), r.setAngle(e, e.angle + t, i);
						}
					}, r.scale = function(e, t, n, a) {
						var o = 0, s = 0;
						a ||= e.position;
						for (var u = 0; u < e.parts.length; u++) {
							var d = e.parts[u];
							i.scale(d.vertices, t, n, a), d.axes = l.fromVertices(d.vertices), d.area = i.area(d.vertices), r.setMass(d, e.density * d.area), i.translate(d.vertices, {
								x: -d.position.x,
								y: -d.position.y
							}), r.setInertia(d, r._inertiaScale * i.inertia(d.vertices, d.mass)), i.translate(d.vertices, {
								x: d.position.x,
								y: d.position.y
							}), u > 0 && (o += d.area, s += d.inertia), d.position.x = a.x + (d.position.x - a.x) * t, d.position.y = a.y + (d.position.y - a.y) * n, c.update(d.bounds, d.vertices, e.velocity);
						}
						e.parts.length > 1 && (e.area = o, e.isStatic || (r.setMass(e, e.density * o), r.setInertia(e, s))), e.circleRadius && (t === n ? e.circleRadius *= t : e.circleRadius = null);
					}, r.update = function(e, t) {
						t = (t === void 0 ? 1e3 / 60 : t) * e.timeScale;
						var n = t * t, o = r._timeCorrection ? t / (e.deltaTime || t) : 1, u = 1 - e.frictionAir * (t / s._baseDelta), d = (e.position.x - e.positionPrev.x) * o, f = (e.position.y - e.positionPrev.y) * o;
						e.velocity.x = d * u + e.force.x / e.mass * n, e.velocity.y = f * u + e.force.y / e.mass * n, e.positionPrev.x = e.position.x, e.positionPrev.y = e.position.y, e.position.x += e.velocity.x, e.position.y += e.velocity.y, e.deltaTime = t, e.angularVelocity = (e.angle - e.anglePrev) * u * o + e.torque / e.inertia * n, e.anglePrev = e.angle, e.angle += e.angularVelocity;
						for (var p = 0; p < e.parts.length; p++) {
							var m = e.parts[p];
							i.translate(m.vertices, e.velocity), p > 0 && (m.position.x += e.velocity.x, m.position.y += e.velocity.y), e.angularVelocity !== 0 && (i.rotate(m.vertices, e.angularVelocity, e.position), l.rotate(m.axes, e.angularVelocity), p > 0 && a.rotateAbout(m.position, e.angularVelocity, e.position, m.position)), c.update(m.bounds, m.vertices, e.velocity);
						}
					}, r.updateVelocities = function(e) {
						var t = r._baseDelta / e.deltaTime, n = e.velocity;
						n.x = (e.position.x - e.positionPrev.x) * t, n.y = (e.position.y - e.positionPrev.y) * t, e.speed = Math.sqrt(n.x * n.x + n.y * n.y), e.angularVelocity = (e.angle - e.anglePrev) * t, e.angularSpeed = Math.abs(e.angularVelocity);
					}, r.applyForce = function(e, t, n) {
						var r = {
							x: t.x - e.position.x,
							y: t.y - e.position.y
						};
						e.force.x += n.x, e.force.y += n.y, e.torque += r.x * n.y - r.y * n.x;
					}, r._totalProperties = function(e) {
						for (var t = {
							mass: 0,
							area: 0,
							inertia: 0,
							centre: {
								x: 0,
								y: 0
							}
						}, n = e.parts.length === 1 ? 0 : 1; n < e.parts.length; n++) {
							var r = e.parts[n], i = r.mass === Infinity ? 1 : r.mass;
							t.mass += i, t.area += r.area, t.inertia += r.inertia, t.centre = a.add(t.centre, a.mult(r.position, i));
						}
						return t.centre = a.div(t.centre, t.mass), t;
					};
				})();
			}),
			(function(e, t, n) {
				var r = {};
				e.exports = r;
				var i = n(0);
				(function() {
					r.on = function(e, t, n) {
						for (var r = t.split(" "), i, a = 0; a < r.length; a++) i = r[a], e.events = e.events || {}, e.events[i] = e.events[i] || [], e.events[i].push(n);
						return n;
					}, r.off = function(e, t, n) {
						if (!t) e.events = {};
						else {
							typeof t == "function" && (n = t, t = i.keys(e.events).join(" "));
							for (var r = t.split(" "), a = 0; a < r.length; a++) {
								var o = e.events[r[a]], s = [];
								if (n && o) for (var c = 0; c < o.length; c++) o[c] !== n && s.push(o[c]);
								e.events[r[a]] = s;
							}
						}
					}, r.trigger = function(e, t, n) {
						var r, a, o, s, c = e.events;
						if (c && i.keys(c).length > 0) {
							n ||= {}, r = t.split(" ");
							for (var l = 0; l < r.length; l++) if (a = r[l], o = c[a], o) {
								s = i.clone(n, !1), s.name = a, s.source = e;
								for (var u = 0; u < o.length; u++) o[u].apply(e, [s]);
							}
						}
					};
				})();
			}),
			(function(e, t, n) {
				var r = {};
				e.exports = r;
				var i = n(5), a = n(0), o = n(1), s = n(4);
				(function() {
					r.create = function(e) {
						return a.extend({
							id: a.nextId(),
							type: "composite",
							parent: null,
							isModified: !1,
							bodies: [],
							constraints: [],
							composites: [],
							label: "Composite",
							plugin: {},
							cache: {
								allBodies: null,
								allConstraints: null,
								allComposites: null
							}
						}, e);
					}, r.setModified = function(e, t, n, i) {
						if (e.isModified = t, t && e.cache && (e.cache.allBodies = null, e.cache.allConstraints = null, e.cache.allComposites = null), n && e.parent && r.setModified(e.parent, t, n, i), i) for (var a = 0; a < e.composites.length; a++) {
							var o = e.composites[a];
							r.setModified(o, t, n, i);
						}
					}, r.add = function(e, t) {
						var n = [].concat(t);
						i.trigger(e, "beforeAdd", { object: t });
						for (var o = 0; o < n.length; o++) {
							var s = n[o];
							switch (s.type) {
								case "body":
									if (s.parent !== s) {
										a.warn("Composite.add: skipped adding a compound body part (you must add its parent instead)");
										break;
									}
									r.addBody(e, s);
									break;
								case "constraint":
									r.addConstraint(e, s);
									break;
								case "composite":
									r.addComposite(e, s);
									break;
								case "mouseConstraint": r.addConstraint(e, s.constraint);
							}
						}
						return i.trigger(e, "afterAdd", { object: t }), e;
					}, r.remove = function(e, t, n) {
						var a = [].concat(t);
						i.trigger(e, "beforeRemove", { object: t });
						for (var o = 0; o < a.length; o++) {
							var s = a[o];
							switch (s.type) {
								case "body":
									r.removeBody(e, s, n);
									break;
								case "constraint":
									r.removeConstraint(e, s, n);
									break;
								case "composite":
									r.removeComposite(e, s, n);
									break;
								case "mouseConstraint": r.removeConstraint(e, s.constraint);
							}
						}
						return i.trigger(e, "afterRemove", { object: t }), e;
					}, r.addComposite = function(e, t) {
						return e.composites.push(t), t.parent = e, r.setModified(e, !0, !0, !1), e;
					}, r.removeComposite = function(e, t, n) {
						var i = a.indexOf(e.composites, t);
						if (i !== -1) {
							var o = r.allBodies(t);
							r.removeCompositeAt(e, i);
							for (var s = 0; s < o.length; s++) o[s].sleepCounter = 0;
						}
						if (n) for (var s = 0; s < e.composites.length; s++) r.removeComposite(e.composites[s], t, !0);
						return e;
					}, r.removeCompositeAt = function(e, t) {
						return e.composites.splice(t, 1), r.setModified(e, !0, !0, !1), e;
					}, r.addBody = function(e, t) {
						return e.bodies.push(t), r.setModified(e, !0, !0, !1), e;
					}, r.removeBody = function(e, t, n) {
						var i = a.indexOf(e.bodies, t);
						if (i !== -1 && (r.removeBodyAt(e, i), t.sleepCounter = 0), n) for (var o = 0; o < e.composites.length; o++) r.removeBody(e.composites[o], t, !0);
						return e;
					}, r.removeBodyAt = function(e, t) {
						return e.bodies.splice(t, 1), r.setModified(e, !0, !0, !1), e;
					}, r.addConstraint = function(e, t) {
						return e.constraints.push(t), r.setModified(e, !0, !0, !1), e;
					}, r.removeConstraint = function(e, t, n) {
						var i = a.indexOf(e.constraints, t);
						if (i !== -1 && r.removeConstraintAt(e, i), n) for (var o = 0; o < e.composites.length; o++) r.removeConstraint(e.composites[o], t, !0);
						return e;
					}, r.removeConstraintAt = function(e, t) {
						return e.constraints.splice(t, 1), r.setModified(e, !0, !0, !1), e;
					}, r.clear = function(e, t, n) {
						if (n) for (var i = 0; i < e.composites.length; i++) r.clear(e.composites[i], t, !0);
						return t ? e.bodies = e.bodies.filter(function(e) {
							return e.isStatic;
						}) : e.bodies.length = 0, e.constraints.length = 0, e.composites.length = 0, r.setModified(e, !0, !0, !1), e;
					}, r.allBodies = function(e) {
						if (e.cache && e.cache.allBodies) return e.cache.allBodies;
						for (var t = [].concat(e.bodies), n = 0; n < e.composites.length; n++) t = t.concat(r.allBodies(e.composites[n]));
						return e.cache && (e.cache.allBodies = t), t;
					}, r.allConstraints = function(e) {
						if (e.cache && e.cache.allConstraints) return e.cache.allConstraints;
						for (var t = [].concat(e.constraints), n = 0; n < e.composites.length; n++) t = t.concat(r.allConstraints(e.composites[n]));
						return e.cache && (e.cache.allConstraints = t), t;
					}, r.allComposites = function(e) {
						if (e.cache && e.cache.allComposites) return e.cache.allComposites;
						for (var t = [].concat(e.composites), n = 0; n < e.composites.length; n++) t = t.concat(r.allComposites(e.composites[n]));
						return e.cache && (e.cache.allComposites = t), t;
					}, r.get = function(e, t, n) {
						var i, a;
						switch (n) {
							case "body":
								i = r.allBodies(e);
								break;
							case "constraint":
								i = r.allConstraints(e);
								break;
							case "composite": i = r.allComposites(e).concat(e);
						}
						return i ? (a = i.filter(function(e) {
							return e.id.toString() === t.toString();
						}), a.length === 0 ? null : a[0]) : null;
					}, r.move = function(e, t, n) {
						return r.remove(e, t), r.add(n, t), e;
					}, r.rebase = function(e) {
						for (var t = r.allBodies(e).concat(r.allConstraints(e)).concat(r.allComposites(e)), n = 0; n < t.length; n++) t[n].id = a.nextId();
						return e;
					}, r.translate = function(e, t, n) {
						for (var i = n ? r.allBodies(e) : e.bodies, a = 0; a < i.length; a++) s.translate(i[a], t);
						return e;
					}, r.rotate = function(e, t, n, i) {
						for (var a = Math.cos(t), o = Math.sin(t), c = i ? r.allBodies(e) : e.bodies, l = 0; l < c.length; l++) {
							var u = c[l], d = u.position.x - n.x, f = u.position.y - n.y;
							s.setPosition(u, {
								x: n.x + (d * a - f * o),
								y: n.y + (d * o + f * a)
							}), s.rotate(u, t);
						}
						return e;
					}, r.scale = function(e, t, n, i, a) {
						for (var o = a ? r.allBodies(e) : e.bodies, c = 0; c < o.length; c++) {
							var l = o[c], u = l.position.x - i.x, d = l.position.y - i.y;
							s.setPosition(l, {
								x: i.x + u * t,
								y: i.y + d * n
							}), s.scale(l, t, n);
						}
						return e;
					}, r.bounds = function(e) {
						for (var t = r.allBodies(e), n = [], i = 0; i < t.length; i += 1) {
							var a = t[i];
							n.push(a.bounds.min, a.bounds.max);
						}
						return o.create(n);
					};
				})();
			}),
			(function(e, t, n) {
				var r = {};
				e.exports = r;
				var i = n(4), a = n(5), o = n(0);
				(function() {
					r._motionWakeThreshold = .18, r._motionSleepThreshold = .08, r._minBias = .9, r.update = function(e, t) {
						for (var n = t / o._baseDelta, a = r._motionSleepThreshold, s = 0; s < e.length; s++) {
							var c = e[s], l = i.getSpeed(c), u = i.getAngularSpeed(c), d = l * l + u * u;
							if (c.force.x !== 0 || c.force.y !== 0) r.set(c, !1);
							else {
								var f = Math.min(c.motion, d), p = Math.max(c.motion, d);
								c.motion = r._minBias * f + (1 - r._minBias) * p, c.sleepThreshold > 0 && c.motion < a ? (c.sleepCounter += 1, c.sleepCounter >= c.sleepThreshold / n && r.set(c, !0)) : c.sleepCounter > 0 && --c.sleepCounter;
							}
						}
					}, r.afterCollisions = function(e) {
						for (var t = r._motionSleepThreshold, n = 0; n < e.length; n++) {
							var i = e[n];
							if (i.isActive) {
								var a = i.collision, o = a.bodyA.parent, s = a.bodyB.parent;
								if (!(o.isSleeping && s.isSleeping || o.isStatic || s.isStatic) && (o.isSleeping || s.isSleeping)) {
									var c = o.isSleeping && !o.isStatic ? o : s, l = c === o ? s : o;
									!c.isStatic && l.motion > t && r.set(c, !1);
								}
							}
						}
					}, r.set = function(e, t) {
						var n = e.isSleeping;
						t ? (e.isSleeping = !0, e.sleepCounter = e.sleepThreshold, e.positionImpulse.x = 0, e.positionImpulse.y = 0, e.positionPrev.x = e.position.x, e.positionPrev.y = e.position.y, e.anglePrev = e.angle, e.speed = 0, e.angularSpeed = 0, e.motion = 0, n || a.trigger(e, "sleepStart")) : (e.isSleeping = !1, e.sleepCounter = 0, n && a.trigger(e, "sleepEnd"));
					};
				})();
			}),
			(function(e, t, n) {
				var r = {};
				e.exports = r;
				var i = n(3), a = n(9);
				(function() {
					var e = [], t = {
						overlap: 0,
						axis: null
					}, n = {
						overlap: 0,
						axis: null
					};
					r.create = function(e, t) {
						return {
							pair: null,
							collided: !1,
							bodyA: e,
							bodyB: t,
							parentA: e.parent,
							parentB: t.parent,
							depth: 0,
							normal: {
								x: 0,
								y: 0
							},
							tangent: {
								x: 0,
								y: 0
							},
							penetration: {
								x: 0,
								y: 0
							},
							supports: [null, null],
							supportCount: 0
						};
					}, r.collides = function(e, o, s) {
						if (r._overlapAxes(t, e.vertices, o.vertices, e.axes), t.overlap <= 0 || (r._overlapAxes(n, o.vertices, e.vertices, o.axes), n.overlap <= 0)) return null;
						var c = s && s.table[a.id(e, o)], l;
						c ? l = c.collision : (l = r.create(e, o), l.collided = !0, l.bodyA = e.id < o.id ? e : o, l.bodyB = e.id < o.id ? o : e, l.parentA = l.bodyA.parent, l.parentB = l.bodyB.parent), e = l.bodyA, o = l.bodyB;
						var u = t.overlap < n.overlap ? t : n, d = l.normal, f = l.tangent, p = l.penetration, m = l.supports, h = u.overlap, g = u.axis, _ = g.x, v = g.y, y = o.position.x - e.position.x, b = o.position.y - e.position.y;
						_ * y + v * b >= 0 && (_ = -_, v = -v), d.x = _, d.y = v, f.x = -v, f.y = _, p.x = _ * h, p.y = v * h, l.depth = h;
						var x = r._findSupports(e, o, d, 1), S = 0;
						if (i.contains(e.vertices, x[0]) && (m[S++] = x[0]), i.contains(e.vertices, x[1]) && (m[S++] = x[1]), S < 2) {
							var C = r._findSupports(o, e, d, -1);
							i.contains(o.vertices, C[0]) && (m[S++] = C[0]), S < 2 && i.contains(o.vertices, C[1]) && (m[S++] = C[1]);
						}
						return S === 0 && (m[S++] = x[0]), l.supportCount = S, l;
					}, r._overlapAxes = function(e, t, n, r) {
						for (var i = t.length, a = n.length, o = t[0].x, s = t[0].y, c = n[0].x, l = n[0].y, u = r.length, d = Number.MAX_VALUE, f = 0, p, m, h, g, _ = 0, v; _ < u; _++) {
							var y = r[_], b = y.x, x = y.y, S = o * b + s * x, C = c * b + l * x, w = S, T = C;
							for (v = 1; v < i; v += 1) g = t[v].x * b + t[v].y * x, g > w ? w = g : g < S && (S = g);
							for (v = 1; v < a; v += 1) g = n[v].x * b + n[v].y * x, g > T ? T = g : g < C && (C = g);
							if (m = w - C, h = T - S, p = m < h ? m : h, p < d && (d = p, f = _, p <= 0)) break;
						}
						e.axis = r[f], e.overlap = d;
					}, r._findSupports = function(t, n, r, i) {
						for (var a = n.vertices, o = a.length, s = t.position.x, c = t.position.y, l = r.x * i, u = r.y * i, d = a[0], f = d, p = l * (s - f.x) + u * (c - f.y), m, h, g = 1; g < o; g += 1) f = a[g], h = l * (s - f.x) + u * (c - f.y), h < p && (p = h, d = f);
						return m = a[(o + d.index - 1) % o], p = l * (s - m.x) + u * (c - m.y), f = a[(d.index + 1) % o], l * (s - f.x) + u * (c - f.y) < p ? (e[0] = d, e[1] = f, e) : (e[0] = d, e[1] = m, e);
					};
				})();
			}),
			(function(e, t, n) {
				var r = {};
				e.exports = r;
				var i = n(16);
				(function() {
					r.create = function(e, t) {
						var n = e.bodyA, a = e.bodyB, o = {
							id: r.id(n, a),
							bodyA: n,
							bodyB: a,
							collision: e,
							contacts: [i.create(), i.create()],
							contactCount: 0,
							separation: 0,
							isActive: !0,
							isSensor: n.isSensor || a.isSensor,
							timeCreated: t,
							timeUpdated: t,
							inverseMass: 0,
							friction: 0,
							frictionStatic: 0,
							restitution: 0,
							slop: 0
						};
						return r.update(o, e, t), o;
					}, r.update = function(e, t, n) {
						var r = t.supports, i = t.supportCount, a = e.contacts, o = t.parentA, s = t.parentB;
						e.isActive = !0, e.timeUpdated = n, e.collision = t, e.separation = t.depth, e.inverseMass = o.inverseMass + s.inverseMass, e.friction = o.friction < s.friction ? o.friction : s.friction, e.frictionStatic = o.frictionStatic > s.frictionStatic ? o.frictionStatic : s.frictionStatic, e.restitution = o.restitution > s.restitution ? o.restitution : s.restitution, e.slop = o.slop > s.slop ? o.slop : s.slop, e.contactCount = i, t.pair = e;
						var c = r[0], l = a[0], u = r[1], d = a[1];
						(d.vertex === c || l.vertex === u) && (a[1] = l, a[0] = l = d, d = a[1]), l.vertex = c, d.vertex = u;
					}, r.setActive = function(e, t, n) {
						t ? (e.isActive = !0, e.timeUpdated = n) : (e.isActive = !1, e.contactCount = 0);
					}, r.id = function(e, t) {
						return e.id < t.id ? e.id.toString(36) + ":" + t.id.toString(36) : t.id.toString(36) + ":" + e.id.toString(36);
					};
				})();
			}),
			(function(e, t, n) {
				var r = {};
				e.exports = r;
				var i = n(3), a = n(2), o = n(7), s = n(1), c = n(11), l = n(0);
				(function() {
					r._warming = .4, r._torqueDampen = 1, r._minLength = 1e-6, r.create = function(e) {
						var t = e;
						t.bodyA && !t.pointA && (t.pointA = {
							x: 0,
							y: 0
						}), t.bodyB && !t.pointB && (t.pointB = {
							x: 0,
							y: 0
						});
						var n = t.bodyA ? a.add(t.bodyA.position, t.pointA) : t.pointA, r = t.bodyB ? a.add(t.bodyB.position, t.pointB) : t.pointB, i = a.magnitude(a.sub(n, r));
						t.length = t.length === void 0 ? i : t.length, t.id = t.id || l.nextId(), t.label = t.label || "Constraint", t.type = "constraint", t.stiffness = t.stiffness || (t.length > 0 ? 1 : .7), t.damping = t.damping || 0, t.angularStiffness = t.angularStiffness || 0, t.angleA = t.bodyA ? t.bodyA.angle : t.angleA, t.angleB = t.bodyB ? t.bodyB.angle : t.angleB, t.plugin = {};
						var o = {
							visible: !0,
							lineWidth: 2,
							strokeStyle: "#ffffff",
							type: "line",
							anchors: !0
						};
						return t.length === 0 && t.stiffness > .1 ? (o.type = "pin", o.anchors = !1) : t.stiffness < .9 && (o.type = "spring"), t.render = l.extend(o, t.render), t;
					}, r.preSolveAll = function(e) {
						for (var t = 0; t < e.length; t += 1) {
							var n = e[t], r = n.constraintImpulse;
							n.isStatic || r.x === 0 && r.y === 0 && r.angle === 0 || (n.position.x += r.x, n.position.y += r.y, n.angle += r.angle);
						}
					}, r.solveAll = function(e, t) {
						for (var n = l.clamp(t / l._baseDelta, 0, 1), i = 0; i < e.length; i += 1) {
							var a = e[i], o = !a.bodyA || a.bodyA && a.bodyA.isStatic, s = !a.bodyB || a.bodyB && a.bodyB.isStatic;
							(o || s) && r.solve(e[i], n);
						}
						for (i = 0; i < e.length; i += 1) a = e[i], o = !a.bodyA || a.bodyA && a.bodyA.isStatic, s = !a.bodyB || a.bodyB && a.bodyB.isStatic, !o && !s && r.solve(e[i], n);
					}, r.solve = function(e, t) {
						var n = e.bodyA, i = e.bodyB, o = e.pointA, s = e.pointB;
						if (n || i) {
							n && !n.isStatic && (a.rotate(o, n.angle - e.angleA, o), e.angleA = n.angle), i && !i.isStatic && (a.rotate(s, i.angle - e.angleB, s), e.angleB = i.angle);
							var c = o, l = s;
							if (n && (c = a.add(n.position, o)), i && (l = a.add(i.position, s)), c && l) {
								var u = a.sub(c, l), d = a.magnitude(u);
								d < r._minLength && (d = r._minLength);
								var f = (d - e.length) / d, p = e.stiffness >= 1 || e.length === 0 ? e.stiffness * t : e.stiffness * t * t, m = e.damping * t, h = a.mult(u, f * p), g = (n ? n.inverseMass : 0) + (i ? i.inverseMass : 0), _ = g + ((n ? n.inverseInertia : 0) + (i ? i.inverseInertia : 0)), v, y, b, x, S;
								if (m > 0) {
									var C = a.create();
									b = a.div(u, d), S = a.sub(i && a.sub(i.position, i.positionPrev) || C, n && a.sub(n.position, n.positionPrev) || C), x = a.dot(b, S);
								}
								n && !n.isStatic && (y = n.inverseMass / g, n.constraintImpulse.x -= h.x * y, n.constraintImpulse.y -= h.y * y, n.position.x -= h.x * y, n.position.y -= h.y * y, m > 0 && (n.positionPrev.x -= m * b.x * x * y, n.positionPrev.y -= m * b.y * x * y), v = a.cross(o, h) / _ * r._torqueDampen * n.inverseInertia * (1 - e.angularStiffness), n.constraintImpulse.angle -= v, n.angle -= v), i && !i.isStatic && (y = i.inverseMass / g, i.constraintImpulse.x += h.x * y, i.constraintImpulse.y += h.y * y, i.position.x += h.x * y, i.position.y += h.y * y, m > 0 && (i.positionPrev.x += m * b.x * x * y, i.positionPrev.y += m * b.y * x * y), v = a.cross(s, h) / _ * r._torqueDampen * i.inverseInertia * (1 - e.angularStiffness), i.constraintImpulse.angle += v, i.angle += v);
							}
						}
					}, r.postSolveAll = function(e) {
						for (var t = 0; t < e.length; t++) {
							var n = e[t], l = n.constraintImpulse;
							if (!(n.isStatic || l.x === 0 && l.y === 0 && l.angle === 0)) {
								o.set(n, !1);
								for (var u = 0; u < n.parts.length; u++) {
									var d = n.parts[u];
									i.translate(d.vertices, l), u > 0 && (d.position.x += l.x, d.position.y += l.y), l.angle !== 0 && (i.rotate(d.vertices, l.angle, n.position), c.rotate(d.axes, l.angle), u > 0 && a.rotateAbout(d.position, l.angle, n.position, d.position)), s.update(d.bounds, d.vertices, n.velocity);
								}
								l.angle *= r._warming, l.x *= r._warming, l.y *= r._warming;
							}
						}
					}, r.pointAWorld = function(e) {
						return {
							x: (e.bodyA ? e.bodyA.position.x : 0) + (e.pointA ? e.pointA.x : 0),
							y: (e.bodyA ? e.bodyA.position.y : 0) + (e.pointA ? e.pointA.y : 0)
						};
					}, r.pointBWorld = function(e) {
						return {
							x: (e.bodyB ? e.bodyB.position.x : 0) + (e.pointB ? e.pointB.x : 0),
							y: (e.bodyB ? e.bodyB.position.y : 0) + (e.pointB ? e.pointB.y : 0)
						};
					}, r.currentLength = function(e) {
						var t = (e.bodyA ? e.bodyA.position.x : 0) + (e.pointA ? e.pointA.x : 0), n = (e.bodyA ? e.bodyA.position.y : 0) + (e.pointA ? e.pointA.y : 0), r = (e.bodyB ? e.bodyB.position.x : 0) + (e.pointB ? e.pointB.x : 0), i = (e.bodyB ? e.bodyB.position.y : 0) + (e.pointB ? e.pointB.y : 0), a = t - r, o = n - i;
						return Math.sqrt(a * a + o * o);
					};
				})();
			}),
			(function(e, t, n) {
				var r = {};
				e.exports = r;
				var i = n(2), a = n(0);
				(function() {
					r.fromVertices = function(e) {
						for (var t = {}, n = 0; n < e.length; n++) {
							var r = (n + 1) % e.length, o = i.normalise({
								x: e[r].y - e[n].y,
								y: e[n].x - e[r].x
							}), s = o.y === 0 ? Infinity : o.x / o.y;
							s = s.toFixed(3).toString(), t[s] = o;
						}
						return a.values(t);
					}, r.rotate = function(e, t) {
						if (t !== 0) for (var n = Math.cos(t), r = Math.sin(t), i = 0; i < e.length; i++) {
							var a = e[i], o = a.x * n - a.y * r;
							a.y = a.x * r + a.y * n, a.x = o;
						}
					};
				})();
			}),
			(function(e, t, n) {
				var r = {};
				e.exports = r;
				var i = n(3), a = n(0), o = n(4), s = n(1), c = n(2);
				(function() {
					r.rectangle = function(e, t, n, r, s) {
						s ||= {};
						var c = {
							label: "Rectangle Body",
							position: {
								x: e,
								y: t
							},
							vertices: i.fromPath("L 0 0 L " + n + " 0 L " + n + " " + r + " L 0 " + r)
						};
						if (s.chamfer) {
							var l = s.chamfer;
							c.vertices = i.chamfer(c.vertices, l.radius, l.quality, l.qualityMin, l.qualityMax), delete s.chamfer;
						}
						return o.create(a.extend({}, c, s));
					}, r.trapezoid = function(e, t, n, r, s, c) {
						c ||= {}, s >= 1 && a.warn("Bodies.trapezoid: slope parameter must be < 1."), s *= .5;
						var l = (1 - s * 2) * n, u = n * s, d = u + l, f = d + u, p = s < .5 ? "L 0 0 L " + u + " " + -r + " L " + d + " " + -r + " L " + f + " 0" : "L 0 0 L " + d + " " + -r + " L " + f + " 0", m = {
							label: "Trapezoid Body",
							position: {
								x: e,
								y: t
							},
							vertices: i.fromPath(p)
						};
						if (c.chamfer) {
							var h = c.chamfer;
							m.vertices = i.chamfer(m.vertices, h.radius, h.quality, h.qualityMin, h.qualityMax), delete c.chamfer;
						}
						return o.create(a.extend({}, m, c));
					}, r.circle = function(e, t, n, i, o) {
						i ||= {};
						var s = {
							label: "Circle Body",
							circleRadius: n
						};
						o ||= 25;
						var c = Math.ceil(Math.max(10, Math.min(o, n)));
						return c % 2 == 1 && (c += 1), r.polygon(e, t, c, n, a.extend({}, s, i));
					}, r.polygon = function(e, t, n, s, c) {
						if (c ||= {}, n < 3) return r.circle(e, t, s, c);
						for (var l = 2 * Math.PI / n, u = "", d = l * .5, f = 0; f < n; f += 1) {
							var p = d + f * l, m = Math.cos(p) * s, h = Math.sin(p) * s;
							u += "L " + m.toFixed(3) + " " + h.toFixed(3) + " ";
						}
						var g = {
							label: "Polygon Body",
							position: {
								x: e,
								y: t
							},
							vertices: i.fromPath(u)
						};
						if (c.chamfer) {
							var _ = c.chamfer;
							g.vertices = i.chamfer(g.vertices, _.radius, _.quality, _.qualityMin, _.qualityMax), delete c.chamfer;
						}
						return o.create(a.extend({}, g, c));
					}, r.fromVertices = function(e, t, n, r, l, u, d, f) {
						var p = a.getDecomp(), m = !!(p && p.quickDecomp), h, g, _, v, y, b, x, S, C, w;
						for (r ||= {}, g = [], l = l !== void 0 && l, u = u === void 0 ? .01 : u, d = d === void 0 ? 10 : d, f = f === void 0 ? .01 : f, a.isArray(n[0]) || (n = [n]), C = 0; C < n.length; C += 1) if (y = n[C], _ = i.isConvex(y), v = !_, v && !m && a.warnOnce("Bodies.fromVertices: Install the 'poly-decomp' library and use Common.setDecomp or provide 'decomp' as a global to decompose concave vertices."), _ || !m) y = _ ? i.clockwiseSort(y) : i.hull(y), g.push({
							position: {
								x: e,
								y: t
							},
							vertices: y
						});
						else {
							var T = y.map(function(e) {
								return [e.x, e.y];
							});
							p.makeCCW(T), u !== !1 && p.removeCollinearPoints(T, u), f !== !1 && p.removeDuplicatePoints && p.removeDuplicatePoints(T, f);
							var E = p.quickDecomp(T);
							for (b = 0; b < E.length; b++) {
								var D = E[b].map(function(e) {
									return {
										x: e[0],
										y: e[1]
									};
								});
								d > 0 && i.area(D) < d || g.push({
									position: i.centre(D),
									vertices: D
								});
							}
						}
						for (b = 0; b < g.length; b++) g[b] = o.create(a.extend(g[b], r));
						if (l) {
							var O = 5;
							for (b = 0; b < g.length; b++) {
								var k = g[b];
								for (x = b + 1; x < g.length; x++) {
									var A = g[x];
									if (s.overlaps(k.bounds, A.bounds)) {
										var j = k.vertices, M = A.vertices;
										for (S = 0; S < k.vertices.length; S++) for (w = 0; w < A.vertices.length; w++) {
											var N = c.magnitudeSquared(c.sub(j[(S + 1) % j.length], M[w])), P = c.magnitudeSquared(c.sub(j[S], M[(w + 1) % M.length]));
											N < O && P < O && (j[S].isInternal = !0, M[w].isInternal = !0);
										}
									}
								}
							}
						}
						return g.length > 1 ? (h = o.create(a.extend({ parts: g.slice(0) }, r)), o.setPosition(h, {
							x: e,
							y: t
						}), h) : g[0];
					};
				})();
			}),
			(function(e, t, n) {
				var r = {};
				e.exports = r;
				var i = n(0), a = n(8);
				(function() {
					r.create = function(e) {
						return i.extend({
							bodies: [],
							collisions: [],
							pairs: null
						}, e);
					}, r.setBodies = function(e, t) {
						e.bodies = t.slice(0);
					}, r.clear = function(e) {
						e.bodies = [], e.collisions = [];
					}, r.collisions = function(e) {
						var t = e.pairs, n = e.bodies, i = n.length, o = r.canCollide, s = a.collides, c = e.collisions, l = 0, u, d;
						for (n.sort(r._compareBoundsX), u = 0; u < i; u++) {
							var f = n[u], p = f.bounds, m = f.bounds.max.x, h = f.bounds.max.y, g = f.bounds.min.y, _ = f.isStatic || f.isSleeping, v = f.parts.length, y = v === 1;
							for (d = u + 1; d < i; d++) {
								var b = n[d], x = b.bounds;
								if (x.min.x > m) break;
								if (!(h < x.min.y || g > x.max.y) && !(_ && (b.isStatic || b.isSleeping)) && o(f.collisionFilter, b.collisionFilter)) {
									var S = b.parts.length;
									if (y && S === 1) {
										var C = s(f, b, t);
										C && (c[l++] = C);
									} else for (var w = +(v > 1), T = +(S > 1), E = w; E < v; E++) for (var D = f.parts[E], p = D.bounds, O = T; O < S; O++) {
										var k = b.parts[O], x = k.bounds;
										if (!(p.min.x > x.max.x || p.max.x < x.min.x || p.max.y < x.min.y || p.min.y > x.max.y)) {
											var C = s(D, k, t);
											C && (c[l++] = C);
										}
									}
								}
							}
						}
						return c.length !== l && (c.length = l), c;
					}, r.canCollide = function(e, t) {
						return e.group === t.group && e.group !== 0 ? e.group > 0 : (e.mask & t.category) !== 0 && (t.mask & e.category) !== 0;
					}, r._compareBoundsX = function(e, t) {
						return e.bounds.min.x - t.bounds.min.x;
					};
				})();
			}),
			(function(e, t, n) {
				var r = {};
				e.exports = r;
				var i = n(0);
				(function() {
					r.create = function(e) {
						var t = {};
						return e || i.log("Mouse.create: element was undefined, defaulting to document.body", "warn"), t.element = e || document.body, t.absolute = {
							x: 0,
							y: 0
						}, t.position = {
							x: 0,
							y: 0
						}, t.mousedownPosition = {
							x: 0,
							y: 0
						}, t.mouseupPosition = {
							x: 0,
							y: 0
						}, t.offset = {
							x: 0,
							y: 0
						}, t.scale = {
							x: 1,
							y: 1
						}, t.wheelDelta = 0, t.button = -1, t.pixelRatio = parseInt(t.element.getAttribute("data-pixel-ratio"), 10) || 1, t.sourceEvents = {
							mousemove: null,
							mousedown: null,
							mouseup: null,
							mousewheel: null
						}, t.mousemove = function(e) {
							var n = r._getRelativeMousePosition(e, t.element, t.pixelRatio);
							e.changedTouches && (t.button = 0, e.preventDefault()), t.absolute.x = n.x, t.absolute.y = n.y, t.position.x = t.absolute.x * t.scale.x + t.offset.x, t.position.y = t.absolute.y * t.scale.y + t.offset.y, t.sourceEvents.mousemove = e;
						}, t.mousedown = function(e) {
							var n = r._getRelativeMousePosition(e, t.element, t.pixelRatio);
							e.changedTouches ? (t.button = 0, e.preventDefault()) : t.button = e.button, t.absolute.x = n.x, t.absolute.y = n.y, t.position.x = t.absolute.x * t.scale.x + t.offset.x, t.position.y = t.absolute.y * t.scale.y + t.offset.y, t.mousedownPosition.x = t.position.x, t.mousedownPosition.y = t.position.y, t.sourceEvents.mousedown = e;
						}, t.mouseup = function(e) {
							var n = r._getRelativeMousePosition(e, t.element, t.pixelRatio);
							e.changedTouches && e.preventDefault(), t.button = -1, t.absolute.x = n.x, t.absolute.y = n.y, t.position.x = t.absolute.x * t.scale.x + t.offset.x, t.position.y = t.absolute.y * t.scale.y + t.offset.y, t.mouseupPosition.x = t.position.x, t.mouseupPosition.y = t.position.y, t.sourceEvents.mouseup = e;
						}, t.mousewheel = function(e) {
							t.wheelDelta = Math.max(-1, Math.min(1, e.wheelDelta || -e.detail)), e.preventDefault(), t.sourceEvents.mousewheel = e;
						}, r.setElement(t, t.element), t;
					}, r.setElement = function(e, t) {
						e.element = t, t.addEventListener("mousemove", e.mousemove, { passive: !0 }), t.addEventListener("mousedown", e.mousedown, { passive: !0 }), t.addEventListener("mouseup", e.mouseup, { passive: !0 }), t.addEventListener("wheel", e.mousewheel, { passive: !1 }), t.addEventListener("touchmove", e.mousemove, { passive: !1 }), t.addEventListener("touchstart", e.mousedown, { passive: !1 }), t.addEventListener("touchend", e.mouseup, { passive: !1 });
					}, r.clearSourceEvents = function(e) {
						e.sourceEvents.mousemove = null, e.sourceEvents.mousedown = null, e.sourceEvents.mouseup = null, e.sourceEvents.mousewheel = null, e.wheelDelta = 0;
					}, r.setOffset = function(e, t) {
						e.offset.x = t.x, e.offset.y = t.y, e.position.x = e.absolute.x * e.scale.x + e.offset.x, e.position.y = e.absolute.y * e.scale.y + e.offset.y;
					}, r.setScale = function(e, t) {
						e.scale.x = t.x, e.scale.y = t.y, e.position.x = e.absolute.x * e.scale.x + e.offset.x, e.position.y = e.absolute.y * e.scale.y + e.offset.y;
					}, r._getRelativeMousePosition = function(e, t, n) {
						var r = t.getBoundingClientRect(), i = document.documentElement || document.body.parentNode || document.body, a = window.pageXOffset === void 0 ? i.scrollLeft : window.pageXOffset, o = window.pageYOffset === void 0 ? i.scrollTop : window.pageYOffset, s = e.changedTouches, c, l;
						return s ? (c = s[0].pageX - r.left - a, l = s[0].pageY - r.top - o) : (c = e.pageX - r.left - a, l = e.pageY - r.top - o), {
							x: c / (t.clientWidth / (t.width || t.clientWidth) * n),
							y: l / (t.clientHeight / (t.height || t.clientHeight) * n)
						};
					};
				})();
			}),
			(function(e, t, n) {
				var r = {};
				e.exports = r;
				var i = n(0);
				(function() {
					r._registry = {}, r.register = function(e) {
						if (r.isPlugin(e) || i.warn("Plugin.register:", r.toString(e), "does not implement all required fields."), e.name in r._registry) {
							var t = r._registry[e.name], n = r.versionParse(e.version).number, a = r.versionParse(t.version).number;
							n > a ? (i.warn("Plugin.register:", r.toString(t), "was upgraded to", r.toString(e)), r._registry[e.name] = e) : n < a ? i.warn("Plugin.register:", r.toString(t), "can not be downgraded to", r.toString(e)) : e !== t && i.warn("Plugin.register:", r.toString(e), "is already registered to different plugin object");
						} else r._registry[e.name] = e;
						return e;
					}, r.resolve = function(e) {
						return r._registry[r.dependencyParse(e).name];
					}, r.toString = function(e) {
						return typeof e == "string" ? e : (e.name || "anonymous") + "@" + (e.version || e.range || "0.0.0");
					}, r.isPlugin = function(e) {
						return e && e.name && e.version && e.install;
					}, r.isUsed = function(e, t) {
						return e.used.indexOf(t) > -1;
					}, r.isFor = function(e, t) {
						var n = e.for && r.dependencyParse(e.for);
						return !e.for || t.name === n.name && r.versionSatisfies(t.version, n.range);
					}, r.use = function(e, t) {
						if (e.uses = (e.uses || []).concat(t || []), e.uses.length === 0) i.warn("Plugin.use:", r.toString(e), "does not specify any dependencies to install.");
						else {
							for (var n = r.dependencies(e), a = i.topologicalSort(n), o = [], s = 0; s < a.length; s += 1) if (a[s] !== e.name) {
								var c = r.resolve(a[s]);
								c ? r.isUsed(e, c.name) || (r.isFor(c, e) || (i.warn("Plugin.use:", r.toString(c), "is for", c.for, "but installed on", r.toString(e) + "."), c._warned = !0), c.install ? c.install(e) : (i.warn("Plugin.use:", r.toString(c), "does not specify an install function."), c._warned = !0), c._warned ? (o.push("🔶 " + r.toString(c)), delete c._warned) : o.push("✅ " + r.toString(c)), e.used.push(c.name)) : o.push("❌ " + a[s]);
							}
							o.length > 0 && i.info(o.join("  "));
						}
					}, r.dependencies = function(e, t) {
						var n = r.dependencyParse(e), a = n.name;
						if (t ||= {}, !(a in t)) {
							e = r.resolve(e) || e, t[a] = i.map(e.uses || [], function(t) {
								r.isPlugin(t) && r.register(t);
								var a = r.dependencyParse(t), o = r.resolve(t);
								return o && !r.versionSatisfies(o.version, a.range) ? (i.warn("Plugin.dependencies:", r.toString(o), "does not satisfy", r.toString(a), "used by", r.toString(n) + "."), o._warned = !0, e._warned = !0) : o || (i.warn("Plugin.dependencies:", r.toString(t), "used by", r.toString(n), "could not be resolved."), e._warned = !0), a.name;
							});
							for (var o = 0; o < t[a].length; o += 1) r.dependencies(t[a][o], t);
							return t;
						}
					}, r.dependencyParse = function(e) {
						return i.isString(e) ? (/^[\w-]+(@(\*|[\^~]?\d+\.\d+\.\d+(-[0-9A-Za-z-+]+)?))?$/.test(e) || i.warn("Plugin.dependencyParse:", e, "is not a valid dependency string."), {
							name: e.split("@")[0],
							range: e.split("@")[1] || "*"
						}) : {
							name: e.name,
							range: e.range || e.version
						};
					}, r.versionParse = function(e) {
						var t = /^(\*)|(\^|~|>=|>)?\s*((\d+)\.(\d+)\.(\d+))(-[0-9A-Za-z-+]+)?$/;
						t.test(e) || i.warn("Plugin.versionParse:", e, "is not a valid version or range.");
						var n = t.exec(e), r = Number(n[4]), a = Number(n[5]), o = Number(n[6]);
						return {
							isRange: !!(n[1] || n[2]),
							version: n[3],
							range: e,
							operator: n[1] || n[2] || "",
							major: r,
							minor: a,
							patch: o,
							parts: [
								r,
								a,
								o
							],
							prerelease: n[7],
							number: r * 1e8 + a * 1e4 + o
						};
					}, r.versionSatisfies = function(e, t) {
						t ||= "*";
						var n = r.versionParse(t), i = r.versionParse(e);
						if (n.isRange) {
							if (n.operator === "*" || e === "*") return !0;
							if (n.operator === ">") return i.number > n.number;
							if (n.operator === ">=") return i.number >= n.number;
							if (n.operator === "~") return i.major === n.major && i.minor === n.minor && i.patch >= n.patch;
							if (n.operator === "^") return n.major > 0 ? i.major === n.major && i.number >= n.number : n.minor > 0 ? i.minor === n.minor && i.patch >= n.patch : i.patch === n.patch;
						}
						return e === t || e === "*";
					};
				})();
			}),
			(function(e, t) {
				var n = {};
				e.exports = n, (function() {
					n.create = function(e) {
						return {
							vertex: e,
							normalImpulse: 0,
							tangentImpulse: 0
						};
					};
				})();
			}),
			(function(e, t, n) {
				var r = {};
				e.exports = r;
				var i = n(7), a = n(18), o = n(13), s = n(19), c = n(5), l = n(6), u = n(10), d = n(0), f = n(4);
				(function() {
					r._deltaMax = 1e3 / 60, r.create = function(e) {
						e ||= {};
						var t = d.extend({
							positionIterations: 6,
							velocityIterations: 4,
							constraintIterations: 2,
							enableSleeping: !1,
							events: [],
							plugin: {},
							gravity: {
								x: 0,
								y: 1,
								scale: .001
							},
							timing: {
								timestamp: 0,
								timeScale: 1,
								lastDelta: 0,
								lastElapsed: 0,
								lastUpdatesPerFrame: 0
							}
						}, e);
						return t.world = e.world || l.create({ label: "World" }), t.pairs = e.pairs || s.create(), t.detector = e.detector || o.create(), t.detector.pairs = t.pairs, t.grid = { buckets: [] }, t.world.gravity = t.gravity, t.broadphase = t.grid, t.metrics = {}, t;
					}, r.update = function(e, t) {
						var n = d.now(), f = e.world, p = e.detector, m = e.pairs, h = e.timing, g = h.timestamp, _;
						t > r._deltaMax && d.warnOnce("Matter.Engine.update: delta argument is recommended to be less than or equal to", r._deltaMax.toFixed(3), "ms."), t = t === void 0 ? d._baseDelta : t, t *= h.timeScale, h.timestamp += t, h.lastDelta = t;
						var v = {
							timestamp: h.timestamp,
							delta: t
						};
						c.trigger(e, "beforeUpdate", v);
						var y = l.allBodies(f), b = l.allConstraints(f);
						for (f.isModified && (o.setBodies(p, y), l.setModified(f, !1, !1, !0)), e.enableSleeping && i.update(y, t), r._bodiesApplyGravity(y, e.gravity), t > 0 && r._bodiesUpdate(y, t), c.trigger(e, "beforeSolve", v), u.preSolveAll(y), _ = 0; _ < e.constraintIterations; _++) u.solveAll(b, t);
						u.postSolveAll(y);
						var x = o.collisions(p);
						s.update(m, x, g), e.enableSleeping && i.afterCollisions(m.list), m.collisionStart.length > 0 && c.trigger(e, "collisionStart", {
							pairs: m.collisionStart,
							timestamp: h.timestamp,
							delta: t
						});
						var S = d.clamp(20 / e.positionIterations, 0, 1);
						for (a.preSolvePosition(m.list), _ = 0; _ < e.positionIterations; _++) a.solvePosition(m.list, t, S);
						for (a.postSolvePosition(y), u.preSolveAll(y), _ = 0; _ < e.constraintIterations; _++) u.solveAll(b, t);
						for (u.postSolveAll(y), a.preSolveVelocity(m.list), _ = 0; _ < e.velocityIterations; _++) a.solveVelocity(m.list, t);
						return r._bodiesUpdateVelocities(y), m.collisionActive.length > 0 && c.trigger(e, "collisionActive", {
							pairs: m.collisionActive,
							timestamp: h.timestamp,
							delta: t
						}), m.collisionEnd.length > 0 && c.trigger(e, "collisionEnd", {
							pairs: m.collisionEnd,
							timestamp: h.timestamp,
							delta: t
						}), r._bodiesClearForces(y), c.trigger(e, "afterUpdate", v), e.timing.lastElapsed = d.now() - n, e;
					}, r.merge = function(e, t) {
						if (d.extend(e, t), t.world) {
							e.world = t.world, r.clear(e);
							for (var n = l.allBodies(e.world), a = 0; a < n.length; a++) {
								var o = n[a];
								i.set(o, !1), o.id = d.nextId();
							}
						}
					}, r.clear = function(e) {
						s.clear(e.pairs), o.clear(e.detector);
					}, r._bodiesClearForces = function(e) {
						for (var t = e.length, n = 0; n < t; n++) {
							var r = e[n];
							r.force.x = 0, r.force.y = 0, r.torque = 0;
						}
					}, r._bodiesApplyGravity = function(e, t) {
						var n = t.scale === void 0 ? .001 : t.scale, r = e.length;
						if (!(t.x === 0 && t.y === 0 || n === 0)) for (var i = 0; i < r; i++) {
							var a = e[i];
							a.isStatic || a.isSleeping || (a.force.y += a.mass * t.y * n, a.force.x += a.mass * t.x * n);
						}
					}, r._bodiesUpdate = function(e, t) {
						for (var n = e.length, r = 0; r < n; r++) {
							var i = e[r];
							i.isStatic || i.isSleeping || f.update(i, t);
						}
					}, r._bodiesUpdateVelocities = function(e) {
						for (var t = e.length, n = 0; n < t; n++) f.updateVelocities(e[n]);
					};
				})();
			}),
			(function(e, t, n) {
				var r = {};
				e.exports = r;
				var i = n(3), a = n(0), o = n(1);
				(function() {
					r._restingThresh = 2, r._restingThreshTangent = Math.sqrt(6), r._positionDampen = .9, r._positionWarming = .8, r._frictionNormalMultiplier = 5, r._frictionMaxStatic = Number.MAX_VALUE, r.preSolvePosition = function(e) {
						var t, n, r, i = e.length;
						for (t = 0; t < i; t++) n = e[t], n.isActive && (r = n.contactCount, n.collision.parentA.totalContacts += r, n.collision.parentB.totalContacts += r);
					}, r.solvePosition = function(e, t, n) {
						var i, o, s, c, l, u, d, f, p = r._positionDampen * (n || 1), m = a.clamp(t / a._baseDelta, 0, 1), h = e.length;
						for (i = 0; i < h; i++) o = e[i], o.isActive && !o.isSensor && (s = o.collision, c = s.parentA, l = s.parentB, u = s.normal, o.separation = s.depth + u.x * (l.positionImpulse.x - c.positionImpulse.x) + u.y * (l.positionImpulse.y - c.positionImpulse.y));
						for (i = 0; i < h; i++) o = e[i], o.isActive && !o.isSensor && (s = o.collision, c = s.parentA, l = s.parentB, u = s.normal, f = o.separation - o.slop * m, (c.isStatic || l.isStatic) && (f *= 2), c.isStatic || c.isSleeping || (d = p / c.totalContacts, c.positionImpulse.x += u.x * f * d, c.positionImpulse.y += u.y * f * d), l.isStatic || l.isSleeping || (d = p / l.totalContacts, l.positionImpulse.x -= u.x * f * d, l.positionImpulse.y -= u.y * f * d));
					}, r.postSolvePosition = function(e) {
						for (var t = r._positionWarming, n = e.length, a = i.translate, s = o.update, c = 0; c < n; c++) {
							var l = e[c], u = l.positionImpulse, d = u.x, f = u.y, p = l.velocity;
							if (l.totalContacts = 0, d !== 0 || f !== 0) {
								for (var m = 0; m < l.parts.length; m++) {
									var h = l.parts[m];
									a(h.vertices, u), s(h.bounds, h.vertices, p), h.position.x += d, h.position.y += f;
								}
								l.positionPrev.x += d, l.positionPrev.y += f, d * p.x + f * p.y < 0 ? (u.x = 0, u.y = 0) : (u.x *= t, u.y *= t);
							}
						}
					}, r.preSolveVelocity = function(e) {
						for (var t = e.length, n = 0, r; n < t; n++) {
							var i = e[n];
							if (i.isActive && !i.isSensor) {
								var a = i.contacts, o = i.contactCount, s = i.collision, c = s.parentA, l = s.parentB, u = s.normal, d = s.tangent;
								for (r = 0; r < o; r++) {
									var f = a[r], p = f.vertex, m = f.normalImpulse, h = f.tangentImpulse;
									if (m !== 0 || h !== 0) {
										var g = u.x * m + d.x * h, _ = u.y * m + d.y * h;
										c.isStatic || c.isSleeping || (c.positionPrev.x += g * c.inverseMass, c.positionPrev.y += _ * c.inverseMass, c.anglePrev += c.inverseInertia * ((p.x - c.position.x) * _ - (p.y - c.position.y) * g)), l.isStatic || l.isSleeping || (l.positionPrev.x -= g * l.inverseMass, l.positionPrev.y -= _ * l.inverseMass, l.anglePrev -= l.inverseInertia * ((p.x - l.position.x) * _ - (p.y - l.position.y) * g));
									}
								}
							}
						}
					}, r.solveVelocity = function(e, t) {
						for (var n = t / a._baseDelta, i = n * n * n, o = -r._restingThresh * n, s = r._restingThreshTangent, c = r._frictionNormalMultiplier * n, l = r._frictionMaxStatic, u = e.length, d, f, p = 0, m; p < u; p++) {
							var h = e[p];
							if (h.isActive && !h.isSensor) {
								var g = h.collision, _ = g.parentA, v = g.parentB, y = g.normal.x, b = g.normal.y, x = g.tangent.x, S = g.tangent.y, C = h.inverseMass, w = h.friction * h.frictionStatic * c, T = h.contacts, E = h.contactCount, D = 1 / E, O = _.position.x - _.positionPrev.x, k = _.position.y - _.positionPrev.y, A = _.angle - _.anglePrev, j = v.position.x - v.positionPrev.x, M = v.position.y - v.positionPrev.y, N = v.angle - v.anglePrev;
								for (m = 0; m < E; m++) {
									var P = T[m], F = P.vertex, I = F.x - _.position.x, L = F.y - _.position.y, R = F.x - v.position.x, z = F.y - v.position.y, B = O - L * A, V = k + I * A, H = j - z * N, U = M + R * N, W = B - H, G = V - U, K = y * W + b * G, q = x * W + S * G, J = h.separation + K, Y = Math.min(J, 1);
									Y = J < 0 ? 0 : Y;
									var X = Y * w;
									q < -X || q > X ? (f = q > 0 ? q : -q, d = h.friction * (q > 0 ? 1 : -1) * i, d < -f ? d = -f : d > f && (d = f)) : (d = q, f = l);
									var ee = I * b - L * y, te = R * b - z * y, ne = D / (C + _.inverseInertia * ee * ee + v.inverseInertia * te * te), Z = (1 + h.restitution) * K * ne;
									if (d *= ne, K < o) P.normalImpulse = 0;
									else {
										var re = P.normalImpulse;
										P.normalImpulse += Z, P.normalImpulse > 0 && (P.normalImpulse = 0), Z = P.normalImpulse - re;
									}
									if (q < -s || q > s) P.tangentImpulse = 0;
									else {
										var ie = P.tangentImpulse;
										P.tangentImpulse += d, P.tangentImpulse < -f && (P.tangentImpulse = -f), P.tangentImpulse > f && (P.tangentImpulse = f), d = P.tangentImpulse - ie;
									}
									var Q = y * Z + x * d, $ = b * Z + S * d;
									_.isStatic || _.isSleeping || (_.positionPrev.x += Q * _.inverseMass, _.positionPrev.y += $ * _.inverseMass, _.anglePrev += (I * $ - L * Q) * _.inverseInertia), v.isStatic || v.isSleeping || (v.positionPrev.x -= Q * v.inverseMass, v.positionPrev.y -= $ * v.inverseMass, v.anglePrev -= (R * $ - z * Q) * v.inverseInertia);
								}
							}
						}
					};
				})();
			}),
			(function(e, t, n) {
				var r = {};
				e.exports = r;
				var i = n(9), a = n(0);
				(function() {
					r.create = function(e) {
						return a.extend({
							table: {},
							list: [],
							collisionStart: [],
							collisionActive: [],
							collisionEnd: []
						}, e);
					}, r.update = function(e, t, n) {
						for (var r = i.update, a = i.create, o = i.setActive, s = e.table, c = e.list, l = c.length, u = l, d = e.collisionStart, f = e.collisionEnd, p = e.collisionActive, m = t.length, h = 0, g = 0, _ = 0, v, y, b = 0; b < m; b++) v = t[b], y = v.pair, y ? (y.isActive && (p[_++] = y), r(y, v, n)) : (y = a(v, n), s[y.id] = y, d[h++] = y, c[u++] = y);
						for (u = 0, l = c.length, b = 0; b < l; b++) y = c[b], y.timeUpdated >= n ? c[u++] = y : (o(y, !1, n), y.collision.bodyA.sleepCounter > 0 && y.collision.bodyB.sleepCounter > 0 ? c[u++] = y : (f[g++] = y, delete s[y.id]));
						c.length !== u && (c.length = u), d.length !== h && (d.length = h), f.length !== g && (f.length = g), p.length !== _ && (p.length = _);
					}, r.clear = function(e) {
						return e.table = {}, e.list.length = 0, e.collisionStart.length = 0, e.collisionActive.length = 0, e.collisionEnd.length = 0, e;
					};
				})();
			}),
			(function(e, t, n) {
				var r = e.exports = n(21);
				r.Axes = n(11), r.Bodies = n(12), r.Body = n(4), r.Bounds = n(1), r.Collision = n(8), r.Common = n(0), r.Composite = n(6), r.Composites = n(22), r.Constraint = n(10), r.Contact = n(16), r.Detector = n(13), r.Engine = n(17), r.Events = n(5), r.Grid = n(23), r.Mouse = n(14), r.MouseConstraint = n(24), r.Pair = n(9), r.Pairs = n(19), r.Plugin = n(15), r.Query = n(25), r.Render = n(26), r.Resolver = n(18), r.Runner = n(27), r.SAT = n(28), r.Sleeping = n(7), r.Svg = n(29), r.Vector = n(2), r.Vertices = n(3), r.World = n(30), r.Engine.run = r.Runner.run, r.Common.deprecated(r.Engine, "run", "Engine.run ➤ use Matter.Runner.run(engine) instead");
			}),
			(function(e, t, n) {
				var r = {};
				e.exports = r;
				var i = n(15), a = n(0);
				(function() {
					r.name = "matter-js", r.version = "0.20.0", r.uses = [], r.used = [], r.use = function() {
						i.use(r, Array.prototype.slice.call(arguments));
					}, r.before = function(e, t) {
						return e = e.replace(/^Matter./, ""), a.chainPathBefore(r, e, t);
					}, r.after = function(e, t) {
						return e = e.replace(/^Matter./, ""), a.chainPathAfter(r, e, t);
					};
				})();
			}),
			(function(e, t, n) {
				var r = {};
				e.exports = r;
				var i = n(6), a = n(10), o = n(0), s = n(4), c = n(12), l = o.deprecated;
				(function() {
					r.stack = function(e, t, n, r, a, o, c) {
						for (var l = i.create({ label: "Stack" }), u = e, d = t, f, p = 0, m = 0; m < r; m++) {
							for (var h = 0, g = 0; g < n; g++) {
								var _ = c(u, d, g, m, f, p);
								if (_) {
									var v = _.bounds.max.y - _.bounds.min.y, y = _.bounds.max.x - _.bounds.min.x;
									v > h && (h = v), s.translate(_, {
										x: y * .5,
										y: v * .5
									}), u = _.bounds.max.x + a, i.addBody(l, _), f = _, p += 1;
								} else u += a;
							}
							d += h + o, u = e;
						}
						return l;
					}, r.chain = function(e, t, n, r, s, c) {
						for (var l = e.bodies, u = 1; u < l.length; u++) {
							var d = l[u - 1], f = l[u], p = d.bounds.max.y - d.bounds.min.y, m = d.bounds.max.x - d.bounds.min.x, h = f.bounds.max.y - f.bounds.min.y, g = f.bounds.max.x - f.bounds.min.x, _ = {
								bodyA: d,
								pointA: {
									x: m * t,
									y: p * n
								},
								bodyB: f,
								pointB: {
									x: g * r,
									y: h * s
								}
							}, v = o.extend(_, c);
							i.addConstraint(e, a.create(v));
						}
						return e.label += " Chain", e;
					}, r.mesh = function(e, t, n, r, s) {
						for (var c = e.bodies, l = 0, u, d, f, p; l < n; l++) {
							for (u = 1; u < t; u++) d = c[u - 1 + l * t], f = c[u + l * t], i.addConstraint(e, a.create(o.extend({
								bodyA: d,
								bodyB: f
							}, s)));
							if (l > 0) for (u = 0; u < t; u++) d = c[u + (l - 1) * t], f = c[u + l * t], i.addConstraint(e, a.create(o.extend({
								bodyA: d,
								bodyB: f
							}, s))), r && u > 0 && (p = c[u - 1 + (l - 1) * t], i.addConstraint(e, a.create(o.extend({
								bodyA: p,
								bodyB: f
							}, s)))), r && u < t - 1 && (p = c[u + 1 + (l - 1) * t], i.addConstraint(e, a.create(o.extend({
								bodyA: p,
								bodyB: f
							}, s))));
						}
						return e.label += " Mesh", e;
					}, r.pyramid = function(e, t, n, i, a, o, c) {
						return r.stack(e, t, n, i, a, o, function(t, r, o, l, u, d) {
							var f = Math.min(i, Math.ceil(n / 2)), p = u ? u.bounds.max.x - u.bounds.min.x : 0;
							if (!(l > f)) {
								l = f - l;
								var m = l, h = n - 1 - l;
								if (!(o < m || o > h)) return d === 1 && s.translate(u, {
									x: (o + (n % 2 == 1 ? 1 : -1)) * p,
									y: 0
								}), c(e + (u ? o * p : 0) + o * a, r, o, l, u, d);
							}
						});
					}, r.newtonsCradle = function(e, t, n, r, o) {
						for (var s = i.create({ label: "Newtons Cradle" }), l = 0; l < n; l++) {
							var u = 1.9, d = c.circle(e + r * u * l, t + o, r, {
								inertia: Infinity,
								restitution: 1,
								friction: 0,
								frictionAir: 1e-4,
								slop: 1
							}), f = a.create({
								pointA: {
									x: e + r * u * l,
									y: t
								},
								bodyB: d
							});
							i.addBody(s, d), i.addConstraint(s, f);
						}
						return s;
					}, l(r, "newtonsCradle", "Composites.newtonsCradle ➤ moved to newtonsCradle example"), r.car = function(e, t, n, r, o) {
						var l = s.nextGroup(!0), u = 20, d = -n * .5 + u, f = n * .5 - u, p = 0, m = i.create({ label: "Car" }), h = c.rectangle(e, t, n, r, {
							collisionFilter: { group: l },
							chamfer: { radius: r * .5 },
							density: 2e-4
						}), g = c.circle(e + d, t + p, o, {
							collisionFilter: { group: l },
							friction: .8
						}), _ = c.circle(e + f, t + p, o, {
							collisionFilter: { group: l },
							friction: .8
						}), v = a.create({
							bodyB: h,
							pointB: {
								x: d,
								y: p
							},
							bodyA: g,
							stiffness: 1,
							length: 0
						}), y = a.create({
							bodyB: h,
							pointB: {
								x: f,
								y: p
							},
							bodyA: _,
							stiffness: 1,
							length: 0
						});
						return i.addBody(m, h), i.addBody(m, g), i.addBody(m, _), i.addConstraint(m, v), i.addConstraint(m, y), m;
					}, l(r, "car", "Composites.car ➤ moved to car example"), r.softBody = function(e, t, n, i, a, s, l, u, d, f) {
						d = o.extend({ inertia: Infinity }, d), f = o.extend({
							stiffness: .2,
							render: {
								type: "line",
								anchors: !1
							}
						}, f);
						var p = r.stack(e, t, n, i, a, s, function(e, t) {
							return c.circle(e, t, u, d);
						});
						return r.mesh(p, n, i, l, f), p.label = "Soft Body", p;
					}, l(r, "softBody", "Composites.softBody ➤ moved to softBody and cloth examples");
				})();
			}),
			(function(e, t, n) {
				var r = {};
				e.exports = r;
				var i = n(9), a = n(0), o = a.deprecated;
				(function() {
					r.create = function(e) {
						return a.extend({
							buckets: {},
							pairs: {},
							pairsList: [],
							bucketWidth: 48,
							bucketHeight: 48
						}, e);
					}, r.update = function(e, t, n, i) {
						var a, o, s, c = n.world, l = e.buckets, u, d, f = !1;
						for (a = 0; a < t.length; a++) {
							var p = t[a];
							if ((!p.isSleeping || i) && !(c.bounds && (p.bounds.max.x < c.bounds.min.x || p.bounds.min.x > c.bounds.max.x || p.bounds.max.y < c.bounds.min.y || p.bounds.min.y > c.bounds.max.y))) {
								var m = r._getRegion(e, p);
								if (!p.region || m.id !== p.region.id || i) {
									(!p.region || i) && (p.region = m);
									var h = r._regionUnion(m, p.region);
									for (o = h.startCol; o <= h.endCol; o++) for (s = h.startRow; s <= h.endRow; s++) {
										d = r._getBucketId(o, s), u = l[d];
										var g = o >= m.startCol && o <= m.endCol && s >= m.startRow && s <= m.endRow, _ = o >= p.region.startCol && o <= p.region.endCol && s >= p.region.startRow && s <= p.region.endRow;
										!g && _ && _ && u && r._bucketRemoveBody(e, u, p), (p.region === m || g && !_ || i) && (u ||= r._createBucket(l, d), r._bucketAddBody(e, u, p));
									}
									p.region = m, f = !0;
								}
							}
						}
						f && (e.pairsList = r._createActivePairsList(e));
					}, o(r, "update", "Grid.update ➤ replaced by Matter.Detector"), r.clear = function(e) {
						e.buckets = {}, e.pairs = {}, e.pairsList = [];
					}, o(r, "clear", "Grid.clear ➤ replaced by Matter.Detector"), r._regionUnion = function(e, t) {
						var n = Math.min(e.startCol, t.startCol), i = Math.max(e.endCol, t.endCol), a = Math.min(e.startRow, t.startRow), o = Math.max(e.endRow, t.endRow);
						return r._createRegion(n, i, a, o);
					}, r._getRegion = function(e, t) {
						var n = t.bounds, i = Math.floor(n.min.x / e.bucketWidth), a = Math.floor(n.max.x / e.bucketWidth), o = Math.floor(n.min.y / e.bucketHeight), s = Math.floor(n.max.y / e.bucketHeight);
						return r._createRegion(i, a, o, s);
					}, r._createRegion = function(e, t, n, r) {
						return {
							id: e + "," + t + "," + n + "," + r,
							startCol: e,
							endCol: t,
							startRow: n,
							endRow: r
						};
					}, r._getBucketId = function(e, t) {
						return "C" + e + "R" + t;
					}, r._createBucket = function(e, t) {
						return e[t] = [];
					}, r._bucketAddBody = function(e, t, n) {
						for (var r = e.pairs, a = i.id, o = t.length, s = 0; s < o; s++) {
							var c = t[s];
							if (!(n.id === c.id || n.isStatic && c.isStatic)) {
								var l = a(n, c), u = r[l];
								u ? u[2] += 1 : r[l] = [
									n,
									c,
									1
								];
							}
						}
						t.push(n);
					}, r._bucketRemoveBody = function(e, t, n) {
						var r = e.pairs, o = i.id, s;
						t.splice(a.indexOf(t, n), 1);
						var c = t.length;
						for (s = 0; s < c; s++) {
							var l = r[o(n, t[s])];
							l && --l[2];
						}
					}, r._createActivePairsList = function(e) {
						for (var t, n = e.pairs, r = a.keys(n), i = r.length, o = [], s = 0; s < i; s++) t = n[r[s]], t[2] > 0 ? o.push(t) : delete n[r[s]];
						return o;
					};
				})();
			}),
			(function(e, t, n) {
				var r = {};
				e.exports = r;
				var i = n(3), a = n(7), o = n(14), s = n(5), c = n(13), l = n(10), u = n(6), d = n(0), f = n(1);
				(function() {
					r.create = function(e, t) {
						var n = (e ? e.mouse : null) || (t ? t.mouse : null);
						n || (e && e.render && e.render.canvas ? n = o.create(e.render.canvas) : t && t.element ? n = o.create(t.element) : (n = o.create(), d.warn("MouseConstraint.create: options.mouse was undefined, options.element was undefined, may not function as expected")));
						var i = l.create({
							label: "Mouse Constraint",
							pointA: n.position,
							pointB: {
								x: 0,
								y: 0
							},
							length: .01,
							stiffness: .1,
							angularStiffness: 1,
							render: {
								strokeStyle: "#90EE90",
								lineWidth: 3
							}
						}), a = {
							type: "mouseConstraint",
							mouse: n,
							element: null,
							body: null,
							constraint: i,
							collisionFilter: {
								category: 1,
								mask: 4294967295,
								group: 0
							}
						}, c = d.extend(a, t);
						return s.on(e, "beforeUpdate", function() {
							var t = u.allBodies(e.world);
							r.update(c, t), r._triggerEvents(c);
						}), c;
					}, r.update = function(e, t) {
						var n = e.mouse, r = e.constraint, o = e.body;
						if (n.button === 0) {
							if (r.bodyB) a.set(r.bodyB, !1), r.pointA = n.position;
							else for (var l = 0; l < t.length; l++) if (o = t[l], f.contains(o.bounds, n.position) && c.canCollide(o.collisionFilter, e.collisionFilter)) for (var u = +(o.parts.length > 1); u < o.parts.length; u++) {
								var d = o.parts[u];
								if (i.contains(d.vertices, n.position)) {
									r.pointA = n.position, r.bodyB = e.body = o, r.pointB = {
										x: n.position.x - o.position.x,
										y: n.position.y - o.position.y
									}, r.angleB = o.angle, a.set(o, !1), s.trigger(e, "startdrag", {
										mouse: n,
										body: o
									});
									break;
								}
							}
						} else r.bodyB = e.body = null, r.pointB = null, o && s.trigger(e, "enddrag", {
							mouse: n,
							body: o
						});
					}, r._triggerEvents = function(e) {
						var t = e.mouse, n = t.sourceEvents;
						n.mousemove && s.trigger(e, "mousemove", { mouse: t }), n.mousedown && s.trigger(e, "mousedown", { mouse: t }), n.mouseup && s.trigger(e, "mouseup", { mouse: t }), o.clearSourceEvents(t);
					};
				})();
			}),
			(function(e, t, n) {
				var r = {};
				e.exports = r;
				var i = n(2), a = n(8), o = n(1), s = n(12), c = n(3);
				(function() {
					r.collides = function(e, t) {
						for (var n = [], r = t.length, i = e.bounds, s = a.collides, c = o.overlaps, l = 0; l < r; l++) {
							var u = t[l], d = u.parts.length, f = d === 1 ? 0 : 1;
							if (c(u.bounds, i)) for (var p = f; p < d; p++) {
								var m = u.parts[p];
								if (c(m.bounds, i)) {
									var h = s(m, e);
									if (h) {
										n.push(h);
										break;
									}
								}
							}
						}
						return n;
					}, r.ray = function(e, t, n, a) {
						a ||= 1e-100;
						for (var o = i.angle(t, n), c = i.magnitude(i.sub(t, n)), l = (n.x + t.x) * .5, u = (n.y + t.y) * .5, d = s.rectangle(l, u, c, a, { angle: o }), f = r.collides(d, e), p = 0; p < f.length; p += 1) {
							var m = f[p];
							m.body = m.bodyB = m.bodyA;
						}
						return f;
					}, r.region = function(e, t, n) {
						for (var r = [], i = 0; i < e.length; i++) {
							var a = e[i], s = o.overlaps(a.bounds, t);
							(s && !n || !s && n) && r.push(a);
						}
						return r;
					}, r.point = function(e, t) {
						for (var n = [], r = 0; r < e.length; r++) {
							var i = e[r];
							if (o.contains(i.bounds, t)) for (var a = i.parts.length === 1 ? 0 : 1; a < i.parts.length; a++) {
								var s = i.parts[a];
								if (o.contains(s.bounds, t) && c.contains(s.vertices, t)) {
									n.push(i);
									break;
								}
							}
						}
						return n;
					};
				})();
			}),
			(function(e, t, n) {
				var r = {};
				e.exports = r;
				var i = n(4), a = n(0), o = n(6), s = n(1), c = n(5), l = n(2), u = n(14);
				(function() {
					var e, t;
					typeof window < "u" && (e = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.msRequestAnimationFrame || function(e) {
						window.setTimeout(function() {
							e(a.now());
						}, 1e3 / 60);
					}, t = window.cancelAnimationFrame || window.mozCancelAnimationFrame || window.webkitCancelAnimationFrame || window.msCancelAnimationFrame), r._goodFps = 30, r._goodDelta = 1e3 / 60, r.create = function(e) {
						var t = {
							engine: null,
							element: null,
							canvas: null,
							mouse: null,
							frameRequestId: null,
							timing: {
								historySize: 60,
								delta: 0,
								deltaHistory: [],
								lastTime: 0,
								lastTimestamp: 0,
								lastElapsed: 0,
								timestampElapsed: 0,
								timestampElapsedHistory: [],
								engineDeltaHistory: [],
								engineElapsedHistory: [],
								engineUpdatesHistory: [],
								elapsedHistory: []
							},
							options: {
								width: 800,
								height: 600,
								pixelRatio: 1,
								background: "#14151f",
								wireframeBackground: "#14151f",
								wireframeStrokeStyle: "#bbb",
								hasBounds: !!e.bounds,
								enabled: !0,
								wireframes: !0,
								showSleeping: !0,
								showDebug: !1,
								showStats: !1,
								showPerformance: !1,
								showBounds: !1,
								showVelocity: !1,
								showCollisions: !1,
								showSeparations: !1,
								showAxes: !1,
								showPositions: !1,
								showAngleIndicator: !1,
								showIds: !1,
								showVertexNumbers: !1,
								showConvexHulls: !1,
								showInternalEdges: !1,
								showMousePosition: !1
							}
						}, n = a.extend(t, e);
						return n.canvas && (n.canvas.width = n.options.width || n.canvas.width, n.canvas.height = n.options.height || n.canvas.height), n.mouse = e.mouse, n.engine = e.engine, n.canvas = n.canvas || f(n.options.width, n.options.height), n.context = n.canvas.getContext("2d"), n.textures = {}, n.bounds = n.bounds || {
							min: {
								x: 0,
								y: 0
							},
							max: {
								x: n.canvas.width,
								y: n.canvas.height
							}
						}, n.controller = r, n.options.showBroadphase = !1, n.options.pixelRatio !== 1 && r.setPixelRatio(n, n.options.pixelRatio), a.isElement(n.element) && n.element.appendChild(n.canvas), n;
					}, r.run = function(t) {
						(function i(a) {
							t.frameRequestId = e(i), n(t, a), r.world(t, a), t.context.setTransform(t.options.pixelRatio, 0, 0, t.options.pixelRatio, 0, 0), (t.options.showStats || t.options.showDebug) && r.stats(t, t.context, a), (t.options.showPerformance || t.options.showDebug) && r.performance(t, t.context, a), t.context.setTransform(1, 0, 0, 1, 0, 0);
						})();
					}, r.stop = function(e) {
						t(e.frameRequestId);
					}, r.setPixelRatio = function(e, t) {
						var n = e.options, r = e.canvas;
						t === "auto" && (t = p(r)), n.pixelRatio = t, r.setAttribute("data-pixel-ratio", t), r.width = n.width * t, r.height = n.height * t, r.style.width = n.width + "px", r.style.height = n.height + "px";
					}, r.setSize = function(e, t, n) {
						e.options.width = t, e.options.height = n, e.bounds.max.x = e.bounds.min.x + t, e.bounds.max.y = e.bounds.min.y + n, e.options.pixelRatio === 1 ? (e.canvas.width = t, e.canvas.height = n) : r.setPixelRatio(e, e.options.pixelRatio);
					}, r.lookAt = function(e, t, n, r) {
						r = r === void 0 || r, t = a.isArray(t) ? t : [t], n ||= {
							x: 0,
							y: 0
						};
						for (var i = {
							min: {
								x: Infinity,
								y: Infinity
							},
							max: {
								x: -Infinity,
								y: -Infinity
							}
						}, o = 0; o < t.length; o += 1) {
							var s = t[o], c = s.bounds ? s.bounds.min : s.min || s.position || s, l = s.bounds ? s.bounds.max : s.max || s.position || s;
							c && l && (c.x < i.min.x && (i.min.x = c.x), l.x > i.max.x && (i.max.x = l.x), c.y < i.min.y && (i.min.y = c.y), l.y > i.max.y && (i.max.y = l.y));
						}
						var d = i.max.x - i.min.x + 2 * n.x, f = i.max.y - i.min.y + 2 * n.y, p = e.canvas.height, m = e.canvas.width / p, h = d / f, g = 1, _ = 1;
						h > m ? _ = h / m : g = m / h, e.options.hasBounds = !0, e.bounds.min.x = i.min.x, e.bounds.max.x = i.min.x + d * g, e.bounds.min.y = i.min.y, e.bounds.max.y = i.min.y + f * _, r && (e.bounds.min.x += d * .5 - d * g * .5, e.bounds.max.x += d * .5 - d * g * .5, e.bounds.min.y += f * .5 - f * _ * .5, e.bounds.max.y += f * .5 - f * _ * .5), e.bounds.min.x -= n.x, e.bounds.max.x -= n.x, e.bounds.min.y -= n.y, e.bounds.max.y -= n.y, e.mouse && (u.setScale(e.mouse, {
							x: (e.bounds.max.x - e.bounds.min.x) / e.canvas.width,
							y: (e.bounds.max.y - e.bounds.min.y) / e.canvas.height
						}), u.setOffset(e.mouse, e.bounds.min));
					}, r.startViewTransform = function(e) {
						var t = e.bounds.max.x - e.bounds.min.x, n = e.bounds.max.y - e.bounds.min.y, r = t / e.options.width, i = n / e.options.height;
						e.context.setTransform(e.options.pixelRatio / r, 0, 0, e.options.pixelRatio / i, 0, 0), e.context.translate(-e.bounds.min.x, -e.bounds.min.y);
					}, r.endViewTransform = function(e) {
						e.context.setTransform(e.options.pixelRatio, 0, 0, e.options.pixelRatio, 0, 0);
					}, r.world = function(e, t) {
						var n = a.now(), i = e.engine, d = i.world, f = e.canvas, p = e.context, m = e.options, g = e.timing, _ = o.allBodies(d), v = o.allConstraints(d), y = m.wireframes ? m.wireframeBackground : m.background, b = [], x = [], S, C = { timestamp: i.timing.timestamp };
						if (c.trigger(e, "beforeRender", C), e.currentBackground !== y && h(e, y), p.globalCompositeOperation = "source-in", p.fillStyle = "transparent", p.fillRect(0, 0, f.width, f.height), p.globalCompositeOperation = "source-over", m.hasBounds) {
							for (S = 0; S < _.length; S++) {
								var w = _[S];
								s.overlaps(w.bounds, e.bounds) && b.push(w);
							}
							for (S = 0; S < v.length; S++) {
								var T = v[S], E = T.bodyA, D = T.bodyB, O = T.pointA, k = T.pointB;
								E && (O = l.add(E.position, T.pointA)), D && (k = l.add(D.position, T.pointB)), O && k && (s.contains(e.bounds, O) || s.contains(e.bounds, k)) && x.push(T);
							}
							r.startViewTransform(e), e.mouse && (u.setScale(e.mouse, {
								x: (e.bounds.max.x - e.bounds.min.x) / e.options.width,
								y: (e.bounds.max.y - e.bounds.min.y) / e.options.height
							}), u.setOffset(e.mouse, e.bounds.min));
						} else x = v, b = _, e.options.pixelRatio !== 1 && e.context.setTransform(e.options.pixelRatio, 0, 0, e.options.pixelRatio, 0, 0);
						!m.wireframes || i.enableSleeping && m.showSleeping ? r.bodies(e, b, p) : (m.showConvexHulls && r.bodyConvexHulls(e, b, p), r.bodyWireframes(e, b, p)), m.showBounds && r.bodyBounds(e, b, p), (m.showAxes || m.showAngleIndicator) && r.bodyAxes(e, b, p), m.showPositions && r.bodyPositions(e, b, p), m.showVelocity && r.bodyVelocity(e, b, p), m.showIds && r.bodyIds(e, b, p), m.showSeparations && r.separations(e, i.pairs.list, p), m.showCollisions && r.collisions(e, i.pairs.list, p), m.showVertexNumbers && r.vertexNumbers(e, b, p), m.showMousePosition && r.mousePosition(e, e.mouse, p), r.constraints(x, p), m.hasBounds && r.endViewTransform(e), c.trigger(e, "afterRender", C), g.lastElapsed = a.now() - n;
					}, r.stats = function(e, t, n) {
						for (var r = e.engine, i = r.world, a = o.allBodies(i), s = 0, c = 55, l = 44, u = 0, d = 0, f = 0; f < a.length; f += 1) s += a[f].parts.length;
						var p = {
							Part: s,
							Body: a.length,
							Cons: o.allConstraints(i).length,
							Comp: o.allComposites(i).length,
							Pair: r.pairs.list.length
						};
						for (var m in t.fillStyle = "#0e0f19", t.fillRect(u, d, c * 5.5, l), t.font = "12px Arial", t.textBaseline = "top", t.textAlign = "right", p) {
							var h = p[m];
							t.fillStyle = "#aaa", t.fillText(m, u + c, d + 8), t.fillStyle = "#eee", t.fillText(h, u + c, d + 26), u += c;
						}
					}, r.performance = function(e, t) {
						var n = e.engine, i = e.timing, o = i.deltaHistory, s = i.elapsedHistory, c = i.timestampElapsedHistory, l = i.engineDeltaHistory, u = i.engineUpdatesHistory, f = i.engineElapsedHistory, p = n.timing.lastUpdatesPerFrame, m = n.timing.lastDelta, h = d(o), g = d(s), _ = d(l), v = d(u), y = d(f), b = d(c) / h || 0, x = Math.round(h / m), S = 1e3 / h || 0, C = 4, w = 12, T = 60, E = 34, D = 10, O = 69;
						t.fillStyle = "#0e0f19", t.fillRect(0, 50, w * 5 + T * 6 + 22, E), r.status(t, D, O, T, C, o.length, Math.round(S) + " fps", S / r._goodFps, function(e) {
							return o[e] / h - 1;
						}), r.status(t, D + w + T, O, T, C, l.length, m.toFixed(2) + " dt", r._goodDelta / m, function(e) {
							return l[e] / _ - 1;
						}), r.status(t, D + (w + T) * 2, O, T, C, u.length, p + " upf", a.clamp(v / x || 1, 0, 1) ** 4, function(e) {
							return u[e] / v - 1;
						}), r.status(t, D + (w + T) * 3, O, T, C, f.length, y.toFixed(2) + " ut", 1 - p * y / r._goodFps, function(e) {
							return f[e] / y - 1;
						}), r.status(t, D + (w + T) * 4, O, T, C, s.length, g.toFixed(2) + " rt", 1 - g / r._goodFps, function(e) {
							return s[e] / g - 1;
						}), r.status(t, D + (w + T) * 5, O, T, C, c.length, b.toFixed(2) + " x", b * b * b, function(e) {
							return (c[e] / o[e] / b || 0) - 1;
						});
					}, r.status = function(e, t, n, r, i, o, s, c, l) {
						e.strokeStyle = "#888", e.fillStyle = "#444", e.lineWidth = 1, e.fillRect(t, n + 7, r, 1), e.beginPath(), e.moveTo(t, n + 7 - i * a.clamp(.4 * l(0), -2, 2));
						for (var u = 0; u < r; u += 1) e.lineTo(t + u, n + 7 - (u < o ? i * a.clamp(.4 * l(u), -2, 2) : 0));
						e.stroke(), e.fillStyle = "hsl(" + a.clamp(25 + 95 * c, 0, 120) + ",100%,60%)", e.fillRect(t, n - 7, 4, 4), e.font = "12px Arial", e.textBaseline = "middle", e.textAlign = "right", e.fillStyle = "#eee", e.fillText(s, t + r, n - 5);
					}, r.constraints = function(e, t) {
						for (var n = t, r = 0; r < e.length; r++) {
							var i = e[r];
							if (i.render.visible && i.pointA && i.pointB) {
								var o = i.bodyA, s = i.bodyB, c = o ? l.add(o.position, i.pointA) : i.pointA, u;
								if (i.render.type === "pin") n.beginPath(), n.arc(c.x, c.y, 3, 0, 2 * Math.PI), n.closePath();
								else {
									if (u = s ? l.add(s.position, i.pointB) : i.pointB, n.beginPath(), n.moveTo(c.x, c.y), i.render.type === "spring") for (var d = l.sub(u, c), f = l.perp(l.normalise(d)), p = Math.ceil(a.clamp(i.length / 5, 12, 20)), m, h = 1; h < p; h += 1) m = h % 2 == 0 ? 1 : -1, n.lineTo(c.x + d.x * (h / p) + f.x * m * 4, c.y + d.y * (h / p) + f.y * m * 4);
									n.lineTo(u.x, u.y);
								}
								i.render.lineWidth && (n.lineWidth = i.render.lineWidth, n.strokeStyle = i.render.strokeStyle, n.stroke()), i.render.anchors && (n.fillStyle = i.render.strokeStyle, n.beginPath(), n.arc(c.x, c.y, 3, 0, 2 * Math.PI), n.arc(u.x, u.y, 3, 0, 2 * Math.PI), n.closePath(), n.fill());
							}
						}
					}, r.bodies = function(e, t, n) {
						var r = n;
						e.engine;
						for (var i = e.options, a = i.showInternalEdges || !i.wireframes, o, s, c = 0, l; c < t.length; c++) if (o = t[c], o.render.visible) {
							for (l = +(o.parts.length > 1); l < o.parts.length; l++) if (s = o.parts[l], s.render.visible) {
								if (i.showSleeping && o.isSleeping ? r.globalAlpha = .5 * s.render.opacity : s.render.opacity !== 1 && (r.globalAlpha = s.render.opacity), s.render.sprite && s.render.sprite.texture && !i.wireframes) {
									var u = s.render.sprite, d = m(e, u.texture);
									r.translate(s.position.x, s.position.y), r.rotate(s.angle), r.drawImage(d, d.width * -u.xOffset * u.xScale, d.height * -u.yOffset * u.yScale, d.width * u.xScale, d.height * u.yScale), r.rotate(-s.angle), r.translate(-s.position.x, -s.position.y);
								} else {
									if (s.circleRadius) r.beginPath(), r.arc(s.position.x, s.position.y, s.circleRadius, 0, 2 * Math.PI);
									else {
										r.beginPath(), r.moveTo(s.vertices[0].x, s.vertices[0].y);
										for (var f = 1; f < s.vertices.length; f++) !s.vertices[f - 1].isInternal || a ? r.lineTo(s.vertices[f].x, s.vertices[f].y) : r.moveTo(s.vertices[f].x, s.vertices[f].y), s.vertices[f].isInternal && !a && r.moveTo(s.vertices[(f + 1) % s.vertices.length].x, s.vertices[(f + 1) % s.vertices.length].y);
										r.lineTo(s.vertices[0].x, s.vertices[0].y), r.closePath();
									}
									i.wireframes ? (r.lineWidth = 1, r.strokeStyle = e.options.wireframeStrokeStyle, r.stroke()) : (r.fillStyle = s.render.fillStyle, s.render.lineWidth && (r.lineWidth = s.render.lineWidth, r.strokeStyle = s.render.strokeStyle, r.stroke()), r.fill());
								}
								r.globalAlpha = 1;
							}
						}
					}, r.bodyWireframes = function(e, t, n) {
						var r = n, i = e.options.showInternalEdges, a, o, s, c, l;
						for (r.beginPath(), s = 0; s < t.length; s++) if (a = t[s], a.render.visible) for (l = +(a.parts.length > 1); l < a.parts.length; l++) {
							for (o = a.parts[l], r.moveTo(o.vertices[0].x, o.vertices[0].y), c = 1; c < o.vertices.length; c++) !o.vertices[c - 1].isInternal || i ? r.lineTo(o.vertices[c].x, o.vertices[c].y) : r.moveTo(o.vertices[c].x, o.vertices[c].y), o.vertices[c].isInternal && !i && r.moveTo(o.vertices[(c + 1) % o.vertices.length].x, o.vertices[(c + 1) % o.vertices.length].y);
							r.lineTo(o.vertices[0].x, o.vertices[0].y);
						}
						r.lineWidth = 1, r.strokeStyle = e.options.wireframeStrokeStyle, r.stroke();
					}, r.bodyConvexHulls = function(e, t, n) {
						var r = n, i, a, o;
						for (r.beginPath(), a = 0; a < t.length; a++) if (i = t[a], i.render.visible && i.parts.length !== 1) {
							for (r.moveTo(i.vertices[0].x, i.vertices[0].y), o = 1; o < i.vertices.length; o++) r.lineTo(i.vertices[o].x, i.vertices[o].y);
							r.lineTo(i.vertices[0].x, i.vertices[0].y);
						}
						r.lineWidth = 1, r.strokeStyle = "rgba(255,255,255,0.2)", r.stroke();
					}, r.vertexNumbers = function(e, t, n) {
						for (var r = n, i = 0, a, o; i < t.length; i++) {
							var s = t[i].parts;
							for (o = +(s.length > 1); o < s.length; o++) {
								var c = s[o];
								for (a = 0; a < c.vertices.length; a++) r.fillStyle = "rgba(255,255,255,0.2)", r.fillText(i + "_" + a, c.position.x + (c.vertices[a].x - c.position.x) * .8, c.position.y + (c.vertices[a].y - c.position.y) * .8);
							}
						}
					}, r.mousePosition = function(e, t, n) {
						var r = n;
						r.fillStyle = "rgba(255,255,255,0.8)", r.fillText(t.position.x + "  " + t.position.y, t.position.x + 5, t.position.y - 5);
					}, r.bodyBounds = function(e, t, n) {
						var r = n;
						e.engine;
						var i = e.options;
						r.beginPath();
						for (var a = 0; a < t.length; a++) if (t[a].render.visible) for (var o = t[a].parts, s = +(o.length > 1); s < o.length; s++) {
							var c = o[s];
							r.rect(c.bounds.min.x, c.bounds.min.y, c.bounds.max.x - c.bounds.min.x, c.bounds.max.y - c.bounds.min.y);
						}
						r.strokeStyle = i.wireframes ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)", r.lineWidth = 1, r.stroke();
					}, r.bodyAxes = function(e, t, n) {
						var r = n;
						e.engine;
						var i = e.options, a, o, s, c;
						for (r.beginPath(), o = 0; o < t.length; o++) {
							var l = t[o], u = l.parts;
							if (l.render.visible) {
								if (i.showAxes) for (s = +(u.length > 1); s < u.length; s++) for (a = u[s], c = 0; c < a.axes.length; c++) {
									var d = a.axes[c];
									r.moveTo(a.position.x, a.position.y), r.lineTo(a.position.x + d.x * 20, a.position.y + d.y * 20);
								}
								else for (s = +(u.length > 1); s < u.length; s++) for (a = u[s], c = 0; c < a.axes.length; c++) r.moveTo(a.position.x, a.position.y), r.lineTo((a.vertices[0].x + a.vertices[a.vertices.length - 1].x) / 2, (a.vertices[0].y + a.vertices[a.vertices.length - 1].y) / 2);
							}
						}
						i.wireframes ? (r.strokeStyle = "indianred", r.lineWidth = 1) : (r.strokeStyle = "rgba(255, 255, 255, 0.4)", r.globalCompositeOperation = "overlay", r.lineWidth = 2), r.stroke(), r.globalCompositeOperation = "source-over";
					}, r.bodyPositions = function(e, t, n) {
						var r = n;
						e.engine;
						var i = e.options, a, o, s, c;
						for (r.beginPath(), s = 0; s < t.length; s++) if (a = t[s], a.render.visible) for (c = 0; c < a.parts.length; c++) o = a.parts[c], r.arc(o.position.x, o.position.y, 3, 0, 2 * Math.PI, !1), r.closePath();
						for (r.fillStyle = i.wireframes ? "indianred" : "rgba(0,0,0,0.5)", r.fill(), r.beginPath(), s = 0; s < t.length; s++) a = t[s], a.render.visible && (r.arc(a.positionPrev.x, a.positionPrev.y, 2, 0, 2 * Math.PI, !1), r.closePath());
						r.fillStyle = "rgba(255,165,0,0.8)", r.fill();
					}, r.bodyVelocity = function(e, t, n) {
						var r = n;
						r.beginPath();
						for (var a = 0; a < t.length; a++) {
							var o = t[a];
							if (o.render.visible) {
								var s = i.getVelocity(o);
								r.moveTo(o.position.x, o.position.y), r.lineTo(o.position.x + s.x, o.position.y + s.y);
							}
						}
						r.lineWidth = 3, r.strokeStyle = "cornflowerblue", r.stroke();
					}, r.bodyIds = function(e, t, n) {
						for (var r = n, i = 0, a; i < t.length; i++) if (t[i].render.visible) {
							var o = t[i].parts;
							for (a = +(o.length > 1); a < o.length; a++) {
								var s = o[a];
								r.font = "12px Arial", r.fillStyle = "rgba(255,255,255,0.5)", r.fillText(s.id, s.position.x + 10, s.position.y - 10);
							}
						}
					}, r.collisions = function(e, t, n) {
						var r = n, i = e.options, a, o, s, c;
						for (r.beginPath(), s = 0; s < t.length; s++) if (a = t[s], a.isActive) for (o = a.collision, c = 0; c < a.contactCount; c++) {
							var l = a.contacts[c].vertex;
							r.rect(l.x - 1.5, l.y - 1.5, 3.5, 3.5);
						}
						for (r.fillStyle = i.wireframes ? "rgba(255,255,255,0.7)" : "orange", r.fill(), r.beginPath(), s = 0; s < t.length; s++) if (a = t[s], a.isActive && (o = a.collision, a.contactCount > 0)) {
							var u = a.contacts[0].vertex.x, d = a.contacts[0].vertex.y;
							a.contactCount === 2 && (u = (a.contacts[0].vertex.x + a.contacts[1].vertex.x) / 2, d = (a.contacts[0].vertex.y + a.contacts[1].vertex.y) / 2), o.bodyB === o.supports[0].body || o.bodyA.isStatic === !0 ? r.moveTo(u - o.normal.x * 8, d - o.normal.y * 8) : r.moveTo(u + o.normal.x * 8, d + o.normal.y * 8), r.lineTo(u, d);
						}
						r.strokeStyle = i.wireframes ? "rgba(255,165,0,0.7)" : "orange", r.lineWidth = 1, r.stroke();
					}, r.separations = function(e, t, n) {
						var r = n, i = e.options, a, o, s, c, l;
						for (r.beginPath(), l = 0; l < t.length; l++) if (a = t[l], a.isActive) {
							o = a.collision, s = o.bodyA, c = o.bodyB;
							var u = 1;
							!c.isStatic && !s.isStatic && (u = .5), c.isStatic && (u = 0), r.moveTo(c.position.x, c.position.y), r.lineTo(c.position.x - o.penetration.x * u, c.position.y - o.penetration.y * u), u = 1, !c.isStatic && !s.isStatic && (u = .5), s.isStatic && (u = 0), r.moveTo(s.position.x, s.position.y), r.lineTo(s.position.x + o.penetration.x * u, s.position.y + o.penetration.y * u);
						}
						r.strokeStyle = i.wireframes ? "rgba(255,165,0,0.5)" : "orange", r.stroke();
					}, r.inspector = function(e, t) {
						e.engine;
						var n = e.selected, r = e.render, i = r.options, a;
						if (i.hasBounds) {
							var o = r.bounds.max.x - r.bounds.min.x, s = r.bounds.max.y - r.bounds.min.y, c = o / r.options.width, l = s / r.options.height;
							t.scale(1 / c, 1 / l), t.translate(-r.bounds.min.x, -r.bounds.min.y);
						}
						for (var u = 0; u < n.length; u++) {
							var d = n[u].data;
							switch (t.translate(.5, .5), t.lineWidth = 1, t.strokeStyle = "rgba(255,165,0,0.9)", t.setLineDash([1, 2]), d.type) {
								case "body":
									a = d.bounds, t.beginPath(), t.rect(Math.floor(a.min.x - 3), Math.floor(a.min.y - 3), Math.floor(a.max.x - a.min.x + 6), Math.floor(a.max.y - a.min.y + 6)), t.closePath(), t.stroke();
									break;
								case "constraint":
									var f = d.pointA;
									d.bodyA && (f = d.pointB), t.beginPath(), t.arc(f.x, f.y, 10, 0, 2 * Math.PI), t.closePath(), t.stroke();
							}
							t.setLineDash([]), t.translate(-.5, -.5);
						}
						e.selectStart !== null && (t.translate(.5, .5), t.lineWidth = 1, t.strokeStyle = "rgba(255,165,0,0.6)", t.fillStyle = "rgba(255,165,0,0.1)", a = e.selectBounds, t.beginPath(), t.rect(Math.floor(a.min.x), Math.floor(a.min.y), Math.floor(a.max.x - a.min.x), Math.floor(a.max.y - a.min.y)), t.closePath(), t.stroke(), t.fill(), t.translate(-.5, -.5)), i.hasBounds && t.setTransform(1, 0, 0, 1, 0, 0);
					};
					var n = function(e, t) {
						var n = e.engine, i = e.timing, a = i.historySize, o = n.timing.timestamp;
						i.delta = t - i.lastTime || r._goodDelta, i.lastTime = t, i.timestampElapsed = o - i.lastTimestamp || 0, i.lastTimestamp = o, i.deltaHistory.unshift(i.delta), i.deltaHistory.length = Math.min(i.deltaHistory.length, a), i.engineDeltaHistory.unshift(n.timing.lastDelta), i.engineDeltaHistory.length = Math.min(i.engineDeltaHistory.length, a), i.timestampElapsedHistory.unshift(i.timestampElapsed), i.timestampElapsedHistory.length = Math.min(i.timestampElapsedHistory.length, a), i.engineUpdatesHistory.unshift(n.timing.lastUpdatesPerFrame), i.engineUpdatesHistory.length = Math.min(i.engineUpdatesHistory.length, a), i.engineElapsedHistory.unshift(n.timing.lastElapsed), i.engineElapsedHistory.length = Math.min(i.engineElapsedHistory.length, a), i.elapsedHistory.unshift(i.lastElapsed), i.elapsedHistory.length = Math.min(i.elapsedHistory.length, a);
					}, d = function(e) {
						for (var t = 0, n = 0; n < e.length; n += 1) t += e[n];
						return t / e.length || 0;
					}, f = function(e, t) {
						var n = document.createElement("canvas");
						return n.width = e, n.height = t, n.oncontextmenu = function() {
							return !1;
						}, n.onselectstart = function() {
							return !1;
						}, n;
					}, p = function(e) {
						var t = e.getContext("2d");
						return (window.devicePixelRatio || 1) / (t.webkitBackingStorePixelRatio || t.mozBackingStorePixelRatio || t.msBackingStorePixelRatio || t.oBackingStorePixelRatio || t.backingStorePixelRatio || 1);
					}, m = function(e, t) {
						var n = e.textures[t];
						return n || (n = e.textures[t] = new Image(), n.src = t, n);
					}, h = function(e, t) {
						var n = t;
						/(jpg|gif|png)$/.test(t) && (n = "url(" + t + ")"), e.canvas.style.background = n, e.canvas.style.backgroundSize = "contain", e.currentBackground = t;
					};
				})();
			}),
			(function(e, t, n) {
				var r = {};
				e.exports = r;
				var i = n(5), a = n(17), o = n(0);
				(function() {
					r._maxFrameDelta = 1e3 / 15, r._frameDeltaFallback = 1e3 / 60, r._timeBufferMargin = 1.5, r._elapsedNextEstimate = 1, r._smoothingLowerBound = .1, r._smoothingUpperBound = .9, r.create = function(e) {
						var t = o.extend({
							delta: 1e3 / 60,
							frameDelta: null,
							frameDeltaSmoothing: !0,
							frameDeltaSnapping: !0,
							frameDeltaHistory: [],
							frameDeltaHistorySize: 100,
							frameRequestId: null,
							timeBuffer: 0,
							timeLastTick: null,
							maxUpdates: null,
							maxFrameTime: 1e3 / 30,
							lastUpdatesDeferred: 0,
							enabled: !0
						}, e);
						return t.fps = 0, t;
					}, r.run = function(e, t) {
						return e.timeBuffer = r._frameDeltaFallback, (function n(i) {
							e.frameRequestId = r._onNextFrame(e, n), i && e.enabled && r.tick(e, t, i);
						})(), e;
					}, r.tick = function(t, n, s) {
						var c = o.now(), l = t.delta, u = 0, d = s - t.timeLastTick;
						if ((!d || !t.timeLastTick || d > Math.max(r._maxFrameDelta, t.maxFrameTime)) && (d = t.frameDelta || r._frameDeltaFallback), t.frameDeltaSmoothing) {
							t.frameDeltaHistory.push(d), t.frameDeltaHistory = t.frameDeltaHistory.slice(-t.frameDeltaHistorySize);
							var f = t.frameDeltaHistory.slice(0).sort();
							d = e(t.frameDeltaHistory.slice(f.length * r._smoothingLowerBound, f.length * r._smoothingUpperBound)) || d;
						}
						t.frameDeltaSnapping && (d = 1e3 / Math.round(1e3 / d)), t.frameDelta = d, t.timeLastTick = s, t.timeBuffer += t.frameDelta, t.timeBuffer = o.clamp(t.timeBuffer, 0, t.frameDelta + l * r._timeBufferMargin), t.lastUpdatesDeferred = 0;
						var p = t.maxUpdates || Math.ceil(t.maxFrameTime / l), m = { timestamp: n.timing.timestamp };
						i.trigger(t, "beforeTick", m), i.trigger(t, "tick", m);
						for (var h = o.now(); l > 0 && t.timeBuffer >= l * r._timeBufferMargin;) {
							i.trigger(t, "beforeUpdate", m), a.update(n, l), i.trigger(t, "afterUpdate", m), t.timeBuffer -= l, u += 1;
							var g = o.now() - c, _ = o.now() - h, v = g + r._elapsedNextEstimate * _ / u;
							if (u >= p || v > t.maxFrameTime) {
								t.lastUpdatesDeferred = Math.round(Math.max(0, t.timeBuffer / l - r._timeBufferMargin));
								break;
							}
						}
						n.timing.lastUpdatesPerFrame = u, i.trigger(t, "afterTick", m), t.frameDeltaHistory.length >= 100 && (t.lastUpdatesDeferred && Math.round(t.frameDelta / l) > p ? o.warnOnce("Matter.Runner: runner reached runner.maxUpdates, see docs.") : t.lastUpdatesDeferred && o.warnOnce("Matter.Runner: runner reached runner.maxFrameTime, see docs."), t.isFixed !== void 0 && o.warnOnce("Matter.Runner: runner.isFixed is now redundant, see docs."), (t.deltaMin || t.deltaMax) && o.warnOnce("Matter.Runner: runner.deltaMin and runner.deltaMax were removed, see docs."), t.fps !== 0 && o.warnOnce("Matter.Runner: runner.fps was replaced by runner.delta, see docs."));
					}, r.stop = function(e) {
						r._cancelNextFrame(e);
					}, r._onNextFrame = function(e, t) {
						if (typeof window < "u" && window.requestAnimationFrame) e.frameRequestId = window.requestAnimationFrame(t);
						else throw Error("Matter.Runner: missing required global window.requestAnimationFrame.");
						return e.frameRequestId;
					}, r._cancelNextFrame = function(e) {
						if (typeof window < "u" && window.cancelAnimationFrame) window.cancelAnimationFrame(e.frameRequestId);
						else throw Error("Matter.Runner: missing required global window.cancelAnimationFrame.");
					};
					var e = function(e) {
						for (var t = 0, n = e.length, r = 0; r < n; r += 1) t += e[r];
						return t / n || 0;
					};
				})();
			}),
			(function(e, t, n) {
				var r = {};
				e.exports = r;
				var i = n(8), a = n(0).deprecated;
				(function() {
					r.collides = function(e, t) {
						return i.collides(e, t);
					}, a(r, "collides", "SAT.collides ➤ replaced by Collision.collides");
				})();
			}),
			(function(e, t, n) {
				var r = {};
				e.exports = r, n(1);
				var i = n(0);
				(function() {
					r.pathToVertices = function(e, t) {
						typeof window < "u" && !("SVGPathSeg" in window) && i.warn("Svg.pathToVertices: SVGPathSeg not defined, a polyfill is required.");
						var n, a, o, s, c, l, u, d, f, p, m = [], h, g, _ = 0, v = 0, y = 0;
						t ||= 15;
						var b = function(e, t, n) {
							var r = n % 2 == 1 && n > 1;
							if (!f || e != f.x || t != f.y) {
								f && r ? (h = f.x, g = f.y) : (h = 0, g = 0);
								var i = {
									x: h + e,
									y: g + t
								};
								(r || !f) && (f = i), m.push(i), v = h + e, y = g + t;
							}
						}, x = function(e) {
							var t = e.pathSegTypeAsLetter.toUpperCase();
							if (t !== "Z") {
								switch (t) {
									case "M":
									case "L":
									case "T":
									case "C":
									case "S":
									case "Q":
										v = e.x, y = e.y;
										break;
									case "H":
										v = e.x;
										break;
									case "V": y = e.y;
								}
								b(v, y, e.pathSegType);
							}
						};
						for (r._svgPathToAbsolute(e), o = e.getTotalLength(), l = [], n = 0; n < e.pathSegList.numberOfItems; n += 1) l.push(e.pathSegList.getItem(n));
						for (u = l.concat(); _ < o;) {
							if (p = e.getPathSegAtLength(_), c = l[p], c != d) {
								for (; u.length && u[0] != c;) x(u.shift());
								d = c;
							}
							switch (c.pathSegTypeAsLetter.toUpperCase()) {
								case "C":
								case "T":
								case "S":
								case "Q":
								case "A": s = e.getPointAtLength(_), b(s.x, s.y, 0);
							}
							_ += t;
						}
						for (n = 0, a = u.length; n < a; ++n) x(u[n]);
						return m;
					}, r._svgPathToAbsolute = function(e) {
						for (var t, n, r, i, a, o, s = e.pathSegList, c = 0, l = 0, u = s.numberOfItems, d = 0; d < u; ++d) {
							var f = s.getItem(d), p = f.pathSegTypeAsLetter;
							if (/[MLHVCSQTA]/.test(p)) "x" in f && (c = f.x), "y" in f && (l = f.y);
							else switch ("x1" in f && (r = c + f.x1), "x2" in f && (a = c + f.x2), "y1" in f && (i = l + f.y1), "y2" in f && (o = l + f.y2), "x" in f && (c += f.x), "y" in f && (l += f.y), p) {
								case "m":
									s.replaceItem(e.createSVGPathSegMovetoAbs(c, l), d);
									break;
								case "l":
									s.replaceItem(e.createSVGPathSegLinetoAbs(c, l), d);
									break;
								case "h":
									s.replaceItem(e.createSVGPathSegLinetoHorizontalAbs(c), d);
									break;
								case "v":
									s.replaceItem(e.createSVGPathSegLinetoVerticalAbs(l), d);
									break;
								case "c":
									s.replaceItem(e.createSVGPathSegCurvetoCubicAbs(c, l, r, i, a, o), d);
									break;
								case "s":
									s.replaceItem(e.createSVGPathSegCurvetoCubicSmoothAbs(c, l, a, o), d);
									break;
								case "q":
									s.replaceItem(e.createSVGPathSegCurvetoQuadraticAbs(c, l, r, i), d);
									break;
								case "t":
									s.replaceItem(e.createSVGPathSegCurvetoQuadraticSmoothAbs(c, l), d);
									break;
								case "a":
									s.replaceItem(e.createSVGPathSegArcAbs(c, l, f.r1, f.r2, f.angle, f.largeArcFlag, f.sweepFlag), d);
									break;
								case "z":
								case "Z": c = t, l = n;
							}
							(p == "M" || p == "m") && (t = c, n = l);
						}
					};
				})();
			}),
			(function(e, t, n) {
				var r = {};
				e.exports = r;
				var i = n(6);
				n(0), (function() {
					r.create = i.create, r.add = i.add, r.remove = i.remove, r.clear = i.clear, r.addComposite = i.addComposite, r.addBody = i.addBody, r.addConstraint = i.addConstraint;
				})();
			})
		]);
	});
})))(), 1), F = (e) => e * Math.PI / 180, I = (e) => {
	let { kind: t, width: n, height: r } = e, i = {
		x: n / 2,
		y: r / 2
	}, a = {
		restitution: .55,
		friction: .12,
		frictionStatic: .2,
		frictionAir: .018,
		density: .0018
	};
	if (t === "automation") return {
		body: P.default.Bodies.circle(i.x, i.y, r / 2, a),
		origin: i
	};
	if (t === "hook") {
		let e = h(n, r).map((e) => P.default.Bodies.rectangle(e.x + e.width / 2, e.y + e.height / 2, e.width, e.height, a));
		return {
			body: P.default.Body.create({
				...a,
				parts: e
			}),
			origin: i
		};
	}
	if (t === "skill") {
		let e = p(n, r), t = P.default.Vertices.centre(e);
		return {
			body: P.default.Bodies.fromVertices(t.x, t.y, [e], a),
			origin: t
		};
	}
	return {
		body: P.default.Bodies.rectangle(i.x, i.y, n, r, {
			...a,
			chamfer: { radius: Math.min(n, r) * .28 }
		}),
		origin: i
	};
}, L = (e) => {
	let { body: t, origin: n } = I(e), r = {
		...e,
		body: t,
		origin: n,
		slot: void 0
	};
	return B(r, e.source), P.default.Sleeping.set(t, !0), r;
}, R = (e, t) => P.default.Vector.rotate({
	x: e.origin.x - e.width / 2,
	y: e.origin.y - e.height / 2
}, t), z = (e) => {
	let t = R(e, e.body.angle);
	return {
		x: e.body.position.x - t.x,
		y: e.body.position.y - t.y,
		angle: e.body.angle * 180 / Math.PI
	};
}, B = (e, t) => {
	P.default.Body.setAngle(e.body, F(t.angle));
	let n = R(e, e.body.angle);
	P.default.Body.setPosition(e.body, {
		x: t.x + n.x,
		y: t.y + n.y
	});
}, V = (e, t = a) => {
	let n = t, r = P.default.Engine.create({
		gravity: {
			x: 0,
			y: 1.2
		},
		enableSleeping: !0
	}), i = e.map(L), o = /* @__PURE__ */ new Map(), s = () => [
		P.default.Bodies.rectangle(n.width / 2, -30, n.width + 120, 60, { isStatic: !0 }),
		P.default.Bodies.rectangle(n.width / 2, n.height + 30, n.width + 120, 60, { isStatic: !0 }),
		P.default.Bodies.rectangle(-30, n.height / 2, 60, n.height + 120, { isStatic: !0 }),
		P.default.Bodies.rectangle(n.width + 30, n.height / 2, 60, n.height + 120, { isStatic: !0 })
	], c = s();
	P.default.Composite.add(r.world, [...c, ...i.map((e) => e.body)]);
	let l = (e) => {
		let t = o.get(e.id);
		t && P.default.Composite.remove(r.world, t.constraint), o.delete(e.id);
	}, u = (e) => {
		l(e), e.slot = void 0, P.default.Body.setStatic(e.body, !1), P.default.Sleeping.set(e.body, !1);
		let t = z(e), n = P.default.Constraint.create({
			pointA: {
				x: t.x,
				y: t.y
			},
			bodyB: e.body,
			pointB: {
				x: t.x - e.body.position.x,
				y: t.y - e.body.position.y
			},
			stiffness: .035,
			damping: .12,
			length: 0
		});
		o.set(e.id, {
			constraint: n,
			target: {
				x: t.x,
				y: t.y
			}
		}), P.default.Composite.add(r.world, n);
	}, d = (e, t) => {
		l(e), e.slot = t, B(e, {
			x: t.x,
			y: t.y,
			angle: 0
		}), P.default.Body.setStatic(e.body, !0);
	}, f = 0;
	return {
		pieces: i,
		grab: u,
		release: l,
		snap: d,
		snapshot: () => ({
			size: { ...n },
			pieces: i.map((e) => ({
				id: e.id,
				position: z(e),
				velocity: { ...P.default.Body.getVelocity(e.body) },
				angularVelocity: P.default.Body.getAngularVelocity(e.body),
				sleeping: e.body.isSleeping,
				slot: e.slot?.id
			}))
		}),
		restore: (e, t) => {
			for (let n of e.pieces) {
				let e = i.find((e) => e.id === n.id), r = t.find((e) => e.id === n.slot);
				r ? d(e, r) : (B(e, n.position), P.default.Body.setVelocity(e.body, n.velocity), P.default.Body.setAngularVelocity(e.body, n.angularVelocity), P.default.Sleeping.set(e.body, n.sleeping));
			}
		},
		resize: (e) => {
			let t = n;
			n = e;
			let a = n.width !== t.width || n.height !== t.height;
			a && (P.default.Composite.remove(r.world, c), c = s(), P.default.Composite.add(r.world, c));
			for (let e of i) {
				if (e.slot) {
					d(e, e.slot);
					continue;
				}
				if (!a) continue;
				let r = z(e);
				B(e, {
					...r,
					x: Math.max(e.width / 2, Math.min(n.width - e.width / 2, r.x / t.width * n.width)),
					y: Math.max(e.height / 2, Math.min(n.height - e.height / 2, r.y / t.height * n.height))
				});
			}
		},
		move: (e, t) => {
			let r = o.get(e.id);
			r && (r.target = {
				x: Math.max(e.width / 2, Math.min(n.width - e.width / 2, t.x)),
				y: Math.max(e.height / 2, Math.min(n.height - e.height / 2, t.y))
			});
		},
		nudge: (e, t) => {
			B(e, t), P.default.Body.setVelocity(e.body, {
				x: 0,
				y: 0
			}), P.default.Body.setAngularVelocity(e.body, 0);
		},
		step: (e) => {
			for (f += Math.min(e, 48); f >= 1e3 / 120;) {
				for (let { constraint: e, target: t } of o.values()) {
					let n = P.default.Vector.sub(t, e.pointA), r = P.default.Vector.magnitude(n), i = r > 8 ? 8 / r : 1;
					e.pointA = P.default.Vector.add(e.pointA, P.default.Vector.mult(n, i));
				}
				for (let { body: e } of i) {
					let t = P.default.Vector.magnitude(e.velocity);
					t > 18 && P.default.Body.setVelocity(e, P.default.Vector.mult(e.velocity, 18 / t));
				}
				P.default.Engine.update(r, 1e3 / 120), f -= 1e3 / 120;
			}
		},
		dispose: () => {
			P.default.Composite.clear(r.world, !1), P.default.Engine.clear(r), o.clear();
		}
	};
}, H = (e, t, n, r, i) => {
	let a = e.querySelector("[data-tool-board]"), s = a.querySelector("rect"), l = o.map((t, n) => ({
		element: e.querySelector(`[data-assembly-cursor="${n}"]`),
		tip: e.querySelector(`[data-assembly-cursor="${n}"] [data-cursor-tip]`),
		position: c(e.viewBox.baseVal.width, n),
		drift: void 0,
		visits: 0,
		job: void 0,
		restUntil: 900 + n * 850,
		angle: 0
	})), u = i?.nextPickup ?? 900, d = i?.sequence ?? 0;
	i?.agents.forEach((e, n) => {
		let { job: i, ...a } = e;
		if (Object.assign(l[n], a, { position: { ...a.position } }), i) {
			let e = t.pieces.find((e) => e.id === i.piece);
			l[n].job = {
				...i,
				piece: e,
				slot: r.find((e) => e.id === i.slot)
			}, i.phase === "carry" && t.grab(e);
		}
	});
	let f = N(e, l), p = (e, n) => {
		e.job && t.release(e.job.piece), e.job = void 0, e.drift = void 0, e.restUntil = n + 700;
	}, m = (e, r, i, a, o) => {
		if (e.job || i < e.restUntil || i < u) return;
		let s = o.find((e) => {
			if (l.some((t) => t.job?.slot === e)) return !1;
			let r = t.pieces.find((t) => t.slot === e);
			return a ? r && !n.has(r.id) : !r;
		});
		if (!s) return;
		let c = t.pieces.filter((e) => !n.has(e.id) && !l.some((t) => t.job?.piece === e) && (a ? e.slot === s : !e.slot && e.kind === s.kind)), f = c[(d * 7 + r * 3) % c.length];
		if (!f) return;
		let p = z(f);
		e.job = {
			piece: f,
			slot: s,
			clearing: a,
			phase: "approach",
			started: i,
			duration: (550 + Math.hypot(p.x - e.position.x, p.y - e.position.y) * .65) * k,
			from: { ...e.position },
			bend: (r % 2 ? -1 : 1) * (35 + d % 35)
		}, e.drift = void 0, d++, u = i + 950 * k;
	}, h = (e, n, r, i, a) => {
		e.position = A(n.from, z(n.piece), a, n.bend), !(a < 1) && (t.grab(n.piece), n.phase = "carry", n.started = i + 160, n.from = z(n.piece), n.duration = (1250 + r * 180) * k);
	}, g = (n, r, i, o, c) => {
		let l = e.viewBox.baseVal, u = new DOMPoint(s.width.baseVal.value / 2, 0).matrixTransform(a.transform.baseVal.consolidate().matrix), d = r.clearing ? {
			x: u.x + (i - 1) * 60,
			y: l.height - 110
		} : r.slot;
		t.move(r.piece, {
			...z(r.piece),
			...A(r.from, d, c, -r.bend)
		});
		let f = z(r.piece);
		n.position = f;
		let m = Math.hypot(f.x - d.x, f.y - d.y) < 14;
		c < 1 || !m && c <= 1.7 || (r.clearing ? t.release(r.piece) : t.snap(r.piece, r.slot), p(n, o));
	}, _ = (t, n, r) => {
		if (!t.drift || r >= t.drift.started + t.drift.duration) {
			let i = t.visits++, o = e.viewBox.baseVal, c = t.position.x > o.width, l = n * 2.1 + i * 2.4, u = c ? new DOMPoint(s.width.baseVal.value * (.4 + n * .15), s.height.baseVal.value * .3).matrixTransform(a.transform.baseVal.consolidate().matrix) : {
				x: t.position.x + Math.cos(l) * 28,
				y: t.position.y + Math.sin(l) * 20
			};
			t.drift = {
				from: { ...t.position },
				to: {
					x: Math.max(12, Math.min(o.width - 92, u.x)),
					y: Math.max(12, Math.min(o.height - 56, u.y))
				},
				started: r,
				duration: (c ? 1600 : 3600 + n * 240) * k,
				bend: i % 2 ? -8 : 8
			};
		}
		let { from: i, to: o, started: c, duration: l, bend: u } = t.drift;
		t.position = A(i, o, (r - c) / l, u);
	}, v = (e, r, i) => {
		let a = e.job;
		if (!a) {
			_(e, r, i);
			return;
		}
		let o = t.pieces.some((e) => e !== a.piece && e.slot === a.slot);
		if (n.has(a.piece.id) || !a.clearing && o) {
			p(e, i);
			return;
		}
		let s = (i - a.started) / a.duration;
		a.phase === "approach" ? h(e, a, r, i, s) : g(e, a, r, i, s);
	};
	return {
		update: (t, n, r, i, a = !1) => {
			let o = l.map((e) => e.position), s = f.update(t, a && !n ? i : void 0, (e) => !l[e].job);
			l.forEach((i, a) => {
				i.element.setAttribute("visibility", "visible"), m(i, a, t, n, r);
				let c = o[a], l = f.mode(a);
				s === a && l !== "chat" ? i.drift = void 0 : v(i, a, t);
				let u = i.position.x - c.x;
				i.angle += (Math.max(-12, Math.min(12, u * 2)) - i.angle) * .12, i.element.dataset.holding = i.job?.phase === "carry" ? i.job.piece.id : "";
				let d = i.job?.phase === "carry";
				if (i.element.dataset.cursorMode = d ? "grabbing" : f.mode(a), i.element.setAttribute("transform", `translate(${i.position.x + 5} ${i.position.y + 5})`), l === "chat") {
					let t = e.viewBox.baseVal, n = Math.min(288, t.width - 16), r = i.element.querySelector("[data-cursor-chat]");
					r.querySelector("foreignObject").setAttribute("width", String(n));
					let a = Math.max(8 - i.position.x, Math.min(-n / 2, t.width - i.position.x - n - 8)), o = Math.max(8 - i.position.y, Math.min(-44, t.height - i.position.y - 32 - 8));
					r.setAttribute("transform", `translate(${a} ${o})`);
				}
				i.tip.setAttribute("transform", `rotate(${f.mode(a) === "text" ? 0 : i.angle}) scale(${f.pressed(a) ? .85 : 1})`);
			});
		},
		resize: (e) => {
			for (let t of l) t.drift = void 0, t.job && (t.job.from = t.job.phase === "carry" ? z(t.job.piece) : { ...t.position }, t.job.started = e);
		},
		busy: () => l.some((e) => e.job),
		interactionsDone: f.done,
		snapshot: () => ({
			nextPickup: u,
			sequence: d,
			agents: l.map((e) => ({
				position: { ...e.position },
				drift: e.drift ? { ...e.drift } : void 0,
				visits: e.visits,
				restUntil: e.restUntil,
				angle: e.angle,
				job: e.job ? {
					...e.job,
					from: { ...e.job.from },
					piece: e.job.piece.id,
					slot: e.job.slot.id
				} : void 0
			}))
		}),
		relinquish: (e, t) => {
			for (let n of l) n.job?.piece === e && p(n, t);
		},
		hide: (e) => {
			f.reset();
			for (let t of l) p(t, e), t.element.setAttribute("visibility", "hidden"), t.element.dataset.holding = "";
		}
	};
}, U = ({ scene: e, take: t, move: n, drop: r, nudge: i }) => {
	let a, o = (e) => e.closest("[data-assembly-piece]")?.dataset.assemblyPiece, s = (t) => new DOMPoint(t.clientX, t.clientY).matrixTransform(e.getScreenCTM().inverse()), c = (n) => {
		let r = o(n.target);
		if (!r || a || n.button !== 0) return;
		n.preventDefault();
		let i = { ...t(r) };
		a = {
			id: r,
			pointer: n.pointerId,
			start: s(n),
			origin: i
		}, e.setPointerCapture(n.pointerId), e.querySelector(`[data-assembly-piece="${r}"]`).focus({ preventScroll: !0 });
	}, l = (e) => {
		if (!a || e.pointerId !== a.pointer) return;
		let t = s(e);
		n(a.id, {
			...a.origin,
			x: a.origin.x + t.x - a.start.x,
			y: a.origin.y + t.y - a.start.y
		});
	}, u = (t) => {
		a && t.pointerId === a.pointer && (t.type === "pointercancel" && i(a.id, a.origin), r(a.id, t.type !== "pointercancel"), a = void 0, e.hasPointerCapture(t.pointerId) && e.releasePointerCapture(t.pointerId));
	}, d = (n) => {
		if (n.key === "Escape" && a) {
			i(a.id, a.origin), r(a.id, !1);
			let t = a.pointer;
			a = void 0, e.releasePointerCapture(t);
			return;
		}
		let s = o(n.target);
		if (!s || ![
			"ArrowLeft",
			"ArrowRight",
			"ArrowUp",
			"ArrowDown",
			"Enter",
			" "
		].includes(n.key)) return;
		n.preventDefault();
		let c = { ...t(s) }, l = n.shiftKey ? 24 : 8;
		n.key === "ArrowLeft" && (c.x -= l), n.key === "ArrowRight" && (c.x += l), n.key === "ArrowUp" && (c.y -= l), n.key === "ArrowDown" && (c.y += l), i(s, c), r(s, n.key === "Enter" || n.key === " ");
	};
	return e.addEventListener("pointerdown", c), e.addEventListener("pointermove", l), e.addEventListener("pointerup", u), e.addEventListener("pointercancel", u), e.addEventListener("lostpointercapture", u), e.addEventListener("keydown", d), () => {
		e.removeEventListener("pointerdown", c), e.removeEventListener("pointermove", l), e.removeEventListener("pointerup", u), e.removeEventListener("pointercancel", u), e.removeEventListener("lostpointercapture", u), e.removeEventListener("keydown", d);
	};
}, W = null, G = () => W, K = (e) => {
	W = e;
}, q = (e) => `translate(${e.x} ${e.y}) rotate(${e.angle})`, J = (e, t, i) => {
	let a = G(), o = a ? l.findIndex((e) => e.id === a.example) : 0, c = () => {
		let { width: t, height: r } = e.getBoundingClientRect(), i = e.closest("[data-assembly-area]")?.querySelector("[data-download-panel]"), a = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) / 16;
		return {
			size: {
				width: t,
				height: r
			},
			layout: n({
				width: t,
				height: r
			}, i?.getBoundingClientRect() ?? {
				width: s.width * a,
				height: 0
			}, l[o], a)
		};
	}, u = c();
	e.setAttribute("viewBox", `0 0 ${u.size.width} ${u.size.height}`);
	let d = e.querySelector("[data-assembly-pile]");
	d.setAttribute("x", "0"), d.setAttribute("y", "0");
	let f = u.layout.slots, p = V(r(u.size, u.layout.board), a?.physics.size ?? u.size);
	a && (p.restore(a.physics, f), p.resize(u.size));
	let m = new Map(a?.claimed), h = H(e, p, m, f, a?.agents), g = p.pieces.map((t) => ({
		piece: t,
		element: e.querySelector(`[data-assembly-piece="${t.id}"]`)
	})), _ = a?.clearing ?? !1, v = a?.completedAt, y = "", b = a?.elapsed ?? 0, x = 0, S = 0, C = !1, w = !1, T = () => l[o], E = () => f.filter((e) => T().blocks.some((t) => t.kind === e.kind)), D = (e) => p.pieces.some((t) => t.slot === e), O = () => {
		for (let { piece: e, element: t } of g) t.setAttribute("transform", q(z(e))), t.dataset.placed = String(!!e.slot), t.dataset.slot = e.slot?.id ?? "";
		let e = E().filter(D).map((e) => e.kind), n = `${o}:${e.join(",")}`;
		y !== n && (y = n, t({
			example: T().id,
			parts: e
		}));
	}, k = () => {
		let { size: t, layout: n } = c();
		t.width && t.height && (e.setAttribute("viewBox", `0 0 ${t.width} ${t.height}`), i(n.board), n.slots.forEach((e, t) => {
			Object.assign(f[t], e);
		}), p.resize(t), h.resize(b), O());
	}, A = () => {
		let e = E();
		_ ? !e.some(D) && !h.busy() && (o = (o + 1) % l.length, v = void 0, _ = !1, k()) : (e.every(D) ? v ??= b : v = void 0, v !== void 0 && b - v > 4800 && h.interactionsDone() && (_ = !0)), h.update(b, _, E(), T().id, v !== void 0);
	}, j = (e) => {
		let t = S ? Math.min(e - S, 48) : 1e3 / 60;
		S = e, b += t;
		for (let [e, t] of m) b >= t && m.delete(e);
		w || A(), p.step(t), O(), C && (x = requestAnimationFrame(j));
	}, M = () => {
		cancelAnimationFrame(x), S = 0;
	}, N = U({
		scene: e,
		take: (e) => {
			let { piece: t, element: n } = g.find((t) => t.piece.id === e);
			return m.set(e, Infinity), h.relinquish(t, b), p.grab(t), n.dataset.dragging = "true", O(), z(t);
		},
		move: (e, t) => p.move(g.find((t) => t.piece.id === e).piece, t),
		drop: (e, t) => {
			let { piece: n, element: r } = g.find((t) => t.piece.id === e), i = z(n);
			p.release(n);
			let a = E().filter((e) => e.kind === n.kind && !D(e)), o = (e) => Math.hypot(i.x - e.x, i.y - e.y);
			a.sort((e, t) => o(e) - o(t)), t && a[0] && o(a[0]) < 44 && p.snap(n, a[0]), m.set(e, b + 4e3), r.dataset.dragging = "false", O();
		},
		nudge: (e, t) => p.nudge(g.find((t) => t.piece.id === e).piece, t)
	});
	return k(), h.update(b, _, E(), T().id, v !== void 0), O(), {
		resize: k,
		sync: (e, t) => {
			M(), C = e, w = t, w && h.hide(b), C && (x = requestAnimationFrame(j));
		},
		destroy: () => {
			M(), K({
				example: T().id,
				elapsed: b,
				completedAt: v,
				clearing: _,
				claimed: [...m].map(([e, t]) => [e, Number.isFinite(t) ? t : b + 4e3]),
				physics: p.snapshot(),
				agents: h.snapshot()
			}), N(), p.dispose();
		}
	};
}, Y = () => {
	let e = x(null), [t, r] = S({
		example: "icons",
		parts: []
	}), [i, o] = S(() => n(a).board), [s, c] = S(!1);
	return b(() => {
		let t = e.current, n = window.matchMedia("(prefers-reduced-motion: reduce)"), i = J(t, r, o);
		c(!0);
		let a = t.getBoundingClientRect(), s = a.bottom > 0 && a.top < window.innerHeight && a.right > 0 && a.left < window.innerWidth, l = () => i.sync(s && document.visibilityState === "visible", n.matches);
		l();
		let u = new IntersectionObserver(([e]) => {
			s = e.isIntersecting, l();
		}), d = new ResizeObserver(() => i.resize());
		d.observe(t);
		let f = t.closest("[data-assembly-area]")?.querySelector("[data-download-panel]");
		return f && d.observe(f), u.observe(t), document.addEventListener("visibilitychange", l), n.addEventListener("change", l), () => {
			d.disconnect(), u.disconnect(), document.removeEventListener("visibilitychange", l), n.removeEventListener("change", l), i.destroy();
		};
	}, []), {
		sceneRef: e,
		view: t,
		board: i,
		ready: s
	};
}, X = () => {
	let { sceneRef: e, view: t, board: n, ready: r } = Y(), s = T({ recipe: g })({}), l = y(), u = y();
	return /* @__PURE__ */ E(C, {
		css: s.root,
		children: /* @__PURE__ */ D(w.svg, {
			ref: e,
			css: s.scene,
			"data-assembly-ready": r,
			role: "group",
			"aria-labelledby": l,
			"aria-describedby": u,
			children: [
				/* @__PURE__ */ E("title", {
					id: l,
					children: "Build tools with draggable shapes"
				}),
				/* @__PURE__ */ E("desc", {
					id: u,
					children: "Drag or toss shapes anywhere in the main area. Loose shapes fall and collide. Drop a matching shape into a board to build part of a tool. Cursors take turns building different tools and yield the shape you grab. Arrow keys move a focused shape; Enter docks it in a nearby slot."
				}),
				/* @__PURE__ */ E(v, {
					view: t,
					...n
				}),
				/* @__PURE__ */ E(w.svg, {
					css: s.pile,
					asChild: !0,
					children: /* @__PURE__ */ D("svg", {
						x: "50%",
						y: "100%",
						width: "1",
						height: "1",
						"data-assembly-pile": "",
						children: [/* @__PURE__ */ E("title", { children: "Draggable shapes" }), i.map((e) => /* @__PURE__ */ E(w.g, {
							css: s.piece,
							asChild: !0,
							role: "button",
							tabIndex: 0,
							"aria-label": `Drag ${e.kind} building block`,
							"data-tool-shape": e.kind,
							"data-assembly-piece": e.id,
							children: /* @__PURE__ */ D("g", {
								transform: `translate(${e.source.x} ${e.source.y}) rotate(${e.source.angle})`,
								children: [/* @__PURE__ */ E("rect", {
									x: -Math.max(e.width, 32) / 2,
									y: -Math.max(e.height, 32) / 2,
									width: Math.max(e.width, 32),
									height: Math.max(e.height, 32),
									fill: "transparent"
								}), /* @__PURE__ */ E("g", {
									transform: `translate(${-e.width / 2} ${-e.height / 2})`,
									children: /* @__PURE__ */ E(m, {
										kind: e.kind,
										size: e.height,
										width: e.width
									})
								})]
							})
						}, e.id))]
					})
				}),
				o.map((e, t) => /* @__PURE__ */ E(_, {
					name: e,
					index: t,
					point: c(a.width, t)
				}, e))
			]
		})
	});
};
export { X as t };
