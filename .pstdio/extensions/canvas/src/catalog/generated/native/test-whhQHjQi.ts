// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { r as e } from "./rolldown-runtime-CwxnZyOB.ts";
import { n as t, r as n, t as r } from "./dom.esm-CP053Ko5.ts";
// node_modules/.bun/storybook@10.6.0+a21bf98ed7e5a9e2/node_modules/storybook/dist/_browser-chunks/chunk-IMSF75WX.js
var i = Object.create, a = Object.defineProperty, o = Object.getOwnPropertyDescriptor, s = Object.getOwnPropertyNames, c = Object.getPrototypeOf, l = Object.prototype.hasOwnProperty, u = /* @__PURE__ */ ((t) => typeof e < "u" ? e : typeof Proxy < "u" ? new Proxy(t, { get: (t, n) => (typeof e < "u" ? e : t)[n] }) : t)(function(t) {
	if (typeof e < "u") return e.apply(this, arguments);
	throw Error("Dynamic require of \"" + t + "\" is not supported");
}), d = (e, t) => function() {
	try {
		return t || (0, e[s(e)[0]])((t = { exports: {} }).exports, t), t.exports;
	} catch (e) {
		throw t = 0, e;
	}
}, f = (e, t) => {
	for (var n in t) a(e, n, {
		get: t[n],
		enumerable: !0
	});
}, p = (e, t, n, r) => {
	if (t && typeof t == "object" || typeof t == "function") for (let i of s(t)) !l.call(e, i) && i !== n && a(e, i, {
		get: () => t[i],
		enumerable: !(r = o(t, i)) || r.enumerable
	});
	return e;
}, m = (e, t, n) => (n = e == null ? {} : i(c(e)), p(t || !e || !e.__esModule ? a(n, "default", {
	value: e,
	enumerable: !0
}) : n, e)), h = d({ "../../node_modules/picocolors/picocolors.browser.ts"(e, t) {
	var n = String, r = function() {
		return {
			isColorSupported: !1,
			reset: n,
			bold: n,
			dim: n,
			italic: n,
			underline: n,
			inverse: n,
			hidden: n,
			strikethrough: n,
			black: n,
			red: n,
			green: n,
			yellow: n,
			blue: n,
			magenta: n,
			cyan: n,
			white: n,
			gray: n,
			bgBlack: n,
			bgRed: n,
			bgGreen: n,
			bgYellow: n,
			bgBlue: n,
			bgMagenta: n,
			bgCyan: n,
			bgWhite: n,
			blackBright: n,
			redBright: n,
			greenBright: n,
			yellowBright: n,
			blueBright: n,
			magentaBright: n,
			cyanBright: n,
			whiteBright: n,
			bgBlackBright: n,
			bgRedBright: n,
			bgGreenBright: n,
			bgYellowBright: n,
			bgBlueBright: n,
			bgMagentaBright: n,
			bgCyanBright: n,
			bgWhiteBright: n
		};
	};
	t.exports = r(), t.exports.createColors = r;
} });
// node_modules/.bun/storybook@10.6.0+a21bf98ed7e5a9e2/node_modules/storybook/dist/_browser-chunks/chunk-3LY4VQVK.js
function g(e) {
	var t = [...arguments].slice(1), n = Array.from(typeof e == "string" ? [e] : e);
	n[n.length - 1] = n[n.length - 1].replace(/\r?\n([\t ]*)$/, "");
	var r = n.reduce(function(e, t) {
		var n = t.match(/\n([\t ]+|(?!\s).)/g);
		return n ? e.concat(n.map(function(e) {
			return e.match(/[\t ]/g)?.length ?? 0;
		})) : e;
	}, []);
	if (r.length) {
		var i = RegExp("\n[	 ]{" + Math.min.apply(Math, r) + "}", "g");
		n = n.map(function(e) {
			return e.replace(i, "\n");
		});
	}
	n[0] = n[0].replace(/^\r?\n/, "");
	var a = n[0];
	return t.forEach(function(e, t) {
		var r = a.match(/(?:^|\n)( *)$/), i = r ? r[1] : "", o = e;
		typeof e == "string" && e.includes("\n") && (o = String(e).split("\n").map(function(e, t) {
			return t === 0 ? e : "" + i + e;
		}).join("\n")), a += o + n[t + 1];
	}), a;
}
// node_modules/.bun/storybook@10.6.0+a21bf98ed7e5a9e2/node_modules/storybook/dist/client-logger/index.js
var { LOGLEVEL: _ } = n, v = {
	trace: 1,
	debug: 2,
	info: 3,
	warn: 4,
	error: 5,
	silent: 10
}, y = v[_] || v.info, b = {
	trace: (e, ...t) => {
		y <= v.trace && console.trace(e, ...t);
	},
	debug: (e, ...t) => {
		y <= v.debug && console.debug(e, ...t);
	},
	info: (e, ...t) => {
		y <= v.info && console.info(e, ...t);
	},
	warn: (e, ...t) => {
		y <= v.warn && console.warn(e, ...t);
	},
	error: (e, ...t) => {
		y <= v.error && console.error(e, ...t);
	},
	log: (e, ...t) => {
		y < v.silent && console.log(e, ...t);
	}
}, x = /* @__PURE__ */ new Set(), S = (e) => (t, ...n) => {
	if (!x.has(t)) return x.add(t), b[e](t, ...n);
};
S.clear = () => x.clear(), S.trace = S("trace"), S.debug = S("debug"), S.info = S("info"), S.warn = S("warn"), S.error = S("error"), S.log = S("log");
var ee = S("warn"), C = (e) => (...t) => {
	let n = [];
	if (t.length) {
		let e = /<span\s+style=(['"])([^'"]*)\1\s*>/gi, r = /<\/span>/gi, i;
		for (n.push(t[0].replace(e, "%c").replace(r, "%c")); i = e.exec(t[0]);) n.push(i[2]), n.push("");
		for (let e = 1; e < t.length; e++) n.push(t[e]);
	}
	b[e].apply(b, n);
};
C.trace = C("trace"), C.debug = C("debug"), C.info = C("info"), C.warn = C("warn"), C.error = C("error");
// node_modules/.bun/storybook@10.6.0+a21bf98ed7e5a9e2/node_modules/storybook/dist/core-events/index.js
var w = /* @__PURE__ */ ((e) => (e.CHANNEL_WS_DISCONNECT = "channelWSDisconnect", e.CHANNEL_CREATED = "channelCreated", e.CONFIG_ERROR = "configError", e.STORY_INDEX_INVALIDATED = "storyIndexInvalidated", e.STORY_SPECIFIED = "storySpecified", e.SET_CONFIG = "setConfig", e.SET_STORIES = "setStories", e.SET_INDEX = "setIndex", e.SET_CURRENT_STORY = "setCurrentStory", e.CURRENT_STORY_WAS_SET = "currentStoryWasSet", e.FORCE_RE_RENDER = "forceReRender", e.FORCE_REMOUNT = "forceRemount", e.PRELOAD_ENTRIES = "preloadStories", e.STORY_PREPARED = "storyPrepared", e.DOCS_PREPARED = "docsPrepared", e.STORY_CHANGED = "storyChanged", e.STORY_UNCHANGED = "storyUnchanged", e.STORY_RENDERED = "storyRendered", e.STORY_FINISHED = "storyFinished", e.STORY_MISSING = "storyMissing", e.STORY_ERRORED = "storyErrored", e.STORY_THREW_EXCEPTION = "storyThrewException", e.STORY_RENDER_PHASE_CHANGED = "storyRenderPhaseChanged", e.STORY_HOT_UPDATED = "storyHotUpdated", e.PLAY_FUNCTION_THREW_EXCEPTION = "playFunctionThrewException", e.UNHANDLED_ERRORS_WHILE_PLAYING = "unhandledErrorsWhilePlaying", e.UPDATE_STORY_ARGS = "updateStoryArgs", e.STORY_ARGS_UPDATED = "storyArgsUpdated", e.RESET_STORY_ARGS = "resetStoryArgs", e.SET_FILTER = "setFilter", e.SET_GLOBALS = "setGlobals", e.UPDATE_GLOBALS = "updateGlobals", e.GLOBALS_UPDATED = "globalsUpdated", e.REGISTER_SUBSCRIPTION = "registerSubscription", e.PREVIEW_INITIALIZED = "previewInitialized", e.PREVIEW_KEYDOWN = "previewKeydown", e.PREVIEW_BUILDER_PROGRESS = "preview_builder_progress", e.SELECT_STORY = "selectStory", e.STORIES_COLLAPSE_ALL = "storiesCollapseAll", e.STORIES_EXPAND_ALL = "storiesExpandAll", e.DOCS_RENDERED = "docsRendered", e.SHARED_STATE_CHANGED = "sharedStateChanged", e.SHARED_STATE_SET = "sharedStateSet", e.NAVIGATE_URL = "navigateUrl", e.UPDATE_QUERY_PARAMS = "updateQueryParams", e.REQUEST_WHATS_NEW_DATA = "requestWhatsNewData", e.RESULT_WHATS_NEW_DATA = "resultWhatsNewData", e.SET_WHATS_NEW_CACHE = "setWhatsNewCache", e.TOGGLE_WHATS_NEW_NOTIFICATIONS = "toggleWhatsNewNotifications", e.TELEMETRY_ERROR = "telemetryError", e.FILE_COMPONENT_SEARCH_REQUEST = "fileComponentSearchRequest", e.FILE_COMPONENT_SEARCH_RESPONSE = "fileComponentSearchResponse", e.SAVE_STORY_REQUEST = "saveStoryRequest", e.SAVE_STORY_RESPONSE = "saveStoryResponse", e.ARGTYPES_INFO_REQUEST = "argtypesInfoRequest", e.ARGTYPES_INFO_RESPONSE = "argtypesInfoResponse", e.CREATE_NEW_STORYFILE_REQUEST = "createNewStoryfileRequest", e.CREATE_NEW_STORYFILE_RESPONSE = "createNewStoryfileResponse", e.GHOST_STORIES_REQUEST = "ghostStoriesRequest", e.GHOST_STORIES_RESPONSE = "ghostStoriesResponse", e.AI_SETUP_ANALYTICS_RESPONSE = "aiSetupAnalyticsResponse", e.AI_SETUP_ANALYTICS_REQUEST = "aiSetupAnalyticsRequest", e.OPEN_IN_EDITOR_REQUEST = "openInEditorRequest", e.OPEN_IN_EDITOR_RESPONSE = "openInEditorResponse", e.MANAGER_INERT_ATTRIBUTE_CHANGED = "managerInertAttributeChanged", e.SHARE_ISOLATE_MODE = "shareIsolateMode", e.AI_PROMPT_NUDGE = "aiPromptNudge", e.SIDEBAR_FILTER_CHANGED = "sidebarFilterChanged", e))(w || {}), { CHANNEL_WS_DISCONNECT: te, CHANNEL_CREATED: T, CONFIG_ERROR: ne, CREATE_NEW_STORYFILE_REQUEST: re, CREATE_NEW_STORYFILE_RESPONSE: ie, CURRENT_STORY_WAS_SET: ae, DOCS_PREPARED: E, DOCS_RENDERED: oe, FILE_COMPONENT_SEARCH_REQUEST: D, FILE_COMPONENT_SEARCH_RESPONSE: se, FORCE_RE_RENDER: ce, FORCE_REMOUNT: le, GLOBALS_UPDATED: ue, NAVIGATE_URL: de, PLAY_FUNCTION_THREW_EXCEPTION: fe, UNHANDLED_ERRORS_WHILE_PLAYING: pe, PRELOAD_ENTRIES: O, PREVIEW_INITIALIZED: me, PREVIEW_BUILDER_PROGRESS: he, PREVIEW_KEYDOWN: ge, REGISTER_SUBSCRIPTION: _e, RESET_STORY_ARGS: ve, SELECT_STORY: ye, SET_CONFIG: be, SET_CURRENT_STORY: xe, SET_FILTER: Se, SET_GLOBALS: Ce, SET_INDEX: we, SET_STORIES: Te, SHARED_STATE_CHANGED: Ee, SHARED_STATE_SET: De, STORIES_COLLAPSE_ALL: Oe, STORIES_EXPAND_ALL: ke, STORY_ARGS_UPDATED: Ae, STORY_CHANGED: je, STORY_ERRORED: Me, STORY_INDEX_INVALIDATED: Ne, STORY_MISSING: Pe, STORY_PREPARED: Fe, STORY_RENDER_PHASE_CHANGED: Ie, STORY_RENDERED: Le, STORY_FINISHED: Re, STORY_SPECIFIED: ze, STORY_THREW_EXCEPTION: Be, STORY_UNCHANGED: Ve, STORY_HOT_UPDATED: He, UPDATE_GLOBALS: Ue, UPDATE_QUERY_PARAMS: We, UPDATE_STORY_ARGS: Ge, REQUEST_WHATS_NEW_DATA: Ke, RESULT_WHATS_NEW_DATA: qe, SET_WHATS_NEW_CACHE: Je, TOGGLE_WHATS_NEW_NOTIFICATIONS: Ye, TELEMETRY_ERROR: Xe, SAVE_STORY_REQUEST: Ze, SAVE_STORY_RESPONSE: Qe, ARGTYPES_INFO_REQUEST: $e, ARGTYPES_INFO_RESPONSE: et, GHOST_STORIES_REQUEST: k, GHOST_STORIES_RESPONSE: tt, AI_SETUP_ANALYTICS_RESPONSE: nt, AI_SETUP_ANALYTICS_REQUEST: rt, OPEN_IN_EDITOR_REQUEST: it, OPEN_IN_EDITOR_RESPONSE: at, MANAGER_INERT_ATTRIBUTE_CHANGED: ot, SHARE_ISOLATE_MODE: st, AI_PROMPT_NUDGE: ct, SIDEBAR_FILTER_CHANGED: lt } = w, ut = Object.entries({
	reset: [0, 0],
	bold: [
		1,
		22,
		"\x1B[22m\x1B[1m"
	],
	dim: [
		2,
		22,
		"\x1B[22m\x1B[2m"
	],
	italic: [3, 23],
	underline: [4, 24],
	inverse: [7, 27],
	hidden: [8, 28],
	strikethrough: [9, 29],
	black: [30, 39],
	red: [31, 39],
	green: [32, 39],
	yellow: [33, 39],
	blue: [34, 39],
	magenta: [35, 39],
	cyan: [36, 39],
	white: [37, 39],
	gray: [90, 39],
	bgBlack: [40, 49],
	bgRed: [41, 49],
	bgGreen: [42, 49],
	bgYellow: [43, 49],
	bgBlue: [44, 49],
	bgMagenta: [45, 49],
	bgCyan: [46, 49],
	bgWhite: [47, 49],
	blackBright: [90, 39],
	redBright: [91, 39],
	greenBright: [92, 39],
	yellowBright: [93, 39],
	blueBright: [94, 39],
	magentaBright: [95, 39],
	cyanBright: [96, 39],
	whiteBright: [97, 39],
	bgBlackBright: [100, 49],
	bgRedBright: [101, 49],
	bgGreenBright: [102, 49],
	bgYellowBright: [103, 49],
	bgBlueBright: [104, 49],
	bgMagentaBright: [105, 49],
	bgCyanBright: [106, 49],
	bgWhiteBright: [107, 49]
});
function dt(e) {
	return String(e);
}
dt.open = "", dt.close = "", ut.reduce((e, [t]) => (e[t] = dt, e), { isColorSupported: !1 });
function ft(e = !1) {
	let t = typeof process < "u" ? process : void 0, n = t?.env || {}, r = t?.argv || [];
	return !("NO_COLOR" in n || r.includes("--no-color")) && ("FORCE_COLOR" in n || r.includes("--color") || t?.platform === "win32" || e && n.TERM !== "dumb" || "CI" in n) || typeof window < "u" && !!window.chrome;
}
function pt(e = !1) {
	let t = ft(e), n = (e, t, n, r) => {
		let i = "", a = 0;
		do
			i += e.substring(a, r) + n, a = r + t.length, r = e.indexOf(t, a);
		while (~r);
		return i + e.substring(a);
	}, r = (e, t, r = e) => {
		let i = (i) => {
			let a = String(i), o = a.indexOf(t, e.length);
			return ~o ? e + n(a, t, r, o) + t : e + a + t;
		};
		return i.open = e, i.close = t, i;
	}, i = { isColorSupported: t }, a = (e) => `\x1B[${e}m`;
	for (let [e, n] of ut) i[e] = t ? r(a(n[0]), a(n[1]), n[2]) : dt;
	return i;
}
var mt = pt();
function ht(e, t) {
	return t.forEach(function(t) {
		t && typeof t != "string" && !Array.isArray(t) && Object.keys(t).forEach(function(n) {
			if (n !== "default" && !(n in e)) {
				var r = Object.getOwnPropertyDescriptor(t, n);
				Object.defineProperty(e, n, r.get ? r : {
					enumerable: !0,
					get: function() {
						return t[n];
					}
				});
			}
		});
	}), Object.freeze(e);
}
function gt(e, t) {
	let n = Object.keys(e), r = t === null ? n : n.sort(t);
	if (Object.getOwnPropertySymbols) for (let t of Object.getOwnPropertySymbols(e)) Object.getOwnPropertyDescriptor(e, t).enumerable && r.push(t);
	return r;
}
function _t(e, t, n, r, i, a, o = ": ") {
	let s = "", c = 0, l = e.next();
	if (!l.done) {
		s += t.spacingOuter;
		let u = n + t.indent;
		for (; !l.done;) {
			if (s += u, c++ === t.maxWidth) {
				s += "…";
				break;
			}
			let n = a(l.value[0], t, u, r, i), d = a(l.value[1], t, u, r, i);
			s += n + o + d, l = e.next(), l.done ? t.min || (s += ",") : s += `,${t.spacingInner}`;
		}
		s += t.spacingOuter + n;
	}
	return s;
}
function vt(e, t, n, r, i, a) {
	let o = "", s = 0, c = e.next();
	if (!c.done) {
		o += t.spacingOuter;
		let l = n + t.indent;
		for (; !c.done;) {
			if (o += l, s++ === t.maxWidth) {
				o += "…";
				break;
			}
			o += a(c.value, t, l, r, i), c = e.next(), c.done ? t.min || (o += ",") : o += `,${t.spacingInner}`;
		}
		o += t.spacingOuter + n;
	}
	return o;
}
function yt(e, t, n, r, i, a) {
	let o = "";
	e = e instanceof ArrayBuffer ? new DataView(e) : e;
	let s = (e) => e instanceof DataView, c = s(e) ? e.byteLength : e.length;
	if (c > 0) {
		o += t.spacingOuter;
		let l = n + t.indent;
		for (let n = 0; n < c; n++) {
			if (o += l, n === t.maxWidth) {
				o += "…";
				break;
			}
			(s(e) || n in e) && (o += a(s(e) ? e.getInt8(n) : e[n], t, l, r, i)), n < c - 1 ? o += `,${t.spacingInner}` : t.min || (o += ",");
		}
		o += t.spacingOuter + n;
	}
	return o;
}
function bt(e, t, n, r, i, a) {
	let o = "", s = gt(e, t.compareKeys);
	if (s.length > 0) {
		o += t.spacingOuter;
		let c = n + t.indent;
		for (let n = 0; n < s.length; n++) {
			let l = s[n], u = a(l, t, c, r, i), d = a(e[l], t, c, r, i);
			o += `${c + u}: ${d}`, n < s.length - 1 ? o += `,${t.spacingInner}` : t.min || (o += ",");
		}
		o += t.spacingOuter + n;
	}
	return o;
}
var xt = typeof Symbol == "function" && Symbol.for ? /* @__PURE__ */ Symbol.for("jest.asymmetricMatcher") : 1267621, St = " ", Ct = {
	serialize: (e, t, n, r, i, a) => {
		let o = e.toString();
		if (o === "ArrayContaining" || o === "ArrayNotContaining") return ++r > t.maxDepth ? `[${o}]` : `${o + St}[${yt(e.sample, t, n, r, i, a)}]`;
		if (o === "ObjectContaining" || o === "ObjectNotContaining") return ++r > t.maxDepth ? `[${o}]` : `${o + St}{${bt(e.sample, t, n, r, i, a)}}`;
		if (o === "StringMatching" || o === "StringNotMatching" || o === "StringContaining" || o === "StringNotContaining") return o + St + a(e.sample, t, n, r, i);
		if (typeof e.toAsymmetricMatcher != "function") throw TypeError(`Asymmetric matcher ${e.constructor.name} does not implement toAsymmetricMatcher()`);
		return e.toAsymmetricMatcher();
	},
	test: (e) => e && e.$$typeof === xt
}, wt = " ", Tt = /* @__PURE__ */ new Set(["DOMStringMap", "NamedNodeMap"]), Et = /^(?:HTML\w*Collection|NodeList)$/;
function Dt(e) {
	return Tt.has(e) || Et.test(e);
}
var Ot = (e) => e && e.constructor && !!e.constructor.name && Dt(e.constructor.name);
function kt(e) {
	return e.constructor.name === "NamedNodeMap";
}
var At = {
	serialize: (e, t, n, r, i, a) => {
		let o = e.constructor.name;
		return ++r > t.maxDepth ? `[${o}]` : (t.min ? "" : o + wt) + (Tt.has(o) ? `{${bt(kt(e) ? [...e].reduce((e, t) => (e[t.name] = t.value, e), {}) : { ...e }, t, n, r, i, a)}}` : `[${yt([...e], t, n, r, i, a)}]`);
	},
	test: Ot
};
function jt(e) {
	return e.replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function Mt(e, t, n, r, i, a, o) {
	let s = r + n.indent, c = n.colors;
	return e.map((e) => {
		let l = t[e], u = o(l, n, s, i, a);
		return typeof l != "string" && (u.includes("\n") && (u = n.spacingOuter + s + u + n.spacingOuter + r), u = `{${u}}`), `${n.spacingInner + r + c.prop.open + e + c.prop.close}=${c.value.open}${u}${c.value.close}`;
	}).join("");
}
function Nt(e, t, n, r, i, a) {
	return e.map((e) => t.spacingOuter + n + (typeof e == "string" ? Pt(e, t) : a(e, t, n, r, i))).join("");
}
function Pt(e, t) {
	let n = t.colors.content;
	return n.open + jt(e) + n.close;
}
function Ft(e, t) {
	let n = t.colors.comment;
	return `${n.open}<!--${jt(e)}-->${n.close}`;
}
function It(e, t, n, r, i) {
	let a = r.colors.tag;
	return `${a.open}<${e}${t && a.close + t + r.spacingOuter + i + a.open}${n ? `>${a.close}${n}${r.spacingOuter}${i}${a.open}</${e}` : `${t && !r.min ? "" : " "}/`}>${a.close}`;
}
function Lt(e, t) {
	let n = t.colors.tag;
	return `${n.open}<${e}${n.close} \u2026${n.open} />${n.close}`;
}
var Rt = 1, zt = 3, Bt = 8, Vt = 11, Ht = /^(?:(?:HTML|SVG)\w*)?Element$/;
function Ut(e) {
	try {
		return typeof e.hasAttribute == "function" && e.hasAttribute("is");
	} catch {
		return !1;
	}
}
function Wt(e) {
	let t = e.constructor.name, { nodeType: n, tagName: r } = e, i = typeof r == "string" && r.includes("-") || Ut(e);
	return n === Rt && (Ht.test(t) || i) || n === zt && t === "Text" || n === Bt && t === "Comment" || n === Vt && t === "DocumentFragment";
}
var Gt = (e) => {
	var t;
	return (e == null || (t = e.constructor) == null ? void 0 : t.name) && Wt(e);
};
function Kt(e) {
	return e.nodeType === zt;
}
function qt(e) {
	return e.nodeType === Bt;
}
function Jt(e) {
	return e.nodeType === Vt;
}
var Yt = {
	serialize: (e, t, n, r, i, a) => {
		if (Kt(e)) return Pt(e.data, t);
		if (qt(e)) return Ft(e.data, t);
		let o = Jt(e) ? "DocumentFragment" : e.tagName.toLowerCase();
		return ++r > t.maxDepth ? Lt(o, t) : It(o, Mt(Jt(e) ? [] : Array.from(e.attributes, (e) => e.name).sort(), Jt(e) ? {} : [...e.attributes].reduce((e, t) => (e[t.name] = t.value, e), {}), t, n + t.indent, r, i, a), Nt(Array.prototype.slice.call(e.childNodes || e.children), t, n + t.indent, r, i, a), t, n);
	},
	test: Gt
}, Xt = "@@__IMMUTABLE_ITERABLE__@@", Zt = "@@__IMMUTABLE_LIST__@@", Qt = "@@__IMMUTABLE_KEYED__@@", $t = "@@__IMMUTABLE_MAP__@@", en = "@@__IMMUTABLE_ORDERED__@@", tn = "@@__IMMUTABLE_RECORD__@@", nn = "@@__IMMUTABLE_SEQ__@@", rn = "@@__IMMUTABLE_SET__@@", an = "@@__IMMUTABLE_STACK__@@", on = (e) => `Immutable.${e}`, sn = (e) => `[${e}]`, cn = " ", ln = "…";
function un(e, t, n, r, i, a, o) {
	return ++r > t.maxDepth ? sn(on(o)) : `${on(o) + cn}{${_t(e.entries(), t, n, r, i, a)}}`;
}
function dn(e) {
	let t = 0;
	return { next() {
		if (t < e._keys.length) {
			let n = e._keys[t++];
			return {
				done: !1,
				value: [n, e.get(n)]
			};
		}
		return {
			done: !0,
			value: void 0
		};
	} };
}
function fn(e, t, n, r, i, a) {
	let o = on(e._name || "Record");
	return ++r > t.maxDepth ? sn(o) : `${o + cn}{${_t(dn(e), t, n, r, i, a)}}`;
}
function pn(e, t, n, r, i, a) {
	let o = on("Seq");
	return ++r > t.maxDepth ? sn(o) : e[Qt] ? `${o + cn}{${e._iter || e._object ? _t(e.entries(), t, n, r, i, a) : ln}}` : `${o + cn}[${e._iter || e._array || e._collection || e._iterable ? vt(e.values(), t, n, r, i, a) : ln}]`;
}
function mn(e, t, n, r, i, a, o) {
	return ++r > t.maxDepth ? sn(on(o)) : `${on(o) + cn}[${vt(e.values(), t, n, r, i, a)}]`;
}
var hn = {
	serialize: (e, t, n, r, i, a) => e[$t] ? un(e, t, n, r, i, a, e[en] ? "OrderedMap" : "Map") : e[Zt] ? mn(e, t, n, r, i, a, "List") : e[rn] ? mn(e, t, n, r, i, a, e[en] ? "OrderedSet" : "Set") : e[an] ? mn(e, t, n, r, i, a, "Stack") : e[nn] ? pn(e, t, n, r, i, a) : fn(e, t, n, r, i, a),
	test: (e) => e && (e[Xt] === !0 || e[tn] === !0)
};
function gn(e) {
	return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}
var _n = { exports: {} }, A = {}, vn;
function yn() {
	if (vn) return A;
	vn = 1;
	var e = /* @__PURE__ */ Symbol.for("react.transitional.element"), t = /* @__PURE__ */ Symbol.for("react.portal"), n = /* @__PURE__ */ Symbol.for("react.fragment"), r = /* @__PURE__ */ Symbol.for("react.strict_mode"), i = /* @__PURE__ */ Symbol.for("react.profiler"), a = /* @__PURE__ */ Symbol.for("react.consumer"), o = /* @__PURE__ */ Symbol.for("react.context"), s = /* @__PURE__ */ Symbol.for("react.forward_ref"), c = /* @__PURE__ */ Symbol.for("react.suspense"), l = /* @__PURE__ */ Symbol.for("react.suspense_list"), u = /* @__PURE__ */ Symbol.for("react.memo"), d = /* @__PURE__ */ Symbol.for("react.lazy"), f = /* @__PURE__ */ Symbol.for("react.view_transition"), p = /* @__PURE__ */ Symbol.for("react.client.reference");
	function m(p) {
		if (typeof p == "object" && p) {
			var m = p.$$typeof;
			switch (m) {
				case e: switch (p = p.type, p) {
					case n:
					case i:
					case r:
					case c:
					case l:
					case f: return p;
					default: switch (p &&= p.$$typeof, p) {
						case o:
						case s:
						case d:
						case u: return p;
						case a: return p;
						default: return m;
					}
				}
				case t: return m;
			}
		}
	}
	return A.ContextConsumer = a, A.ContextProvider = o, A.Element = e, A.ForwardRef = s, A.Fragment = n, A.Lazy = d, A.Memo = u, A.Portal = t, A.Profiler = i, A.StrictMode = r, A.Suspense = c, A.SuspenseList = l, A.isContextConsumer = function(e) {
		return m(e) === a;
	}, A.isContextProvider = function(e) {
		return m(e) === o;
	}, A.isElement = function(t) {
		return typeof t == "object" && !!t && t.$$typeof === e;
	}, A.isForwardRef = function(e) {
		return m(e) === s;
	}, A.isFragment = function(e) {
		return m(e) === n;
	}, A.isLazy = function(e) {
		return m(e) === d;
	}, A.isMemo = function(e) {
		return m(e) === u;
	}, A.isPortal = function(e) {
		return m(e) === t;
	}, A.isProfiler = function(e) {
		return m(e) === i;
	}, A.isStrictMode = function(e) {
		return m(e) === r;
	}, A.isSuspense = function(e) {
		return m(e) === c;
	}, A.isSuspenseList = function(e) {
		return m(e) === l;
	}, A.isValidElementType = function(e) {
		return typeof e == "string" || typeof e == "function" || e === n || e === i || e === r || e === c || e === l || typeof e == "object" && !!e && (e.$$typeof === d || e.$$typeof === u || e.$$typeof === o || e.$$typeof === a || e.$$typeof === s || e.$$typeof === p || e.getModuleId !== void 0);
	}, A.typeOf = m, A;
}
var bn;
function xn() {
	return bn || (bn = 1, _n.exports = yn()), _n.exports;
}
var Sn = xn(), Cn = ht({
	__proto__: null,
	default: gn(Sn)
}, [Sn]), wn = { exports: {} }, j = {}, Tn;
function En() {
	if (Tn) return j;
	Tn = 1;
	var e = /* @__PURE__ */ Symbol.for("react.element"), t = /* @__PURE__ */ Symbol.for("react.portal"), n = /* @__PURE__ */ Symbol.for("react.fragment"), r = /* @__PURE__ */ Symbol.for("react.strict_mode"), i = /* @__PURE__ */ Symbol.for("react.profiler"), a = /* @__PURE__ */ Symbol.for("react.provider"), o = /* @__PURE__ */ Symbol.for("react.context"), s = /* @__PURE__ */ Symbol.for("react.server_context"), c = /* @__PURE__ */ Symbol.for("react.forward_ref"), l = /* @__PURE__ */ Symbol.for("react.suspense"), u = /* @__PURE__ */ Symbol.for("react.suspense_list"), d = /* @__PURE__ */ Symbol.for("react.memo"), f = /* @__PURE__ */ Symbol.for("react.lazy"), p = /* @__PURE__ */ Symbol.for("react.offscreen"), m = /* @__PURE__ */ Symbol.for("react.module.reference");
	function h(p) {
		if (typeof p == "object" && p) {
			var m = p.$$typeof;
			switch (m) {
				case e: switch (p = p.type, p) {
					case n:
					case i:
					case r:
					case l:
					case u: return p;
					default: switch (p &&= p.$$typeof, p) {
						case s:
						case o:
						case c:
						case f:
						case d:
						case a: return p;
						default: return m;
					}
				}
				case t: return m;
			}
		}
	}
	return j.ContextConsumer = o, j.ContextProvider = a, j.Element = e, j.ForwardRef = c, j.Fragment = n, j.Lazy = f, j.Memo = d, j.Portal = t, j.Profiler = i, j.StrictMode = r, j.Suspense = l, j.SuspenseList = u, j.isAsyncMode = function() {
		return !1;
	}, j.isConcurrentMode = function() {
		return !1;
	}, j.isContextConsumer = function(e) {
		return h(e) === o;
	}, j.isContextProvider = function(e) {
		return h(e) === a;
	}, j.isElement = function(t) {
		return typeof t == "object" && !!t && t.$$typeof === e;
	}, j.isForwardRef = function(e) {
		return h(e) === c;
	}, j.isFragment = function(e) {
		return h(e) === n;
	}, j.isLazy = function(e) {
		return h(e) === f;
	}, j.isMemo = function(e) {
		return h(e) === d;
	}, j.isPortal = function(e) {
		return h(e) === t;
	}, j.isProfiler = function(e) {
		return h(e) === i;
	}, j.isStrictMode = function(e) {
		return h(e) === r;
	}, j.isSuspense = function(e) {
		return h(e) === l;
	}, j.isSuspenseList = function(e) {
		return h(e) === u;
	}, j.isValidElementType = function(e) {
		return typeof e == "string" || typeof e == "function" || e === n || e === i || e === r || e === l || e === u || e === p || typeof e == "object" && !!e && (e.$$typeof === f || e.$$typeof === d || e.$$typeof === a || e.$$typeof === o || e.$$typeof === c || e.$$typeof === m || e.getModuleId !== void 0);
	}, j.typeOf = h, j;
}
var Dn;
function On() {
	return Dn || (Dn = 1, wn.exports = En()), wn.exports;
}
var kn = On(), An = ht({
	__proto__: null,
	default: gn(kn)
}, [kn]), jn = Object.fromEntries([
	"isAsyncMode",
	"isConcurrentMode",
	"isContextConsumer",
	"isContextProvider",
	"isElement",
	"isForwardRef",
	"isFragment",
	"isLazy",
	"isMemo",
	"isPortal",
	"isProfiler",
	"isStrictMode",
	"isSuspense",
	"isSuspenseList",
	"isValidElementType"
].map((e) => [e, (t) => An[e](t) || Cn[e](t)]));
function Mn(e, t = []) {
	if (Array.isArray(e)) for (let n of e) Mn(n, t);
	else e != null && e !== !1 && e !== "" && t.push(e);
	return t;
}
function Nn(e) {
	let t = e.type;
	if (typeof t == "string") return t;
	if (typeof t == "function") return t.displayName || t.name || "Unknown";
	if (jn.isFragment(e)) return "React.Fragment";
	if (jn.isSuspense(e)) return "React.Suspense";
	if (typeof t == "object" && t) {
		if (jn.isContextProvider(e)) return "Context.Provider";
		if (jn.isContextConsumer(e)) return "Context.Consumer";
		if (jn.isForwardRef(e)) {
			if (t.displayName) return t.displayName;
			let e = t.render.displayName || t.render.name || "";
			return e === "" ? "ForwardRef" : `ForwardRef(${e})`;
		}
		if (jn.isMemo(e)) {
			let e = t.displayName || t.type.displayName || t.type.name || "";
			return e === "" ? "Memo" : `Memo(${e})`;
		}
	}
	return "UNDEFINED";
}
function Pn(e) {
	let { props: t } = e;
	return Object.keys(t).filter((e) => e !== "children" && t[e] !== void 0).sort();
}
var Fn = {
	serialize: (e, t, n, r, i, a) => ++r > t.maxDepth ? Lt(Nn(e), t) : It(Nn(e), Mt(Pn(e), e.props, t, n + t.indent, r, i, a), Nt(Mn(e.props.children), t, n + t.indent, r, i, a), t, n),
	test: (e) => e != null && jn.isElement(e)
}, In = typeof Symbol == "function" && Symbol.for ? /* @__PURE__ */ Symbol.for("react.test.json") : 245830487;
function Ln(e) {
	let { props: t } = e;
	return t ? Object.keys(t).filter((e) => t[e] !== void 0).sort() : [];
}
var Rn = {
	serialize: (e, t, n, r, i, a) => ++r > t.maxDepth ? Lt(e.type, t) : It(e.type, e.props ? Mt(Ln(e), e.props, t, n + t.indent, r, i, a) : "", e.children ? Nt(e.children, t, n + t.indent, r, i, a) : "", t, n),
	test: (e) => e && e.$$typeof === In
}, zn = Object.prototype.toString, Bn = Date.prototype.toISOString, Vn = Error.prototype.toString, Hn = RegExp.prototype.toString;
function Un(e) {
	return typeof e.constructor == "function" && e.constructor.name || "Object";
}
function Wn(e) {
	return typeof window < "u" && e === window;
}
var Gn = /^Symbol\((.*)\)(.*)$/, Kn = /\n/g, qn = class extends Error {
	constructor(e, t) {
		super(e), this.stack = t, this.name = this.constructor.name;
	}
};
function Jn(e) {
	return e === "[object Array]" || e === "[object ArrayBuffer]" || e === "[object DataView]" || e === "[object Float32Array]" || e === "[object Float64Array]" || e === "[object Int8Array]" || e === "[object Int16Array]" || e === "[object Int32Array]" || e === "[object Uint8Array]" || e === "[object Uint8ClampedArray]" || e === "[object Uint16Array]" || e === "[object Uint32Array]";
}
function Yn(e) {
	return Object.is(e, -0) ? "-0" : String(e);
}
function Xn(e) {
	return `${e}n`;
}
function Zn(e, t) {
	return t ? `[Function ${e.name || "anonymous"}]` : "[Function]";
}
function Qn(e) {
	return String(e).replace(Gn, "Symbol($1)");
}
function $n(e) {
	return `[${Vn.call(e)}]`;
}
function er(e, t, n, r) {
	if (e === !0 || e === !1) return `${e}`;
	if (e === void 0) return "undefined";
	if (e === null) return "null";
	let i = typeof e;
	if (i === "number") return Yn(e);
	if (i === "bigint") return Xn(e);
	if (i === "string") return r ? `"${e.replaceAll(/"|\\/g, "\\$&")}"` : `"${e}"`;
	if (i === "function") return Zn(e, t);
	if (i === "symbol") return Qn(e);
	let a = zn.call(e);
	return a === "[object WeakMap]" ? "WeakMap {}" : a === "[object WeakSet]" ? "WeakSet {}" : a === "[object Function]" || a === "[object GeneratorFunction]" ? Zn(e, t) : a === "[object Symbol]" ? Qn(e) : a === "[object Date]" ? Number.isNaN(+e) ? "Date { NaN }" : Bn.call(e) : a === "[object Error]" ? $n(e) : a === "[object RegExp]" ? n ? Hn.call(e).replaceAll(/[$()*+.?[\\\]^{|}]/g, "\\$&") : Hn.call(e) : e instanceof Error ? $n(e) : null;
}
function tr(e, t, n, r, i, a) {
	if (i.includes(e)) return "[Circular]";
	i = [...i], i.push(e);
	let o = ++r > t.maxDepth, s = t.min;
	if (t.callToJSON && !o && e.toJSON && typeof e.toJSON == "function" && !a) return or(e.toJSON(), t, n, r, i, !0);
	let c = zn.call(e);
	return c === "[object Arguments]" ? o ? "[Arguments]" : `${s ? "" : "Arguments "}[${yt(e, t, n, r, i, or)}]` : Jn(c) ? o ? `[${e.constructor.name}]` : `${s || !t.printBasicPrototype && e.constructor.name === "Array" ? "" : `${e.constructor.name} `}[${yt(e, t, n, r, i, or)}]` : c === "[object Map]" ? o ? "[Map]" : `Map {${_t(e.entries(), t, n, r, i, or, " => ")}}` : c === "[object Set]" ? o ? "[Set]" : `Set {${vt(e.values(), t, n, r, i, or)}}` : o || Wn(e) ? `[${Un(e)}]` : `${s || !t.printBasicPrototype && Un(e) === "Object" ? "" : `${Un(e)} `}{${bt(e, t, n, r, i, or)}}`;
}
var nr = {
	test: (e) => e && e instanceof Error,
	serialize(e, t, n, r, i, a) {
		if (i.includes(e)) return "[Circular]";
		i = [...i, e];
		let o = ++r > t.maxDepth, { message: s, cause: c, ...l } = e, u = {
			message: s,
			...typeof c < "u" ? { cause: c } : {},
			...e instanceof AggregateError ? { errors: e.errors } : {},
			...l
		}, d = e.name === "Error" ? Un(e) : e.name;
		return o ? `[${d}]` : `${d} {${_t(Object.entries(u).values(), t, n, r, i, a)}}`;
	}
};
function rr(e) {
	return e.serialize != null;
}
function ir(e, t, n, r, i, a) {
	let o;
	try {
		o = rr(e) ? e.serialize(t, n, r, i, a, or) : e.print(t, (e) => or(e, n, r, i, a), (e) => {
			let t = r + n.indent;
			return t + e.replaceAll(Kn, `
${t}`);
		}, {
			edgeSpacing: n.spacingOuter,
			min: n.min,
			spacing: n.spacingInner
		}, n.colors);
	} catch (e) {
		throw new qn(e.message, e.stack);
	}
	if (typeof o != "string") throw TypeError(`pretty-format: Plugin must return type "string" but instead returned "${typeof o}".`);
	return o;
}
function ar(e, t) {
	for (let n of e) try {
		if (n.test(t)) return n;
	} catch (e) {
		throw new qn(e.message, e.stack);
	}
	return null;
}
function or(e, t, n, r, i, a) {
	let o = ar(t.plugins, e);
	if (o !== null) return ir(o, e, t, n, r, i);
	let s = er(e, t.printFunctionName, t.escapeRegex, t.escapeString);
	return s === null ? tr(e, t, n, r, i, a) : s;
}
var sr = {
	comment: "gray",
	content: "reset",
	prop: "yellow",
	tag: "cyan",
	value: "green"
}, cr = Object.keys(sr), lr = {
	callToJSON: !0,
	compareKeys: void 0,
	escapeRegex: !1,
	escapeString: !0,
	highlight: !1,
	indent: 2,
	maxDepth: Infinity,
	maxWidth: Infinity,
	min: !1,
	plugins: [],
	printBasicPrototype: !0,
	printFunctionName: !0,
	theme: sr
};
function ur(e) {
	for (let t of Object.keys(e)) if (!Object.prototype.hasOwnProperty.call(lr, t)) throw Error(`pretty-format: Unknown option "${t}".`);
	if (e.min && e.indent !== void 0 && e.indent !== 0) throw Error("pretty-format: Options \"min\" and \"indent\" cannot be used together.");
}
function dr() {
	return cr.reduce((e, t) => {
		let n = sr[t], r = n && mt[n];
		if (r && typeof r.close == "string" && typeof r.open == "string") e[t] = r;
		else throw Error(`pretty-format: Option "theme" has a key "${t}" whose value "${n}" is undefined in ansi-styles.`);
		return e;
	}, /* @__PURE__ */ Object.create(null));
}
function fr() {
	return cr.reduce((e, t) => (e[t] = {
		close: "",
		open: ""
	}, e), /* @__PURE__ */ Object.create(null));
}
function pr(e) {
	return e?.printFunctionName ?? lr.printFunctionName;
}
function mr(e) {
	return e?.escapeRegex ?? lr.escapeRegex;
}
function hr(e) {
	return e?.escapeString ?? lr.escapeString;
}
function gr(e) {
	return {
		callToJSON: e?.callToJSON ?? lr.callToJSON,
		colors: e?.highlight ? dr() : fr(),
		compareKeys: typeof e?.compareKeys == "function" || e?.compareKeys === null ? e.compareKeys : lr.compareKeys,
		escapeRegex: mr(e),
		escapeString: hr(e),
		indent: e?.min ? "" : _r(e?.indent ?? lr.indent),
		maxDepth: e?.maxDepth ?? lr.maxDepth,
		maxWidth: e?.maxWidth ?? lr.maxWidth,
		min: e?.min ?? lr.min,
		plugins: e?.plugins ?? lr.plugins,
		printBasicPrototype: e?.printBasicPrototype ?? !0,
		printFunctionName: pr(e),
		spacingInner: e?.min ? " " : "\n",
		spacingOuter: e?.min ? "" : "\n"
	};
}
function _r(e) {
	return Array.from({ length: e + 1 }).join(" ");
}
function vr(e, t) {
	if (t && (ur(t), t.plugins)) {
		let n = ar(t.plugins, e);
		if (n !== null) return ir(n, e, gr(t), "", 0, []);
	}
	let n = er(e, pr(t), mr(t), hr(t));
	return n === null ? tr(e, gr(t), "", 0, []) : n;
}
var yr = {
	AsymmetricMatcher: Ct,
	DOMCollection: At,
	DOMElement: Yt,
	Immutable: hn,
	ReactElement: Fn,
	ReactTestComponent: Rn,
	Error: nr
}, br = {
	bold: ["1", "22"],
	dim: ["2", "22"],
	italic: ["3", "23"],
	underline: ["4", "24"],
	inverse: ["7", "27"],
	hidden: ["8", "28"],
	strike: ["9", "29"],
	black: ["30", "39"],
	red: ["31", "39"],
	green: ["32", "39"],
	yellow: ["33", "39"],
	blue: ["34", "39"],
	magenta: ["35", "39"],
	cyan: ["36", "39"],
	white: ["37", "39"],
	brightblack: ["30;1", "39"],
	brightred: ["31;1", "39"],
	brightgreen: ["32;1", "39"],
	brightyellow: ["33;1", "39"],
	brightblue: ["34;1", "39"],
	brightmagenta: ["35;1", "39"],
	brightcyan: ["36;1", "39"],
	brightwhite: ["37;1", "39"],
	grey: ["90", "39"]
}, xr = {
	special: "cyan",
	number: "yellow",
	bigint: "yellow",
	boolean: "yellow",
	undefined: "grey",
	null: "bold",
	string: "green",
	symbol: "green",
	date: "magenta",
	regexp: "red"
}, Sr = "…";
function Cr(e, t) {
	let n = br[xr[t]] || br[t] || "";
	return n ? `\x1B[${n[0]}m${String(e)}\x1B[${n[1]}m` : String(e);
}
function wr({ showHidden: e = !1, depth: t = 2, colors: n = !1, customInspect: r = !0, showProxy: i = !1, maxArrayLength: a = 1 / 0, breakLength: o = 1 / 0, seen: s = [], truncate: c = 1 / 0, stylize: l = String } = {}, u) {
	let d = {
		showHidden: !!e,
		depth: Number(t),
		colors: !!n,
		customInspect: !!r,
		showProxy: !!i,
		maxArrayLength: Number(a),
		breakLength: Number(o),
		truncate: Number(c),
		seen: s,
		inspect: u,
		stylize: l
	};
	return d.colors && (d.stylize = Cr), d;
}
function Tr(e) {
	return e >= "\ud800" && e <= "\udbff";
}
function Er(e, t, n = Sr) {
	e = String(e);
	let r = n.length, i = e.length;
	if (r > t && i > r) return n;
	if (i > t && i > r) {
		let i = t - r;
		return i > 0 && Tr(e[i - 1]) && --i, `${e.slice(0, i)}${n}`;
	}
	return e;
}
function Dr(e, t, n, r = ", ") {
	n ||= t.inspect;
	let i = e.length;
	if (i === 0) return "";
	let a = t.truncate, o = "", s = "", c = "";
	for (let l = 0; l < i; l += 1) {
		let i = l + 1 === e.length, u = l + 2 === e.length;
		c = `${Sr}(${e.length - l})`;
		let d = e[l];
		t.truncate = a - o.length - (i ? 0 : r.length);
		let f = s || n(d, t) + (i ? "" : r), p = o.length + f.length, m = p + c.length;
		if (i && p > a && o.length + c.length <= a || !i && !u && m > a || (s = i ? "" : n(e[l + 1], t) + (u ? "" : r), !i && u && m > a && p + s.length > a)) break;
		if (o += f, !i && !u && p + s.length >= a) {
			c = `${Sr}(${e.length - l - 1})`;
			break;
		}
		c = "";
	}
	return `${o}${c}`;
}
function Or(e) {
	return e.match(/^[a-zA-Z_][a-zA-Z_0-9]*$/) ? e : JSON.stringify(e).replace(/'/g, "\\'").replace(/\\"/g, "\"").replace(/(^"|"$)/g, "'");
}
function kr([e, t], n) {
	return n.truncate -= 2, typeof e == "string" ? e = Or(e) : typeof e != "number" && (e = `[${n.inspect(e, n)}]`), n.truncate -= e.length, t = n.inspect(t, n), `${e}: ${t}`;
}
function Ar(e, t) {
	let n = Object.keys(e).slice(e.length);
	if (!e.length && !n.length) return "[]";
	t.truncate -= 4;
	let r = Dr(e, t);
	t.truncate -= r.length;
	let i = "";
	return n.length && (i = Dr(n.map((t) => [t, e[t]]), t, kr)), `[ ${r}${i ? `, ${i}` : ""} ]`;
}
var jr = (e) => typeof Buffer == "function" && e instanceof Buffer ? "Buffer" : e[Symbol.toStringTag] ? e[Symbol.toStringTag] : e.constructor.name;
function Mr(e, t) {
	let n = jr(e);
	t.truncate -= n.length + 4;
	let r = Object.keys(e).slice(e.length);
	if (!e.length && !r.length) return `${n}[]`;
	let i = "";
	for (let n = 0; n < e.length; n++) {
		let r = `${t.stylize(Er(e[n], t.truncate), "number")}${n === e.length - 1 ? "" : ", "}`;
		if (t.truncate -= r.length, e[n] !== e.length && t.truncate <= 3) {
			i += `${Sr}(${e.length - e[n] + 1})`;
			break;
		}
		i += r;
	}
	let a = "";
	return r.length && (a = Dr(r.map((t) => [t, e[t]]), t, kr)), `${n}[ ${i}${a ? `, ${a}` : ""} ]`;
}
function Nr(e, t) {
	let n = e.toJSON();
	if (n === null) return "Invalid Date";
	let r = n.split("T"), i = r[0];
	return t.stylize(`${i}T${Er(r[1], t.truncate - i.length - 1)}`, "date");
}
function Pr(e, t) {
	let n = e[Symbol.toStringTag] || "Function", r = e.name;
	return r ? t.stylize(`[${n} ${Er(r, t.truncate - 11)}]`, "special") : t.stylize(`[${n}]`, "special");
}
function Fr([e, t], n) {
	return n.truncate -= 4, e = n.inspect(e, n), n.truncate -= e.length, t = n.inspect(t, n), `${e} => ${t}`;
}
function Ir(e) {
	let t = [];
	return e.forEach((e, n) => {
		t.push([n, e]);
	}), t;
}
function Lr(e, t) {
	return e.size === 0 ? "Map{}" : (t.truncate -= 7, `Map{ ${Dr(Ir(e), t, Fr)} }`);
}
var Rr = Number.isNaN || ((e) => e !== e);
function zr(e, t) {
	return Rr(e) ? t.stylize("NaN", "number") : e === 1 / 0 ? t.stylize("Infinity", "number") : e === -1 / 0 ? t.stylize("-Infinity", "number") : e === 0 ? t.stylize(1 / e == 1 / 0 ? "+0" : "-0", "number") : t.stylize(Er(String(e), t.truncate), "number");
}
function Br(e, t) {
	let n = Er(e.toString(), t.truncate - 1);
	return n !== Sr && (n += "n"), t.stylize(n, "bigint");
}
function Vr(e, t) {
	let n = e.toString().split("/")[2], r = t.truncate - (2 + n.length), i = e.source;
	return t.stylize(`/${Er(i, r)}/${n}`, "regexp");
}
function Hr(e) {
	let t = [];
	return e.forEach((e) => {
		t.push(e);
	}), t;
}
function Ur(e, t) {
	return e.size === 0 ? "Set{}" : (t.truncate -= 7, `Set{ ${Dr(Hr(e), t)} }`);
}
var Wr = /* @__PURE__ */ RegExp("['\\u0000-\\u001f\\u007f-\\u009f\\u00ad\\u0600-\\u0604\\u070f\\u17b4\\u17b5\\u200c-\\u200f\\u2028-\\u202f\\u2060-\\u206f\\ufeff\\ufff0-\\uffff]", "g"), Gr = {
	"\b": "\\b",
	"	": "\\t",
	"\n": "\\n",
	"\f": "\\f",
	"\r": "\\r",
	"'": "\\'",
	"\\": "\\\\"
}, Kr = 16, qr = 4;
function Jr(e) {
	return Gr[e] || `\\u${`0000${e.charCodeAt(0).toString(Kr)}`.slice(-qr)}`;
}
function Yr(e, t) {
	return Wr.test(e) && (e = e.replace(Wr, Jr)), t.stylize(`'${Er(e, t.truncate - 2)}'`, "string");
}
function Xr(e) {
	return "description" in Symbol.prototype ? e.description ? `Symbol(${e.description})` : "Symbol()" : e.toString();
}
var Zr = () => "Promise{…}";
try {
	let { getPromiseDetails: e, kPending: t, kRejected: n } = process.binding("util");
	Array.isArray(e(Promise.resolve())) && (Zr = (r, i) => {
		let [a, o] = e(r);
		return a === t ? "Promise{<pending>}" : `Promise${a === n ? "!" : ""}{${i.inspect(o, i)}}`;
	});
} catch {}
var Qr = Zr;
function $r(e, t) {
	let n = Object.getOwnPropertyNames(e), r = Object.getOwnPropertySymbols ? Object.getOwnPropertySymbols(e) : [];
	if (n.length === 0 && r.length === 0) return "{}";
	if (t.truncate -= 4, t.seen = t.seen || [], t.seen.includes(e)) return "[Circular]";
	t.seen.push(e);
	let i = Dr(n.map((t) => [t, e[t]]), t, kr), a = Dr(r.map((t) => [t, e[t]]), t, kr);
	t.seen.pop();
	let o = "";
	return i && a && (o = ", "), `{ ${i}${o}${a} }`;
}
var ei = typeof Symbol < "u" && Symbol.toStringTag ? Symbol.toStringTag : !1;
function ti(e, t) {
	let n = "";
	return ei && ei in e && (n = e[ei]), n ||= e.constructor.name, n && n !== "_class" || (n = "<Anonymous Class>"), t.truncate -= n.length, `${n}${$r(e, t)}`;
}
function ni(e, t) {
	return e.length === 0 ? "Arguments[]" : (t.truncate -= 13, `Arguments[ ${Dr(e, t)} ]`);
}
var ri = [
	"stack",
	"line",
	"column",
	"name",
	"message",
	"fileName",
	"lineNumber",
	"columnNumber",
	"number",
	"description",
	"cause"
];
function ii(e, t) {
	let n = Object.getOwnPropertyNames(e).filter((e) => ri.indexOf(e) === -1), r = e.name;
	t.truncate -= r.length;
	let i = "";
	if (typeof e.message == "string" ? i = Er(e.message, t.truncate) : n.unshift("message"), i = i ? `: ${i}` : "", t.truncate -= i.length + 5, t.seen = t.seen || [], t.seen.includes(e)) return "[Circular]";
	t.seen.push(e);
	let a = Dr(n.map((t) => [t, e[t]]), t, kr);
	return `${r}${i}${a ? ` { ${a} }` : ""}`;
}
function ai([e, t], n) {
	return n.truncate -= 3, t ? `${n.stylize(String(e), "yellow")}=${n.stylize(`"${t}"`, "string")}` : `${n.stylize(String(e), "yellow")}`;
}
function oi(e, t) {
	return Dr(e, t, si, "\n");
}
function si(e, t) {
	switch (e.nodeType) {
		case 1: return ci(e, t);
		case 3: return t.inspect(e.data, t);
		default: return t.inspect(e, t);
	}
}
function ci(e, t) {
	let n = e.getAttributeNames(), r = e.tagName.toLowerCase(), i = t.stylize(`<${r}`, "special"), a = t.stylize(">", "special"), o = t.stylize(`</${r}>`, "special");
	t.truncate -= r.length * 2 + 5;
	let s = "";
	n.length > 0 && (s += " ", s += Dr(n.map((t) => [t, e.getAttribute(t)]), t, ai, " ")), t.truncate -= s.length;
	let c = t.truncate, l = oi(e.children, t);
	return l && l.length > c && (l = `${Sr}(${e.children.length})`), `${i}${s}${a}${l}${o}`;
}
var li = typeof Symbol == "function" && typeof Symbol.for == "function" ? /* @__PURE__ */ Symbol.for("chai/inspect") : "@@chai/inspect", ui = /* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom"), di = /* @__PURE__ */ new WeakMap(), fi = {}, pi = {
	undefined: (e, t) => t.stylize("undefined", "undefined"),
	null: (e, t) => t.stylize("null", "null"),
	boolean: (e, t) => t.stylize(String(e), "boolean"),
	Boolean: (e, t) => t.stylize(String(e), "boolean"),
	number: zr,
	Number: zr,
	bigint: Br,
	BigInt: Br,
	string: Yr,
	String: Yr,
	function: Pr,
	Function: Pr,
	symbol: Xr,
	Symbol: Xr,
	Array: Ar,
	Date: Nr,
	Map: Lr,
	Set: Ur,
	RegExp: Vr,
	Promise: Qr,
	WeakSet: (e, t) => t.stylize("WeakSet{…}", "special"),
	WeakMap: (e, t) => t.stylize("WeakMap{…}", "special"),
	Arguments: ni,
	Int8Array: Mr,
	Uint8Array: Mr,
	Uint8ClampedArray: Mr,
	Int16Array: Mr,
	Uint16Array: Mr,
	Int32Array: Mr,
	Uint32Array: Mr,
	Float32Array: Mr,
	Float64Array: Mr,
	Generator: () => "",
	DataView: () => "",
	ArrayBuffer: () => "",
	Error: ii,
	HTMLCollection: oi,
	NodeList: oi
}, mi = (e, t, n) => li in e && typeof e[li] == "function" ? e[li](t) : ui in e && typeof e[ui] == "function" ? e[ui](t.depth, t) : "inspect" in e && typeof e.inspect == "function" ? e.inspect(t.depth, t) : "constructor" in e && di.has(e.constructor) ? di.get(e.constructor)(e, t) : fi[n] ? fi[n](e, t) : "", hi = Object.prototype.toString;
function gi(e, t = {}) {
	let n = wr(t, gi), { customInspect: r } = n, i = e === null ? "null" : typeof e;
	if (i === "object" && (i = hi.call(e).slice(8, -1)), i in pi) return pi[i](e, n);
	if (r && e) {
		let t = mi(e, n, i);
		if (t) return typeof t == "string" ? t : gi(t, n);
	}
	let a = e ? Object.getPrototypeOf(e) : !1;
	return a === Object.prototype || a === null ? $r(e, n) : e && typeof HTMLElement == "function" && e instanceof HTMLElement ? ci(e, n) : "constructor" in e ? e.constructor === Object ? $r(e, n) : ti(e, n) : e === Object(e) ? $r(e, n) : n.stylize(String(e), i);
}
var { AsymmetricMatcher: _i, DOMCollection: vi, DOMElement: yi, Immutable: bi, ReactElement: xi, ReactTestComponent: Si } = yr, Ci = [
	Si,
	xi,
	yi,
	vi,
	bi,
	_i
];
function wi(e, t = 10, { maxLength: n, ...r } = {}) {
	let i = n ?? 1e4, a;
	try {
		a = vr(e, {
			maxDepth: t,
			escapeString: !1,
			plugins: Ci,
			...r
		});
	} catch {
		a = vr(e, {
			callToJSON: !1,
			maxDepth: t,
			escapeString: !1,
			plugins: Ci,
			...r
		});
	}
	return a.length >= i && t > 1 ? wi(e, Math.floor(Math.min(t, 2 ** 53 - 1) / 2), {
		maxLength: n,
		...r
	}) : a;
}
var Ti = /%[sdjifoOc%]/g;
function Ei(...e) {
	if (typeof e[0] != "string") {
		let t = [];
		for (let n = 0; n < e.length; n++) t.push(Di(e[n], {
			depth: 0,
			colors: !1
		}));
		return t.join(" ");
	}
	let t = e.length, n = 1, r = e[0], i = String(r).replace(Ti, (r) => {
		if (r === "%%") return "%";
		if (n >= t) return r;
		switch (r) {
			case "%s": {
				let t = e[n++];
				return typeof t == "bigint" ? `${t.toString()}n` : typeof t == "number" && t === 0 && 1 / t < 0 ? "-0" : typeof t == "object" && t ? typeof t.toString == "function" && t.toString !== Object.prototype.toString ? t.toString() : Di(t, {
					depth: 0,
					colors: !1
				}) : String(t);
			}
			case "%d": {
				let t = e[n++];
				return typeof t == "bigint" ? `${t.toString()}n` : Number(t).toString();
			}
			case "%i": {
				let t = e[n++];
				return typeof t == "bigint" ? `${t.toString()}n` : Number.parseInt(String(t)).toString();
			}
			case "%f": return Number.parseFloat(String(e[n++])).toString();
			case "%o": return Di(e[n++], {
				showHidden: !0,
				showProxy: !0
			});
			case "%O": return Di(e[n++]);
			case "%c": return n++, "";
			case "%j": try {
				return JSON.stringify(e[n++]);
			} catch (e) {
				let t = e.message;
				if (t.includes("circular structure") || t.includes("cyclic structures") || t.includes("cyclic object")) return "[Circular]";
				throw e;
			}
			default: return r;
		}
	});
	for (let r = e[n]; n < t; r = e[++n]) i += typeof r != "object" || !r ? ` ${r}` : ` ${Di(r)}`;
	return i;
}
function Di(e, t = {}) {
	return t.truncate === 0 && (t.truncate = Infinity), gi(e, t);
}
function Oi(e) {
	return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}
function ki(e, t, n) {
	let r = typeof e;
	if (!n.includes(r)) throw TypeError(`${t} value must be ${n.join(" or ")}, received "${r}"`);
}
function Ai(e) {
	return typeof e == "object" && !!e && !Array.isArray(e);
}
function ji(e) {
	return e === Object.prototype || e === Function.prototype || e === RegExp.prototype;
}
function Mi(e) {
	return Object.prototype.toString.apply(e).slice(8, -1);
}
function Ni(e, t) {
	let n = typeof t == "function" ? t : (e) => t.add(e);
	Object.getOwnPropertyNames(e).forEach(n), Object.getOwnPropertySymbols(e).forEach(n);
}
function Pi(e) {
	let t = /* @__PURE__ */ new Set();
	return ji(e) ? [] : (Ni(e, t), Array.from(t));
}
var Fi = { forceWritable: !1 };
function Ii(e, t = Fi) {
	return Li(e, /* @__PURE__ */ new WeakMap(), t);
}
function Li(e, t, n = Fi) {
	let r, i;
	if (t.has(e)) return t.get(e);
	if (Array.isArray(e)) {
		for (i = Array.from({ length: r = e.length }), t.set(e, i); r--;) i[r] = Li(e[r], t, n);
		return i;
	}
	if (Object.prototype.toString.call(e) === "[object Object]") {
		i = Object.create(Object.getPrototypeOf(e)), t.set(e, i);
		let r = Pi(e);
		for (let a of r) {
			let r = Object.getOwnPropertyDescriptor(e, a);
			if (!r) continue;
			let o = Li(e[a], t, n);
			n.forceWritable ? Object.defineProperty(i, a, {
				enumerable: r.enumerable,
				configurable: !0,
				writable: !0,
				value: o
			}) : "get" in r ? Object.defineProperty(i, a, {
				...r,
				get() {
					return o;
				}
			}) : Object.defineProperty(i, a, {
				...r,
				value: o
			});
		}
		return i;
	}
	return e;
}
function Ri() {}
var M = -1, N = 1, P = 0, F = class {
	0;
	1;
	constructor(e, t) {
		this[0] = e, this[1] = t;
	}
};
function zi(e, t) {
	if (!e || !t || e.charAt(0) !== t.charAt(0)) return 0;
	let n = 0, r = Math.min(e.length, t.length), i = r, a = 0;
	for (; n < i;) e.substring(a, i) === t.substring(a, i) ? (n = i, a = n) : r = i, i = Math.floor((r - n) / 2 + n);
	return i;
}
function Bi(e, t) {
	if (!e || !t || e.charAt(e.length - 1) !== t.charAt(t.length - 1)) return 0;
	let n = 0, r = Math.min(e.length, t.length), i = r, a = 0;
	for (; n < i;) e.substring(e.length - i, e.length - a) === t.substring(t.length - i, t.length - a) ? (n = i, a = n) : r = i, i = Math.floor((r - n) / 2 + n);
	return i;
}
function Vi(e, t) {
	let n = e.length, r = t.length;
	if (n === 0 || r === 0) return 0;
	n > r ? e = e.substring(n - r) : n < r && (t = t.substring(0, n));
	let i = Math.min(n, r);
	if (e === t) return i;
	let a = 0, o = 1;
	for (;;) {
		let n = e.substring(i - o), r = t.indexOf(n);
		if (r === -1) return a;
		o += r, (r === 0 || e.substring(i - o) === t.substring(0, o)) && (a = o, o++);
	}
}
function Hi(e) {
	let t = !1, n = [], r = 0, i = null, a = 0, o = 0, s = 0, c = 0, l = 0;
	for (; a < e.length;) e[a][0] === P ? (n[r++] = a, o = c, s = l, c = 0, l = 0, i = e[a][1]) : (e[a][0] === N ? c += e[a][1].length : l += e[a][1].length, i && i.length <= Math.max(o, s) && i.length <= Math.max(c, l) && (e.splice(n[r - 1], 0, new F(M, i)), e[n[r - 1] + 1][0] = N, r--, r--, a = r > 0 ? n[r - 1] : -1, o = 0, s = 0, c = 0, l = 0, i = null, t = !0)), a++;
	for (t && Yi(e), Ji(e), a = 1; a < e.length;) {
		if (e[a - 1][0] === M && e[a][0] === N) {
			let t = e[a - 1][1], n = e[a][1], r = Vi(t, n), i = Vi(n, t);
			r >= i ? (r >= t.length / 2 || r >= n.length / 2) && (e.splice(a, 0, new F(P, n.substring(0, r))), e[a - 1][1] = t.substring(0, t.length - r), e[a + 1][1] = n.substring(r), a++) : (i >= t.length / 2 || i >= n.length / 2) && (e.splice(a, 0, new F(P, t.substring(0, i))), e[a - 1][0] = N, e[a - 1][1] = n.substring(0, n.length - i), e[a + 1][0] = M, e[a + 1][1] = t.substring(i), a++), a++;
		}
		a++;
	}
}
var Ui = /[^a-z0-9]/i, Wi = /\s/, Gi = /[\r\n]/, Ki = /\n\r?\n$/, qi = /^\r?\n\r?\n/;
function Ji(e) {
	let t = 1;
	for (; t < e.length - 1;) {
		if (e[t - 1][0] === P && e[t + 1][0] === P) {
			let n = e[t - 1][1], r = e[t][1], i = e[t + 1][1], a = Bi(n, r);
			if (a) {
				let e = r.substring(r.length - a);
				n = n.substring(0, n.length - a), r = e + r.substring(0, r.length - a), i = e + i;
			}
			let o = n, s = r, c = i, l = Xi(n, r) + Xi(r, i);
			for (; r.charAt(0) === i.charAt(0);) {
				n += r.charAt(0), r = r.substring(1) + i.charAt(0), i = i.substring(1);
				let e = Xi(n, r) + Xi(r, i);
				e >= l && (l = e, o = n, s = r, c = i);
			}
			e[t - 1][1] !== o && (o ? e[t - 1][1] = o : (e.splice(t - 1, 1), t--), e[t][1] = s, c ? e[t + 1][1] = c : (e.splice(t + 1, 1), t--));
		}
		t++;
	}
}
function Yi(e) {
	e.push(new F(P, ""));
	let t = 0, n = 0, r = 0, i = "", a = "", o;
	for (; t < e.length;) switch (e[t][0]) {
		case N:
			r++, a += e[t][1], t++;
			break;
		case M:
			n++, i += e[t][1], t++;
			break;
		case P: n + r > 1 ? (n !== 0 && r !== 0 && (o = zi(a, i), o !== 0 && (t - n - r > 0 && e[t - n - r - 1][0] === P ? e[t - n - r - 1][1] += a.substring(0, o) : (e.splice(0, 0, new F(P, a.substring(0, o))), t++), a = a.substring(o), i = i.substring(o)), o = Bi(a, i), o !== 0 && (e[t][1] = a.substring(a.length - o) + e[t][1], a = a.substring(0, a.length - o), i = i.substring(0, i.length - o))), t -= n + r, e.splice(t, n + r), i.length && (e.splice(t, 0, new F(M, i)), t++), a.length && (e.splice(t, 0, new F(N, a)), t++), t++) : t !== 0 && e[t - 1][0] === P ? (e[t - 1][1] += e[t][1], e.splice(t, 1)) : t++, r = 0, n = 0, i = "", a = "";
	}
	e[e.length - 1][1] === "" && e.pop();
	let s = !1;
	for (t = 1; t < e.length - 1;) e[t - 1][0] === P && e[t + 1][0] === P && (e[t][1].substring(e[t][1].length - e[t - 1][1].length) === e[t - 1][1] ? (e[t][1] = e[t - 1][1] + e[t][1].substring(0, e[t][1].length - e[t - 1][1].length), e[t + 1][1] = e[t - 1][1] + e[t + 1][1], e.splice(t - 1, 1), s = !0) : e[t][1].substring(0, e[t + 1][1].length) === e[t + 1][1] && (e[t - 1][1] += e[t + 1][1], e[t][1] = e[t][1].substring(e[t + 1][1].length) + e[t + 1][1], e.splice(t + 1, 1), s = !0)), t++;
	s && Yi(e);
}
function Xi(e, t) {
	if (!e || !t) return 6;
	let n = e.charAt(e.length - 1), r = t.charAt(0), i = n.match(Ui), a = r.match(Ui), o = i && n.match(Wi), s = a && r.match(Wi), c = o && n.match(Gi), l = s && r.match(Gi), u = c && e.match(Ki), d = l && t.match(qi);
	return u || d ? 5 : c || l ? 4 : i && !o && s ? 3 : o || s ? 2 : i || a ? 1 : 0;
}
var Zi = "Compared values have no visual difference.", Qi = "Compared values serialize to the same structure.\nPrinting internal object structure without calling `toJSON` instead.", $i = {}, ea;
function ta() {
	if (ea) return $i;
	ea = 1, Object.defineProperty($i, "__esModule", { value: !0 }), $i.default = d;
	let e = "diff-sequences", t = (e, t, n, r, i) => {
		let a = 0;
		for (; e < t && n < r && i(e, n);) e += 1, n += 1, a += 1;
		return a;
	}, n = (e, t, n, r, i) => {
		let a = 0;
		for (; e <= t && n <= r && i(t, r);) --t, --r, a += 1;
		return a;
	}, r = (e, n, r, i, a, o, s) => {
		let c = 0, l = -e, u = o[c], d = u;
		o[c] += t(u + 1, n, i + u - l + 1, r, a);
		let f = e < s ? e : s;
		for (c += 1, l += 2; c <= f; c += 1, l += 2) {
			if (c !== e && d < o[c]) u = o[c];
			else if (u = d + 1, n <= u) return c - 1;
			d = o[c], o[c] = u + t(u + 1, n, i + u - l + 1, r, a);
		}
		return s;
	}, i = (e, t, r, i, a, o, s) => {
		let c = 0, l = e, u = o[c], d = u;
		o[c] -= n(t, u - 1, r, i + u - l - 1, a);
		let f = e < s ? e : s;
		for (c += 1, l -= 2; c <= f; c += 1, l -= 2) {
			if (c !== e && o[c] < d) u = o[c];
			else if (u = d - 1, u < t) return c - 1;
			d = o[c], o[c] = u - n(t, u - 1, r, i + u - l - 1, a);
		}
		return s;
	}, a = (e, r, i, a, o, s, c, l, u, d, f) => {
		let p = a - r, m = i - r, h = o - a - m, g = -h - (e - 1), _ = -h + (e - 1), v = 0, y = e < l ? e : l;
		for (let l = 0, m = -e; l <= y; l += 1, m += 2) {
			let y = l === 0 || l !== e && v < c[l], b = y ? c[l] : v, x = y ? b : b + 1, S = p + x - m, ee = t(x + 1, i, S + 1, o, s), C = x + ee;
			if (v = c[l], c[l] = C, g <= m && m <= _) {
				let t = (e - 1 - (m + h)) / 2;
				if (t <= d && u[t] - 1 <= C) {
					let t = p + b - (y ? m + 1 : m - 1), c = n(r, b, a, t, s), l = b - c, u = t - c, d = l + 1, h = u + 1;
					f.nChangePreceding = e - 1, e - 1 === d + h - r - a ? (f.aEndPreceding = r, f.bEndPreceding = a) : (f.aEndPreceding = d, f.bEndPreceding = h), f.nCommonPreceding = c, c !== 0 && (f.aCommonPreceding = d, f.bCommonPreceding = h), f.nCommonFollowing = ee, ee !== 0 && (f.aCommonFollowing = x + 1, f.bCommonFollowing = S + 1);
					let g = C + 1, _ = S + ee + 1;
					return f.nChangeFollowing = e - 1, e - 1 === i + o - g - _ ? (f.aStartFollowing = i, f.bStartFollowing = o) : (f.aStartFollowing = g, f.bStartFollowing = _), !0;
				}
			}
		}
		return !1;
	}, o = (e, r, i, a, o, s, c, l, u, d, f) => {
		let p = o - i, m = i - r, h = o - a - m, g = h - e, _ = h + e, v = 0, y = e < d ? e : d;
		for (let d = 0, m = e; d <= y; d += 1, m -= 2) {
			let y = d === 0 || d !== e && u[d] < v, b = y ? u[d] : v, x = y ? b : b - 1, S = p + x - m, ee = n(r, x - 1, a, S - 1, s), C = x - ee;
			if (v = u[d], u[d] = C, g <= m && m <= _) {
				let n = (e + (m - h)) / 2;
				if (n <= l && C - 1 <= c[n]) {
					let n = S - ee;
					if (f.nChangePreceding = e, e === C + n - r - a ? (f.aEndPreceding = r, f.bEndPreceding = a) : (f.aEndPreceding = C, f.bEndPreceding = n), f.nCommonPreceding = ee, ee !== 0 && (f.aCommonPreceding = C, f.bCommonPreceding = n), f.nChangeFollowing = e - 1, e === 1) f.nCommonFollowing = 0, f.aStartFollowing = i, f.bStartFollowing = o;
					else {
						let n = p + b - (y ? m - 1 : m + 1), r = t(b, i, n, o, s);
						f.nCommonFollowing = r, r !== 0 && (f.aCommonFollowing = b, f.bCommonFollowing = n);
						let a = b + r, c = n + r;
						e - 1 === i + o - a - c ? (f.aStartFollowing = i, f.bStartFollowing = o) : (f.aStartFollowing = a, f.bStartFollowing = c);
					}
					return !0;
				}
			}
		}
		return !1;
	}, s = (t, n, s, c, l, u, d, f, p) => {
		let m = c - n, h = l - s, g = s - n, _ = l - c, v = _ - g, y = g, b = g;
		if (d[0] = n - 1, f[0] = s, v % 2 == 0) {
			let e = (t || v) / 2, a = (g + _) / 2;
			for (let t = 1; t <= a; t += 1) if (y = r(t, s, l, m, u, d, y), t < e) b = i(t, n, c, h, u, f, b);
			else if (o(t, n, s, c, l, u, d, y, f, b, p)) return;
		} else {
			let e = ((t || v) + 1) / 2, o = (g + _ + 1) / 2, x = 1;
			for (y = r(x, s, l, m, u, d, y), x += 1; x <= o; x += 1) if (b = i(x - 1, n, c, h, u, f, b), x < e) y = r(x, s, l, m, u, d, y);
			else if (a(x, n, s, c, l, u, d, y, f, b, p)) return;
		}
		throw Error(`${e}: no overlap aStart=${n} aEnd=${s} bStart=${c} bEnd=${l}`);
	}, c = (e, t, n, r, i, a, o, l, u, d) => {
		if (i - r < n - t) {
			if (a = !a, a && o.length === 1) {
				let { foundSubsequence: e, isCommon: t } = o[0];
				o[1] = {
					foundSubsequence: (t, n, r) => {
						e(t, r, n);
					},
					isCommon: (e, n) => t(n, e)
				};
			}
			let e = t, s = n;
			t = r, n = i, r = e, i = s;
		}
		let { foundSubsequence: f, isCommon: p } = o[+!!a];
		s(e, t, n, r, i, p, l, u, d);
		let { nChangePreceding: m, aEndPreceding: h, bEndPreceding: g, nCommonPreceding: _, aCommonPreceding: v, bCommonPreceding: y, nCommonFollowing: b, aCommonFollowing: x, bCommonFollowing: S, nChangeFollowing: ee, aStartFollowing: C, bStartFollowing: w } = d;
		t < h && r < g && c(m, t, h, r, g, a, o, l, u, d), _ !== 0 && f(_, v, y), b !== 0 && f(b, x, S), C < n && w < i && c(ee, C, n, w, i, a, o, l, u, d);
	}, l = (t, n) => {
		if (typeof n != "number") throw TypeError(`${e}: ${t} typeof ${typeof n} is not a number`);
		if (!Number.isSafeInteger(n)) throw RangeError(`${e}: ${t} value ${n} is not a safe integer`);
		if (n < 0) throw RangeError(`${e}: ${t} value ${n} is a negative integer`);
	}, u = (t, n) => {
		let r = typeof n;
		if (r !== "function") throw TypeError(`${e}: ${t} typeof ${r} is not a function`);
	};
	function d(e, r, i, a) {
		l("aLength", e), l("bLength", r), u("isCommon", i), u("foundSubsequence", a);
		let o = t(0, e, 0, r, i);
		if (o !== 0 && a(o, 0, 0), e !== o || r !== o) {
			let t = o, s = o, l = n(t, e - 1, s, r - 1, i), u = e - l, d = r - l, f = o + l;
			e !== f && r !== f && c(0, t, u, s, d, !1, [{
				foundSubsequence: a,
				isCommon: i
			}], [0], [0], {
				aCommonFollowing: 0,
				aCommonPreceding: 0,
				aEndPreceding: 0,
				aStartFollowing: 0,
				bCommonFollowing: 0,
				bCommonPreceding: 0,
				bEndPreceding: 0,
				bStartFollowing: 0,
				nChangeFollowing: 0,
				nChangePreceding: 0,
				nCommonFollowing: 0,
				nCommonPreceding: 0
			}), l !== 0 && a(l, u, d);
		}
	}
	return $i;
}
var na = Oi(ta());
function ra(e, t) {
	return e.replace(/\s+$/, (e) => t(e));
}
function ia(e, t, n, r, i, a) {
	return e.length === 0 ? r === " " ? t && a.length !== 0 ? n(`${r} ${a}`) : "" : n(r) : n(`${r} ${ra(e, i)}`);
}
function aa(e, t, { aColor: n, aIndicator: r, changeLineTrailingSpaceColor: i, emptyFirstOrLastLinePlaceholder: a }) {
	return ia(e, t, n, r, i, a);
}
function oa(e, t, { bColor: n, bIndicator: r, changeLineTrailingSpaceColor: i, emptyFirstOrLastLinePlaceholder: a }) {
	return ia(e, t, n, r, i, a);
}
function sa(e, t, { commonColor: n, commonIndicator: r, commonLineTrailingSpaceColor: i, emptyFirstOrLastLinePlaceholder: a }) {
	return ia(e, t, n, r, i, a);
}
function ca(e, t, n, r, { patchColor: i }) {
	return i(`@@ -${e + 1},${t - e} +${n + 1},${r - n} @@`);
}
function la(e, t) {
	let n = e.length, r = t.contextLines, i = r + r, a = n, o = !1, s = 0, c = 0;
	for (; c !== n;) {
		let t = c;
		for (; c !== n && e[c][0] === P;) c += 1;
		if (t !== c) {
			if (t === 0) c > r && (a -= c - r, o = !0);
			else if (c === n) {
				let e = c - t;
				e > r && (a -= e - r, o = !0);
			} else {
				let e = c - t;
				e > i && (a -= e - i, s += 1);
			}
		}
		for (; c !== n && e[c][0] !== P;) c += 1;
	}
	let l = s !== 0 || o;
	s === 0 ? o && (a += 1) : a += s + 1;
	let u = a - 1, d = [], f = 0;
	l && d.push("");
	let p = 0, m = 0, h = 0, g = 0, _ = (e) => {
		let n = d.length;
		d.push(sa(e, n === 0 || n === u, t)), h += 1, g += 1;
	}, v = (e) => {
		let n = d.length;
		d.push(aa(e, n === 0 || n === u, t)), h += 1;
	}, y = (e) => {
		let n = d.length;
		d.push(oa(e, n === 0 || n === u, t)), g += 1;
	};
	for (c = 0; c !== n;) {
		let a = c;
		for (; c !== n && e[c][0] === P;) c += 1;
		if (a !== c) {
			if (a === 0) {
				c > r && (a = c - r, p = a, m = a, h = p, g = m);
				for (let t = a; t !== c; t += 1) _(e[t][1]);
			} else if (c === n) {
				let t = c - a > r ? a + r : c;
				for (let n = a; n !== t; n += 1) _(e[n][1]);
			} else {
				let n = c - a;
				if (n > i) {
					let o = a + r;
					for (let t = a; t !== o; t += 1) _(e[t][1]);
					d[f] = ca(p, h, m, g, t), f = d.length, d.push("");
					let s = n - i;
					p = h + s, m = g + s, h = p, g = m;
					for (let t = c - r; t !== c; t += 1) _(e[t][1]);
				} else for (let t = a; t !== c; t += 1) _(e[t][1]);
			}
		}
		for (; c !== n && e[c][0] === M;) v(e[c][1]), c += 1;
		for (; c !== n && e[c][0] === N;) y(e[c][1]), c += 1;
	}
	return l && (d[f] = ca(p, h, m, g, t)), d.join("\n");
}
function ua(e, t) {
	return e.map((e, n, r) => {
		let i = e[1], a = n === 0 || n === r.length - 1;
		switch (e[0]) {
			case M: return aa(i, a, t);
			case N: return oa(i, a, t);
			default: return sa(i, a, t);
		}
	}).join("\n");
}
var da = (e) => e, fa = 5, pa = 0;
function ma() {
	return {
		aAnnotation: "Expected",
		aColor: mt.green,
		aIndicator: "-",
		bAnnotation: "Received",
		bColor: mt.red,
		bIndicator: "+",
		changeColor: mt.inverse,
		changeLineTrailingSpaceColor: da,
		commonColor: mt.dim,
		commonIndicator: " ",
		commonLineTrailingSpaceColor: da,
		compareKeys: void 0,
		contextLines: fa,
		emptyFirstOrLastLinePlaceholder: "",
		expand: !1,
		includeChangeCounts: !1,
		omitAnnotationLines: !1,
		patchColor: mt.yellow,
		printBasicPrototype: !1,
		truncateThreshold: pa,
		truncateAnnotation: "... Diff result is truncated",
		truncateAnnotationColor: da
	};
}
function ha(e) {
	return e && typeof e == "function" ? e : void 0;
}
function ga(e) {
	return typeof e == "number" && Number.isSafeInteger(e) && e >= 0 ? e : fa;
}
function _a(e = {}) {
	return {
		...ma(),
		...e,
		compareKeys: ha(e.compareKeys),
		contextLines: ga(e.contextLines)
	};
}
function va(e) {
	return e.length === 1 && e[0].length === 0;
}
function ya(e) {
	let t = 0, n = 0;
	return e.forEach((e) => {
		switch (e[0]) {
			case M:
				t += 1;
				break;
			case N: n += 1;
		}
	}), {
		a: t,
		b: n
	};
}
function ba({ aAnnotation: e, aColor: t, aIndicator: n, bAnnotation: r, bColor: i, bIndicator: a, includeChangeCounts: o, omitAnnotationLines: s }, c) {
	if (s) return "";
	let l = "", u = "";
	if (o) {
		let t = String(c.a), i = String(c.b), o = r.length - e.length, s = " ".repeat(Math.max(0, o)), d = " ".repeat(Math.max(0, -o)), f = i.length - t.length, p = " ".repeat(Math.max(0, f)), m = " ".repeat(Math.max(0, -f));
		l = `${s}  ${n} ${p}${t}`, u = `${d}  ${a} ${m}${i}`;
	}
	let d = `${n} ${e}${l}`, f = `${a} ${r}${u}`;
	return `${t(d)}
${i(f)}

`;
}
function xa(e, t, n) {
	return ba(n, ya(e)) + (n.expand ? ua(e, n) : la(e, n)) + (t ? n.truncateAnnotationColor(`
${n.truncateAnnotation}`) : "");
}
function Sa(e, t, n) {
	let r = _a(n), [i, a] = wa(va(e) ? [] : e, va(t) ? [] : t, r);
	return xa(i, a, r);
}
function Ca(e, t, n, r, i) {
	if (va(e) && va(n) && (e = [], n = []), va(t) && va(r) && (t = [], r = []), e.length !== n.length || t.length !== r.length) return Sa(e, t, i);
	let [a, o] = wa(n, r, i), s = 0, c = 0;
	return a.forEach((n) => {
		switch (n[0]) {
			case M:
				n[1] = e[s], s += 1;
				break;
			case N:
				n[1] = t[c], c += 1;
				break;
			default: n[1] = t[c], s += 1, c += 1;
		}
	}), xa(a, o, _a(i));
}
function wa(e, t, n) {
	let r = n?.truncateThreshold ?? !1, i = Math.max(Math.floor(n?.truncateThreshold ?? 0), 0), a = r ? Math.min(e.length, i) : e.length, o = r ? Math.min(t.length, i) : t.length, s = a !== e.length || o !== t.length, c = (n, r) => e[n] === t[r], l = [], u = 0, d = 0;
	for (na(a, o, c, (n, r, i) => {
		for (; u !== r; u += 1) l.push(new F(M, e[u]));
		for (; d !== i; d += 1) l.push(new F(N, t[d]));
		for (; n !== 0; --n, u += 1, d += 1) l.push(new F(P, t[d]));
	}); u !== a; u += 1) l.push(new F(M, e[u]));
	for (; d !== o; d += 1) l.push(new F(N, t[d]));
	return [l, s];
}
function Ta(e) {
	if (e === void 0) return "undefined";
	if (e === null) return "null";
	if (Array.isArray(e)) return "array";
	if (typeof e == "boolean") return "boolean";
	if (typeof e == "function") return "function";
	if (typeof e == "number") return "number";
	if (typeof e == "string") return "string";
	if (typeof e == "bigint") return "bigint";
	if (typeof e == "object") {
		if (e != null) {
			if (e.constructor === RegExp) return "regexp";
			if (e.constructor === Map) return "map";
			if (e.constructor === Set) return "set";
			if (e.constructor === Date) return "date";
		}
		return "object";
	}
	if (typeof e == "symbol") return "symbol";
	throw Error(`value of unknown type: ${e}`);
}
function Ea(e) {
	return e.includes("\r\n") ? "\r\n" : "\n";
}
function Da(e, t, n) {
	let r = n?.truncateThreshold ?? !1, i = Math.max(Math.floor(n?.truncateThreshold ?? 0), 0), a = e.length, o = t.length;
	if (r) {
		let n = e.includes("\n"), r = t.includes("\n"), s = Ea(e), c = Ea(t), l = n ? `${e.split(s, i).join(s)}
` : e, u = r ? `${t.split(c, i).join(c)}
` : t;
		a = l.length, o = u.length;
	}
	let s = a !== e.length || o !== t.length, c = (n, r) => e[n] === t[r], l = 0, u = 0, d = [];
	return na(a, o, c, (n, r, i) => {
		l !== r && d.push(new F(M, e.slice(l, r))), u !== i && d.push(new F(N, t.slice(u, i))), l = r + n, u = i + n, d.push(new F(P, t.slice(i, u)));
	}), l !== a && d.push(new F(M, e.slice(l))), u !== o && d.push(new F(N, t.slice(u))), [d, s];
}
function Oa(e, t, n) {
	return t.reduce((t, r) => t + (r[0] === P ? r[1] : r[0] === e && r[1].length !== 0 ? n(r[1]) : ""), "");
}
var ka = class {
	op;
	line;
	lines;
	changeColor;
	constructor(e, t) {
		this.op = e, this.line = [], this.lines = [], this.changeColor = t;
	}
	pushSubstring(e) {
		this.pushDiff(new F(this.op, e));
	}
	pushLine() {
		this.lines.push(this.line.length === 1 ? this.line[0][0] === this.op ? this.line[0] : new F(this.op, this.line[0][1]) : new F(this.op, Oa(this.op, this.line, this.changeColor))), this.line.length = 0;
	}
	isLineEmpty() {
		return this.line.length === 0;
	}
	pushDiff(e) {
		this.line.push(e);
	}
	align(e) {
		let t = e[1];
		if (t.includes("\n")) {
			let e = t.split("\n"), n = e.length - 1;
			e.forEach((e, t) => {
				t < n ? (this.pushSubstring(e), this.pushLine()) : e.length !== 0 && this.pushSubstring(e);
			});
		} else this.pushDiff(e);
	}
	moveLinesTo(e) {
		this.isLineEmpty() || this.pushLine(), e.push(...this.lines), this.lines.length = 0;
	}
}, Aa = class {
	deleteBuffer;
	insertBuffer;
	lines;
	constructor(e, t) {
		this.deleteBuffer = e, this.insertBuffer = t, this.lines = [];
	}
	pushDiffCommonLine(e) {
		this.lines.push(e);
	}
	pushDiffChangeLines(e) {
		let t = e[1].length === 0;
		(!t || this.deleteBuffer.isLineEmpty()) && this.deleteBuffer.pushDiff(e), (!t || this.insertBuffer.isLineEmpty()) && this.insertBuffer.pushDiff(e);
	}
	flushChangeLines() {
		this.deleteBuffer.moveLinesTo(this.lines), this.insertBuffer.moveLinesTo(this.lines);
	}
	align(e) {
		let t = e[0], n = e[1];
		if (n.includes("\n")) {
			let e = n.split("\n"), r = e.length - 1;
			e.forEach((e, n) => {
				if (n === 0) {
					let n = new F(t, e);
					this.deleteBuffer.isLineEmpty() && this.insertBuffer.isLineEmpty() ? (this.flushChangeLines(), this.pushDiffCommonLine(n)) : (this.pushDiffChangeLines(n), this.flushChangeLines());
				} else n < r ? this.pushDiffCommonLine(new F(t, e)) : e.length !== 0 && this.pushDiffChangeLines(new F(t, e));
			});
		} else this.pushDiffChangeLines(e);
	}
	getLines() {
		return this.flushChangeLines(), this.lines;
	}
};
function ja(e, t) {
	let n = new ka(M, t), r = new ka(N, t), i = new Aa(n, r);
	return e.forEach((e) => {
		switch (e[0]) {
			case M:
				n.align(e);
				break;
			case N:
				r.align(e);
				break;
			default: i.align(e);
		}
	}), i.getLines();
}
function Ma(e, t) {
	if (t) {
		let t = e.length - 1;
		return e.some((e, n) => e[0] === P && (n !== t || e[1] !== "\n"));
	}
	return e.some((e) => e[0] === P);
}
function Na(e, t, n) {
	if (e !== t && e.length !== 0 && t.length !== 0) {
		let r = e.includes("\n") || t.includes("\n"), [i, a] = Pa(r ? `${e}
` : e, r ? `${t}
` : t, !0, n);
		if (Ma(i, r)) {
			let e = _a(n);
			return xa(ja(i, e.changeColor), a, e);
		}
	}
	return Sa(e.split("\n"), t.split("\n"), n);
}
function Pa(e, t, n, r) {
	let [i, a] = Da(e, t, r);
	return n && Hi(i), [i, a];
}
function Fa(e, t) {
	let { commonColor: n } = _a(t);
	return n(e);
}
var { AsymmetricMatcher: Ia, DOMCollection: La, DOMElement: Ra, Immutable: za, ReactElement: Ba, ReactTestComponent: Va } = yr, Ha = [
	Va,
	Ba,
	Ra,
	La,
	za,
	Ia,
	yr.Error
], Ua = {
	maxDepth: 20,
	plugins: Ha
}, Wa = {
	callToJSON: !1,
	maxDepth: 8,
	plugins: Ha
};
function Ga(e, t, n) {
	if (Object.is(e, t)) return "";
	let r = Ta(e), i = r, a = !1;
	if (r === "object" && typeof e.asymmetricMatch == "function") {
		if (e.$$typeof !== /* @__PURE__ */ Symbol.for("jest.asymmetricMatcher") || typeof e.getExpectedType != "function") return;
		i = e.getExpectedType(), a = i === "string";
	}
	if (i !== Ta(t)) {
		let r = function(e) {
			return e.length <= p ? e : `${e.slice(0, p)}...`;
		}, { aAnnotation: i, aColor: a, aIndicator: o, bAnnotation: s, bColor: c, bIndicator: l } = _a(n), u = Xa(Wa, n), d = vr(e, u), f = vr(t, u), p = 1e5;
		return d = r(d), f = r(f), `${`${a(`${o} ${i}:`)} 
${d}`}

${`${c(`${l} ${s}:`)} 
${f}`}`;
	}
	if (!a) switch (r) {
		case "string": return Sa(e.split("\n"), t.split("\n"), n);
		case "boolean":
		case "number": return Ka(e, t, n);
		case "map": return Ya(qa(e), qa(t), n);
		case "set": return Ya(Ja(e), Ja(t), n);
		default: return Ya(e, t, n);
	}
}
function Ka(e, t, n) {
	let r = vr(e, Ua), i = vr(t, Ua);
	return r === i ? "" : Sa(r.split("\n"), i.split("\n"), n);
}
function qa(e) {
	return new Map(Array.from(e.entries()).sort());
}
function Ja(e) {
	return new Set(Array.from(e.values()).sort());
}
function Ya(e, t, n) {
	let r, i = !1;
	try {
		r = Za(e, t, Xa(Ua, n), n);
	} catch {
		i = !0;
	}
	let a = Fa(Zi, n);
	return (r === void 0 || r === a) && (r = Za(e, t, Xa(Wa, n), n), r !== a && !i && (r = `${Fa(Qi, n)}

${r}`)), r;
}
function Xa(e, t) {
	let { compareKeys: n, printBasicPrototype: r, maxDepth: i } = _a(t);
	return {
		...e,
		compareKeys: n,
		printBasicPrototype: r,
		maxDepth: i ?? e.maxDepth
	};
}
function Za(e, t, n, r) {
	let i = {
		...n,
		indent: 0
	}, a = vr(e, i), o = vr(t, i);
	if (a === o) return Fa(Zi, r);
	{
		let i = vr(e, n), s = vr(t, n);
		return Ca(i.split("\n"), s.split("\n"), a.split("\n"), o.split("\n"), r);
	}
}
var Qa = 2e4;
function $a(e) {
	return Mi(e) === "Object" && typeof e.asymmetricMatch == "function";
}
function eo(e, t) {
	let n = Mi(e);
	return n === Mi(t) && (n === "Object" || n === "Array");
}
function to(e, t, n) {
	let { aAnnotation: r, bAnnotation: i } = _a(n);
	if (typeof t == "string" && typeof e == "string" && t.length > 0 && e.length > 0 && t.length <= Qa && e.length <= Qa && t !== e) {
		if (t.includes("\n") || e.includes("\n")) return Na(t, e, n);
		let [a] = Pa(t, e, !0), o = a.some((e) => e[0] === P), s = ro(r, i);
		return `${s(r) + so(co(a, M, o))}
${s(i) + oo(co(a, N, o))}`;
	}
	let a = Ii(t, { forceWritable: !0 }), { replacedExpected: o, replacedActual: s } = no(Ii(e, { forceWritable: !0 }), a);
	return Ga(o, s, n);
}
function no(e, t, n = /* @__PURE__ */ new WeakSet(), r = /* @__PURE__ */ new WeakSet()) {
	return e instanceof Error && t instanceof Error && typeof e.cause < "u" && typeof t.cause > "u" ? (delete e.cause, {
		replacedActual: e,
		replacedExpected: t
	}) : (eo(e, t) && (n.has(e) || r.has(t) || (n.add(e), r.add(t), Pi(t).forEach((i) => {
		let a = t[i], o = e[i];
		if ($a(a)) a.asymmetricMatch(o) && (e[i] = a);
		else if ($a(o)) o.asymmetricMatch(a) && (t[i] = o);
		else if (eo(o, a)) {
			let s = no(o, a, n, r);
			e[i] = s.replacedActual, t[i] = s.replacedExpected;
		}
	}))), {
		replacedActual: e,
		replacedExpected: t
	});
}
function ro(...e) {
	let t = e.reduce((e, t) => t.length > e ? t.length : e, 0);
	return (e) => `${e}: ${" ".repeat(t - e.length)}`;
}
var io = "·";
function ao(e) {
	return e.replace(/\s+$/gm, (e) => io.repeat(e.length));
}
function oo(e) {
	return mt.red(ao(wi(e)));
}
function so(e) {
	return mt.green(ao(wi(e)));
}
function co(e, t, n) {
	return e.reduce((e, r) => e + (r[0] === P ? r[1] : r[0] === t ? n ? mt.inverse(r[1]) : r[1] : ""), "");
}
var lo = "@@__IMMUTABLE_RECORD__@@", uo = "@@__IMMUTABLE_ITERABLE__@@";
function fo(e) {
	return e && (e[uo] || e[lo]);
}
var po = Object.getPrototypeOf({});
function mo(e) {
	return e instanceof Error ? `<unserializable>: ${e.message}` : typeof e == "string" ? `<unserializable>: ${e}` : "<unserializable>";
}
function ho(e, t = /* @__PURE__ */ new WeakMap()) {
	if (!e || typeof e == "string") return e;
	if (e instanceof Error && "toJSON" in e && typeof e.toJSON == "function") {
		let n = e.toJSON();
		return n && n !== e && typeof n == "object" && (typeof e.message == "string" && go(() => n.message ??= e.message), typeof e.stack == "string" && go(() => n.stack ??= e.stack), typeof e.name == "string" && go(() => n.name ??= e.name), e.cause != null && go(() => n.cause ??= ho(e.cause, t))), ho(n, t);
	}
	if (typeof e == "function") return `Function<${e.name || "anonymous"}>`;
	if (typeof e == "symbol") return e.toString();
	if (typeof e != "object") return e;
	if (typeof Buffer < "u" && e instanceof Buffer) return `<Buffer(${e.length}) ...>`;
	if (typeof Uint8Array < "u" && e instanceof Uint8Array) return `<Uint8Array(${e.length}) ...>`;
	if (fo(e)) return ho(e.toJSON(), t);
	if (e instanceof Promise || e.constructor && e.constructor.prototype === "AsyncFunction") return "Promise";
	if (typeof Element < "u" && e instanceof Element) return e.tagName;
	if (typeof e.asymmetricMatch == "function") return `${e.toString()} ${Ei(e.sample)}`;
	if (typeof e.toJSON == "function") return ho(e.toJSON(), t);
	if (t.has(e)) return t.get(e);
	if (Array.isArray(e)) {
		let n = Array(e.length);
		return t.set(e, n), e.forEach((e, r) => {
			try {
				n[r] = ho(e, t);
			} catch (e) {
				n[r] = mo(e);
			}
		}), n;
	}
	{
		let n = /* @__PURE__ */ Object.create(null);
		t.set(e, n);
		let r = e;
		for (; r && r !== po;) Object.getOwnPropertyNames(r).forEach((r) => {
			if (!(r in n)) try {
				n[r] = ho(e[r], t);
			} catch (e) {
				delete n[r], n[r] = mo(e);
			}
		}), r = Object.getPrototypeOf(r);
		return n;
	}
}
function go(e) {
	try {
		return e();
	} catch {}
}
function _o(e) {
	return e.replace(/__(vite_ssr_import|vi_import)_\d+__\./g, "");
}
function vo(e, t, n = /* @__PURE__ */ new WeakSet()) {
	if (!e || typeof e != "object") return { message: String(e) };
	let r = e;
	(r.showDiff || r.showDiff === void 0 && r.expected !== void 0 && r.actual !== void 0) && (r.diff = to(r.actual, r.expected, {
		...t,
		...r.diffOptions
	})), "expected" in r && typeof r.expected != "string" && (r.expected = wi(r.expected, 10)), "actual" in r && typeof r.actual != "string" && (r.actual = wi(r.actual, 10));
	try {
		typeof r.message == "string" && (r.message = _o(r.message));
	} catch {}
	try {
		!n.has(r) && typeof r.cause == "object" && (n.add(r), r.cause = vo(r.cause, t, n));
	} catch {}
	try {
		return ho(r);
	} catch (e) {
		return ho(/* @__PURE__ */ Error(`Failed to fully serialize error: ${e?.message}
Inner error message: ${r?.message}`));
	}
}
// node_modules/.bun/storybook@10.6.0+a21bf98ed7e5a9e2/node_modules/storybook/dist/_browser-chunks/chunk-ZUWEVLDX.js
var yo = {
	CALL: "storybook/instrumenter/call",
	SYNC: "storybook/instrumenter/sync",
	START: "storybook/instrumenter/start",
	BACK: "storybook/instrumenter/back",
	GOTO: "storybook/instrumenter/goto",
	NEXT: "storybook/instrumenter/next",
	END: "storybook/instrumenter/end"
}, bo = globalThis.__STORYBOOK_ADDONS_PREVIEW, xo = /* @__PURE__ */ Error("This function ran after the play function completed. Did you forget to `await` it?"), So = (e) => Object.prototype.toString.call(e) === "[object Object]", Co = (e) => Object.prototype.toString.call(e) === "[object Module]", wo = (e) => {
	if (!So(e) && !Co(e)) return !1;
	if (e.constructor === void 0) return !0;
	let t = e.constructor.prototype;
	return !!So(t);
}, To = (e) => {
	try {
		return new e.constructor();
	} catch {
		return {};
	}
}, Eo = () => ({
	renderPhase: "preparing",
	isDebugging: !1,
	isPlaying: !1,
	isLocked: !1,
	cursor: 0,
	calls: [],
	shadowCalls: [],
	callRefsByResult: /* @__PURE__ */ new Map(),
	chainedCallIds: /* @__PURE__ */ new Set(),
	ancestors: [],
	playUntil: void 0,
	resolvers: {},
	syncTimeout: void 0
}), Do = (e, t = !1) => {
	let n = (t ? e.shadowCalls : e.calls).filter((e) => e.retain);
	if (!n.length) return;
	let r = new Map(Array.from(e.callRefsByResult.entries()).filter(([, e]) => e.retain));
	return {
		cursor: n.length,
		calls: n,
		callRefsByResult: r
	};
}, Oo = class {
	constructor() {
		this.detached = !1, this.initialized = !1, this.state = {}, this.loadParentWindowState = () => {
			try {
				this.state = n.window?.parent?.__STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER_STATE__ || {};
			} catch {
				this.detached = !0;
			}
		}, this.updateParentWindowState = () => {
			try {
				n.window.parent.__STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER_STATE__ = this.state;
			} catch {
				this.detached = !0;
			}
		}, this.loadParentWindowState();
		let e = ({ storyId: e, renderPhase: t, isPlaying: n = !0, isDebugging: r = !1 }) => {
			let i = this.getState(e);
			this.setState(e, {
				...Eo(),
				...Do(i, r),
				renderPhase: t || i.renderPhase,
				shadowCalls: r ? i.shadowCalls : [],
				chainedCallIds: r ? i.chainedCallIds : /* @__PURE__ */ new Set(),
				playUntil: r ? i.playUntil : void 0,
				isPlaying: n,
				isDebugging: r
			}), this.sync(e);
		}, t = (e) => ({ storyId: t, playUntil: n }) => {
			this.getState(t).isDebugging || this.setState(t, ({ calls: e }) => ({
				calls: [],
				shadowCalls: e.map((e) => ({
					...e,
					status: "waiting"
				})),
				isDebugging: !0
			}));
			let r = this.getLog(t);
			this.setState(t, ({ shadowCalls: e }) => {
				if (n || !r.length) return { playUntil: n };
				let t = e.findIndex((e) => e.id === r[0].callId);
				return { playUntil: e.slice(0, t).filter((e) => e.interceptable && !e.ancestors?.length).slice(-1)[0]?.id };
			}), e.emit(le, {
				storyId: t,
				isDebugging: !0
			});
		}, r = (e) => ({ storyId: n }) => {
			let r = this.getLog(n).filter((e) => !e.ancestors?.length), i = r.reduceRight((e, t, n) => e >= 0 || t.status === "waiting" ? e : n, -1);
			t(e)({
				storyId: n,
				playUntil: r[i - 1]?.callId
			});
		}, i = (e) => ({ storyId: n, callId: r }) => {
			let { calls: i, shadowCalls: a, resolvers: o } = this.getState(n), s = i.find(({ id: e }) => e === r), c = a.find(({ id: e }) => e === r);
			if (!s && c && Object.values(o).length > 0) {
				let e = this.getLog(n).find((e) => e.status === "waiting")?.callId;
				c.id !== e && this.setState(n, { playUntil: c.id }), Object.values(o).forEach((e) => e());
			} else t(e)({
				storyId: n,
				playUntil: r
			});
		}, a = (e) => ({ storyId: n }) => {
			let { resolvers: r } = this.getState(n);
			if (Object.values(r).length > 0) Object.values(r).forEach((e) => e());
			else {
				let r = this.getLog(n).find((e) => e.status === "waiting")?.callId;
				r ? t(e)({
					storyId: n,
					playUntil: r
				}) : o({ storyId: n });
			}
		}, o = ({ storyId: e }) => {
			this.setState(e, {
				playUntil: void 0,
				isDebugging: !1
			}), Object.values(this.getState(e).resolvers).forEach((e) => e());
		}, s = ({ storyId: t, newPhase: n }) => {
			let { isDebugging: r } = this.getState(t);
			if (n === "preparing" && r || n === "playing") return e({
				storyId: t,
				renderPhase: n,
				isDebugging: r
			});
			n === "played" ? this.setState(t, {
				renderPhase: n,
				isLocked: !1,
				isPlaying: !1,
				isDebugging: !1
			}) : n === "errored" ? this.setState(t, {
				renderPhase: n,
				isLocked: !1,
				isPlaying: !1
			}) : n === "aborted" ? this.setState(t, {
				renderPhase: n,
				isLocked: !0,
				isPlaying: !1
			}) : this.setState(t, { renderPhase: n }), this.sync(t);
		};
		bo && bo.ready().then(() => {
			this.channel = bo.getChannel(), this.channel.on(le, e), this.channel.on(Ie, s), this.channel.on(xe, () => {
				this.initialized ? this.cleanup() : this.initialized = !0;
			}), this.channel.on(yo.START, t(this.channel)), this.channel.on(yo.BACK, r(this.channel)), this.channel.on(yo.GOTO, i(this.channel)), this.channel.on(yo.NEXT, a(this.channel)), this.channel.on(yo.END, o);
		});
	}
	getState(e) {
		return this.state[e] || Eo();
	}
	setState(e, t) {
		if (e) {
			let n = this.getState(e), r = typeof t == "function" ? t(n) : t;
			this.state = {
				...this.state,
				[e]: {
					...n,
					...r
				}
			}, this.updateParentWindowState();
		}
	}
	cleanup() {
		this.state = Object.entries(this.state).reduce((e, [t, n]) => {
			let r = Do(n);
			return r && (e[t] = Object.assign(Eo(), r)), e;
		}, {});
		let e = {
			controlStates: {
				detached: this.detached,
				start: !1,
				back: !1,
				goto: !1,
				next: !1,
				end: !1
			},
			logItems: []
		};
		this.channel?.emit(yo.SYNC, e), this.updateParentWindowState();
	}
	getLog(e) {
		let { calls: t, shadowCalls: n } = this.getState(e), r = [...n];
		t.forEach((e, t) => {
			r[t] = e;
		});
		let i = /* @__PURE__ */ new Set();
		return r.reduceRight((e, t) => (t.args.forEach((e) => {
			e?.__callId__ && i.add(e.__callId__);
		}), t.path.forEach((e) => {
			e.__callId__ && i.add(e.__callId__);
		}), (t.interceptable || t.exception) && !i.has(t.id) && (e.unshift({
			callId: t.id,
			status: t.status,
			ancestors: t.ancestors
		}), i.add(t.id)), e), []);
	}
	instrument(e, t, n = 0) {
		if (!wo(e)) return e;
		let { mutate: r = !1, path: i = [] } = t, a = t.getKeys ? t.getKeys(e, n) : Object.keys(e);
		return n += 1, a.reduce((r, a) => {
			let o = Ao(e, a);
			if (typeof o?.get == "function") {
				if (o.configurable) {
					let s = () => o?.get?.bind(e)?.();
					Object.defineProperty(r, a, { get: () => this.instrument(s(), {
						...t,
						path: i.concat(a)
					}, n) });
				}
				return r;
			}
			let s = e[a];
			return typeof s == "function" ? "__originalFn__" in s && typeof s.__originalFn__ == "function" ? (r[a] = s, r) : (r[a] = (...n) => this.track(a, s, e, n, t), r[a].__originalFn__ = s, Object.defineProperty(r[a], "name", {
				value: a,
				writable: !1
			}), Object.keys(s).length > 0 && Object.assign(r[a], this.instrument({ ...s }, {
				...t,
				path: i.concat(a)
			}, n)), r) : (r[a] = this.instrument(s, {
				...t,
				path: i.concat(a)
			}, n), r);
		}, r ? e : To(e));
	}
	track(e, t, r, i, a) {
		let o = i?.[0]?.__storyId__ || n.__STORYBOOK_PREVIEW__?.selectionStore?.selection?.storyId, { cursor: s, ancestors: c } = this.getState(o);
		this.setState(o, { cursor: s + 1 });
		let l = `${c.slice(-1)[0] || o} [${s}] ${e}`, { path: u = [], intercept: d = !1, retain: f = !1 } = a, p = typeof d == "function" ? d(e, u) : d, m = {
			id: l,
			cursor: s,
			storyId: o,
			ancestors: c,
			path: u,
			method: e,
			args: i,
			interceptable: p,
			retain: f
		}, h = (p && !c.length ? this.intercept : this.invoke).call(this, t, r, m, a);
		return this.instrument(h, {
			...a,
			mutate: !0,
			path: [{ __callId__: m.id }]
		});
	}
	intercept(e, t, n, r) {
		let { chainedCallIds: i, isDebugging: a, playUntil: o } = this.getState(n.storyId), s = i.has(n.id);
		return !a || s || o ? (o === n.id && this.setState(n.storyId, { playUntil: void 0 }), this.invoke(e, t, n, r)) : new Promise((e) => {
			this.setState(n.storyId, ({ resolvers: t }) => ({
				isLocked: !1,
				resolvers: {
					...t,
					[n.id]: e
				}
			}));
		}).then(() => (this.setState(n.storyId, (e) => {
			let { [n.id]: t, ...r } = e.resolvers;
			return {
				isLocked: !0,
				resolvers: r
			};
		}), this.invoke(e, t, n, r)));
	}
	invoke(e, t, r, i) {
		let { callRefsByResult: a, renderPhase: o } = this.getState(r.storyId), s = (e, t, r) => {
			if (r.includes(e)) return "[Circular]";
			if (r = [...r, e], t > 25) return "...";
			if (a.has(e)) return a.get(e);
			if (e instanceof Array) return e.map((e) => s(e, ++t, r));
			if (e instanceof Date) return { __date__: { value: e.toISOString() } };
			if (e instanceof Error) {
				let { name: t, message: n, stack: r } = e;
				return { __error__: {
					name: t,
					message: n,
					stack: r
				} };
			}
			if (e instanceof RegExp) {
				let { flags: t, source: n } = e;
				return { __regexp__: {
					flags: t,
					source: n
				} };
			}
			if (e instanceof n.window?.HTMLElement) {
				let { prefix: t, localName: n, id: r, classList: i, innerText: a } = e;
				return { __element__: {
					prefix: t,
					localName: n,
					id: r,
					classNames: Array.from(i),
					innerText: a
				} };
			}
			return typeof e == "function" ? { __function__: { name: "getMockName" in e ? e.getMockName() : e.name } } : typeof e == "symbol" ? { __symbol__: { description: e.description } } : typeof e == "object" && e?.constructor?.name && e?.constructor?.name !== "Object" ? { __class__: { name: e.constructor.name } } : Object.prototype.toString.call(e) === "[object Object]" ? Object.fromEntries(Object.entries(e).map(([e, n]) => [e, s(n, ++t, r)])) : e;
		}, c = {
			...r,
			args: r.args.map((e) => s(e, 0, []))
		};
		r.path.forEach((e) => {
			e?.__callId__ && this.setState(r.storyId, ({ chainedCallIds: t }) => ({ chainedCallIds: new Set(Array.from(t).concat(e.__callId__)) }));
		});
		let l = (e) => {
			if (e instanceof Error) {
				let { name: t, message: n, stack: i, callId: a = r.id } = e, { showDiff: o = void 0, diff: s = void 0, actual: l = void 0, expected: u = void 0 } = e.name === "AssertionError" ? vo(e) : e, d = {
					name: t,
					message: n,
					stack: i,
					callId: a,
					showDiff: o,
					diff: s,
					actual: l,
					expected: u
				};
				if (this.update({
					...c,
					status: "error",
					exception: d
				}), this.setState(r.storyId, (t) => ({ callRefsByResult: new Map([...Array.from(t.callRefsByResult.entries()), [e, {
					__callId__: r.id,
					retain: r.retain
				}]]) })), r.ancestors?.length) throw Object.prototype.hasOwnProperty.call(e, "callId") || Object.defineProperty(e, "callId", { value: r.id }), e;
			}
			throw e;
		};
		try {
			if (o === "played" && !r.retain) throw xo;
			let n = (i.getArgs ? i.getArgs(r, this.getState(r.storyId)) : r.args).map((e) => typeof e != "function" || jo(e) || Object.keys(e).length ? e : (...t) => {
				let { cursor: n, ancestors: i } = this.getState(r.storyId);
				this.setState(r.storyId, {
					cursor: 0,
					ancestors: [...i, r.id]
				});
				let a = () => this.setState(r.storyId, {
					cursor: n,
					ancestors: i
				}), o = !1;
				try {
					let n = e(...t);
					return n instanceof Promise ? (o = !0, n.finally(a)) : n;
				} finally {
					o || a();
				}
			}), a = e.apply(t, n);
			return a && [
				"object",
				"function",
				"symbol"
			].includes(typeof a) && this.setState(r.storyId, (e) => ({ callRefsByResult: new Map([...Array.from(e.callRefsByResult.entries()), [a, {
				__callId__: r.id,
				retain: r.retain
			}]]) })), this.update({
				...c,
				status: a instanceof Promise ? "active" : "done"
			}), a instanceof Promise ? a.then((e) => (this.update({
				...c,
				status: "done"
			}), e), l) : a;
		} catch (e) {
			return l(e);
		}
	}
	update(e) {
		this.channel?.emit(yo.CALL, e), this.setState(e.storyId, ({ calls: t }) => {
			let n = t.concat(e).reduce((e, t) => Object.assign(e, { [t.id]: t }), {});
			return { calls: Object.values(n).sort((e, t) => e.id.localeCompare(t.id, void 0, { numeric: !0 })) };
		}), this.sync(e.storyId);
	}
	sync(e) {
		let t = () => {
			let { isLocked: t, isPlaying: n } = this.getState(e), r = this.getLog(e), i = r.filter(({ ancestors: e }) => !e.length).find((e) => e.status === "waiting")?.callId, a = r.some((e) => e.status === "active");
			if (this.detached || t || a || r.length === 0) {
				let e = {
					controlStates: {
						detached: this.detached,
						start: !1,
						back: !1,
						goto: !1,
						next: !1,
						end: !1
					},
					logItems: r
				};
				this.channel?.emit(yo.SYNC, e);
				return;
			}
			let o = r.some((e) => e.status === "done" || e.status === "error"), s = {
				controlStates: {
					detached: this.detached,
					start: o,
					back: o,
					goto: !0,
					next: n,
					end: n
				},
				logItems: r,
				pausedAt: i
			};
			this.channel?.emit(yo.SYNC, s);
		};
		this.setState(e, ({ syncTimeout: e }) => (clearTimeout(e), { syncTimeout: setTimeout(t, 0) }));
	}
};
function ko(e, t = {}) {
	try {
		let r = !1, i = !1;
		return n.window?.location?.search?.includes("instrument=true") ? r = !0 : n.window?.location?.search?.includes("instrument=false") && (i = !0), n.window?.parent === n.window && !r || i ? e : (n.window && !n.window.__STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER__ && (n.window.__STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER__ = new Oo()), (n.window?.__STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER__).instrument(e, t));
	} catch (t) {
		return S.warn(t), e;
	}
}
function Ao(e, t) {
	let n = e;
	for (; n != null;) {
		let e = Object.getOwnPropertyDescriptor(n, t);
		if (e) return e;
		n = Object.getPrototypeOf(n);
	}
}
function jo(e) {
	if (typeof e != "function") return !1;
	let t = Object.getOwnPropertyDescriptor(e, "prototype");
	return t ? !t.writable : !1;
}
// node_modules/.bun/storybook@10.6.0+a21bf98ed7e5a9e2/node_modules/storybook/dist/test/index.js
var Mo = d({ "../../node_modules/min-indent/index.ts"(e, t) {
	t.exports = (e) => {
		let t = e.match(/^[ \t]*(?=\S)/gm);
		return t ? t.reduce((e, t) => Math.min(e, t.length), 1 / 0) : 0;
	};
} }), No = d({ "../../node_modules/strip-indent/index.ts"(e, t) {
	var n = Mo();
	t.exports = (e) => {
		let t = n(e);
		if (t === 0) return e;
		let r = RegExp(`^[ \\t]{${t}}`, "gm");
		return e.replace(r, "");
	};
} }), Po = d({ "../../node_modules/indent-string/index.ts"(e, t) {
	t.exports = (e, t = 1, n) => {
		if (n = {
			indent: " ",
			includeEmptyLines: !1,
			...n
		}, typeof e != "string") throw TypeError(`Expected \`input\` to be a \`string\`, got \`${typeof e}\``);
		if (typeof t != "number") throw TypeError(`Expected \`count\` to be a \`number\`, got \`${typeof t}\``);
		if (typeof n.indent != "string") throw TypeError(`Expected \`options.indent\` to be a \`string\`, got \`${typeof n.indent}\``);
		if (t === 0) return e;
		let r = n.includeEmptyLines ? /^/gm : /^(?!\s*$)/gm;
		return e.replace(r, n.indent.repeat(t));
	};
} }), Fo = d({ "../../node_modules/redent/index.ts"(e, t) {
	var n = No(), r = Po();
	t.exports = (e, t = 0, i) => r(n(e), t, i);
} }), Io = d({ "../../node_modules/aria-query/lib/util/iteratorProxy.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0;
	function t() {
		var e = this, t = 0, n = {
			"@@iterator": function() {
				return n;
			},
			next: function() {
				if (t < e.length) {
					var n = e[t];
					return t += 1, {
						done: !1,
						value: n
					};
				}
				return { done: !0 };
			}
		};
		return n;
	}
	e.default = t;
} }), Lo = d({ "../../node_modules/aria-query/lib/util/iterationDecorator.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = i;
	var t = n(Io());
	function n(e) {
		return e && e.__esModule ? e : { default: e };
	}
	function r(e) {
		"@babel/helpers - typeof";
		return r = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
			return typeof e;
		} : function(e) {
			return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
		}, r(e);
	}
	function i(e, n) {
		return typeof Symbol == "function" && r(Symbol.iterator) === "symbol" && Object.defineProperty(e, Symbol.iterator, { value: t.default.bind(n) }), e;
	}
} }), Ro = d({ "../../node_modules/aria-query/lib/ariaPropsMap.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0;
	var t = n(Lo());
	function n(e) {
		return e && e.__esModule ? e : { default: e };
	}
	function r(e, t) {
		return c(e) || s(e, t) || a(e, t) || i();
	}
	function i() {
		throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
	}
	function a(e, t) {
		if (e) {
			if (typeof e == "string") return o(e, t);
			var n = {}.toString.call(e).slice(8, -1);
			return n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set" ? Array.from(e) : n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n) ? o(e, t) : void 0;
		}
	}
	function o(e, t) {
		(t == null || t > e.length) && (t = e.length);
		for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
		return r;
	}
	function s(e, t) {
		var n = e == null ? null : typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
		if (n != null) {
			var r, i, a, o, s = [], c = !0, l = !1;
			try {
				if (a = (n = n.call(e)).next, t === 0) {
					if (Object(n) !== n) return;
					c = !1;
				} else for (; !(c = (r = a.call(n)).done) && (s.push(r.value), s.length !== t); c = !0);
			} catch (e) {
				l = !0, i = e;
			} finally {
				try {
					if (!c && n.return != null && (o = n.return(), Object(o) !== o)) return;
				} finally {
					if (l) throw i;
				}
			}
			return s;
		}
	}
	function c(e) {
		if (Array.isArray(e)) return e;
	}
	var l = [
		["aria-activedescendant", { type: "id" }],
		["aria-atomic", { type: "boolean" }],
		["aria-autocomplete", {
			type: "token",
			values: [
				"inline",
				"list",
				"both",
				"none"
			]
		}],
		["aria-braillelabel", { type: "string" }],
		["aria-brailleroledescription", { type: "string" }],
		["aria-busy", { type: "boolean" }],
		["aria-checked", { type: "tristate" }],
		["aria-colcount", { type: "integer" }],
		["aria-colindex", { type: "integer" }],
		["aria-colspan", { type: "integer" }],
		["aria-controls", { type: "idlist" }],
		["aria-current", {
			type: "token",
			values: [
				"page",
				"step",
				"location",
				"date",
				"time",
				!0,
				!1
			]
		}],
		["aria-describedby", { type: "idlist" }],
		["aria-description", { type: "string" }],
		["aria-details", { type: "id" }],
		["aria-disabled", { type: "boolean" }],
		["aria-dropeffect", {
			type: "tokenlist",
			values: [
				"copy",
				"execute",
				"link",
				"move",
				"none",
				"popup"
			]
		}],
		["aria-errormessage", { type: "id" }],
		["aria-expanded", {
			type: "boolean",
			allowundefined: !0
		}],
		["aria-flowto", { type: "idlist" }],
		["aria-grabbed", {
			type: "boolean",
			allowundefined: !0
		}],
		["aria-haspopup", {
			type: "token",
			values: [
				!1,
				!0,
				"menu",
				"listbox",
				"tree",
				"grid",
				"dialog"
			]
		}],
		["aria-hidden", {
			type: "boolean",
			allowundefined: !0
		}],
		["aria-invalid", {
			type: "token",
			values: [
				"grammar",
				!1,
				"spelling",
				!0
			]
		}],
		["aria-keyshortcuts", { type: "string" }],
		["aria-label", { type: "string" }],
		["aria-labelledby", { type: "idlist" }],
		["aria-level", { type: "integer" }],
		["aria-live", {
			type: "token",
			values: [
				"assertive",
				"off",
				"polite"
			]
		}],
		["aria-modal", { type: "boolean" }],
		["aria-multiline", { type: "boolean" }],
		["aria-multiselectable", { type: "boolean" }],
		["aria-orientation", {
			type: "token",
			values: [
				"vertical",
				"undefined",
				"horizontal"
			]
		}],
		["aria-owns", { type: "idlist" }],
		["aria-placeholder", { type: "string" }],
		["aria-posinset", { type: "integer" }],
		["aria-pressed", { type: "tristate" }],
		["aria-readonly", { type: "boolean" }],
		["aria-relevant", {
			type: "tokenlist",
			values: [
				"additions",
				"all",
				"removals",
				"text"
			]
		}],
		["aria-required", { type: "boolean" }],
		["aria-roledescription", { type: "string" }],
		["aria-rowcount", { type: "integer" }],
		["aria-rowindex", { type: "integer" }],
		["aria-rowspan", { type: "integer" }],
		["aria-selected", {
			type: "boolean",
			allowundefined: !0
		}],
		["aria-setsize", { type: "integer" }],
		["aria-sort", {
			type: "token",
			values: [
				"ascending",
				"descending",
				"none",
				"other"
			]
		}],
		["aria-valuemax", { type: "number" }],
		["aria-valuemin", { type: "number" }],
		["aria-valuenow", { type: "number" }],
		["aria-valuetext", { type: "string" }]
	], u = {
		entries: function() {
			return l;
		},
		forEach: function(e) {
			for (var t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null, n = 0, i = l; n < i.length; n++) {
				var a = r(i[n], 2), o = a[0], s = a[1];
				e.call(t, s, o, l);
			}
		},
		get: function(e) {
			var t = l.filter(function(t) {
				return t[0] === e;
			})[0];
			return t && t[1];
		},
		has: function(e) {
			return !!u.get(e);
		},
		keys: function() {
			return l.map(function(e) {
				return r(e, 1)[0];
			});
		},
		values: function() {
			return l.map(function(e) {
				return r(e, 2)[1];
			});
		}
	};
	e.default = (0, t.default)(u, u.entries());
} }), zo = d({ "../../node_modules/aria-query/lib/domMap.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0;
	var t = n(Lo());
	function n(e) {
		return e && e.__esModule ? e : { default: e };
	}
	function r(e, t) {
		return c(e) || s(e, t) || a(e, t) || i();
	}
	function i() {
		throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
	}
	function a(e, t) {
		if (e) {
			if (typeof e == "string") return o(e, t);
			var n = {}.toString.call(e).slice(8, -1);
			return n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set" ? Array.from(e) : n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n) ? o(e, t) : void 0;
		}
	}
	function o(e, t) {
		(t == null || t > e.length) && (t = e.length);
		for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
		return r;
	}
	function s(e, t) {
		var n = e == null ? null : typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
		if (n != null) {
			var r, i, a, o, s = [], c = !0, l = !1;
			try {
				if (a = (n = n.call(e)).next, t === 0) {
					if (Object(n) !== n) return;
					c = !1;
				} else for (; !(c = (r = a.call(n)).done) && (s.push(r.value), s.length !== t); c = !0);
			} catch (e) {
				l = !0, i = e;
			} finally {
				try {
					if (!c && n.return != null && (o = n.return(), Object(o) !== o)) return;
				} finally {
					if (l) throw i;
				}
			}
			return s;
		}
	}
	function c(e) {
		if (Array.isArray(e)) return e;
	}
	var l = [
		["a", { reserved: !1 }],
		["abbr", { reserved: !1 }],
		["acronym", { reserved: !1 }],
		["address", { reserved: !1 }],
		["applet", { reserved: !1 }],
		["area", { reserved: !1 }],
		["article", { reserved: !1 }],
		["aside", { reserved: !1 }],
		["audio", { reserved: !1 }],
		["b", { reserved: !1 }],
		["base", { reserved: !0 }],
		["bdi", { reserved: !1 }],
		["bdo", { reserved: !1 }],
		["big", { reserved: !1 }],
		["blink", { reserved: !1 }],
		["blockquote", { reserved: !1 }],
		["body", { reserved: !1 }],
		["br", { reserved: !1 }],
		["button", { reserved: !1 }],
		["canvas", { reserved: !1 }],
		["caption", { reserved: !1 }],
		["center", { reserved: !1 }],
		["cite", { reserved: !1 }],
		["code", { reserved: !1 }],
		["col", { reserved: !0 }],
		["colgroup", { reserved: !0 }],
		["content", { reserved: !1 }],
		["data", { reserved: !1 }],
		["datalist", { reserved: !1 }],
		["dd", { reserved: !1 }],
		["del", { reserved: !1 }],
		["details", { reserved: !1 }],
		["dfn", { reserved: !1 }],
		["dialog", { reserved: !1 }],
		["dir", { reserved: !1 }],
		["div", { reserved: !1 }],
		["dl", { reserved: !1 }],
		["dt", { reserved: !1 }],
		["em", { reserved: !1 }],
		["embed", { reserved: !1 }],
		["fieldset", { reserved: !1 }],
		["figcaption", { reserved: !1 }],
		["figure", { reserved: !1 }],
		["font", { reserved: !1 }],
		["footer", { reserved: !1 }],
		["form", { reserved: !1 }],
		["frame", { reserved: !1 }],
		["frameset", { reserved: !1 }],
		["h1", { reserved: !1 }],
		["h2", { reserved: !1 }],
		["h3", { reserved: !1 }],
		["h4", { reserved: !1 }],
		["h5", { reserved: !1 }],
		["h6", { reserved: !1 }],
		["head", { reserved: !0 }],
		["header", { reserved: !1 }],
		["hgroup", { reserved: !1 }],
		["hr", { reserved: !1 }],
		["html", { reserved: !0 }],
		["i", { reserved: !1 }],
		["iframe", { reserved: !1 }],
		["img", { reserved: !1 }],
		["input", { reserved: !1 }],
		["ins", { reserved: !1 }],
		["kbd", { reserved: !1 }],
		["keygen", { reserved: !1 }],
		["label", { reserved: !1 }],
		["legend", { reserved: !1 }],
		["li", { reserved: !1 }],
		["link", { reserved: !0 }],
		["main", { reserved: !1 }],
		["map", { reserved: !1 }],
		["mark", { reserved: !1 }],
		["marquee", { reserved: !1 }],
		["menu", { reserved: !1 }],
		["menuitem", { reserved: !1 }],
		["meta", { reserved: !0 }],
		["meter", { reserved: !1 }],
		["nav", { reserved: !1 }],
		["noembed", { reserved: !0 }],
		["noscript", { reserved: !0 }],
		["object", { reserved: !1 }],
		["ol", { reserved: !1 }],
		["optgroup", { reserved: !1 }],
		["option", { reserved: !1 }],
		["output", { reserved: !1 }],
		["p", { reserved: !1 }],
		["param", { reserved: !0 }],
		["picture", { reserved: !0 }],
		["pre", { reserved: !1 }],
		["progress", { reserved: !1 }],
		["q", { reserved: !1 }],
		["rp", { reserved: !1 }],
		["rt", { reserved: !1 }],
		["rtc", { reserved: !1 }],
		["ruby", { reserved: !1 }],
		["s", { reserved: !1 }],
		["samp", { reserved: !1 }],
		["script", { reserved: !0 }],
		["section", { reserved: !1 }],
		["select", { reserved: !1 }],
		["small", { reserved: !1 }],
		["source", { reserved: !0 }],
		["spacer", { reserved: !1 }],
		["span", { reserved: !1 }],
		["strike", { reserved: !1 }],
		["strong", { reserved: !1 }],
		["style", { reserved: !0 }],
		["sub", { reserved: !1 }],
		["summary", { reserved: !1 }],
		["sup", { reserved: !1 }],
		["table", { reserved: !1 }],
		["tbody", { reserved: !1 }],
		["td", { reserved: !1 }],
		["textarea", { reserved: !1 }],
		["tfoot", { reserved: !1 }],
		["th", { reserved: !1 }],
		["thead", { reserved: !1 }],
		["time", { reserved: !1 }],
		["title", { reserved: !0 }],
		["tr", { reserved: !1 }],
		["track", { reserved: !0 }],
		["tt", { reserved: !1 }],
		["u", { reserved: !1 }],
		["ul", { reserved: !1 }],
		["var", { reserved: !1 }],
		["video", { reserved: !1 }],
		["wbr", { reserved: !1 }],
		["xmp", { reserved: !1 }]
	], u = {
		entries: function() {
			return l;
		},
		forEach: function(e) {
			for (var t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null, n = 0, i = l; n < i.length; n++) {
				var a = r(i[n], 2), o = a[0], s = a[1];
				e.call(t, s, o, l);
			}
		},
		get: function(e) {
			var t = l.filter(function(t) {
				return t[0] === e;
			})[0];
			return t && t[1];
		},
		has: function(e) {
			return !!u.get(e);
		},
		keys: function() {
			return l.map(function(e) {
				return r(e, 1)[0];
			});
		},
		values: function() {
			return l.map(function(e) {
				return r(e, 2)[1];
			});
		}
	};
	e.default = (0, t.default)(u, u.entries());
} }), Bo = d({ "../../node_modules/aria-query/lib/etc/roles/abstract/commandRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !0,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [["roletype", "widget"]]
	};
} }), Vo = d({ "../../node_modules/aria-query/lib/etc/roles/abstract/compositeRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !0,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-activedescendant": null,
			"aria-disabled": null
		},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [["roletype", "widget"]]
	};
} }), Ho = d({ "../../node_modules/aria-query/lib/etc/roles/abstract/inputRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !0,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: { "aria-disabled": null },
		relatedConcepts: [{
			concept: { name: "input" },
			module: "XForms"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [["roletype", "widget"]]
	};
} }), Uo = d({ "../../node_modules/aria-query/lib/etc/roles/abstract/landmarkRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !0,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), Wo = d({ "../../node_modules/aria-query/lib/etc/roles/abstract/rangeRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !0,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-valuemax": null,
			"aria-valuemin": null,
			"aria-valuenow": null
		},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [["roletype", "structure"]]
	};
} }), Go = d({ "../../node_modules/aria-query/lib/etc/roles/abstract/roletypeRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !0,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: [],
		prohibitedProps: [],
		props: {
			"aria-atomic": null,
			"aria-busy": null,
			"aria-controls": null,
			"aria-current": null,
			"aria-describedby": null,
			"aria-details": null,
			"aria-dropeffect": null,
			"aria-flowto": null,
			"aria-grabbed": null,
			"aria-hidden": null,
			"aria-keyshortcuts": null,
			"aria-label": null,
			"aria-labelledby": null,
			"aria-live": null,
			"aria-owns": null,
			"aria-relevant": null,
			"aria-roledescription": null
		},
		relatedConcepts: [{
			concept: { name: "role" },
			module: "XHTML"
		}, {
			concept: { name: "type" },
			module: "Dublin Core"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: []
	};
} }), Ko = d({ "../../node_modules/aria-query/lib/etc/roles/abstract/sectionRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !0,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: [],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [
			{
				concept: { name: "frontmatter" },
				module: "DTB"
			},
			{
				concept: { name: "level" },
				module: "DTB"
			},
			{
				concept: { name: "level" },
				module: "SMIL"
			}
		],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [["roletype", "structure"]]
	};
} }), qo = d({ "../../node_modules/aria-query/lib/etc/roles/abstract/sectionheadRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !0,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [["roletype", "structure"]]
	};
} }), Jo = d({ "../../node_modules/aria-query/lib/etc/roles/abstract/selectRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !0,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: { "aria-orientation": null },
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"widget",
			"composite"
		], [
			"roletype",
			"structure",
			"section",
			"group"
		]]
	};
} }), Yo = d({ "../../node_modules/aria-query/lib/etc/roles/abstract/structureRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !0,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: [],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [["roletype"]]
	};
} }), Xo = d({ "../../node_modules/aria-query/lib/etc/roles/abstract/widgetRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !0,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: [],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [["roletype"]]
	};
} }), Zo = d({ "../../node_modules/aria-query/lib/etc/roles/abstract/windowRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !0,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: { "aria-modal": null },
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [["roletype"]]
	};
} }), Qo = d({ "../../node_modules/aria-query/lib/etc/roles/ariaAbstractRoles.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0;
	var t = p(Bo()), n = p(Vo()), r = p(Ho()), i = p(Uo()), a = p(Wo()), o = p(Go()), s = p(Ko()), c = p(qo()), l = p(Jo()), u = p(Yo()), d = p(Xo()), f = p(Zo());
	function p(e) {
		return e && e.__esModule ? e : { default: e };
	}
	e.default = [
		["command", t.default],
		["composite", n.default],
		["input", r.default],
		["landmark", i.default],
		["range", a.default],
		["roletype", o.default],
		["section", s.default],
		["sectionhead", c.default],
		["select", l.default],
		["structure", u.default],
		["widget", d.default],
		["window", f.default]
	];
} }), $o = d({ "../../node_modules/aria-query/lib/etc/roles/literal/alertRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-atomic": "true",
			"aria-live": "assertive"
		},
		relatedConcepts: [{
			concept: { name: "alert" },
			module: "XForms"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), es = d({ "../../node_modules/aria-query/lib/etc/roles/literal/alertdialogRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [{
			concept: { name: "alert" },
			module: "XForms"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"alert"
		], [
			"roletype",
			"window",
			"dialog"
		]]
	};
} }), ts = d({ "../../node_modules/aria-query/lib/etc/roles/literal/applicationRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-activedescendant": null,
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{ concept: { name: "Device Independence Delivery Unit" } }],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [["roletype", "structure"]]
	};
} }), ns = d({ "../../node_modules/aria-query/lib/etc/roles/literal/articleRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-posinset": null,
			"aria-setsize": null
		},
		relatedConcepts: [{
			concept: { name: "article" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"document"
		]]
	};
} }), rs = d({ "../../node_modules/aria-query/lib/etc/roles/literal/bannerRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [{
			concept: {
				constraints: ["scoped to the body element"],
				name: "header"
			},
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), is = d({ "../../node_modules/aria-query/lib/etc/roles/literal/blockquoteRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [{
			concept: { name: "blockquote" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), as = d({ "../../node_modules/aria-query/lib/etc/roles/literal/buttonRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !0,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-pressed": null
		},
		relatedConcepts: [
			{
				concept: {
					attributes: [{
						name: "type",
						value: "button"
					}],
					name: "input"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						name: "type",
						value: "image"
					}],
					name: "input"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						name: "type",
						value: "reset"
					}],
					name: "input"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						name: "type",
						value: "submit"
					}],
					name: "input"
				},
				module: "HTML"
			},
			{
				concept: { name: "button" },
				module: "HTML"
			},
			{
				concept: { name: "trigger" },
				module: "XForms"
			}
		],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"widget",
			"command"
		]]
	};
} }), os = d({ "../../node_modules/aria-query/lib/etc/roles/literal/captionRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["prohibited"],
		prohibitedProps: ["aria-label", "aria-labelledby"],
		props: {},
		relatedConcepts: [{
			concept: { name: "caption" },
			module: "HTML"
		}],
		requireContextRole: [
			"figure",
			"grid",
			"table"
		],
		requiredContextRole: [
			"figure",
			"grid",
			"table"
		],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), ss = d({ "../../node_modules/aria-query/lib/etc/roles/literal/cellRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {
			"aria-colindex": null,
			"aria-colspan": null,
			"aria-rowindex": null,
			"aria-rowspan": null
		},
		relatedConcepts: [{
			concept: {
				constraints: ["ancestor table element has table role"],
				name: "td"
			},
			module: "HTML"
		}],
		requireContextRole: ["row"],
		requiredContextRole: ["row"],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), cs = d({ "../../node_modules/aria-query/lib/etc/roles/literal/checkboxRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !0,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {
			"aria-checked": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-invalid": null,
			"aria-readonly": null,
			"aria-required": null
		},
		relatedConcepts: [{
			concept: {
				attributes: [{
					name: "type",
					value: "checkbox"
				}],
				name: "input"
			},
			module: "HTML"
		}, {
			concept: { name: "option" },
			module: "ARIA"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: { "aria-checked": null },
		superClass: [[
			"roletype",
			"widget",
			"input"
		]]
	};
} }), ls = d({ "../../node_modules/aria-query/lib/etc/roles/literal/codeRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["prohibited"],
		prohibitedProps: ["aria-label", "aria-labelledby"],
		props: {},
		relatedConcepts: [{
			concept: { name: "code" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), us = d({ "../../node_modules/aria-query/lib/etc/roles/literal/columnheaderRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: { "aria-sort": null },
		relatedConcepts: [
			{
				concept: { name: "th" },
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						name: "scope",
						value: "col"
					}],
					name: "th"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						name: "scope",
						value: "colgroup"
					}],
					name: "th"
				},
				module: "HTML"
			}
		],
		requireContextRole: ["row"],
		requiredContextRole: ["row"],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [
			[
				"roletype",
				"structure",
				"section",
				"cell"
			],
			[
				"roletype",
				"structure",
				"section",
				"cell",
				"gridcell"
			],
			[
				"roletype",
				"widget",
				"gridcell"
			],
			[
				"roletype",
				"structure",
				"sectionhead"
			]
		]
	};
} }), ds = d({ "../../node_modules/aria-query/lib/etc/roles/literal/comboboxRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-activedescendant": null,
			"aria-autocomplete": null,
			"aria-errormessage": null,
			"aria-invalid": null,
			"aria-readonly": null,
			"aria-required": null,
			"aria-expanded": "false",
			"aria-haspopup": "listbox"
		},
		relatedConcepts: [
			{
				concept: {
					attributes: [{
						constraints: ["set"],
						name: "list"
					}, {
						name: "type",
						value: "email"
					}],
					name: "input"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						constraints: ["set"],
						name: "list"
					}, {
						name: "type",
						value: "search"
					}],
					name: "input"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						constraints: ["set"],
						name: "list"
					}, {
						name: "type",
						value: "tel"
					}],
					name: "input"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						constraints: ["set"],
						name: "list"
					}, {
						name: "type",
						value: "text"
					}],
					name: "input"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						constraints: ["set"],
						name: "list"
					}, {
						name: "type",
						value: "url"
					}],
					name: "input"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						constraints: ["set"],
						name: "list"
					}, {
						name: "type",
						value: "url"
					}],
					name: "input"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						constraints: ["undefined"],
						name: "multiple"
					}, {
						constraints: ["undefined"],
						name: "size"
					}],
					constraints: ["the multiple attribute is not set and the size attribute does not have a value greater than 1"],
					name: "select"
				},
				module: "HTML"
			},
			{
				concept: { name: "select" },
				module: "XForms"
			}
		],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {
			"aria-controls": null,
			"aria-expanded": "false"
		},
		superClass: [[
			"roletype",
			"widget",
			"input"
		]]
	};
} }), fs = d({ "../../node_modules/aria-query/lib/etc/roles/literal/complementaryRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [
			{
				concept: {
					constraints: ["scoped to the body element", "scoped to the main element"],
					name: "aside"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						constraints: ["set"],
						name: "aria-label"
					}],
					constraints: ["scoped to a sectioning content element", "scoped to a sectioning root element other than body"],
					name: "aside"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						constraints: ["set"],
						name: "aria-labelledby"
					}],
					constraints: ["scoped to a sectioning content element", "scoped to a sectioning root element other than body"],
					name: "aside"
				},
				module: "HTML"
			}
		],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), ps = d({ "../../node_modules/aria-query/lib/etc/roles/literal/contentinfoRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [{
			concept: {
				constraints: ["scoped to the body element"],
				name: "footer"
			},
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), ms = d({ "../../node_modules/aria-query/lib/etc/roles/literal/definitionRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [{
			concept: { name: "dd" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), hs = d({ "../../node_modules/aria-query/lib/etc/roles/literal/deletionRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["prohibited"],
		prohibitedProps: ["aria-label", "aria-labelledby"],
		props: {},
		relatedConcepts: [{
			concept: { name: "del" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), gs = d({ "../../node_modules/aria-query/lib/etc/roles/literal/dialogRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [{
			concept: { name: "dialog" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [["roletype", "window"]]
	};
} }), _s = d({ "../../node_modules/aria-query/lib/etc/roles/literal/directoryRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [{ module: "DAISY Guide" }],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"list"
		]]
	};
} }), vs = d({ "../../node_modules/aria-query/lib/etc/roles/literal/documentRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [{ concept: { name: "Device Independence Delivery Unit" } }, {
			concept: { name: "html" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [["roletype", "structure"]]
	};
} }), ys = d({ "../../node_modules/aria-query/lib/etc/roles/literal/emphasisRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["prohibited"],
		prohibitedProps: ["aria-label", "aria-labelledby"],
		props: {},
		relatedConcepts: [{
			concept: { name: "em" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), bs = d({ "../../node_modules/aria-query/lib/etc/roles/literal/feedRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [["article"]],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"list"
		]]
	};
} }), xs = d({ "../../node_modules/aria-query/lib/etc/roles/literal/figureRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [{
			concept: { name: "figure" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), Ss = d({ "../../node_modules/aria-query/lib/etc/roles/literal/formRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [
			{
				concept: {
					attributes: [{
						constraints: ["set"],
						name: "aria-label"
					}],
					name: "form"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						constraints: ["set"],
						name: "aria-labelledby"
					}],
					name: "form"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						constraints: ["set"],
						name: "name"
					}],
					name: "form"
				},
				module: "HTML"
			}
		],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), Cs = d({ "../../node_modules/aria-query/lib/etc/roles/literal/genericRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["prohibited"],
		prohibitedProps: ["aria-label", "aria-labelledby"],
		props: {},
		relatedConcepts: [
			{
				concept: { name: "a" },
				module: "HTML"
			},
			{
				concept: { name: "area" },
				module: "HTML"
			},
			{
				concept: { name: "aside" },
				module: "HTML"
			},
			{
				concept: { name: "b" },
				module: "HTML"
			},
			{
				concept: { name: "bdo" },
				module: "HTML"
			},
			{
				concept: { name: "body" },
				module: "HTML"
			},
			{
				concept: { name: "data" },
				module: "HTML"
			},
			{
				concept: { name: "div" },
				module: "HTML"
			},
			{
				concept: {
					constraints: [
						"scoped to the main element",
						"scoped to a sectioning content element",
						"scoped to a sectioning root element other than body"
					],
					name: "footer"
				},
				module: "HTML"
			},
			{
				concept: {
					constraints: [
						"scoped to the main element",
						"scoped to a sectioning content element",
						"scoped to a sectioning root element other than body"
					],
					name: "header"
				},
				module: "HTML"
			},
			{
				concept: { name: "hgroup" },
				module: "HTML"
			},
			{
				concept: { name: "i" },
				module: "HTML"
			},
			{
				concept: { name: "pre" },
				module: "HTML"
			},
			{
				concept: { name: "q" },
				module: "HTML"
			},
			{
				concept: { name: "samp" },
				module: "HTML"
			},
			{
				concept: { name: "section" },
				module: "HTML"
			},
			{
				concept: { name: "small" },
				module: "HTML"
			},
			{
				concept: { name: "span" },
				module: "HTML"
			},
			{
				concept: { name: "u" },
				module: "HTML"
			}
		],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [["roletype", "structure"]]
	};
} }), ws = d({ "../../node_modules/aria-query/lib/etc/roles/literal/gridRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-multiselectable": null,
			"aria-readonly": null
		},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [["row"], ["row", "rowgroup"]],
		requiredProps: {},
		superClass: [[
			"roletype",
			"widget",
			"composite"
		], [
			"roletype",
			"structure",
			"section",
			"table"
		]]
	};
} }), Ts = d({ "../../node_modules/aria-query/lib/etc/roles/literal/gridcellRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null,
			"aria-readonly": null,
			"aria-required": null,
			"aria-selected": null
		},
		relatedConcepts: [{
			concept: {
				constraints: ["ancestor table element has grid role", "ancestor table element has treegrid role"],
				name: "td"
			},
			module: "HTML"
		}],
		requireContextRole: ["row"],
		requiredContextRole: ["row"],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"cell"
		], ["roletype", "widget"]]
	};
} }), Es = d({ "../../node_modules/aria-query/lib/etc/roles/literal/groupRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-activedescendant": null,
			"aria-disabled": null
		},
		relatedConcepts: [
			{
				concept: { name: "details" },
				module: "HTML"
			},
			{
				concept: { name: "fieldset" },
				module: "HTML"
			},
			{
				concept: { name: "optgroup" },
				module: "HTML"
			},
			{
				concept: { name: "address" },
				module: "HTML"
			}
		],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), Ds = d({ "../../node_modules/aria-query/lib/etc/roles/literal/headingRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: { "aria-level": "2" },
		relatedConcepts: [
			{
				concept: { name: "h1" },
				module: "HTML"
			},
			{
				concept: { name: "h2" },
				module: "HTML"
			},
			{
				concept: { name: "h3" },
				module: "HTML"
			},
			{
				concept: { name: "h4" },
				module: "HTML"
			},
			{
				concept: { name: "h5" },
				module: "HTML"
			},
			{
				concept: { name: "h6" },
				module: "HTML"
			}
		],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: { "aria-level": "2" },
		superClass: [[
			"roletype",
			"structure",
			"sectionhead"
		]]
	};
} }), Os = d({ "../../node_modules/aria-query/lib/etc/roles/literal/imgRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !0,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [
			{
				concept: {
					attributes: [{
						constraints: ["set"],
						name: "alt"
					}],
					name: "img"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						constraints: ["undefined"],
						name: "alt"
					}],
					name: "img"
				},
				module: "HTML"
			},
			{
				concept: { name: "imggroup" },
				module: "DTB"
			}
		],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), ks = d({ "../../node_modules/aria-query/lib/etc/roles/literal/insertionRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["prohibited"],
		prohibitedProps: ["aria-label", "aria-labelledby"],
		props: {},
		relatedConcepts: [{
			concept: { name: "ins" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), As = d({ "../../node_modules/aria-query/lib/etc/roles/literal/linkRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-expanded": null,
			"aria-haspopup": null
		},
		relatedConcepts: [{
			concept: {
				attributes: [{
					constraints: ["set"],
					name: "href"
				}],
				name: "a"
			},
			module: "HTML"
		}, {
			concept: {
				attributes: [{
					constraints: ["set"],
					name: "href"
				}],
				name: "area"
			},
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"widget",
			"command"
		]]
	};
} }), js = d({ "../../node_modules/aria-query/lib/etc/roles/literal/listRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [
			{
				concept: { name: "menu" },
				module: "HTML"
			},
			{
				concept: { name: "ol" },
				module: "HTML"
			},
			{
				concept: { name: "ul" },
				module: "HTML"
			}
		],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [["listitem"]],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), Ms = d({ "../../node_modules/aria-query/lib/etc/roles/literal/listboxRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-invalid": null,
			"aria-multiselectable": null,
			"aria-readonly": null,
			"aria-required": null,
			"aria-orientation": "vertical"
		},
		relatedConcepts: [
			{
				concept: {
					attributes: [{
						constraints: [">1"],
						name: "size"
					}],
					constraints: ["the size attribute value is greater than 1"],
					name: "select"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{ name: "multiple" }],
					name: "select"
				},
				module: "HTML"
			},
			{
				concept: { name: "datalist" },
				module: "HTML"
			},
			{
				concept: { name: "list" },
				module: "ARIA"
			},
			{
				concept: { name: "select" },
				module: "XForms"
			}
		],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [["option", "group"], ["option"]],
		requiredProps: {},
		superClass: [[
			"roletype",
			"widget",
			"composite",
			"select"
		], [
			"roletype",
			"structure",
			"section",
			"group",
			"select"
		]]
	};
} }), Ns = d({ "../../node_modules/aria-query/lib/etc/roles/literal/listitemRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-level": null,
			"aria-posinset": null,
			"aria-setsize": null
		},
		relatedConcepts: [{
			concept: {
				constraints: [
					"direct descendant of ol",
					"direct descendant of ul",
					"direct descendant of menu"
				],
				name: "li"
			},
			module: "HTML"
		}, {
			concept: { name: "item" },
			module: "XForms"
		}],
		requireContextRole: ["directory", "list"],
		requiredContextRole: ["directory", "list"],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), Ps = d({ "../../node_modules/aria-query/lib/etc/roles/literal/logRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: { "aria-live": "polite" },
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), Fs = d({ "../../node_modules/aria-query/lib/etc/roles/literal/mainRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [{
			concept: { name: "main" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), Is = d({ "../../node_modules/aria-query/lib/etc/roles/literal/markRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["prohibited"],
		prohibitedProps: [],
		props: {
			"aria-braillelabel": null,
			"aria-brailleroledescription": null,
			"aria-description": null
		},
		relatedConcepts: [{
			concept: { name: "mark" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), Ls = d({ "../../node_modules/aria-query/lib/etc/roles/literal/marqueeRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), Rs = d({ "../../node_modules/aria-query/lib/etc/roles/literal/mathRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [{
			concept: { name: "math" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), zs = d({ "../../node_modules/aria-query/lib/etc/roles/literal/menuRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: { "aria-orientation": "vertical" },
		relatedConcepts: [
			{
				concept: { name: "MENU" },
				module: "JAPI"
			},
			{
				concept: { name: "list" },
				module: "ARIA"
			},
			{
				concept: { name: "select" },
				module: "XForms"
			},
			{
				concept: { name: "sidebar" },
				module: "DTB"
			}
		],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [
			["menuitem", "group"],
			["menuitemradio", "group"],
			["menuitemcheckbox", "group"],
			["menuitem"],
			["menuitemcheckbox"],
			["menuitemradio"]
		],
		requiredProps: {},
		superClass: [[
			"roletype",
			"widget",
			"composite",
			"select"
		], [
			"roletype",
			"structure",
			"section",
			"group",
			"select"
		]]
	};
} }), Bs = d({ "../../node_modules/aria-query/lib/etc/roles/literal/menubarRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: { "aria-orientation": "horizontal" },
		relatedConcepts: [{
			concept: { name: "toolbar" },
			module: "ARIA"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [
			["menuitem", "group"],
			["menuitemradio", "group"],
			["menuitemcheckbox", "group"],
			["menuitem"],
			["menuitemcheckbox"],
			["menuitemradio"]
		],
		requiredProps: {},
		superClass: [[
			"roletype",
			"widget",
			"composite",
			"select",
			"menu"
		], [
			"roletype",
			"structure",
			"section",
			"group",
			"select",
			"menu"
		]]
	};
} }), Vs = d({ "../../node_modules/aria-query/lib/etc/roles/literal/menuitemRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-posinset": null,
			"aria-setsize": null
		},
		relatedConcepts: [
			{
				concept: { name: "MENU_ITEM" },
				module: "JAPI"
			},
			{
				concept: { name: "listitem" },
				module: "ARIA"
			},
			{
				concept: { name: "option" },
				module: "ARIA"
			}
		],
		requireContextRole: [
			"group",
			"menu",
			"menubar"
		],
		requiredContextRole: [
			"group",
			"menu",
			"menubar"
		],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"widget",
			"command"
		]]
	};
} }), Hs = d({ "../../node_modules/aria-query/lib/etc/roles/literal/menuitemcheckboxRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !0,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [{
			concept: { name: "menuitem" },
			module: "ARIA"
		}],
		requireContextRole: [
			"group",
			"menu",
			"menubar"
		],
		requiredContextRole: [
			"group",
			"menu",
			"menubar"
		],
		requiredOwnedElements: [],
		requiredProps: { "aria-checked": null },
		superClass: [[
			"roletype",
			"widget",
			"input",
			"checkbox"
		], [
			"roletype",
			"widget",
			"command",
			"menuitem"
		]]
	};
} }), Us = d({ "../../node_modules/aria-query/lib/etc/roles/literal/menuitemradioRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !0,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [{
			concept: { name: "menuitem" },
			module: "ARIA"
		}],
		requireContextRole: [
			"group",
			"menu",
			"menubar"
		],
		requiredContextRole: [
			"group",
			"menu",
			"menubar"
		],
		requiredOwnedElements: [],
		requiredProps: { "aria-checked": null },
		superClass: [
			[
				"roletype",
				"widget",
				"input",
				"checkbox",
				"menuitemcheckbox"
			],
			[
				"roletype",
				"widget",
				"command",
				"menuitem",
				"menuitemcheckbox"
			],
			[
				"roletype",
				"widget",
				"input",
				"radio"
			]
		]
	};
} }), Ws = d({ "../../node_modules/aria-query/lib/etc/roles/literal/meterRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !0,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-valuetext": null,
			"aria-valuemax": "100",
			"aria-valuemin": "0"
		},
		relatedConcepts: [{
			concept: { name: "meter" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: { "aria-valuenow": null },
		superClass: [[
			"roletype",
			"structure",
			"range"
		]]
	};
} }), Gs = d({ "../../node_modules/aria-query/lib/etc/roles/literal/navigationRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [{
			concept: { name: "nav" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), Ks = d({ "../../node_modules/aria-query/lib/etc/roles/literal/noneRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: [],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: []
	};
} }), qs = d({ "../../node_modules/aria-query/lib/etc/roles/literal/noteRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), Js = d({ "../../node_modules/aria-query/lib/etc/roles/literal/optionRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !0,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {
			"aria-checked": null,
			"aria-posinset": null,
			"aria-setsize": null,
			"aria-selected": "false"
		},
		relatedConcepts: [
			{
				concept: { name: "item" },
				module: "XForms"
			},
			{
				concept: { name: "listitem" },
				module: "ARIA"
			},
			{
				concept: { name: "option" },
				module: "HTML"
			}
		],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: { "aria-selected": "false" },
		superClass: [[
			"roletype",
			"widget",
			"input"
		]]
	};
} }), Ys = d({ "../../node_modules/aria-query/lib/etc/roles/literal/paragraphRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["prohibited"],
		prohibitedProps: ["aria-label", "aria-labelledby"],
		props: {},
		relatedConcepts: [{
			concept: { name: "p" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), Xs = d({ "../../node_modules/aria-query/lib/etc/roles/literal/presentationRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["prohibited"],
		prohibitedProps: ["aria-label", "aria-labelledby"],
		props: {},
		relatedConcepts: [{
			concept: {
				attributes: [{
					name: "alt",
					value: ""
				}],
				name: "img"
			},
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [["roletype", "structure"]]
	};
} }), Zs = d({ "../../node_modules/aria-query/lib/etc/roles/literal/progressbarRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !0,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: { "aria-valuetext": null },
		relatedConcepts: [{
			concept: { name: "progress" },
			module: "HTML"
		}, {
			concept: { name: "status" },
			module: "ARIA"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"range"
		], ["roletype", "widget"]]
	};
} }), Qs = d({ "../../node_modules/aria-query/lib/etc/roles/literal/radioRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !0,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {
			"aria-checked": null,
			"aria-posinset": null,
			"aria-setsize": null
		},
		relatedConcepts: [{
			concept: {
				attributes: [{
					name: "type",
					value: "radio"
				}],
				name: "input"
			},
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: { "aria-checked": null },
		superClass: [[
			"roletype",
			"widget",
			"input"
		]]
	};
} }), $s = d({ "../../node_modules/aria-query/lib/etc/roles/literal/radiogroupRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-errormessage": null,
			"aria-invalid": null,
			"aria-readonly": null,
			"aria-required": null
		},
		relatedConcepts: [{
			concept: { name: "list" },
			module: "ARIA"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [["radio"]],
		requiredProps: {},
		superClass: [[
			"roletype",
			"widget",
			"composite",
			"select"
		], [
			"roletype",
			"structure",
			"section",
			"group",
			"select"
		]]
	};
} }), ec = d({ "../../node_modules/aria-query/lib/etc/roles/literal/regionRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [
			{
				concept: {
					attributes: [{
						constraints: ["set"],
						name: "aria-label"
					}],
					name: "section"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						constraints: ["set"],
						name: "aria-labelledby"
					}],
					name: "section"
				},
				module: "HTML"
			},
			{ concept: { name: "Device Independence Glossart perceivable unit" } }
		],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), tc = d({ "../../node_modules/aria-query/lib/etc/roles/literal/rowRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {
			"aria-colindex": null,
			"aria-expanded": null,
			"aria-level": null,
			"aria-posinset": null,
			"aria-rowindex": null,
			"aria-selected": null,
			"aria-setsize": null
		},
		relatedConcepts: [{
			concept: { name: "tr" },
			module: "HTML"
		}],
		requireContextRole: [
			"grid",
			"rowgroup",
			"table",
			"treegrid"
		],
		requiredContextRole: [
			"grid",
			"rowgroup",
			"table",
			"treegrid"
		],
		requiredOwnedElements: [
			["cell"],
			["columnheader"],
			["gridcell"],
			["rowheader"]
		],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"group"
		], ["roletype", "widget"]]
	};
} }), nc = d({ "../../node_modules/aria-query/lib/etc/roles/literal/rowgroupRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [
			{
				concept: { name: "tbody" },
				module: "HTML"
			},
			{
				concept: { name: "tfoot" },
				module: "HTML"
			},
			{
				concept: { name: "thead" },
				module: "HTML"
			}
		],
		requireContextRole: [
			"grid",
			"table",
			"treegrid"
		],
		requiredContextRole: [
			"grid",
			"table",
			"treegrid"
		],
		requiredOwnedElements: [["row"]],
		requiredProps: {},
		superClass: [["roletype", "structure"]]
	};
} }), rc = d({ "../../node_modules/aria-query/lib/etc/roles/literal/rowheaderRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: { "aria-sort": null },
		relatedConcepts: [{
			concept: {
				attributes: [{
					name: "scope",
					value: "row"
				}],
				name: "th"
			},
			module: "HTML"
		}, {
			concept: {
				attributes: [{
					name: "scope",
					value: "rowgroup"
				}],
				name: "th"
			},
			module: "HTML"
		}],
		requireContextRole: ["row", "rowgroup"],
		requiredContextRole: ["row", "rowgroup"],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [
			[
				"roletype",
				"structure",
				"section",
				"cell"
			],
			[
				"roletype",
				"structure",
				"section",
				"cell",
				"gridcell"
			],
			[
				"roletype",
				"widget",
				"gridcell"
			],
			[
				"roletype",
				"structure",
				"sectionhead"
			]
		]
	};
} }), ic = d({ "../../node_modules/aria-query/lib/etc/roles/literal/scrollbarRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !0,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-valuetext": null,
			"aria-orientation": "vertical",
			"aria-valuemax": "100",
			"aria-valuemin": "0"
		},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {
			"aria-controls": null,
			"aria-valuenow": null
		},
		superClass: [[
			"roletype",
			"structure",
			"range"
		], ["roletype", "widget"]]
	};
} }), ac = d({ "../../node_modules/aria-query/lib/etc/roles/literal/searchRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), oc = d({ "../../node_modules/aria-query/lib/etc/roles/literal/searchboxRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [{
			concept: {
				attributes: [{
					constraints: ["undefined"],
					name: "list"
				}, {
					name: "type",
					value: "search"
				}],
				constraints: ["the list attribute is not set"],
				name: "input"
			},
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"widget",
			"input",
			"textbox"
		]]
	};
} }), sc = d({ "../../node_modules/aria-query/lib/etc/roles/literal/separatorRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !0,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-orientation": "horizontal",
			"aria-valuemax": "100",
			"aria-valuemin": "0",
			"aria-valuenow": null,
			"aria-valuetext": null
		},
		relatedConcepts: [{
			concept: { name: "hr" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [["roletype", "structure"]]
	};
} }), cc = d({ "../../node_modules/aria-query/lib/etc/roles/literal/sliderRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !0,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-errormessage": null,
			"aria-haspopup": null,
			"aria-invalid": null,
			"aria-readonly": null,
			"aria-valuetext": null,
			"aria-orientation": "horizontal",
			"aria-valuemax": "100",
			"aria-valuemin": "0"
		},
		relatedConcepts: [{
			concept: {
				attributes: [{
					name: "type",
					value: "range"
				}],
				name: "input"
			},
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: { "aria-valuenow": null },
		superClass: [[
			"roletype",
			"widget",
			"input"
		], [
			"roletype",
			"structure",
			"range"
		]]
	};
} }), lc = d({ "../../node_modules/aria-query/lib/etc/roles/literal/spinbuttonRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-errormessage": null,
			"aria-invalid": null,
			"aria-readonly": null,
			"aria-required": null,
			"aria-valuetext": null,
			"aria-valuenow": "0"
		},
		relatedConcepts: [{
			concept: {
				attributes: [{
					name: "type",
					value: "number"
				}],
				name: "input"
			},
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [
			[
				"roletype",
				"widget",
				"composite"
			],
			[
				"roletype",
				"widget",
				"input"
			],
			[
				"roletype",
				"structure",
				"range"
			]
		]
	};
} }), uc = d({ "../../node_modules/aria-query/lib/etc/roles/literal/statusRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-atomic": "true",
			"aria-live": "polite"
		},
		relatedConcepts: [{
			concept: { name: "output" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), dc = d({ "../../node_modules/aria-query/lib/etc/roles/literal/strongRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["prohibited"],
		prohibitedProps: ["aria-label", "aria-labelledby"],
		props: {},
		relatedConcepts: [{
			concept: { name: "strong" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), fc = d({ "../../node_modules/aria-query/lib/etc/roles/literal/subscriptRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["prohibited"],
		prohibitedProps: ["aria-label", "aria-labelledby"],
		props: {},
		relatedConcepts: [{
			concept: { name: "sub" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), pc = d({ "../../node_modules/aria-query/lib/etc/roles/literal/superscriptRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["prohibited"],
		prohibitedProps: ["aria-label", "aria-labelledby"],
		props: {},
		relatedConcepts: [{
			concept: { name: "sup" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), mc = d({ "../../node_modules/aria-query/lib/etc/roles/literal/switchRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !0,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [{
			concept: { name: "button" },
			module: "ARIA"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: { "aria-checked": null },
		superClass: [[
			"roletype",
			"widget",
			"input",
			"checkbox"
		]]
	};
} }), hc = d({ "../../node_modules/aria-query/lib/etc/roles/literal/tabRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !0,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-posinset": null,
			"aria-setsize": null,
			"aria-selected": "false"
		},
		relatedConcepts: [],
		requireContextRole: ["tablist"],
		requiredContextRole: ["tablist"],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"sectionhead"
		], ["roletype", "widget"]]
	};
} }), gc = d({ "../../node_modules/aria-query/lib/etc/roles/literal/tableRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-colcount": null,
			"aria-rowcount": null
		},
		relatedConcepts: [{
			concept: { name: "table" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [["row"], ["row", "rowgroup"]],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), _c = d({ "../../node_modules/aria-query/lib/etc/roles/literal/tablistRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-level": null,
			"aria-multiselectable": null,
			"aria-orientation": "horizontal"
		},
		relatedConcepts: [{
			module: "DAISY",
			concept: { name: "guide" }
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [["tab"]],
		requiredProps: {},
		superClass: [[
			"roletype",
			"widget",
			"composite"
		]]
	};
} }), vc = d({ "../../node_modules/aria-query/lib/etc/roles/literal/tabpanelRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), yc = d({ "../../node_modules/aria-query/lib/etc/roles/literal/termRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [{
			concept: { name: "dfn" },
			module: "HTML"
		}, {
			concept: { name: "dt" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), bc = d({ "../../node_modules/aria-query/lib/etc/roles/literal/textboxRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-activedescendant": null,
			"aria-autocomplete": null,
			"aria-errormessage": null,
			"aria-haspopup": null,
			"aria-invalid": null,
			"aria-multiline": null,
			"aria-placeholder": null,
			"aria-readonly": null,
			"aria-required": null
		},
		relatedConcepts: [
			{
				concept: {
					attributes: [{
						constraints: ["undefined"],
						name: "type"
					}, {
						constraints: ["undefined"],
						name: "list"
					}],
					constraints: ["the list attribute is not set"],
					name: "input"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						constraints: ["undefined"],
						name: "list"
					}, {
						name: "type",
						value: "email"
					}],
					constraints: ["the list attribute is not set"],
					name: "input"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						constraints: ["undefined"],
						name: "list"
					}, {
						name: "type",
						value: "tel"
					}],
					constraints: ["the list attribute is not set"],
					name: "input"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						constraints: ["undefined"],
						name: "list"
					}, {
						name: "type",
						value: "text"
					}],
					constraints: ["the list attribute is not set"],
					name: "input"
				},
				module: "HTML"
			},
			{
				concept: {
					attributes: [{
						constraints: ["undefined"],
						name: "list"
					}, {
						name: "type",
						value: "url"
					}],
					constraints: ["the list attribute is not set"],
					name: "input"
				},
				module: "HTML"
			},
			{
				concept: { name: "input" },
				module: "XForms"
			},
			{
				concept: { name: "textarea" },
				module: "HTML"
			}
		],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"widget",
			"input"
		]]
	};
} }), xc = d({ "../../node_modules/aria-query/lib/etc/roles/literal/timeRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [{
			concept: { name: "time" },
			module: "HTML"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), Sc = d({ "../../node_modules/aria-query/lib/etc/roles/literal/timerRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"status"
		]]
	};
} }), Cc = d({ "../../node_modules/aria-query/lib/etc/roles/literal/toolbarRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: { "aria-orientation": "horizontal" },
		relatedConcepts: [{
			concept: { name: "menubar" },
			module: "ARIA"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"group"
		]]
	};
} }), wc = d({ "../../node_modules/aria-query/lib/etc/roles/literal/tooltipRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), Tc = d({ "../../node_modules/aria-query/lib/etc/roles/literal/treeRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-errormessage": null,
			"aria-invalid": null,
			"aria-multiselectable": null,
			"aria-required": null,
			"aria-orientation": "vertical"
		},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [["treeitem", "group"], ["treeitem"]],
		requiredProps: {},
		superClass: [[
			"roletype",
			"widget",
			"composite",
			"select"
		], [
			"roletype",
			"structure",
			"section",
			"group",
			"select"
		]]
	};
} }), Ec = d({ "../../node_modules/aria-query/lib/etc/roles/literal/treegridRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [["row"], ["row", "rowgroup"]],
		requiredProps: {},
		superClass: [
			[
				"roletype",
				"widget",
				"composite",
				"grid"
			],
			[
				"roletype",
				"structure",
				"section",
				"table",
				"grid"
			],
			[
				"roletype",
				"widget",
				"composite",
				"select",
				"tree"
			],
			[
				"roletype",
				"structure",
				"section",
				"group",
				"select",
				"tree"
			]
		]
	};
} }), Dc = d({ "../../node_modules/aria-query/lib/etc/roles/literal/treeitemRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {
			"aria-expanded": null,
			"aria-haspopup": null
		},
		relatedConcepts: [],
		requireContextRole: ["group", "tree"],
		requiredContextRole: ["group", "tree"],
		requiredOwnedElements: [],
		requiredProps: { "aria-selected": null },
		superClass: [[
			"roletype",
			"structure",
			"section",
			"listitem"
		], [
			"roletype",
			"widget",
			"input",
			"option"
		]]
	};
} }), Oc = d({ "../../node_modules/aria-query/lib/etc/roles/ariaLiteralRoles.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0;
	var t = k($o()), n = k(es()), r = k(ts()), i = k(ns()), a = k(rs()), o = k(is()), s = k(as()), c = k(os()), l = k(ss()), u = k(cs()), d = k(ls()), f = k(us()), p = k(ds()), m = k(fs()), h = k(ps()), g = k(ms()), _ = k(hs()), v = k(gs()), y = k(_s()), b = k(vs()), x = k(ys()), S = k(bs()), ee = k(xs()), C = k(Ss()), w = k(Cs()), te = k(ws()), T = k(Ts()), ne = k(Es()), re = k(Ds()), ie = k(Os()), ae = k(ks()), E = k(As()), oe = k(js()), D = k(Ms()), se = k(Ns()), ce = k(Ps()), le = k(Fs()), ue = k(Is()), de = k(Ls()), fe = k(Rs()), pe = k(zs()), O = k(Bs()), me = k(Vs()), he = k(Hs()), ge = k(Us()), _e = k(Ws()), ve = k(Gs()), ye = k(Ks()), be = k(qs()), xe = k(Js()), Se = k(Ys()), Ce = k(Xs()), we = k(Zs()), Te = k(Qs()), Ee = k($s()), De = k(ec()), Oe = k(tc()), ke = k(nc()), Ae = k(rc()), je = k(ic()), Me = k(ac()), Ne = k(oc()), Pe = k(sc()), Fe = k(cc()), Ie = k(lc()), Le = k(uc()), Re = k(dc()), ze = k(fc()), Be = k(pc()), Ve = k(mc()), He = k(hc()), Ue = k(gc()), We = k(_c()), Ge = k(vc()), Ke = k(yc()), qe = k(bc()), Je = k(xc()), Ye = k(Sc()), Xe = k(Cc()), Ze = k(wc()), Qe = k(Tc()), $e = k(Ec()), et = k(Dc());
	function k(e) {
		return e && e.__esModule ? e : { default: e };
	}
	e.default = [
		["alert", t.default],
		["alertdialog", n.default],
		["application", r.default],
		["article", i.default],
		["banner", a.default],
		["blockquote", o.default],
		["button", s.default],
		["caption", c.default],
		["cell", l.default],
		["checkbox", u.default],
		["code", d.default],
		["columnheader", f.default],
		["combobox", p.default],
		["complementary", m.default],
		["contentinfo", h.default],
		["definition", g.default],
		["deletion", _.default],
		["dialog", v.default],
		["directory", y.default],
		["document", b.default],
		["emphasis", x.default],
		["feed", S.default],
		["figure", ee.default],
		["form", C.default],
		["generic", w.default],
		["grid", te.default],
		["gridcell", T.default],
		["group", ne.default],
		["heading", re.default],
		["img", ie.default],
		["insertion", ae.default],
		["link", E.default],
		["list", oe.default],
		["listbox", D.default],
		["listitem", se.default],
		["log", ce.default],
		["main", le.default],
		["mark", ue.default],
		["marquee", de.default],
		["math", fe.default],
		["menu", pe.default],
		["menubar", O.default],
		["menuitem", me.default],
		["menuitemcheckbox", he.default],
		["menuitemradio", ge.default],
		["meter", _e.default],
		["navigation", ve.default],
		["none", ye.default],
		["note", be.default],
		["option", xe.default],
		["paragraph", Se.default],
		["presentation", Ce.default],
		["progressbar", we.default],
		["radio", Te.default],
		["radiogroup", Ee.default],
		["region", De.default],
		["row", Oe.default],
		["rowgroup", ke.default],
		["rowheader", Ae.default],
		["scrollbar", je.default],
		["search", Me.default],
		["searchbox", Ne.default],
		["separator", Pe.default],
		["slider", Fe.default],
		["spinbutton", Ie.default],
		["status", Le.default],
		["strong", Re.default],
		["subscript", ze.default],
		["superscript", Be.default],
		["switch", Ve.default],
		["tab", He.default],
		["table", Ue.default],
		["tablist", We.default],
		["tabpanel", Ge.default],
		["term", Ke.default],
		["textbox", qe.default],
		["time", Je.default],
		["timer", Ye.default],
		["toolbar", Xe.default],
		["tooltip", Ze.default],
		["tree", Qe.default],
		["treegrid", $e.default],
		["treeitem", et.default]
	];
} }), kc = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docAbstractRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "abstract [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), Ac = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docAcknowledgmentsRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "acknowledgments [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), jc = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docAfterwordRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "afterword [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), Mc = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docAppendixRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "appendix [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), Nc = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docBacklinkRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {
			"aria-errormessage": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "referrer [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"widget",
			"command",
			"link"
		]]
	};
} }), Pc = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docBiblioentryRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "EPUB biblioentry [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: ["doc-bibliography"],
		requiredContextRole: ["doc-bibliography"],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"listitem"
		]]
	};
} }), Fc = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docBibliographyRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "bibliography [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [["doc-biblioentry"]],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), Ic = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docBibliorefRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {
			"aria-errormessage": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "biblioref [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"widget",
			"command",
			"link"
		]]
	};
} }), Lc = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docChapterRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "chapter [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), Rc = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docColophonRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "colophon [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), zc = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docConclusionRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "conclusion [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), Bc = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docCoverRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "cover [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"img"
		]]
	};
} }), Vc = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docCreditRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "credit [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), Hc = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docCreditsRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "credits [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), Uc = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docDedicationRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "dedication [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), Wc = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docEndnoteRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "rearnote [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: ["doc-endnotes"],
		requiredContextRole: ["doc-endnotes"],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"listitem"
		]]
	};
} }), Gc = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docEndnotesRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "rearnotes [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [["doc-endnote"]],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), Kc = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docEpigraphRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "epigraph [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), qc = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docEpilogueRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "epilogue [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), Jc = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docErrataRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "errata [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), Yc = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docExampleRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), Xc = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docFootnoteRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "footnote [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), Zc = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docForewordRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "foreword [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), Qc = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docGlossaryRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "glossary [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [["definition"], ["term"]],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), $c = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docGlossrefRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {
			"aria-errormessage": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "glossref [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"widget",
			"command",
			"link"
		]]
	};
} }), el = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docIndexRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "index [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark",
			"navigation"
		]]
	};
} }), tl = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docIntroductionRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "introduction [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), nl = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docNoterefRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {
			"aria-errormessage": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "noteref [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"widget",
			"command",
			"link"
		]]
	};
} }), rl = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docNoticeRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "notice [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"note"
		]]
	};
} }), il = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docPagebreakRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !0,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "pagebreak [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"separator"
		]]
	};
} }), al = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docPagefooterRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["prohibited"],
		prohibitedProps: [],
		props: {
			"aria-braillelabel": null,
			"aria-brailleroledescription": null,
			"aria-description": null,
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), ol = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docPageheaderRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["prohibited"],
		prohibitedProps: [],
		props: {
			"aria-braillelabel": null,
			"aria-brailleroledescription": null,
			"aria-description": null,
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), sl = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docPagelistRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "page-list [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark",
			"navigation"
		]]
	};
} }), cl = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docPartRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "part [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), ll = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docPrefaceRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "preface [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), ul = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docPrologueRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "prologue [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark"
		]]
	};
} }), dl = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docPullquoteRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {},
		relatedConcepts: [{
			concept: { name: "pullquote [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [["none"]]
	};
} }), fl = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docQnaRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "qna [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section"
		]]
	};
} }), pl = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docSubtitleRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "subtitle [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"sectionhead"
		]]
	};
} }), ml = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docTipRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "help [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"note"
		]]
	};
} }), hl = d({ "../../node_modules/aria-query/lib/etc/roles/dpub/docTocRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [{
			concept: { name: "toc [EPUB-SSV]" },
			module: "EPUB"
		}],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"landmark",
			"navigation"
		]]
	};
} }), gl = d({ "../../node_modules/aria-query/lib/etc/roles/ariaDpubRoles.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0;
	var t = O(kc()), n = O(Ac()), r = O(jc()), i = O(Mc()), a = O(Nc()), o = O(Pc()), s = O(Fc()), c = O(Ic()), l = O(Lc()), u = O(Rc()), d = O(zc()), f = O(Bc()), p = O(Vc()), m = O(Hc()), h = O(Uc()), g = O(Wc()), _ = O(Gc()), v = O(Kc()), y = O(qc()), b = O(Jc()), x = O(Yc()), S = O(Xc()), ee = O(Zc()), C = O(Qc()), w = O($c()), te = O(el()), T = O(tl()), ne = O(nl()), re = O(rl()), ie = O(il()), ae = O(al()), E = O(ol()), oe = O(sl()), D = O(cl()), se = O(ll()), ce = O(ul()), le = O(dl()), ue = O(fl()), de = O(pl()), fe = O(ml()), pe = O(hl());
	function O(e) {
		return e && e.__esModule ? e : { default: e };
	}
	e.default = [
		["doc-abstract", t.default],
		["doc-acknowledgments", n.default],
		["doc-afterword", r.default],
		["doc-appendix", i.default],
		["doc-backlink", a.default],
		["doc-biblioentry", o.default],
		["doc-bibliography", s.default],
		["doc-biblioref", c.default],
		["doc-chapter", l.default],
		["doc-colophon", u.default],
		["doc-conclusion", d.default],
		["doc-cover", f.default],
		["doc-credit", p.default],
		["doc-credits", m.default],
		["doc-dedication", h.default],
		["doc-endnote", g.default],
		["doc-endnotes", _.default],
		["doc-epigraph", v.default],
		["doc-epilogue", y.default],
		["doc-errata", b.default],
		["doc-example", x.default],
		["doc-footnote", S.default],
		["doc-foreword", ee.default],
		["doc-glossary", C.default],
		["doc-glossref", w.default],
		["doc-index", te.default],
		["doc-introduction", T.default],
		["doc-noteref", ne.default],
		["doc-notice", re.default],
		["doc-pagebreak", ie.default],
		["doc-pagefooter", ae.default],
		["doc-pageheader", E.default],
		["doc-pagelist", oe.default],
		["doc-part", D.default],
		["doc-preface", se.default],
		["doc-prologue", ce.default],
		["doc-pullquote", le.default],
		["doc-qna", ue.default],
		["doc-subtitle", de.default],
		["doc-tip", fe.default],
		["doc-toc", pe.default]
	];
} }), _l = d({ "../../node_modules/aria-query/lib/etc/roles/graphics/graphicsDocumentRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [
			{
				module: "GRAPHICS",
				concept: { name: "graphics-object" }
			},
			{
				module: "ARIA",
				concept: { name: "img" }
			},
			{
				module: "ARIA",
				concept: { name: "article" }
			}
		],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"document"
		]]
	};
} }), vl = d({ "../../node_modules/aria-query/lib/etc/roles/graphics/graphicsObjectRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !1,
		baseConcepts: [],
		childrenPresentational: !1,
		nameFrom: ["author", "contents"],
		prohibitedProps: [],
		props: {
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [
			{
				module: "GRAPHICS",
				concept: { name: "graphics-document" }
			},
			{
				module: "ARIA",
				concept: { name: "group" }
			},
			{
				module: "ARIA",
				concept: { name: "img" }
			},
			{
				module: "GRAPHICS",
				concept: { name: "graphics-symbol" }
			}
		],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"group"
		]]
	};
} }), yl = d({ "../../node_modules/aria-query/lib/etc/roles/graphics/graphicsSymbolRole.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0, e.default = {
		abstract: !1,
		accessibleNameRequired: !0,
		baseConcepts: [],
		childrenPresentational: !0,
		nameFrom: ["author"],
		prohibitedProps: [],
		props: {
			"aria-disabled": null,
			"aria-errormessage": null,
			"aria-expanded": null,
			"aria-haspopup": null,
			"aria-invalid": null
		},
		relatedConcepts: [],
		requireContextRole: [],
		requiredContextRole: [],
		requiredOwnedElements: [],
		requiredProps: {},
		superClass: [[
			"roletype",
			"structure",
			"section",
			"img"
		]]
	};
} }), bl = d({ "../../node_modules/aria-query/lib/etc/roles/ariaGraphicsRoles.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0;
	var t = i(_l()), n = i(vl()), r = i(yl());
	function i(e) {
		return e && e.__esModule ? e : { default: e };
	}
	e.default = [
		["graphics-document", t.default],
		["graphics-object", n.default],
		["graphics-symbol", r.default]
	];
} }), xl = d({ "../../node_modules/aria-query/lib/rolesMap.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0;
	var t = o(Qo()), n = o(Oc()), r = o(gl()), i = o(bl()), a = o(Lo());
	function o(e) {
		return e && e.__esModule ? e : { default: e };
	}
	function s(e, t) {
		var n = typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
		if (!n) {
			if (Array.isArray(e) || (n = u(e)) || t && e && typeof e.length == "number") {
				n && (e = n);
				var r = 0, i = function() {};
				return {
					s: i,
					n: function() {
						return r >= e.length ? { done: !0 } : {
							done: !1,
							value: e[r++]
						};
					},
					e: function(e) {
						throw e;
					},
					f: i
				};
			}
			throw TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
		}
		var a, o = !0, s = !1;
		return {
			s: function() {
				n = n.call(e);
			},
			n: function() {
				var e = n.next();
				return o = e.done, e;
			},
			e: function(e) {
				s = !0, a = e;
			},
			f: function() {
				try {
					o || n.return == null || n.return();
				} finally {
					if (s) throw a;
				}
			}
		};
	}
	function c(e, t) {
		return p(e) || f(e, t) || u(e, t) || l();
	}
	function l() {
		throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
	}
	function u(e, t) {
		if (e) {
			if (typeof e == "string") return d(e, t);
			var n = {}.toString.call(e).slice(8, -1);
			return n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set" ? Array.from(e) : n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n) ? d(e, t) : void 0;
		}
	}
	function d(e, t) {
		(t == null || t > e.length) && (t = e.length);
		for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
		return r;
	}
	function f(e, t) {
		var n = e == null ? null : typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
		if (n != null) {
			var r, i, a, o, s = [], c = !0, l = !1;
			try {
				if (a = (n = n.call(e)).next, t === 0) {
					if (Object(n) !== n) return;
					c = !1;
				} else for (; !(c = (r = a.call(n)).done) && (s.push(r.value), s.length !== t); c = !0);
			} catch (e) {
				l = !0, i = e;
			} finally {
				try {
					if (!c && n.return != null && (o = n.return(), Object(o) !== o)) return;
				} finally {
					if (l) throw i;
				}
			}
			return s;
		}
	}
	function p(e) {
		if (Array.isArray(e)) return e;
	}
	var m = [].concat(t.default, n.default, r.default, i.default);
	m.forEach(function(e) {
		var t = c(e, 2)[1], n = s(t.superClass), r;
		try {
			for (n.s(); !(r = n.n()).done;) {
				var i = r.value, a = s(i), o;
				try {
					var l = function() {
						var e = o.value, n = m.filter(function(t) {
							return c(t, 1)[0] === e;
						})[0];
						if (n) for (var r = n[1], i = 0, a = Object.keys(r.props); i < a.length; i++) {
							var s = a[i];
							Object.prototype.hasOwnProperty.call(t.props, s) || (t.props[s] = r.props[s]);
						}
					};
					for (a.s(); !(o = a.n()).done;) l();
				} catch (e) {
					a.e(e);
				} finally {
					a.f();
				}
			}
		} catch (e) {
			n.e(e);
		} finally {
			n.f();
		}
	});
	var h = {
		entries: function() {
			return m;
		},
		forEach: function(e) {
			var t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null, n = s(m), r;
			try {
				for (n.s(); !(r = n.n()).done;) {
					var i = c(r.value, 2), a = i[0], o = i[1];
					e.call(t, o, a, m);
				}
			} catch (e) {
				n.e(e);
			} finally {
				n.f();
			}
		},
		get: function(e) {
			var t = m.filter(function(t) {
				return t[0] === e;
			})[0];
			return t && t[1];
		},
		has: function(e) {
			return !!h.get(e);
		},
		keys: function() {
			return m.map(function(e) {
				return c(e, 1)[0];
			});
		},
		values: function() {
			return m.map(function(e) {
				return c(e, 2)[1];
			});
		}
	};
	e.default = (0, a.default)(h, h.entries());
} }), Sl = d({ "../../node_modules/aria-query/lib/elementRoleMap.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0;
	var t = r(Lo()), n = r(xl());
	function r(e) {
		return e && e.__esModule ? e : { default: e };
	}
	function i(e, t) {
		return l(e) || c(e, t) || o(e, t) || a();
	}
	function a() {
		throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
	}
	function o(e, t) {
		if (e) {
			if (typeof e == "string") return s(e, t);
			var n = {}.toString.call(e).slice(8, -1);
			return n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set" ? Array.from(e) : n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n) ? s(e, t) : void 0;
		}
	}
	function s(e, t) {
		(t == null || t > e.length) && (t = e.length);
		for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
		return r;
	}
	function c(e, t) {
		var n = e == null ? null : typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
		if (n != null) {
			var r, i, a, o, s = [], c = !0, l = !1;
			try {
				if (a = (n = n.call(e)).next, t === 0) {
					if (Object(n) !== n) return;
					c = !1;
				} else for (; !(c = (r = a.call(n)).done) && (s.push(r.value), s.length !== t); c = !0);
			} catch (e) {
				l = !0, i = e;
			} finally {
				try {
					if (!c && n.return != null && (o = n.return(), Object(o) !== o)) return;
				} finally {
					if (l) throw i;
				}
			}
			return s;
		}
	}
	function l(e) {
		if (Array.isArray(e)) return e;
	}
	var u = [], d = n.default.keys();
	for (_ = 0; _ < d.length; _++) if (f = d[_], p = n.default.get(f), p) for (m = [].concat(p.baseConcepts, p.relatedConcepts), h = function() {
		var e = m[g];
		if (e.module === "HTML") {
			var t = e.concept;
			if (t) {
				for (var n = u.filter(function(e) {
					return y(e[0], t);
				})[0], r = n ? n[1] : [], i = !0, a = 0; a < r.length; a++) if (r[a] === f) {
					i = !1;
					break;
				}
				i && r.push(f), n || u.push([t, r]);
			}
		}
	}, g = 0; g < m.length; g++) h();
	var f, p, m, h, g, _, v = {
		entries: function() {
			return u;
		},
		forEach: function(e) {
			for (var t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null, n = 0, r = u; n < r.length; n++) {
				var a = i(r[n], 2), o = a[0], s = a[1];
				e.call(t, s, o, u);
			}
		},
		get: function(e) {
			var t = u.filter(function(t) {
				return e.name === t[0].name && x(e.attributes, t[0].attributes);
			})[0];
			return t && t[1];
		},
		has: function(e) {
			return !!v.get(e);
		},
		keys: function() {
			return u.map(function(e) {
				return i(e, 1)[0];
			});
		},
		values: function() {
			return u.map(function(e) {
				return i(e, 2)[1];
			});
		}
	};
	function y(e, t) {
		return e.name === t.name && b(e.constraints, t.constraints) && x(e.attributes, t.attributes);
	}
	function b(e, t) {
		if (e === void 0 && t !== void 0 || e !== void 0 && t === void 0) return !1;
		if (e !== void 0 && t !== void 0) {
			if (e.length !== t.length) return !1;
			for (var n = 0; n < e.length; n++) if (e[n] !== t[n]) return !1;
		}
		return !0;
	}
	function x(e, t) {
		if (e === void 0 && t !== void 0 || e !== void 0 && t === void 0) return !1;
		if (e !== void 0 && t !== void 0) {
			if (e.length !== t.length) return !1;
			for (var n = 0; n < e.length; n++) {
				if (e[n].name !== t[n].name || e[n].value !== t[n].value || e[n].constraints === void 0 && t[n].constraints !== void 0 || e[n].constraints !== void 0 && t[n].constraints === void 0) return !1;
				if (e[n].constraints !== void 0 && t[n].constraints !== void 0) {
					if (e[n].constraints.length !== t[n].constraints.length) return !1;
					for (var r = 0; r < e[n].constraints.length; r++) if (e[n].constraints[r] !== t[n].constraints[r]) return !1;
				}
			}
		}
		return !0;
	}
	e.default = (0, t.default)(v, v.entries());
} }), Cl = d({ "../../node_modules/aria-query/lib/roleElementMap.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0;
	var t = r(Lo()), n = r(xl());
	function r(e) {
		return e && e.__esModule ? e : { default: e };
	}
	function i(e, t) {
		return l(e) || c(e, t) || o(e, t) || a();
	}
	function a() {
		throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
	}
	function o(e, t) {
		if (e) {
			if (typeof e == "string") return s(e, t);
			var n = {}.toString.call(e).slice(8, -1);
			return n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set" ? Array.from(e) : n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n) ? s(e, t) : void 0;
		}
	}
	function s(e, t) {
		(t == null || t > e.length) && (t = e.length);
		for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
		return r;
	}
	function c(e, t) {
		var n = e == null ? null : typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
		if (n != null) {
			var r, i, a, o, s = [], c = !0, l = !1;
			try {
				if (a = (n = n.call(e)).next, t === 0) {
					if (Object(n) !== n) return;
					c = !1;
				} else for (; !(c = (r = a.call(n)).done) && (s.push(r.value), s.length !== t); c = !0);
			} catch (e) {
				l = !0, i = e;
			} finally {
				try {
					if (!c && n.return != null && (o = n.return(), Object(o) !== o)) return;
				} finally {
					if (l) throw i;
				}
			}
			return s;
		}
	}
	function l(e) {
		if (Array.isArray(e)) return e;
	}
	var u = [], d = n.default.keys();
	for (y = 0; y < d.length; y++) if (f = d[y], p = n.default.get(f), m = [], p) {
		for (h = [].concat(p.baseConcepts, p.relatedConcepts), v = 0; v < h.length; v++) g = h[v], g.module === "HTML" && (_ = g.concept, _ != null && m.push(_));
		m.length > 0 && u.push([f, m]);
	}
	var f, p, m, h, g, _, v, y, b = {
		entries: function() {
			return u;
		},
		forEach: function(e) {
			for (var t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null, n = 0, r = u; n < r.length; n++) {
				var a = i(r[n], 2), o = a[0], s = a[1];
				e.call(t, s, o, u);
			}
		},
		get: function(e) {
			var t = u.filter(function(t) {
				return t[0] === e;
			})[0];
			return t && t[1];
		},
		has: function(e) {
			return !!b.get(e);
		},
		keys: function() {
			return u.map(function(e) {
				return i(e, 1)[0];
			});
		},
		values: function() {
			return u.map(function(e) {
				return i(e, 2)[1];
			});
		}
	};
	e.default = (0, t.default)(b, b.entries());
} }), wl = d({ "../../node_modules/aria-query/lib/index.ts"(e) {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.roles = e.roleElements = e.elementRoles = e.dom = e.aria = void 0;
	var t = o(Ro()), n = o(zo()), r = o(xl()), i = o(Sl()), a = o(Cl());
	function o(e) {
		return e && e.__esModule ? e : { default: e };
	}
	e.aria = t.default, e.dom = n.default, e.roles = r.default, e.elementRoles = i.default, e.roleElements = a.default;
} }), Tl = d({ "../../node_modules/css.escape/css.escape.ts"(e, t) {
	(function(n, r) {
		typeof e == "object" ? t.exports = r(n) : typeof define == "function" && define.amd ? define([], r.bind(n, n)) : r(n);
	})(typeof globalThis < "u" ? globalThis : e, function(e) {
		if (e.CSS && e.CSS.escape) return e.CSS.escape;
		var t = function(e) {
			if (arguments.length == 0) throw TypeError("`CSS.escape` requires an argument.");
			for (var t = String(e), n = t.length, r = -1, i, a = "", o = t.charCodeAt(0); ++r < n;) i = t.charCodeAt(r), a += i == 0 ? "�" : i >= 1 && i <= 31 || i == 127 || r == 0 && i >= 48 && i <= 57 || r == 1 && i >= 48 && i <= 57 && o == 45 ? "\\" + i.toString(16) + " " : r == 0 && n == 1 && i == 45 ? "\\" + t.charAt(r) : i >= 128 || i == 45 || i == 95 || i >= 48 && i <= 57 || i >= 65 && i <= 90 || i >= 97 && i <= 122 ? t.charAt(r) : "\\" + t.charAt(r);
			return a;
		};
		return e.CSS ||= {}, e.CSS.escape = t, t;
	});
} }), El = Object.defineProperty, I = (e, t) => El(e, "name", {
	value: t,
	configurable: !0
}), Dl = (e, t) => {
	for (var n in t) El(e, n, {
		get: t[n],
		enumerable: !0
	});
}, Ol = {};
Dl(Ol, {
	addChainableMethod: () => Md,
	addLengthGuard: () => yd,
	addMethod: () => wd,
	addProperty: () => _d,
	checkError: () => kl,
	compareByInspect: () => Pd,
	eql: () => qu,
	expectTypes: () => Bl,
	flag: () => L,
	getActual: () => Vl,
	getMessage: () => Bu,
	getName: () => Bd,
	getOperator: () => zd,
	getOwnEnumerableProperties: () => Id,
	getOwnEnumerablePropertySymbols: () => Fd,
	getPathInfo: () => md,
	hasProperty: () => dd,
	inspect: () => B,
	isNaN: () => Ld,
	isNumeric: () => H,
	isProxyEnabled: () => gd,
	isRegExp: () => Vd,
	objDisplay: () => zu,
	overwriteChainableMethod: () => Nd,
	overwriteMethod: () => Ed,
	overwriteProperty: () => Td,
	proxify: () => Sd,
	test: () => Ll,
	transferFlags: () => Vu,
	type: () => R
});
var kl = {};
Dl(kl, {
	compatibleConstructor: () => Nl,
	compatibleInstance: () => Ml,
	compatibleMessage: () => Pl,
	getConstructorName: () => Fl,
	getMessage: () => Il
});
function Al(e) {
	return e instanceof Error || Object.prototype.toString.call(e) === "[object Error]";
}
I(Al, "isErrorInstance");
function jl(e) {
	return Object.prototype.toString.call(e) === "[object RegExp]";
}
I(jl, "isRegExp");
function Ml(e, t) {
	return Al(t) && e === t;
}
I(Ml, "compatibleInstance");
function Nl(e, t) {
	return Al(t) ? e.constructor === t.constructor || e instanceof t.constructor : (typeof t == "object" || typeof t == "function") && t.prototype ? e.constructor === t || e instanceof t : !1;
}
I(Nl, "compatibleConstructor");
function Pl(e, t) {
	let n = typeof e == "string" ? e : e.message;
	return jl(t) ? t.test(n) : typeof t == "string" && n.indexOf(t) !== -1;
}
I(Pl, "compatibleMessage");
function Fl(e) {
	let t = e;
	return Al(e) ? t = e.constructor.name : typeof e == "function" && (t = e.name, t === "" && (t = new e().name || t)), t;
}
I(Fl, "getConstructorName");
function Il(e) {
	let t = "";
	return e && e.message ? t = e.message : typeof e == "string" && (t = e), t;
}
I(Il, "getMessage");
function L(e, t, n) {
	let r = e.__flags ||= /* @__PURE__ */ Object.create(null);
	if (arguments.length === 3) r[t] = n;
	else return r[t];
}
I(L, "flag");
function Ll(e, t) {
	let n = L(e, "negate"), r = t[0];
	return n ? !r : r;
}
I(Ll, "test");
function R(e) {
	if (typeof e > "u") return "undefined";
	if (e === null) return "null";
	let t = e[Symbol.toStringTag];
	return typeof t == "string" ? t : Object.prototype.toString.call(e).slice(8, -1);
}
I(R, "type");
var Rl = "captureStackTrace" in Error, zl = class extends Error {
	message;
	get name() {
		return "AssertionError";
	}
	get ok() {
		return !1;
	}
	constructor(e = "Unspecified AssertionError", t, n) {
		super(e), this.message = e, Rl && Error.captureStackTrace(this, n || zl);
		for (let e in t) e in this || (this[e] = t[e]);
	}
	toJSON(e) {
		return {
			...this,
			name: this.name,
			message: this.message,
			ok: !1,
			stack: e === !1 ? void 0 : this.stack
		};
	}
}, z = (I(zl, "AssertionError"), zl);
function Bl(e, t) {
	let n = L(e, "message"), r = L(e, "ssfi");
	n = n ? n + ": " : "", e = L(e, "object"), t = t.map(function(e) {
		return e.toLowerCase();
	}), t.sort();
	let i = t.map(function(e, n) {
		let r = ~[
			"a",
			"e",
			"i",
			"o",
			"u"
		].indexOf(e.charAt(0)) ? "an" : "a";
		return (t.length > 1 && n === t.length - 1 ? "or " : "") + r + " " + e;
	}).join(", "), a = R(e).toLowerCase();
	if (!t.some(function(e) {
		return a === e;
	})) throw new z(n + "object tested must be " + i + ", but " + a + " given", void 0, r);
}
I(Bl, "expectTypes");
function Vl(e, t) {
	return t.length > 4 ? t[4] : e._obj;
}
I(Vl, "getActual");
var Hl = {
	bold: ["1", "22"],
	dim: ["2", "22"],
	italic: ["3", "23"],
	underline: ["4", "24"],
	inverse: ["7", "27"],
	hidden: ["8", "28"],
	strike: ["9", "29"],
	black: ["30", "39"],
	red: ["31", "39"],
	green: ["32", "39"],
	yellow: ["33", "39"],
	blue: ["34", "39"],
	magenta: ["35", "39"],
	cyan: ["36", "39"],
	white: ["37", "39"],
	brightblack: ["30;1", "39"],
	brightred: ["31;1", "39"],
	brightgreen: ["32;1", "39"],
	brightyellow: ["33;1", "39"],
	brightblue: ["34;1", "39"],
	brightmagenta: ["35;1", "39"],
	brightcyan: ["36;1", "39"],
	brightwhite: ["37;1", "39"],
	grey: ["90", "39"]
}, Ul = {
	special: "cyan",
	number: "yellow",
	bigint: "yellow",
	boolean: "yellow",
	undefined: "grey",
	null: "bold",
	string: "green",
	symbol: "green",
	date: "magenta",
	regexp: "red"
}, Wl = "…";
function Gl(e, t) {
	let n = Hl[Ul[t]] || Hl[t] || "";
	return n ? `\x1B[${n[0]}m${String(e)}\x1B[${n[1]}m` : String(e);
}
I(Gl, "colorise");
function Kl({ showHidden: e = !1, depth: t = 2, colors: n = !1, customInspect: r = !0, showProxy: i = !1, maxArrayLength: a = 1 / 0, breakLength: o = 1 / 0, seen: s = [], truncate: c = 1 / 0, stylize: l = String } = {}, u) {
	let d = {
		showHidden: !!e,
		depth: Number(t),
		colors: !!n,
		customInspect: !!r,
		showProxy: !!i,
		maxArrayLength: Number(a),
		breakLength: Number(o),
		truncate: Number(c),
		seen: s,
		inspect: u,
		stylize: l
	};
	return d.colors && (d.stylize = Gl), d;
}
I(Kl, "normaliseOptions");
function ql(e) {
	return e >= "\ud800" && e <= "\udbff";
}
I(ql, "isHighSurrogate");
function Jl(e, t, n = Wl) {
	e = String(e);
	let r = n.length, i = e.length;
	if (r > t && i > r) return n;
	if (i > t && i > r) {
		let i = t - r;
		return i > 0 && ql(e[i - 1]) && --i, `${e.slice(0, i)}${n}`;
	}
	return e;
}
I(Jl, "truncate");
function Yl(e, t, n, r = ", ") {
	n ||= t.inspect;
	let i = e.length;
	if (i === 0) return "";
	let a = t.truncate, o = "", s = "", c = "";
	for (let l = 0; l < i; l += 1) {
		let i = l + 1 === e.length, u = l + 2 === e.length;
		c = `${Wl}(${e.length - l})`;
		let d = e[l];
		t.truncate = a - o.length - (i ? 0 : r.length);
		let f = s || n(d, t) + (i ? "" : r), p = o.length + f.length, m = p + c.length;
		if (i && p > a && o.length + c.length <= a || !i && !u && m > a || (s = i ? "" : n(e[l + 1], t) + (u ? "" : r), !i && u && m > a && p + s.length > a)) break;
		if (o += f, !i && !u && p + s.length >= a) {
			c = `${Wl}(${e.length - l - 1})`;
			break;
		}
		c = "";
	}
	return `${o}${c}`;
}
I(Yl, "inspectList");
function Xl(e) {
	return e.match(/^[a-zA-Z_][a-zA-Z_0-9]*$/) ? e : JSON.stringify(e).replace(/'/g, "\\'").replace(/\\"/g, "\"").replace(/(^"|"$)/g, "'");
}
I(Xl, "quoteComplexKey");
function Zl([e, t], n) {
	return n.truncate -= 2, typeof e == "string" ? e = Xl(e) : typeof e != "number" && (e = `[${n.inspect(e, n)}]`), n.truncate -= e.length, t = n.inspect(t, n), `${e}: ${t}`;
}
I(Zl, "inspectProperty");
function Ql(e, t) {
	let n = Object.keys(e).slice(e.length);
	if (!e.length && !n.length) return "[]";
	t.truncate -= 4;
	let r = Yl(e, t);
	t.truncate -= r.length;
	let i = "";
	return n.length && (i = Yl(n.map((t) => [t, e[t]]), t, Zl)), `[ ${r}${i ? `, ${i}` : ""} ]`;
}
I(Ql, "inspectArray");
var $l = I((e) => typeof Buffer == "function" && e instanceof Buffer ? "Buffer" : e[Symbol.toStringTag] ? e[Symbol.toStringTag] : e.constructor.name, "getArrayName");
function eu(e, t) {
	let n = $l(e);
	t.truncate -= n.length + 4;
	let r = Object.keys(e).slice(e.length);
	if (!e.length && !r.length) return `${n}[]`;
	let i = "";
	for (let n = 0; n < e.length; n++) {
		let r = `${t.stylize(Jl(e[n], t.truncate), "number")}${n === e.length - 1 ? "" : ", "}`;
		if (t.truncate -= r.length, e[n] !== e.length && t.truncate <= 3) {
			i += `${Wl}(${e.length - e[n] + 1})`;
			break;
		}
		i += r;
	}
	let a = "";
	return r.length && (a = Yl(r.map((t) => [t, e[t]]), t, Zl)), `${n}[ ${i}${a ? `, ${a}` : ""} ]`;
}
I(eu, "inspectTypedArray");
function tu(e, t) {
	let n = e.toJSON();
	if (n === null) return "Invalid Date";
	let r = n.split("T"), i = r[0];
	return t.stylize(`${i}T${Jl(r[1], t.truncate - i.length - 1)}`, "date");
}
I(tu, "inspectDate");
function nu(e, t) {
	let n = e[Symbol.toStringTag] || "Function", r = e.name;
	return r ? t.stylize(`[${n} ${Jl(r, t.truncate - 11)}]`, "special") : t.stylize(`[${n}]`, "special");
}
I(nu, "inspectFunction");
function ru([e, t], n) {
	return n.truncate -= 4, e = n.inspect(e, n), n.truncate -= e.length, t = n.inspect(t, n), `${e} => ${t}`;
}
I(ru, "inspectMapEntry");
function iu(e) {
	let t = [];
	return e.forEach((e, n) => {
		t.push([n, e]);
	}), t;
}
I(iu, "mapToEntries");
function au(e, t) {
	return e.size === 0 ? "Map{}" : (t.truncate -= 7, `Map{ ${Yl(iu(e), t, ru)} }`);
}
I(au, "inspectMap");
var ou = Number.isNaN || ((e) => e !== e);
function su(e, t) {
	return ou(e) ? t.stylize("NaN", "number") : e === 1 / 0 ? t.stylize("Infinity", "number") : e === -1 / 0 ? t.stylize("-Infinity", "number") : e === 0 ? t.stylize(1 / e == 1 / 0 ? "+0" : "-0", "number") : t.stylize(Jl(String(e), t.truncate), "number");
}
I(su, "inspectNumber");
function cu(e, t) {
	let n = Jl(e.toString(), t.truncate - 1);
	return n !== Wl && (n += "n"), t.stylize(n, "bigint");
}
I(cu, "inspectBigInt");
function lu(e, t) {
	let n = e.toString().split("/")[2], r = t.truncate - (2 + n.length), i = e.source;
	return t.stylize(`/${Jl(i, r)}/${n}`, "regexp");
}
I(lu, "inspectRegExp");
function uu(e) {
	let t = [];
	return e.forEach((e) => {
		t.push(e);
	}), t;
}
I(uu, "arrayFromSet");
function du(e, t) {
	return e.size === 0 ? "Set{}" : (t.truncate -= 7, `Set{ ${Yl(uu(e), t)} }`);
}
I(du, "inspectSet");
var fu = /* @__PURE__ */ RegExp("['\\u0000-\\u001f\\u007f-\\u009f\\u00ad\\u0600-\\u0604\\u070f\\u17b4\\u17b5\\u200c-\\u200f\\u2028-\\u202f\\u2060-\\u206f\\ufeff\\ufff0-\\uffff]", "g"), pu = {
	"\b": "\\b",
	"	": "\\t",
	"\n": "\\n",
	"\f": "\\f",
	"\r": "\\r",
	"'": "\\'",
	"\\": "\\\\"
}, mu = 16, hu = 4;
function gu(e) {
	return pu[e] || `\\u${`0000${e.charCodeAt(0).toString(mu)}`.slice(-hu)}`;
}
I(gu, "escape");
function _u(e, t) {
	return fu.test(e) && (e = e.replace(fu, gu)), t.stylize(`'${Jl(e, t.truncate - 2)}'`, "string");
}
I(_u, "inspectString");
function vu(e) {
	return "description" in Symbol.prototype ? e.description ? `Symbol(${e.description})` : "Symbol()" : e.toString();
}
I(vu, "inspectSymbol");
var yu = I(() => "Promise{…}", "getPromiseValue");
function bu(e, t) {
	let n = Object.getOwnPropertyNames(e), r = Object.getOwnPropertySymbols ? Object.getOwnPropertySymbols(e) : [];
	if (n.length === 0 && r.length === 0) return "{}";
	if (t.truncate -= 4, t.seen = t.seen || [], t.seen.includes(e)) return "[Circular]";
	t.seen.push(e);
	let i = Yl(n.map((t) => [t, e[t]]), t, Zl), a = Yl(r.map((t) => [t, e[t]]), t, Zl);
	t.seen.pop();
	let o = "";
	return i && a && (o = ", "), `{ ${i}${o}${a} }`;
}
I(bu, "inspectObject");
var xu = typeof Symbol < "u" && Symbol.toStringTag ? Symbol.toStringTag : !1;
function Su(e, t) {
	let n = "";
	return xu && xu in e && (n = e[xu]), n ||= e.constructor.name, n && n !== "_class" || (n = "<Anonymous Class>"), t.truncate -= n.length, `${n}${bu(e, t)}`;
}
I(Su, "inspectClass");
function Cu(e, t) {
	return e.length === 0 ? "Arguments[]" : (t.truncate -= 13, `Arguments[ ${Yl(e, t)} ]`);
}
I(Cu, "inspectArguments");
var wu = [
	"stack",
	"line",
	"column",
	"name",
	"message",
	"fileName",
	"lineNumber",
	"columnNumber",
	"number",
	"description",
	"cause"
];
function Tu(e, t) {
	let n = Object.getOwnPropertyNames(e).filter((e) => wu.indexOf(e) === -1), r = e.name;
	t.truncate -= r.length;
	let i = "";
	if (typeof e.message == "string" ? i = Jl(e.message, t.truncate) : n.unshift("message"), i = i ? `: ${i}` : "", t.truncate -= i.length + 5, t.seen = t.seen || [], t.seen.includes(e)) return "[Circular]";
	t.seen.push(e);
	let a = Yl(n.map((t) => [t, e[t]]), t, Zl);
	return `${r}${i}${a ? ` { ${a} }` : ""}`;
}
I(Tu, "inspectObject");
function Eu([e, t], n) {
	return n.truncate -= 3, t ? `${n.stylize(String(e), "yellow")}=${n.stylize(`"${t}"`, "string")}` : `${n.stylize(String(e), "yellow")}`;
}
I(Eu, "inspectAttribute");
function Du(e, t) {
	return Yl(e, t, Ou, "\n");
}
I(Du, "inspectNodeCollection");
function Ou(e, t) {
	switch (e.nodeType) {
		case 1: return ku(e, t);
		case 3: return t.inspect(e.data, t);
		default: return t.inspect(e, t);
	}
}
I(Ou, "inspectNode");
function ku(e, t) {
	let n = e.getAttributeNames(), r = e.tagName.toLowerCase(), i = t.stylize(`<${r}`, "special"), a = t.stylize(">", "special"), o = t.stylize(`</${r}>`, "special");
	t.truncate -= r.length * 2 + 5;
	let s = "";
	n.length > 0 && (s += " ", s += Yl(n.map((t) => [t, e.getAttribute(t)]), t, Eu, " ")), t.truncate -= s.length;
	let c = t.truncate, l = Du(e.children, t);
	return l && l.length > c && (l = `${Wl}(${e.children.length})`), `${i}${s}${a}${l}${o}`;
}
I(ku, "inspectHTML");
var Au = typeof Symbol == "function" && typeof Symbol.for == "function" ? /* @__PURE__ */ Symbol.for("chai/inspect") : "@@chai/inspect", ju = /* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom"), Mu = /* @__PURE__ */ new WeakMap(), Nu = {}, Pu = {
	undefined: I((e, t) => t.stylize("undefined", "undefined"), "undefined"),
	null: I((e, t) => t.stylize("null", "null"), "null"),
	boolean: I((e, t) => t.stylize(String(e), "boolean"), "boolean"),
	Boolean: I((e, t) => t.stylize(String(e), "boolean"), "Boolean"),
	number: su,
	Number: su,
	bigint: cu,
	BigInt: cu,
	string: _u,
	String: _u,
	function: nu,
	Function: nu,
	symbol: vu,
	Symbol: vu,
	Array: Ql,
	Date: tu,
	Map: au,
	Set: du,
	RegExp: lu,
	Promise: yu,
	WeakSet: I((e, t) => t.stylize("WeakSet{…}", "special"), "WeakSet"),
	WeakMap: I((e, t) => t.stylize("WeakMap{…}", "special"), "WeakMap"),
	Arguments: Cu,
	Int8Array: eu,
	Uint8Array: eu,
	Uint8ClampedArray: eu,
	Int16Array: eu,
	Uint16Array: eu,
	Int32Array: eu,
	Uint32Array: eu,
	Float32Array: eu,
	Float64Array: eu,
	Generator: I(() => "", "Generator"),
	DataView: I(() => "", "DataView"),
	ArrayBuffer: I(() => "", "ArrayBuffer"),
	Error: Tu,
	HTMLCollection: Du,
	NodeList: Du
}, Fu = I((e, t, n) => Au in e && typeof e[Au] == "function" ? e[Au](t) : ju in e && typeof e[ju] == "function" ? e[ju](t.depth, t) : "inspect" in e && typeof e.inspect == "function" ? e.inspect(t.depth, t) : "constructor" in e && Mu.has(e.constructor) ? Mu.get(e.constructor)(e, t) : Nu[n] ? Nu[n](e, t) : "", "inspectCustom"), Iu = Object.prototype.toString;
function Lu(e, t = {}) {
	let n = Kl(t, Lu), { customInspect: r } = n, i = e === null ? "null" : typeof e;
	if (i === "object" && (i = Iu.call(e).slice(8, -1)), i in Pu) return Pu[i](e, n);
	if (r && e) {
		let t = Fu(e, n, i);
		if (t) return typeof t == "string" ? t : Lu(t, n);
	}
	let a = e ? Object.getPrototypeOf(e) : !1;
	return a === Object.prototype || a === null ? bu(e, n) : e && typeof HTMLElement == "function" && e instanceof HTMLElement ? ku(e, n) : "constructor" in e ? e.constructor === Object ? bu(e, n) : Su(e, n) : e === Object(e) ? bu(e, n) : n.stylize(String(e), i);
}
I(Lu, "inspect");
var Ru = {
	includeStack: !1,
	showDiff: !0,
	truncateThreshold: 40,
	useProxy: !0,
	proxyExcludedKeys: [
		"then",
		"catch",
		"inspect",
		"toJSON"
	],
	deepEqual: null
};
function B(e, t, n, r) {
	return Lu(e, {
		colors: r,
		depth: typeof n > "u" ? 2 : n,
		showHidden: t,
		truncate: Ru.truncateThreshold ? Ru.truncateThreshold : 1 / 0
	});
}
I(B, "inspect");
function zu(e) {
	let t = B(e), n = Object.prototype.toString.call(e);
	if (Ru.truncateThreshold && t.length >= Ru.truncateThreshold) {
		if (n === "[object Function]") return !e.name || e.name === "" ? "[Function]" : "[Function: " + e.name + "]";
		if (n === "[object Array]") return "[ Array(" + e.length + ") ]";
		if (n === "[object Object]") {
			let t = Object.keys(e);
			return "{ Object (" + (t.length > 2 ? t.splice(0, 2).join(", ") + ", ..." : t.join(", ")) + ") }";
		}
		return t;
	}
	return t;
}
I(zu, "objDisplay");
function Bu(e, t) {
	let n = L(e, "negate"), r = L(e, "object"), i = t[3], a = Vl(e, t), o = n ? t[2] : t[1], s = L(e, "message");
	return typeof o == "function" && (o = o()), o ||= "", o = o.replace(/#\{this\}/g, function() {
		return zu(r);
	}).replace(/#\{act\}/g, function() {
		return zu(a);
	}).replace(/#\{exp\}/g, function() {
		return zu(i);
	}), s ? s + ": " + o : o;
}
I(Bu, "getMessage");
function Vu(e, t, n) {
	let r = e.__flags ||= /* @__PURE__ */ Object.create(null);
	t.__flags ||= /* @__PURE__ */ Object.create(null), n = arguments.length !== 3 || n;
	for (let e in r) (n || e !== "object" && e !== "ssfi" && e !== "lockSsfi" && e != "message") && (t.__flags[e] = r[e]);
}
I(Vu, "transferFlags");
function Hu(e) {
	if (typeof e > "u") return "undefined";
	if (e === null) return "null";
	let t = e[Symbol.toStringTag];
	return typeof t == "string" ? t : Object.prototype.toString.call(e).slice(8, -1);
}
I(Hu, "type");
function Uu() {
	this._key = "chai/deep-eql__" + Math.random() + Date.now();
}
I(Uu, "FakeMap"), Uu.prototype = {
	get: I(function(e) {
		return e[this._key];
	}, "get"),
	set: I(function(e, t) {
		Object.isExtensible(e) && Object.defineProperty(e, this._key, {
			value: t,
			configurable: !0
		});
	}, "set")
};
var Wu = typeof WeakMap == "function" ? WeakMap : Uu;
function Gu(e, t, n) {
	if (!n || ld(e) || ld(t)) return null;
	var r = n.get(e);
	if (r) {
		var i = r.get(t);
		if (typeof i == "boolean") return i;
	}
	return null;
}
I(Gu, "memoizeCompare");
function Ku(e, t, n, r) {
	if (!(!n || ld(e) || ld(t))) {
		var i = n.get(e);
		i ? i.set(t, r) : (i = new Wu(), i.set(t, r), n.set(e, i));
	}
}
I(Ku, "memoizeSet");
var qu = Ju;
function Ju(e, t, n) {
	if (n && n.comparator) return Xu(e, t, n);
	var r = Yu(e, t);
	return r === null ? Xu(e, t, n) : r;
}
I(Ju, "deepEqual");
function Yu(e, t) {
	return e === t ? e !== 0 || 1 / e == 1 / t : e !== e && t !== t ? !0 : ld(e) || ld(t) ? !1 : null;
}
I(Yu, "simpleEqual");
function Xu(e, t, n) {
	n ||= {}, n.memoize = n.memoize === !1 ? !1 : n.memoize || new Wu();
	var r = n && n.comparator, i = Gu(e, t, n.memoize);
	if (i !== null) return i;
	var a = Gu(t, e, n.memoize);
	if (a !== null) return a;
	if (r) {
		var o = r(e, t);
		if (o === !1 || o === !0) return Ku(e, t, n.memoize, o), o;
		var s = Yu(e, t);
		if (s !== null) return s;
	}
	var c = Hu(e);
	if (c !== Hu(t)) return Ku(e, t, n.memoize, !1), !1;
	Ku(e, t, n.memoize, !0);
	var l = Zu(e, t, c, n);
	return Ku(e, t, n.memoize, l), l;
}
I(Xu, "extensiveDeepEqual");
function Zu(e, t, n, r) {
	switch (n) {
		case "String":
		case "Number":
		case "Boolean":
		case "Date": return Ju(e.valueOf(), t.valueOf());
		case "Promise":
		case "Symbol":
		case "function":
		case "WeakMap":
		case "WeakSet": return e === t;
		case "Error": return sd(e, t, [
			"name",
			"message",
			"code"
		], r);
		case "Arguments":
		case "Int8Array":
		case "Uint8Array":
		case "Uint8ClampedArray":
		case "Int16Array":
		case "Uint16Array":
		case "Int32Array":
		case "Uint32Array":
		case "Float32Array":
		case "Float64Array":
		case "Array": return ed(e, t, r);
		case "RegExp": return Qu(e, t);
		case "Generator": return td(e, t, r);
		case "DataView": return ed(new Uint8Array(e.buffer), new Uint8Array(t.buffer), r);
		case "ArrayBuffer": return ed(new Uint8Array(e), new Uint8Array(t), r);
		case "Set": return $u(e, t, r);
		case "Map": return $u(e, t, r);
		case "Temporal.PlainDate":
		case "Temporal.PlainTime":
		case "Temporal.PlainDateTime":
		case "Temporal.Instant":
		case "Temporal.ZonedDateTime":
		case "Temporal.PlainYearMonth":
		case "Temporal.PlainMonthDay": return e.equals(t);
		case "Temporal.Duration": return e.total("nanoseconds") === t.total("nanoseconds");
		case "Temporal.TimeZone":
		case "Temporal.Calendar": return e.toString() === t.toString();
		default: return cd(e, t, r);
	}
}
I(Zu, "extensiveDeepEqualByType");
function Qu(e, t) {
	return e.toString() === t.toString();
}
I(Qu, "regexpEqual");
function $u(e, t, n) {
	try {
		if (e.size !== t.size) return !1;
		if (e.size === 0) return !0;
	} catch {
		return !1;
	}
	var r = [], i = [];
	return e.forEach(I(function(e, t) {
		r.push([e, t]);
	}, "gatherEntries")), t.forEach(I(function(e, t) {
		i.push([e, t]);
	}, "gatherEntries")), ed(r.sort(), i.sort(), n);
}
I($u, "entriesEqual");
function ed(e, t, n) {
	var r = e.length;
	if (r !== t.length) return !1;
	if (r === 0) return !0;
	for (var i = -1; ++i < r;) if (Ju(e[i], t[i], n) === !1) return !1;
	return !0;
}
I(ed, "iterableEqual");
function td(e, t, n) {
	return ed(id(e), id(t), n);
}
I(td, "generatorEqual");
function nd(e) {
	return typeof Symbol < "u" && typeof e == "object" && typeof Symbol.iterator < "u" && typeof e[Symbol.iterator] == "function";
}
I(nd, "hasIteratorFunction");
function rd(e) {
	if (nd(e)) try {
		return id(e[Symbol.iterator]());
	} catch {
		return [];
	}
	return [];
}
I(rd, "getIteratorEntries");
function id(e) {
	for (var t = e.next(), n = [t.value]; t.done === !1;) t = e.next(), n.push(t.value);
	return n;
}
I(id, "getGeneratorEntries");
function ad(e) {
	var t = [];
	for (var n in e) t.push(n);
	return t;
}
I(ad, "getEnumerableKeys");
function od(e) {
	for (var t = [], n = Object.getOwnPropertySymbols(e), r = 0; r < n.length; r += 1) {
		var i = n[r];
		Object.getOwnPropertyDescriptor(e, i).enumerable && t.push(i);
	}
	return t;
}
I(od, "getEnumerableSymbols");
function sd(e, t, n, r) {
	var i = n.length;
	if (i === 0) return !0;
	for (var a = 0; a < i; a += 1) if (Ju(e[n[a]], t[n[a]], r) === !1) return !1;
	return !0;
}
I(sd, "keysEqual");
function cd(e, t, n) {
	var r = ad(e), i = ad(t), a = od(e), o = od(t);
	if (r = r.concat(a), i = i.concat(o), r.length && r.length === i.length) return ed(ud(r).sort(), ud(i).sort()) !== !1 && sd(e, t, r, n);
	var s = rd(e), c = rd(t);
	return s.length && s.length === c.length ? (s.sort(), c.sort(), ed(s, c, n)) : r.length === 0 && s.length === 0 && i.length === 0 && c.length === 0;
}
I(cd, "objectEqual");
function ld(e) {
	return typeof e != "object" || !e;
}
I(ld, "isPrimitive");
function ud(e) {
	return e.map(I(function(e) {
		return typeof e == "symbol" ? e.toString() : e;
	}, "mapSymbol"));
}
I(ud, "mapSymbols");
function dd(e, t) {
	return typeof e > "u" || e === null ? !1 : t in Object(e);
}
I(dd, "hasProperty");
function fd(e) {
	return e.replace(/([^\\])\[/g, "$1.[").match(/(\\\.|[^.]+?)+/g).map((e) => {
		if (e === "constructor" || e === "__proto__" || e === "prototype") return {};
		let t = /^\[(\d+)\]$/.exec(e), n = null;
		return n = t ? { i: parseFloat(t[1]) } : { p: e.replace(/\\([.[\]])/g, "$1") }, n;
	});
}
I(fd, "parsePath");
function pd(e, t, n) {
	let r = e, i = null;
	n = typeof n > "u" ? t.length : n;
	for (let e = 0; e < n; e++) {
		let a = t[e];
		r && (r = typeof a.p > "u" ? r[a.i] : r[a.p], e === n - 1 && (i = r));
	}
	return i;
}
I(pd, "internalGetPathValue");
function md(e, t) {
	let n = fd(t), r = n[n.length - 1], i = {
		parent: n.length > 1 ? pd(e, n, n.length - 1) : e,
		name: r.p || r.i,
		value: pd(e, n)
	};
	return i.exists = dd(i.parent, i.name), i;
}
I(md, "getPathInfo");
var hd = class {
	__flags = {};
	constructor(e, t, n, r) {
		return L(this, "ssfi", n || hd), L(this, "lockSsfi", r), L(this, "object", e), L(this, "message", t), L(this, "eql", Ru.deepEqual || qu), Sd(this);
	}
	static get includeStack() {
		return console.warn("Assertion.includeStack is deprecated, use chai.config.includeStack instead."), Ru.includeStack;
	}
	static set includeStack(e) {
		console.warn("Assertion.includeStack is deprecated, use chai.config.includeStack instead."), Ru.includeStack = e;
	}
	static get showDiff() {
		return console.warn("Assertion.showDiff is deprecated, use chai.config.showDiff instead."), Ru.showDiff;
	}
	static set showDiff(e) {
		console.warn("Assertion.showDiff is deprecated, use chai.config.showDiff instead."), Ru.showDiff = e;
	}
	static addProperty(e, t) {
		_d(this.prototype, e, t);
	}
	static addMethod(e, t) {
		wd(this.prototype, e, t);
	}
	static addChainableMethod(e, t, n) {
		Md(this.prototype, e, t, n);
	}
	static overwriteProperty(e, t) {
		Td(this.prototype, e, t);
	}
	static overwriteMethod(e, t) {
		Ed(this.prototype, e, t);
	}
	static overwriteChainableMethod(e, t, n) {
		Nd(this.prototype, e, t, n);
	}
	assert(e, t, n, r, i, a) {
		let o = Ll(this, arguments);
		if (a !== !1 && (a = !0), r === void 0 && i === void 0 && (a = !1), Ru.showDiff !== !0 && (a = !1), !o) {
			t = Bu(this, arguments);
			let e = {
				actual: Vl(this, arguments),
				expected: r,
				showDiff: a
			}, n = zd(this, arguments);
			throw n && (e.operator = n), new z(t, e, Ru.includeStack ? this.assert : L(this, "ssfi"));
		}
	}
	get _obj() {
		return L(this, "object");
	}
	set _obj(e) {
		L(this, "object", e);
	}
}, V = (I(hd, "Assertion"), hd);
function gd() {
	return Ru.useProxy && typeof Proxy < "u" && typeof Reflect < "u";
}
I(gd, "isProxyEnabled");
function _d(e, t, n) {
	n = n === void 0 ? function() {} : n, Object.defineProperty(e, t, {
		get: I(function e() {
			!gd() && !L(this, "lockSsfi") && L(this, "ssfi", e);
			let t = n.call(this);
			if (t !== void 0) return t;
			let r = new V();
			return Vu(this, r), r;
		}, "propertyGetter"),
		configurable: !0
	});
}
I(_d, "addProperty");
var vd = Object.getOwnPropertyDescriptor(function() {}, "length");
function yd(e, t, n) {
	return vd.configurable && Object.defineProperty(e, "length", { get: I(function() {
		throw Error(n ? "Invalid Chai property: " + t + ".length. Due to a compatibility issue, \"length\" cannot directly follow \"" + t + "\". Use \"" + t + ".lengthOf\" instead." : "Invalid Chai property: " + t + ".length. See docs for proper usage of \"" + t + "\".");
	}, "get") }), e;
}
I(yd, "addLengthGuard");
function bd(e) {
	let t = Object.getOwnPropertyNames(e);
	function n(e) {
		t.indexOf(e) === -1 && t.push(e);
	}
	I(n, "addProperty");
	let r = Object.getPrototypeOf(e);
	for (; r !== null;) Object.getOwnPropertyNames(r).forEach(n), r = Object.getPrototypeOf(r);
	return t;
}
I(bd, "getProperties");
var xd = [
	"__flags",
	"__methods",
	"_obj",
	"assert"
];
function Sd(e, t) {
	return gd() ? new Proxy(e, { get: I(function e(n, r) {
		if (typeof r == "string" && Ru.proxyExcludedKeys.indexOf(r) === -1 && !Reflect.has(n, r)) {
			if (t) throw Error("Invalid Chai property: " + t + "." + r + ". See docs for proper usage of \"" + t + "\".");
			let e = null, i = 4;
			throw bd(n).forEach(function(t) {
				if (!Object.prototype.hasOwnProperty(t) && xd.indexOf(t) === -1) {
					let n = Cd(r, t, i);
					n < i && (e = t, i = n);
				}
			}), Error(e === null ? "Invalid Chai property: " + r : "Invalid Chai property: " + r + ". Did you mean \"" + e + "\"?");
		}
		return xd.indexOf(r) === -1 && !L(n, "lockSsfi") && L(n, "ssfi", e), Reflect.get(n, r);
	}, "proxyGetter") }) : e;
}
I(Sd, "proxify");
function Cd(e, t, n) {
	if (Math.abs(e.length - t.length) >= n) return n;
	let r = [];
	for (let n = 0; n <= e.length; n++) r[n] = Array(t.length + 1).fill(0), r[n][0] = n;
	for (let e = 0; e < t.length; e++) r[0][e] = e;
	for (let i = 1; i <= e.length; i++) {
		let a = e.charCodeAt(i - 1);
		for (let e = 1; e <= t.length; e++) Math.abs(i - e) >= n ? r[i][e] = n : r[i][e] = Math.min(r[i - 1][e] + 1, r[i][e - 1] + 1, r[i - 1][e - 1] + (a === t.charCodeAt(e - 1) ? 0 : 1));
	}
	return r[e.length][t.length];
}
I(Cd, "stringDistanceCapped");
function wd(e, t, n) {
	let r = I(function() {
		L(this, "lockSsfi") || L(this, "ssfi", r);
		let e = n.apply(this, arguments);
		if (e !== void 0) return e;
		let t = new V();
		return Vu(this, t), t;
	}, "methodWrapper");
	yd(r, t, !1), e[t] = Sd(r, t);
}
I(wd, "addMethod");
function Td(e, t, n) {
	let r = Object.getOwnPropertyDescriptor(e, t), i = I(function() {}, "_super");
	r && typeof r.get == "function" && (i = r.get), Object.defineProperty(e, t, {
		get: I(function e() {
			!gd() && !L(this, "lockSsfi") && L(this, "ssfi", e);
			let t = L(this, "lockSsfi");
			L(this, "lockSsfi", !0);
			let r = n(i).call(this);
			if (L(this, "lockSsfi", t), r !== void 0) return r;
			let a = new V();
			return Vu(this, a), a;
		}, "overwritingPropertyGetter"),
		configurable: !0
	});
}
I(Td, "overwriteProperty");
function Ed(e, t, n) {
	let r = e[t], i = I(function() {
		throw Error(t + " is not a function");
	}, "_super");
	r && typeof r == "function" && (i = r);
	let a = I(function() {
		L(this, "lockSsfi") || L(this, "ssfi", a);
		let e = L(this, "lockSsfi");
		L(this, "lockSsfi", !0);
		let t = n(i).apply(this, arguments);
		if (L(this, "lockSsfi", e), t !== void 0) return t;
		let r = new V();
		return Vu(this, r), r;
	}, "overwritingMethodWrapper");
	yd(a, t, !1), e[t] = Sd(a, t);
}
I(Ed, "overwriteMethod");
var Dd = typeof Object.setPrototypeOf == "function", Od = I(function() {}, "testFn"), kd = Object.getOwnPropertyNames(Od).filter(function(e) {
	let t = Object.getOwnPropertyDescriptor(Od, e);
	return typeof t != "object" || !t.configurable;
}), Ad = Function.prototype.call, jd = Function.prototype.apply;
function Md(e, t, n, r) {
	typeof r != "function" && (r = I(function() {}, "chainingBehavior"));
	let i = {
		method: n,
		chainingBehavior: r
	};
	e.__methods ||= {}, e.__methods[t] = i, Object.defineProperty(e, t, {
		get: I(function() {
			i.chainingBehavior.call(this);
			let n = I(function() {
				L(this, "lockSsfi") || L(this, "ssfi", n);
				let e = i.method.apply(this, arguments);
				if (e !== void 0) return e;
				let t = new V();
				return Vu(this, t), t;
			}, "chainableMethodWrapper");
			if (yd(n, t, !0), Dd) {
				let e = Object.create(this);
				e.call = Ad, e.apply = jd, Object.setPrototypeOf(n, e);
			} else Object.getOwnPropertyNames(e).forEach(function(t) {
				if (kd.indexOf(t) !== -1) return;
				let r = Object.getOwnPropertyDescriptor(e, t);
				Object.defineProperty(n, t, r);
			});
			return Vu(this, n), Sd(n);
		}, "chainableMethodGetter"),
		configurable: !0
	});
}
I(Md, "addChainableMethod");
function Nd(e, t, n, r) {
	let i = e.__methods[t], a = i.chainingBehavior;
	i.chainingBehavior = I(function() {
		let e = r(a).call(this);
		if (e !== void 0) return e;
		let t = new V();
		return Vu(this, t), t;
	}, "overwritingChainableMethodGetter");
	let o = i.method;
	i.method = I(function() {
		let e = n(o).apply(this, arguments);
		if (e !== void 0) return e;
		let t = new V();
		return Vu(this, t), t;
	}, "overwritingChainableMethodWrapper");
}
I(Nd, "overwriteChainableMethod");
function Pd(e, t) {
	return B(e) < B(t) ? -1 : 1;
}
I(Pd, "compareByInspect");
function Fd(e) {
	return typeof Object.getOwnPropertySymbols == "function" ? Object.getOwnPropertySymbols(e).filter(function(t) {
		return Object.getOwnPropertyDescriptor(e, t).enumerable;
	}) : [];
}
I(Fd, "getOwnEnumerablePropertySymbols");
function Id(e) {
	return Object.keys(e).concat(Fd(e));
}
I(Id, "getOwnEnumerableProperties");
var Ld = Number.isNaN;
function Rd(e) {
	let t = R(e);
	return [
		"Array",
		"Object",
		"Function"
	].indexOf(t) !== -1;
}
I(Rd, "isObjectType");
function zd(e, t) {
	let n = L(e, "operator"), r = L(e, "negate"), i = t[3], a = r ? t[2] : t[1];
	if (n) return n;
	if (typeof a == "function" && (a = a()), a ||= "", !a || /\shave\s/.test(a)) return;
	let o = Rd(i);
	return /\snot\s/.test(a) ? o ? "notDeepStrictEqual" : "notStrictEqual" : o ? "deepStrictEqual" : "strictEqual";
}
I(zd, "getOperator");
function Bd(e) {
	return e.name;
}
I(Bd, "getName");
function Vd(e) {
	return Object.prototype.toString.call(e) === "[object RegExp]";
}
I(Vd, "isRegExp");
function H(e) {
	return ["Number", "BigInt"].includes(R(e));
}
I(H, "isNumeric");
var { flag: U } = Ol;
[
	"to",
	"be",
	"been",
	"is",
	"and",
	"has",
	"have",
	"with",
	"that",
	"which",
	"at",
	"of",
	"same",
	"but",
	"does",
	"still",
	"also"
].forEach(function(e) {
	V.addProperty(e);
}), V.addProperty("not", function() {
	U(this, "negate", !0);
}), V.addProperty("deep", function() {
	U(this, "deep", !0);
}), V.addProperty("nested", function() {
	U(this, "nested", !0);
}), V.addProperty("own", function() {
	U(this, "own", !0);
}), V.addProperty("ordered", function() {
	U(this, "ordered", !0);
}), V.addProperty("any", function() {
	U(this, "any", !0), U(this, "all", !1);
}), V.addProperty("all", function() {
	U(this, "all", !0), U(this, "any", !1);
});
var Hd = {
	function: [
		"function",
		"asyncfunction",
		"generatorfunction",
		"asyncgeneratorfunction"
	],
	asyncfunction: ["asyncfunction", "asyncgeneratorfunction"],
	generatorfunction: ["generatorfunction", "asyncgeneratorfunction"],
	asyncgeneratorfunction: ["asyncgeneratorfunction"]
};
function Ud(e, t) {
	t && U(this, "message", t), e = e.toLowerCase();
	let n = U(this, "object"), r = ~[
		"a",
		"e",
		"i",
		"o",
		"u"
	].indexOf(e.charAt(0)) ? "an " : "a ", i = R(n).toLowerCase();
	Hd.function.includes(e) ? this.assert(Hd[e].includes(i), "expected #{this} to be " + r + e, "expected #{this} not to be " + r + e) : this.assert(e === i, "expected #{this} to be " + r + e, "expected #{this} not to be " + r + e);
}
I(Ud, "an"), V.addChainableMethod("an", Ud), V.addChainableMethod("a", Ud);
function Wd(e, t) {
	return Ld(e) && Ld(t) || e === t;
}
I(Wd, "SameValueZero");
function Gd() {
	U(this, "contains", !0);
}
I(Gd, "includeChainingBehavior");
function Kd(e, t) {
	t && U(this, "message", t);
	let n = U(this, "object"), r = R(n).toLowerCase(), i = U(this, "message"), a = U(this, "negate"), o = U(this, "ssfi"), s = U(this, "deep"), c = s ? "deep " : "", l = s ? U(this, "eql") : Wd;
	i = i ? i + ": " : "";
	let u = !1;
	switch (r) {
		case "string":
			u = n.indexOf(e) !== -1;
			break;
		case "weakset":
			if (s) throw new z(i + "unable to use .deep.include with WeakSet", void 0, o);
			u = n.has(e);
			break;
		case "map":
			n.forEach(function(t) {
				u ||= l(t, e);
			});
			break;
		case "set":
			s ? n.forEach(function(t) {
				u ||= l(t, e);
			}) : u = n.has(e);
			break;
		case "array":
			u = s ? n.some(function(t) {
				return l(t, e);
			}) : n.indexOf(e) !== -1;
			break;
		default: {
			if (e !== Object(e)) throw new z(i + "the given combination of arguments (" + r + " and " + R(e).toLowerCase() + ") is invalid for this assertion. You can use an array, a map, an object, a set, a string, or a weakset instead of a " + R(e).toLowerCase(), void 0, o);
			let t = Object.keys(e), s = null, c = 0;
			if (t.forEach(function(r) {
				let i = new V(n);
				if (Vu(this, i, !0), U(i, "lockSsfi", !0), !a || t.length === 1) i.property(r, e[r]);
				else try {
					i.property(r, e[r]);
				} catch (e) {
					if (!kl.compatibleConstructor(e, z)) throw e;
					s === null && (s = e), c++;
				}
			}, this), a && t.length > 1 && c === t.length) throw s;
			return;
		}
	}
	this.assert(u, "expected #{this} to " + c + "include " + B(e), "expected #{this} to not " + c + "include " + B(e));
}
I(Kd, "include"), V.addChainableMethod("include", Kd, Gd), V.addChainableMethod("contain", Kd, Gd), V.addChainableMethod("contains", Kd, Gd), V.addChainableMethod("includes", Kd, Gd), V.addProperty("ok", function() {
	this.assert(U(this, "object"), "expected #{this} to be truthy", "expected #{this} to be falsy");
}), V.addProperty("true", function() {
	this.assert(U(this, "object") === !0, "expected #{this} to be true", "expected #{this} to be false", !U(this, "negate"));
}), V.addProperty("numeric", function() {
	let e = U(this, "object");
	this.assert(["Number", "BigInt"].includes(R(e)), "expected #{this} to be numeric", "expected #{this} to not be numeric", !U(this, "negate"));
}), V.addProperty("callable", function() {
	let e = U(this, "object"), t = U(this, "ssfi"), n = U(this, "message"), r = n ? `${n}: ` : "", i = U(this, "negate"), a = i ? `${r}expected ${B(e)} not to be a callable function` : `${r}expected ${B(e)} to be a callable function`, o = [
		"Function",
		"AsyncFunction",
		"GeneratorFunction",
		"AsyncGeneratorFunction"
	].includes(R(e));
	if (o && i || !o && !i) throw new z(a, void 0, t);
}), V.addProperty("false", function() {
	this.assert(U(this, "object") === !1, "expected #{this} to be false", "expected #{this} to be true", !!U(this, "negate"));
}), V.addProperty("null", function() {
	this.assert(U(this, "object") === null, "expected #{this} to be null", "expected #{this} not to be null");
}), V.addProperty("undefined", function() {
	this.assert(U(this, "object") === void 0, "expected #{this} to be undefined", "expected #{this} not to be undefined");
}), V.addProperty("NaN", function() {
	this.assert(Ld(U(this, "object")), "expected #{this} to be NaN", "expected #{this} not to be NaN");
});
function qd() {
	let e = U(this, "object");
	this.assert(e != null, "expected #{this} to exist", "expected #{this} to not exist");
}
I(qd, "assertExist"), V.addProperty("exist", qd), V.addProperty("exists", qd), V.addProperty("empty", function() {
	let e = U(this, "object"), t = U(this, "ssfi"), n = U(this, "message"), r;
	switch (n = n ? n + ": " : "", R(e).toLowerCase()) {
		case "array":
		case "string":
			r = e.length;
			break;
		case "map":
		case "set":
			r = e.size;
			break;
		case "weakmap":
		case "weakset": throw new z(n + ".empty was passed a weak collection", void 0, t);
		case "function": throw new z((n + ".empty was passed a function " + Bd(e)).trim(), void 0, t);
		default:
			if (e !== Object(e)) throw new z(n + ".empty was passed non-string primitive " + B(e), void 0, t);
			r = Object.keys(e).length;
	}
	this.assert(r === 0, "expected #{this} to be empty", "expected #{this} not to be empty");
});
function Jd() {
	let e = R(U(this, "object"));
	this.assert(e === "Arguments", "expected #{this} to be arguments but got " + e, "expected #{this} to not be arguments");
}
I(Jd, "checkArguments"), V.addProperty("arguments", Jd), V.addProperty("Arguments", Jd);
function Yd(e, t) {
	t && U(this, "message", t);
	let n = U(this, "object");
	if (U(this, "deep")) {
		let t = U(this, "lockSsfi");
		U(this, "lockSsfi", !0), this.eql(e), U(this, "lockSsfi", t);
	} else this.assert(e === n, "expected #{this} to equal #{exp}", "expected #{this} to not equal #{exp}", e, this._obj, !0);
}
I(Yd, "assertEqual"), V.addMethod("equal", Yd), V.addMethod("equals", Yd), V.addMethod("eq", Yd);
function Xd(e, t) {
	t && U(this, "message", t);
	let n = U(this, "eql");
	this.assert(n(e, U(this, "object")), "expected #{this} to deeply equal #{exp}", "expected #{this} to not deeply equal #{exp}", e, this._obj, !0);
}
I(Xd, "assertEql"), V.addMethod("eql", Xd), V.addMethod("eqls", Xd);
function Zd(e, t) {
	t && U(this, "message", t);
	let n = U(this, "object"), r = U(this, "doLength"), i = U(this, "message"), a = i ? i + ": " : "", o = U(this, "ssfi"), s = R(n).toLowerCase(), c = R(e).toLowerCase();
	if (r && s !== "map" && s !== "set" && new V(n, i, o, !0).to.have.property("length"), !r && s === "date" && c !== "date") throw new z(a + "the argument to above must be a date", void 0, o);
	if (!H(e) && (r || H(n))) throw new z(a + "the argument to above must be a number", void 0, o);
	if (!r && s !== "date" && !H(n)) {
		let e = s === "string" ? "'" + n + "'" : n;
		throw new z(a + "expected " + e + " to be a number or a date", void 0, o);
	}
	if (r) {
		let t = "length", r;
		s === "map" || s === "set" ? (t = "size", r = n.size) : r = n.length, this.assert(r > e, "expected #{this} to have a " + t + " above #{exp} but got #{act}", "expected #{this} to not have a " + t + " above #{exp}", e, r);
	} else this.assert(n > e, "expected #{this} to be above #{exp}", "expected #{this} to be at most #{exp}", e);
}
I(Zd, "assertAbove"), V.addMethod("above", Zd), V.addMethod("gt", Zd), V.addMethod("greaterThan", Zd);
function Qd(e, t) {
	t && U(this, "message", t);
	let n = U(this, "object"), r = U(this, "doLength"), i = U(this, "message"), a = i ? i + ": " : "", o = U(this, "ssfi"), s = R(n).toLowerCase(), c = R(e).toLowerCase(), l, u = !0;
	if (r && s !== "map" && s !== "set" && new V(n, i, o, !0).to.have.property("length"), !r && s === "date" && c !== "date") l = a + "the argument to least must be a date";
	else if (!H(e) && (r || H(n))) l = a + "the argument to least must be a number";
	else if (!r && s !== "date" && !H(n)) {
		let e = s === "string" ? "'" + n + "'" : n;
		l = a + "expected " + e + " to be a number or a date";
	} else u = !1;
	if (u) throw new z(l, void 0, o);
	if (r) {
		let t = "length", r;
		s === "map" || s === "set" ? (t = "size", r = n.size) : r = n.length, this.assert(r >= e, "expected #{this} to have a " + t + " at least #{exp} but got #{act}", "expected #{this} to have a " + t + " below #{exp}", e, r);
	} else this.assert(n >= e, "expected #{this} to be at least #{exp}", "expected #{this} to be below #{exp}", e);
}
I(Qd, "assertLeast"), V.addMethod("least", Qd), V.addMethod("gte", Qd), V.addMethod("greaterThanOrEqual", Qd);
function $d(e, t) {
	t && U(this, "message", t);
	let n = U(this, "object"), r = U(this, "doLength"), i = U(this, "message"), a = i ? i + ": " : "", o = U(this, "ssfi"), s = R(n).toLowerCase(), c = R(e).toLowerCase(), l, u = !0;
	if (r && s !== "map" && s !== "set" && new V(n, i, o, !0).to.have.property("length"), !r && s === "date" && c !== "date") l = a + "the argument to below must be a date";
	else if (!H(e) && (r || H(n))) l = a + "the argument to below must be a number";
	else if (!r && s !== "date" && !H(n)) {
		let e = s === "string" ? "'" + n + "'" : n;
		l = a + "expected " + e + " to be a number or a date";
	} else u = !1;
	if (u) throw new z(l, void 0, o);
	if (r) {
		let t = "length", r;
		s === "map" || s === "set" ? (t = "size", r = n.size) : r = n.length, this.assert(r < e, "expected #{this} to have a " + t + " below #{exp} but got #{act}", "expected #{this} to not have a " + t + " below #{exp}", e, r);
	} else this.assert(n < e, "expected #{this} to be below #{exp}", "expected #{this} to be at least #{exp}", e);
}
I($d, "assertBelow"), V.addMethod("below", $d), V.addMethod("lt", $d), V.addMethod("lessThan", $d);
function ef(e, t) {
	t && U(this, "message", t);
	let n = U(this, "object"), r = U(this, "doLength"), i = U(this, "message"), a = i ? i + ": " : "", o = U(this, "ssfi"), s = R(n).toLowerCase(), c = R(e).toLowerCase(), l, u = !0;
	if (r && s !== "map" && s !== "set" && new V(n, i, o, !0).to.have.property("length"), !r && s === "date" && c !== "date") l = a + "the argument to most must be a date";
	else if (!H(e) && (r || H(n))) l = a + "the argument to most must be a number";
	else if (!r && s !== "date" && !H(n)) {
		let e = s === "string" ? "'" + n + "'" : n;
		l = a + "expected " + e + " to be a number or a date";
	} else u = !1;
	if (u) throw new z(l, void 0, o);
	if (r) {
		let t = "length", r;
		s === "map" || s === "set" ? (t = "size", r = n.size) : r = n.length, this.assert(r <= e, "expected #{this} to have a " + t + " at most #{exp} but got #{act}", "expected #{this} to have a " + t + " above #{exp}", e, r);
	} else this.assert(n <= e, "expected #{this} to be at most #{exp}", "expected #{this} to be above #{exp}", e);
}
I(ef, "assertMost"), V.addMethod("most", ef), V.addMethod("lte", ef), V.addMethod("lessThanOrEqual", ef), V.addMethod("within", function(e, t, n) {
	n && U(this, "message", n);
	let r = U(this, "object"), i = U(this, "doLength"), a = U(this, "message"), o = a ? a + ": " : "", s = U(this, "ssfi"), c = R(r).toLowerCase(), l = R(e).toLowerCase(), u = R(t).toLowerCase(), d, f = !0, p = l === "date" && u === "date" ? e.toISOString() + ".." + t.toISOString() : e + ".." + t;
	if (i && c !== "map" && c !== "set" && new V(r, a, s, !0).to.have.property("length"), !i && c === "date" && (l !== "date" || u !== "date")) d = o + "the arguments to within must be dates";
	else if ((!H(e) || !H(t)) && (i || H(r))) d = o + "the arguments to within must be numbers";
	else if (!i && c !== "date" && !H(r)) {
		let e = c === "string" ? "'" + r + "'" : r;
		d = o + "expected " + e + " to be a number or a date";
	} else f = !1;
	if (f) throw new z(d, void 0, s);
	if (i) {
		let n = "length", i;
		c === "map" || c === "set" ? (n = "size", i = r.size) : i = r.length, this.assert(i >= e && i <= t, "expected #{this} to have a " + n + " within " + p, "expected #{this} to not have a " + n + " within " + p);
	} else this.assert(r >= e && r <= t, "expected #{this} to be within " + p, "expected #{this} to not be within " + p);
});
function tf(e, t) {
	t && U(this, "message", t);
	let n = U(this, "object"), r = U(this, "ssfi"), i = U(this, "message"), a;
	try {
		a = n instanceof e;
	} catch (t) {
		throw t instanceof TypeError ? (i = i ? i + ": " : "", new z(i + "The instanceof assertion needs a constructor but " + R(e) + " was given.", void 0, r)) : t;
	}
	let o = Bd(e);
	o ??= "an unnamed constructor", this.assert(a, "expected #{this} to be an instance of " + o, "expected #{this} to not be an instance of " + o);
}
I(tf, "assertInstanceOf"), V.addMethod("instanceof", tf), V.addMethod("instanceOf", tf);
function nf(e, t, n) {
	n && U(this, "message", n);
	let r = U(this, "nested"), i = U(this, "own"), a = U(this, "message"), o = U(this, "object"), s = U(this, "ssfi"), c = typeof e;
	if (a = a ? a + ": " : "", r) {
		if (c !== "string") throw new z(a + "the argument to property must be a string when using nested syntax", void 0, s);
	} else if (c !== "string" && c !== "number" && c !== "symbol") throw new z(a + "the argument to property must be a string, number, or symbol", void 0, s);
	if (r && i) throw new z(a + "The \"nested\" and \"own\" flags cannot be combined.", void 0, s);
	if (o == null) throw new z(a + "Target cannot be null or undefined.", void 0, s);
	let l = U(this, "deep"), u = U(this, "negate"), d = r ? md(o, e) : null, f = r ? d.value : o[e], p = l ? U(this, "eql") : (e, t) => e === t, m = "";
	l && (m += "deep "), i && (m += "own "), r && (m += "nested "), m += "property ";
	let h;
	h = i ? Object.prototype.hasOwnProperty.call(o, e) : r ? d.exists : dd(o, e), u && arguments.length !== 1 || this.assert(h, "expected #{this} to have " + m + B(e), "expected #{this} to not have " + m + B(e)), arguments.length > 1 && this.assert(h && p(t, f), "expected #{this} to have " + m + B(e) + " of #{exp}, but got #{act}", "expected #{this} to not have " + m + B(e) + " of #{act}", t, f), U(this, "object", f);
}
I(nf, "assertProperty"), V.addMethod("property", nf);
function rf(e, t, n) {
	U(this, "own", !0), nf.apply(this, arguments);
}
I(rf, "assertOwnProperty"), V.addMethod("ownProperty", rf), V.addMethod("haveOwnProperty", rf);
function af(e, t, n) {
	typeof t == "string" && (n = t, t = null), n && U(this, "message", n);
	let r = U(this, "object"), i = Object.getOwnPropertyDescriptor(Object(r), e), a = U(this, "eql");
	i && t ? this.assert(a(t, i), "expected the own property descriptor for " + B(e) + " on #{this} to match " + B(t) + ", got " + B(i), "expected the own property descriptor for " + B(e) + " on #{this} to not match " + B(t), t, i, !0) : this.assert(i, "expected #{this} to have an own property descriptor for " + B(e), "expected #{this} to not have an own property descriptor for " + B(e)), U(this, "object", i);
}
I(af, "assertOwnPropertyDescriptor"), V.addMethod("ownPropertyDescriptor", af), V.addMethod("haveOwnPropertyDescriptor", af);
function of() {
	U(this, "doLength", !0);
}
I(of, "assertLengthChain");
function sf(e, t) {
	t && U(this, "message", t);
	let n = U(this, "object"), r = R(n).toLowerCase(), i = U(this, "message"), a = U(this, "ssfi"), o = "length", s;
	switch (r) {
		case "map":
		case "set":
			o = "size", s = n.size;
			break;
		default: new V(n, i, a, !0).to.have.property("length"), s = n.length;
	}
	this.assert(s == e, "expected #{this} to have a " + o + " of #{exp} but got #{act}", "expected #{this} to not have a " + o + " of #{act}", e, s);
}
I(sf, "assertLength"), V.addChainableMethod("length", sf, of), V.addChainableMethod("lengthOf", sf, of);
function cf(e, t) {
	t && U(this, "message", t);
	let n = U(this, "object");
	this.assert(e.exec(n), "expected #{this} to match " + e, "expected #{this} not to match " + e);
}
I(cf, "assertMatch"), V.addMethod("match", cf), V.addMethod("matches", cf), V.addMethod("string", function(e, t) {
	t && U(this, "message", t);
	let n = U(this, "object");
	new V(n, U(this, "message"), U(this, "ssfi"), !0).is.a("string"), this.assert(~n.indexOf(e), "expected #{this} to contain " + B(e), "expected #{this} to not contain " + B(e));
});
function lf(e) {
	let t = U(this, "object"), n = R(t), r = R(e), i = U(this, "ssfi"), a = U(this, "deep"), o, s = "", c, l = !0, u = U(this, "message");
	u = u ? u + ": " : "";
	let d = u + "when testing keys against an object or an array you must give a single Array|Object|String argument or multiple String arguments";
	if (n === "Map" || n === "Set") s = a ? "deeply " : "", c = [], t.forEach(function(e, t) {
		c.push(t);
	}), r !== "Array" && (e = Array.prototype.slice.call(arguments));
	else {
		switch (c = Id(t), r) {
			case "Array":
				if (arguments.length > 1) throw new z(d, void 0, i);
				break;
			case "Object":
				if (arguments.length > 1) throw new z(d, void 0, i);
				e = Object.keys(e);
				break;
			default: e = Array.prototype.slice.call(arguments);
		}
		e = e.map(function(e) {
			return typeof e == "symbol" ? e : String(e);
		});
	}
	if (!e.length) throw new z(u + "keys required", void 0, i);
	let f = e.length, p = U(this, "any"), m = U(this, "all"), h = e, g = a ? U(this, "eql") : (e, t) => e === t;
	if (!p && !m && (m = !0), p && (l = h.some(function(e) {
		return c.some(function(t) {
			return g(e, t);
		});
	})), m && (l = h.every(function(e) {
		return c.some(function(t) {
			return g(e, t);
		});
	}), U(this, "contains") || (l &&= e.length == c.length)), f > 1) {
		e = e.map(function(e) {
			return B(e);
		});
		let t = e.pop();
		m && (o = e.join(", ") + ", and " + t), p && (o = e.join(", ") + ", or " + t);
	} else o = B(e[0]);
	o = (f > 1 ? "keys " : "key ") + o, o = (U(this, "contains") ? "contain " : "have ") + o, this.assert(l, "expected #{this} to " + s + o, "expected #{this} to not " + s + o, h.slice(0).sort(Pd), c.sort(Pd), !0);
}
I(lf, "assertKeys"), V.addMethod("keys", lf), V.addMethod("key", lf);
function uf(e, t, n) {
	n && U(this, "message", n);
	let r = U(this, "object"), i = U(this, "ssfi"), a = U(this, "message"), o = U(this, "negate") || !1;
	new V(r, a, i, !0).is.a("function"), (Vd(e) || typeof e == "string") && (t = e, e = null);
	let s, c = !1;
	try {
		r();
	} catch (e) {
		c = !0, s = e;
	}
	let l = e === void 0 && t === void 0, u = !!(e && t), d = !1, f = !1;
	if (l || !l && !o) {
		let t = "an error";
		e instanceof Error ? t = "#{exp}" : e && (t = kl.getConstructorName(e));
		let n = s;
		if (s instanceof Error) n = s.toString();
		else if (typeof s == "string") n = s;
		else if (s && (typeof s == "object" || typeof s == "function")) try {
			n = kl.getConstructorName(s);
		} catch {}
		this.assert(c, "expected #{this} to throw " + t, "expected #{this} to not throw an error but #{act} was thrown", e && e.toString(), n);
	}
	if (e && s && (e instanceof Error && kl.compatibleInstance(s, e) === o && (u && o ? d = !0 : this.assert(o, "expected #{this} to throw #{exp} but #{act} was thrown", "expected #{this} to not throw #{exp}" + (s && !o ? " but #{act} was thrown" : ""), e.toString(), s.toString())), kl.compatibleConstructor(s, e) === o && (u && o ? d = !0 : this.assert(o, "expected #{this} to throw #{exp} but #{act} was thrown", "expected #{this} to not throw #{exp}" + (s ? " but #{act} was thrown" : ""), e instanceof Error ? e.toString() : e && kl.getConstructorName(e), s instanceof Error ? s.toString() : s && kl.getConstructorName(s)))), s && t != null) {
		let e = "including";
		Vd(t) && (e = "matching"), kl.compatibleMessage(s, t) === o && (u && o ? f = !0 : this.assert(o, "expected #{this} to throw error " + e + " #{exp} but got #{act}", "expected #{this} to throw error not " + e + " #{exp}", t, kl.getMessage(s)));
	}
	d && f && this.assert(o, "expected #{this} to throw #{exp} but #{act} was thrown", "expected #{this} to not throw #{exp}" + (s ? " but #{act} was thrown" : ""), e instanceof Error ? e.toString() : e && kl.getConstructorName(e), s instanceof Error ? s.toString() : s && kl.getConstructorName(s)), U(this, "object", s);
}
I(uf, "assertThrows"), V.addMethod("throw", uf), V.addMethod("throws", uf), V.addMethod("Throw", uf);
function df(e, t) {
	t && U(this, "message", t);
	let n = U(this, "object"), r = U(this, "itself"), i = typeof n == "function" && !r ? n.prototype[e] : n[e];
	this.assert(typeof i == "function", "expected #{this} to respond to " + B(e), "expected #{this} to not respond to " + B(e));
}
I(df, "respondTo"), V.addMethod("respondTo", df), V.addMethod("respondsTo", df), V.addProperty("itself", function() {
	U(this, "itself", !0);
});
function ff(e, t) {
	t && U(this, "message", t);
	let n = e(U(this, "object"));
	this.assert(n, "expected #{this} to satisfy " + zu(e), "expected #{this} to not satisfy" + zu(e), !U(this, "negate"), n);
}
I(ff, "satisfy"), V.addMethod("satisfy", ff), V.addMethod("satisfies", ff);
function pf(e, t, n) {
	n && U(this, "message", n);
	let r = U(this, "object"), i = U(this, "message"), a = U(this, "ssfi");
	new V(r, i, a, !0).is.numeric;
	let o = "A `delta` value is required for `closeTo`";
	if (t == null || (new V(t, i, a, !0).is.numeric, o = "A `expected` value is required for `closeTo`", e == null)) throw new z(i ? `${i}: ${o}` : o, void 0, a);
	new V(e, i, a, !0).is.numeric;
	let s = I((e) => e < 0n ? -e : e, "abs"), c = I((e) => parseFloat(parseFloat(e).toPrecision(12)), "strip");
	this.assert(c(s(r - e)) <= t, "expected #{this} to be close to " + e + " +/- " + t, "expected #{this} not to be close to " + e + " +/- " + t);
}
I(pf, "closeTo"), V.addMethod("closeTo", pf), V.addMethod("approximately", pf);
function mf(e, t, n, r, i) {
	let a = Array.from(t), o = Array.from(e);
	if (!r) {
		if (o.length !== a.length) return !1;
		a = a.slice();
	}
	return o.every(function(e, t) {
		if (i) return n ? n(e, a[t]) : e === a[t];
		if (!n) {
			let t = a.indexOf(e);
			return t !== -1 && (r || a.splice(t, 1), !0);
		}
		return a.some(function(t, i) {
			return n(e, t) ? (r || a.splice(i, 1), !0) : !1;
		});
	});
}
I(mf, "isSubsetOf"), V.addMethod("members", function(e, t) {
	t && U(this, "message", t);
	let n = U(this, "object"), r = U(this, "message"), i = U(this, "ssfi");
	new V(n, r, i, !0).to.be.iterable, new V(e, r, i, !0).to.be.iterable;
	let a = U(this, "contains"), o = U(this, "ordered"), s, c, l;
	a ? (s = o ? "an ordered superset" : "a superset", c = "expected #{this} to be " + s + " of #{exp}", l = "expected #{this} to not be " + s + " of #{exp}") : (s = o ? "ordered members" : "members", c = "expected #{this} to have the same " + s + " as #{exp}", l = "expected #{this} to not have the same " + s + " as #{exp}");
	let u = U(this, "deep") ? U(this, "eql") : void 0;
	this.assert(mf(e, n, u, a, o), c, l, e, n, !0);
}), V.addProperty("iterable", function(e) {
	e && U(this, "message", e);
	let t = U(this, "object");
	this.assert(t != null && t[Symbol.iterator], "expected #{this} to be an iterable", "expected #{this} to not be an iterable", t);
});
function hf(e, t) {
	t && U(this, "message", t);
	let n = U(this, "object"), r = U(this, "message"), i = U(this, "ssfi"), a = U(this, "contains"), o = U(this, "deep"), s = U(this, "eql");
	new V(e, r, i, !0).to.be.an("array"), a ? this.assert(e.some(function(e) {
		return n.indexOf(e) > -1;
	}), "expected #{this} to contain one of #{exp}", "expected #{this} to not contain one of #{exp}", e, n) : o ? this.assert(e.some(function(e) {
		return s(n, e);
	}), "expected #{this} to deeply equal one of #{exp}", "expected #{this} to deeply equal one of #{exp}", e, n) : this.assert(e.indexOf(n) > -1, "expected #{this} to be one of #{exp}", "expected #{this} to not be one of #{exp}", e, n);
}
I(hf, "oneOf"), V.addMethod("oneOf", hf);
function gf(e, t, n) {
	n && U(this, "message", n);
	let r = U(this, "object"), i = U(this, "message"), a = U(this, "ssfi");
	new V(r, i, a, !0).is.a("function");
	let o;
	t ? (new V(e, i, a, !0).to.have.property(t), o = e[t]) : (new V(e, i, a, !0).is.a("function"), o = e()), r();
	let s = t == null ? e() : e[t], c = t == null ? o : "." + t;
	U(this, "deltaMsgObj", c), U(this, "initialDeltaValue", o), U(this, "finalDeltaValue", s), U(this, "deltaBehavior", "change"), U(this, "realDelta", s !== o), this.assert(o !== s, "expected " + c + " to change", "expected " + c + " to not change");
}
I(gf, "assertChanges"), V.addMethod("change", gf), V.addMethod("changes", gf);
function _f(e, t, n) {
	n && U(this, "message", n);
	let r = U(this, "object"), i = U(this, "message"), a = U(this, "ssfi");
	new V(r, i, a, !0).is.a("function");
	let o;
	t ? (new V(e, i, a, !0).to.have.property(t), o = e[t]) : (new V(e, i, a, !0).is.a("function"), o = e()), new V(o, i, a, !0).is.a("number"), r();
	let s = t == null ? e() : e[t], c = t == null ? o : "." + t;
	U(this, "deltaMsgObj", c), U(this, "initialDeltaValue", o), U(this, "finalDeltaValue", s), U(this, "deltaBehavior", "increase"), U(this, "realDelta", s - o), this.assert(s - o > 0, "expected " + c + " to increase", "expected " + c + " to not increase");
}
I(_f, "assertIncreases"), V.addMethod("increase", _f), V.addMethod("increases", _f);
function vf(e, t, n) {
	n && U(this, "message", n);
	let r = U(this, "object"), i = U(this, "message"), a = U(this, "ssfi");
	new V(r, i, a, !0).is.a("function");
	let o;
	t ? (new V(e, i, a, !0).to.have.property(t), o = e[t]) : (new V(e, i, a, !0).is.a("function"), o = e()), new V(o, i, a, !0).is.a("number"), r();
	let s = t == null ? e() : e[t], c = t == null ? o : "." + t;
	U(this, "deltaMsgObj", c), U(this, "initialDeltaValue", o), U(this, "finalDeltaValue", s), U(this, "deltaBehavior", "decrease"), U(this, "realDelta", o - s), this.assert(s - o < 0, "expected " + c + " to decrease", "expected " + c + " to not decrease");
}
I(vf, "assertDecreases"), V.addMethod("decrease", vf), V.addMethod("decreases", vf);
function yf(e, t) {
	t && U(this, "message", t);
	let n = U(this, "deltaMsgObj"), r = U(this, "initialDeltaValue"), i = U(this, "finalDeltaValue"), a = U(this, "deltaBehavior"), o = U(this, "realDelta"), s;
	s = a === "change" ? Math.abs(i - r) === Math.abs(e) : o === Math.abs(e), this.assert(s, "expected " + n + " to " + a + " by " + e, "expected " + n + " to not " + a + " by " + e);
}
I(yf, "assertDelta"), V.addMethod("by", yf), V.addProperty("extensible", function() {
	let e = U(this, "object"), t = e === Object(e) && Object.isExtensible(e);
	this.assert(t, "expected #{this} to be extensible", "expected #{this} to not be extensible");
}), V.addProperty("sealed", function() {
	let e = U(this, "object"), t = e !== Object(e) || Object.isSealed(e);
	this.assert(t, "expected #{this} to be sealed", "expected #{this} to not be sealed");
}), V.addProperty("frozen", function() {
	let e = U(this, "object"), t = e !== Object(e) || Object.isFrozen(e);
	this.assert(t, "expected #{this} to be frozen", "expected #{this} to not be frozen");
}), V.addProperty("finite", function(e) {
	let t = U(this, "object");
	this.assert(typeof t == "number" && isFinite(t), "expected #{this} to be a finite number", "expected #{this} to not be a finite number");
});
function bf(e, t) {
	return e === t ? !0 : typeof t == typeof e ? typeof e != "object" || !e ? e === t : t ? Array.isArray(e) ? Array.isArray(t) ? e.every(function(e) {
		return t.some(function(t) {
			return bf(e, t);
		});
	}) : !1 : e instanceof Date ? t instanceof Date && e.getTime() === t.getTime() : Object.keys(e).every(function(n) {
		let r = e[n], i = t[n];
		return typeof r == "object" && r && i !== null ? bf(r, i) : typeof r == "function" ? r(i) : i === r;
	}) : !1 : !1;
}
I(bf, "compareSubset"), V.addMethod("containSubset", function(e) {
	let t = L(this, "object"), n = Ru.showDiff;
	this.assert(bf(e, t), "expected #{act} to contain subset #{exp}", "expected #{act} to not contain subset #{exp}", e, t, n);
});
function xf(e, t) {
	return new V(e, t);
}
I(xf, "expect"), xf.fail = function(e, t, n, r) {
	throw arguments.length < 2 && (n = e, e = void 0), n ||= "expect.fail()", new z(n, {
		actual: e,
		expected: t,
		operator: r
	}, xf.fail);
};
var Sf = {};
Dl(Sf, {
	Should: () => Tf,
	should: () => wf
});
function Cf() {
	function e() {
		return this instanceof String || this instanceof Number || this instanceof Boolean || typeof Symbol == "function" && this instanceof Symbol || typeof BigInt == "function" && this instanceof BigInt ? new V(this.valueOf(), null, e) : new V(this, null, e);
	}
	I(e, "shouldGetter");
	function t(e) {
		Object.defineProperty(this, "should", {
			value: e,
			enumerable: !0,
			configurable: !0,
			writable: !0
		});
	}
	I(t, "shouldSetter"), Object.defineProperty(Object.prototype, "should", {
		set: t,
		get: e,
		configurable: !0
	});
	let n = {};
	return n.fail = function(e, t, r, i) {
		throw arguments.length < 2 && (r = e, e = void 0), r ||= "should.fail()", new z(r, {
			actual: e,
			expected: t,
			operator: i
		}, n.fail);
	}, n.equal = function(e, t, n) {
		new V(e, n).to.equal(t);
	}, n.Throw = function(e, t, n, r) {
		new V(e, r).to.Throw(t, n);
	}, n.exist = function(e, t) {
		new V(e, t).to.exist;
	}, n.not = {}, n.not.equal = function(e, t, n) {
		new V(e, n).to.not.equal(t);
	}, n.not.Throw = function(e, t, n, r) {
		new V(e, r).to.not.Throw(t, n);
	}, n.not.exist = function(e, t) {
		new V(e, t).to.not.exist;
	}, n.throw = n.Throw, n.not.throw = n.not.Throw, n;
}
I(Cf, "loadShould");
var wf = Cf, Tf = Cf;
function W(e, t) {
	new V(null, null, W, !0).assert(e, t, "[ negation message unavailable ]");
}
I(W, "assert"), W.fail = function(e, t, n, r) {
	throw arguments.length < 2 && (n = e, e = void 0), n ||= "assert.fail()", new z(n, {
		actual: e,
		expected: t,
		operator: r
	}, W.fail);
}, W.isOk = function(e, t) {
	new V(e, t, W.isOk, !0).is.ok;
}, W.isNotOk = function(e, t) {
	new V(e, t, W.isNotOk, !0).is.not.ok;
}, W.equal = function(e, t, n) {
	let r = new V(e, n, W.equal, !0);
	r.assert(t == L(r, "object"), "expected #{this} to equal #{exp}", "expected #{this} to not equal #{act}", t, e, !0);
}, W.notEqual = function(e, t, n) {
	let r = new V(e, n, W.notEqual, !0);
	r.assert(t != L(r, "object"), "expected #{this} to not equal #{exp}", "expected #{this} to equal #{act}", t, e, !0);
}, W.strictEqual = function(e, t, n) {
	new V(e, n, W.strictEqual, !0).to.equal(t);
}, W.notStrictEqual = function(e, t, n) {
	new V(e, n, W.notStrictEqual, !0).to.not.equal(t);
}, W.deepEqual = W.deepStrictEqual = function(e, t, n) {
	new V(e, n, W.deepEqual, !0).to.eql(t);
}, W.notDeepEqual = function(e, t, n) {
	new V(e, n, W.notDeepEqual, !0).to.not.eql(t);
}, W.isAbove = function(e, t, n) {
	new V(e, n, W.isAbove, !0).to.be.above(t);
}, W.isAtLeast = function(e, t, n) {
	new V(e, n, W.isAtLeast, !0).to.be.least(t);
}, W.isBelow = function(e, t, n) {
	new V(e, n, W.isBelow, !0).to.be.below(t);
}, W.isAtMost = function(e, t, n) {
	new V(e, n, W.isAtMost, !0).to.be.most(t);
}, W.isTrue = function(e, t) {
	new V(e, t, W.isTrue, !0).is.true;
}, W.isNotTrue = function(e, t) {
	new V(e, t, W.isNotTrue, !0).to.not.equal(!0);
}, W.isFalse = function(e, t) {
	new V(e, t, W.isFalse, !0).is.false;
}, W.isNotFalse = function(e, t) {
	new V(e, t, W.isNotFalse, !0).to.not.equal(!1);
}, W.isNull = function(e, t) {
	new V(e, t, W.isNull, !0).to.equal(null);
}, W.isNotNull = function(e, t) {
	new V(e, t, W.isNotNull, !0).to.not.equal(null);
}, W.isNaN = function(e, t) {
	new V(e, t, W.isNaN, !0).to.be.NaN;
}, W.isNotNaN = function(e, t) {
	new V(e, t, W.isNotNaN, !0).not.to.be.NaN;
}, W.exists = function(e, t) {
	new V(e, t, W.exists, !0).to.exist;
}, W.notExists = function(e, t) {
	new V(e, t, W.notExists, !0).to.not.exist;
}, W.isUndefined = function(e, t) {
	new V(e, t, W.isUndefined, !0).to.equal(void 0);
}, W.isDefined = function(e, t) {
	new V(e, t, W.isDefined, !0).to.not.equal(void 0);
}, W.isCallable = function(e, t) {
	new V(e, t, W.isCallable, !0).is.callable;
}, W.isNotCallable = function(e, t) {
	new V(e, t, W.isNotCallable, !0).is.not.callable;
}, W.isObject = function(e, t) {
	new V(e, t, W.isObject, !0).to.be.a("object");
}, W.isNotObject = function(e, t) {
	new V(e, t, W.isNotObject, !0).to.not.be.a("object");
}, W.isArray = function(e, t) {
	new V(e, t, W.isArray, !0).to.be.an("array");
}, W.isNotArray = function(e, t) {
	new V(e, t, W.isNotArray, !0).to.not.be.an("array");
}, W.isString = function(e, t) {
	new V(e, t, W.isString, !0).to.be.a("string");
}, W.isNotString = function(e, t) {
	new V(e, t, W.isNotString, !0).to.not.be.a("string");
}, W.isNumber = function(e, t) {
	new V(e, t, W.isNumber, !0).to.be.a("number");
}, W.isNotNumber = function(e, t) {
	new V(e, t, W.isNotNumber, !0).to.not.be.a("number");
}, W.isNumeric = function(e, t) {
	new V(e, t, W.isNumeric, !0).is.numeric;
}, W.isNotNumeric = function(e, t) {
	new V(e, t, W.isNotNumeric, !0).is.not.numeric;
}, W.isFinite = function(e, t) {
	new V(e, t, W.isFinite, !0).to.be.finite;
}, W.isBoolean = function(e, t) {
	new V(e, t, W.isBoolean, !0).to.be.a("boolean");
}, W.isNotBoolean = function(e, t) {
	new V(e, t, W.isNotBoolean, !0).to.not.be.a("boolean");
}, W.typeOf = function(e, t, n) {
	new V(e, n, W.typeOf, !0).to.be.a(t);
}, W.notTypeOf = function(e, t, n) {
	new V(e, n, W.notTypeOf, !0).to.not.be.a(t);
}, W.instanceOf = function(e, t, n) {
	new V(e, n, W.instanceOf, !0).to.be.instanceOf(t);
}, W.notInstanceOf = function(e, t, n) {
	new V(e, n, W.notInstanceOf, !0).to.not.be.instanceOf(t);
}, W.include = function(e, t, n) {
	new V(e, n, W.include, !0).include(t);
}, W.notInclude = function(e, t, n) {
	new V(e, n, W.notInclude, !0).not.include(t);
}, W.deepInclude = function(e, t, n) {
	new V(e, n, W.deepInclude, !0).deep.include(t);
}, W.notDeepInclude = function(e, t, n) {
	new V(e, n, W.notDeepInclude, !0).not.deep.include(t);
}, W.nestedInclude = function(e, t, n) {
	new V(e, n, W.nestedInclude, !0).nested.include(t);
}, W.notNestedInclude = function(e, t, n) {
	new V(e, n, W.notNestedInclude, !0).not.nested.include(t);
}, W.deepNestedInclude = function(e, t, n) {
	new V(e, n, W.deepNestedInclude, !0).deep.nested.include(t);
}, W.notDeepNestedInclude = function(e, t, n) {
	new V(e, n, W.notDeepNestedInclude, !0).not.deep.nested.include(t);
}, W.ownInclude = function(e, t, n) {
	new V(e, n, W.ownInclude, !0).own.include(t);
}, W.notOwnInclude = function(e, t, n) {
	new V(e, n, W.notOwnInclude, !0).not.own.include(t);
}, W.deepOwnInclude = function(e, t, n) {
	new V(e, n, W.deepOwnInclude, !0).deep.own.include(t);
}, W.notDeepOwnInclude = function(e, t, n) {
	new V(e, n, W.notDeepOwnInclude, !0).not.deep.own.include(t);
}, W.match = function(e, t, n) {
	new V(e, n, W.match, !0).to.match(t);
}, W.notMatch = function(e, t, n) {
	new V(e, n, W.notMatch, !0).to.not.match(t);
}, W.property = function(e, t, n) {
	new V(e, n, W.property, !0).to.have.property(t);
}, W.notProperty = function(e, t, n) {
	new V(e, n, W.notProperty, !0).to.not.have.property(t);
}, W.propertyVal = function(e, t, n, r) {
	new V(e, r, W.propertyVal, !0).to.have.property(t, n);
}, W.notPropertyVal = function(e, t, n, r) {
	new V(e, r, W.notPropertyVal, !0).to.not.have.property(t, n);
}, W.deepPropertyVal = function(e, t, n, r) {
	new V(e, r, W.deepPropertyVal, !0).to.have.deep.property(t, n);
}, W.notDeepPropertyVal = function(e, t, n, r) {
	new V(e, r, W.notDeepPropertyVal, !0).to.not.have.deep.property(t, n);
}, W.ownProperty = function(e, t, n) {
	new V(e, n, W.ownProperty, !0).to.have.own.property(t);
}, W.notOwnProperty = function(e, t, n) {
	new V(e, n, W.notOwnProperty, !0).to.not.have.own.property(t);
}, W.ownPropertyVal = function(e, t, n, r) {
	new V(e, r, W.ownPropertyVal, !0).to.have.own.property(t, n);
}, W.notOwnPropertyVal = function(e, t, n, r) {
	new V(e, r, W.notOwnPropertyVal, !0).to.not.have.own.property(t, n);
}, W.deepOwnPropertyVal = function(e, t, n, r) {
	new V(e, r, W.deepOwnPropertyVal, !0).to.have.deep.own.property(t, n);
}, W.notDeepOwnPropertyVal = function(e, t, n, r) {
	new V(e, r, W.notDeepOwnPropertyVal, !0).to.not.have.deep.own.property(t, n);
}, W.nestedProperty = function(e, t, n) {
	new V(e, n, W.nestedProperty, !0).to.have.nested.property(t);
}, W.notNestedProperty = function(e, t, n) {
	new V(e, n, W.notNestedProperty, !0).to.not.have.nested.property(t);
}, W.nestedPropertyVal = function(e, t, n, r) {
	new V(e, r, W.nestedPropertyVal, !0).to.have.nested.property(t, n);
}, W.notNestedPropertyVal = function(e, t, n, r) {
	new V(e, r, W.notNestedPropertyVal, !0).to.not.have.nested.property(t, n);
}, W.deepNestedPropertyVal = function(e, t, n, r) {
	new V(e, r, W.deepNestedPropertyVal, !0).to.have.deep.nested.property(t, n);
}, W.notDeepNestedPropertyVal = function(e, t, n, r) {
	new V(e, r, W.notDeepNestedPropertyVal, !0).to.not.have.deep.nested.property(t, n);
}, W.lengthOf = function(e, t, n) {
	new V(e, n, W.lengthOf, !0).to.have.lengthOf(t);
}, W.hasAnyKeys = function(e, t, n) {
	new V(e, n, W.hasAnyKeys, !0).to.have.any.keys(t);
}, W.hasAllKeys = function(e, t, n) {
	new V(e, n, W.hasAllKeys, !0).to.have.all.keys(t);
}, W.containsAllKeys = function(e, t, n) {
	new V(e, n, W.containsAllKeys, !0).to.contain.all.keys(t);
}, W.doesNotHaveAnyKeys = function(e, t, n) {
	new V(e, n, W.doesNotHaveAnyKeys, !0).to.not.have.any.keys(t);
}, W.doesNotHaveAllKeys = function(e, t, n) {
	new V(e, n, W.doesNotHaveAllKeys, !0).to.not.have.all.keys(t);
}, W.hasAnyDeepKeys = function(e, t, n) {
	new V(e, n, W.hasAnyDeepKeys, !0).to.have.any.deep.keys(t);
}, W.hasAllDeepKeys = function(e, t, n) {
	new V(e, n, W.hasAllDeepKeys, !0).to.have.all.deep.keys(t);
}, W.containsAllDeepKeys = function(e, t, n) {
	new V(e, n, W.containsAllDeepKeys, !0).to.contain.all.deep.keys(t);
}, W.doesNotHaveAnyDeepKeys = function(e, t, n) {
	new V(e, n, W.doesNotHaveAnyDeepKeys, !0).to.not.have.any.deep.keys(t);
}, W.doesNotHaveAllDeepKeys = function(e, t, n) {
	new V(e, n, W.doesNotHaveAllDeepKeys, !0).to.not.have.all.deep.keys(t);
}, W.throws = function(e, t, n, r) {
	return (typeof t == "string" || t instanceof RegExp) && (n = t, t = null), L(new V(e, r, W.throws, !0).to.throw(t, n), "object");
}, W.doesNotThrow = function(e, t, n, r) {
	(typeof t == "string" || t instanceof RegExp) && (n = t, t = null), new V(e, r, W.doesNotThrow, !0).to.not.throw(t, n);
}, W.operator = function(e, t, n, r) {
	let i;
	switch (t) {
		case "==":
			i = e == n;
			break;
		case "===":
			i = e === n;
			break;
		case ">":
			i = e > n;
			break;
		case ">=":
			i = e >= n;
			break;
		case "<":
			i = e < n;
			break;
		case "<=":
			i = e <= n;
			break;
		case "!=":
			i = e != n;
			break;
		case "!==":
			i = e !== n;
			break;
		default: throw r &&= r + ": ", new z(r + "Invalid operator \"" + t + "\"", void 0, W.operator);
	}
	let a = new V(i, r, W.operator, !0);
	a.assert(L(a, "object") === !0, "expected " + B(e) + " to be " + t + " " + B(n), "expected " + B(e) + " to not be " + t + " " + B(n));
}, W.closeTo = function(e, t, n, r) {
	new V(e, r, W.closeTo, !0).to.be.closeTo(t, n);
}, W.approximately = function(e, t, n, r) {
	new V(e, r, W.approximately, !0).to.be.approximately(t, n);
}, W.sameMembers = function(e, t, n) {
	new V(e, n, W.sameMembers, !0).to.have.same.members(t);
}, W.notSameMembers = function(e, t, n) {
	new V(e, n, W.notSameMembers, !0).to.not.have.same.members(t);
}, W.sameDeepMembers = function(e, t, n) {
	new V(e, n, W.sameDeepMembers, !0).to.have.same.deep.members(t);
}, W.notSameDeepMembers = function(e, t, n) {
	new V(e, n, W.notSameDeepMembers, !0).to.not.have.same.deep.members(t);
}, W.sameOrderedMembers = function(e, t, n) {
	new V(e, n, W.sameOrderedMembers, !0).to.have.same.ordered.members(t);
}, W.notSameOrderedMembers = function(e, t, n) {
	new V(e, n, W.notSameOrderedMembers, !0).to.not.have.same.ordered.members(t);
}, W.sameDeepOrderedMembers = function(e, t, n) {
	new V(e, n, W.sameDeepOrderedMembers, !0).to.have.same.deep.ordered.members(t);
}, W.notSameDeepOrderedMembers = function(e, t, n) {
	new V(e, n, W.notSameDeepOrderedMembers, !0).to.not.have.same.deep.ordered.members(t);
}, W.includeMembers = function(e, t, n) {
	new V(e, n, W.includeMembers, !0).to.include.members(t);
}, W.notIncludeMembers = function(e, t, n) {
	new V(e, n, W.notIncludeMembers, !0).to.not.include.members(t);
}, W.includeDeepMembers = function(e, t, n) {
	new V(e, n, W.includeDeepMembers, !0).to.include.deep.members(t);
}, W.notIncludeDeepMembers = function(e, t, n) {
	new V(e, n, W.notIncludeDeepMembers, !0).to.not.include.deep.members(t);
}, W.includeOrderedMembers = function(e, t, n) {
	new V(e, n, W.includeOrderedMembers, !0).to.include.ordered.members(t);
}, W.notIncludeOrderedMembers = function(e, t, n) {
	new V(e, n, W.notIncludeOrderedMembers, !0).to.not.include.ordered.members(t);
}, W.includeDeepOrderedMembers = function(e, t, n) {
	new V(e, n, W.includeDeepOrderedMembers, !0).to.include.deep.ordered.members(t);
}, W.notIncludeDeepOrderedMembers = function(e, t, n) {
	new V(e, n, W.notIncludeDeepOrderedMembers, !0).to.not.include.deep.ordered.members(t);
}, W.oneOf = function(e, t, n) {
	new V(e, n, W.oneOf, !0).to.be.oneOf(t);
}, W.isIterable = function(e, t) {
	if (e == null || !e[Symbol.iterator]) throw t = t ? `${t} expected ${B(e)} to be an iterable` : `expected ${B(e)} to be an iterable`, new z(t, void 0, W.isIterable);
}, W.changes = function(e, t, n, r) {
	arguments.length === 3 && typeof t == "function" && (r = n, n = null), new V(e, r, W.changes, !0).to.change(t, n);
}, W.changesBy = function(e, t, n, r, i) {
	if (arguments.length === 4 && typeof t == "function") {
		let e = r;
		r = n, i = e;
	} else arguments.length === 3 && (r = n, n = null);
	new V(e, i, W.changesBy, !0).to.change(t, n).by(r);
}, W.doesNotChange = function(e, t, n, r) {
	return arguments.length === 3 && typeof t == "function" && (r = n, n = null), new V(e, r, W.doesNotChange, !0).to.not.change(t, n);
}, W.changesButNotBy = function(e, t, n, r, i) {
	if (arguments.length === 4 && typeof t == "function") {
		let e = r;
		r = n, i = e;
	} else arguments.length === 3 && (r = n, n = null);
	new V(e, i, W.changesButNotBy, !0).to.change(t, n).but.not.by(r);
}, W.increases = function(e, t, n, r) {
	return arguments.length === 3 && typeof t == "function" && (r = n, n = null), new V(e, r, W.increases, !0).to.increase(t, n);
}, W.increasesBy = function(e, t, n, r, i) {
	if (arguments.length === 4 && typeof t == "function") {
		let e = r;
		r = n, i = e;
	} else arguments.length === 3 && (r = n, n = null);
	new V(e, i, W.increasesBy, !0).to.increase(t, n).by(r);
}, W.doesNotIncrease = function(e, t, n, r) {
	return arguments.length === 3 && typeof t == "function" && (r = n, n = null), new V(e, r, W.doesNotIncrease, !0).to.not.increase(t, n);
}, W.increasesButNotBy = function(e, t, n, r, i) {
	if (arguments.length === 4 && typeof t == "function") {
		let e = r;
		r = n, i = e;
	} else arguments.length === 3 && (r = n, n = null);
	new V(e, i, W.increasesButNotBy, !0).to.increase(t, n).but.not.by(r);
}, W.decreases = function(e, t, n, r) {
	return arguments.length === 3 && typeof t == "function" && (r = n, n = null), new V(e, r, W.decreases, !0).to.decrease(t, n);
}, W.decreasesBy = function(e, t, n, r, i) {
	if (arguments.length === 4 && typeof t == "function") {
		let e = r;
		r = n, i = e;
	} else arguments.length === 3 && (r = n, n = null);
	new V(e, i, W.decreasesBy, !0).to.decrease(t, n).by(r);
}, W.doesNotDecrease = function(e, t, n, r) {
	return arguments.length === 3 && typeof t == "function" && (r = n, n = null), new V(e, r, W.doesNotDecrease, !0).to.not.decrease(t, n);
}, W.doesNotDecreaseBy = function(e, t, n, r, i) {
	if (arguments.length === 4 && typeof t == "function") {
		let e = r;
		r = n, i = e;
	} else arguments.length === 3 && (r = n, n = null);
	return new V(e, i, W.doesNotDecreaseBy, !0).to.not.decrease(t, n).by(r);
}, W.decreasesButNotBy = function(e, t, n, r, i) {
	if (arguments.length === 4 && typeof t == "function") {
		let e = r;
		r = n, i = e;
	} else arguments.length === 3 && (r = n, n = null);
	new V(e, i, W.decreasesButNotBy, !0).to.decrease(t, n).but.not.by(r);
}, W.ifError = function(e) {
	if (e) throw e;
}, W.isExtensible = function(e, t) {
	new V(e, t, W.isExtensible, !0).to.be.extensible;
}, W.isNotExtensible = function(e, t) {
	new V(e, t, W.isNotExtensible, !0).to.not.be.extensible;
}, W.isSealed = function(e, t) {
	new V(e, t, W.isSealed, !0).to.be.sealed;
}, W.isNotSealed = function(e, t) {
	new V(e, t, W.isNotSealed, !0).to.not.be.sealed;
}, W.isFrozen = function(e, t) {
	new V(e, t, W.isFrozen, !0).to.be.frozen;
}, W.isNotFrozen = function(e, t) {
	new V(e, t, W.isNotFrozen, !0).to.not.be.frozen;
}, W.isEmpty = function(e, t) {
	new V(e, t, W.isEmpty, !0).to.be.empty;
}, W.isNotEmpty = function(e, t) {
	new V(e, t, W.isNotEmpty, !0).to.not.be.empty;
}, W.containsSubset = function(e, t, n) {
	new V(e, n).to.containSubset(t);
}, W.doesNotContainSubset = function(e, t, n) {
	new V(e, n).to.not.containSubset(t);
};
for (let [e, t] of [
	["isOk", "ok"],
	["isNotOk", "notOk"],
	["throws", "throw"],
	["throws", "Throw"],
	["isExtensible", "extensible"],
	["isNotExtensible", "notExtensible"],
	["isSealed", "sealed"],
	["isNotSealed", "notSealed"],
	["isFrozen", "frozen"],
	["isNotFrozen", "notFrozen"],
	["isEmpty", "empty"],
	["isNotEmpty", "notEmpty"],
	["isCallable", "isFunction"],
	["isNotCallable", "isNotFunction"],
	["containsSubset", "containSubset"]
]) W[t] = W[e];
var Ef = [];
function Df(e) {
	let t = {
		use: Df,
		AssertionError: z,
		util: Ol,
		config: Ru,
		expect: xf,
		assert: W,
		Assertion: V,
		...Sf
	};
	return ~Ef.indexOf(e) || (e(t, Ol), Ef.push(e)), t;
}
I(Df, "use");
var Of = {};
f(Of, {
	toAppearAfter: () => ng,
	toAppearBefore: () => tg,
	toBeChecked: () => Fh,
	toBeDisabled: () => hh,
	toBeEmpty: () => Sm,
	toBeEmptyDOMElement: () => Cm,
	toBeEnabled: () => gh,
	toBeInTheDOM: () => bm,
	toBeInTheDocument: () => xm,
	toBeInvalid: () => kh,
	toBePartiallyChecked: () => zh,
	toBePartiallyPressed: () => Gh,
	toBePressed: () => Wh,
	toBeRequired: () => wh,
	toBeValid: () => Ah,
	toBeVisible: () => oh,
	toContainElement: () => Tm,
	toContainHTML: () => Dm,
	toHaveAccessibleDescription: () => km,
	toHaveAccessibleErrorMessage: () => Mm,
	toHaveAccessibleName: () => Rm,
	toHaveAttribute: () => Vm,
	toHaveClass: () => Gm,
	toHaveDescription: () => Bh,
	toHaveDisplayValue: () => Mh,
	toHaveErrorMessage: () => Vh,
	toHaveFocus: () => Zm,
	toHaveFormValues: () => nh,
	toHaveRole: () => Pm,
	toHaveSelection: () => Uh,
	toHaveStyle: () => Xm,
	toHaveTextContent: () => Om,
	toHaveValue: () => jh
});
var kf = m(Fo(), 1);
function Af(e) {
	Object.defineProperty(e, "__esModule", {
		value: !0,
		configurable: !0
	});
}
function jf(e, t, n, r) {
	Object.defineProperty(e, t, {
		get: n,
		set: r,
		enumerable: !0,
		configurable: !0
	});
}
var Mf = {};
Af(Mf), jf(Mf, "default", () => Nf);
var Nf = class extends Error {
	constructor(e, t, n, r, i) {
		super(e + ":" + n + ":" + r + ": " + t), this.reason = t, this.filename = e, this.line = n, this.column = r, this.source = i;
	}
}, Pf = {};
Af(Pf), jf(Pf, "default", () => Ff);
var Ff = class {
	constructor(e, t, n) {
		this.start = e, this.end = t, this.source = n;
	}
};
jf({}, "CssTypes", () => G);
var G;
(function(e) {
	e.stylesheet = "stylesheet", e.rule = "rule", e.declaration = "declaration", e.comment = "comment", e.container = "container", e.charset = "charset", e.document = "document", e.customMedia = "custom-media", e.fontFace = "font-face", e.host = "host", e.import = "import", e.keyframes = "keyframes", e.keyframe = "keyframe", e.layer = "layer", e.media = "media", e.namespace = "namespace", e.page = "page", e.startingStyle = "starting-style", e.supports = "supports";
})(G ||= {});
var If = /\/\*[^]*?(?:\*\/|$)/g, Lf = (e, t) => {
	t ||= {};
	let n = 1, r = 1;
	function i(e) {
		let t = e.match(/\n/g);
		t && (n += t.length);
		let i = e.lastIndexOf("\n");
		r = ~i ? e.length - i : r + e.length;
	}
	function a() {
		let e = {
			line: n,
			column: r
		};
		return function(i) {
			return i.position = new Ff(e, {
				line: n,
				column: r
			}, t?.source || ""), p(), i;
		};
	}
	let o = [];
	function s(i) {
		let a = new Nf(t?.source || "", i, n, r, e);
		if (t?.silent) o.push(a);
		else throw a;
	}
	function c() {
		let e = d();
		return {
			type: G.stylesheet,
			stylesheet: {
				source: t?.source,
				rules: e,
				parsingErrors: o
			}
		};
	}
	function l() {
		return f(/^{\s*/);
	}
	function u() {
		return f(/^}/);
	}
	function d() {
		let t, n = [];
		for (p(), m(n); e.length && e.charAt(0) !== "}" && (t = ce() || le());) t && (n.push(t), m(n));
		return n;
	}
	function f(t) {
		let n = t.exec(e);
		if (!n) return;
		let r = n[0];
		return i(r), e = e.slice(r.length), n;
	}
	function p() {
		f(/^\s*/);
	}
	function m(e) {
		let t;
		for (e ||= []; t = h();) t && e.push(t);
		return e;
	}
	function h() {
		let t = a();
		if (e.charAt(0) !== "/" || e.charAt(1) !== "*") return;
		let n = f(/^\/\*[^]*?\*\//);
		return n ? t({
			type: G.comment,
			comment: n[0].slice(2, -2)
		}) : s("End of comment missing");
	}
	function g(e, t, n) {
		let r = t + 1, i = !1, a = e.indexOf(")", r);
		for (; !i && a !== -1;) {
			let t = e.indexOf("(", r);
			t !== -1 && t < a ? (r = g(e, t + 1, n + 1) + 1, a = e.indexOf(")", r)) : i = !0;
		}
		return i && a !== -1 ? a : -1;
	}
	function _() {
		let e = f(/^([^{]+)/);
		if (!e) return;
		let t = Rf(e[0]).replace(If, "");
		if (t.indexOf(",") === -1) return [t];
		let n = 0, r = t.indexOf("(", n);
		for (; r !== -1;) {
			let e = g(t, r, 0);
			if (e === -1) break;
			n = e + 1, t = t.substring(0, r) + t.substring(r, e).replace(/,/g, "‌") + t.substring(e), r = t.indexOf("(", n);
		}
		return t = t.replace(/("|')(?:\\\1|.)*?\1/g, (e) => e.replace(/,/g, "‌")), t.split(",").map((e) => Rf(e.replace(/\u200C/g, ",")));
	}
	function v() {
		let e = a(), t = f(/^(\*?[-#/*\\\w]+(\[[0-9a-z_-]+\])?)\s*/);
		if (!t) return;
		let n = Rf(t[0]);
		if (!f(/^:\s*/)) return s("property missing ':'");
		let r = f(/^((?:'(?:\\'|.)*?'|"(?:\\"|.)*?"|\([^)]*?\)|[^};])+)/), i = e({
			type: G.declaration,
			property: n.replace(If, ""),
			value: r ? Rf(r[0]).replace(If, "") : ""
		});
		return f(/^[;\s]*/), i;
	}
	function y() {
		let e = [];
		if (!l()) return s("missing '{'");
		m(e);
		let t;
		for (; t = v();) t && (e.push(t), m(e));
		return u() ? e : s("missing '}'");
	}
	function b() {
		let e, t = [], n = a();
		for (; e = f(/^((\d+\.\d+|\.\d+|\d+)%?|[a-z]+)\s*/);) t.push(e[1]), f(/^,\s*/);
		if (t.length) return n({
			type: G.keyframe,
			values: t,
			declarations: y() || []
		});
	}
	function x() {
		let e = a(), t = f(/^@([-\w]+)?keyframes\s*/);
		if (!t) return;
		let n = t[1], r = f(/^([-\w]+)\s*/);
		if (!r) return s("@keyframes missing name");
		let i = r[1];
		if (!l()) return s("@keyframes missing '{'");
		let o, c = m();
		for (; o = b();) c.push(o), c = c.concat(m());
		return u() ? e({
			type: G.keyframes,
			name: i,
			vendor: n,
			keyframes: c
		}) : s("@keyframes missing '}'");
	}
	function S() {
		let e = a(), t = f(/^@supports *([^{]+)/);
		if (!t) return;
		let n = Rf(t[1]);
		if (!l()) return s("@supports missing '{'");
		let r = m().concat(d());
		return u() ? e({
			type: G.supports,
			supports: n,
			rules: r
		}) : s("@supports missing '}'");
	}
	function ee() {
		let e = a();
		if (!f(/^@host\s*/)) return;
		if (!l()) return s("@host missing '{'");
		let t = m().concat(d());
		return u() ? e({
			type: G.host,
			rules: t
		}) : s("@host missing '}'");
	}
	function C() {
		let e = a(), t = f(/^@container *([^{]+)/);
		if (!t) return;
		let n = Rf(t[1]);
		if (!l()) return s("@container missing '{'");
		let r = m().concat(d());
		return u() ? e({
			type: G.container,
			container: n,
			rules: r
		}) : s("@container missing '}'");
	}
	function w() {
		let e = a(), t = f(/^@layer *([^{;@]+)/);
		if (!t) return;
		let n = Rf(t[1]);
		if (!l()) return f(/^[;\s]*/), e({
			type: G.layer,
			layer: n
		});
		let r = m().concat(d());
		return u() ? e({
			type: G.layer,
			layer: n,
			rules: r
		}) : s("@layer missing '}'");
	}
	function te() {
		let e = a(), t = f(/^@media *([^{]+)/);
		if (!t) return;
		let n = Rf(t[1]);
		if (!l()) return s("@media missing '{'");
		let r = m().concat(d());
		return u() ? e({
			type: G.media,
			media: n,
			rules: r
		}) : s("@media missing '}'");
	}
	function T() {
		let e = a(), t = f(/^@custom-media\s+(--\S+)\s*([^{;\s][^{;]*);/);
		if (t) return e({
			type: G.customMedia,
			name: Rf(t[1]),
			media: Rf(t[2])
		});
	}
	function ne() {
		let e = a();
		if (!f(/^@page */)) return;
		let t = _() || [];
		if (!l()) return s("@page missing '{'");
		let n = m(), r;
		for (; r = v();) n.push(r), n = n.concat(m());
		return u() ? e({
			type: G.page,
			selectors: t,
			declarations: n
		}) : s("@page missing '}'");
	}
	function re() {
		let e = a(), t = f(/^@([-\w]+)?document *([^{]+)/);
		if (!t) return;
		let n = Rf(t[1]), r = Rf(t[2]);
		if (!l()) return s("@document missing '{'");
		let i = m().concat(d());
		return u() ? e({
			type: G.document,
			document: r,
			vendor: n,
			rules: i
		}) : s("@document missing '}'");
	}
	function ie() {
		let e = a();
		if (!f(/^@font-face\s*/)) return;
		if (!l()) return s("@font-face missing '{'");
		let t = m(), n;
		for (; n = v();) t.push(n), t = t.concat(m());
		return u() ? e({
			type: G.fontFace,
			declarations: t
		}) : s("@font-face missing '}'");
	}
	function ae() {
		let e = a();
		if (!f(/^@starting-style\s*/)) return;
		if (!l()) return s("@starting-style missing '{'");
		let t = m().concat(d());
		return u() ? e({
			type: G.startingStyle,
			rules: t
		}) : s("@starting-style missing '}'");
	}
	let E = se("import"), oe = se("charset"), D = se("namespace");
	function se(e) {
		let t = RegExp("^@" + e + "\\s*((?::?[^;'\"]|\"(?:\\\\\"|[^\"])*?\"|'(?:\\\\'|[^'])*?')+)(?:;|$)");
		return function() {
			let n = a(), r = f(t);
			if (!r) return;
			let i = { type: e };
			return i[e] = r[1].trim(), n(i);
		};
	}
	function ce() {
		if (e[0] === "@") return x() || te() || T() || S() || E() || oe() || D() || re() || ne() || ee() || ie() || C() || ae() || w();
	}
	function le() {
		let e = a(), t = _();
		return t ? (m(), e({
			type: G.rule,
			selectors: t,
			declarations: y() || []
		})) : s("selector missing");
	}
	return zf(c());
};
function Rf(e) {
	return e ? e.trim() : "";
}
function zf(e, t) {
	let n = e && typeof e.type == "string", r = n ? e : t;
	for (let t in e) {
		let n = e[t];
		Array.isArray(n) ? n.forEach((e) => {
			zf(e, r);
		}) : n && typeof n == "object" && zf(n, r);
	}
	return n && Object.defineProperty(e, "parent", {
		configurable: !0,
		writable: !0,
		enumerable: !1,
		value: t || null
	}), e;
}
var Bf = Lf, Vf = Object.prototype.toString;
function Hf(e) {
	return typeof e == "function" || Vf.call(e) === "[object Function]";
}
function Uf(e) {
	var t = Number(e);
	return isNaN(t) ? 0 : t === 0 || !isFinite(t) ? t : (t > 0 ? 1 : -1) * Math.floor(Math.abs(t));
}
var Wf = 2 ** 53 - 1;
function Gf(e) {
	var t = Uf(e);
	return Math.min(Math.max(t, 0), Wf);
}
function Kf(e, t) {
	var n = Array, r = Object(e);
	if (e == null) throw TypeError("Array.from requires an array-like object - not null or undefined");
	if (typeof t < "u" && !Hf(t)) throw TypeError("Array.from: when provided, the second argument must be a function");
	for (var i = Gf(r.length), a = Hf(n) ? Object(new n(i)) : Array(i), o = 0, s; o < i;) s = r[o], t ? a[o] = t(s, o) : a[o] = s, o += 1;
	return a.length = i, a;
}
function qf(e) {
	"@babel/helpers - typeof";
	return qf = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, qf(e);
}
function Jf(e, t) {
	if (!(e instanceof t)) throw TypeError("Cannot call a class as a function");
}
function Yf(e, t) {
	for (var n = 0; n < t.length; n++) {
		var r = t[n];
		r.enumerable = r.enumerable || !1, r.configurable = !0, "value" in r && (r.writable = !0), Object.defineProperty(e, Qf(r.key), r);
	}
}
function Xf(e, t, n) {
	return t && Yf(e.prototype, t), n && Yf(e, n), Object.defineProperty(e, "prototype", { writable: !1 }), e;
}
function Zf(e, t, n) {
	return t = Qf(t), t in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function Qf(e) {
	var t = $f(e, "string");
	return qf(t) === "symbol" ? t : String(t);
}
function $f(e, t) {
	if (qf(e) !== "object" || e === null) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (qf(r) !== "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
var ep = (function() {
	function e() {
		var t = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : [];
		Jf(this, e), Zf(this, "items", void 0), this.items = t;
	}
	return Xf(e, [
		{
			key: "add",
			value: function(e) {
				return this.has(e) === !1 && this.items.push(e), this;
			}
		},
		{
			key: "clear",
			value: function() {
				this.items = [];
			}
		},
		{
			key: "delete",
			value: function(e) {
				var t = this.items.length;
				return this.items = this.items.filter(function(t) {
					return t !== e;
				}), t !== this.items.length;
			}
		},
		{
			key: "forEach",
			value: function(e) {
				var t = this;
				this.items.forEach(function(n) {
					e(n, n, t);
				});
			}
		},
		{
			key: "has",
			value: function(e) {
				return this.items.indexOf(e) !== -1;
			}
		},
		{
			key: "size",
			get: function() {
				return this.items.length;
			}
		}
	]), e;
})(), tp = typeof Set > "u" ? Set : ep;
function K(e) {
	return e.localName ?? e.tagName.toLowerCase();
}
var np = {
	article: "article",
	aside: "complementary",
	button: "button",
	datalist: "listbox",
	dd: "definition",
	details: "group",
	dialog: "dialog",
	dt: "term",
	fieldset: "group",
	figure: "figure",
	form: "form",
	footer: "contentinfo",
	h1: "heading",
	h2: "heading",
	h3: "heading",
	h4: "heading",
	h5: "heading",
	h6: "heading",
	header: "banner",
	hr: "separator",
	html: "document",
	legend: "legend",
	li: "listitem",
	math: "math",
	main: "main",
	menu: "list",
	nav: "navigation",
	ol: "list",
	optgroup: "group",
	option: "option",
	output: "status",
	progress: "progressbar",
	section: "region",
	summary: "button",
	table: "table",
	tbody: "rowgroup",
	textarea: "textbox",
	tfoot: "rowgroup",
	td: "cell",
	th: "columnheader",
	thead: "rowgroup",
	tr: "row",
	ul: "list"
}, rp = {
	caption: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
	code: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
	deletion: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
	emphasis: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
	generic: /* @__PURE__ */ new Set([
		"aria-label",
		"aria-labelledby",
		"aria-roledescription"
	]),
	insertion: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
	none: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
	paragraph: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
	presentation: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
	strong: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
	subscript: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
	superscript: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"])
};
function ip(e, t) {
	return [
		"aria-atomic",
		"aria-busy",
		"aria-controls",
		"aria-current",
		"aria-description",
		"aria-describedby",
		"aria-details",
		"aria-dropeffect",
		"aria-flowto",
		"aria-grabbed",
		"aria-hidden",
		"aria-keyshortcuts",
		"aria-label",
		"aria-labelledby",
		"aria-live",
		"aria-owns",
		"aria-relevant",
		"aria-roledescription"
	].some(function(n) {
		var r;
		return e.hasAttribute(n) && !((r = rp[t]) != null && r.has(n));
	});
}
function ap(e, t) {
	return ip(e, t);
}
function op(e) {
	var t = cp(e);
	if (t === null || lp.indexOf(t) !== -1) {
		var n = sp(e);
		if (lp.indexOf(t || "") === -1 || ap(e, n || "")) return n;
	}
	return t;
}
function sp(e) {
	var t = np[K(e)];
	if (t !== void 0) return t;
	switch (K(e)) {
		case "a":
		case "area":
		case "link":
			if (e.hasAttribute("href")) return "link";
			break;
		case "img": return e.getAttribute("alt") === "" && !ap(e, "img") ? "presentation" : "img";
		case "input":
			var n = e.type;
			switch (n) {
				case "button":
				case "image":
				case "reset":
				case "submit": return "button";
				case "checkbox":
				case "radio": return n;
				case "range": return "slider";
				case "email":
				case "tel":
				case "text":
				case "url": return e.hasAttribute("list") ? "combobox" : "textbox";
				case "search": return e.hasAttribute("list") ? "combobox" : "searchbox";
				case "number": return "spinbutton";
				default: return null;
			}
		case "select": return e.hasAttribute("multiple") || e.size > 1 ? "listbox" : "combobox";
	}
	return null;
}
function cp(e) {
	var t = e.getAttribute("role");
	if (t !== null) {
		var n = t.trim().split(" ")[0];
		if (n.length > 0) return n;
	}
	return null;
}
var lp = ["presentation", "none"];
function q(e) {
	return e !== null && e.nodeType === e.ELEMENT_NODE;
}
function up(e) {
	return q(e) && K(e) === "caption";
}
function dp(e) {
	return q(e) && K(e) === "input";
}
function fp(e) {
	return q(e) && K(e) === "optgroup";
}
function pp(e) {
	return q(e) && K(e) === "select";
}
function mp(e) {
	return q(e) && K(e) === "table";
}
function hp(e) {
	return q(e) && K(e) === "textarea";
}
function gp(e) {
	var t = (e.ownerDocument === null ? e : e.ownerDocument).defaultView;
	if (t === null) throw TypeError("no window available");
	return t;
}
function _p(e) {
	return q(e) && K(e) === "fieldset";
}
function vp(e) {
	return q(e) && K(e) === "legend";
}
function yp(e) {
	return q(e) && K(e) === "slot";
}
function bp(e) {
	return q(e) && e.ownerSVGElement !== void 0;
}
function xp(e) {
	return q(e) && K(e) === "svg";
}
function Sp(e) {
	return bp(e) && K(e) === "title";
}
function Cp(e, t) {
	if (q(e) && e.hasAttribute(t)) {
		var n = e.getAttribute(t).split(" "), r = e.getRootNode ? e.getRootNode() : e.ownerDocument;
		return n.map(function(e) {
			return r.getElementById(e);
		}).filter(function(e) {
			return e !== null;
		});
	}
	return [];
}
function wp(e, t) {
	return q(e) ? t.indexOf(op(e)) !== -1 : !1;
}
function Tp(e) {
	return e.trim().replace(/\s\s+/g, " ");
}
function Ep(e, t) {
	if (!q(e)) return !1;
	if (e.hasAttribute("hidden") || e.getAttribute("aria-hidden") === "true") return !0;
	var n = t(e);
	return n.getPropertyValue("display") === "none" || n.getPropertyValue("visibility") === "hidden";
}
function Dp(e) {
	return wp(e, [
		"button",
		"combobox",
		"listbox",
		"textbox"
	]) || Op(e, "range");
}
function Op(e, t) {
	if (!q(e)) return !1;
	if (t === "range") return wp(e, [
		"meter",
		"progressbar",
		"scrollbar",
		"slider",
		"spinbutton"
	]);
	throw TypeError(`No knowledge about abstract role '${t}'. This is likely a bug :(`);
}
function kp(e, t) {
	var n = Kf(e.querySelectorAll(t));
	return Cp(e, "aria-owns").forEach(function(e) {
		n.push.apply(n, Kf(e.querySelectorAll(t)));
	}), n;
}
function Ap(e) {
	return pp(e) ? e.selectedOptions || kp(e, "[selected]") : kp(e, "[aria-selected=\"true\"]");
}
function jp(e) {
	return wp(e, lp);
}
function Mp(e) {
	return up(e);
}
function Np(e) {
	return wp(e, [
		"button",
		"cell",
		"checkbox",
		"columnheader",
		"gridcell",
		"heading",
		"label",
		"legend",
		"link",
		"menuitem",
		"menuitemcheckbox",
		"menuitemradio",
		"option",
		"radio",
		"row",
		"rowheader",
		"switch",
		"tab",
		"tooltip",
		"treeitem"
	]);
}
function Pp(e) {
	return !1;
}
function Fp(e) {
	return dp(e) || hp(e) ? e.value : e.textContent || "";
}
function Ip(e) {
	var t = e.getPropertyValue("content");
	return /^["'].*["']$/.test(t) ? t.slice(1, -1) : "";
}
function Lp(e) {
	var t = K(e);
	return t === "button" || t === "input" && e.getAttribute("type") !== "hidden" || t === "meter" || t === "output" || t === "progress" || t === "select" || t === "textarea";
}
function Rp(e) {
	if (Lp(e)) return e;
	var t = null;
	return e.childNodes.forEach(function(e) {
		if (t === null && q(e)) {
			var n = Rp(e);
			n !== null && (t = n);
		}
	}), t;
}
function zp(e) {
	if (e.control !== void 0) return e.control;
	var t = e.getAttribute("for");
	return t === null ? Rp(e) : e.ownerDocument.getElementById(t);
}
function Bp(e) {
	var t = e.labels;
	if (t === null) return t;
	if (t !== void 0) return Kf(t);
	if (!Lp(e)) return null;
	var n = e.ownerDocument;
	return Kf(n.querySelectorAll("label")).filter(function(t) {
		return zp(t) === e;
	});
}
function Vp(e) {
	var t = e.assignedNodes();
	return t.length === 0 ? Kf(e.childNodes) : t;
}
function Hp(e) {
	var t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {}, n = new tp(), r = gp(e), i = t.compute, a = i === void 0 ? "name" : i, o = t.computedStyleSupportsPseudoElements, s = o === void 0 ? t.getComputedStyle !== void 0 : o, c = t.getComputedStyle, l = c === void 0 ? r.getComputedStyle.bind(r) : c, u = t.hidden, d = u !== void 0 && u;
	function f(e, t) {
		var n = "";
		if (q(e) && s && (n = `${Ip(l(e, "::before"))} ${n}`), (yp(e) ? Vp(e) : Kf(e.childNodes).concat(Cp(e, "aria-owns"))).forEach(function(e) {
			var r = g(e, {
				isEmbeddedInLabel: t.isEmbeddedInLabel,
				isReferenced: !1,
				recursion: !0
			}), i = (q(e) ? l(e).getPropertyValue("display") : "inline") === "inline" ? "" : " ";
			n += `${i}${r}${i}`;
		}), q(e) && s) {
			var r = Ip(l(e, "::after"));
			n = `${n} ${r}`;
		}
		return n.trim();
	}
	function p(e, t) {
		var r = e.getAttributeNode(t);
		return r !== null && !n.has(r) && r.value.trim() !== "" ? (n.add(r), r.value) : null;
	}
	function m(e) {
		return q(e) ? p(e, "title") : null;
	}
	function h(e) {
		if (!q(e)) return null;
		if (_p(e)) {
			n.add(e);
			for (var t = Kf(e.childNodes), r = 0; r < t.length; r += 1) {
				var i = t[r];
				if (vp(i)) return g(i, {
					isEmbeddedInLabel: !1,
					isReferenced: !1,
					recursion: !1
				});
			}
		} else if (mp(e)) {
			n.add(e);
			for (var a = Kf(e.childNodes), o = 0; o < a.length; o += 1) {
				var s = a[o];
				if (up(s)) return g(s, {
					isEmbeddedInLabel: !1,
					isReferenced: !1,
					recursion: !1
				});
			}
		} else if (xp(e)) {
			n.add(e);
			for (var c = Kf(e.childNodes), l = 0; l < c.length; l += 1) {
				var u = c[l];
				if (Sp(u)) return u.textContent;
			}
			return null;
		} else if (K(e) === "img" || K(e) === "area") {
			var d = p(e, "alt");
			if (d !== null) return d;
		} else if (fp(e)) {
			var m = p(e, "label");
			if (m !== null) return m;
		}
		if (dp(e) && (e.type === "button" || e.type === "submit" || e.type === "reset")) {
			var h = p(e, "value");
			if (h !== null) return h;
			if (e.type === "submit") return "Submit";
			if (e.type === "reset") return "Reset";
		}
		var _ = Bp(e);
		if (_ !== null && _.length !== 0) return n.add(e), Kf(_).map(function(e) {
			return g(e, {
				isEmbeddedInLabel: !0,
				isReferenced: !1,
				recursion: !0
			});
		}).filter(function(e) {
			return e.length > 0;
		}).join(" ");
		if (dp(e) && e.type === "image") {
			var v = p(e, "alt");
			if (v !== null) return v;
			var y = p(e, "title");
			return y === null ? "Submit Query" : y;
		}
		if (wp(e, ["button"])) {
			var b = f(e, {
				isEmbeddedInLabel: !1,
				isReferenced: !1
			});
			if (b !== "") return b;
		}
		return null;
	}
	function g(e, t) {
		if (n.has(e)) return "";
		if (!d && Ep(e, l) && !t.isReferenced) return n.add(e), "";
		var r = q(e) ? e.getAttributeNode("aria-labelledby") : null, i = r !== null && !n.has(r) ? Cp(e, "aria-labelledby") : [];
		if (a === "name" && !t.isReferenced && i.length > 0) return n.add(r), i.map(function(e) {
			return g(e, {
				isEmbeddedInLabel: t.isEmbeddedInLabel,
				isReferenced: !0,
				recursion: !1
			});
		}).join(" ");
		var o = t.recursion && Dp(e) && a === "name";
		if (!o) {
			var s = (q(e) && e.getAttribute("aria-label") || "").trim();
			if (s !== "" && a === "name") return n.add(e), s;
			if (!jp(e)) {
				var c = h(e);
				if (c !== null) return n.add(e), c;
			}
		}
		if (wp(e, ["menu"])) return n.add(e), "";
		if (o || t.isEmbeddedInLabel || t.isReferenced) {
			if (wp(e, ["combobox", "listbox"])) {
				n.add(e);
				var u = Ap(e);
				return u.length === 0 ? dp(e) ? e.value : "" : Kf(u).map(function(e) {
					return g(e, {
						isEmbeddedInLabel: t.isEmbeddedInLabel,
						isReferenced: !1,
						recursion: !0
					});
				}).join(" ");
			}
			if (Op(e, "range")) return n.add(e), e.hasAttribute("aria-valuetext") ? e.getAttribute("aria-valuetext") : e.hasAttribute("aria-valuenow") ? e.getAttribute("aria-valuenow") : e.getAttribute("value") || "";
			if (wp(e, ["textbox"])) return n.add(e), Fp(e);
		}
		if (Np(e) || q(e) && t.isReferenced || Mp(e) || Pp(e)) {
			var p = f(e, {
				isEmbeddedInLabel: t.isEmbeddedInLabel,
				isReferenced: !1
			});
			if (p !== "") return n.add(e), p;
		}
		if (e.nodeType === e.TEXT_NODE) return n.add(e), e.textContent || "";
		if (t.recursion) return n.add(e), f(e, {
			isEmbeddedInLabel: t.isEmbeddedInLabel,
			isReferenced: !1
		});
		var _ = m(e);
		return _ === null ? (n.add(e), "") : (n.add(e), _);
	}
	return Tp(g(e, {
		isEmbeddedInLabel: !1,
		isReferenced: a === "description",
		recursion: !1
	}));
}
function Up(e) {
	"@babel/helpers - typeof";
	return Up = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, Up(e);
}
function Wp(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function Gp(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? Wp(Object(n), !0).forEach(function(t) {
			Kp(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : Wp(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function Kp(e, t, n) {
	return t = qp(t), t in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function qp(e) {
	var t = Jp(e, "string");
	return Up(t) === "symbol" ? t : String(t);
}
function Jp(e, t) {
	if (Up(e) !== "object" || e === null) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (Up(r) !== "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function Yp(e) {
	var t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {}, n = Cp(e, "aria-describedby").map(function(e) {
		return Hp(e, Gp(Gp({}, t), {}, { compute: "description" }));
	}).join(" ");
	if (n === "") {
		var r = e.getAttribute("aria-description");
		n = r === null ? "" : r;
	}
	if (n === "") {
		var i = e.getAttribute("title");
		n = i === null ? "" : i;
	}
	return n;
}
function Xp(e) {
	return wp(e, [
		"caption",
		"code",
		"deletion",
		"emphasis",
		"generic",
		"insertion",
		"none",
		"paragraph",
		"presentation",
		"strong",
		"subscript",
		"superscript"
	]);
}
function Zp(e) {
	var t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
	return Xp(e) ? "" : Hp(e, t);
}
var Qp = m(wl(), 1), $p = m(h(), 1), em = m(Tl(), 1), tm = class extends Error {
	constructor(e, t, n, r) {
		super(), Error.captureStackTrace && Error.captureStackTrace(this, n);
		let i = "";
		try {
			i = r.utils.printWithType("Received", t, r.utils.printReceived);
		} catch {}
		this.message = [
			r.utils.matcherHint(`${r.isNot ? ".not" : ""}.${n.name}`, "received", ""),
			"",
			`${r.utils.RECEIVED_COLOR("received")} value must ${e}.`,
			i
		].join("\n");
	}
}, nm = class extends tm {
	constructor(...e) {
		super("be an HTMLElement or an SVGElement", ...e);
	}
}, rm = class extends tm {
	constructor(...e) {
		super("be a Node", ...e);
	}
};
function im(e, t, ...n) {
	if (!e || !e.ownerDocument || !e.ownerDocument.defaultView) throw new t(e, ...n);
}
function am(e, ...t) {
	if (im(e, rm, ...t), !(e instanceof e.ownerDocument.defaultView.Node)) throw new rm(e, ...t);
}
function J(e, ...t) {
	im(e, nm, ...t);
	let n = e.ownerDocument.defaultView;
	if (!(e instanceof n.HTMLElement) && !(e instanceof n.SVGElement)) throw new nm(e, ...t);
}
var om = class extends Error {
	constructor(e, t, n) {
		super(), Error.captureStackTrace && Error.captureStackTrace(this, t), this.message = [
			e.message,
			"",
			n.utils.RECEIVED_COLOR("Failing css:"),
			n.utils.RECEIVED_COLOR(`${e.css}`)
		].join("\n");
	}
};
function sm(e, ...t) {
	let n = Bf(`selector { ${e} }`, { silent: !0 }).stylesheet;
	if (n.parsingErrors && n.parsingErrors.length > 0) {
		let { reason: r, line: i } = n.parsingErrors[0];
		throw new om({
			css: e,
			message: `Syntax error parsing expected css: ${r} on line: ${i}`
		}, ...t);
	}
	return n.rules[0].declarations.filter((e) => e.type === "declaration").reduce((e, { property: t, value: n }) => Object.assign(e, { [t]: n }), {});
}
function cm(e, t) {
	return typeof t == "string" ? t : e.utils.stringify(t);
}
function Y(e, t, n, r, i, a) {
	return [
		`${t}
`,
		`${n}:
${e.utils.EXPECTED_COLOR((0, kf.default)(cm(e, r), 2))}`,
		`${i}:
${e.utils.RECEIVED_COLOR((0, kf.default)(cm(e, a), 2))}`
	].join("\n");
}
function lm(e, t) {
	return t instanceof RegExp ? t.test(e) : e.includes(String(t));
}
function um(e, t) {
	console.warn(`Warning: ${e} has been deprecated and will be removed in future updates.`, t);
}
function dm(e) {
	return e.replace(/\s+/g, " ").trim();
}
function fm(e) {
	return e.tagName && e.tagName.toLowerCase();
}
function pm({ multiple: e, options: t }) {
	let n = [...t].filter((e) => e.selected);
	if (e) return [...n].map((e) => e.value);
	if (n.length !== 0) return n[0].value;
}
function mm(e) {
	switch (e.type) {
		case "number": return e.value === "" ? null : Number(e.value);
		case "checkbox": return e.checked;
		default: return e.value;
	}
}
var hm = [
	"meter",
	"progressbar",
	"slider",
	"spinbutton"
];
function gm(e) {
	if (hm.includes(e.getAttribute("role"))) return Number(e.getAttribute("aria-valuenow"));
}
function _m(e) {
	if (e) switch (e.tagName.toLowerCase()) {
		case "input": return mm(e);
		case "select": return pm(e);
		default: return e.value ?? gm(e);
	}
}
function vm(e, { wordConnector: t = ", ", lastWordConnector: n = " and " } = {}) {
	return [e.slice(0, -1).join(t), e[e.length - 1]].join(e.length > 1 ? n : "");
}
function ym(e, t) {
	return Array.isArray(e) && Array.isArray(t) ? [...new Set(e)].every((e) => new Set(t).has(e)) : e === t;
}
function bm(e, t) {
	return um("toBeInTheDOM", "Please use toBeInTheDocument for searching the entire document and toContainElement for searching a specific container."), e && J(e, bm, this), t && J(t, bm, this), {
		pass: t ? t.contains(e) : !!e,
		message: () => [
			this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toBeInTheDOM`, "element", ""),
			"",
			"Received:",
			`  ${this.utils.printReceived(e && e.cloneNode(!1))}`
		].join("\n")
	};
}
function xm(e) {
	e === null && this.isNot || J(e, xm, this);
	let t = e !== null && e.ownerDocument === e.getRootNode({ composed: !0 }), n = () => `expected document not to contain element, found ${this.utils.stringify(e.cloneNode(!0))} instead`, r = () => "element could not be found in the document";
	return {
		pass: t,
		message: () => [
			this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toBeInTheDocument`, "element", ""),
			"",
			this.utils.RECEIVED_COLOR(this.isNot ? n() : r())
		].join("\n")
	};
}
function Sm(e) {
	return um("toBeEmpty", "Please use instead toBeEmptyDOMElement for finding empty nodes in the DOM."), J(e, Sm, this), {
		pass: e.innerHTML === "",
		message: () => [
			this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toBeEmpty`, "element", ""),
			"",
			"Received:",
			`  ${this.utils.printReceived(e.innerHTML)}`
		].join("\n")
	};
}
function Cm(e) {
	return J(e, Cm, this), {
		pass: wm(e),
		message: () => [
			this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toBeEmptyDOMElement`, "element", ""),
			"",
			"Received:",
			`  ${this.utils.printReceived(e.innerHTML)}`
		].join("\n")
	};
}
function wm(e) {
	return [...e.childNodes].filter((e) => e.nodeType !== 8).length === 0;
}
function Tm(e, t) {
	return J(e, Tm, this), t !== null && J(t, Tm, this), {
		pass: e.contains(t),
		message: () => [
			this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toContainElement`, "element", "element"),
			"",
			this.utils.RECEIVED_COLOR(`${this.utils.stringify(e.cloneNode(!1))} ${this.isNot ? "contains:" : "does not contain:"} ${this.utils.stringify(t && t.cloneNode(!1))}
        `)
		].join("\n")
	};
}
function Em(e, t) {
	let n = e.ownerDocument.createElement("div");
	return n.innerHTML = t, n.innerHTML;
}
function Dm(e, t) {
	if (J(e, Dm, this), typeof t != "string") throw Error(`.toContainHTML() expects a string value, got ${t}`);
	return {
		pass: e.outerHTML.includes(Em(e, t)),
		message: () => [
			this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toContainHTML`, "element", ""),
			"Expected:",
			`  ${this.utils.EXPECTED_COLOR(t)}`,
			"Received:",
			`  ${this.utils.printReceived(e.cloneNode(!0))}`
		].join("\n")
	};
}
function Om(e, t, n = { normalizeWhitespace: !0 }) {
	am(e, Om, this);
	let r = n.normalizeWhitespace ? dm(e.textContent) : e.textContent.replace(/\u00a0/g, " "), i = r !== "" && t === "";
	return {
		pass: !i && lm(r, t),
		message: () => {
			let e = this.isNot ? "not to" : "to";
			return Y(this, this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toHaveTextContent`, "element", ""), i ? "Checking with empty string will always match, use .toBeEmptyDOMElement() instead" : `Expected element ${e} have text content`, t, "Received", r);
		}
	};
}
function km(e, t) {
	J(e, km, this);
	let n = Yp(e), r = arguments.length === 1, i = !1;
	return i = r ? n !== "" : t instanceof RegExp ? t.test(n) : this.equals(n, t), {
		pass: i,
		message: () => {
			let e = this.isNot ? "not to" : "to";
			return Y(this, this.utils.matcherHint(`${this.isNot ? ".not" : ""}.${km.name}`, "element", ""), `Expected element ${e} have accessible description`, t, "Received", n);
		}
	};
}
var Am = "aria-invalid", jm = ["false"];
function Mm(e, t) {
	J(e, Mm, this);
	let n = this.isNot ? "not to" : "to", r = this.isNot ? ".not.toHaveAccessibleErrorMessage" : ".toHaveAccessibleErrorMessage", i = e.getAttribute("aria-errormessage");
	if (i && /\s+/.test(i)) return {
		pass: !1,
		message: () => Y(this, this.utils.matcherHint(r, "element"), "Expected element's `aria-errormessage` attribute to be empty or a single, valid ID", "", "Received", `aria-errormessage="${i}"`)
	};
	let a = e.getAttribute(Am);
	if (!e.hasAttribute(Am) || jm.includes(a)) return {
		pass: !1,
		message: () => Y(this, this.utils.matcherHint(r, "element"), "Expected element to be marked as invalid with attribute", `${Am}="true"`, "Received", e.hasAttribute("aria-invalid") ? `${Am}="${e.getAttribute(Am)}` : null)
	};
	let o = dm(e.ownerDocument.getElementById(i)?.textContent ?? "");
	return {
		pass: t === void 0 ? !!o : t instanceof RegExp ? t.test(o) : this.equals(o, t),
		message: () => Y(this, this.utils.matcherHint(r, "element"), `Expected element ${n} have accessible error message`, t ?? "", "Received", o)
	};
}
var Nm = Lm(Qp.elementRoles);
function Pm(e, t) {
	J(e, Pm, this);
	let n = Fm(e);
	return {
		pass: n.some((e) => e === t),
		message: () => {
			let e = this.isNot ? "not to" : "to";
			return Y(this, this.utils.matcherHint(`${this.isNot ? ".not" : ""}.${Pm.name}`, "element", ""), `Expected element ${e} have role`, t, "Received", n.join(", "));
		}
	};
}
function Fm(e) {
	return e.hasAttribute("role") ? e.getAttribute("role").split(" ").filter(Boolean) : Im(e);
}
function Im(e) {
	for (let { match: t, roles: n } of Nm) if (t(e)) return [...n];
	return [];
}
function Lm(e) {
	function t({ name: e, attributes: t }) {
		return `${e}${t.map(({ name: e, value: t, constraints: n = [] }) => n.indexOf("undefined") === -1 ? t ? `[${e}="${t}"]` : `[${e}]` : `:not([${e}])`).join("")}`;
	}
	function n({ attributes: e = [] }) {
		return e.length;
	}
	function r({ specificity: e }, { specificity: t }) {
		return t - e;
	}
	function i(e) {
		let { attributes: n = [] } = e, r = n.findIndex((e) => e.value && e.name === "type" && e.value === "text");
		r >= 0 && (n = [...n.slice(0, r), ...n.slice(r + 1)]);
		let i = t({
			...e,
			attributes: n
		});
		return (e) => r >= 0 && e.type !== "text" ? !1 : e.matches(i);
	}
	let a = [];
	for (let [t, r] of e.entries()) a = [...a, {
		match: i(t),
		roles: Array.from(r),
		specificity: n(t)
	}];
	return a.sort(r);
}
function Rm(e, t) {
	J(e, Rm, this);
	let n = Zp(e), r = arguments.length === 1, i = !1;
	return i = r ? n !== "" : t instanceof RegExp ? t.test(n) : this.equals(n, t), {
		pass: i,
		message: () => {
			let e = this.isNot ? "not to" : "to";
			return Y(this, this.utils.matcherHint(`${this.isNot ? ".not" : ""}.${Rm.name}`, "element", ""), `Expected element ${e} have accessible name`, t, "Received", n);
		}
	};
}
function zm(e, t, n) {
	return n === void 0 ? t : `${t}=${e(n)}`;
}
function Bm(e, t, n) {
	return n === void 0 ? `element.hasAttribute(${e(t)})` : `element.getAttribute(${e(t)}) === ${e(n)}`;
}
function Vm(e, t, n) {
	J(e, Vm, this);
	let r = n !== void 0, i = e.hasAttribute(t), a = e.getAttribute(t);
	return {
		pass: r ? i && this.equals(a, n) : i,
		message: () => {
			let e = this.isNot ? "not to" : "to", o = i ? zm(this.utils.stringify, t, a) : null, s = this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toHaveAttribute`, "element", this.utils.printExpected(t), {
				secondArgument: r ? this.utils.printExpected(n) : void 0,
				comment: Bm(this.utils.stringify, t, n)
			});
			return Y(this, s, `Expected the element ${e} have attribute`, zm(this.utils.stringify, t, n), "Received", o);
		}
	};
}
function Hm(e) {
	let t = e.pop(), n, r;
	return typeof t == "object" && !(t instanceof RegExp) ? (n = e, r = t) : (n = e.concat(t), r = { exact: !1 }), {
		expectedClassNames: n,
		options: r
	};
}
function Um(e) {
	return e ? e.split(/\s+/).filter((e) => e.length > 0) : [];
}
function Wm(e, t) {
	return e.every((e) => typeof e == "string" ? t.includes(e) : t.some((t) => e.test(t)));
}
function Gm(e, ...t) {
	J(e, Gm, this);
	let { expectedClassNames: n, options: r } = Hm(t), i = Um(e.getAttribute("class")), a = n.reduce((e, t) => e.concat(typeof t == "string" || !t ? Um(t) : t), []), o = a.some((e) => e instanceof RegExp);
	if (r.exact && o) throw Error("Exact option does not support RegExp expected class names");
	return r.exact ? {
		pass: Wm(a, i) && a.length === i.length,
		message: () => {
			let e = this.isNot ? "not to" : "to";
			return Y(this, this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toHaveClass`, "element", this.utils.printExpected(a.join(" "))), `Expected the element ${e} have EXACTLY defined classes`, a.join(" "), "Received", i.join(" "));
		}
	} : a.length > 0 ? {
		pass: Wm(a, i),
		message: () => {
			let e = this.isNot ? "not to" : "to";
			return Y(this, this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toHaveClass`, "element", this.utils.printExpected(a.join(" "))), `Expected the element ${e} have class`, a.join(" "), "Received", i.join(" "));
		}
	} : {
		pass: this.isNot ? i.length > 0 : !1,
		message: () => this.isNot ? Y(this, this.utils.matcherHint(".not.toHaveClass", "element", ""), "Expected the element to have classes", "(none)", "Received", i.join(" ")) : [this.utils.matcherHint(".toHaveClass", "element"), "At least one expected class must be provided."].join("\n")
	};
}
function Km(e, t) {
	let n = {}, r = e.createElement("div");
	return Object.keys(t).forEach((e) => {
		r.style[e] = t[e], n[e] = r.style[e];
	}), n;
}
function qm(e, t) {
	return !!Object.keys(e).length && Object.entries(e).every(([e, n]) => {
		let r = e.startsWith("--"), i = [e];
		return r || i.push(e.toLowerCase()), i.some((e) => t[e] === n || t.getPropertyValue(e) === n);
	});
}
function Jm(e) {
	return Object.keys(e).sort().map((t) => `${t}: ${e[t]};`).join("\n");
}
function Ym(e, t, n) {
	let r = Array.from(n).filter((e) => t[e] !== void 0).reduce((e, t) => Object.assign(e, { [t]: n.getPropertyValue(t) }), {});
	return e(Jm(t), Jm(r)).replace(`${$p.default.red("+ Received")}
`, "");
}
function Xm(e, t) {
	J(e, Xm, this);
	let n = typeof t == "object" ? t : sm(t, Xm, this), { getComputedStyle: r } = e.ownerDocument.defaultView, i = Km(e.ownerDocument, n), a = r(e);
	return {
		pass: qm(i, a),
		message: () => {
			let e = `${this.isNot ? ".not" : ""}.toHaveStyle`;
			return [this.utils.matcherHint(e, "element", ""), Ym(this.utils.diff, i, a)].join("\n\n");
		}
	};
}
function Zm(e) {
	return J(e, Zm, this), {
		pass: e.ownerDocument.activeElement === e,
		message: () => [
			this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toHaveFocus`, "element", ""),
			"",
			...this.isNot ? ["Received element is focused:", `  ${this.utils.printReceived(e)}`] : [
				"Expected element with focus:",
				`  ${this.utils.printExpected(e)}`,
				"Received element with focus:",
				`  ${this.utils.printReceived(e.ownerDocument.activeElement)}`
			]
		].join("\n")
	};
}
function Qm(e) {
	let t = [...new Set(e.map((e) => e.type))];
	if (t.length !== 1) throw Error("Multiple form elements with the same name must be of the same type");
	switch (t[0]) {
		case "radio": {
			let t = e.find((e) => e.checked);
			return t ? t.value : void 0;
		}
		case "checkbox": return e.filter((e) => e.checked).map((e) => e.value);
		default: return e.map((e) => e.value);
	}
}
function $m(e, t) {
	let n = [...e.querySelectorAll(`[name="${(0, em.default)(t)}"]`)];
	if (n.length !== 0) return n.length === 1 ? _m(n[0]) : Qm(n);
}
function eh(e) {
	return /\[\]$/.test(e) ? e.slice(0, -2) : e;
}
function th(e) {
	return Array.from(e.elements).map((e) => e.name).reduce((t, n) => ({
		...t,
		[eh(n)]: $m(e, n)
	}), {});
}
function nh(e, t) {
	if (J(e, nh, this), !e.elements) throw Error("toHaveFormValues must be called on a form or a fieldset");
	let n = th(e);
	return {
		pass: Object.entries(t).every(([e, t]) => ym(n[e], t)),
		message: () => {
			let e = this.isNot ? "not to" : "to", r = `${this.isNot ? ".not" : ""}.toHaveFormValues`, i = Object.keys(n).filter((e) => t.hasOwnProperty(e)).reduce((e, t) => ({
				...e,
				[t]: n[t]
			}), {});
			return [
				this.utils.matcherHint(r, "element", ""),
				`Expected the element ${e} have form values`,
				this.utils.diff(t, i)
			].join("\n\n");
		}
	};
}
function rh(e) {
	let { getComputedStyle: t } = e.ownerDocument.defaultView, { display: n, visibility: r, opacity: i } = t(e);
	return n !== "none" && r !== "hidden" && r !== "collapse" && i !== "0" && i !== 0;
}
function ih(e, t) {
	let n;
	return n = t ? e.nodeName === "DETAILS" && t.nodeName !== "SUMMARY" ? e.hasAttribute("open") : !0 : e.nodeName !== "DETAILS" || e.hasAttribute("open"), !e.hasAttribute("hidden") && n;
}
function ah(e, t) {
	return rh(e) && ih(e, t) && (!e.parentElement || ah(e.parentElement, e));
}
function oh(e) {
	J(e, oh, this);
	let t = e.ownerDocument === e.getRootNode({ composed: !0 }), n = t && ah(e);
	return {
		pass: n,
		message: () => {
			let r = n ? "is" : "is not";
			return [
				this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toBeVisible`, "element", ""),
				"",
				`Received element ${r} visible${t ? "" : " (element is not in the document)"}:`,
				`  ${this.utils.printReceived(e.cloneNode(!1))}`
			].join("\n");
		}
	};
}
var sh = [
	"fieldset",
	"input",
	"select",
	"optgroup",
	"option",
	"button",
	"textarea"
];
function ch(e, t) {
	return fm(e) === "legend" && fm(t) === "fieldset" && e.isSameNode(Array.from(t.children).find((e) => fm(e) === "legend"));
}
function lh(e, t) {
	return fh(t) && !ch(e, t);
}
function uh(e) {
	return e.includes("-");
}
function dh(e) {
	let t = fm(e);
	return sh.includes(t) || uh(t);
}
function fh(e) {
	return dh(e) && e.hasAttribute("disabled");
}
function ph(e) {
	let t = e.parentElement;
	return !!t && (lh(e, t) || ph(t));
}
function mh(e) {
	return dh(e) && (fh(e) || ph(e));
}
function hh(e) {
	J(e, hh, this);
	let t = mh(e);
	return {
		pass: t,
		message: () => {
			let n = t ? "is" : "is not";
			return [
				this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toBeDisabled`, "element", ""),
				"",
				`Received element ${n} disabled:`,
				`  ${this.utils.printReceived(e.cloneNode(!1))}`
			].join("\n");
		}
	};
}
function gh(e) {
	J(e, gh, this);
	let t = !mh(e);
	return {
		pass: t,
		message: () => {
			let n = t ? "is" : "is not";
			return [
				this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toBeEnabled`, "element", ""),
				"",
				`Received element ${n} enabled:`,
				`  ${this.utils.printReceived(e.cloneNode(!1))}`
			].join("\n");
		}
	};
}
var _h = ["select", "textarea"], vh = [
	"input",
	"select",
	"textarea"
], yh = [
	"color",
	"hidden",
	"range",
	"submit",
	"image",
	"reset"
], bh = [
	"checkbox",
	"combobox",
	"gridcell",
	"listbox",
	"radiogroup",
	"spinbutton",
	"textbox",
	"tree"
];
function xh(e) {
	return _h.includes(fm(e)) && e.hasAttribute("required");
}
function Sh(e) {
	return fm(e) === "input" && e.hasAttribute("required") && (e.hasAttribute("type") && !yh.includes(e.getAttribute("type")) || !e.hasAttribute("type"));
}
function Ch(e) {
	return e.hasAttribute("aria-required") && e.getAttribute("aria-required") === "true" && (vh.includes(fm(e)) || e.hasAttribute("role") && bh.includes(e.getAttribute("role")));
}
function wh(e) {
	J(e, wh, this);
	let t = xh(e) || Sh(e) || Ch(e);
	return {
		pass: t,
		message: () => {
			let n = t ? "is" : "is not";
			return [
				this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toBeRequired`, "element", ""),
				"",
				`Received element ${n} required:`,
				`  ${this.utils.printReceived(e.cloneNode(!1))}`
			].join("\n");
		}
	};
}
var Th = [
	"form",
	"input",
	"select",
	"textarea"
];
function Eh(e) {
	return e.hasAttribute("aria-invalid") && e.getAttribute("aria-invalid") !== "false";
}
function Dh(e) {
	return Th.includes(fm(e));
}
function Oh(e) {
	let t = Eh(e);
	return Dh(e) ? t || !e.checkValidity() : t;
}
function kh(e) {
	J(e, kh, this);
	let t = Oh(e);
	return {
		pass: t,
		message: () => {
			let n = t ? "is" : "is not";
			return [
				this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toBeInvalid`, "element", ""),
				"",
				`Received element ${n} currently invalid:`,
				`  ${this.utils.printReceived(e.cloneNode(!1))}`
			].join("\n");
		}
	};
}
function Ah(e) {
	J(e, Ah, this);
	let t = !Oh(e);
	return {
		pass: t,
		message: () => {
			let n = t ? "is" : "is not";
			return [
				this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toBeValid`, "element", ""),
				"",
				`Received element ${n} currently valid:`,
				`  ${this.utils.printReceived(e.cloneNode(!1))}`
			].join("\n");
		}
	};
}
function jh(e, t) {
	if (J(e, jh, this), e.tagName.toLowerCase() === "input" && ["checkbox", "radio"].includes(e.type)) throw Error("input with type=checkbox or type=radio cannot be used with .toHaveValue(). Use .toBeChecked() for type=checkbox or .toHaveFormValues() instead");
	let n = _m(e), r = t !== void 0, i = t, a = n;
	return t == n && t !== n && (i = `${t} (${typeof t})`, a = `${n} (${typeof n})`), {
		pass: r ? ym(n, t) : !!n,
		message: () => {
			let e = this.isNot ? "not to" : "to", n = this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toHaveValue`, "element", t);
			return Y(this, n, `Expected the element ${e} have value`, r ? i : "(any)", "Received", a);
		}
	};
}
function Mh(e, t) {
	J(e, Mh, this);
	let n = e.tagName.toLowerCase();
	if (![
		"select",
		"input",
		"textarea"
	].includes(n)) throw Error(".toHaveDisplayValue() currently supports only input, textarea or select elements, try with another matcher instead.");
	if (n === "input" && ["radio", "checkbox"].includes(e.type)) throw Error(`.toHaveDisplayValue() currently does not support input[type="${e.type}"], try with another matcher instead.`);
	let r = Nh(n, e), i = Ph(t), a = i.filter((e) => r.some((t) => e instanceof RegExp ? e.test(t) : this.equals(t, String(e)))).length, o = a === r.length, s = a === i.length;
	return {
		pass: o && s,
		message: () => Y(this, this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toHaveDisplayValue`, "element", ""), `Expected element ${this.isNot ? "not " : ""}to have display value`, t, "Received", r)
	};
}
function Nh(e, t) {
	return e === "select" ? Array.from(t).filter((e) => e.selected).map((e) => e.textContent) : [t.value];
}
function Ph(e) {
	return e instanceof Array ? e : [e];
}
function Fh(e) {
	J(e, Fh, this);
	let t = () => e.tagName.toLowerCase() === "input" && ["checkbox", "radio"].includes(e.type);
	if (!t() && !(Rh(e.getAttribute("role")) && ["true", "false"].includes(e.getAttribute("aria-checked")))) return {
		pass: !1,
		message: () => `only inputs with type="checkbox" or type="radio" or elements with ${Ih()} and a valid aria-checked attribute can be used with .toBeChecked(). Use .toHaveValue() instead`
	};
	let n = () => t() ? e.checked : e.getAttribute("aria-checked") === "true";
	return {
		pass: n(),
		message: () => {
			let t = n() ? "is" : "is not";
			return [
				this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toBeChecked`, "element", ""),
				"",
				`Received element ${t} checked:`,
				`  ${this.utils.printReceived(e.cloneNode(!1))}`
			].join("\n");
		}
	};
}
function Ih() {
	return vm(Lh().map((e) => `role="${e}"`), { lastWordConnector: " or " });
}
function Lh() {
	return Qp.roles.keys().filter(Rh);
}
function Rh(e) {
	return Qp.roles.get(e)?.props["aria-checked"] !== void 0;
}
function zh(e) {
	J(e, zh, this);
	let t = () => e.tagName.toLowerCase() === "input" && e.type === "checkbox";
	if (!t() && e.getAttribute("role") !== "checkbox") return {
		pass: !1,
		message: () => "only inputs with type=\"checkbox\" or elements with role=\"checkbox\" and a valid aria-checked attribute can be used with .toBePartiallyChecked(). Use .toHaveValue() instead"
	};
	let n = () => {
		let n = e.getAttribute("aria-checked") === "mixed";
		return t() && e.indeterminate || n;
	};
	return {
		pass: n(),
		message: () => {
			let t = n() ? "is" : "is not";
			return [
				this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toBePartiallyChecked`, "element", ""),
				"",
				`Received element ${t} partially checked:`,
				`  ${this.utils.printReceived(e.cloneNode(!1))}`
			].join("\n");
		}
	};
}
function Bh(e, t) {
	um("toHaveDescription", "Please use toHaveAccessibleDescription."), J(e, Bh, this);
	let n = t !== void 0, r = (e.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean), i = "";
	if (r.length > 0) {
		let t = e.ownerDocument;
		i = dm(r.map((e) => t.getElementById(e)).filter(Boolean).map((e) => e.textContent).join(" "));
	}
	return {
		pass: n ? t instanceof RegExp ? t.test(i) : this.equals(i, t) : !!i,
		message: () => {
			let e = this.isNot ? "not to" : "to";
			return Y(this, this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toHaveDescription`, "element", ""), `Expected the element ${e} have description`, this.utils.printExpected(t), "Received", this.utils.printReceived(i));
		}
	};
}
function Vh(e, t) {
	if (um("toHaveErrorMessage", "Please use toHaveAccessibleErrorMessage."), J(e, Vh, this), !e.hasAttribute("aria-invalid") || e.getAttribute("aria-invalid") === "false") {
		let t = this.isNot ? ".not" : "";
		return {
			pass: !1,
			message: () => Y(this, this.utils.matcherHint(`${t}.toHaveErrorMessage`, "element", ""), "Expected the element to have invalid state indicated by", "aria-invalid=\"true\"", "Received", e.hasAttribute("aria-invalid") ? `aria-invalid="${e.getAttribute("aria-invalid")}"` : this.utils.printReceived(""))
		};
	}
	let n = t !== void 0, r = (e.getAttribute("aria-errormessage") || "").split(/\s+/).filter(Boolean), i = "";
	if (r.length > 0) {
		let t = e.ownerDocument;
		i = dm(r.map((e) => t.getElementById(e)).filter(Boolean).map((e) => e.textContent).join(" "));
	}
	return {
		pass: n ? t instanceof RegExp ? t.test(i) : this.equals(i, t) : !!i,
		message: () => {
			let e = this.isNot ? "not to" : "to";
			return Y(this, this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toHaveErrorMessage`, "element", ""), `Expected the element ${e} have error message`, this.utils.printExpected(t), "Received", this.utils.printReceived(i));
		}
	};
}
function Hh(e) {
	let t = e.ownerDocument.getSelection();
	if (["input", "textarea"].includes(e.tagName.toLowerCase())) return ["radio", "checkbox"].includes(e.type) ? "" : e.value.toString().substring(e.selectionStart, e.selectionEnd);
	if (t.anchorNode === null || t.focusNode === null) return "";
	let n = t.getRangeAt(0), r = e.ownerDocument.createRange();
	if (t.containsNode(e, !1)) r.selectNodeContents(e), t.removeAllRanges(), t.addRange(r);
	else if (!(e.contains(t.anchorNode) && e.contains(t.focusNode))) {
		let i = e === n.startContainer || e.contains(n.startContainer), a = e === n.endContainer || e.contains(n.endContainer);
		t.removeAllRanges(), (i || a) && (r.selectNodeContents(e), i && r.setStart(n.startContainer, n.startOffset), a && r.setEnd(n.endContainer, n.endOffset), t.addRange(r));
	}
	let i = t.toString();
	return t.removeAllRanges(), t.addRange(n), i;
}
function Uh(e, t) {
	J(e, Uh, this);
	let n = t !== void 0;
	if (n && typeof t != "string") throw Error("expected selection must be a string or undefined");
	let r = Hh(e);
	return {
		pass: n ? ym(r, t) : !!r,
		message: () => {
			let e = this.isNot ? "not to" : "to", i = this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toHaveSelection`, "element", t);
			return Y(this, i, `Expected the element ${e} have selection`, n ? t : "(any)", "Received", r);
		}
	};
}
function Wh(e) {
	J(e, Wh, this);
	let t = (e.getAttribute("role") || "").split(" ").map((e) => e.trim()), n = e.tagName.toLowerCase() === "button" || e.tagName.toLowerCase() === "input" && e.type === "button" || t.includes("button"), r = e.getAttribute("aria-pressed");
	return !n || r !== "true" && r !== "false" ? {
		pass: !1,
		message: () => "Only button or input with type=\"button\" or element with role=\"button\" and a valid aria-pressed attribute can be used with .toBePressed()"
	} : {
		pass: n && r === "true",
		message: () => {
			let e = this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toBePressed`, "element", "");
			return Y(this, e, "Expected element to have", `aria-pressed="${this.isNot ? "false" : "true"}"`, "Received", `aria-pressed="${r}"`);
		}
	};
}
function Gh(e) {
	J(e, Gh, this);
	let t = (e.getAttribute("role") || "").split(" ").map((e) => e.trim()), n = e.tagName.toLowerCase() === "button" || e.tagName.toLowerCase() === "input" && e.type === "button" || t.includes("button"), r = e.getAttribute("aria-pressed");
	return !n || r !== "true" && r !== "false" && r !== "mixed" ? {
		pass: !1,
		message: () => "Only button or input with type=\"button\" or element with role=\"button\" and a valid aria-pressed attribute can be used with .toBePartiallyPressed()"
	} : {
		pass: n && r === "mixed",
		message: () => {
			let e = this.isNot ? "not to" : "to", t = this.utils.matcherHint(`${this.isNot ? ".not" : ""}.toBePartiallyPressed`, "element", "");
			return Y(this, t, `Expected element ${e} have`, "aria-pressed=\"mixed\"", "Received", `aria-pressed="${r}"`);
		}
	};
}
var Kh = 1, qh = 2, Jh = 4, Yh = 8, Xh = 16, Zh = 32, Qh = {
	[Kh]: "Node.DOCUMENT_POSITION_DISCONNECTED",
	[qh]: "Node.DOCUMENT_POSITION_PRECEDING",
	[Jh]: "Node.DOCUMENT_POSITION_FOLLOWING",
	[Yh]: "Node.DOCUMENT_POSITION_CONTAINS",
	[Xh]: "Node.DOCUMENT_POSITION_CONTAINED_BY",
	[Zh]: "Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC"
};
function $h(e) {
	return e in Qh ? `${Qh[e]} (${e})` : `Unknown document position (${e})`;
}
function eg(e, t) {
	return function(n, r) {
		J(n, tg, this), J(r, tg, this);
		let i = n.compareDocumentPosition(r);
		return {
			pass: i === t,
			message: () => [
				this.utils.matcherHint(`${this.isNot ? ".not" : ""}.${e}`, "element", "secondElement"),
				"",
				`Received: ${$h(i)}`
			].join("\n")
		};
	};
}
function tg(e, t) {
	return eg("toAppearBefore", Jh).apply(this, [e, t]);
}
function ng(e, t) {
	return eg("toAppearAfter", qh).apply(this, [e, t]);
}
Object.freeze({
	__proto__: null,
	toAppearAfter: ng,
	toAppearBefore: tg,
	toBeChecked: Fh,
	toBeDisabled: hh,
	toBeEmpty: Sm,
	toBeEmptyDOMElement: Cm,
	toBeEnabled: gh,
	toBeInTheDOM: bm,
	toBeInTheDocument: xm,
	toBeInvalid: kh,
	toBePartiallyChecked: zh,
	toBePartiallyPressed: Gh,
	toBePressed: Wh,
	toBeRequired: wh,
	toBeValid: Ah,
	toBeVisible: oh,
	toContainElement: Tm,
	toContainHTML: Dm,
	toHaveAccessibleDescription: km,
	toHaveAccessibleErrorMessage: Mm,
	toHaveAccessibleName: Rm,
	toHaveAttribute: Vm,
	toHaveClass: Gm,
	toHaveDescription: Bh,
	toHaveDisplayValue: Mh,
	toHaveErrorMessage: Vh,
	toHaveFocus: Zm,
	toHaveFormValues: nh,
	toHaveRole: Pm,
	toHaveSelection: Uh,
	toHaveStyle: Xm,
	toHaveTextContent: Om,
	toHaveValue: jh
}), m(Fo(), 1), m(wl(), 1), m(h(), 1), m(Tl(), 1);
var rg, ig;
function ag() {
	if (ig) return rg;
	ig = 1;
	var e, t, n, r, i, a, o, s, c, l, u, d, f = /\/(?![*\/])(?:\[(?:(?![\]\\]).|\\.)*\]|(?![\/\\]).|\\.)*(\/[$_\u200C\u200D\p{ID_Continue}]*|\\)?/uy, p, m, h, g, _, v;
	return d = /--|\+\+|=>|\.{3}|\??\.(?!\d)|(?:&&|\|\||\?\?|[+\-%&|^]|\*{1,2}|<{1,2}|>{1,3}|!=?|={1,2}|\/(?![\/*]))=?|[?~,:;[\](){}]/y, e = /(\x23?)(?=[$_\p{ID_Start}\\])(?:[$_\u200C\u200D\p{ID_Continue}]|\\u[\da-fA-F]{4}|\\u\{[\da-fA-F]+\})+/uy, m = /(['"])(?:(?!\1)[^\\\n\r]|\\(?:\r\n|[^]))*(\1)?/y, u = /(?:0[xX][\da-fA-F](?:_?[\da-fA-F])*|0[oO][0-7](?:_?[0-7])*|0[bB][01](?:_?[01])*)n?|0n|[1-9](?:_?\d)*n|(?:(?:0(?!\d)|0\d*[89]\d*|[1-9](?:_?\d)*)(?:\.(?:\d(?:_?\d)*)?)?|\.\d(?:_?\d)*)(?:[eE][+-]?\d(?:_?\d)*)?|0[0-7]+/y, h = /[`}](?:[^`\\$]|\\[^]|\$(?!\{))*(`|\$\{)?/y, v = /[\t\v\f\ufeff\p{Zs}]+/uy, s = /\r?\n|[\r\u2028\u2029]/y, c = /\/\*(?:[^*]|\*(?!\/))*(\*\/)?/y, p = /\/\/.*/y, n = /[<>.:={}]|\/(?![\/*])/y, t = /[$_\p{ID_Start}][$_\u200C\u200D\p{ID_Continue}-]*/uy, r = /(['"])(?:(?!\1)[^])*(\1)?/y, i = /[^<>{}]+/y, _ = /^(?:[\/+-]|\.{3}|\?(?:InterpolationIn(?:JSX|Template)|NoLineTerminatorHere|NonExpressionParenEnd|UnaryIncDec))?$|[{}([,;<>=*%&|^!~?:]$/, g = /^(?:=>|[;\]){}]|else|\?(?:NoLineTerminatorHere|NonExpressionParenEnd))?$/, a = /^(?:await|case|default|delete|do|else|instanceof|new|return|throw|typeof|void|yield)$/, o = /^(?:return|throw|yield)$/, l = RegExp(s.source), rg = function* (y, { jsx: b = !1 } = {}) {
		var x, S, ee, C, w, te, T, ne, re, ie, ae, E, oe, D;
		for ({length: te} = y, C = 0, w = "", D = [{ tag: "JS" }], x = [], ae = 0, E = !1; C < te;) {
			switch (ne = D[D.length - 1], ne.tag) {
				case "JS":
				case "JSNonExpressionParen":
				case "InterpolationInTemplate":
				case "InterpolationInJSX":
					if (y[C] === "/" && (_.test(w) || a.test(w)) && (f.lastIndex = C, T = f.exec(y))) {
						C = f.lastIndex, w = T[0], E = !0, yield {
							type: "RegularExpressionLiteral",
							value: T[0],
							closed: T[1] !== void 0 && T[1] !== "\\"
						};
						continue;
					}
					if (d.lastIndex = C, T = d.exec(y)) {
						switch (oe = T[0], re = d.lastIndex, ie = oe, oe) {
							case "(":
								w === "?NonExpressionParenKeyword" && D.push({
									tag: "JSNonExpressionParen",
									nesting: ae
								}), ae++, E = !1;
								break;
							case ")":
								ae--, E = !0, ne.tag === "JSNonExpressionParen" && ae === ne.nesting && (D.pop(), ie = "?NonExpressionParenEnd", E = !1);
								break;
							case "{":
								d.lastIndex = 0, ee = !g.test(w) && (_.test(w) || a.test(w)), x.push(ee), E = !1;
								break;
							case "}":
								switch (ne.tag) {
									case "InterpolationInTemplate":
										if (x.length === ne.nesting) {
											h.lastIndex = C, T = h.exec(y), C = h.lastIndex, w = T[0], T[1] === "${" ? (w = "?InterpolationInTemplate", E = !1, yield {
												type: "TemplateMiddle",
												value: T[0]
											}) : (D.pop(), E = !0, yield {
												type: "TemplateTail",
												value: T[0],
												closed: T[1] === "`"
											});
											continue;
										}
										break;
									case "InterpolationInJSX": if (x.length === ne.nesting) {
										D.pop(), C += 1, w = "}", yield {
											type: "JSXPunctuator",
											value: "}"
										};
										continue;
									}
								}
								E = x.pop(), ie = E ? "?ExpressionBraceEnd" : "}";
								break;
							case "]":
								E = !0;
								break;
							case "++":
							case "--":
								ie = E ? "?PostfixIncDec" : "?UnaryIncDec";
								break;
							case "<":
								if (b && (_.test(w) || a.test(w))) {
									D.push({ tag: "JSXTag" }), C += 1, w = "<", yield {
										type: "JSXPunctuator",
										value: oe
									};
									continue;
								}
								E = !1;
								break;
							default: E = !1;
						}
						C = re, w = ie, yield {
							type: "Punctuator",
							value: oe
						};
						continue;
					}
					if (e.lastIndex = C, T = e.exec(y)) {
						switch (C = e.lastIndex, ie = T[0], T[0]) {
							case "for":
							case "if":
							case "while":
							case "with": w !== "." && w !== "?." && (ie = "?NonExpressionParenKeyword");
						}
						w = ie, E = !a.test(T[0]), yield {
							type: T[1] === "#" ? "PrivateIdentifier" : "IdentifierName",
							value: T[0]
						};
						continue;
					}
					if (m.lastIndex = C, T = m.exec(y)) {
						C = m.lastIndex, w = T[0], E = !0, yield {
							type: "StringLiteral",
							value: T[0],
							closed: T[2] !== void 0
						};
						continue;
					}
					if (u.lastIndex = C, T = u.exec(y)) {
						C = u.lastIndex, w = T[0], E = !0, yield {
							type: "NumericLiteral",
							value: T[0]
						};
						continue;
					}
					if (h.lastIndex = C, T = h.exec(y)) {
						C = h.lastIndex, w = T[0], T[1] === "${" ? (w = "?InterpolationInTemplate", D.push({
							tag: "InterpolationInTemplate",
							nesting: x.length
						}), E = !1, yield {
							type: "TemplateHead",
							value: T[0]
						}) : (E = !0, yield {
							type: "NoSubstitutionTemplate",
							value: T[0],
							closed: T[1] === "`"
						});
						continue;
					}
					break;
				case "JSXTag":
				case "JSXTagEnd":
					if (n.lastIndex = C, T = n.exec(y)) {
						switch (C = n.lastIndex, ie = T[0], T[0]) {
							case "<":
								D.push({ tag: "JSXTag" });
								break;
							case ">":
								D.pop(), w === "/" || ne.tag === "JSXTagEnd" ? (ie = "?JSX", E = !0) : D.push({ tag: "JSXChildren" });
								break;
							case "{":
								D.push({
									tag: "InterpolationInJSX",
									nesting: x.length
								}), ie = "?InterpolationInJSX", E = !1;
								break;
							case "/": w === "<" && (D.pop(), D[D.length - 1].tag === "JSXChildren" && D.pop(), D.push({ tag: "JSXTagEnd" }));
						}
						w = ie, yield {
							type: "JSXPunctuator",
							value: T[0]
						};
						continue;
					}
					if (t.lastIndex = C, T = t.exec(y)) {
						C = t.lastIndex, w = T[0], yield {
							type: "JSXIdentifier",
							value: T[0]
						};
						continue;
					}
					if (r.lastIndex = C, T = r.exec(y)) {
						C = r.lastIndex, w = T[0], yield {
							type: "JSXString",
							value: T[0],
							closed: T[2] !== void 0
						};
						continue;
					}
					break;
				case "JSXChildren":
					if (i.lastIndex = C, T = i.exec(y)) {
						C = i.lastIndex, w = T[0], yield {
							type: "JSXText",
							value: T[0]
						};
						continue;
					}
					switch (y[C]) {
						case "<":
							D.push({ tag: "JSXTag" }), C++, w = "<", yield {
								type: "JSXPunctuator",
								value: "<"
							};
							continue;
						case "{":
							D.push({
								tag: "InterpolationInJSX",
								nesting: x.length
							}), C++, w = "?InterpolationInJSX", E = !1, yield {
								type: "JSXPunctuator",
								value: "{"
							};
							continue;
					}
			}
			v.lastIndex = C, (T = v.exec(y)) ? (C = v.lastIndex, yield {
				type: "WhiteSpace",
				value: T[0]
			}) : (s.lastIndex = C, (T = s.exec(y)) ? (C = s.lastIndex, E = !1, o.test(w) && (w = "?NoLineTerminatorHere"), yield {
				type: "LineTerminatorSequence",
				value: T[0]
			}) : (c.lastIndex = C, (T = c.exec(y)) ? (C = c.lastIndex, l.test(T[0]) && (E = !1, o.test(w) && (w = "?NoLineTerminatorHere")), yield {
				type: "MultiLineComment",
				value: T[0],
				closed: T[1] !== void 0
			}) : (p.lastIndex = C, (T = p.exec(y)) ? (C = p.lastIndex, E = !1, yield {
				type: "SingleLineComment",
				value: T[0]
			}) : (S = String.fromCodePoint(y.codePointAt(C)), C += S.length, w = S, E = !1, yield {
				type: ne.tag.startsWith("JSX") ? "JSXInvalid" : "Invalid",
				value: S
			}))));
		}
	}, rg;
}
Oi(ag());
var og = {
	keyword: /* @__PURE__ */ "break.case.catch.continue.debugger.default.do.else.finally.for.function.if.return.switch.throw.try.var.const.while.with.new.this.super.class.extends.export.import.null.true.false.in.instanceof.typeof.void.delete".split("."),
	strict: [
		"implements",
		"interface",
		"let",
		"package",
		"private",
		"protected",
		"public",
		"static",
		"yield"
	]
};
new Set(og.keyword), new Set(og.strict);
var sg = Object.entries({
	reset: [0, 0],
	bold: [
		1,
		22,
		"\x1B[22m\x1B[1m"
	],
	dim: [
		2,
		22,
		"\x1B[22m\x1B[2m"
	],
	italic: [3, 23],
	underline: [4, 24],
	inverse: [7, 27],
	hidden: [8, 28],
	strikethrough: [9, 29],
	black: [30, 39],
	red: [31, 39],
	green: [32, 39],
	yellow: [33, 39],
	blue: [34, 39],
	magenta: [35, 39],
	cyan: [36, 39],
	white: [37, 39],
	gray: [90, 39],
	bgBlack: [40, 49],
	bgRed: [41, 49],
	bgGreen: [42, 49],
	bgYellow: [43, 49],
	bgBlue: [44, 49],
	bgMagenta: [45, 49],
	bgCyan: [46, 49],
	bgWhite: [47, 49],
	blackBright: [90, 39],
	redBright: [91, 39],
	greenBright: [92, 39],
	yellowBright: [93, 39],
	blueBright: [94, 39],
	magentaBright: [95, 39],
	cyanBright: [96, 39],
	whiteBright: [97, 39],
	bgBlackBright: [100, 49],
	bgRedBright: [101, 49],
	bgGreenBright: [102, 49],
	bgYellowBright: [103, 49],
	bgBlueBright: [104, 49],
	bgMagentaBright: [105, 49],
	bgCyanBright: [106, 49],
	bgWhiteBright: [107, 49]
});
function cg(e) {
	return String(e);
}
cg.open = "", cg.close = "", sg.reduce((e, [t]) => (e[t] = cg, e), { isColorSupported: !1 });
function lg(e = !1) {
	let t = typeof process < "u" ? process : void 0, n = t?.env || {}, r = t?.argv || [];
	return !("NO_COLOR" in n || r.includes("--no-color")) && ("FORCE_COLOR" in n || r.includes("--color") || t?.platform === "win32" || e && n.TERM !== "dumb" || "CI" in n) || typeof window < "u" && !!window.chrome;
}
function ug(e = !1) {
	let t = lg(e), n = (e, t, n, r) => {
		let i = "", a = 0;
		do
			i += e.substring(a, r) + n, a = r + t.length, r = e.indexOf(t, a);
		while (~r);
		return i + e.substring(a);
	}, r = (e, t, r = e) => {
		let i = (i) => {
			let a = String(i), o = a.indexOf(t, e.length);
			return ~o ? e + n(a, t, r, o) + t : e + a + t;
		};
		return i.open = e, i.close = t, i;
	}, i = { isColorSupported: t }, a = (e) => `\x1B[${e}m`;
	for (let [e, n] of sg) i[e] = t ? r(a(n[0]), a(n[1]), n[2]) : cg;
	return i;
}
var dg = ug();
function fg(e, t) {
	if (!e) throw Error(t);
}
function pg(e, t) {
	return typeof t === e;
}
function mg(e) {
	return e instanceof Promise;
}
function hg(e, t, n) {
	Object.defineProperty(e, t, n);
}
function gg(e, t, n) {
	hg(e, t, {
		value: n,
		configurable: !0,
		writable: !0
	});
}
var _g = /* @__PURE__ */ Symbol.for("tinyspy:spy"), vg = /* @__PURE__ */ new Set(), yg = (e) => {
	e.called = !1, e.callCount = 0, e.calls = [], e.results = [], e.resolves = [], e.next = [];
}, bg = (e) => (hg(e, _g, { value: { reset: () => yg(e[_g]) } }), e[_g]), xg = (e) => e[_g] || bg(e);
function Sg(e) {
	fg(pg("function", e) || pg("undefined", e), "cannot spy on a non-function value");
	let t = function(...e) {
		let n = xg(t);
		n.called = !0, n.callCount++, n.calls.push(e);
		let r = n.next.shift();
		if (r) {
			n.results.push(r);
			let [e, t] = r;
			if (e === "ok") return t;
			throw t;
		}
		let i, a = "ok", o = n.results.length;
		if (n.impl) try {
			i = new.target ? Reflect.construct(n.impl, e, new.target) : n.impl.apply(this, e), a = "ok";
		} catch (e) {
			throw i = e, a = "error", n.results.push([a, e]), e;
		}
		let s = [a, i];
		return mg(i) && i.then((e) => n.resolves[o] = ["ok", e], (e) => n.resolves[o] = ["error", e]), n.results.push(s), i;
	};
	gg(t, "_isMockFunction", !0), gg(t, "length", e ? e.length : 0), gg(t, "name", e && e.name || "spy");
	let n = xg(t);
	return n.reset(), n.impl = e, t;
}
function Cg(e) {
	return !!e && e._isMockFunction === !0;
}
var wg = (e, t) => {
	let n = Object.getOwnPropertyDescriptor(e, t);
	if (n) return [e, n];
	let r = Object.getPrototypeOf(e);
	for (; r !== null;) {
		let e = Object.getOwnPropertyDescriptor(r, t);
		if (e) return [r, e];
		r = Object.getPrototypeOf(r);
	}
}, Tg = (e, t) => {
	t != null && typeof t == "function" && t.prototype != null && Object.setPrototypeOf(e.prototype, t.prototype);
};
function Eg(e, t, n) {
	fg(!pg("undefined", e), "spyOn could not find an object to spy upon"), fg(pg("object", e) || pg("function", e), "cannot spyOn on a primitive value");
	let [r, i] = (() => {
		if (!pg("object", t)) return [t, "value"];
		if ("getter" in t && "setter" in t) throw Error("cannot spy on both getter and setter");
		if ("getter" in t) return [t.getter, "get"];
		if ("setter" in t) return [t.setter, "set"];
		throw Error("specify getter or setter to spy on");
	})(), [a, o] = wg(e, r) || [];
	fg(o || r in e, `${String(r)} does not exist`);
	let s = !1;
	i === "value" && o && !o.value && o.get && (i = "get", s = !0, n = o.get());
	let c;
	c = o ? o[i] : i === "value" ? e[r] : () => e[r], c && Ag(c) && (c = c[_g].getOriginal());
	let l = (t) => {
		let { value: n, ...a } = o || {
			configurable: !0,
			writable: !0
		};
		i !== "value" && delete a.writable, a[i] = t, hg(e, r, a);
	}, u = () => {
		a === e ? o && !c ? hg(e, r, o) : l(c) : Reflect.deleteProperty(e, r);
	};
	n ||= c;
	let d = kg(Sg(n), n);
	i === "value" && Tg(d, c);
	let f = d[_g];
	return gg(f, "restore", u), gg(f, "getOriginal", () => s ? c() : c), gg(f, "willCall", (e) => (f.impl = e, d)), l(s ? () => (Tg(d, n), d) : d), vg.add(d), d;
}
var Dg = /* @__PURE__ */ new Set([
	"length",
	"name",
	"prototype"
]);
function Og(e) {
	let t = /* @__PURE__ */ new Set(), n = {};
	for (; e && e !== Object.prototype && e !== Function.prototype;) {
		let r = [...Object.getOwnPropertyNames(e), ...Object.getOwnPropertySymbols(e)];
		for (let i of r) n[i] || Dg.has(i) || (t.add(i), n[i] = Object.getOwnPropertyDescriptor(e, i));
		e = Object.getPrototypeOf(e);
	}
	return {
		properties: t,
		descriptors: n
	};
}
function kg(e, t) {
	if (!t || _g in t) return e;
	let { properties: n, descriptors: r } = Og(t);
	for (let t of n) {
		let n = r[t];
		wg(e, t) || hg(e, t, n);
	}
	return e;
}
function Ag(e) {
	return Cg(e) && "getOriginal" in e[_g];
}
var jg = /* @__PURE__ */ new Set();
function Mg(e) {
	return typeof e == "function" && "_isMockFunction" in e && e._isMockFunction;
}
function Ng(e, t, n) {
	let r = n ? { [{
		get: "getter",
		set: "setter"
	}[n]]: t } : t, i, a = Lg(e, t), o = a && a[n || "value"];
	Mg(o) && (i = o.mock._state());
	try {
		let t = Fg(Eg(e, r));
		return i && t.mock._state(i), t;
	} catch (t) {
		throw t instanceof TypeError && Symbol.toStringTag && e[Symbol.toStringTag] === "Module" && (t.message.includes("Cannot redefine property") || t.message.includes("Cannot replace module namespace") || t.message.includes("can't redefine non-configurable property")) ? TypeError(`Cannot spy on export "${String(r)}". Module namespace is not configurable in ESM. See: https://vitest.dev/guide/browser/#limitations`, { cause: t }) : t;
	}
}
var Pg = 0;
function Fg(e) {
	let t = e, n, r = [], i = !1, a = [], o = [], s = [], c = xg(e), l = {
		get calls() {
			return c.calls;
		},
		get contexts() {
			return o;
		},
		get instances() {
			return a;
		},
		get invocationCallOrder() {
			return s;
		},
		get results() {
			return c.results.map(([e, t]) => ({
				type: e === "error" ? "throw" : "return",
				value: t
			}));
		},
		get settledResults() {
			return c.resolves.map(([e, t]) => ({
				type: e === "error" ? "rejected" : "fulfilled",
				value: t
			}));
		},
		get lastCall() {
			return c.calls[c.calls.length - 1];
		},
		_state(e) {
			return e && (n = e.implementation, r = e.onceImplementations, i = e.implementationChangedTemporarily), {
				implementation: n,
				onceImplementations: r,
				implementationChangedTemporarily: i
			};
		}
	};
	function u(...e) {
		return a.push(this), o.push(this), s.push(++Pg), (i ? n : r.shift() || n || c.getOriginal() || (() => {})).apply(this, e);
	}
	let d = t.name;
	t.getMockName = () => d || "vi.fn()", t.mockName = (e) => (d = e, t), t.mockClear = () => (c.reset(), a = [], o = [], s = [], t), t.mockReset = () => (t.mockClear(), n = void 0, r = [], t), t.mockRestore = () => (t.mockReset(), c.restore(), t), Symbol.dispose && (t[Symbol.dispose] = () => t.mockRestore()), t.getMockImplementation = () => i ? n : r.at(0) || n, t.mockImplementation = (e) => (n = e, c.willCall(u), t), t.mockImplementationOnce = (e) => (r.push(e), t);
	function f(e, r) {
		let a = n;
		n = e, c.willCall(u), i = !0;
		let o = () => {
			n = a, i = !1;
		}, s = r();
		return typeof s == "object" && s && typeof s.then == "function" ? s.then(() => (o(), t)) : (o(), t);
	}
	return t.withImplementation = f, t.mockReturnThis = () => t.mockImplementation(function() {
		return this;
	}), t.mockReturnValue = (e) => t.mockImplementation(() => e), t.mockReturnValueOnce = (e) => t.mockImplementationOnce(() => e), t.mockResolvedValue = (e) => t.mockImplementation(() => Promise.resolve(e)), t.mockResolvedValueOnce = (e) => t.mockImplementationOnce(() => Promise.resolve(e)), t.mockRejectedValue = (e) => t.mockImplementation(() => Promise.reject(e)), t.mockRejectedValueOnce = (e) => t.mockImplementationOnce(() => Promise.reject(e)), Object.defineProperty(t, "mock", { get: () => l }), c.willCall(u), jg.add(t), t;
}
function Ig(e) {
	let t = Fg(Eg({ spy: e || function() {} }, "spy"));
	return e && t.mockImplementation(e), t;
}
function Lg(e, t) {
	let n = Object.getOwnPropertyDescriptor(e, t);
	if (n) return n;
	let r = Object.getPrototypeOf(e);
	for (; r !== null;) {
		let e = Object.getOwnPropertyDescriptor(r, t);
		if (e) return e;
		r = Object.getPrototypeOf(r);
	}
}
var Rg = /* @__PURE__ */ Symbol.for("matchers-object"), zg = /* @__PURE__ */ Symbol.for("$$jest-matchers-object-storybook"), Bg = /* @__PURE__ */ Symbol.for("expect-global"), Vg = /* @__PURE__ */ Symbol.for("asymmetric-matchers-object"), Hg = {
	toSatisfy(e, t, n) {
		let { printReceived: r, printExpected: i, matcherHint: a } = this.utils, o = t(e);
		return {
			pass: o,
			message: () => o ? `${a(".not.toSatisfy", "received", "")}

Expected value to not satisfy:
${n || i(t)}
Received:
${r(e)}` : `${a(".toSatisfy", "received", "")}

Expected value to satisfy:
${n || i(t)}

Received:
${r(e)}`
		};
	},
	toBeOneOf(e, t) {
		let { equals: n, customTesters: r } = this, { printReceived: i, printExpected: a, matcherHint: o } = this.utils;
		if (!Array.isArray(t)) throw TypeError(`You must provide an array to ${o(".toBeOneOf")}, not '${typeof t}'.`);
		let s = t.length === 0 || t.some((t) => n(t, e, r));
		return {
			pass: s,
			message: () => s ? `${o(".not.toBeOneOf", "received", "")}

Expected value to not be one of:
${a(t)}
Received:
${i(e)}` : `${o(".toBeOneOf", "received", "")}

Expected value to be one of:
${a(t)}

Received:
${i(e)}`
		};
	}
}, Ug = dg.green, Wg = dg.red, Gg = dg.inverse, Kg = dg.bold, qg = dg.dim;
function Jg(e, t = "received", n = "expected", r = {}) {
	let { comment: i = "", isDirectExpectCall: a = !1, isNot: o = !1, promise: s = "", secondArgument: c = "", expectedColor: l = Ug, receivedColor: u = Wg, secondArgumentColor: d = Ug } = r, f = "", p = "expect";
	return !a && t !== "" && (f += qg(`${p}(`) + u(t), p = ")"), s !== "" && (f += qg(`${p}.`) + s, p = ""), o && (f += `${qg(`${p}.`)}not`, p = ""), e.includes(".") ? p += e : (f += qg(`${p}.`) + e, p = ""), n === "" ? p += "()" : (f += qg(`${p}(`) + l(n), c && (f += qg(", ") + d(c)), p = ")"), i !== "" && (p += ` // ${i}`), p !== "" && (f += qg(p)), f;
}
var Yg = "·";
function Xg(e) {
	return e.replace(/\s+$/gm, (e) => Yg.repeat(e.length));
}
function Zg(e) {
	return Wg(Xg(wi(e)));
}
function Qg(e) {
	return Ug(Xg(wi(e)));
}
function $g() {
	return {
		EXPECTED_COLOR: Ug,
		RECEIVED_COLOR: Wg,
		INVERTED_COLOR: Gg,
		BOLD_WEIGHT: Kg,
		DIM_COLOR: qg,
		diff: Ga,
		matcherHint: Jg,
		printReceived: Zg,
		printExpected: Qg,
		printDiffOrStringify: to,
		printWithType: e_
	};
}
function e_(e, t, n) {
	let r = Mi(t);
	return (r !== "null" && r !== "undefined" ? `${e} has type:  ${r}
` : "") + `${e} has value: ${n(t)}`;
}
function t_() {
	return globalThis[zg].customEqualityTesters;
}
function X(e, t, n, r) {
	return n ||= [], i_(e, t, [], [], n, r ? c_ : s_);
}
Function.prototype.toString;
function n_(e) {
	return !!e && typeof e == "object" && "asymmetricMatch" in e && l_("Function", e.asymmetricMatch);
}
function r_(e, t) {
	let n = n_(e), r = n_(t);
	if (!(n && r)) {
		if (n) return e.asymmetricMatch(t);
		if (r) return t.asymmetricMatch(e);
	}
}
function i_(e, t, n, r, i, a) {
	let o = !0, s = r_(e, t);
	if (s !== void 0) return s;
	let c = { equals: X };
	for (let n = 0; n < i.length; n++) {
		let r = i[n].call(c, e, t, i);
		if (r !== void 0) return r;
	}
	if (typeof URL == "function" && e instanceof URL && t instanceof URL) return e.href === t.href;
	if (Object.is(e, t)) return !0;
	if (e === null || t === null) return e === t;
	let l = Object.prototype.toString.call(e);
	if (l !== Object.prototype.toString.call(t)) return !1;
	switch (l) {
		case "[object Boolean]":
		case "[object String]":
		case "[object Number]": return typeof e == typeof t ? typeof e != "object" && typeof t != "object" ? Object.is(e, t) : Object.is(e.valueOf(), t.valueOf()) : !1;
		case "[object Date]": {
			let n = +e, r = +t;
			return n === r || Number.isNaN(n) && Number.isNaN(r);
		}
		case "[object RegExp]": return e.source === t.source && e.flags === t.flags;
		case "[object Temporal.Instant]":
		case "[object Temporal.ZonedDateTime]":
		case "[object Temporal.PlainDateTime]":
		case "[object Temporal.PlainDate]":
		case "[object Temporal.PlainTime]":
		case "[object Temporal.PlainYearMonth]":
		case "[object Temporal.PlainMonthDay]": return e.equals(t);
		case "[object Temporal.Duration]": return e.toString() === t.toString();
	}
	if (typeof e != "object" || typeof t != "object") return !1;
	if (u_(e) && u_(t)) return e.isEqualNode(t);
	let u = n.length;
	for (; u--;) {
		if (n[u] === e) return r[u] === t;
		if (r[u] === t) return !1;
	}
	if (n.push(e), r.push(t), l === "[object Array]" && e.length !== t.length) return !1;
	if (e instanceof Error && t instanceof Error) try {
		return a_(e, t, n, r, i, a);
	} finally {
		n.pop(), r.pop();
	}
	let d = o_(e, a), f, p = d.length;
	if (o_(t, a).length !== p) return !1;
	for (; p--;) if (f = d[p], o = a(t, f) && i_(e[f], t[f], n, r, i, a), !o) return !1;
	return n.pop(), r.pop(), o;
}
function a_(e, t, n, r, i, a) {
	let o = Object.getPrototypeOf(e) === Object.getPrototypeOf(t) && e.name === t.name && e.message === t.message;
	return typeof t.cause < "u" && o && (o = i_(e.cause, t.cause, n, r, i, a)), e instanceof AggregateError && t instanceof AggregateError && o && (o = i_(e.errors, t.errors, n, r, i, a)), o &&= i_({ ...e }, { ...t }, n, r, i, a), o;
}
function o_(e, t) {
	let n = [];
	for (let r in e) t(e, r) && n.push(r);
	return n.concat(Object.getOwnPropertySymbols(e).filter((t) => Object.getOwnPropertyDescriptor(e, t).enumerable));
}
function s_(e, t) {
	return c_(e, t) && e[t] !== void 0;
}
function c_(e, t) {
	return Object.prototype.hasOwnProperty.call(e, t);
}
function l_(e, t) {
	return Object.prototype.toString.apply(t) === `[object ${e}]`;
}
function u_(e) {
	return typeof e == "object" && !!e && "nodeType" in e && typeof e.nodeType == "number" && "nodeName" in e && typeof e.nodeName == "string" && "isEqualNode" in e && typeof e.isEqualNode == "function";
}
var d_ = "@@__IMMUTABLE_KEYED__@@", f_ = "@@__IMMUTABLE_SET__@@", p_ = "@@__IMMUTABLE_LIST__@@", m_ = "@@__IMMUTABLE_ORDERED__@@", h_ = "@@__IMMUTABLE_RECORD__@@";
function g_(e) {
	return !!(e && e[d_] && !e[m_]);
}
function __(e) {
	return !!(e && e[f_] && !e[m_]);
}
function v_(e) {
	return typeof e == "object" && !!e && !Array.isArray(e);
}
function y_(e) {
	return !!(e && v_(e) && e[p_]);
}
function b_(e) {
	return !!(e && v_(e) && e[d_] && e[m_]);
}
function x_(e) {
	return !!(e && v_(e) && e[f_] && e[m_]);
}
function S_(e) {
	return !!(e && v_(e) && e[h_]);
}
var C_ = Symbol.iterator;
function w_(e) {
	return !!(e != null && e[C_]);
}
function T_(e, t, n = [], r = [], i = []) {
	if (typeof e != "object" || typeof t != "object" || Array.isArray(e) || Array.isArray(t) || !w_(e) || !w_(t)) return;
	if (e.constructor !== t.constructor) return !1;
	let a = r.length;
	for (; a--;) if (r[a] === e) return i[a] === t;
	r.push(e), i.push(t);
	let o = [...n.filter((e) => e !== T_), s];
	function s(e, t) {
		return T_(e, t, [...n], [...r], [...i]);
	}
	if (e.size !== void 0) {
		if (e.size !== t.size) return !1;
		if (l_("Set", e) || __(e)) {
			let n = !0;
			for (let r of e) if (!t.has(r)) {
				let e = !1;
				for (let n of t) X(r, n, o) === !0 && (e = !0);
				if (e === !1) {
					n = !1;
					break;
				}
			}
			return r.pop(), i.pop(), n;
		}
		if (l_("Map", e) || g_(e)) {
			let n = !0;
			for (let r of e) if (!t.has(r[0]) || !X(r[1], t.get(r[0]), o)) {
				let e = !1;
				for (let n of t) {
					let t = X(r[0], n[0], o), i = !1;
					t === !0 && (i = X(r[1], n[1], o)), i === !0 && (e = !0);
				}
				if (e === !1) {
					n = !1;
					break;
				}
			}
			return r.pop(), i.pop(), n;
		}
	}
	let c = t[C_]();
	for (let t of e) {
		let e = c.next();
		if (e.done || !X(t, e.value, o)) return !1;
	}
	return !c.next().done || !y_(e) && !b_(e) && !x_(e) && !S_(e) && !X(Object.entries(e), Object.entries(t), o) ? !1 : (r.pop(), i.pop(), !0);
}
function E_(e, t) {
	return !e || typeof e != "object" || e === Object.prototype ? !1 : Object.prototype.hasOwnProperty.call(e, t) || E_(Object.getPrototypeOf(e), t);
}
function D_(e) {
	return Ai(e) && !(e instanceof Error) && !Array.isArray(e) && !(e instanceof Date);
}
function O_(e, t, n = []) {
	let r = n.filter((e) => e !== O_), i = (e = /* @__PURE__ */ new WeakMap()) => (t, n) => {
		if (D_(n)) return Object.keys(n).every((a) => {
			if (n[a] != null && typeof n[a] == "object") {
				if (e.has(n[a])) return X(t[a], n[a], r);
				e.set(n[a], !0);
			}
			let o = t != null && E_(t, a) && X(t[a], n[a], [...r, i(e)]);
			return e.delete(n[a]), o;
		});
	};
	return i()(e, t);
}
function k_(e, t) {
	if (e != null && t != null && e.constructor !== t.constructor) return !1;
}
function A_(e, t) {
	let n = e, r = t;
	if (!(e instanceof DataView && t instanceof DataView)) {
		if (!(e instanceof ArrayBuffer) || !(t instanceof ArrayBuffer)) return;
		try {
			n = new DataView(e), r = new DataView(t);
		} catch {
			return;
		}
	}
	if (n.byteLength !== r.byteLength) return !1;
	for (let e = 0; e < n.byteLength; e++) if (n.getUint8(e) !== r.getUint8(e)) return !1;
	return !0;
}
function j_(e, t, n = []) {
	if (!Array.isArray(e) || !Array.isArray(t)) return;
	let r = Object.keys(e), i = Object.keys(t);
	return X(e, t, n.filter((e) => e !== j_), !0) && X(r, i);
}
function M_(e, t = "#{this}", n = "#{exp}") {
	let r = `expected ${t} to be ${n} // Object.is equality`;
	return ["toStrictEqual", "toEqual"].includes(e) ? `${r}

If it should pass with deep equality, replace "toBe" with "${e}"

Expected: ${t}
Received: serializes to the same string
` : r;
}
function N_(e, t) {
	return `${t} ${e}${t === 1 ? "" : "s"}`;
}
function P_(e) {
	return [...Object.keys(e), ...Object.getOwnPropertySymbols(e).filter((t) => Object.getOwnPropertyDescriptor(e, t)?.enumerable)];
}
function F_(e, t, n) {
	let r = 0, i = (e = /* @__PURE__ */ new WeakMap()) => (t, a) => {
		if (Array.isArray(t)) {
			if (Array.isArray(a) && a.length === t.length) return a.map((n, r) => i(e)(t[r], n));
		} else {
			if (t instanceof Date) return t;
			if (Ai(t) && Ai(a)) {
				if (X(t, a, [
					...n,
					T_,
					O_
				])) return a;
				let o = {};
				e.set(t, o), typeof t.constructor == "function" && typeof t.constructor.name == "string" && Object.defineProperty(o, "constructor", {
					enumerable: !1,
					value: t.constructor
				});
				for (let n of P_(t)) E_(a, n) ? o[n] = e.has(t[n]) ? e.get(t[n]) : i(e)(t[n], a[n]) : e.has(t[n]) || (r += 1, Ai(t[n]) && (r += P_(t[n]).length), i(e)(t[n], a[n]));
				if (P_(o).length > 0) return o;
			}
		}
		return t;
	};
	return {
		subset: i()(e, t),
		stripped: r
	};
}
if (!Object.prototype.hasOwnProperty.call(globalThis, Rg)) {
	let e = /* @__PURE__ */ new WeakMap();
	Object.defineProperty(globalThis, Rg, { get: () => e });
}
if (!Object.prototype.hasOwnProperty.call(globalThis, zg)) {
	let e = /* @__PURE__ */ Object.create(null), t = [];
	Object.defineProperty(globalThis, zg, {
		configurable: !0,
		get: () => ({
			state: globalThis[Rg].get(globalThis[Bg]),
			matchers: e,
			customEqualityTesters: t
		})
	});
}
if (!Object.prototype.hasOwnProperty.call(globalThis, Vg)) {
	let e = /* @__PURE__ */ Object.create(null);
	Object.defineProperty(globalThis, Vg, { get: () => e });
}
function I_(e) {
	return globalThis[Rg].get(e);
}
function L_(e, t) {
	let n = globalThis[Rg], r = n.get(t) || {}, i = Object.defineProperties(r, {
		...Object.getOwnPropertyDescriptors(r),
		...Object.getOwnPropertyDescriptors(e)
	});
	n.set(t, i);
}
var R_ = class {
	$$typeof = /* @__PURE__ */ Symbol.for("jest.asymmetricMatcher");
	constructor(e, t = !1) {
		this.sample = e, this.inverse = t;
	}
	getMatcherContext(e) {
		return {
			...I_(e || globalThis[Bg]),
			equals: X,
			isNot: this.inverse,
			customTesters: t_(),
			utils: {
				...$g(),
				diff: Ga,
				stringify: wi,
				iterableEquality: T_,
				subsetEquality: O_
			}
		};
	}
};
R_.prototype[/* @__PURE__ */ Symbol.for("chai/inspect")] = function(e) {
	let t = wi(this, e.depth, { min: !0 });
	return t.length <= e.truncate ? t : `${this.toString()}{\u2026}`;
};
var z_ = class extends R_ {
	constructor(e, t = !1) {
		if (!l_("String", e)) throw Error("Expected is not a string");
		super(e, t);
	}
	asymmetricMatch(e) {
		let t = l_("String", e) && e.includes(this.sample);
		return this.inverse ? !t : t;
	}
	toString() {
		return `String${this.inverse ? "Not" : ""}Containing`;
	}
	getExpectedType() {
		return "string";
	}
}, B_ = class extends R_ {
	asymmetricMatch(e) {
		return e != null;
	}
	toString() {
		return "Anything";
	}
	toAsymmetricMatcher() {
		return "Anything";
	}
}, V_ = class extends R_ {
	constructor(e, t = !1) {
		super(e, t);
	}
	getPrototype(e) {
		return Object.getPrototypeOf ? Object.getPrototypeOf(e) : e.constructor.prototype === e ? null : e.constructor.prototype;
	}
	hasProperty(e, t) {
		return e ? Object.prototype.hasOwnProperty.call(e, t) ? !0 : this.hasProperty(this.getPrototype(e), t) : !1;
	}
	asymmetricMatch(e) {
		if (typeof this.sample != "object") throw TypeError(`You must provide an object to ${this.toString()}, not '${typeof this.sample}'.`);
		let t = !0, n = this.getMatcherContext();
		for (let r in this.sample) if (!this.hasProperty(e, r) || !X(this.sample[r], e[r], n.customTesters)) {
			t = !1;
			break;
		}
		return this.inverse ? !t : t;
	}
	toString() {
		return `Object${this.inverse ? "Not" : ""}Containing`;
	}
	getExpectedType() {
		return "object";
	}
}, H_ = class extends R_ {
	constructor(e, t = !1) {
		super(e, t);
	}
	asymmetricMatch(e) {
		if (!Array.isArray(this.sample)) throw TypeError(`You must provide an array to ${this.toString()}, not '${typeof this.sample}'.`);
		let t = this.getMatcherContext(), n = this.sample.length === 0 || Array.isArray(e) && this.sample.every((n) => e.some((e) => X(n, e, t.customTesters)));
		return this.inverse ? !n : n;
	}
	toString() {
		return `Array${this.inverse ? "Not" : ""}Containing`;
	}
	getExpectedType() {
		return "array";
	}
}, U_ = class extends R_ {
	constructor(e) {
		if (typeof e > "u") throw TypeError("any() expects to be passed a constructor function. Please pass one or use anything() to match any object.");
		super(e);
	}
	fnNameFor(e) {
		if (e.name) return e.name;
		let t = Function.prototype.toString.call(e).match(/^(?:async)?\s*function\s*(?:\*\s*)?([\w$]+)\s*\(/);
		return t ? t[1] : "<anonymous>";
	}
	asymmetricMatch(e) {
		return this.sample === String ? typeof e == "string" || e instanceof String : this.sample === Number ? typeof e == "number" || e instanceof Number : this.sample === Function ? typeof e == "function" || typeof e == "function" : this.sample === Boolean ? typeof e == "boolean" || e instanceof Boolean : this.sample === BigInt ? typeof e == "bigint" || e instanceof BigInt : this.sample === Symbol ? typeof e == "symbol" || e instanceof Symbol : this.sample === Object ? typeof e == "object" : e instanceof this.sample;
	}
	toString() {
		return "Any";
	}
	getExpectedType() {
		return this.sample === String ? "string" : this.sample === Number ? "number" : this.sample === Function ? "function" : this.sample === Object ? "object" : this.sample === Boolean ? "boolean" : this.fnNameFor(this.sample);
	}
	toAsymmetricMatcher() {
		return `Any<${this.fnNameFor(this.sample)}>`;
	}
}, W_ = class extends R_ {
	constructor(e, t = !1) {
		if (!l_("String", e) && !l_("RegExp", e)) throw Error("Expected is not a String or a RegExp");
		super(new RegExp(e), t);
	}
	asymmetricMatch(e) {
		let t = l_("String", e) && this.sample.test(e);
		return this.inverse ? !t : t;
	}
	toString() {
		return `String${this.inverse ? "Not" : ""}Matching`;
	}
	getExpectedType() {
		return "string";
	}
}, G_ = class extends R_ {
	precision;
	constructor(e, t = 2, n = !1) {
		if (!l_("Number", e)) throw Error("Expected is not a Number");
		if (!l_("Number", t)) throw Error("Precision is not a Number");
		super(e), this.inverse = n, this.precision = t;
	}
	asymmetricMatch(e) {
		if (!l_("Number", e)) return !1;
		let t = !1;
		return t = e === Infinity && this.sample === Infinity || e === -Infinity && this.sample === -Infinity || Math.abs(this.sample - e) < 10 ** -this.precision / 2, this.inverse ? !t : t;
	}
	toString() {
		return `Number${this.inverse ? "Not" : ""}CloseTo`;
	}
	getExpectedType() {
		return "number";
	}
	toAsymmetricMatcher() {
		return [
			this.toString(),
			this.sample,
			`(${N_("digit", this.precision)})`
		].join(" ");
	}
}, K_ = (e, t) => {
	t.addMethod(e.expect, "anything", () => new B_()), t.addMethod(e.expect, "any", (e) => new U_(e)), t.addMethod(e.expect, "stringContaining", (e) => new z_(e)), t.addMethod(e.expect, "objectContaining", (e) => new V_(e)), t.addMethod(e.expect, "arrayContaining", (e) => new H_(e)), t.addMethod(e.expect, "stringMatching", (e) => new W_(e)), t.addMethod(e.expect, "closeTo", (e, t) => new G_(e, t)), e.expect.not = {
		stringContaining: (e) => new z_(e, !0),
		objectContaining: (e) => new V_(e, !0),
		arrayContaining: (e) => new H_(e, !0),
		stringMatching: (e) => new W_(e, !0),
		closeTo: (e, t) => new G_(e, t, !0)
	};
};
function q_(e, t, n) {
	let r = e.flag(t, "negate") ? "not." : "", i = `${e.flag(t, "_name")}(${n ? "expected" : ""})`, a = e.flag(t, "promise");
	return `expect(actual)${a ? `.${a}` : ""}.${r}${i}`;
}
function J_(e, t, n, r) {
	let i = e;
	if (i && t instanceof Promise) {
		t = t.finally(() => {
			if (!i.promises) return;
			let e = i.promises.indexOf(t);
			e !== -1 && i.promises.splice(e, 1);
		}), i.promises ||= [], i.promises.push(t);
		let e = !1;
		return i.onFinished ??= [], i.onFinished.push(() => {
			if (!e) {
				let e = (globalThis.__vitest_worker__?.onFilterStackTrace || ((e) => e || ""))(r.stack);
				console.warn([
					`Promise returned by \`${n}\` was not awaited. `,
					"Vitest currently auto-awaits hanging assertions at the end of the test, but this will cause the test to fail in Vitest 3. ",
					"Please remember to await the assertion.\n",
					e
				].join(""));
			}
		}), {
			then(n, r) {
				return e = !0, t.then(n, r);
			},
			catch(e) {
				return t.catch(e);
			},
			finally(e) {
				return t.finally(e);
			},
			[Symbol.toStringTag]: "Promise"
		};
	}
	return t;
}
function Y_(e, t) {
	var n;
	e.result ||= { state: "fail" }, e.result.state = "fail", (n = e.result).errors || (n.errors = []), e.result.errors.push(vo(t));
}
function X_(e, t, n) {
	return function(...r) {
		if (t !== "withTest" && e.flag(this, "_name", t), !e.flag(this, "soft")) return n.apply(this, r);
		let i = e.flag(this, "vitest-test");
		if (!i) throw Error("expect.soft() can only be used inside a test");
		try {
			let e = n.apply(this, r);
			return e && typeof e == "object" && typeof e.then == "function" ? e.then(Ri, (e) => {
				Y_(i, e);
			}) : e;
		} catch (e) {
			Y_(i, e);
		}
	};
}
var Z_ = (e, t) => {
	let { AssertionError: n } = e, r = t_();
	function i(n, r) {
		let i = (n) => {
			let i = X_(t, n, r);
			t.addMethod(e.Assertion.prototype, n, i), t.addMethod(globalThis[zg].matchers, n, i);
		};
		Array.isArray(n) ? n.forEach((e) => i(e)) : i(n);
	}
	[
		"throw",
		"throws",
		"Throw"
	].forEach((r) => {
		t.overwriteMethod(e.Assertion.prototype, r, (e) => function(...r) {
			let i = t.flag(this, "promise"), a = t.flag(this, "object"), o = t.flag(this, "negate");
			if (i === "rejects") t.flag(this, "object", () => {
				throw a;
			});
			else if (i === "resolves" && typeof a != "function") {
				if (o) return;
				{
					let e = t.flag(this, "message") || "expected promise to throw an error, but it didn't";
					throw new n(e, { showDiff: !1 }, t.flag(this, "ssfi"));
				}
			}
			e.apply(this, r);
		});
	}), i("withTest", function(e) {
		return t.flag(this, "vitest-test", e), this;
	}), i("toEqual", function(e) {
		let n = t.flag(this, "object"), i = X(n, e, [...r, T_]);
		return this.assert(i, "expected #{this} to deeply equal #{exp}", "expected #{this} to not deeply equal #{exp}", e, n);
	}), i("toStrictEqual", function(e) {
		let n = t.flag(this, "object"), i = X(n, e, [
			...r,
			T_,
			k_,
			j_,
			A_
		], !0);
		return this.assert(i, "expected #{this} to strictly equal #{exp}", "expected #{this} to not strictly equal #{exp}", e, n);
	}), i("toBe", function(e) {
		let t = this._obj, n = Object.is(t, e), i = "";
		return n || (X(t, e, [
			...r,
			T_,
			k_,
			j_,
			A_
		], !0) ? i = "toStrictEqual" : X(t, e, [...r, T_]) && (i = "toEqual")), this.assert(n, M_(i), "expected #{this} not to be #{exp} // Object.is equality", e, t);
	}), i("toMatchObject", function(e) {
		let i = this._obj, a = X(i, e, [
			...r,
			T_,
			O_
		]), o = t.flag(this, "negate"), { subset: s, stripped: c } = F_(i, e, r);
		if (a && o || !a && !o) {
			let r = t.getMessage(this, [
				a,
				"expected #{this} to match object #{exp}",
				"expected #{this} to not match object #{exp}",
				e,
				s,
				!1
			]), i = c === 0 ? r : `${r}
(${c} matching ${c === 1 ? "property" : "properties"} omitted from actual)`;
			throw new n(i, {
				showDiff: !0,
				expected: e,
				actual: s
			});
		}
	}), i("toMatch", function(e) {
		let t = this._obj;
		if (typeof t != "string") throw TypeError(`.toMatch() expects to receive a string, but got ${typeof t}`);
		return this.assert(typeof e == "string" ? t.includes(e) : t.match(e), "expected #{this} to match #{exp}", "expected #{this} not to match #{exp}", e, t);
	}), i("toContain", function(e) {
		let n = this._obj;
		if (typeof Node < "u" && n instanceof Node) {
			if (!(e instanceof Node)) throw TypeError(`toContain() expected a DOM node as the argument, but got ${typeof e}`);
			return this.assert(n.contains(e), "expected #{this} to contain element #{exp}", "expected #{this} not to contain element #{exp}", e, n);
		}
		if (typeof DOMTokenList < "u" && n instanceof DOMTokenList) {
			ki(e, "class name", ["string"]);
			let r = t.flag(this, "negate") ? n.value.replace(e, "").trim() : `${n.value} ${e}`;
			return this.assert(n.contains(e), `expected "${n.value}" to contain "${e}"`, `expected "${n.value}" not to contain "${e}"`, r, n.value);
		}
		return typeof n == "string" && typeof e == "string" ? this.assert(n.includes(e), "expected #{this} to contain #{exp}", "expected #{this} not to contain #{exp}", e, n) : (n != null && typeof n != "string" && t.flag(this, "object", Array.from(n)), this.contain(e));
	}), i("toContainEqual", function(e) {
		let n = t.flag(this, "object"), i = Array.from(n).findIndex((t) => X(t, e, r));
		this.assert(i !== -1, "expected #{this} to deep equally contain #{exp}", "expected #{this} to not deep equally contain #{exp}", e);
	}), i("toBeTruthy", function() {
		let e = t.flag(this, "object");
		this.assert(!!e, "expected #{this} to be truthy", "expected #{this} to not be truthy", !0, e);
	}), i("toBeFalsy", function() {
		let e = t.flag(this, "object");
		this.assert(!e, "expected #{this} to be falsy", "expected #{this} to not be falsy", !1, e);
	}), i("toBeGreaterThan", function(e) {
		let t = this._obj;
		return ki(t, "actual", ["number", "bigint"]), ki(e, "expected", ["number", "bigint"]), this.assert(t > e, `expected ${t} to be greater than ${e}`, `expected ${t} to be not greater than ${e}`, e, t, !1);
	}), i("toBeGreaterThanOrEqual", function(e) {
		let t = this._obj;
		return ki(t, "actual", ["number", "bigint"]), ki(e, "expected", ["number", "bigint"]), this.assert(t >= e, `expected ${t} to be greater than or equal to ${e}`, `expected ${t} to be not greater than or equal to ${e}`, e, t, !1);
	}), i("toBeLessThan", function(e) {
		let t = this._obj;
		return ki(t, "actual", ["number", "bigint"]), ki(e, "expected", ["number", "bigint"]), this.assert(t < e, `expected ${t} to be less than ${e}`, `expected ${t} to be not less than ${e}`, e, t, !1);
	}), i("toBeLessThanOrEqual", function(e) {
		let t = this._obj;
		return ki(t, "actual", ["number", "bigint"]), ki(e, "expected", ["number", "bigint"]), this.assert(t <= e, `expected ${t} to be less than or equal to ${e}`, `expected ${t} to be not less than or equal to ${e}`, e, t, !1);
	}), i("toBeNaN", function() {
		let e = t.flag(this, "object");
		this.assert(Number.isNaN(e), "expected #{this} to be NaN", "expected #{this} not to be NaN", NaN, e);
	}), i("toBeUndefined", function() {
		let e = t.flag(this, "object");
		this.assert(e === void 0, "expected #{this} to be undefined", "expected #{this} not to be undefined", void 0, e);
	}), i("toBeNull", function() {
		let e = t.flag(this, "object");
		this.assert(e === null, "expected #{this} to be null", "expected #{this} not to be null", null, e);
	}), i("toBeDefined", function() {
		let e = t.flag(this, "object");
		this.assert(typeof e < "u", "expected #{this} to be defined", "expected #{this} to be undefined", e);
	}), i("toBeTypeOf", function(e) {
		let t = typeof this._obj, n = e === t;
		return this.assert(n, "expected #{this} to be type of #{exp}", "expected #{this} not to be type of #{exp}", e, t);
	}), i("toBeInstanceOf", function(e) {
		return this.instanceOf(e);
	}), i("toHaveLength", function(e) {
		return this.have.length(e);
	}), i("toHaveProperty", function(...e) {
		Array.isArray(e[0]) && (e[0] = e[0].map((e) => String(e).replace(/([.[\]])/g, "\\$1")).join("."));
		let n = this._obj, [i, a] = e, { value: o, exists: s } = Object.prototype.hasOwnProperty.call(n, i) ? {
			value: n[i],
			exists: !0
		} : t.getPathInfo(n, i), c = s && (e.length === 1 || X(a, o, r)), l = e.length === 1 ? "" : ` with value ${t.objDisplay(a)}`;
		return this.assert(c, `expected #{this} to have property "${i}"${l}`, `expected #{this} to not have property "${i}"${l}`, a, s ? o : void 0);
	}), i("toBeCloseTo", function(e, t = 2) {
		let n = this._obj, r = !1, i = 0, a = 0;
		return e === Infinity && n === Infinity || e === -Infinity && n === -Infinity ? r = !0 : (i = 10 ** -t / 2, a = Math.abs(n - e), r = a < i), this.assert(r, `expected #{this} to be close to #{exp}, received difference is ${a}, but expected ${i}`, `expected #{this} to not be close to #{exp}, received difference is ${a}, but expected ${i}`, e, n, !1);
	});
	function a(e) {
		if (!Mg(e._obj)) throw TypeError(`${t.inspect(e._obj)} is not a spy or a call to a spy!`);
	}
	function o(e) {
		return a(e), e._obj;
	}
	i(["toHaveBeenCalledTimes", "toBeCalledTimes"], function(e) {
		let t = o(this), n = t.getMockName(), r = t.mock.calls.length;
		return this.assert(r === e, `expected "${n}" to be called #{exp} times, but got ${r} times`, `expected "${n}" to not be called #{exp} times`, e, r, !1);
	}), i("toHaveBeenCalledOnce", function() {
		let e = o(this), t = e.getMockName(), n = e.mock.calls.length;
		return this.assert(n === 1, `expected "${t}" to be called once, but got ${n} times`, `expected "${t}" to not be called once`, 1, n, !1);
	}), i(["toHaveBeenCalled", "toBeCalled"], function() {
		let e = o(this), r = e.getMockName(), i = e.mock.calls.length, a = i > 0, s = t.flag(this, "negate"), c = t.getMessage(this, [
			a,
			`expected "${r}" to be called at least once`,
			`expected "${r}" to not be called at all, but actually been called ${i} times`,
			!0,
			a
		]);
		if (a && s && (c = $_(e, c)), a && s || !a && !s) throw new n(c);
	});
	function s(e, t) {
		return e.length === t.length && e.every((e, n) => X(e, t[n], [...r, T_]));
	}
	i(["toHaveBeenCalledWith", "toBeCalledWith"], function(...e) {
		let r = o(this), i = r.getMockName(), a = r.mock.calls.some((t) => s(t, e)), c = t.flag(this, "negate"), l = t.getMessage(this, [
			a,
			`expected "${i}" to be called with arguments: #{exp}`,
			`expected "${i}" to not be called with arguments: #{exp}`,
			e
		]);
		if (a && c || !a && !c) throw new n($_(r, l, e));
	}), i("toHaveBeenCalledExactlyOnceWith", function(...e) {
		let r = o(this), i = r.getMockName(), a = r.mock.calls.length, c = r.mock.calls.some((t) => s(t, e)) && a === 1, l = t.flag(this, "negate"), u = t.getMessage(this, [
			c,
			`expected "${i}" to be called once with arguments: #{exp}`,
			`expected "${i}" to not be called once with arguments: #{exp}`,
			e
		]);
		if (c && l || !c && !l) throw new n($_(r, u, e));
	}), i(["toHaveBeenNthCalledWith", "nthCalledWith"], function(e, ...t) {
		let n = o(this), r = n.getMockName(), i = n.mock.calls[e - 1], a = n.mock.calls.length, c = e <= a;
		this.assert(i && s(i, t), `expected ${Q_(e)} "${r}" call to have been called with #{exp}${c ? "" : `, but called only ${a} times`}`, `expected ${Q_(e)} "${r}" call to not have been called with #{exp}`, t, i, c);
	}), i(["toHaveBeenLastCalledWith", "lastCalledWith"], function(...e) {
		let t = o(this), n = t.getMockName(), r = t.mock.calls[t.mock.calls.length - 1];
		this.assert(r && s(r, e), `expected last "${n}" call to have been called with #{exp}`, `expected last "${n}" call to not have been called with #{exp}`, e, r);
	});
	function c(e, t, n) {
		let r = e.mock.invocationCallOrder, i = t.mock.invocationCallOrder;
		return r.length === 0 ? !n : i.length !== 0 && r[0] < i[0];
	}
	i(["toHaveBeenCalledBefore"], function(e, n = !0) {
		let r = o(this);
		if (!Mg(e)) throw TypeError(`${t.inspect(e)} is not a spy or a call to a spy`);
		this.assert(c(r, e, n), `expected "${r.getMockName()}" to have been called before "${e.getMockName()}"`, `expected "${r.getMockName()}" to not have been called before "${e.getMockName()}"`, e, r);
	}), i(["toHaveBeenCalledAfter"], function(e, n = !0) {
		let r = o(this);
		if (!Mg(e)) throw TypeError(`${t.inspect(e)} is not a spy or a call to a spy`);
		this.assert(c(e, r, n), `expected "${r.getMockName()}" to have been called after "${e.getMockName()}"`, `expected "${r.getMockName()}" to not have been called after "${e.getMockName()}"`, e, r);
	}), i(["toThrow", "toThrowError"], function(e) {
		if (typeof e == "string" || typeof e > "u" || e instanceof RegExp) return this.throws(e === "" ? /^$/ : e);
		let i = this._obj, a = t.flag(this, "promise"), o = t.flag(this, "negate"), s = null;
		if (a === "rejects") s = i;
		else if (a === "resolves" && typeof i != "function") {
			if (o) return;
			{
				let e = t.flag(this, "message") || "expected promise to throw an error, but it didn't";
				throw new n(e, { showDiff: !1 }, t.flag(this, "ssfi"));
			}
		} else {
			let e = !1;
			try {
				i();
			} catch (t) {
				e = !0, s = t;
			}
			if (!e && !o) {
				let e = t.flag(this, "message") || "expected function to throw an error, but it didn't";
				throw new n(e, { showDiff: !1 }, t.flag(this, "ssfi"));
			}
		}
		if (typeof e == "function") {
			let t = e.name || e.prototype.constructor.name;
			return this.assert(s && s instanceof e, `expected error to be instance of ${t}`, `expected error not to be instance of ${t}`, e, s);
		}
		if (e instanceof Error) {
			let t = X(s, e, [...r, T_]);
			return this.assert(t, "expected a thrown error to be #{exp}", "expected a thrown error not to be #{exp}", e, s);
		}
		if (typeof e == "object" && "asymmetricMatch" in e && typeof e.asymmetricMatch == "function") {
			let t = e;
			return this.assert(s && t.asymmetricMatch(s), "expected error to match asymmetric matcher", "expected error not to match asymmetric matcher", t, s);
		}
		throw Error(`"toThrow" expects string, RegExp, function, Error instance or asymmetric matcher, got "${typeof e}"`);
	}), [{
		name: "toHaveResolved",
		condition: (e) => e.mock.settledResults.length > 0 && e.mock.settledResults.some(({ type: e }) => e === "fulfilled"),
		action: "resolved"
	}, {
		name: ["toHaveReturned", "toReturn"],
		condition: (e) => e.mock.calls.length > 0 && e.mock.results.some(({ type: e }) => e !== "throw"),
		action: "called"
	}].forEach(({ name: e, condition: t, action: n }) => {
		i(e, function() {
			let e = o(this), r = e.getMockName(), i = t(e);
			this.assert(i, `expected "${r}" to be successfully ${n} at least once`, `expected "${r}" to not be successfully ${n}`, i, !i, !1);
		});
	}), [{
		name: "toHaveResolvedTimes",
		condition: (e, t) => e.mock.settledResults.reduce((e, { type: t }) => t === "fulfilled" ? ++e : e, 0) === t,
		action: "resolved"
	}, {
		name: ["toHaveReturnedTimes", "toReturnTimes"],
		condition: (e, t) => e.mock.results.reduce((e, { type: t }) => t === "throw" ? e : ++e, 0) === t,
		action: "called"
	}].forEach(({ name: e, condition: t, action: n }) => {
		i(e, function(e) {
			let r = o(this), i = r.getMockName(), a = t(r, e);
			this.assert(a, `expected "${i}" to be successfully ${n} ${e} times`, `expected "${i}" to not be successfully ${n} ${e} times`, `expected resolved times: ${e}`, `received resolved times: ${a}`, !1);
		});
	}), [{
		name: "toHaveResolvedWith",
		condition: (e, t) => e.mock.settledResults.some(({ type: e, value: n }) => e === "fulfilled" && X(t, n)),
		action: "resolve"
	}, {
		name: ["toHaveReturnedWith", "toReturnWith"],
		condition: (e, t) => e.mock.results.some(({ type: e, value: n }) => e === "return" && X(t, n)),
		action: "return"
	}].forEach(({ name: e, condition: r, action: a }) => {
		i(e, function(e) {
			let i = o(this), s = r(i, e), c = t.flag(this, "negate");
			if (s && c || !s && !c) {
				let r = i.getMockName(), o = t.getMessage(this, [
					s,
					`expected "${r}" to ${a} with: #{exp} at least once`,
					`expected "${r}" to not ${a} with: #{exp}`,
					e
				]), c = a === "return" ? i.mock.results : i.mock.settledResults;
				throw new n(ev(i, c, o, e));
			}
		});
	}), [{
		name: "toHaveLastResolvedWith",
		condition: (e, t) => {
			let n = e.mock.settledResults[e.mock.settledResults.length - 1];
			return n && n.type === "fulfilled" && X(n.value, t);
		},
		action: "resolve"
	}, {
		name: ["toHaveLastReturnedWith", "lastReturnedWith"],
		condition: (e, t) => {
			let n = e.mock.results[e.mock.results.length - 1];
			return n && n.type === "return" && X(n.value, t);
		},
		action: "return"
	}].forEach(({ name: e, condition: t, action: n }) => {
		i(e, function(e) {
			let r = o(this), i = n === "return" ? r.mock.results : r.mock.settledResults, a = i[i.length - 1], s = r.getMockName();
			this.assert(t(r, e), `expected last "${s}" call to ${n} #{exp}`, `expected last "${s}" call to not ${n} #{exp}`, e, a?.value);
		});
	}), [{
		name: "toHaveNthResolvedWith",
		condition: (e, t, n) => {
			let r = e.mock.settledResults[t - 1];
			return r && r.type === "fulfilled" && X(r.value, n);
		},
		action: "resolve"
	}, {
		name: ["toHaveNthReturnedWith", "nthReturnedWith"],
		condition: (e, t, n) => {
			let r = e.mock.results[t - 1];
			return r && r.type === "return" && X(r.value, n);
		},
		action: "return"
	}].forEach(({ name: e, condition: t, action: n }) => {
		i(e, function(e, r) {
			let i = o(this), a = i.getMockName(), s = (n === "return" ? i.mock.results : i.mock.settledResults)[e - 1], c = `${Q_(e)} call`;
			this.assert(t(i, e, r), `expected ${c} "${a}" call to ${n} #{exp}`, `expected ${c} "${a}" call to not ${n} #{exp}`, r, s?.value);
		});
	}), i("withContext", function(e) {
		for (let n in e) t.flag(this, n, e[n]);
		return this;
	}), t.addProperty(e.Assertion.prototype, "resolves", function() {
		let r = /* @__PURE__ */ Error("resolves");
		t.flag(this, "promise", "resolves"), t.flag(this, "error", r);
		let i = t.flag(this, "vitest-test"), a = t.flag(this, "object");
		if (t.flag(this, "poll")) throw SyntaxError("expect.poll() is not supported in combination with .resolves");
		if (typeof a?.then != "function") throw TypeError(`You must provide a Promise to expect() when using .resolves, not '${typeof a}'.`);
		let o = new Proxy(this, { get: (s, c, l) => {
			let u = Reflect.get(s, c, l);
			return typeof u == "function" ? (...e) => {
				t.flag(this, "_name", c);
				let o = a.then((n) => (t.flag(this, "object", n), u.call(this, ...e)), (e) => {
					let i = new n(`promise rejected "${t.inspect(e)}" instead of resolving`, { showDiff: !1 });
					throw i.cause = e, i.stack = r.stack.replace(r.message, i.message), i;
				});
				return J_(i, o, q_(t, this, !!e.length), r);
			} : u instanceof e.Assertion ? o : u;
		} });
		return o;
	}), t.addProperty(e.Assertion.prototype, "rejects", function() {
		let r = /* @__PURE__ */ Error("rejects");
		t.flag(this, "promise", "rejects"), t.flag(this, "error", r);
		let i = t.flag(this, "vitest-test"), a = t.flag(this, "object"), o = typeof a == "function" ? a() : a;
		if (t.flag(this, "poll")) throw SyntaxError("expect.poll() is not supported in combination with .rejects");
		if (typeof o?.then != "function") throw TypeError(`You must provide a Promise to expect() when using .rejects, not '${typeof o}'.`);
		let s = new Proxy(this, { get: (a, c, l) => {
			let u = Reflect.get(a, c, l);
			return typeof u == "function" ? (...e) => {
				t.flag(this, "_name", c);
				let a = o.then((e) => {
					let i = new n(`promise resolved "${t.inspect(e)}" instead of rejecting`, {
						showDiff: !0,
						expected: /* @__PURE__ */ Error("rejected promise"),
						actual: e
					});
					throw i.stack = r.stack.replace(r.message, i.message), i;
				}, (n) => (t.flag(this, "object", n), u.call(this, ...e)));
				return J_(i, a, q_(t, this, !!e.length), r);
			} : u instanceof e.Assertion ? s : u;
		} });
		return s;
	});
};
function Q_(e) {
	let t = e % 10, n = e % 100;
	return t === 1 && n !== 11 ? `${e}st` : t === 2 && n !== 12 ? `${e}nd` : t === 3 && n !== 13 ? `${e}rd` : `${e}th`;
}
function $_(e, t, n) {
	return e.mock.calls.length && (t += dg.gray(`

Received: 

${e.mock.calls.map((t, r) => {
		let i = dg.bold(`  ${Q_(r + 1)} ${e.getMockName()} call:

`);
		return i += n ? Ga(n, t, { omitAnnotationLines: !0 }) : wi(t).split("\n").map((e) => `    ${e}`).join("\n"), i += "\n", i;
	}).join("\n")}`)), t += dg.gray(`

Number of calls: ${dg.bold(e.mock.calls.length)}
`), t;
}
function ev(e, t, n, r) {
	return t.length && (n += dg.gray(`

Received: 

${t.map((t, n) => {
		let i = dg.bold(`  ${Q_(n + 1)} ${e.getMockName()} call return:

`);
		return i += r ? Ga(r, t.value, { omitAnnotationLines: !0 }) : wi(t).split("\n").map((e) => `    ${e}`).join("\n"), i += "\n", i;
	}).join("\n")}`)), n += dg.gray(`

Number of calls: ${dg.bold(e.mock.calls.length)}
`), n;
}
function tv(e, t) {
	let n = e._obj, r = Ol.flag(e, "negate"), i = Ol.flag(e, "promise") || "", a = {
		...$g(),
		diff: Ga,
		stringify: wi,
		iterableEquality: T_,
		subsetEquality: O_
	};
	return {
		state: {
			...I_(t),
			customTesters: t_(),
			isNot: r,
			utils: a,
			promise: i,
			equals: X,
			suppressedErrors: [],
			soft: Ol.flag(e, "soft"),
			poll: Ol.flag(e, "poll")
		},
		isNot: r,
		obj: n
	};
}
var nv = class extends Error {
	constructor(e, t, n) {
		super(e), this.actual = t, this.expected = n;
	}
};
function rv(e, t, n) {
	return (r, i) => {
		Object.entries(n).forEach(([n, r]) => {
			function a(...e) {
				let { state: n, isNot: i, obj: a } = tv(this, t), o = r.call(n, a, ...e);
				if (o && typeof o == "object" && typeof o.then == "function") return o.then(({ pass: e, message: t, actual: n, expected: r }) => {
					if (e && i || !e && !i) throw new nv(t(), n, r);
				});
				let { pass: s, message: c, actual: l, expected: u } = o;
				if (s && i || !s && !i) throw new nv(c(), l, u);
			}
			let o = X_(i, n, a);
			i.addMethod(globalThis[zg].matchers, n, o), i.addMethod(e.Assertion.prototype, n, o);
			class s extends R_ {
				constructor(e = !1, ...t) {
					super(t, e);
				}
				asymmetricMatch(e) {
					let { pass: n } = r.call(this.getMatcherContext(t), e, ...this.sample);
					return this.inverse ? !n : n;
				}
				toString() {
					return `${this.inverse ? "not." : ""}${n}`;
				}
				getExpectedType() {
					return "any";
				}
				toAsymmetricMatcher() {
					return `${this.toString()}<${this.sample.map((e) => wi(e)).join(", ")}>`;
				}
			}
			let c = (...e) => new s(!1, ...e);
			Object.defineProperty(t, n, {
				configurable: !0,
				enumerable: !0,
				value: c,
				writable: !0
			}), Object.defineProperty(t.not, n, {
				configurable: !0,
				enumerable: !0,
				value: (...e) => new s(!0, ...e),
				writable: !0
			}), Object.defineProperty(globalThis[Vg], n, {
				configurable: !0,
				enumerable: !0,
				value: c,
				writable: !0
			});
		});
	};
}
var iv = (e, t) => {
	t.addMethod(e.expect, "extend", (t, n) => {
		Df(rv(e, t, n));
	});
};
function av() {
	Df(iv), Df(Z_), Df(K_);
	let e = ((t, n) => {
		let { assertionCalls: r } = I_(e);
		return L_({
			assertionCalls: r + 1,
			soft: !1
		}, e), xf(t, n);
	});
	Object.assign(e, xf), e.getState = () => I_(e), e.setState = (t) => L_(t, e), e.extend = (t) => xf.extend(e, t), e.soft = (...t) => {
		let n = e(...t);
		return e.setState({ soft: !0 }), n;
	}, e.extend(Hg), e.unreachable = (e) => {
		W.fail(`expected${e ? ` "${e}" ` : " "}not to be reached`);
	};
	function t(n) {
		let r = () => /* @__PURE__ */ Error(`expected number of assertions to be ${n}, but got ${e.getState().assertionCalls}`);
		"captureStackTrace" in Error && typeof Error.captureStackTrace == "function" && Error.captureStackTrace(r(), t), e.setState({
			expectedAssertionsNumber: n,
			expectedAssertionsNumberErrorGen: r
		});
	}
	function n() {
		let t = /* @__PURE__ */ Error("expected any number of assertion, but got none");
		"captureStackTrace" in Error && typeof Error.captureStackTrace == "function" && Error.captureStackTrace(t, n), e.setState({
			isExpectingAssertions: !0,
			isExpectingAssertionsError: t
		});
	}
	return L_({
		assertionCalls: 0,
		isExpectingAssertions: !1,
		isExpectingAssertionsError: null,
		expectedAssertionsNumber: null,
		expectedAssertionsNumberErrorGen: null
	}, e), Ol.addMethod(e, "assertions", t), Ol.addMethod(e, "hasAssertions", n), e.extend(Of), e;
}
var ov = av();
Object.defineProperty(globalThis, Bg, {
	value: ov,
	writable: !0,
	configurable: !0
});
function sv(e, t, n) {
	Object.defineProperty(e, t, n);
}
var cv = /* @__PURE__ */ Symbol.for("tinyspy:spy"), lv = (e) => {
	e.called = !1, e.callCount = 0, e.calls = [], e.results = [], e.resolves = [], e.next = [];
}, uv = (e) => (sv(e, cv, { value: { reset: () => lv(e[cv]) } }), e[cv]), dv = (e) => e[cv] || uv(e), fv = globalThis.__STORYBOOK_MODULE_MOCK_SPIES__ ??= /* @__PURE__ */ new Set(), pv = /* @__PURE__ */ new Set();
function mv(e) {
	return pv.add(e), () => {
		pv.delete(e);
	};
}
var hv = (...e) => _v(Ng(...e));
function gv(e) {
	return _v(e ? Ig(e) : Ig());
}
function _v(e) {
	let t = vv(e), n = t.mockImplementation.bind(null);
	return t.mockImplementation = (e) => vv(n(e)), t;
}
function vv(e) {
	let t = dv(e), n = t.impl;
	return t.willCall(function(...t) {
		return pv.forEach((n) => n(e, t)), n?.apply(this, t);
	}), e;
}
function yv() {
	jg.forEach((e) => e.mockClear()), fv.forEach((e) => e.mockClear());
}
function bv() {
	jg.forEach((e) => e.mockReset()), fv.forEach((e) => e.mockReset());
}
function xv() {
	jg.forEach((e) => e.mockRestore()), fv.forEach((e) => e.mockClear());
}
function Z(e, t, n) {
	return e.namespaceURI && e.namespaceURI !== "http://www.w3.org/1999/xhtml" || (t = Array.isArray(t) ? t : [t], !t.includes(e.tagName.toLowerCase())) ? !1 : !n || Object.entries(n).every(([t, n]) => e[t] === n);
}
function Sv(e) {
	var t;
	if (Cv(e) && e.defaultView) return e.defaultView;
	if ((t = e.ownerDocument) != null && t.defaultView) return e.ownerDocument.defaultView;
	throw Error(`Could not determine window of node. Node was ${wv(e)}`);
}
function Cv(e) {
	return e.nodeType === 9;
}
function wv(e) {
	return typeof e == "function" ? `function ${e.name}` : e === null ? "null" : String(e);
}
function Tv(e, t) {
	return new Promise((n, r) => {
		let i = new t();
		i.onerror = r, i.onabort = r, i.onload = () => {
			n(String(i.result));
		}, i.readAsText(e);
	});
}
function Ev(e, t) {
	let n = {
		...t,
		length: t.length,
		item: (e) => n[e],
		[Symbol.iterator]: function* () {
			for (let e = 0; e < n.length; e++) yield n[e];
		}
	};
	return n.constructor = e.FileList, e.FileList && Object.setPrototypeOf(n, e.FileList.prototype), Object.freeze(n), n;
}
function Dv(e, t, n) {
	return t in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
var Ov = class {
	getAsFile() {
		return this.file;
	}
	getAsString(e) {
		typeof this.data == "string" && e(this.data);
	}
	/* istanbul ignore next */
	webkitGetAsEntry() {
		throw Error("not implemented");
	}
	constructor(e, t) {
		Dv(this, "kind", void 0), Dv(this, "type", void 0), Dv(this, "file", null), Dv(this, "data", void 0), typeof e == "string" ? (this.kind = "string", this.type = String(t), this.data = e) : (this.kind = "file", this.type = e.type, this.file = e);
	}
}, kv = class extends Array {
	add(...e) {
		let t = new Ov(e[0], e[1]);
		return this.push(t), t;
	}
	clear() {
		this.splice(0, this.length);
	}
	remove(e) {
		this.splice(e, 1);
	}
};
function Av(e, t) {
	let [n, r] = e.split("/"), i = !r || r === "*";
	return (r) => t ? r.type === (i ? n : e) : i ? r.type.startsWith(`${n}/`) : r.type === n;
}
function jv(e) {
	return new class {
		getData(e) {
			let t = this.items.find(Av(e, !0)) ?? this.items.find(Av(e, !1)), n = "";
			return t?.getAsString((e) => {
				n = e;
			}), n;
		}
		setData(e, t) {
			let n = this.items.findIndex(Av(e, !0)), r = new Ov(t, e);
			n >= 0 ? this.items.splice(n, 1, r) : this.items.push(r);
		}
		clearData(e) {
			if (e) {
				let t = this.items.findIndex(Av(e, !0));
				t >= 0 && this.items.remove(t);
			} else this.items.clear();
		}
		get types() {
			let e = [];
			return this.files.length && e.push("Files"), this.items.forEach((t) => e.push(t.type)), Object.freeze(e), e;
		}
		/* istanbul ignore next */
		setDragImage() {}
		constructor() {
			Dv(this, "dropEffect", "none"), Dv(this, "effectAllowed", "uninitialized"), Dv(this, "items", new kv()), Dv(this, "files", Ev(e, []));
		}
	}();
}
function Mv(e, t = []) {
	let n = typeof e.DataTransfer > "u" ? jv(e) : 
	/* istanbul ignore next */
	new e.DataTransfer();
	return Object.defineProperty(n, "files", { get: () => Ev(e, t) }), n;
}
async function Nv(e, t) {
	return t.kind === "file" ? t.getAsFile() : new e.Blob([await new Promise((e) => t.getAsString(e))], { type: t.type });
}
function Pv(e, t, n) {
	return t in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function Fv(e, ...t) {
	let n = Object.fromEntries(t.map((e) => [typeof e == "string" ? "text/plain" : e.type, Promise.resolve(e)]));
	return typeof e.ClipboardItem < "u" ? new e.ClipboardItem(n) : new class {
		get types() {
			return Array.from(Object.keys(this.data));
		}
		async getType(t) {
			let n = await this.data[t];
			if (!n) throw Error(`${t} is not one of the available MIME types on this item.`);
			return n instanceof e.Blob ? n : new e.Blob([n], { type: t });
		}
		constructor(e) {
			Pv(this, "data", void 0), this.data = e;
		}
	}(n);
}
var Iv = /* @__PURE__ */ Symbol("Manage ClipboardSub");
function Lv(e, t) {
	return Object.assign(new class extends e.EventTarget {
		async read() {
			return Array.from(this.items);
		}
		async readText() {
			let t = "";
			for (let n of this.items) {
				let r = n.types.includes("text/plain") ? "text/plain" : n.types.find((e) => e.startsWith("text/"));
				r && (t += await n.getType(r).then((t) => Tv(t, e.FileReader)));
			}
			return t;
		}
		async write(e) {
			this.items = e;
		}
		async writeText(t) {
			this.items = [Fv(e, t)];
		}
		constructor(...e) {
			super(...e), Pv(this, "items", []);
		}
	}(), { [Iv]: t });
}
function Rv(e) {
	return !!e?.[Iv];
}
function zv(e) {
	if (Rv(e.navigator.clipboard)) return e.navigator.clipboard[Iv];
	let t = Object.getOwnPropertyDescriptor(e.navigator, "clipboard"), n, r = {
		resetClipboardStub: () => {
			n = Lv(e, r);
		},
		detachClipboardStub: () => {
			t ? Object.defineProperty(e.navigator, "clipboard", t) : Object.defineProperty(e.navigator, "clipboard", {
				value: void 0,
				configurable: !0
			});
		}
	};
	return n = Lv(e, r), Object.defineProperty(e.navigator, "clipboard", {
		get: () => n,
		configurable: !0
	}), n[Iv];
}
function Bv(e) {
	Rv(e.navigator.clipboard) && e.navigator.clipboard[Iv].resetClipboardStub();
}
function Vv(e) {
	Rv(e.navigator.clipboard) && e.navigator.clipboard[Iv].detachClipboardStub();
}
async function Hv(e) {
	let t = e.defaultView, n = t?.navigator.clipboard, r = n && await n.read();
	if (!r) throw Error("The Clipboard API is unavailable.");
	let i = Mv(t);
	for (let e of r) for (let n of e.types) i.setData(n, await e.getType(n).then((e) => Tv(e, t.FileReader)));
	return i;
}
async function Uv(e, t) {
	let n = Sv(e), r = n.navigator.clipboard, i = [];
	for (let e = 0; e < t.items.length; e++) {
		let r = t.items[e], a = await Nv(n, r);
		i.push(Fv(n, a));
	}
	if (!(r && await r.write(i).then(
		() => !0,
		/* istanbul ignore next */
		() => !1
	))) throw Error("The Clipboard API is unavailable.");
}
var Wv = globalThis;
typeof Wv.afterEach == "function" && Wv.afterEach(() => {
	typeof globalThis.window < "u" && Bv(globalThis.window);
}), typeof Wv.afterAll == "function" && Wv.afterAll(() => {
	typeof globalThis.window < "u" && Vv(globalThis.window);
});
var Gv = "input:not([type=hidden]):not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), [contenteditable=\"\"], [contenteditable=\"true\"], a[href], [tabindex]:not([disabled]), details > summary";
function Kv(e) {
	return e.matches(Gv);
}
function qv(e) {
	return new e.constructor(e.type, e);
}
function Jv(e) {
	for (let n = e; n; n = n.parentElement) if (Z(n, [
		"button",
		"input",
		"select",
		"textarea",
		"optgroup",
		"option"
	])) {
		if (n.hasAttribute("disabled")) return !0;
	} else if (Z(n, "fieldset")) {
		var t;
		if (n.hasAttribute("disabled") && !((t = n.querySelector(":scope > legend")) != null && t.contains(e))) return !0;
	} else if (n.tagName.includes("-") && n.constructor.formAssociated && n.hasAttribute("disabled")) return !0;
	return !1;
}
function Yv(e) {
	let t = e.activeElement;
	if (t?.shadowRoot) {
		let e = Yv(t.shadowRoot);
		if (e) return e;
	}
	return Jv(t) ? e.ownerDocument ? 
	/* istanbul ignore next */
	e.ownerDocument.body : e.body : t;
}
function Xv(e) {
	return Yv(e) ?? 
	/* istanbul ignore next */
	e.body;
}
function Zv(e, t) {
	let n = e;
	do {
		if (t(n)) return n;
		n = n.parentElement;
	} while (n && n !== e.ownerDocument.body);
}
function Qv(e) {
	return e.hasAttribute("contenteditable") && (e.getAttribute("contenteditable") == "true" || e.getAttribute("contenteditable") == "");
}
function $v(e) {
	let t = ey(e);
	return t && (t.closest("[contenteditable=\"\"]") || t.closest("[contenteditable=\"true\"]"));
}
function ey(e) {
	return e.nodeType === 1 ? e : e.parentElement;
}
var ty = (function(e) {
	return e.button = "button", e.color = "color", e.file = "file", e.image = "image", e.reset = "reset", e.submit = "submit", e.checkbox = "checkbox", e.radio = "radio", e;
})(ty || {});
function ny(e) {
	return Z(e, "button") || Z(e, "input") && e.type in ty;
}
function ry(e) {
	return ay(e) && !e.readOnly || Qv(e);
}
var iy = (function(e) {
	return e.text = "text", e.date = "date", e["datetime-local"] = "datetime-local", e.email = "email", e.month = "month", e.number = "number", e.password = "password", e.search = "search", e.tel = "tel", e.time = "time", e.url = "url", e.week = "week", e;
})(iy || {});
function ay(e) {
	return Z(e, "textarea") || Z(e, "input") && e.type in iy;
}
function oy(e) {
	return cy(e) && ay(e);
}
function sy(e) {
	return cy(e) && ny(e);
}
function cy(e) {
	return e.nodeType === 1;
}
function ly(e) {
	let t = e.ownerDocument.getSelection();
	if (t?.focusNode && oy(e)) {
		let n = $v(t.focusNode);
		if (n) {
			if (!t.isCollapsed) {
				let e = n.firstChild?.nodeType === 3 ? n.firstChild : n;
				t.setBaseAndExtent(e, 0, e, 0);
			}
		} else t.setBaseAndExtent(e, 0, e, 0);
	}
}
function uy(e, n) {
	return t().eventWrapper(e);
}
function dy(e) {
	let t = Zv(e, Kv), n = Yv(e.ownerDocument);
	(t ?? e.ownerDocument.body) !== n && (uy(t ? () => t.focus() : () => n?.blur()), ly(t ?? e.ownerDocument.body));
}
function fy(e) {
	!Kv(e) || Yv(e.ownerDocument) !== e || uy(() => e.blur());
}
var py = {};
py.click = (e, t, n) => {
	let r = t.closest("button,input,label,select,textarea"), i = r && Z(r, "label") && r.control;
	if (i && i !== t) return () => {
		Kv(i) && (dy(i), n.dispatchEvent(i, qv(e)));
	};
	if (Z(t, "input", { type: "file" })) return () => {
		fy(t), t.dispatchEvent(new (Sv(t)).Event("fileDialog")), dy(t);
	};
};
var my = /* @__PURE__ */ Symbol("Displayed value in UI"), hy = /* @__PURE__ */ Symbol("Displayed selection in UI"), gy = /* @__PURE__ */ Symbol("Initial value to compare on blur");
function _y(e) {
	return typeof e == "object" && my in e;
}
function vy(e) {
	return !!e && typeof e == "object" && hy in e;
}
function yy(e, t) {
	e[gy] === void 0 && (e[gy] = e.value), e[my] = t, e.value = Object.assign(new String(t), { [my]: !0 });
}
function by(e) {
	return e[my] === void 0 ? e.value : String(e[my]);
}
function xy(e) {
	e[my] = void 0;
}
function Sy(e) {
	e[gy] = void 0;
}
function Cy(e) {
	return e[gy];
}
function wy(e, t) {
	e[hy] = t;
}
function Ty(e, { focusOffset: t, anchorOffset: n = t }, r = "replace") {
	let i = by(e).length, a = (e) => Math.max(0, Math.min(i, e)), o = r === "replace" || e[hy] === void 0 ? a(n) : e[hy].anchorOffset, s = a(t), c = Math.min(o, s), l = Math.max(o, s);
	if (e[hy] = {
		anchorOffset: o,
		focusOffset: s
	}, e.selectionStart === c && e.selectionEnd === l) return;
	let u = Object.assign(new Number(c), { [hy]: !0 });
	try {
		e.setSelectionRange(u, l);
	} catch {}
}
function Ey(e) {
	let t = e[hy] ?? {
		anchorOffset: e.selectionStart ?? 0,
		focusOffset: e.selectionEnd ?? 0
	};
	return {
		...t,
		startOffset: Math.min(t.anchorOffset, t.focusOffset),
		endOffset: Math.max(t.anchorOffset, t.focusOffset)
	};
}
function Dy(e) {
	return !!e[hy];
}
function Oy(e) {
	e[hy] = void 0;
}
var ky = globalThis.parseInt;
function Ay(e) {
	let t = e.replace(/\D/g, "");
	if (t.length < 2) return e;
	let n = ky(t[0], 10), r = ky(t[1], 10);
	if (n >= 3 || n === 2 && r >= 4) {
		let e;
		return e = n >= 3 ? 1 : 2, jy(t, e);
	}
	return e.length === 2 ? e : jy(t, 2);
}
function jy(e, t) {
	let n = e.slice(0, t), r = Math.min(ky(n, 10), 23), i = ky(e.slice(t), 10), a = Math.min(i, 59);
	return `${r.toString().padStart(2, "0")}:${a.toString().padStart(2, "0")}`;
}
function My(e, t) {
	let n = e.cloneNode();
	return n.value = t, n.value === t;
}
var Ny = (function(e) {
	return e.email = "email", e.password = "password", e.search = "search", e.telephone = "telephone", e.text = "text", e.url = "url", e;
})(Ny || {});
function Py(e) {
	let t = e.getAttribute("maxlength") ?? "";
	return /^\d+$/.test(t) && Number(t) >= 0 ? Number(t) : void 0;
}
function Fy(e) {
	return Z(e, "textarea") || Z(e, "input") && e.type in Ny;
}
function Iy(e, t, n, r) {
	if (Vy(e) && t + n >= 0 && t + n <= e.nodeValue.length) return {
		node: e,
		offset: t + n
	};
	let i = Ly(e, t, n);
	if (i) {
		if (Vy(i)) return {
			node: i,
			offset: n > 0 ? Math.min(1, i.nodeValue.length) : Math.max(i.nodeValue.length - 1, 0)
		};
		if (Z(i, "br")) {
			let e = Ly(i, void 0, n);
			return e ? Vy(e) ? {
				node: e,
				offset: n > 0 ? 0 : e.nodeValue.length
			} : n < 0 && Z(e, "br") ? {
				node: i.parentNode,
				offset: zy(i)
			} : {
				node: e.parentNode,
				offset: zy(e) + (n > 0 ? 0 : 1)
			} : n < 0 && r === "deleteContentBackward" ? {
				node: i.parentNode,
				offset: zy(i)
			} : void 0;
		}
		return {
			node: i.parentNode,
			offset: zy(i) + +(n > 0)
		};
	}
}
function Ly(e, t, n) {
	let r = Number(t) + (n < 0 ? -1 : 0);
	return t !== void 0 && By(e) && r >= 0 && r < e.children.length && (e = e.children[r]), Hy(e, n === 1 ? "next" : "previous", Ry);
}
function Ry(e) {
	if (Vy(e)) return !0;
	if (By(e)) {
		if (Z(e, ["input", "textarea"])) return e.type !== "hidden";
		if (Z(e, "br")) return !0;
	}
	return !1;
}
function zy(e) {
	let t = 0;
	for (; e.previousSibling;) t++, e = e.previousSibling;
	return t;
}
function By(e) {
	return e.nodeType === 1;
}
function Vy(e) {
	return e.nodeType === 3;
}
function Hy(e, t, n) {
	for (;;) {
		let r = e[`${t}Sibling`];
		if (r) {
			if (e = Uy(r, t === "next" ? "first" : "last"), n(e)) return e;
		} else if (e.parentNode && (!By(e.parentNode) || !Qv(e.parentNode) && e.parentNode !== e.ownerDocument?.body)) e = e.parentNode;
		else break;
	}
}
function Uy(e, t) {
	for (; e.hasChildNodes();) e = e[`${t}Child`];
	return e;
}
var Wy = /* @__PURE__ */ Symbol("Track programmatic changes for React workaround");
function Gy(e) {
	return Object.getOwnPropertyNames(e).some((e) => e.startsWith("__react")) && Sv(e).REACT_VERSION === 17;
}
function Ky(e) {
	Gy(e) && (e[Wy] = {
		previousValue: String(e.value),
		tracked: []
	});
}
function qy(e, t) {
	var n, r;
	(r = e[Wy]) == null || (n = r.tracked) == null || n.push(t), e[Wy] || (xy(e), Ty(e, { focusOffset: t.length }));
}
function Jy(e, t) {
	var n;
	let r = e[Wy];
	if (e[Wy] = void 0, !(r != null && (n = r.tracked) != null && n.length)) return;
	let i = r.tracked.length === 2 && r.tracked[0] === r.previousValue && r.tracked[1] === e.value;
	i || xy(e), Dy(e) && Ty(e, { focusOffset: i ? t : e.value.length });
}
function Yy(e) {
	let t = Xy(e);
	if (t && oy(t)) return {
		type: "input",
		selection: Ey(t)
	};
	let n = t?.ownerDocument.getSelection();
	return {
		type: $v(e) && n?.anchorNode && $v(n.anchorNode) ? "contenteditable" : "default",
		selection: n
	};
}
function Xy(e) {
	return e.nodeType === 1 ? e : e.parentElement;
}
function Zy(e) {
	let t = Yy(e);
	if (t.type === "input") return t.selection;
	if (t.type === "contenteditable") return t.selection?.getRangeAt(0);
}
function Qy({ focusNode: e, focusOffset: t, anchorNode: n = e, anchorOffset: r = t }) {
	var i, a;
	if (Yy(e).type === "input") return Ty(e, {
		anchorOffset: r,
		focusOffset: t
	});
	(a = n.ownerDocument) == null || (i = a.getSelection()) == null || i.setBaseAndExtent(n, r, e, t);
}
function $y(e) {
	return Z(e, "input") && ["date", "time"].includes(e.type);
}
function eb(e, t, n, r = "insertText") {
	let i = Zy(t);
	i && (!$y(t) && !e.dispatchUIEvent(t, "beforeinput", {
		inputType: r,
		data: n
	}) || ("startContainer" in i ? tb(e, t, i, n, r) : nb(e, t, i, n, r)));
}
function tb(e, t, n, r, i) {
	let a = !1;
	if (!n.collapsed) a = !0, n.deleteContents();
	else if (["deleteContentBackward", "deleteContentForward"].includes(i)) {
		let e = Iy(n.startContainer, n.startOffset, i === "deleteContentBackward" ? -1 : 1, i);
		if (e) {
			a = !0;
			let t = n.cloneRange();
			t.comparePoint(e.node, e.offset) < 0 ? t.setStart(e.node, e.offset) : t.setEnd(e.node, e.offset), t.deleteContents();
		}
	}
	if (r) {
		if (n.endContainer.nodeType === 3) {
			let e = n.endOffset;
			n.endContainer.insertData(e, r), n.setStart(n.endContainer, e + r.length), n.setEnd(n.endContainer, e + r.length);
		} else {
			let e = t.ownerDocument.createTextNode(r);
			n.insertNode(e), n.setStart(e, r.length), n.setEnd(e, r.length);
		}
	}
	(a || r) && e.dispatchUIEvent(t, "input", { inputType: i });
}
function nb(e, t, n, r, i) {
	let a = r;
	if (Fy(t)) {
		let e = Py(t);
		if (e !== void 0 && r.length > 0) {
			let i = n.endOffset - n.startOffset, o = e - t.value.length + i;
			if (o > 0) a = r.substring(0, o);
			else return;
		}
	}
	let { newValue: o, newOffset: s, oldValue: c } = rb(a, t, n, i);
	o === c && s === n.startOffset && s === n.endOffset || Z(t, "input", { type: "number" }) && !ab(o) || (yy(t, o), Qy({
		focusNode: t,
		anchorOffset: s,
		focusOffset: s
	}), $y(t) ? My(t, o) && (ib(e, t, s, {}), e.dispatchUIEvent(t, "change"), Sy(t)) : ib(e, t, s, {
		data: r,
		inputType: i
	}));
}
function rb(e, t, { startOffset: n, endOffset: r }, i) {
	let a = by(t), o = Math.max(0, n === r && i === "deleteContentBackward" ? n - 1 : n), s = a.substring(0, o), c = Math.min(a.length, n === r && i === "deleteContentForward" ? n + 1 : r), l = `${s}${e}${a.substring(c, a.length)}`, u = o + e.length;
	if (Z(t, "input", { type: "time" })) {
		let e = Ay(l);
		e !== "" && My(t, e) && (l = e, u = e.length);
	}
	return {
		oldValue: a,
		newValue: l,
		newOffset: u
	};
}
function ib(e, t, n, r) {
	e.dispatchUIEvent(t, "input", r), Jy(t, n);
}
function ab(e) {
	let t = e.split("e", 2);
	return !(/[^\d.\-e]/.test(e) || Number(e.match(/-/g)?.length) > 2 || Number(e.match(/\./g)?.length) > 1 || t[1] && !/^-?\d*$/.test(t[1]));
}
py.cut = (e, t, n) => () => {
	ry(t) && eb(n, t, "", "deleteByCut");
};
function ob(e) {
	return e ? Qv(e) ? e.textContent : by(e) : null;
}
function sb(e) {
	let t = Sv(e);
	for (let n = e; n?.ownerDocument; n = n.parentElement) {
		let { display: e, visibility: r } = t.getComputedStyle(n);
		if (e === "none" || r === "hidden") return !1;
	}
	return !0;
}
function cb(e, t) {
	let n = e.ownerDocument, r = n.querySelectorAll(Gv), i = Array.from(r).filter((t) => t === e || !(Number(t.getAttribute("tabindex")) < 0 || Jv(t)));
	Number(e.getAttribute("tabindex")) >= 0 && i.sort((e, t) => {
		let n = Number(e.getAttribute("tabindex")), r = Number(t.getAttribute("tabindex"));
		return n === r ? 0 : n === 0 ? 1 : r === 0 ? -1 : n - r;
	});
	let a = {}, o = [n.body], s = Z(e, "input", { type: "radio" }) ? e.name : void 0;
	i.forEach((t) => {
		let n = t;
		if (Z(n, "input", { type: "radio" }) && n.name) {
			if (n === e) {
				o.push(n);
				return;
			}
			if (n.name === s) return;
			if (n.checked) {
				o = o.filter((e) => !Z(e, "input", {
					type: "radio",
					name: n.name
				})), o.push(n), a[n.name] = n;
				return;
			}
			if (typeof a[n.name] < "u") return;
		}
		o.push(n);
	});
	for (let r = o.findIndex((t) => t === e);;) if (r += t ? -1 : 1, r === o.length ? r = 0 : r === -1 && (r = o.length - 1), o[r] === e || o[r] === n.body || sb(o[r])) return o[r];
}
function lb(e, t) {
	if (oy(e)) {
		let n = Ey(e);
		Qy({
			focusNode: e,
			focusOffset: n.startOffset === n.endOffset ? n.focusOffset + t : t < 0 ? n.startOffset : n.endOffset
		});
	} else {
		let n = e.ownerDocument.getSelection();
		if (!n?.focusNode) return;
		if (n.isCollapsed) {
			let e = Iy(n.focusNode, n.focusOffset, t);
			e && Qy({
				focusNode: e.node,
				focusOffset: e.offset
			});
		} else n[t < 0 ? "collapseToStart" : "collapseToEnd"]();
	}
}
function ub(e) {
	if (oy(e)) return Qy({
		focusNode: e,
		anchorOffset: 0,
		focusOffset: by(e).length
	});
	let t = $v(e) ?? e.ownerDocument.body;
	Qy({
		focusNode: t,
		anchorOffset: 0,
		focusOffset: t.childNodes.length
	});
}
function db(e) {
	if (oy(e)) return Ey(e).startOffset === 0 && Ey(e).endOffset === by(e).length;
	let t = $v(e) ?? e.ownerDocument.body, n = e.ownerDocument.getSelection();
	return n?.anchorNode === t && n.focusNode === t && n.anchorOffset === 0 && n.focusOffset === t.childNodes.length;
}
function fb(e, t, n) {
	if (oy(e)) return Qy({
		focusNode: e,
		anchorOffset: t,
		focusOffset: n
	});
	if (Qv(e) && e.firstChild?.nodeType === 3) return Qy({
		focusNode: e.firstChild,
		anchorOffset: t,
		focusOffset: n
	});
	throw Error("Not implemented. The result of this interaction is unreliable.");
}
function pb(e, t, n) {
	let r = Sv(t), i = Array.from(t.ownerDocument.querySelectorAll(t.name ? `input[type="radio"][name="${r.CSS.escape(t.name)}"]` : "input[type=\"radio\"][name=\"\"], input[type=\"radio\"]:not([name])"));
	for (let r = i.findIndex((e) => e === t) + n;; r += n) {
		if (i[r] || (r = n > 0 ? 0 : i.length - 1), i[r] === t) return;
		if (!Jv(i[r])) {
			dy(i[r]), e.dispatchUIEvent(i[r], "click");
			return;
		}
	}
}
py.keydown = (e, t, n) => mb[e.key]?.call(mb, e, t, n) ?? hb(e, t, n);
var mb = {
	ArrowDown: (e, t, n) => {
		if (Z(t, "input", { type: "radio" })) return () => pb(n, t, 1);
	},
	ArrowLeft: (e, t, n) => Z(t, "input", { type: "radio" }) ? () => pb(n, t, -1) : () => lb(t, -1),
	ArrowRight: (e, t, n) => Z(t, "input", { type: "radio" }) ? () => pb(n, t, 1) : () => lb(t, 1),
	ArrowUp: (e, t, n) => {
		if (Z(t, "input", { type: "radio" })) return () => pb(n, t, -1);
	},
	Backspace: (e, t, n) => {
		if (ry(t)) return () => {
			eb(n, t, "", "deleteContentBackward");
		};
	},
	Delete: (e, t, n) => {
		if (ry(t)) return () => {
			eb(n, t, "", "deleteContentForward");
		};
	},
	End: (e, t) => {
		if (Z(t, ["input", "textarea"]) || Qv(t)) return () => {
			let e = ob(t)?.length ?? 
			/* istanbul ignore next */
			0;
			fb(t, e, e);
		};
	},
	Home: (e, t) => {
		if (Z(t, ["input", "textarea"]) || Qv(t)) return () => {
			fb(t, 0, 0);
		};
	},
	PageDown: (e, t) => {
		if (Z(t, ["input"])) return () => {
			let e = by(t).length;
			fb(t, e, e);
		};
	},
	PageUp: (e, t) => {
		if (Z(t, ["input"])) return () => {
			fb(t, 0, 0);
		};
	},
	Tab: (e, t, n) => () => {
		let e = cb(t, n.system.keyboard.modifiers.Shift);
		dy(e), oy(e) && Ty(e, {
			anchorOffset: 0,
			focusOffset: e.value.length
		});
	}
}, hb = (e, t, n) => {
	if (e.code === "KeyA" && n.system.keyboard.modifiers.Control) return () => ub(t);
};
py.keypress = (e, t, n) => {
	if (e.key === "Enter") {
		if (Z(t, "button") || Z(t, "input") && gb.includes(t.type) || Z(t, "a") && t.href) return () => {
			n.dispatchUIEvent(t, "click");
		};
		if (Z(t, "input")) {
			let e = t.form, r = e?.querySelector("input[type=\"submit\"], button:not([type]), button[type=\"submit\"]");
			return r ? () => n.dispatchUIEvent(r, "click") : e && _b.includes(t.type) && e.querySelectorAll("input").length === 1 ? () => n.dispatchUIEvent(e, "submit") : void 0;
		}
	}
	if (ry(t)) {
		let r = e.key === "Enter" ? Qv(t) && !n.system.keyboard.modifiers.Shift ? "insertParagraph" : "insertLineBreak" : "insertText", i = e.key === "Enter" ? "\n" : e.key;
		return () => eb(n, t, i, r);
	}
};
var gb = [
	"button",
	"color",
	"file",
	"image",
	"reset",
	"submit"
], _b = [
	"email",
	"month",
	"password",
	"search",
	"tel",
	"text",
	"url",
	"week"
];
py.keyup = (e, t, n) => vb[e.key]?.call(vb, e, t, n);
var vb = { " ": (e, t, n) => {
	if (ny(t)) return () => n.dispatchUIEvent(t, "click");
} };
py.paste = (e, t, n) => {
	if (ry(t)) return () => {
		let r = e.clipboardData?.getData("text");
		r && eb(n, t, r, "insertFromPaste");
	};
};
var yb = {
	auxclick: {
		EventType: "PointerEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	beforeinput: {
		EventType: "InputEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	blur: {
		EventType: "FocusEvent",
		defaultInit: {
			bubbles: !1,
			cancelable: !1,
			composed: !0
		}
	},
	click: {
		EventType: "PointerEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	contextmenu: {
		EventType: "PointerEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	copy: {
		EventType: "ClipboardEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	change: {
		EventType: "Event",
		defaultInit: {
			bubbles: !0,
			cancelable: !1
		}
	},
	cut: {
		EventType: "ClipboardEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	dblclick: {
		EventType: "MouseEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	focus: {
		EventType: "FocusEvent",
		defaultInit: {
			bubbles: !1,
			cancelable: !1,
			composed: !0
		}
	},
	focusin: {
		EventType: "FocusEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !1,
			composed: !0
		}
	},
	focusout: {
		EventType: "FocusEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !1,
			composed: !0
		}
	},
	keydown: {
		EventType: "KeyboardEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	keypress: {
		EventType: "KeyboardEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	keyup: {
		EventType: "KeyboardEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	paste: {
		EventType: "ClipboardEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	input: {
		EventType: "InputEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !1,
			composed: !0
		}
	},
	mousedown: {
		EventType: "MouseEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	mouseenter: {
		EventType: "MouseEvent",
		defaultInit: {
			bubbles: !1,
			cancelable: !1,
			composed: !0
		}
	},
	mouseleave: {
		EventType: "MouseEvent",
		defaultInit: {
			bubbles: !1,
			cancelable: !1,
			composed: !0
		}
	},
	mousemove: {
		EventType: "MouseEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	mouseout: {
		EventType: "MouseEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	mouseover: {
		EventType: "MouseEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	mouseup: {
		EventType: "MouseEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	pointerover: {
		EventType: "PointerEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	pointerenter: {
		EventType: "PointerEvent",
		defaultInit: {
			bubbles: !1,
			cancelable: !1
		}
	},
	pointerdown: {
		EventType: "PointerEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	pointermove: {
		EventType: "PointerEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	pointerup: {
		EventType: "PointerEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	pointercancel: {
		EventType: "PointerEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !1,
			composed: !0
		}
	},
	pointerout: {
		EventType: "PointerEvent",
		defaultInit: {
			bubbles: !0,
			cancelable: !0,
			composed: !0
		}
	},
	pointerleave: {
		EventType: "PointerEvent",
		defaultInit: {
			bubbles: !1,
			cancelable: !1
		}
	},
	submit: {
		EventType: "Event",
		defaultInit: {
			bubbles: !0,
			cancelable: !0
		}
	}
};
function bb(e) {
	return yb[e].EventType;
}
var xb = ["MouseEvent", "PointerEvent"];
function Sb(e) {
	return xb.includes(bb(e));
}
function Cb(e) {
	return bb(e) === "KeyboardEvent";
}
var wb = {
	ClipboardEvent: [Ob],
	Event: [],
	FocusEvent: [jb, kb],
	InputEvent: [jb, Ab],
	MouseEvent: [
		jb,
		Mb,
		Pb
	],
	PointerEvent: [
		jb,
		Mb,
		Pb,
		Fb
	],
	KeyboardEvent: [
		jb,
		Mb,
		Nb
	]
};
function Tb(e, t, n) {
	let r = Sv(t), { EventType: i, defaultInit: a } = yb[e], o = new (Eb(r))[i](e, a);
	var s = {};
	for (var c in n) Object.prototype.hasOwnProperty.call(n, c) && (s[c] = n[c]);
	return s.view = r, wb[i].forEach(function(e) {
		e(o, s);
	}), o;
}
function Eb(e) {
	let t = e.Event ?? class {}, n = e.AnimationEvent ?? class extends t {}, r = e.ClipboardEvent ?? class extends t {}, i = e.PopStateEvent ?? class extends t {}, a = e.ProgressEvent ?? class extends t {}, o = e.TransitionEvent ?? class extends t {}, s = e.UIEvent ?? class extends t {}, c = e.CompositionEvent ?? class extends s {}, l = e.FocusEvent ?? class extends s {}, u = e.InputEvent ?? class extends s {}, d = e.KeyboardEvent ?? class extends s {}, f = e.MouseEvent ?? class extends s {};
	return {
		Event: t,
		AnimationEvent: n,
		ClipboardEvent: r,
		PopStateEvent: i,
		ProgressEvent: a,
		TransitionEvent: o,
		UIEvent: s,
		CompositionEvent: c,
		FocusEvent: l,
		InputEvent: u,
		KeyboardEvent: d,
		MouseEvent: f,
		DragEvent: e.DragEvent ?? class extends f {},
		PointerEvent: e.PointerEvent ?? class extends f {},
		TouchEvent: e.TouchEvent ?? class extends s {}
	};
}
function Db(e, t) {
	for (let [n, r] of Object.entries(t)) Object.defineProperty(e, n, { get: () => r ?? null });
}
function Q(e) {
	return Number(e ?? 0);
}
function Ob(e, { clipboardData: t }) {
	Db(e, { clipboardData: t });
}
function kb(e, { relatedTarget: t }) {
	Db(e, { relatedTarget: t });
}
function Ab(e, { data: t, inputType: n, isComposing: r }) {
	Db(e, {
		data: t,
		isComposing: !!r,
		inputType: String(n)
	});
}
function jb(e, { view: t, detail: n }) {
	Db(e, {
		view: t,
		detail: Q(n ?? 0)
	});
}
function Mb(e, { altKey: t, ctrlKey: n, metaKey: r, shiftKey: i, modifierAltGraph: a, modifierCapsLock: o, modifierFn: s, modifierFnLock: c, modifierNumLock: l, modifierScrollLock: u, modifierSymbol: d, modifierSymbolLock: f }) {
	Db(e, {
		altKey: !!t,
		ctrlKey: !!n,
		metaKey: !!r,
		shiftKey: !!i,
		getModifierState(e) {
			return !!{
				Alt: t,
				AltGraph: a,
				CapsLock: o,
				Control: n,
				Fn: s,
				FnLock: c,
				Meta: r,
				NumLock: l,
				ScrollLock: u,
				Shift: i,
				Symbol: d,
				SymbolLock: f
			}[e];
		}
	});
}
function Nb(e, { key: t, code: n, location: r, repeat: i, isComposing: a, charCode: o }) {
	Db(e, {
		key: String(t),
		code: String(n),
		location: Q(r),
		repeat: !!i,
		isComposing: !!a,
		charCode: o
	});
}
function Pb(e, { x: t, y: n, screenX: r, screenY: i, clientX: a = t, clientY: o = n, button: s, buttons: c, relatedTarget: l, offsetX: u, offsetY: d, pageX: f, pageY: p }) {
	Db(e, {
		screenX: Q(r),
		screenY: Q(i),
		clientX: Q(a),
		x: Q(a),
		clientY: Q(o),
		y: Q(o),
		button: Q(s),
		buttons: Q(c),
		relatedTarget: l,
		offsetX: Q(u),
		offsetY: Q(d),
		pageX: Q(f),
		pageY: Q(p)
	});
}
function Fb(e, { pointerId: t, width: n, height: r, pressure: i, tangentialPressure: a, tiltX: o, tiltY: s, twist: c, pointerType: l, isPrimary: u, buttons: d }) {
	Db(e, {
		pointerId: Q(t),
		width: Q(n ?? 1),
		height: Q(r ?? 1),
		pressure: Q(i ?? (d ? .5 : 0)),
		tangentialPressure: Q(a),
		tiltX: Q(o),
		tiltY: Q(s),
		twist: Q(c),
		pointerType: String(l),
		isPrimary: !!u
	});
}
function Ib(e, t, n, r = !1) {
	(Sb(t) || Cb(t)) && (n = {
		...n,
		...this.system.getUIEventModifiers()
	});
	let i = Tb(t, e, n);
	return Lb.call(this, e, i, r);
}
function Lb(e, t, n = !1) {
	let r = t.type, i = n ? () => {} : py[r]?.call(py, t, e, this);
	if (i) {
		t.preventDefault();
		let n = !1;
		return Object.defineProperty(t, "defaultPrevented", { get: () => n }), Object.defineProperty(t, "preventDefault", { value: () => {
			n = t.cancelable;
		} }), uy(() => e.dispatchEvent(t)), n || i(), !n;
	}
	return uy(() => e.dispatchEvent(t));
}
function Rb(e, t, n) {
	let r = Tb(t, e, n);
	uy(() => e.dispatchEvent(r));
}
var zb = /* @__PURE__ */ Symbol("patched focus/blur methods");
function Bb(e) {
	if (e.prototype[zb]) return;
	let { focus: t, blur: n } = e.prototype;
	Object.defineProperties(e.prototype, {
		focus: {
			configurable: !0,
			value: i,
			writable: !0
		},
		blur: {
			configurable: !0,
			value: a,
			writable: !0
		},
		[zb]: {
			configurable: !0,
			get: () => ({
				focus: t,
				blur: n
			})
		}
	});
	let r;
	function i(e) {
		if (this.ownerDocument.visibilityState !== "hidden") return t.call(this, e);
		let i = Vb(this.ownerDocument);
		if (i === this) return;
		let a = /* @__PURE__ */ Symbol("focus call");
		r = a, i && (n.call(i), Rb(i, "blur", { relatedTarget: this }), Rb(i, "focusout", { relatedTarget: r === a ? this : null })), r === a && (t.call(this, e), Rb(this, "focus", { relatedTarget: i })), r === a && Rb(this, "focusin", { relatedTarget: i });
	}
	function a() {
		if (this.ownerDocument.visibilityState !== "hidden") return n.call(this);
		let e = Vb(this.ownerDocument);
		e === this && (r = /* @__PURE__ */ Symbol("blur call"), n.call(this), Rb(e, "blur", { relatedTarget: null }), Rb(e, "focusout", { relatedTarget: null }));
	}
}
function Vb(e) {
	let t = Yv(e);
	return t?.tagName === "BODY" ? null : t;
}
var Hb = /* @__PURE__ */ Symbol("Interceptor for programmatical calls");
function Ub(e, t, n) {
	let r = Object.getOwnPropertyDescriptor(e.constructor.prototype, t), i = Object.getOwnPropertyDescriptor(e, t), a = r?.set ? "set" : "value";
	if (typeof r?.[a] != "function" || r[a][Hb]) throw Error(`Element ${e.tagName} does not implement "${String(t)}".`);
	function o(...e) {
		let { applyNative: t = !1, realArgs: o, then: s } = n.call(this, ...e), c = (!t && i || r)[a];
		a === "set" ? c.call(this, o) : c.call(this, ...o), s?.();
	}
	o[Hb] = Hb, Object.defineProperty(e, t, {
		...i ?? r,
		[a]: o
	});
}
function Wb(e) {
	Ub(e, "value", function(e) {
		let t = _y(e);
		return t && Ky(this), {
			applyNative: !!t,
			realArgs: Gb(this, e),
			then: t ? void 0 : () => qy(this, String(e))
		};
	});
}
function Gb(e, t) {
	return Z(e, "input", { type: "number" }) && String(t) !== "" && !Number.isNaN(Number(t)) ? String(Number(t)) : String(t);
}
function Kb(e) {
	Ub(e, "setSelectionRange", function(t, ...n) {
		let r = vy(t);
		return {
			applyNative: !!r,
			realArgs: [Number(t), ...n],
			then: () => r ? void 0 : Oy(e)
		};
	}), Ub(e, "selectionStart", function(t) {
		return {
			realArgs: t,
			then: () => Oy(e)
		};
	}), Ub(e, "selectionEnd", function(t) {
		return {
			realArgs: t,
			then: () => Oy(e)
		};
	}), Ub(e, "select", function() {
		return {
			realArgs: [],
			then: () => wy(e, {
				anchorOffset: 0,
				focusOffset: by(e).length
			})
		};
	});
}
function qb(e) {
	Ub(e, "setRangeText", function(...t) {
		return {
			realArgs: t,
			then: () => {
				xy(e), Oy(e);
			}
		};
	});
}
var Jb = /* @__PURE__ */ Symbol("Node prepared with document state workarounds");
function Yb(e) {
	e[Jb] || (e.addEventListener("focus", (e) => {
		let t = e.target;
		Xb(t);
	}, {
		capture: !0,
		passive: !0
	}), e.activeElement && Xb(e.activeElement), e.addEventListener("blur", (e) => {
		let t = e.target, n = Cy(t);
		n !== void 0 && (t.value !== n && Rb(t, "change"), Sy(t));
	}, {
		capture: !0,
		passive: !0
	}), e[Jb] = Jb);
}
function Xb(e) {
	e[Jb] || (Z(e, ["input", "textarea"]) && (Wb(e), Kb(e), qb(e)), e[Jb] = Jb);
}
function Zb(e) {
	return Qb(e) ? e : e.ownerDocument;
}
function Qb(e) {
	return e.nodeType === 9;
}
var $b = (function(e) {
	return e[e.Trigger = 2] = "Trigger", e[e.Call = 1] = "Call", e;
})({});
function ex(e, t) {
	e.levelRefs[t] = {};
}
function tx(e, t) {
	return e.levelRefs[t];
}
function nx(e) {
	let t = e.delay;
	if (typeof t == "number") return Promise.all([new Promise((e) => globalThis.setTimeout(() => e(), t)), e.advanceTimers(t)]);
}
var rx = (function(e) {
	return e[e.EachTrigger = 4] = "EachTrigger", e[e.EachApiCall = 2] = "EachApiCall", e[e.EachTarget = 1] = "EachTarget", e[e.Never = 0] = "Never", e;
})({});
function ix(e, t, n) {
	return t in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
var ax = (function(e) {
	return e[e.STANDARD = 0] = "STANDARD", e[e.LEFT = 1] = "LEFT", e[e.RIGHT = 2] = "RIGHT", e[e.NUMPAD = 3] = "NUMPAD", e;
})({}), ox = [
	"Alt",
	"AltGraph",
	"Control",
	"Fn",
	"Meta",
	"Shift",
	"Symbol"
];
function sx(e) {
	return ox.includes(e);
}
var cx = [
	"CapsLock",
	"FnLock",
	"NumLock",
	"ScrollLock",
	"SymbolLock"
];
function lx(e) {
	return cx.includes(e);
}
var ux = class {
	isKeyPressed(e) {
		return this.pressed.has(String(e.code));
	}
	getPressedKeys() {
		return this.pressed.values().map((e) => e.keyDef);
	}
	async keydown(e, t) {
		let n = String(t.key), r = String(t.code), i = Xv(e.config.document);
		this.setKeydownTarget(i), this.pressed.add(r, t), sx(n) && (this.modifiers[n] = !0);
		let a = e.dispatchUIEvent(i, "keydown", {
			key: n,
			code: r
		});
		lx(n) && !this.modifiers[n] && (this.modifiers[n] = !0, this.modifierLockStart[n] = !0), a && this.pressed.setUnprevented(r), a && this.hasKeyPress(n) && e.dispatchUIEvent(Xv(e.config.document), "keypress", {
			key: n,
			code: r,
			charCode: t.key === "Enter" ? 13 : String(t.key).charCodeAt(0)
		});
	}
	async keyup(e, t) {
		let n = String(t.key), r = String(t.code), i = this.pressed.isUnprevented(r);
		this.pressed.delete(r), sx(n) && !this.pressed.values().find((e) => e.keyDef.key === n) && (this.modifiers[n] = !1), e.dispatchUIEvent(Xv(e.config.document), "keyup", {
			key: n,
			code: r
		}, !i), lx(n) && this.modifiers[n] && (this.modifierLockStart[n] ? this.modifierLockStart[n] = !1 : this.modifiers[n] = !1);
	}
	setKeydownTarget(e) {
		e !== this.lastKeydownTarget && (this.carryChar = ""), this.lastKeydownTarget = e;
	}
	hasKeyPress(e) {
		return (e.length === 1 || e === "Enter") && !this.modifiers.Control && !this.modifiers.Alt;
	}
	constructor(e) {
		ix(this, "system", void 0), ix(this, "modifiers", {
			Alt: !1,
			AltGraph: !1,
			CapsLock: !1,
			Control: !1,
			Fn: !1,
			FnLock: !1,
			Meta: !1,
			NumLock: !1,
			ScrollLock: !1,
			Shift: !1,
			Symbol: !1,
			SymbolLock: !1
		}), ix(this, "pressed", new class {
			add(e, t) {
				var n, r;
				(n = this.registry)[r = e] ?? (n[r] = {
					keyDef: t,
					unpreventedDefault: !1
				});
			}
			has(e) {
				return !!this.registry[e];
			}
			setUnprevented(e) {
				let t = this.registry[e];
				t && (t.unpreventedDefault = !0);
			}
			isUnprevented(e) {
				var t;
				return !!((t = this.registry[e]) != null && t.unpreventedDefault);
			}
			delete(e) {
				delete this.registry[e];
			}
			values() {
				return Object.values(this.registry);
			}
			constructor() {
				ix(this, "registry", {});
			}
		}()), ix(this, "carryChar", ""), ix(this, "lastKeydownTarget", void 0), ix(this, "modifierLockStart", {}), this.system = e;
	}
}, dx = [
	..."0123456789".split("").map((e) => ({
		code: `Digit${e}`,
		key: e
	})),
	...")!@#$%^&*(".split("").map((e, t) => ({
		code: `Digit${t}`,
		key: e,
		shiftKey: !0
	})),
	..."abcdefghijklmnopqrstuvwxyz".split("").map((e) => ({
		code: `Key${e.toUpperCase()}`,
		key: e
	})),
	..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((e) => ({
		code: `Key${e}`,
		key: e,
		shiftKey: !0
	})),
	{
		code: "BracketLeft",
		key: "["
	},
	{
		code: "BracketLeft",
		key: "{",
		shiftKey: !0
	},
	{
		code: "BracketRight",
		key: "]"
	},
	{
		code: "BracketRight",
		key: "}",
		shiftKey: !0
	},
	{
		code: "Space",
		key: " "
	},
	{
		code: "AltLeft",
		key: "Alt",
		location: ax.LEFT
	},
	{
		code: "AltRight",
		key: "Alt",
		location: ax.RIGHT
	},
	{
		code: "ShiftLeft",
		key: "Shift",
		location: ax.LEFT
	},
	{
		code: "ShiftRight",
		key: "Shift",
		location: ax.RIGHT
	},
	{
		code: "ControlLeft",
		key: "Control",
		location: ax.LEFT
	},
	{
		code: "ControlRight",
		key: "Control",
		location: ax.RIGHT
	},
	{
		code: "MetaLeft",
		key: "Meta",
		location: ax.LEFT
	},
	{
		code: "MetaRight",
		key: "Meta",
		location: ax.RIGHT
	},
	{
		code: "OSLeft",
		key: "OS",
		location: ax.LEFT
	},
	{
		code: "OSRight",
		key: "OS",
		location: ax.RIGHT
	},
	{
		code: "ContextMenu",
		key: "ContextMenu"
	},
	{
		code: "Tab",
		key: "Tab"
	},
	{
		code: "CapsLock",
		key: "CapsLock"
	},
	{
		code: "Backspace",
		key: "Backspace"
	},
	{
		code: "Enter",
		key: "Enter"
	},
	{
		code: "Escape",
		key: "Escape"
	},
	{
		code: "ArrowUp",
		key: "ArrowUp"
	},
	{
		code: "ArrowDown",
		key: "ArrowDown"
	},
	{
		code: "ArrowLeft",
		key: "ArrowLeft"
	},
	{
		code: "ArrowRight",
		key: "ArrowRight"
	},
	{
		code: "Home",
		key: "Home"
	},
	{
		code: "End",
		key: "End"
	},
	{
		code: "Delete",
		key: "Delete"
	},
	{
		code: "PageUp",
		key: "PageUp"
	},
	{
		code: "PageDown",
		key: "PageDown"
	},
	{
		code: "Fn",
		key: "Fn"
	},
	{
		code: "Symbol",
		key: "Symbol"
	},
	{
		code: "AltRight",
		key: "AltGraph"
	}
], fx = [
	{
		name: "MouseLeft",
		pointerType: "mouse",
		button: "primary"
	},
	{
		name: "MouseRight",
		pointerType: "mouse",
		button: "secondary"
	},
	{
		name: "MouseMiddle",
		pointerType: "mouse",
		button: "auxiliary"
	},
	{
		name: "TouchA",
		pointerType: "touch"
	},
	{
		name: "TouchB",
		pointerType: "touch"
	},
	{
		name: "TouchC",
		pointerType: "touch"
	}
];
function px(e, t, n) {
	return t in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
var mx = class {
	getButtons() {
		let e = 0;
		for (let t of Object.keys(this.pressed)) e |= 2 ** Number(t);
		return e;
	}
	down(e) {
		let t = gx(e.button);
		if (t in this.pressed) this.pressed[t].push(e);
		else return this.pressed[t] = [e], t;
	}
	up(e) {
		let t = gx(e.button);
		if (t in this.pressed && (this.pressed[t] = this.pressed[t].filter((t) => t.name !== e.name), this.pressed[t].length === 0)) return delete this.pressed[t], t;
	}
	constructor() {
		px(this, "pressed", {});
	}
}, hx = {
	primary: 0,
	secondary: 1,
	auxiliary: 2,
	back: 3,
	X1: 3,
	forward: 4,
	X2: 4
};
function gx(e = 0) {
	return e in hx ? hx[e] : Number(e);
}
var _x = {
	1: 2,
	2: 1
};
function vx(e) {
	return e = gx(e), e in _x ? _x[e] : e;
}
function yx(e, t, n) {
	return t in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
var bx = class {
	get countPressed() {
		return this.pressedKeys.size;
	}
	isPressed(e) {
		return this.pressedKeys.has(e.name);
	}
	addPressed(e) {
		return this.pressedKeys.add(e.name);
	}
	removePressed(e) {
		return this.pressedKeys.delete(e.name);
	}
	constructor() {
		yx(this, "pressedKeys", /* @__PURE__ */ new Set());
	}
};
function xx(e, t) {
	let n = [];
	for (let t = e; t; t = t.parentElement) n.push(t);
	let r = [];
	for (let e = t; e; e = e.parentElement) r.push(e);
	let i = 0;
	for (; !(i >= n.length || i >= r.length || n[n.length - 1 - i] !== r[r.length - 1 - i]); i++);
	return [
		n.slice(0, n.length - i),
		r.slice(0, r.length - i),
		r.slice(r.length - i)
	];
}
function Sx({ target: e, node: t, offset: n }) {
	return oy(e) ? {
		node: e,
		offset: n ?? by(e).length
	} : t ? {
		node: t,
		offset: n ?? (t.nodeType === 3 ? t.nodeValue.length : t.childNodes.length)
	} : Cx(e, n);
}
function Cx(e, t, n = !0) {
	let r = t === void 0 ? e.childNodes.length - 1 : 0, i = t === void 0 ? -1 : 1;
	for (; t === void 0 ? r >= (n ? Math.max(e.childNodes.length - 1, 0) : 0) : r <= e.childNodes.length;) {
		if (t && r === e.childNodes.length) throw Error("The given offset is out of bounds.");
		let n = e.childNodes.item(r), a = String(n.textContent);
		if (a.length) {
			if (t !== void 0 && a.length < t) t -= a.length;
			else {
				if (n.nodeType === 1) return Cx(n, t, !1);
				if (n.nodeType === 3) return {
					node: n,
					offset: t ?? n.nodeValue.length
				};
			}
		}
		r += i;
	}
	return {
		node: e,
		offset: e.childNodes.length
	};
}
function wx({ document: e, target: t, clickCount: n, node: r, offset: i }) {
	if (sy(t)) return;
	let a = oy(t), o = String(a ? by(t) : t.textContent), [s, c] = r ? [i, i] : Tx(o, i, n);
	if (a) return Ty(t, {
		anchorOffset: s ?? o.length,
		focusOffset: c ?? o.length
	}), {
		node: t,
		start: s ?? 0,
		end: c ?? o.length
	};
	{
		let { node: n, offset: i } = Sx({
			target: t,
			node: r,
			offset: s
		}), { node: a, offset: o } = Sx({
			target: t,
			node: r,
			offset: c
		}), l = t.ownerDocument.createRange();
		try {
			l.setStart(n, i), l.setEnd(a, o);
		} catch {
			throw Error("The given offset is out of bounds.");
		}
		let u = e.getSelection();
		return u?.removeAllRanges(), u?.addRange(l.cloneRange()), l;
	}
}
function Tx(e, t, n) {
	if (n % 3 == 1 || e.length === 0) return [t, t];
	let r = t ?? e.length;
	return n % 3 == 2 ? [r - e.substr(0, t).match(/(\w+|\s+|\W)?$/)[0].length, t === void 0 ? t : t + e.substr(t).match(/^(\w+|\s+|\W)?/)[0].length] : [r - e.substr(0, t).match(/[^\r\n]*$/)[0].length, t === void 0 ? t : t + e.substr(t).match(/^[^\r\n]*/)[0].length];
}
function Ex(e, { document: t, target: n, node: r, offset: i }) {
	let a = Sx({
		target: n,
		node: r,
		offset: i
	});
	if ("node" in e) {
		if (a.node === e.node) {
			let t = a.offset < e.start ? e.end : e.start, n = a.offset > e.end || a.offset < e.start ? a.offset : e.end;
			Ty(e.node, {
				anchorOffset: t,
				focusOffset: n
			});
		}
	} else {
		let n = e.cloneRange(), r = n.comparePoint(a.node, a.offset);
		r < 0 ? n.setStart(a.node, a.offset) : r > 0 && n.setEnd(a.node, a.offset);
		let i = t.getSelection();
		i?.removeAllRanges(), i?.addRange(n.cloneRange());
	}
}
function Dx(e, t) {
	return e.target !== t.target || e.coords?.x !== t.coords?.x || e.coords?.y !== t.coords?.y || e.coords?.clientX !== t.coords?.clientX || e.coords?.clientY !== t.coords?.clientY || e.coords?.offsetX !== t.coords?.offsetX || e.coords?.offsetY !== t.coords?.offsetY || e.coords?.pageX !== t.coords?.pageX || e.coords?.pageY !== t.coords?.pageY || e.coords?.screenX !== t.coords?.screenX || e.coords?.screenY !== t.coords?.screenY || e.caret?.node !== t.caret?.node || e.caret?.offset !== t.caret?.offset;
}
function Ox(e, t, n) {
	return t in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
var kx = class {
	move(e, t, n) {
		let r = this.position, i = this.getTarget(e);
		if (this.position = t, !Dx(r, t)) return;
		let a = this.getTarget(e), o = this.getEventInit("mousemove"), [s, c] = xx(i, a);
		return {
			leave: () => {
				i !== a && (e.dispatchUIEvent(i, "mouseout", o), s.forEach((t) => e.dispatchUIEvent(t, "mouseleave", o)));
			},
			enter: () => {
				i !== a && (e.dispatchUIEvent(a, "mouseover", o), c.forEach((t) => e.dispatchUIEvent(t, "mouseenter", o)));
			},
			move: () => {
				n || (e.dispatchUIEvent(a, "mousemove", o), this.modifySelecting(e));
			}
		};
	}
	down(e, t, n) {
		let r = this.buttons.down(t);
		if (r === void 0) return;
		let i = this.getTarget(e);
		this.buttonDownTarget[r] = i;
		let a = this.getEventInit("mousedown", t.button), o = Jv(i);
		!n && (o || e.dispatchUIEvent(i, "mousedown", a)) && (this.startSelecting(e, a.detail), dy(i)), !o && vx(t.button) === 2 && e.dispatchUIEvent(i, "contextmenu", this.getEventInit("contextmenu", t.button));
	}
	up(e, t, n) {
		let r = this.buttons.up(t);
		if (r === void 0) return;
		let i = this.getTarget(e);
		if (!Jv(i)) {
			if (!n) {
				let n = this.getEventInit("mouseup", t.button);
				e.dispatchUIEvent(i, "mouseup", n), this.endSelecting();
			}
			let a = xx(this.buttonDownTarget[r], i)[2][0];
			if (a) {
				let n = this.getEventInit("click", t.button);
				n.detail && (e.dispatchUIEvent(a, n.button === 0 ? "click" : "auxclick", n), n.button === 0 && n.detail === 2 && e.dispatchUIEvent(a, "dblclick", {
					...this.getEventInit("dblclick", t.button),
					detail: n.detail
				}));
			}
		}
	}
	resetClickCount() {
		this.clickCount.reset();
	}
	getEventInit(e, t) {
		let n = { ...this.position.coords };
		return n.button = vx(t), n.buttons = this.buttons.getButtons(), e === "mousedown" ? n.detail = this.clickCount.getOnDown(n.button) : e === "mouseup" ? n.detail = this.clickCount.getOnUp(n.button) : (e === "click" || e === "auxclick") && (n.detail = this.clickCount.incOnClick(n.button)), n;
	}
	getTarget(e) {
		return this.position.target ?? e.config.document.body;
	}
	startSelecting(e, t) {
		this.selecting = wx({
			document: e.config.document,
			target: this.getTarget(e),
			node: this.position.caret?.node,
			offset: this.position.caret?.offset,
			clickCount: t
		});
	}
	modifySelecting(e) {
		this.selecting && Ex(this.selecting, {
			document: e.config.document,
			target: this.getTarget(e),
			node: this.position.caret?.node,
			offset: this.position.caret?.offset
		});
	}
	endSelecting() {
		this.selecting = void 0;
	}
	constructor() {
		Ox(this, "position", {}), Ox(this, "buttons", new mx()), Ox(this, "selecting", void 0), Ox(this, "buttonDownTarget", {}), Ox(this, "clickCount", new class {
			incOnClick(e) {
				let t = this.down[e] === void 0 ? void 0 : Number(this.down[e]) + 1;
				return this.count = this.count[e] === void 0 ? {} : { [e]: Number(this.count[e]) + 1 }, t;
			}
			getOnDown(e) {
				return this.down = { [e]: this.count[e] ?? 0 }, this.count = { [e]: this.count[e] ?? 0 }, Number(this.count[e]) + 1;
			}
			getOnUp(e) {
				return this.down[e] === void 0 ? void 0 : Number(this.down[e]) + 1;
			}
			reset() {
				this.count = {};
			}
			constructor() {
				Ox(this, "down", {}), Ox(this, "count", {});
			}
		}());
	}
};
function Ax(e, t) {
	return Nx(e, t)?.pointerEvents !== "none";
}
function jx(e) {
	let t = Sv(e);
	for (let n = e, r = []; n?.ownerDocument; n = n.parentElement) {
		r.push(n);
		let e = t.getComputedStyle(n).pointerEvents;
		if (e && !["inherit", "unset"].includes(e)) return {
			pointerEvents: e,
			tree: r
		};
	}
}
var Mx = /* @__PURE__ */ Symbol("Last check for pointer-events");
function Nx(e, t) {
	let n = t[Mx];
	if (!(e.config.pointerEventsCheck !== rx.Never && (!n || Lx(e.config.pointerEventsCheck, rx.EachApiCall) && n[$b.Call] !== tx(e, $b.Call) || Lx(e.config.pointerEventsCheck, rx.EachTrigger) && n[$b.Trigger] !== tx(e, $b.Trigger)))) return n?.result;
	let r = jx(t);
	return t[Mx] = {
		[$b.Call]: tx(e, $b.Call),
		[$b.Trigger]: tx(e, $b.Trigger),
		result: r
	}, r;
}
function Px(e, t) {
	let n = Nx(e, t);
	if (n?.pointerEvents === "none") throw Error([
		`Unable to perform pointer interaction as the element ${n.tree.length > 1 ? "inherits" : "has"} \`pointer-events: none\`:`,
		"",
		Fx(n.tree)
	].join("\n"));
}
function Fx(e) {
	return e.reverse().map((t, n) => [
		"".padEnd(n),
		t.tagName,
		t.id && `#${t.id}`,
		t.hasAttribute("data-testid") && `(testId=${t.getAttribute("data-testid")})`,
		Ix(t),
		e.length > 1 && n === 0 && "  <-- This element declared `pointer-events: none`",
		e.length > 1 && n === e.length - 1 && "  <-- Asserted pointer events here"
	].filter(Boolean).join("")).join("\n");
}
function Ix(e) {
	var t;
	let n;
	if (e.hasAttribute("aria-label")) n = e.getAttribute("aria-label");
	else if (e.hasAttribute("aria-labelledby")) {
		var r, i;
		n = (i = e.ownerDocument.getElementById(e.getAttribute("aria-labelledby"))) == null || (r = i.textContent) == null ? void 0 : r.trim();
	} else Z(e, [
		"button",
		"input",
		"meter",
		"output",
		"progress",
		"select",
		"textarea"
	]) && (t = e.labels) != null && t.length ? n = Array.from(e.labels).map((e) => e.textContent?.trim()).join("|") : Z(e, "button") && (n = e.textContent?.trim());
	return n = n?.replace(/\n/g, "  "), Number(n?.length) > 30 && (n = `${n?.substring(0, 29)}\u2026`), n ? `(label=${n})` : "";
}
function Lx(e, t) {
	return (e & t) > 0;
}
function Rx(e, t, n) {
	return t in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
var zx = class {
	init(e) {
		let t = this.getTarget(e), [, n] = xx(null, t), r = this.getEventInit();
		return Px(e, t), e.dispatchUIEvent(t, "pointerover", r), n.forEach((t) => e.dispatchUIEvent(t, "pointerenter", r)), this;
	}
	move(e, t) {
		let n = this.position, r = this.getTarget(e);
		if (this.position = t, !Dx(n, t)) return;
		let i = this.getTarget(e), a = this.getEventInit(-1), [o, s] = xx(r, i);
		return {
			leave: () => {
				Ax(e, r) && r !== i && (e.dispatchUIEvent(r, "pointerout", a), o.forEach((t) => e.dispatchUIEvent(t, "pointerleave", a)));
			},
			enter: () => {
				Px(e, i), r !== i && (e.dispatchUIEvent(i, "pointerover", a), s.forEach((t) => e.dispatchUIEvent(t, "pointerenter", a)));
			},
			move: () => {
				e.dispatchUIEvent(i, "pointermove", a);
			}
		};
	}
	down(e, t = 0) {
		if (this.isDown) return;
		let n = this.getTarget(e);
		Px(e, n), this.isDown = !0, this.isPrevented = !e.dispatchUIEvent(n, "pointerdown", this.getEventInit(t));
	}
	up(e, t = 0) {
		if (!this.isDown) return;
		let n = this.getTarget(e);
		Px(e, n), this.isPrevented = !1, this.isDown = !1, e.dispatchUIEvent(n, "pointerup", this.getEventInit(t));
	}
	release(e) {
		let t = this.getTarget(e), [n] = xx(t, null), r = this.getEventInit();
		Ax(e, t) && (e.dispatchUIEvent(t, "pointerout", r), n.forEach((t) => e.dispatchUIEvent(t, "pointerleave", r))), this.isCancelled = !0;
	}
	getTarget(e) {
		return this.position.target ?? e.config.document.body;
	}
	getEventInit(e) {
		return {
			...this.position.coords,
			pointerId: this.pointerId,
			pointerType: this.pointerType,
			isPrimary: this.isPrimary,
			button: vx(e),
			buttons: this.buttons.getButtons()
		};
	}
	constructor({ pointerId: e, pointerType: t, isPrimary: n }, r) {
		Rx(this, "pointerId", void 0), Rx(this, "pointerType", void 0), Rx(this, "isPrimary", void 0), Rx(this, "buttons", void 0), Rx(this, "isMultitouch", !1), Rx(this, "isCancelled", !1), Rx(this, "isDown", !1), Rx(this, "isPrevented", !1), Rx(this, "position", {}), this.pointerId = e, this.pointerType = t, this.isPrimary = n, this.isMultitouch = !n, this.buttons = r;
	}
};
function Bx(e, t, n) {
	return t in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
var Vx = class {
	isKeyPressed(e) {
		return this.devices.get(e.pointerType).isPressed(e);
	}
	async press(e, t, n) {
		this.devices.get(t.pointerType).addPressed(t), this.buttons.down(t);
		let r = this.getPointerName(t), i = t.pointerType === "touch" ? this.pointers.new(r, t.pointerType, this.buttons) : this.pointers.get(r);
		i.position = n, i.pointerType !== "touch" && (this.mouse.position = n), i.pointerType === "touch" && i.init(e), i.down(e, t.button), i.pointerType !== "touch" && this.mouse.down(e, t, i.isPrevented);
	}
	async move(e, t, n) {
		let r = this.pointers.get(t), i = r.move(e, n), a = r.pointerType === "touch" ? void 0 : this.mouse.move(e, n, r.isPrevented);
		i?.leave(), a?.leave(), i?.enter(), a?.enter(), i?.move(), a?.move();
	}
	async release(e, t, n) {
		let r = this.devices.get(t.pointerType);
		r.removePressed(t), this.buttons.up(t);
		let i = this.pointers.get(this.getPointerName(t)), a = i.isPrevented;
		if (i.position = n, i.pointerType !== "touch" && (this.mouse.position = n), r.countPressed === 0 && i.up(e, t.button), i.pointerType === "touch" && i.release(e), i.pointerType === "touch" && !i.isMultitouch) {
			let r = this.mouse.move(e, n, a);
			r?.leave(), r?.enter(), r?.move(), this.mouse.down(e, t, a);
		}
		if (!i.isMultitouch) {
			let r = this.mouse.move(e, n, a);
			r?.leave(), r?.enter(), r?.move(), this.mouse.up(e, t, a);
		}
	}
	getPointerName(e) {
		return e.pointerType === "touch" ? e.name : e.pointerType;
	}
	getPreviousPosition(e) {
		return this.pointers.has(e) ? this.pointers.get(e).position : void 0;
	}
	resetClickCount() {
		this.mouse.resetClickCount();
	}
	getMouseTarget(e) {
		return this.mouse.position.target ?? e.config.document.body;
	}
	setMousePosition(e) {
		this.mouse.position = e, this.pointers.get("mouse").position = e;
	}
	constructor(e) {
		Bx(this, "system", void 0), Bx(this, "mouse", void 0), Bx(this, "buttons", void 0), Bx(this, "devices", new class {
			get(e) {
				var t, n;
				return (t = this.registry)[n = e] ?? (t[n] = new bx());
			}
			constructor() {
				Bx(this, "registry", {});
			}
		}()), Bx(this, "pointers", new class {
			new(e, t, n) {
				let r = t !== "touch" || !Object.values(this.registry).some((e) => e.pointerType === "touch" && !e.isCancelled);
				return r || Object.values(this.registry).forEach((e) => {
					e.pointerType === t && !e.isCancelled && (e.isMultitouch = !0);
				}), this.registry[e] = new zx({
					pointerId: this.nextId++,
					pointerType: t,
					isPrimary: r
				}, n), this.registry[e];
			}
			get(e) {
				if (!this.has(e)) throw Error(`Trying to access pointer "${e}" which does not exist.`);
				return this.registry[e];
			}
			has(e) {
				return e in this.registry;
			}
			constructor() {
				Bx(this, "registry", {}), Bx(this, "nextId", 1);
			}
		}()), this.system = e, this.buttons = new mx(), this.mouse = new kx(), this.pointers.new("mouse", "mouse", this.buttons);
	}
};
function Hx(e, t, n) {
	return t in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
var Ux = class {
	getUIEventModifiers() {
		return {
			altKey: this.keyboard.modifiers.Alt,
			ctrlKey: this.keyboard.modifiers.Control,
			metaKey: this.keyboard.modifiers.Meta,
			shiftKey: this.keyboard.modifiers.Shift,
			modifierAltGraph: this.keyboard.modifiers.AltGraph,
			modifierCapsLock: this.keyboard.modifiers.CapsLock,
			modifierFn: this.keyboard.modifiers.Fn,
			modifierFnLock: this.keyboard.modifiers.FnLock,
			modifierNumLock: this.keyboard.modifiers.NumLock,
			modifierScrollLock: this.keyboard.modifiers.ScrollLock,
			modifierSymbol: this.keyboard.modifiers.Symbol,
			modifierSymbolLock: this.keyboard.modifiers.SymbolLock
		};
	}
	constructor() {
		Hx(this, "keyboard", new ux(this)), Hx(this, "pointer", new Vx(this));
	}
};
async function Wx(e) {
	let t = [];
	return this.config.skipHover || t.push({ target: e }), t.push({
		keys: "[MouseLeft]",
		target: e
	}), this.pointer(t);
}
async function Gx(e) {
	return this.pointer([{ target: e }, "[MouseLeft][MouseLeft]"]);
}
async function Kx(e) {
	return this.pointer([{ target: e }, "[MouseLeft][MouseLeft][MouseLeft]"]);
}
async function qx(e) {
	return this.pointer({ target: e });
}
async function Jx(e) {
	return Px(this, this.system.pointer.getMouseTarget(this)), this.pointer({ target: e.ownerDocument.body });
}
async function Yx({ shift: e } = {}) {
	return this.keyboard(e === !0 ? "{Shift>}{Tab}{/Shift}" : e === !1 ? "[/ShiftLeft][/ShiftRight]{Tab}" : "{Tab}");
}
var Xx = {
	"{": "}",
	"[": "]"
};
function Zx(e, t) {
	let n = 0, r = e[n] in Xx ? e[n] : "";
	n += r.length;
	let i = RegExp(`^\\${r}{2}`).test(e) ? "" : r;
	return {
		type: i,
		...i === "" ? Qx(e, n, t) : $x(e, n, i, t)
	};
}
function Qx(e, t, n) {
	let r = e[t];
	return eS(r, e, t, n), t += r.length, {
		consumedLength: t,
		descriptor: r,
		releasePrevious: !1,
		releaseSelf: !0,
		repeat: 1
	};
}
function $x(e, t, n, r) {
	let i = e[t] === "/" ? "/" : "";
	t += i.length;
	let a = n === "{" && e[t] === "\\";
	t += Number(a);
	let o = a ? e[t] : e.slice(t).match(n === "{" ? /^\w+|^[^}>/]/ : /^\w+/)?.[0];
	eS(o, e, t, r), t += o.length;
	let s = e.slice(t).match(/^>\d+/)?.[0] ?? "";
	t += s.length;
	let c = e[t] === "/" || !s && e[t] === ">" ? e[t] : "";
	t += c.length;
	let l = Xx[n], u = e[t] === l ? l : "";
	if (!u) throw Error(nS([
		!s && "repeat modifier",
		!c && "release modifier",
		`"${l}"`
	].filter(Boolean).join(" or "), e[t], e, r));
	return t += u.length, {
		consumedLength: t,
		descriptor: o,
		releasePrevious: !!i,
		repeat: s ? Math.max(Number(s.substr(1)), 1) : 1,
		releaseSelf: tS(c, s)
	};
}
function eS(e, t, n, r) {
	if (!e) throw Error(nS("key descriptor", t[n], t, r));
}
function tS(e, t) {
	if (e) return e === "/";
	if (t) return !1;
}
function nS(e, t, n, r) {
	return `Expected ${e} but found "${t ?? ""}" in "${n}"
    See ${r === "pointer" ? "https://testing-library.com/docs/user-event/pointer#pressing-a-button-or-touching-the-screen" : "https://testing-library.com/docs/user-event/keyboard"}
    for more information about how userEvent parses your input.`;
}
function rS(e, t) {
	let n = [];
	do {
		let { type: r, descriptor: i, consumedLength: a, releasePrevious: o, releaseSelf: s = !0, repeat: c } = Zx(t, "keyboard"), l = e.find((e) => r === "[" ? e.code?.toLowerCase() === i.toLowerCase() : r === "{" ? e.key?.toLowerCase() === i.toLowerCase() : e.key === i) ?? {
			key: "Unknown",
			code: "Unknown",
			[r === "[" ? "code" : "key"]: i
		};
		n.push({
			keyDef: l,
			releasePrevious: o,
			releaseSelf: s,
			repeat: c
		}), t = t.slice(a);
	} while (t);
	return n;
}
async function iS(e) {
	let t = rS(this.config.keyboardMap, e);
	for (let e = 0; e < t.length; e++) await nx(this.config), await aS(this, t[e]);
}
async function aS(e, { keyDef: t, releasePrevious: n, releaseSelf: r, repeat: i }) {
	let { system: a } = e;
	if (a.keyboard.isKeyPressed(t) && await a.keyboard.keyup(e, t), !n) {
		for (let n = 1; n <= i; n++) await a.keyboard.keydown(e, t), n < i && await nx(e.config);
		r && await a.keyboard.keyup(e, t);
	}
}
async function oS(e) {
	for (let t of e.system.keyboard.getPressedKeys()) await e.system.keyboard.keyup(e, t);
}
function sS(e) {
	let t = oy(e) ? { "text/plain": cS(e) } : { "text/plain": String(e.ownerDocument.getSelection()) }, n = Mv(Sv(e));
	for (let e in t) t[e] && n.setData(e, t[e]);
	return n;
}
function cS(e) {
	let t = Ey(e);
	return by(e).substring(t.startOffset, t.endOffset);
}
async function lS() {
	let e = this.config.document, t = e.activeElement ?? 
	/* istanbul ignore next */
	e.body, n = sS(t);
	if (n.items.length !== 0) return this.dispatchUIEvent(t, "copy", { clipboardData: n }) && this.config.writeToClipboard && await Uv(e, n), n;
}
async function uS() {
	let e = this.config.document, t = e.activeElement ?? 
	/* istanbul ignore next */
	e.body, n = sS(t);
	if (n.items.length !== 0) return this.dispatchUIEvent(t, "cut", { clipboardData: n }) && this.config.writeToClipboard && await Uv(t.ownerDocument, n), n;
}
async function dS(e) {
	let t = this.config.document, n = t.activeElement ?? 
	/* istanbul ignore next */
	t.body, r = (typeof e == "string" ? fS(t, e) : e) ?? await Hv(t).catch(() => {
		throw Error("`userEvent.paste()` without `clipboardData` requires the `ClipboardAPI` to be available.");
	});
	this.dispatchUIEvent(n, "paste", { clipboardData: r });
}
function fS(e, t) {
	let n = Mv(Sv(e));
	return n.setData("text", t), n;
}
function pS(e, t) {
	let n = [];
	do {
		let { descriptor: r, consumedLength: i, releasePrevious: a, releaseSelf: o = !0 } = Zx(t, "pointer"), s = e.find((e) => e.name === r);
		s && n.push({
			keyDef: s,
			releasePrevious: a,
			releaseSelf: o
		}), t = t.slice(i);
	} while (t);
	return n;
}
async function mS(e) {
	let { pointerMap: t } = this.config, n = [];
	(Array.isArray(e) ? e : [e]).forEach((e) => {
		typeof e == "string" ? n.push(...pS(t, e)) : "keys" in e ? n.push(...pS(t, e.keys).map((t) => ({
			...e,
			...t
		}))) : n.push(e);
	});
	for (let e = 0; e < n.length; e++) await nx(this.config), await hS(this, n[e]);
	this.system.pointer.resetClickCount();
}
async function hS(e, t) {
	var n, r;
	let i = "pointerName" in t && t.pointerName ? t.pointerName : "keyDef" in t ? e.system.pointer.getPointerName(t.keyDef) : "mouse", a = e.system.pointer.getPreviousPosition(i), o = {
		target: t.target ?? _S(e, a),
		coords: t.coords ?? a?.coords,
		caret: {
			node: t.node ?? (gS(t) || a == null || (n = a.caret) == null ? void 0 : n.node),
			offset: t.offset ?? (gS(t) || a == null || (r = a.caret) == null ? void 0 : r.offset)
		}
	};
	"keyDef" in t ? (e.system.pointer.isKeyPressed(t.keyDef) && (ex(e, $b.Trigger), await e.system.pointer.release(e, t.keyDef, o)), t.releasePrevious || (ex(e, $b.Trigger), await e.system.pointer.press(e, t.keyDef, o), t.releaseSelf && (ex(e, $b.Trigger), await e.system.pointer.release(e, t.keyDef, o)))) : (ex(e, $b.Trigger), await e.system.pointer.move(e, i, o));
}
function gS(e) {
	return !!(e.target ?? e.node ?? e.offset !== void 0);
}
function _S(e, t) {
	if (!t) throw Error("This pointer has no previous position. Provide a target property!");
	return t.target ?? e.config.document.body;
}
async function vS(e) {
	if (!ry(e) || Jv(e)) throw Error("clear()` is only supported on editable elements.");
	if (dy(e), e.ownerDocument.activeElement !== e) throw Error("The element to be cleared could not be focused.");
	if (ub(e), !db(e)) throw Error("The element content to be cleared could not be selected.");
	eb(this, e, "", "deleteContentBackward");
}
async function yS(e, t) {
	return xS.call(this, !0, e, t);
}
async function bS(e, t) {
	return xS.call(this, !1, e, t);
}
async function xS(e, n, r) {
	if (!e && !n.multiple) throw t().getElementError("Unable to deselect an option in a non-multiple select. Use selectOptions to change the selection instead.", n);
	let i = Array.isArray(r) ? r : [r], a = Array.from(n.querySelectorAll("option, [role=\"option\"]")), o = i.map((e) => {
		if (typeof e != "string" && a.includes(e)) return e;
		{
			let r = a.find((t) => t.value === e || t.innerHTML === e);
			if (r) return r;
			throw t().getElementError(`Value "${String(e)}" not found in options`, n);
		}
	}).filter((e) => !Jv(e));
	if (Jv(n) || !o.length) return;
	let s = (t) => {
		t.selected = e, this.dispatchUIEvent(n, "input", {
			bubbles: !0,
			cancelable: !1,
			composed: !0
		}), this.dispatchUIEvent(n, "change");
	};
	if (Z(n, "select")) {
		if (n.multiple) for (let e of o) {
			let t = this.config.pointerEventsCheck === 0 || Ax(this, e);
			t && (this.dispatchUIEvent(e, "pointerover"), this.dispatchUIEvent(n, "pointerenter"), this.dispatchUIEvent(e, "mouseover"), this.dispatchUIEvent(n, "mouseenter"), this.dispatchUIEvent(e, "pointermove"), this.dispatchUIEvent(e, "mousemove"), this.dispatchUIEvent(e, "pointerdown"), this.dispatchUIEvent(e, "mousedown")), dy(n), t && (this.dispatchUIEvent(e, "pointerup"), this.dispatchUIEvent(e, "mouseup")), s(e), t && this.dispatchUIEvent(e, "click"), await nx(this.config);
		}
		else if (o.length === 1) {
			let e = this.config.pointerEventsCheck === 0 || Ax(this, n);
			e ? await this.click(n) : dy(n), s(o[0]), e && (this.dispatchUIEvent(n, "pointerover"), this.dispatchUIEvent(n, "pointerenter"), this.dispatchUIEvent(n, "mouseover"), this.dispatchUIEvent(n, "mouseenter"), this.dispatchUIEvent(n, "pointerup"), this.dispatchUIEvent(n, "mouseup"), this.dispatchUIEvent(n, "click")), await nx(this.config);
		} else throw t().getElementError("Cannot select multiple options on a non-multiple select", n);
	} else if (n.getAttribute("role") === "listbox") for (let e of o) await this.click(e), await this.unhover(e);
	else throw t().getElementError("Cannot select options on elements that are neither select nor listbox elements", n);
}
async function SS(e, t, { skipClick: n = this.config.skipClick, skipAutoClose: r = this.config.skipAutoClose, initialSelectionStart: i, initialSelectionEnd: a } = {}) {
	e.disabled || (n || await this.click(e), i !== void 0 && fb(e, i, a ?? i), await this.keyboard(t), r || await oS(this));
}
var CS = /* @__PURE__ */ Symbol("files and value properties are mocked");
function wS(e, t, n) {
	n ? Object.defineProperty(e, t, n) : delete e[t];
}
function TS(e, t) {
	var n;
	(n = e[CS]) == null || n.restore();
	let r = Object.getOwnPropertyDescriptor(e, "type"), i = Object.getOwnPropertyDescriptor(e, "value"), a = Object.getOwnPropertyDescriptor(e, "files");
	function o() {
		wS(e, "type", r), wS(e, "value", i), wS(e, "files", a);
	}
	e[CS] = { restore: o }, Object.defineProperties(e, {
		files: {
			configurable: !0,
			get: () => t
		},
		value: {
			configurable: !0,
			get: () => t.length ? `C:\\fakepath\\${t[0].name}` : "",
			set(t) {
				if (t === "") o();
				else {
					var n;
					i == null || (n = i.set) == null || n.call(e, t);
				}
			}
		},
		type: {
			configurable: !0,
			get: () => "file",
			set(t) {
				t !== "file" && (o(), e.type = t);
			}
		}
	});
}
async function ES(e, t) {
	let n = Z(e, "label") ? e.control : e;
	if (!n || !Z(n, "input", { type: "file" })) throw TypeError(`The ${n === e ? "given" : "associated"} ${n?.tagName} element does not accept file uploads`);
	if (Jv(e)) return;
	let r = (Array.isArray(t) ? t : [t]).filter((e) => !this.config.applyAccept || OS(e, n.accept)).slice(0, n.multiple ? void 0 : 1), i = () => {
		r.length === n.files?.length && r.every((e, t) => e === n.files?.item(t)) || (TS(n, Ev(Sv(e), r)), this.dispatchUIEvent(n, "input"), this.dispatchUIEvent(n, "change"));
	};
	n.addEventListener("fileDialog", i), await this.click(e), n.removeEventListener("fileDialog", i);
}
function DS(e) {
	return e.toLowerCase().replace(/(\.|\/)jpg\b/g, "$1jpeg");
}
function OS(e, t) {
	if (!t) return !0;
	let n = [
		"audio/*",
		"image/*",
		"video/*"
	];
	return DS(t).trim().split(/\s*,\s*/).some((t) => t.startsWith(".") ? DS(e.name).endsWith(t) : n.includes(t) ? DS(e.type).startsWith(t.replace("*", "")) : DS(e.type) === t);
}
var kS = {
	click: Wx,
	dblClick: Gx,
	tripleClick: Kx,
	hover: qx,
	unhover: Jx,
	tab: Yx,
	keyboard: iS,
	copy: lS,
	cut: uS,
	paste: dS,
	pointer: mS,
	clear: vS,
	deselectOptions: bS,
	selectOptions: yS,
	type: SS,
	upload: ES
};
function AS(e) {
	return t().asyncWrapper(e);
}
var jS = {
	applyAccept: !0,
	autoModify: !0,
	delay: 0,
	document: globalThis.document,
	keyboardMap: dx,
	pointerMap: fx,
	pointerEventsCheck: rx.EachApiCall,
	skipAutoClose: !1,
	skipClick: !1,
	skipHover: !1,
	writeToClipboard: !1,
	advanceTimers: () => Promise.resolve()
}, MS = {
	...jS,
	writeToClipboard: !0
};
function NS(e = {}, t = MS, n) {
	let r = RS(e, n, t);
	return {
		...t,
		...e,
		document: r
	};
}
function PS(e = {}) {
	let t = NS(e);
	return Yb(t.document), Bb(Sv(t.document).HTMLElement), zv(t.document.defaultView ?? 
	/* istanbul ignore next */
	globalThis.window), LS(t).api;
}
function $({ keyboardState: e, pointerState: t, ...n } = {}, r) {
	let i = NS(n, jS, r);
	Yb(i.document), Bb(Sv(i.document).HTMLElement);
	let a = t ?? e ?? new Ux();
	return {
		api: LS(i, a).api,
		system: a
	};
}
function FS(e) {
	return LS({
		...this.config,
		...e
	}, this.system).api;
}
function IS(e, t) {
	function n(...n) {
		return ex(e, $b.Call), AS(() => t.apply(e, n).then(async (t) => (await nx(e.config), t)));
	}
	return Object.defineProperty(n, "name", { get: () => t.name }), n;
}
function LS(e, t = new Ux()) {
	let n = {};
	return Object.assign(n, {
		config: e,
		dispatchEvent: Lb.bind(n),
		dispatchUIEvent: Ib.bind(n),
		system: t,
		levelRefs: {},
		...kS
	}), {
		instance: n,
		api: {
			...Object.fromEntries(Object.entries(kS).map(([e, t]) => [e, IS(n, t)])),
			setup: FS.bind(n)
		}
	};
}
function RS(e, t, n) {
	return e.document ?? (t && Zb(t)) ?? n.document;
}
var zS = {};
f(zS, {
	clear: () => BS,
	click: () => VS,
	copy: () => HS,
	cut: () => US,
	dblClick: () => WS,
	deselectOptions: () => GS,
	hover: () => KS,
	keyboard: () => qS,
	paste: () => YS,
	pointer: () => JS,
	selectOptions: () => XS,
	tab: () => tC,
	tripleClick: () => ZS,
	type: () => QS,
	unhover: () => $S,
	upload: () => eC
});
function BS(e) {
	return $().api.clear(e);
}
function VS(e, t = {}) {
	return $(t, e).api.click(e);
}
function HS(e = {}) {
	return $(e).api.copy();
}
function US(e = {}) {
	return $(e).api.cut();
}
function WS(e, t = {}) {
	return $(t).api.dblClick(e);
}
function GS(e, t, n = {}) {
	return $(n).api.deselectOptions(e, t);
}
function KS(e, t = {}) {
	return $(t).api.hover(e);
}
async function qS(e, t = {}) {
	let { api: n, system: r } = $(t);
	return n.keyboard(e).then(() => r);
}
async function JS(e, t = {}) {
	let { api: n, system: r } = $(t);
	return n.pointer(e).then(() => r);
}
function YS(e, t) {
	return $(t).api.paste(e);
}
function XS(e, t, n = {}) {
	return $(n).api.selectOptions(e, t);
}
function ZS(e, t = {}) {
	return $(t).api.tripleClick(e);
}
function QS(e, t, n = {}) {
	return $(n, e).api.type(e, t, n);
}
function $S(e, t = {}) {
	let { api: n, system: r } = $(t);
	return r.pointer.setMousePosition({ target: e }), n.unhover(e);
}
function eC(e, t, n = {}) {
	return $(n).api.upload(e, t);
}
function tC(e = {}) {
	return $().api.tab(e);
}
var nC = {
	...zS,
	setup: PS
}, rC = ko({ ...r }, {
	getKeys: (e) => Object.keys(e).filter((e) => e !== "eventWrapper"),
	intercept: (e, t) => t[0] === "fireEvent" || e.startsWith("find") || e.startsWith("waitFor")
});
rC.screen = new Proxy(rC.screen, { get(e, t, n) {
	return typeof window < "u" && globalThis.location?.href?.includes("viewMode=docs") && S.warn(g`
        You are using Testing Library's \`screen\` object while the story is rendered in docs mode. This will likely lead to issues, as multiple stories are rendered in the same page and therefore screen will potentially find multiple elements. Use the \`canvas\` utility from the story context instead, which will scope the queries to each story's canvas.

        More info: https://storybook.js.org/docs/writing-tests/interaction-testing?ref=error#querying-the-canvas
      `), Reflect.get(e, t, n);
} });
var { buildQueries: iC, configure: aC, createEvent: oC, fireEvent: sC, findAllByAltText: cC, findAllByDisplayValue: lC, findAllByLabelText: uC, findAllByPlaceholderText: dC, findAllByRole: fC, findAllByTestId: pC, findAllByText: mC, findAllByTitle: hC, findByAltText: gC, findByDisplayValue: _C, findByLabelText: vC, findByPlaceholderText: yC, findByRole: bC, findByTestId: xC, findByText: SC, findByTitle: CC, getAllByAltText: wC, getAllByDisplayValue: TC, getAllByLabelText: EC, getAllByPlaceholderText: DC, getAllByRole: OC, getAllByTestId: kC, getAllByText: AC, getAllByTitle: jC, getByAltText: MC, getByDisplayValue: NC, getByLabelText: PC, getByPlaceholderText: FC, getByRole: IC, getByTestId: LC, getByText: RC, getByTitle: zC, getConfig: BC, getDefaultNormalizer: VC, getElementError: HC, getNodeText: UC, getQueriesForElement: WC, getRoles: GC, getSuggestedQuery: KC, isInaccessible: qC, logDOM: JC, logRoles: YC, prettyDOM: XC, queries: ZC, queryAllByAltText: QC, queryAllByAttribute: $C, queryAllByDisplayValue: ew, queryAllByLabelText: tw, queryAllByPlaceholderText: nw, queryAllByRole: rw, queryAllByTestId: iw, queryAllByText: aw, queryAllByTitle: ow, queryByAltText: sw, queryByAttribute: cw, queryByDisplayValue: lw, queryByLabelText: uw, queryByPlaceholderText: dw, queryByRole: fw, queryByTestId: pw, queryByText: mw, queryByTitle: hw, queryHelpers: gw, screen: _w, waitFor: vw, waitForElementToBeRemoved: yw, within: bw, prettyFormat: xw } = rC, Sw = nC, { userEvent: Cw } = ko({ userEvent: nC }, {
	intercept: !0,
	getKeys: (e) => Object.keys(e).filter((e) => e !== "eventWrapper")
}), { expect: ww } = ko({ expect: ov }, {
	getKeys: (e, t) => {
		if ("constructor" in e && e.constructor === V) {
			let n = [
				"assert",
				"__methods",
				"__flags",
				"_obj"
			], r = Object.keys(Object.getPrototypeOf(e)).filter((e) => !n.includes(e));
			return t > 2 ? r : [...r, "not"];
		}
		return "any" in e ? Object.keys(e).filter((e) => e !== "any") : Object.keys(e);
	},
	mutate: !0,
	intercept: (e) => e !== "expect"
});
export { Ne as A, h as B, fe as C, Ae as D, Ce as E, Ge as F, f as H, ee as I, b as L, Ie as M, pe as N, Re as O, Ue as P, S as R, ue as S, ve as T, u as U, d as V, m as W, $e as _, gv as a, le as b, bv as c, hv as d, Sw as f, ko as g, bw as h, sC as i, Le as j, He as k, xv as l, vw as m, aC as n, Mg as o, Cw as p, ww as r, mv as s, yv as t, _w as u, et as v, me as w, ce as x, ne as y, g as z };
