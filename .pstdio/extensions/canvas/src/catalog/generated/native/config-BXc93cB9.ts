// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { i as e, n as t } from "./i18nInstance-BLasvKSq.ts";
// node_modules/.bun/i18next@25.8.18+8e24a2f921b8d7be/node_modules/i18next/dist/esm/i18next.js
var n = (e) => typeof e == "string", r = () => {
	let e, t, n = new Promise((n, r) => {
		e = n, t = r;
	});
	return n.resolve = e, n.reject = t, n;
}, i = (e) => e == null ? "" : "" + e, a = (e, t, n) => {
	e.forEach((e) => {
		t[e] && (n[e] = t[e]);
	});
}, o = /###/g, s = (e) => e && e.indexOf("###") > -1 ? e.replace(o, ".") : e, c = (e) => !e || n(e), l = (e, t, r) => {
	let i = n(t) ? t.split(".") : t, a = 0;
	for (; a < i.length - 1;) {
		if (c(e)) return {};
		let t = s(i[a]);
		!e[t] && r && (e[t] = new r()), e = Object.prototype.hasOwnProperty.call(e, t) ? e[t] : {}, ++a;
	}
	return c(e) ? {} : {
		obj: e,
		k: s(i[a])
	};
}, u = (e, t, n) => {
	let { obj: r, k: i } = l(e, t, Object);
	if (r !== void 0 || t.length === 1) {
		r[i] = n;
		return;
	}
	let a = t[t.length - 1], o = t.slice(0, t.length - 1), s = l(e, o, Object);
	for (; s.obj === void 0 && o.length;) a = `${o[o.length - 1]}.${a}`, o = o.slice(0, o.length - 1), s = l(e, o, Object), s?.obj && s.obj[`${s.k}.${a}`] !== void 0 && (s.obj = void 0);
	s.obj[`${s.k}.${a}`] = n;
}, d = (e, t, n, r) => {
	let { obj: i, k: a } = l(e, t, Object);
	i[a] = i[a] || [], i[a].push(n);
}, f = (e, t) => {
	let { obj: n, k: r } = l(e, t);
	if (n && Object.prototype.hasOwnProperty.call(n, r)) return n[r];
}, p = (e, t, n) => {
	let r = f(e, n);
	return r === void 0 ? f(t, n) : r;
}, m = (e, t, r) => {
	for (let i in t) i !== "__proto__" && i !== "constructor" && (i in e ? n(e[i]) || e[i] instanceof String || n(t[i]) || t[i] instanceof String ? r && (e[i] = t[i]) : m(e[i], t[i], r) : e[i] = t[i]);
	return e;
}, h = (e) => e.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&"), g = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	"\"": "&quot;",
	"'": "&#39;",
	"/": "&#x2F;"
}, _ = (e) => n(e) ? e.replace(/[&<>"'\/]/g, (e) => g[e]) : e, v = class {
	constructor(e) {
		this.capacity = e, this.regExpMap = /* @__PURE__ */ new Map(), this.regExpQueue = [];
	}
	getRegExp(e) {
		let t = this.regExpMap.get(e);
		if (t !== void 0) return t;
		let n = new RegExp(e);
		return this.regExpQueue.length === this.capacity && this.regExpMap.delete(this.regExpQueue.shift()), this.regExpMap.set(e, n), this.regExpQueue.push(e), n;
	}
}, y = [
	" ",
	",",
	"?",
	"!",
	";"
], b = new v(20), x = (e, t, n) => {
	t ||= "", n ||= "";
	let r = y.filter((e) => t.indexOf(e) < 0 && n.indexOf(e) < 0);
	if (r.length === 0) return !0;
	let i = b.getRegExp(`(${r.map((e) => e === "?" ? "\\?" : e).join("|")})`), a = !i.test(e);
	if (!a) {
		let t = e.indexOf(n);
		t > 0 && !i.test(e.substring(0, t)) && (a = !0);
	}
	return a;
}, S = (e, t, n = ".") => {
	if (!e) return;
	if (e[t]) return Object.prototype.hasOwnProperty.call(e, t) ? e[t] : void 0;
	let r = t.split(n), i = e;
	for (let e = 0; e < r.length;) {
		if (!i || typeof i != "object") return;
		let t, a = "";
		for (let o = e; o < r.length; ++o) if (o !== e && (a += n), a += r[o], t = i[a], t !== void 0) {
			if ([
				"string",
				"number",
				"boolean"
			].indexOf(typeof t) > -1 && o < r.length - 1) continue;
			e += o - e + 1;
			break;
		}
		i = t;
	}
	return i;
}, C = (e) => e?.replace(/_/g, "-"), w = {
	type: "logger",
	log(e) {
		this.output("log", e);
	},
	warn(e) {
		this.output("warn", e);
	},
	error(e) {
		this.output("error", e);
	},
	output(e, t) {
		console?.[e]?.apply?.(console, t);
	}
}, T = new class e {
	constructor(e, t = {}) {
		this.init(e, t);
	}
	init(e, t = {}) {
		this.prefix = t.prefix || "i18next:", this.logger = e || w, this.options = t, this.debug = t.debug;
	}
	log(...e) {
		return this.forward(e, "log", "", !0);
	}
	warn(...e) {
		return this.forward(e, "warn", "", !0);
	}
	error(...e) {
		return this.forward(e, "error", "");
	}
	deprecate(...e) {
		return this.forward(e, "warn", "WARNING DEPRECATED: ", !0);
	}
	forward(e, t, r, i) {
		return i && !this.debug ? null : (n(e[0]) && (e[0] = `${r}${this.prefix} ${e[0]}`), this.logger[t](e));
	}
	create(t) {
		return new e(this.logger, {
			prefix: `${this.prefix}:${t}:`,
			...this.options
		});
	}
	clone(t) {
		return t ||= this.options, t.prefix = t.prefix || this.prefix, new e(this.logger, t);
	}
}(), E = class {
	constructor() {
		this.observers = {};
	}
	on(e, t) {
		return e.split(" ").forEach((e) => {
			this.observers[e] || (this.observers[e] = /* @__PURE__ */ new Map());
			let n = this.observers[e].get(t) || 0;
			this.observers[e].set(t, n + 1);
		}), this;
	}
	off(e, t) {
		this.observers[e] && (t ? this.observers[e].delete(t) : delete this.observers[e]);
	}
	emit(e, ...t) {
		this.observers[e] && Array.from(this.observers[e].entries()).forEach(([e, n]) => {
			for (let r = 0; r < n; r++) e(...t);
		}), this.observers["*"] && Array.from(this.observers["*"].entries()).forEach(([n, r]) => {
			for (let i = 0; i < r; i++) n.apply(n, [e, ...t]);
		});
	}
}, D = class extends E {
	constructor(e, t = {
		ns: ["translation"],
		defaultNS: "translation"
	}) {
		super(), this.data = e || {}, this.options = t, this.options.keySeparator === void 0 && (this.options.keySeparator = "."), this.options.ignoreJSONStructure === void 0 && (this.options.ignoreJSONStructure = !0);
	}
	addNamespaces(e) {
		this.options.ns.indexOf(e) < 0 && this.options.ns.push(e);
	}
	removeNamespaces(e) {
		let t = this.options.ns.indexOf(e);
		t > -1 && this.options.ns.splice(t, 1);
	}
	getResource(e, t, r, i = {}) {
		let a = i.keySeparator === void 0 ? this.options.keySeparator : i.keySeparator, o = i.ignoreJSONStructure === void 0 ? this.options.ignoreJSONStructure : i.ignoreJSONStructure, s;
		e.indexOf(".") > -1 ? s = e.split(".") : (s = [e, t], r && (Array.isArray(r) ? s.push(...r) : n(r) && a ? s.push(...r.split(a)) : s.push(r)));
		let c = f(this.data, s);
		return !c && !t && !r && e.indexOf(".") > -1 && (e = s[0], t = s[1], r = s.slice(2).join(".")), c || !o || !n(r) ? c : S(this.data?.[e]?.[t], r, a);
	}
	addResource(e, t, n, r, i = { silent: !1 }) {
		let a = i.keySeparator === void 0 ? this.options.keySeparator : i.keySeparator, o = [e, t];
		n && (o = o.concat(a ? n.split(a) : n)), e.indexOf(".") > -1 && (o = e.split("."), r = t, t = o[1]), this.addNamespaces(t), u(this.data, o, r), i.silent || this.emit("added", e, t, n, r);
	}
	addResources(e, t, r, i = { silent: !1 }) {
		for (let i in r) (n(r[i]) || Array.isArray(r[i])) && this.addResource(e, t, i, r[i], { silent: !0 });
		i.silent || this.emit("added", e, t, r);
	}
	addResourceBundle(e, t, n, r, i, a = {
		silent: !1,
		skipCopy: !1
	}) {
		let o = [e, t];
		e.indexOf(".") > -1 && (o = e.split("."), r = n, n = t, t = o[1]), this.addNamespaces(t);
		let s = f(this.data, o) || {};
		a.skipCopy || (n = JSON.parse(JSON.stringify(n))), r ? m(s, n, i) : s = {
			...s,
			...n
		}, u(this.data, o, s), a.silent || this.emit("added", e, t, n);
	}
	removeResourceBundle(e, t) {
		this.hasResourceBundle(e, t) && delete this.data[e][t], this.removeNamespaces(t), this.emit("removed", e, t);
	}
	hasResourceBundle(e, t) {
		return this.getResource(e, t) !== void 0;
	}
	getResourceBundle(e, t) {
		return t ||= this.options.defaultNS, this.getResource(e, t);
	}
	getDataByLanguage(e) {
		return this.data[e];
	}
	hasLanguageSomeTranslations(e) {
		let t = this.getDataByLanguage(e);
		return !!(t && Object.keys(t) || []).find((e) => t[e] && Object.keys(t[e]).length > 0);
	}
	toJSON() {
		return this.data;
	}
}, O = {
	processors: {},
	addPostProcessor(e) {
		this.processors[e.name] = e;
	},
	handle(e, t, n, r, i) {
		return e.forEach((e) => {
			t = this.processors[e]?.process(t, n, r, i) ?? t;
		}), t;
	}
}, k = Symbol("i18next/PATH_KEY");
function ee() {
	let e = [], t = Object.create(null), n;
	return t.get = (r, i) => (n?.revoke?.(), i === k ? e : (e.push(i), n = Proxy.revocable(r, t), n.proxy)), Proxy.revocable(Object.create(null), t).proxy;
}
function A(e, t) {
	let { [k]: n } = e(ee()), r = t?.keySeparator ?? ".", i = t?.nsSeparator ?? ":";
	if (n.length > 1 && i) {
		let e = t?.ns;
		if ((e ? Array.isArray(e) ? e : [e] : []).includes(n[0])) return `${n[0]}${i}${n.slice(1).join(r)}`;
	}
	return n.join(r);
}
var j = {}, M = (e) => !n(e) && typeof e != "boolean" && typeof e != "number", N = class e extends E {
	constructor(e, t = {}) {
		super(), a([
			"resourceStore",
			"languageUtils",
			"pluralResolver",
			"interpolator",
			"backendConnector",
			"i18nFormat",
			"utils"
		], e, this), this.options = t, this.options.keySeparator === void 0 && (this.options.keySeparator = "."), this.logger = T.create("translator");
	}
	changeLanguage(e) {
		e && (this.language = e);
	}
	exists(e, t = { interpolation: {} }) {
		let n = { ...t };
		if (e == null) return !1;
		let r = this.resolve(e, n);
		if (r?.res === void 0) return !1;
		let i = M(r.res);
		return !(n.returnObjects === !1 && i);
	}
	extractFromKey(e, t) {
		let r = t.nsSeparator === void 0 ? this.options.nsSeparator : t.nsSeparator;
		r === void 0 && (r = ":");
		let i = t.keySeparator === void 0 ? this.options.keySeparator : t.keySeparator, a = t.ns || this.options.defaultNS || [], o = r && e.indexOf(r) > -1, s = !this.options.userDefinedKeySeparator && !t.keySeparator && !this.options.userDefinedNsSeparator && !t.nsSeparator && !x(e, r, i);
		if (o && !s) {
			let t = e.match(this.interpolator.nestingRegexp);
			if (t && t.length > 0) return {
				key: e,
				namespaces: n(a) ? [a] : a
			};
			let o = e.split(r);
			(r !== i || r === i && this.options.ns.indexOf(o[0]) > -1) && (a = o.shift()), e = o.join(i);
		}
		return {
			key: e,
			namespaces: n(a) ? [a] : a
		};
	}
	translate(t, r, i) {
		let a = typeof r == "object" ? { ...r } : r;
		if (typeof a != "object" && this.options.overloadTranslationOptionHandler && (a = this.options.overloadTranslationOptionHandler(arguments)), typeof a == "object" && (a = { ...a }), a ||= {}, t == null) return "";
		typeof t == "function" && (t = A(t, {
			...this.options,
			...a
		})), Array.isArray(t) || (t = [String(t)]), t = t.map((e) => typeof e == "function" ? A(e, {
			...this.options,
			...a
		}) : String(e));
		let o = a.returnDetails === void 0 ? this.options.returnDetails : a.returnDetails, s = a.keySeparator === void 0 ? this.options.keySeparator : a.keySeparator, { key: c, namespaces: l } = this.extractFromKey(t[t.length - 1], a), u = l[l.length - 1], d = a.nsSeparator === void 0 ? this.options.nsSeparator : a.nsSeparator;
		d === void 0 && (d = ":");
		let f = a.lng || this.language, p = a.appendNamespaceToCIMode || this.options.appendNamespaceToCIMode;
		if (f?.toLowerCase() === "cimode") return p ? o ? {
			res: `${u}${d}${c}`,
			usedKey: c,
			exactUsedKey: c,
			usedLng: f,
			usedNS: u,
			usedParams: this.getUsedParamsDetails(a)
		} : `${u}${d}${c}` : o ? {
			res: c,
			usedKey: c,
			exactUsedKey: c,
			usedLng: f,
			usedNS: u,
			usedParams: this.getUsedParamsDetails(a)
		} : c;
		let m = this.resolve(t, a), h = m?.res, g = m?.usedKey || c, _ = m?.exactUsedKey || c, v = [
			"[object Number]",
			"[object Function]",
			"[object RegExp]"
		], y = a.joinArrays === void 0 ? this.options.joinArrays : a.joinArrays, b = !this.i18nFormat || this.i18nFormat.handleAsObject, x = a.count !== void 0 && !n(a.count), S = e.hasDefaultValue(a), C = x ? this.pluralResolver.getSuffix(f, a.count, a) : "", w = a.ordinal && x ? this.pluralResolver.getSuffix(f, a.count, { ordinal: !1 }) : "", T = x && !a.ordinal && a.count === 0, E = T && a[`defaultValue${this.options.pluralSeparator}zero`] || a[`defaultValue${C}`] || a[`defaultValue${w}`] || a.defaultValue, D = h;
		b && !h && S && (D = E);
		let O = M(D), k = Object.prototype.toString.apply(D);
		if (b && D && O && v.indexOf(k) < 0 && !(n(y) && Array.isArray(D))) {
			if (!a.returnObjects && !this.options.returnObjects) {
				this.options.returnedObjectHandler || this.logger.warn("accessing an object - but returnObjects options is not enabled!");
				let e = this.options.returnedObjectHandler ? this.options.returnedObjectHandler(g, D, {
					...a,
					ns: l
				}) : `key '${c} (${this.language})' returned an object instead of string.`;
				return o ? (m.res = e, m.usedParams = this.getUsedParamsDetails(a), m) : e;
			}
			if (s) {
				let e = Array.isArray(D), t = e ? [] : {}, n = e ? _ : g;
				for (let e in D) if (Object.prototype.hasOwnProperty.call(D, e)) {
					let r = `${n}${s}${e}`;
					t[e] = S && !h ? this.translate(r, {
						...a,
						defaultValue: M(E) ? E[e] : void 0,
						joinArrays: !1,
						ns: l
					}) : this.translate(r, {
						...a,
						joinArrays: !1,
						ns: l
					}), t[e] === r && (t[e] = D[e]);
				}
				h = t;
			}
		} else if (b && n(y) && Array.isArray(h)) h = h.join(y), h &&= this.extendTranslation(h, t, a, i);
		else {
			let e = !1, n = !1;
			!this.isValidLookup(h) && S && (e = !0, h = E), this.isValidLookup(h) || (n = !0, h = c);
			let r = (a.missingKeyNoValueFallbackToKey || this.options.missingKeyNoValueFallbackToKey) && n ? void 0 : h, o = S && E !== h && this.options.updateMissing;
			if (n || e || o) {
				if (this.logger.log(o ? "updateKey" : "missingKey", f, u, c, o ? E : h), s) {
					let e = this.resolve(c, {
						...a,
						keySeparator: !1
					});
					e && e.res && this.logger.warn("Seems the loaded translations were in flat JSON format instead of nested. Either set keySeparator: false on init or make sure your translations are published in nested format.");
				}
				let e = [], t = this.languageUtils.getFallbackCodes(this.options.fallbackLng, a.lng || this.language);
				if (this.options.saveMissingTo === "fallback" && t && t[0]) for (let n = 0; n < t.length; n++) e.push(t[n]);
				else this.options.saveMissingTo === "all" ? e = this.languageUtils.toResolveHierarchy(a.lng || this.language) : e.push(a.lng || this.language);
				let n = (e, t, n) => {
					let i = S && n !== h ? n : r;
					this.options.missingKeyHandler ? this.options.missingKeyHandler(e, u, t, i, o, a) : this.backendConnector?.saveMissing && this.backendConnector.saveMissing(e, u, t, i, o, a), this.emit("missingKey", e, u, t, h);
				};
				this.options.saveMissing && (this.options.saveMissingPlurals && x ? e.forEach((e) => {
					let t = this.pluralResolver.getSuffixes(e, a);
					T && a[`defaultValue${this.options.pluralSeparator}zero`] && t.indexOf(`${this.options.pluralSeparator}zero`) < 0 && t.push(`${this.options.pluralSeparator}zero`), t.forEach((t) => {
						n([e], c + t, a[`defaultValue${t}`] || E);
					});
				}) : n(e, c, E));
			}
			h = this.extendTranslation(h, t, a, m, i), n && h === c && this.options.appendNamespaceToMissingKey && (h = `${u}${d}${c}`), (n || e) && this.options.parseMissingKeyHandler && (h = this.options.parseMissingKeyHandler(this.options.appendNamespaceToMissingKey ? `${u}${d}${c}` : c, e ? h : void 0, a));
		}
		return o ? (m.res = h, m.usedParams = this.getUsedParamsDetails(a), m) : h;
	}
	extendTranslation(e, t, r, i, a) {
		if (this.i18nFormat?.parse) e = this.i18nFormat.parse(e, {
			...this.options.interpolation.defaultVariables,
			...r
		}, r.lng || this.language || i.usedLng, i.usedNS, i.usedKey, { resolved: i });
		else if (!r.skipInterpolation) {
			r.interpolation && this.interpolator.init({
				...r,
				interpolation: {
					...this.options.interpolation,
					...r.interpolation
				}
			});
			let o = n(e) && (r?.interpolation?.skipOnVariables === void 0 ? this.options.interpolation.skipOnVariables : r.interpolation.skipOnVariables), s;
			if (o) {
				let t = e.match(this.interpolator.nestingRegexp);
				s = t && t.length;
			}
			let c = r.replace && !n(r.replace) ? r.replace : r;
			if (this.options.interpolation.defaultVariables && (c = {
				...this.options.interpolation.defaultVariables,
				...c
			}), e = this.interpolator.interpolate(e, c, r.lng || this.language || i.usedLng, r), o) {
				let t = e.match(this.interpolator.nestingRegexp), n = t && t.length;
				s < n && (r.nest = !1);
			}
			!r.lng && i && i.res && (r.lng = this.language || i.usedLng), r.nest !== !1 && (e = this.interpolator.nest(e, (...e) => a?.[0] === e[0] && !r.context ? (this.logger.warn(`It seems you are nesting recursively key: ${e[0]} in key: ${t[0]}`), null) : this.translate(...e, t), r)), r.interpolation && this.interpolator.reset();
		}
		let o = r.postProcess || this.options.postProcess, s = n(o) ? [o] : o;
		return e != null && s?.length && r.applyPostProcessor !== !1 && (e = O.handle(s, e, t, this.options && this.options.postProcessPassResolved ? {
			i18nResolved: {
				...i,
				usedParams: this.getUsedParamsDetails(r)
			},
			...r
		} : r, this)), e;
	}
	resolve(e, t = {}) {
		let r, i, a, o, s;
		return n(e) && (e = [e]), Array.isArray(e) && (e = e.map((e) => typeof e == "function" ? A(e, {
			...this.options,
			...t
		}) : e)), e.forEach((e) => {
			if (this.isValidLookup(r)) return;
			let c = this.extractFromKey(e, t), l = c.key;
			i = l;
			let u = c.namespaces;
			this.options.fallbackNS && (u = u.concat(this.options.fallbackNS));
			let d = t.count !== void 0 && !n(t.count), f = d && !t.ordinal && t.count === 0, p = t.context !== void 0 && (n(t.context) || typeof t.context == "number") && t.context !== "", m = t.lngs ? t.lngs : this.languageUtils.toResolveHierarchy(t.lng || this.language, t.fallbackLng);
			u.forEach((e) => {
				this.isValidLookup(r) || (s = e, !j[`${m[0]}-${e}`] && this.utils?.hasLoadedNamespace && !this.utils?.hasLoadedNamespace(s) && (j[`${m[0]}-${e}`] = !0, this.logger.warn(`key "${i}" for languages "${m.join(", ")}" won't get resolved as namespace "${s}" was not yet loaded`, "This means something IS WRONG in your setup. You access the t function before i18next.init / i18next.loadNamespace / i18next.changeLanguage was done. Wait for the callback or Promise to resolve before accessing it!!!")), m.forEach((n) => {
					if (this.isValidLookup(r)) return;
					o = n;
					let i = [l];
					if (this.i18nFormat?.addLookupKeys) this.i18nFormat.addLookupKeys(i, l, n, e, t);
					else {
						let e;
						d && (e = this.pluralResolver.getSuffix(n, t.count, t));
						let r = `${this.options.pluralSeparator}zero`, a = `${this.options.pluralSeparator}ordinal${this.options.pluralSeparator}`;
						if (d && (t.ordinal && e.indexOf(a) === 0 && i.push(l + e.replace(a, this.options.pluralSeparator)), i.push(l + e), f && i.push(l + r)), p) {
							let n = `${l}${this.options.contextSeparator || "_"}${t.context}`;
							i.push(n), d && (t.ordinal && e.indexOf(a) === 0 && i.push(n + e.replace(a, this.options.pluralSeparator)), i.push(n + e), f && i.push(n + r));
						}
					}
					let s;
					for (; s = i.pop();) this.isValidLookup(r) || (a = s, r = this.getResource(n, e, s, t));
				}));
			});
		}), {
			res: r,
			usedKey: i,
			exactUsedKey: a,
			usedLng: o,
			usedNS: s
		};
	}
	isValidLookup(e) {
		return e !== void 0 && !(!this.options.returnNull && e === null) && !(!this.options.returnEmptyString && e === "");
	}
	getResource(e, t, n, r = {}) {
		return this.i18nFormat?.getResource ? this.i18nFormat.getResource(e, t, n, r) : this.resourceStore.getResource(e, t, n, r);
	}
	getUsedParamsDetails(e = {}) {
		let t = [
			"defaultValue",
			"ordinal",
			"context",
			"replace",
			"lng",
			"lngs",
			"fallbackLng",
			"ns",
			"keySeparator",
			"nsSeparator",
			"returnObjects",
			"returnDetails",
			"joinArrays",
			"postProcess",
			"interpolation"
		], r = e.replace && !n(e.replace), i = r ? e.replace : e;
		if (r && e.count !== void 0 && (i.count = e.count), this.options.interpolation.defaultVariables && (i = {
			...this.options.interpolation.defaultVariables,
			...i
		}), !r) {
			i = { ...i };
			for (let e of t) delete i[e];
		}
		return i;
	}
	static hasDefaultValue(e) {
		for (let t in e) if (Object.prototype.hasOwnProperty.call(e, t) && t.substring(0, 12) === "defaultValue" && e[t] !== void 0) return !0;
		return !1;
	}
}, P = class {
	constructor(e) {
		this.options = e, this.supportedLngs = this.options.supportedLngs || !1, this.logger = T.create("languageUtils");
	}
	getScriptPartFromCode(e) {
		if (e = C(e), !e || e.indexOf("-") < 0) return null;
		let t = e.split("-");
		return t.length === 2 || (t.pop(), t[t.length - 1].toLowerCase() === "x") ? null : this.formatLanguageCode(t.join("-"));
	}
	getLanguagePartFromCode(e) {
		if (e = C(e), !e || e.indexOf("-") < 0) return e;
		let t = e.split("-");
		return this.formatLanguageCode(t[0]);
	}
	formatLanguageCode(e) {
		if (n(e) && e.indexOf("-") > -1) {
			let t;
			try {
				t = Intl.getCanonicalLocales(e)[0];
			} catch {}
			return t && this.options.lowerCaseLng && (t = t.toLowerCase()), t || (this.options.lowerCaseLng ? e.toLowerCase() : e);
		}
		return this.options.cleanCode || this.options.lowerCaseLng ? e.toLowerCase() : e;
	}
	isSupportedCode(e) {
		return (this.options.load === "languageOnly" || this.options.nonExplicitSupportedLngs) && (e = this.getLanguagePartFromCode(e)), !this.supportedLngs || !this.supportedLngs.length || this.supportedLngs.indexOf(e) > -1;
	}
	getBestMatchFromCodes(e) {
		if (!e) return null;
		let t;
		return e.forEach((e) => {
			if (t) return;
			let n = this.formatLanguageCode(e);
			(!this.options.supportedLngs || this.isSupportedCode(n)) && (t = n);
		}), !t && this.options.supportedLngs && e.forEach((e) => {
			if (t) return;
			let n = this.getScriptPartFromCode(e);
			if (this.isSupportedCode(n)) return t = n;
			let r = this.getLanguagePartFromCode(e);
			if (this.isSupportedCode(r)) return t = r;
			t = this.options.supportedLngs.find((e) => {
				if (e === r || !(e.indexOf("-") < 0 && r.indexOf("-") < 0) && (e.indexOf("-") > 0 && r.indexOf("-") < 0 && e.substring(0, e.indexOf("-")) === r || e.indexOf(r) === 0 && r.length > 1)) return e;
			});
		}), t ||= this.getFallbackCodes(this.options.fallbackLng)[0], t;
	}
	getFallbackCodes(e, t) {
		if (!e) return [];
		if (typeof e == "function" && (e = e(t)), n(e) && (e = [e]), Array.isArray(e)) return e;
		if (!t) return e.default || [];
		let r = e[t];
		return r ||= e[this.getScriptPartFromCode(t)], r ||= e[this.formatLanguageCode(t)], r ||= e[this.getLanguagePartFromCode(t)], r ||= e.default, r || [];
	}
	toResolveHierarchy(e, t) {
		let r = this.getFallbackCodes((t === !1 ? [] : t) || this.options.fallbackLng || [], e), i = [], a = (e) => {
			e && (this.isSupportedCode(e) ? i.push(e) : this.logger.warn(`rejecting language code not found in supportedLngs: ${e}`));
		};
		return n(e) && (e.indexOf("-") > -1 || e.indexOf("_") > -1) ? (this.options.load !== "languageOnly" && a(this.formatLanguageCode(e)), this.options.load !== "languageOnly" && this.options.load !== "currentOnly" && a(this.getScriptPartFromCode(e)), this.options.load !== "currentOnly" && a(this.getLanguagePartFromCode(e))) : n(e) && a(this.formatLanguageCode(e)), r.forEach((e) => {
			i.indexOf(e) < 0 && a(this.formatLanguageCode(e));
		}), i;
	}
}, F = {
	zero: 0,
	one: 1,
	two: 2,
	few: 3,
	many: 4,
	other: 5
}, te = {
	select: (e) => e === 1 ? "one" : "other",
	resolvedOptions: () => ({ pluralCategories: ["one", "other"] })
}, ne = class {
	constructor(e, t = {}) {
		this.languageUtils = e, this.options = t, this.logger = T.create("pluralResolver"), this.pluralRulesCache = {};
	}
	clearCache() {
		this.pluralRulesCache = {};
	}
	getRule(e, t = {}) {
		let n = C(e === "dev" ? "en" : e), r = t.ordinal ? "ordinal" : "cardinal", i = JSON.stringify({
			cleanedCode: n,
			type: r
		});
		if (i in this.pluralRulesCache) return this.pluralRulesCache[i];
		let a;
		try {
			a = new Intl.PluralRules(n, { type: r });
		} catch {
			if (typeof Intl > "u") return this.logger.error("No Intl support, please use an Intl polyfill!"), te;
			if (!e.match(/-|_/)) return te;
			let n = this.languageUtils.getLanguagePartFromCode(e);
			a = this.getRule(n, t);
		}
		return this.pluralRulesCache[i] = a, a;
	}
	needsPlural(e, t = {}) {
		let n = this.getRule(e, t);
		return n ||= this.getRule("dev", t), n?.resolvedOptions().pluralCategories.length > 1;
	}
	getPluralFormsOfKey(e, t, n = {}) {
		return this.getSuffixes(e, n).map((e) => `${t}${e}`);
	}
	getSuffixes(e, t = {}) {
		let n = this.getRule(e, t);
		return n ||= this.getRule("dev", t), n ? n.resolvedOptions().pluralCategories.sort((e, t) => F[e] - F[t]).map((e) => `${this.options.prepend}${t.ordinal ? `ordinal${this.options.prepend}` : ""}${e}`) : [];
	}
	getSuffix(e, t, n = {}) {
		let r = this.getRule(e, n);
		return r ? `${this.options.prepend}${n.ordinal ? `ordinal${this.options.prepend}` : ""}${r.select(t)}` : (this.logger.warn(`no plural rule found for: ${e}`), this.getSuffix("dev", t, n));
	}
}, I = (e, t, r, i = ".", a = !0) => {
	let o = p(e, t, r);
	return !o && a && n(r) && (o = S(e, r, i), o === void 0 && (o = S(t, r, i))), o;
}, L = (e) => e.replace(/\$/g, "$$$$"), R = class {
	constructor(e = {}) {
		this.logger = T.create("interpolator"), this.options = e, this.format = e?.interpolation?.format || ((e) => e), this.init(e);
	}
	init(e = {}) {
		e.interpolation ||= { escapeValue: !0 };
		let { escape: t, escapeValue: n, useRawValueToEscape: r, prefix: i, prefixEscaped: a, suffix: o, suffixEscaped: s, formatSeparator: c, unescapeSuffix: l, unescapePrefix: u, nestingPrefix: d, nestingPrefixEscaped: f, nestingSuffix: p, nestingSuffixEscaped: m, nestingOptionsSeparator: g, maxReplaces: v, alwaysFormat: y } = e.interpolation;
		this.escape = t === void 0 ? _ : t, this.escapeValue = n === void 0 || n, this.useRawValueToEscape = r !== void 0 && r, this.prefix = i ? h(i) : a || "{{", this.suffix = o ? h(o) : s || "}}", this.formatSeparator = c || ",", this.unescapePrefix = l ? "" : u || "-", this.unescapeSuffix = this.unescapePrefix ? "" : l || "", this.nestingPrefix = d ? h(d) : f || h("$t("), this.nestingSuffix = p ? h(p) : m || h(")"), this.nestingOptionsSeparator = g || ",", this.maxReplaces = v || 1e3, this.alwaysFormat = y !== void 0 && y, this.resetRegExp();
	}
	reset() {
		this.options && this.init(this.options);
	}
	resetRegExp() {
		let e = (e, t) => e?.source === t ? (e.lastIndex = 0, e) : new RegExp(t, "g");
		this.regexp = e(this.regexp, `${this.prefix}(.+?)${this.suffix}`), this.regexpUnescape = e(this.regexpUnescape, `${this.prefix}${this.unescapePrefix}(.+?)${this.unescapeSuffix}${this.suffix}`), this.nestingRegexp = e(this.nestingRegexp, `${this.nestingPrefix}((?:[^()"']+|"[^"]*"|'[^']*'|\\((?:[^()]|"[^"]*"|'[^']*')*\\))*?)${this.nestingSuffix}`);
	}
	interpolate(e, t, r, a) {
		let o, s, c, l = this.options && this.options.interpolation && this.options.interpolation.defaultVariables || {}, u = (e) => {
			if (e.indexOf(this.formatSeparator) < 0) {
				let n = I(t, l, e, this.options.keySeparator, this.options.ignoreJSONStructure);
				return this.alwaysFormat ? this.format(n, void 0, r, {
					...a,
					...t,
					interpolationkey: e
				}) : n;
			}
			let n = e.split(this.formatSeparator), i = n.shift().trim(), o = n.join(this.formatSeparator).trim();
			return this.format(I(t, l, i, this.options.keySeparator, this.options.ignoreJSONStructure), o, r, {
				...a,
				...t,
				interpolationkey: i
			});
		};
		this.resetRegExp();
		let d = a?.missingInterpolationHandler || this.options.missingInterpolationHandler, f = a?.interpolation?.skipOnVariables === void 0 ? this.options.interpolation.skipOnVariables : a.interpolation.skipOnVariables;
		return [{
			regex: this.regexpUnescape,
			safeValue: (e) => L(e)
		}, {
			regex: this.regexp,
			safeValue: (e) => this.escapeValue ? L(this.escape(e)) : L(e)
		}].forEach((t) => {
			for (c = 0; o = t.regex.exec(e);) {
				let r = o[1].trim();
				if (s = u(r), s === void 0) {
					if (typeof d == "function") {
						let t = d(e, o, a);
						s = n(t) ? t : "";
					} else if (a && Object.prototype.hasOwnProperty.call(a, r)) s = "";
					else if (f) {
						s = o[0];
						continue;
					} else this.logger.warn(`missed to pass in variable ${r} for interpolating ${e}`), s = "";
				} else !n(s) && !this.useRawValueToEscape && (s = i(s));
				let l = t.safeValue(s);
				if (e = e.replace(o[0], l), f ? (t.regex.lastIndex += s.length, t.regex.lastIndex -= o[0].length) : t.regex.lastIndex = 0, c++, c >= this.maxReplaces) break;
			}
		}), e;
	}
	nest(e, t, r = {}) {
		let a, o, s, c = (e, t) => {
			let n = this.nestingOptionsSeparator;
			if (e.indexOf(n) < 0) return e;
			let r = e.split(RegExp(`${h(n)}[ ]*{`)), i = `{${r[1]}`;
			e = r[0], i = this.interpolate(i, s);
			let a = i.match(/'/g), o = i.match(/"/g);
			((a?.length ?? 0) % 2 == 0 && !o || (o?.length ?? 0) % 2 != 0) && (i = i.replace(/'/g, "\""));
			try {
				s = JSON.parse(i), t && (s = {
					...t,
					...s
				});
			} catch (t) {
				return this.logger.warn(`failed parsing options string in nesting for key ${e}`, t), `${e}${n}${i}`;
			}
			return s.defaultValue && s.defaultValue.indexOf(this.prefix) > -1 && delete s.defaultValue, e;
		};
		for (; a = this.nestingRegexp.exec(e);) {
			let l = [];
			s = { ...r }, s = s.replace && !n(s.replace) ? s.replace : s, s.applyPostProcessor = !1, delete s.defaultValue;
			let u = /{.*}/.test(a[1]) ? a[1].lastIndexOf("}") + 1 : a[1].indexOf(this.formatSeparator);
			if (u !== -1 && (l = a[1].slice(u).split(this.formatSeparator).map((e) => e.trim()).filter(Boolean), a[1] = a[1].slice(0, u)), o = t(c.call(this, a[1].trim(), s), s), o && a[0] === e && !n(o)) return o;
			n(o) || (o = i(o)), o ||= (this.logger.warn(`missed to resolve ${a[1]} for nesting ${e}`), ""), l.length && (o = l.reduce((e, t) => this.format(e, t, r.lng, {
				...r,
				interpolationkey: a[1].trim()
			}), o.trim())), e = e.replace(a[0], o), this.regexp.lastIndex = 0;
		}
		return e;
	}
}, re = (e) => {
	let t = e.toLowerCase().trim(), n = {};
	if (e.indexOf("(") > -1) {
		let r = e.split("(");
		t = r[0].toLowerCase().trim();
		let i = r[1].substring(0, r[1].length - 1);
		t === "currency" && i.indexOf(":") < 0 ? n.currency ||= i.trim() : t === "relativetime" && i.indexOf(":") < 0 ? n.range ||= i.trim() : i.split(";").forEach((e) => {
			if (e) {
				let [t, ...r] = e.split(":"), i = r.join(":").trim().replace(/^'+|'+$/g, ""), a = t.trim();
				n[a] || (n[a] = i), i === "false" && (n[a] = !1), i === "true" && (n[a] = !0), isNaN(i) || (n[a] = parseInt(i, 10));
			}
		});
	}
	return {
		formatName: t,
		formatOptions: n
	};
}, z = (e) => {
	let t = {};
	return (n, r, i) => {
		let a = i;
		i && i.interpolationkey && i.formatParams && i.formatParams[i.interpolationkey] && i[i.interpolationkey] && (a = {
			...a,
			[i.interpolationkey]: void 0
		});
		let o = r + JSON.stringify(a), s = t[o];
		return s || (s = e(C(r), i), t[o] = s), s(n);
	};
}, ie = (e) => (t, n, r) => e(C(n), r)(t), ae = class {
	constructor(e = {}) {
		this.logger = T.create("formatter"), this.options = e, this.init(e);
	}
	init(e, t = { interpolation: {} }) {
		this.formatSeparator = t.interpolation.formatSeparator || ",";
		let n = t.cacheInBuiltFormats ? z : ie;
		this.formats = {
			number: n((e, t) => {
				let n = new Intl.NumberFormat(e, { ...t });
				return (e) => n.format(e);
			}),
			currency: n((e, t) => {
				let n = new Intl.NumberFormat(e, {
					...t,
					style: "currency"
				});
				return (e) => n.format(e);
			}),
			datetime: n((e, t) => {
				let n = new Intl.DateTimeFormat(e, { ...t });
				return (e) => n.format(e);
			}),
			relativetime: n((e, t) => {
				let n = new Intl.RelativeTimeFormat(e, { ...t });
				return (e) => n.format(e, t.range || "day");
			}),
			list: n((e, t) => {
				let n = new Intl.ListFormat(e, { ...t });
				return (e) => n.format(e);
			})
		};
	}
	add(e, t) {
		this.formats[e.toLowerCase().trim()] = t;
	}
	addCached(e, t) {
		this.formats[e.toLowerCase().trim()] = z(t);
	}
	format(e, t, n, r = {}) {
		let i = t.split(this.formatSeparator);
		if (i.length > 1 && i[0].indexOf("(") > 1 && i[0].indexOf(")") < 0 && i.find((e) => e.indexOf(")") > -1)) {
			let e = i.findIndex((e) => e.indexOf(")") > -1);
			i[0] = [i[0], ...i.splice(1, e)].join(this.formatSeparator);
		}
		return i.reduce((e, t) => {
			let { formatName: i, formatOptions: a } = re(t);
			if (this.formats[i]) {
				let t = e;
				try {
					let o = r?.formatParams?.[r.interpolationkey] || {}, s = o.locale || o.lng || r.locale || r.lng || n;
					t = this.formats[i](e, s, {
						...a,
						...r,
						...o
					});
				} catch (e) {
					this.logger.warn(e);
				}
				return t;
			}
			return this.logger.warn(`there was no format function for ${i}`), e;
		}, e);
	}
}, oe = (e, t) => {
	e.pending[t] !== void 0 && (delete e.pending[t], e.pendingCount--);
}, se = class extends E {
	constructor(e, t, n, r = {}) {
		super(), this.backend = e, this.store = t, this.services = n, this.languageUtils = n.languageUtils, this.options = r, this.logger = T.create("backendConnector"), this.waitingReads = [], this.maxParallelReads = r.maxParallelReads || 10, this.readingCalls = 0, this.maxRetries = r.maxRetries >= 0 ? r.maxRetries : 5, this.retryTimeout = r.retryTimeout >= 1 ? r.retryTimeout : 350, this.state = {}, this.queue = [], this.backend?.init?.(n, r.backend, r);
	}
	queueLoad(e, t, n, r) {
		let i = {}, a = {}, o = {}, s = {};
		return e.forEach((e) => {
			let r = !0;
			t.forEach((t) => {
				let o = `${e}|${t}`;
				!n.reload && this.store.hasResourceBundle(e, t) ? this.state[o] = 2 : this.state[o] < 0 || (this.state[o] === 1 ? a[o] === void 0 && (a[o] = !0) : (this.state[o] = 1, r = !1, a[o] === void 0 && (a[o] = !0), i[o] === void 0 && (i[o] = !0), s[t] === void 0 && (s[t] = !0)));
			}), r || (o[e] = !0);
		}), (Object.keys(i).length || Object.keys(a).length) && this.queue.push({
			pending: a,
			pendingCount: Object.keys(a).length,
			loaded: {},
			errors: [],
			callback: r
		}), {
			toLoad: Object.keys(i),
			pending: Object.keys(a),
			toLoadLanguages: Object.keys(o),
			toLoadNamespaces: Object.keys(s)
		};
	}
	loaded(e, t, n) {
		let r = e.split("|"), i = r[0], a = r[1];
		t && this.emit("failedLoading", i, a, t), !t && n && this.store.addResourceBundle(i, a, n, void 0, void 0, { skipCopy: !0 }), this.state[e] = t ? -1 : 2, t && n && (this.state[e] = 0);
		let o = {};
		this.queue.forEach((n) => {
			d(n.loaded, [i], a), oe(n, e), t && n.errors.push(t), n.pendingCount === 0 && !n.done && (Object.keys(n.loaded).forEach((e) => {
				o[e] || (o[e] = {});
				let t = n.loaded[e];
				t.length && t.forEach((t) => {
					o[e][t] === void 0 && (o[e][t] = !0);
				});
			}), n.done = !0, n.errors.length ? n.callback(n.errors) : n.callback());
		}), this.emit("loaded", o), this.queue = this.queue.filter((e) => !e.done);
	}
	read(e, t, n, r = 0, i = this.retryTimeout, a) {
		if (!e.length) return a(null, {});
		if (this.readingCalls >= this.maxParallelReads) {
			this.waitingReads.push({
				lng: e,
				ns: t,
				fcName: n,
				tried: r,
				wait: i,
				callback: a
			});
			return;
		}
		this.readingCalls++;
		let o = (o, s) => {
			if (this.readingCalls--, this.waitingReads.length > 0) {
				let e = this.waitingReads.shift();
				this.read(e.lng, e.ns, e.fcName, e.tried, e.wait, e.callback);
			}
			o && s && r < this.maxRetries ? setTimeout(() => {
				this.read.call(this, e, t, n, r + 1, i * 2, a);
			}, i) : a(o, s);
		}, s = this.backend[n].bind(this.backend);
		if (s.length === 2) try {
			let n = s(e, t);
			n && typeof n.then == "function" ? n.then((e) => o(null, e)).catch(o) : o(null, n);
		} catch (e) {
			o(e);
		}
		else return s(e, t, o);
	}
	prepareLoading(e, t, r = {}, i) {
		if (!this.backend) return this.logger.warn("No backend was added via i18next.use. Will not load resources."), i && i();
		n(e) && (e = this.languageUtils.toResolveHierarchy(e)), n(t) && (t = [t]);
		let a = this.queueLoad(e, t, r, i);
		if (!a.toLoad.length) return a.pending.length || i(), null;
		a.toLoad.forEach((e) => {
			this.loadOne(e);
		});
	}
	load(e, t, n) {
		this.prepareLoading(e, t, {}, n);
	}
	reload(e, t, n) {
		this.prepareLoading(e, t, { reload: !0 }, n);
	}
	loadOne(e, t = "") {
		let n = e.split("|"), r = n[0], i = n[1];
		this.read(r, i, "read", void 0, void 0, (n, a) => {
			n && this.logger.warn(`${t}loading namespace ${i} for language ${r} failed`, n), !n && a && this.logger.log(`${t}loaded namespace ${i} for language ${r}`, a), this.loaded(e, n, a);
		});
	}
	saveMissing(e, t, n, r, i, a = {}, o = () => {}) {
		if (this.services?.utils?.hasLoadedNamespace && !this.services?.utils?.hasLoadedNamespace(t)) this.logger.warn(`did not save key "${n}" as the namespace "${t}" was not yet loaded`, "This means something IS WRONG in your setup. You access the t function before i18next.init / i18next.loadNamespace / i18next.changeLanguage was done. Wait for the callback or Promise to resolve before accessing it!!!");
		else if (n != null && n !== "") {
			if (this.backend?.create) {
				let s = {
					...a,
					isUpdate: i
				}, c = this.backend.create.bind(this.backend);
				if (c.length < 6) try {
					let i;
					i = c.length === 5 ? c(e, t, n, r, s) : c(e, t, n, r), i && typeof i.then == "function" ? i.then((e) => o(null, e)).catch(o) : o(null, i);
				} catch (e) {
					o(e);
				}
				else c(e, t, n, r, o, s);
			}
			e && e[0] && this.store.addResource(e[0], t, n, r);
		}
	}
}, B = () => ({
	debug: !1,
	initAsync: !0,
	ns: ["translation"],
	defaultNS: ["translation"],
	fallbackLng: ["dev"],
	fallbackNS: !1,
	supportedLngs: !1,
	nonExplicitSupportedLngs: !1,
	load: "all",
	preload: !1,
	simplifyPluralSuffix: !0,
	keySeparator: ".",
	nsSeparator: ":",
	pluralSeparator: "_",
	contextSeparator: "_",
	partialBundledLanguages: !1,
	saveMissing: !1,
	updateMissing: !1,
	saveMissingTo: "fallback",
	saveMissingPlurals: !0,
	missingKeyHandler: !1,
	missingInterpolationHandler: !1,
	postProcess: !1,
	postProcessPassResolved: !1,
	returnNull: !1,
	returnEmptyString: !0,
	returnObjects: !1,
	joinArrays: !1,
	returnedObjectHandler: !1,
	parseMissingKeyHandler: !1,
	appendNamespaceToMissingKey: !1,
	appendNamespaceToCIMode: !1,
	overloadTranslationOptionHandler: (e) => {
		let t = {};
		if (typeof e[1] == "object" && (t = e[1]), n(e[1]) && (t.defaultValue = e[1]), n(e[2]) && (t.tDescription = e[2]), typeof e[2] == "object" || typeof e[3] == "object") {
			let n = e[3] || e[2];
			Object.keys(n).forEach((e) => {
				t[e] = n[e];
			});
		}
		return t;
	},
	interpolation: {
		escapeValue: !0,
		format: (e) => e,
		prefix: "{{",
		suffix: "}}",
		formatSeparator: ",",
		unescapePrefix: "-",
		nestingPrefix: "$t(",
		nestingSuffix: ")",
		nestingOptionsSeparator: ",",
		maxReplaces: 1e3,
		skipOnVariables: !0
	},
	cacheInBuiltFormats: !0
}), V = (e) => (n(e.ns) && (e.ns = [e.ns]), n(e.fallbackLng) && (e.fallbackLng = [e.fallbackLng]), n(e.fallbackNS) && (e.fallbackNS = [e.fallbackNS]), e.supportedLngs?.indexOf?.("cimode") < 0 && (e.supportedLngs = e.supportedLngs.concat(["cimode"])), typeof e.initImmediate == "boolean" && (e.initAsync = e.initImmediate), e), H = () => {}, ce = (e) => {
	Object.getOwnPropertyNames(Object.getPrototypeOf(e)).forEach((t) => {
		typeof e[t] == "function" && (e[t] = e[t].bind(e));
	});
}, U = "__i18next_supportNoticeShown", le = () => typeof globalThis < "u" && !!globalThis[U], ue = () => {
	typeof globalThis < "u" && (globalThis[U] = !0);
}, de = (e) => !!(e?.modules?.backend?.name?.indexOf("Locize") > 0 || e?.modules?.backend?.constructor?.name?.indexOf("Locize") > 0 || e?.options?.backend?.backends && e.options.backend.backends.some((e) => e?.name?.indexOf("Locize") > 0 || e?.constructor?.name?.indexOf("Locize") > 0) || e?.options?.backend?.projectId || e?.options?.backend?.backendOptions && e.options.backend.backendOptions.some((e) => e?.projectId)), W = class e extends E {
	constructor(e = {}, t) {
		if (super(), this.options = V(e), this.services = {}, this.logger = T, this.modules = { external: [] }, ce(this), t && !this.isInitialized && !e.isClone) {
			if (!this.options.initAsync) return this.init(e, t), this;
			setTimeout(() => {
				this.init(e, t);
			}, 0);
		}
	}
	init(e = {}, t) {
		this.isInitializing = !0, typeof e == "function" && (t = e, e = {}), e.defaultNS == null && e.ns && (n(e.ns) ? e.defaultNS = e.ns : e.ns.indexOf("translation") < 0 && (e.defaultNS = e.ns[0]));
		let i = B();
		this.options = {
			...i,
			...this.options,
			...V(e)
		}, this.options.interpolation = {
			...i.interpolation,
			...this.options.interpolation
		}, e.keySeparator !== void 0 && (this.options.userDefinedKeySeparator = e.keySeparator), e.nsSeparator !== void 0 && (this.options.userDefinedNsSeparator = e.nsSeparator), typeof this.options.overloadTranslationOptionHandler != "function" && (this.options.overloadTranslationOptionHandler = i.overloadTranslationOptionHandler), this.options.showSupportNotice !== !1 && !de(this) && !le() && (typeof console < "u" && console.info !== void 0 && console.info("🌐 i18next is made possible by our own product, Locize — consider powering your project with managed localization (AI, CDN, integrations): https://locize.com 💙"), ue());
		let a = (e) => e ? typeof e == "function" ? new e() : e : null;
		if (!this.options.isClone) {
			this.modules.logger ? T.init(a(this.modules.logger), this.options) : T.init(null, this.options);
			let e;
			e = this.modules.formatter ? this.modules.formatter : ae;
			let t = new P(this.options);
			this.store = new D(this.options.resources, this.options);
			let n = this.services;
			n.logger = T, n.resourceStore = this.store, n.languageUtils = t, n.pluralResolver = new ne(t, {
				prepend: this.options.pluralSeparator,
				simplifyPluralSuffix: this.options.simplifyPluralSuffix
			}), this.options.interpolation.format && this.options.interpolation.format !== i.interpolation.format && this.logger.deprecate("init: you are still using the legacy format function, please use the new approach: https://www.i18next.com/translation-function/formatting"), e && (!this.options.interpolation.format || this.options.interpolation.format === i.interpolation.format) && (n.formatter = a(e), n.formatter.init && n.formatter.init(n, this.options), this.options.interpolation.format = n.formatter.format.bind(n.formatter)), n.interpolator = new R(this.options), n.utils = { hasLoadedNamespace: this.hasLoadedNamespace.bind(this) }, n.backendConnector = new se(a(this.modules.backend), n.resourceStore, n, this.options), n.backendConnector.on("*", (e, ...t) => {
				this.emit(e, ...t);
			}), this.modules.languageDetector && (n.languageDetector = a(this.modules.languageDetector), n.languageDetector.init && n.languageDetector.init(n, this.options.detection, this.options)), this.modules.i18nFormat && (n.i18nFormat = a(this.modules.i18nFormat), n.i18nFormat.init && n.i18nFormat.init(this)), this.translator = new N(this.services, this.options), this.translator.on("*", (e, ...t) => {
				this.emit(e, ...t);
			}), this.modules.external.forEach((e) => {
				e.init && e.init(this);
			});
		}
		if (this.format = this.options.interpolation.format, t ||= H, this.options.fallbackLng && !this.services.languageDetector && !this.options.lng) {
			let e = this.services.languageUtils.getFallbackCodes(this.options.fallbackLng);
			e.length > 0 && e[0] !== "dev" && (this.options.lng = e[0]);
		}
		!this.services.languageDetector && !this.options.lng && this.logger.warn("init: no languageDetector is used and no lng is defined"), [
			"getResource",
			"hasResourceBundle",
			"getResourceBundle",
			"getDataByLanguage"
		].forEach((e) => {
			this[e] = (...t) => this.store[e](...t);
		}), [
			"addResource",
			"addResources",
			"addResourceBundle",
			"removeResourceBundle"
		].forEach((e) => {
			this[e] = (...t) => (this.store[e](...t), this);
		});
		let o = r(), s = () => {
			let e = (e, n) => {
				this.isInitializing = !1, this.isInitialized && !this.initializedStoreOnce && this.logger.warn("init: i18next is already initialized. You should call init just once!"), this.isInitialized = !0, this.options.isClone || this.logger.log("initialized", this.options), this.emit("initialized", this.options), o.resolve(n), t(e, n);
			};
			if (this.languages && !this.isInitialized) return e(null, this.t.bind(this));
			this.changeLanguage(this.options.lng, e);
		};
		return this.options.resources || !this.options.initAsync ? s() : setTimeout(s, 0), o;
	}
	loadResources(e, t = H) {
		let r = t, i = n(e) ? e : this.language;
		if (typeof e == "function" && (r = e), !this.options.resources || this.options.partialBundledLanguages) {
			if (i?.toLowerCase() === "cimode" && (!this.options.preload || this.options.preload.length === 0)) return r();
			let e = [], t = (t) => {
				t && t !== "cimode" && this.services.languageUtils.toResolveHierarchy(t).forEach((t) => {
					t !== "cimode" && e.indexOf(t) < 0 && e.push(t);
				});
			};
			i ? t(i) : this.services.languageUtils.getFallbackCodes(this.options.fallbackLng).forEach((e) => t(e)), this.options.preload?.forEach?.((e) => t(e)), this.services.backendConnector.load(e, this.options.ns, (e) => {
				!e && !this.resolvedLanguage && this.language && this.setResolvedLanguage(this.language), r(e);
			});
		} else r(null);
	}
	reloadResources(e, t, n) {
		let i = r();
		return typeof e == "function" && (n = e, e = void 0), typeof t == "function" && (n = t, t = void 0), e ||= this.languages, t ||= this.options.ns, n ||= H, this.services.backendConnector.reload(e, t, (e) => {
			i.resolve(), n(e);
		}), i;
	}
	use(e) {
		if (!e) throw Error("You are passing an undefined module! Please check the object you are passing to i18next.use()");
		if (!e.type) throw Error("You are passing a wrong module! Please check the object you are passing to i18next.use()");
		return e.type === "backend" && (this.modules.backend = e), (e.type === "logger" || e.log && e.warn && e.error) && (this.modules.logger = e), e.type === "languageDetector" && (this.modules.languageDetector = e), e.type === "i18nFormat" && (this.modules.i18nFormat = e), e.type === "postProcessor" && O.addPostProcessor(e), e.type === "formatter" && (this.modules.formatter = e), e.type === "3rdParty" && this.modules.external.push(e), this;
	}
	setResolvedLanguage(e) {
		if (e && this.languages && !(["cimode", "dev"].indexOf(e) > -1)) {
			for (let e = 0; e < this.languages.length; e++) {
				let t = this.languages[e];
				if (!(["cimode", "dev"].indexOf(t) > -1) && this.store.hasLanguageSomeTranslations(t)) {
					this.resolvedLanguage = t;
					break;
				}
			}
			!this.resolvedLanguage && this.languages.indexOf(e) < 0 && this.store.hasLanguageSomeTranslations(e) && (this.resolvedLanguage = e, this.languages.unshift(e));
		}
	}
	changeLanguage(e, t) {
		this.isLanguageChangingTo = e;
		let i = r();
		this.emit("languageChanging", e);
		let a = (e) => {
			this.language = e, this.languages = this.services.languageUtils.toResolveHierarchy(e), this.resolvedLanguage = void 0, this.setResolvedLanguage(e);
		}, o = (n, r) => {
			r ? this.isLanguageChangingTo === e && (a(r), this.translator.changeLanguage(r), this.isLanguageChangingTo = void 0, this.emit("languageChanged", r), this.logger.log("languageChanged", r)) : this.isLanguageChangingTo = void 0, i.resolve((...e) => this.t(...e)), t && t(n, (...e) => this.t(...e));
		}, s = (t) => {
			!e && !t && this.services.languageDetector && (t = []);
			let r = n(t) ? t : t && t[0], i = this.store.hasLanguageSomeTranslations(r) ? r : this.services.languageUtils.getBestMatchFromCodes(n(t) ? [t] : t);
			i && (this.language || a(i), this.translator.language || this.translator.changeLanguage(i), this.services.languageDetector?.cacheUserLanguage?.(i)), this.loadResources(i, (e) => {
				o(e, i);
			});
		};
		return !e && this.services.languageDetector && !this.services.languageDetector.async ? s(this.services.languageDetector.detect()) : !e && this.services.languageDetector && this.services.languageDetector.async ? this.services.languageDetector.detect.length === 0 ? this.services.languageDetector.detect().then(s) : this.services.languageDetector.detect(s) : s(e), i;
	}
	getFixedT(e, t, r) {
		let i = (e, t, ...n) => {
			let a;
			a = typeof t == "object" ? { ...t } : this.options.overloadTranslationOptionHandler([e, t].concat(n)), a.lng = a.lng || i.lng, a.lngs = a.lngs || i.lngs, a.ns = a.ns || i.ns, a.keyPrefix !== "" && (a.keyPrefix = a.keyPrefix || r || i.keyPrefix);
			let o = this.options.keySeparator || ".", s;
			return a.keyPrefix && Array.isArray(e) ? s = e.map((e) => (typeof e == "function" && (e = A(e, {
				...this.options,
				...t
			})), `${a.keyPrefix}${o}${e}`)) : (typeof e == "function" && (e = A(e, {
				...this.options,
				...t
			})), s = a.keyPrefix ? `${a.keyPrefix}${o}${e}` : e), this.t(s, a);
		};
		return n(e) ? i.lng = e : i.lngs = e, i.ns = t, i.keyPrefix = r, i;
	}
	t(...e) {
		return this.translator?.translate(...e);
	}
	exists(...e) {
		return this.translator?.exists(...e);
	}
	setDefaultNamespace(e) {
		this.options.defaultNS = e;
	}
	hasLoadedNamespace(e, t = {}) {
		if (!this.isInitialized) return this.logger.warn("hasLoadedNamespace: i18next was not initialized", this.languages), !1;
		if (!this.languages || !this.languages.length) return this.logger.warn("hasLoadedNamespace: i18n.languages were undefined or empty", this.languages), !1;
		let n = t.lng || this.resolvedLanguage || this.languages[0], r = this.options ? this.options.fallbackLng : !1, i = this.languages[this.languages.length - 1];
		if (n.toLowerCase() === "cimode") return !0;
		let a = (e, t) => {
			let n = this.services.backendConnector.state[`${e}|${t}`];
			return n === -1 || n === 0 || n === 2;
		};
		if (t.precheck) {
			let e = t.precheck(this, a);
			if (e !== void 0) return e;
		}
		return !!(this.hasResourceBundle(n, e) || !this.services.backendConnector.backend || this.options.resources && !this.options.partialBundledLanguages || a(n, e) && (!r || a(i, e)));
	}
	loadNamespaces(e, t) {
		let i = r();
		return this.options.ns ? (n(e) && (e = [e]), e.forEach((e) => {
			this.options.ns.indexOf(e) < 0 && this.options.ns.push(e);
		}), this.loadResources((e) => {
			i.resolve(), t && t(e);
		}), i) : (t && t(), Promise.resolve());
	}
	loadLanguages(e, t) {
		let i = r();
		n(e) && (e = [e]);
		let a = this.options.preload || [], o = e.filter((e) => a.indexOf(e) < 0 && this.services.languageUtils.isSupportedCode(e));
		return o.length ? (this.options.preload = a.concat(o), this.loadResources((e) => {
			i.resolve(), t && t(e);
		}), i) : (t && t(), Promise.resolve());
	}
	dir(e) {
		if (e ||= this.resolvedLanguage || (this.languages?.length > 0 ? this.languages[0] : this.language), !e) return "rtl";
		try {
			let t = new Intl.Locale(e);
			if (t && t.getTextInfo) {
				let e = t.getTextInfo();
				if (e && e.direction) return e.direction;
			}
		} catch {}
		let t = /* @__PURE__ */ "ar.shu.sqr.ssh.xaa.yhd.yud.aao.abh.abv.acm.acq.acw.acx.acy.adf.ads.aeb.aec.afb.ajp.apc.apd.arb.arq.ars.ary.arz.auz.avl.ayh.ayl.ayn.ayp.bbz.pga.he.iw.ps.pbt.pbu.pst.prp.prd.ug.ur.ydd.yds.yih.ji.yi.hbo.men.xmn.fa.jpr.peo.pes.prs.dv.sam.ckb".split("."), n = this.services?.languageUtils || new P(B());
		return e.toLowerCase().indexOf("-latn") > 1 ? "ltr" : t.indexOf(n.getLanguagePartFromCode(e)) > -1 || e.toLowerCase().indexOf("-arab") > 1 ? "rtl" : "ltr";
	}
	static createInstance(t = {}, n) {
		let r = new e(t, n);
		return r.createInstance = e.createInstance, r;
	}
	cloneInstance(t = {}, n = H) {
		let r = t.forkResourceStore;
		r && delete t.forkResourceStore;
		let i = {
			...this.options,
			...t,
			isClone: !0
		}, a = new e(i);
		if ((t.debug !== void 0 || t.prefix !== void 0) && (a.logger = a.logger.clone(t)), [
			"store",
			"services",
			"language"
		].forEach((e) => {
			a[e] = this[e];
		}), a.services = { ...this.services }, a.services.utils = { hasLoadedNamespace: a.hasLoadedNamespace.bind(a) }, r && (a.store = new D(Object.keys(this.store.data).reduce((e, t) => (e[t] = { ...this.store.data[t] }, e[t] = Object.keys(e[t]).reduce((n, r) => (n[r] = { ...e[t][r] }, n), e[t]), e), {}), i), a.services.resourceStore = a.store), t.interpolation) {
			let e = {
				...B().interpolation,
				...this.options.interpolation,
				...t.interpolation
			}, n = {
				...i,
				interpolation: e
			};
			a.services.interpolator = new R(n);
		}
		return a.translator = new N(a.services, i), a.translator.on("*", (e, ...t) => {
			a.emit(e, ...t);
		}), a.init(i, n), a.translator.options = i, a.translator.backendConnector.services.utils = { hasLoadedNamespace: a.hasLoadedNamespace.bind(a) }, a;
	}
	toJSON() {
		return {
			options: this.options,
			store: this.store,
			language: this.language,
			languages: this.languages,
			resolvedLanguage: this.resolvedLanguage
		};
	}
}.createInstance();
W.createInstance, W.dir, W.init, W.loadResources, W.reloadResources, W.use, W.changeLanguage, W.getFixedT, W.t, W.exists, W.setDefaultNamespace, W.hasLoadedNamespace, W.loadNamespaces, W.loadLanguages;
// node_modules/.bun/react-i18next@16.5.8+d976778d4c9f401e/node_modules/react-i18next/dist/es/initReactI18next.js
var fe = {
	type: "3rdParty",
	init(n) {
		e(n.options.react), t(n);
	}
}, { slice: pe, forEach: me } = [];
function he(e) {
	return me.call(pe.call(arguments, 1), (t) => {
		if (t) for (let n in t) e[n] === void 0 && (e[n] = t[n]);
	}), e;
}
function ge(e) {
	return typeof e == "string" && [
		/<\s*script.*?>/i,
		/<\s*\/\s*script\s*>/i,
		/<\s*img.*?on\w+\s*=/i,
		/<\s*\w+\s*on\w+\s*=.*?>/i,
		/javascript\s*:/i,
		/vbscript\s*:/i,
		/expression\s*\(/i,
		/eval\s*\(/i,
		/alert\s*\(/i,
		/document\.cookie/i,
		/document\.write\s*\(/i,
		/window\.location/i,
		/innerHTML/i
	].some((t) => t.test(e));
}
var G = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/, _e = function(e, t) {
	let n = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : { path: "/" }, r = `${e}=${encodeURIComponent(t)}`;
	if (n.maxAge > 0) {
		let e = n.maxAge - 0;
		if (Number.isNaN(e)) throw Error("maxAge should be a Number");
		r += `; Max-Age=${Math.floor(e)}`;
	}
	if (n.domain) {
		if (!G.test(n.domain)) throw TypeError("option domain is invalid");
		r += `; Domain=${n.domain}`;
	}
	if (n.path) {
		if (!G.test(n.path)) throw TypeError("option path is invalid");
		r += `; Path=${n.path}`;
	}
	if (n.expires) {
		if (typeof n.expires.toUTCString != "function") throw TypeError("option expires is invalid");
		r += `; Expires=${n.expires.toUTCString()}`;
	}
	if (n.httpOnly && (r += "; HttpOnly"), n.secure && (r += "; Secure"), n.sameSite) switch (typeof n.sameSite == "string" ? n.sameSite.toLowerCase() : n.sameSite) {
		case !0:
			r += "; SameSite=Strict";
			break;
		case "lax":
			r += "; SameSite=Lax";
			break;
		case "strict":
			r += "; SameSite=Strict";
			break;
		case "none":
			r += "; SameSite=None";
			break;
		default: throw TypeError("option sameSite is invalid");
	}
	return n.partitioned && (r += "; Partitioned"), r;
}, K = {
	create(e, t, n, r) {
		let i = arguments.length > 4 && arguments[4] !== void 0 ? arguments[4] : {
			path: "/",
			sameSite: "strict"
		};
		n && (i.expires = /* @__PURE__ */ new Date(), i.expires.setTime(i.expires.getTime() + n * 60 * 1e3)), r && (i.domain = r), document.cookie = _e(e, t, i);
	},
	read(e) {
		let t = `${e}=`, n = document.cookie.split(";");
		for (let e = 0; e < n.length; e++) {
			let r = n[e];
			for (; r.charAt(0) === " ";) r = r.substring(1, r.length);
			if (r.indexOf(t) === 0) return r.substring(t.length, r.length);
		}
		return null;
	},
	remove(e, t) {
		this.create(e, "", -1, t);
	}
}, ve = {
	name: "cookie",
	lookup(e) {
		let { lookupCookie: t } = e;
		if (t && typeof document < "u") return K.read(t) || void 0;
	},
	cacheUserLanguage(e, t) {
		let { lookupCookie: n, cookieMinutes: r, cookieDomain: i, cookieOptions: a } = t;
		n && typeof document < "u" && K.create(n, e, r, i, a);
	}
}, ye = {
	name: "querystring",
	lookup(e) {
		let { lookupQuerystring: t } = e, n;
		if (typeof window < "u") {
			let { search: e } = window.location;
			!window.location.search && window.location.hash?.indexOf("?") > -1 && (e = window.location.hash.substring(window.location.hash.indexOf("?")));
			let r = e.substring(1).split("&");
			for (let e = 0; e < r.length; e++) {
				let i = r[e].indexOf("=");
				i > 0 && r[e].substring(0, i) === t && (n = r[e].substring(i + 1));
			}
		}
		return n;
	}
}, be = {
	name: "hash",
	lookup(e) {
		let { lookupHash: t, lookupFromHashIndex: n } = e, r;
		if (typeof window < "u") {
			let { hash: e } = window.location;
			if (e && e.length > 2) {
				let i = e.substring(1);
				if (t) {
					let e = i.split("&");
					for (let n = 0; n < e.length; n++) {
						let i = e[n].indexOf("=");
						i > 0 && e[n].substring(0, i) === t && (r = e[n].substring(i + 1));
					}
				}
				if (r) return r;
				if (!r && n > -1) {
					let t = e.match(/\/([a-zA-Z-]*)/g);
					return Array.isArray(t) ? t[typeof n == "number" ? n : 0]?.replace("/", "") : void 0;
				}
			}
		}
		return r;
	}
}, q = null, J = () => {
	if (q !== null) return q;
	try {
		if (q = typeof window < "u" && window.localStorage !== null, !q) return !1;
		let e = "i18next.translate.boo";
		window.localStorage.setItem(e, "foo"), window.localStorage.removeItem(e);
	} catch {
		q = !1;
	}
	return q;
}, xe = {
	name: "localStorage",
	lookup(e) {
		let { lookupLocalStorage: t } = e;
		if (t && J()) return window.localStorage.getItem(t) || void 0;
	},
	cacheUserLanguage(e, t) {
		let { lookupLocalStorage: n } = t;
		n && J() && window.localStorage.setItem(n, e);
	}
}, Y = null, X = () => {
	if (Y !== null) return Y;
	try {
		if (Y = typeof window < "u" && window.sessionStorage !== null, !Y) return !1;
		let e = "i18next.translate.boo";
		window.sessionStorage.setItem(e, "foo"), window.sessionStorage.removeItem(e);
	} catch {
		Y = !1;
	}
	return Y;
}, Se = {
	name: "sessionStorage",
	lookup(e) {
		let { lookupSessionStorage: t } = e;
		if (t && X()) return window.sessionStorage.getItem(t) || void 0;
	},
	cacheUserLanguage(e, t) {
		let { lookupSessionStorage: n } = t;
		n && X() && window.sessionStorage.setItem(n, e);
	}
}, Ce = {
	name: "navigator",
	lookup(e) {
		let t = [];
		if (typeof navigator < "u") {
			let { languages: e, userLanguage: n, language: r } = navigator;
			if (e) for (let n = 0; n < e.length; n++) t.push(e[n]);
			n && t.push(n), r && t.push(r);
		}
		return t.length > 0 ? t : void 0;
	}
}, we = {
	name: "htmlTag",
	lookup(e) {
		let { htmlTag: t } = e, n, r = t || (typeof document < "u" ? document.documentElement : null);
		return r && typeof r.getAttribute == "function" && (n = r.getAttribute("lang")), n;
	}
}, Te = {
	name: "path",
	lookup(e) {
		let { lookupFromPathIndex: t } = e;
		if (typeof window > "u") return;
		let n = window.location.pathname.match(/\/([a-zA-Z-]*)/g);
		if (Array.isArray(n)) return n[typeof t == "number" ? t : 0]?.replace("/", "");
	}
}, Ee = {
	name: "subdomain",
	lookup(e) {
		let { lookupFromSubdomainIndex: t } = e, n = typeof t == "number" ? t + 1 : 1, r = typeof window < "u" && window.location?.hostname?.match(/^(\w{2,5})\.(([a-z0-9-]{1,63}\.[a-z]{2,6})|localhost)/i);
		if (r) return r[n];
	}
}, Z = !1;
try {
	document.cookie, Z = !0;
} catch {}
var Q = [
	"querystring",
	"cookie",
	"localStorage",
	"sessionStorage",
	"navigator",
	"htmlTag"
];
Z || Q.splice(1, 1);
var De = () => ({
	order: Q,
	lookupQuerystring: "lng",
	lookupCookie: "i18next",
	lookupLocalStorage: "i18nextLng",
	lookupSessionStorage: "i18nextLng",
	caches: ["localStorage"],
	excludeCacheFor: ["cimode"],
	convertDetectedLanguage: (e) => e
}), Oe = class {
	constructor(e) {
		let t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
		this.type = "languageDetector", this.detectors = {}, this.init(e, t);
	}
	init() {
		let e = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : { languageUtils: {} }, t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {}, n = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
		this.services = e, this.options = he(t, this.options || {}, De()), typeof this.options.convertDetectedLanguage == "string" && this.options.convertDetectedLanguage.indexOf("15897") > -1 && (this.options.convertDetectedLanguage = (e) => e.replace("-", "_")), this.options.lookupFromUrlIndex && (this.options.lookupFromPathIndex = this.options.lookupFromUrlIndex), this.i18nOptions = n, this.addDetector(ve), this.addDetector(ye), this.addDetector(xe), this.addDetector(Se), this.addDetector(Ce), this.addDetector(we), this.addDetector(Te), this.addDetector(Ee), this.addDetector(be);
	}
	addDetector(e) {
		return this.detectors[e.name] = e, this;
	}
	detect() {
		let e = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : this.options.order, t = [];
		return e.forEach((e) => {
			if (this.detectors[e]) {
				let n = this.detectors[e].lookup(this.options);
				n && typeof n == "string" && (n = [n]), n && (t = t.concat(n));
			}
		}), t = t.filter((e) => e != null && !ge(e)).map((e) => this.options.convertDetectedLanguage(e)), this.services && this.services.languageUtils && this.services.languageUtils.getBestMatchFromCodes ? t : t.length > 0 ? t[0] : null;
	}
	cacheUserLanguage(e) {
		let t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : this.options.caches;
		t && (this.options.excludeCacheFor && this.options.excludeCacheFor.indexOf(e) > -1 || t.forEach((t) => {
			this.detectors[t] && this.detectors[t].cacheUserLanguage(e, this.options);
		}));
	}
};
Oe.type = "languageDetector";
var ke = Object.values({
	EN: "en",
	FR: "fr",
	JA: "ja",
	ES: "es",
	KO: "ko",
	ZH_HANS: "zh-Hans",
	ZH_HANT: "zh-Hant"
}), Ae = {
	browserSignIn: {
		title: "Open Prompt Studio from a terminal",
		description: "This browser is not signed in. Run this command in a terminal to open a signed-in dashboard."
	},
	connection: {
		lost: "Backend connection lost. Reconnecting automatically.",
		connected: "Connected to backend.",
		unavailable: "Backend unavailable"
	}
}, je = {
	title: "Projects",
	loading: "Loading projects...",
	chatInput: {
		agent: {
			selectLabel: "Select harness",
			unknown: "No harness available",
			loading: "Loading harnesses..."
		},
		model: {
			selectLabel: "Select model",
			searchPlaceholder: "Search models…",
			none: "No models",
			noneAvailable: "No models available",
			loading: "Loading models..."
		}
	},
	projectSettings: {
		extensionsPanel: {
			empty: "No extensions installed for this project.",
			loadError: "Failed to load extensions.",
			title: "Extensions",
			searchPlaceholder: "Search extensions…",
			installedGroup: "Installed · {{count}}",
			marketplace: {
				group: "Available · {{count}}",
				allInstalled: "All available extensions are installed.",
				install: "Install",
				installSucceeded: "{{name}} installed",
				installFailed: "Extension install failed"
			},
			noSearchResults: "No extensions match \"{{query}}\".",
			noDescription: "No description provided.",
			scope: {
				repo: "repo",
				global: "shared"
			},
			status: { error: "Failed to load" },
			health: {
				triggerAriaLabel: "Show issues for {{name}}",
				failedToLoad: "Failed to load",
				incompatibleVersions: "Incompatible versions",
				issues_one: "{{count}} issue",
				issues_other: "{{count}} issues",
				lastLoaded: "Last loaded {{time}}",
				unknownError: "The extension failed to load.",
				copyError: "Copy error",
				errorCopied: "Error copied"
			},
			upgrade: {
				action: "Upgrade",
				succeeded: "Extension upgraded",
				current: "Extension is already current",
				failed: "Extension upgrade failed"
			},
			upgradeAll: {
				action: "Upgrade all",
				succeeded_one: "{{count}} extension upgraded",
				succeeded_other: "{{count}} extensions upgraded",
				failed_one: "{{count}} extension could not be upgraded",
				failed_other: "{{count}} extensions could not be upgraded"
			},
			reload: {
				action: "Reload",
				hint: "The source folder changed. Reload to use the new version.",
				succeeded: "Local changes loaded",
				failed: "Local changes refused"
			},
			dropZone: {
				title: "Drop an extension folder here",
				hint: "The host installs it in the scope declared by the extension.",
				uploading: "Adding {{name}}…",
				succeeded: "{{name}} added",
				failed: "Could not add the extension folder",
				notFolder: "Drop a folder, not a single file."
			},
			automations: {
				title: "Automations",
				toggleAriaLabel: "Toggle automation {{name}}",
				listStatus: "{{enabled}} of {{count}} automations enabled",
				cron: "cron {{cron}}",
				stateOn: "on",
				stateOff: "off"
			},
			connections: {
				title: "Connections",
				description: "Connect this extension to its remote services. Credentials stay in the Prompt Studio host.",
				endpoint: "Endpoint",
				credential: "Credential",
				credentialUnchanged: "Leave blank to keep the current credential",
				credentialRequired: "Enter a credential",
				connected: "Authenticated",
				notConnected: "Not connected",
				lastCheckOk: "Last check passed ({{status}})",
				lastCheckFailed: "Last check failed ({{status}})",
				connect: "Connect",
				reconnect: "Reconnect",
				check: "Check",
				revoke: "Revoke",
				saved: "Connection saved",
				actionFailed: "Connection action failed"
			},
			detail: {
				back: "Extensions",
				sourcePath: "Source folder",
				tabs: {
					settings: "Settings",
					contributions: "Contributions"
				},
				noContributions: "This extension declares no contributions.",
				noSettings: "This extension declares no settings.",
				dangerZone: "Danger zone",
				deleteHint: "Delete this extension's files and remove it from the project.",
				copyCommand: "Copy command",
				contributionKinds: {
					harnesses: "Harnesses",
					commands: "Commands",
					modes: "Modes",
					views: "Views",
					placements: "Placements",
					menuContributions: "Menu items",
					settingsPanels: "Settings panels",
					skills: "Skills",
					templates: "Templates",
					themes: "Themes",
					navigationItems: "Navigation items",
					commandPaletteResources: "Command palette resources"
				},
				deleteHintShared: "Delete this extension's files. This removes it from every project that uses it."
			},
			toggleAriaLabel: "Toggle {{name}}",
			toggleErrorTitle: "Failed to update extension",
			toggleError: "Failed to update the extension. Please try again.",
			delete: "Delete extension",
			deleteErrorTitle: "Failed to delete extension",
			deleteError: "Failed to delete the extension. Please try again.",
			deleteConfirm: {
				headline: "Delete extension?",
				notification: "This deletes \"{{name}}\"'s extension files and removes it from the project. Its stored data is kept so reinstalling restores it.",
				deleteDataLabel: "Also delete this extension's data (cannot be undone)",
				button: "Delete",
				notificationShared: "This deletes \"{{name}}\"'s extension files and removes it from every project that uses it. Its stored data is kept so reinstalling restores it."
			},
			enabledInProject: "Enabled in this project",
			replace: {
				title: "Replace {{name}}?",
				message: "This replaces the installed files. Other projects using this extension will use the new files too.",
				action: "Replace"
			}
		},
		machineTokens: {
			title: "Machine tokens",
			description: "Issue expiring credentials for exact automation commands in this project.",
			issuedTitle: "Copy this token now",
			issuedDescription: "The raw token is shown once and cannot be recovered later.",
			copy: "Copy",
			issueTitle: "Issue token",
			name: "Owner and purpose",
			scopes: "Allowed command IDs",
			scopesHint: "Enter one exact automation-enabled command ID per line.",
			expiry: "Expires in days",
			issue: "Issue token",
			issueFailed: "Failed to issue machine token",
			activeTitle: "Active tokens",
			empty: "No active machine tokens.",
			expires: "Expires {{date}}",
			revoke: "Revoke"
		}
	},
	list: {
		settings: "Settings",
		createProject: "Create project",
		searchPlaceholder: "Search projects...",
		noProjectsYet: "No projects yet",
		noProjectsDescription: "Create your first project to get started.",
		noSearchResults: "No projects match your search.",
		noFolder: "No folder on this device",
		cloudNotOnDevice: "Cloud · not on this device yet",
		cloudWaiting: "Cloud · waiting to download",
		cloudReady: "Cloud · ready offline · no folder yet",
		cloud: "Cloud",
		cloudNeedsAttention: "Cloud · needs attention",
		localPath: "{{path}} · local"
	},
	folder: {
		title: "{{name}}'s files are not on this device",
		description: "Workspaces and file views need the project's folder. Choose how to get it.",
		clone: "Clone from {{remote}}",
		clonePath: "Folder to clone into",
		browse: "Browse",
		existing: "Use a folder that already has it",
		existingHint: "For a checkout you made yourself. Prompt Studio checks that it is the same repository.",
		existingHintNoRemote: "Choose the folder that holds this project's files.",
		notNow: "Not now",
		cloneAndContinue: "Clone and continue",
		chooseFolder: "Choose folder"
	}
}, Me = {
	runtimeSettings: {
		title: "Runtime Settings",
		description: "Configure the global concurrency value used by session queue scheduling.",
		save: "Save",
		saveSuccess: "Runtime settings saved",
		saveError: "Failed to save runtime settings",
		loadError: "Failed to load runtime settings",
		loadErrorDescription: "Try again before editing this setting.",
		retry: "Retry",
		maxConcurrentSessions: {
			label: "Max concurrent sessions",
			helper: "Leave blank for unlimited sessions. Set 1 for local LLM setups that can only run one session at a time.",
			placeholder: "none",
			none: "none",
			current: "Current value: {{value}}",
			invalid: "Enter a whole number greater than 0, or leave blank for none."
		}
	},
	harnessesPanel: {
		defaultModelTitle: "Default model",
		defaultModelDescription: "Used when new sessions start without an explicit Harness or model. Its run options below apply to every session of this Harness.",
		runDefaultsSaveError: "Failed to save run defaults"
	},
	agentRow: {
		defaultHarnessSelect: "Select Harness",
		defaultHarnessNone: "No Harness selected",
		harnessLoading: "Loading Harnesses...",
		defaultModelSelect: "Select model",
		defaultModelNone: "No model selected",
		modelLoading: "Loading models...",
		modelNoneAvailable: "No models available",
		modelSearch: "Search models...",
		failedToSetDefaultHarness: "Failed to set default harness",
		failedToSetDefaultModel: "Failed to set default model"
	},
	betaFeatures: {
		title: "Beta features",
		description: "Try beta features. This setting applies to every project and dashboard connected to this installation.",
		notifications: "Notifications",
		machineTokens: "Machine tokens",
		loading: "Loading settings…"
	},
	developerTools: {
		title: "Developer tools",
		description: "Tools for checking how this app runs. These settings are saved on this device only."
	},
	performance: {
		settings: {
			description: "Measure frame rate, CPU, and slow frames in this app. Nothing is measured while this is off. Measurements stay on this device and are never uploaded.",
			enable: "Enable performance monitoring",
			helperDesktopOn: "On for this device. Shows frame rate in the status bar. Samples every 2 seconds and keeps the last 30 seconds.",
			helperBrowserOn: "On for this browser. Shows frame rate in the status bar and records slow frames while this tab is open.",
			saveError: "Could not change performance monitoring."
		},
		popover: {
			title: "Performance",
			statusLabel: "Frame rate {{fps}} fps. Show performance details.",
			avgMin: "avg {{avg}} · min {{min}}",
			ago: "30 s ago",
			now: "now",
			cpu: "CPU",
			window: "last 30 s",
			workbench: "Workbench",
			workbenchDetail: "This window",
			views_one: "{{count}} view",
			views_other: "{{count}} views",
			paused: "Paused · views unloaded",
			pause: "Pause {{name}}",
			pauseTooltip: "Pause {{name}} · unloads its views",
			resume: "Resume",
			resumeLabel: "Resume {{name}}",
			more_one: "{{count}} more extension",
			more_other: "{{count}} more extensions",
			fewer: "Show the {{count}} busiest",
			cpuUnavailableTitle: "Could not read CPU.",
			cpuUnavailableBody: "Frame rate still updates. Pause still works.",
			browserTitle: "CPU is measured in the desktop app",
			browserBody: "A browser tab cannot read CPU. Pause still works.",
			sustainedTitle: "Sustained high CPU",
			sustainedBody: "{{process}} averaged {{cpu}} CPU over the last {{seconds}} seconds.",
			unknownExtension: "Unknown extension",
			roles: {
				main: "App",
				gpu: "GPU",
				utility: "Utility process",
				startup: "Startup window",
				renderer: "Renderer",
				other: "Other process",
				"extension-frames": "Extension frames",
				workbench: "Workbench"
			}
		},
		paused: {
			title: "{{name}} is paused",
			body: "Paused from the performance monitor. Its views stay unloaded until you resume."
		}
	},
	appearance: {
		title: "Appearance",
		description: "Choose how Prompt Studio looks. You can also change the theme with Alt+Shift+T.",
		theme: "Theme",
		themeHelper: "Applies to every project.",
		openRelatedResources: "Open related resources",
		openRelatedResourcesHelper: "Automatically open a recent related resource of each kind as an unpinned preview."
	},
	connectionStatus: {
		description: "Show the backend connection status in the status bar.",
		enable: "Show connection status",
		saveError: "Could not change connection status display."
	},
	updates: {
		title: "Update channel",
		description: "Choose which builds this app updates to. The setting applies to this device only.",
		channel: "Channel",
		loading: "Loading…",
		stable: "Stable",
		stableHelper: "Released versions. Recommended.",
		nightly: "Nightly",
		nightlyHelper: "A signed build of the latest main branch, published once a day. It may have bugs and runs new database migrations on your data.",
		switchBackNote: "Switching back to Stable keeps this version until a newer stable release is out.",
		currentVersion: "Current version",
		saveError: "Could not change the update channel."
	}
}, Ne = {
	browserSignIn: {
		title: "Abre Prompt Studio desde una terminal",
		description: "Este navegador no ha iniciado sesión. Ejecuta este comando en una terminal para abrir un panel con la sesión iniciada."
	},
	connection: {
		lost: "Se perdió la conexión con el servidor. Reconectando automáticamente.",
		connected: "Conectado al servidor.",
		unavailable: "Servidor no disponible"
	}
}, Pe = {
	title: "Proyectos",
	loading: "Cargando proyectos...",
	chatInput: {
		agent: {
			selectLabel: "Seleccionar harness",
			unknown: "No hay harness disponible",
			loading: "Cargando harnesses..."
		},
		model: {
			selectLabel: "Seleccionar modelo",
			none: "Sin modelos",
			noneAvailable: "No hay modelos disponibles",
			loading: "Cargando modelos..."
		}
	},
	projectSettings: {
		machineTokens: {
			title: "Tokens de máquina",
			description: "Emite credenciales con caducidad para comandos de automatización exactos de este proyecto.",
			issuedTitle: "Copia este token ahora",
			issuedDescription: "El token completo solo se muestra una vez y no se puede recuperar.",
			copy: "Copiar",
			issueTitle: "Emitir token",
			name: "Responsable y propósito",
			scopes: "IDs de comandos permitidos",
			scopesHint: "Introduce un ID de comando habilitado para automatización por línea.",
			expiry: "Caduca en días",
			issue: "Emitir token",
			issueFailed: "No se pudo emitir el token de máquina",
			activeTitle: "Tokens activos",
			empty: "No hay tokens de máquina activos.",
			expires: "Caduca el {{date}}",
			revoke: "Revocar"
		},
		extensionsPanel: {
			empty: "No hay extensiones instaladas para este proyecto.",
			loadError: "Error al cargar las extensiones.",
			title: "Extensiones",
			searchPlaceholder: "Buscar extensiones…",
			installedGroup: "Instaladas · {{count}}",
			noSearchResults: "Ninguna extensión coincide con \"{{query}}\".",
			noDescription: "Sin descripción.",
			scope: {
				repo: "repo",
				global: "compartida"
			},
			status: { error: "Error al cargar" },
			health: {
				triggerAriaLabel: "Mostrar problemas de {{name}}",
				failedToLoad: "Error al cargar",
				incompatibleVersions: "Versiones incompatibles",
				issues_one: "{{count}} problema",
				issues_other: "{{count}} problemas",
				lastLoaded: "Última carga {{time}}",
				unknownError: "La extensión no se pudo cargar.",
				copyError: "Copiar error",
				errorCopied: "Error copiado"
			},
			upgrade: {
				action: "Actualizar versión",
				succeeded: "Extensión actualizada",
				current: "La extensión ya está al día",
				failed: "No se pudo actualizar la extensión"
			},
			upgradeAll: {
				action: "Actualizar todas",
				succeeded_one: "{{count}} extensión actualizada",
				succeeded_other: "{{count}} extensiones actualizadas",
				failed_one: "No se pudo actualizar {{count}} extensión",
				failed_other: "No se pudieron actualizar {{count}} extensiones"
			},
			reload: {
				action: "Recargar",
				hint: "La carpeta de origen cambió. Recarga para usar la nueva versión.",
				succeeded: "Cambios locales cargados",
				failed: "Cambios locales rechazados"
			},
			dropZone: {
				title: "Suelta aquí una carpeta de extensión",
				hint: "El servidor la instala en el ámbito declarado por la extensión.",
				uploading: "Añadiendo {{name}}…",
				succeeded: "{{name}} añadida",
				failed: "No se pudo añadir la carpeta de la extensión",
				notFolder: "Suelta una carpeta, no un archivo."
			},
			automations: {
				title: "Automatizaciones",
				toggleAriaLabel: "Alternar automatización {{name}}",
				listStatus: "{{enabled}} de {{count}} automatizaciones habilitadas",
				cron: "cron {{cron}}",
				stateOn: "activada",
				stateOff: "desactivada"
			},
			connections: {
				title: "Conexiones",
				description: "Conecta esta extensión con sus servicios remotos. Las credenciales permanecen en el host de Prompt Studio.",
				endpoint: "Endpoint",
				credential: "Credencial",
				credentialUnchanged: "Déjalo vacío para conservar la credencial actual",
				credentialRequired: "Introduce una credencial",
				connected: "Autenticada",
				notConnected: "Sin conexión",
				lastCheckOk: "Última comprobación correcta ({{status}})",
				lastCheckFailed: "Última comprobación fallida ({{status}})",
				connect: "Conectar",
				reconnect: "Reconectar",
				check: "Comprobar",
				revoke: "Revocar",
				saved: "Conexión guardada",
				actionFailed: "Falló la acción de conexión"
			},
			detail: {
				back: "Extensiones",
				sourcePath: "Carpeta de origen",
				tabs: {
					settings: "Configuración",
					contributions: "Contribuciones"
				},
				noContributions: "Esta extensión no declara ninguna contribución.",
				noSettings: "Esta extensión no declara ninguna configuración.",
				dangerZone: "Zona de peligro",
				deleteHint: "Eliminar los archivos de esta extensión y quitarla del proyecto.",
				copyCommand: "Copiar comando",
				contributionKinds: {
					harnesses: "Harnesses",
					commands: "Comandos",
					modes: "Modos",
					views: "Vistas",
					placements: "Ubicaciones",
					menuContributions: "Elementos de menú",
					settingsPanels: "Paneles de configuración",
					skills: "Habilidades",
					templates: "Plantillas",
					themes: "Temas",
					navigationItems: "Elementos de navegación",
					commandPaletteResources: "Recursos de la paleta de comandos"
				},
				deleteHintShared: "Eliminar los archivos de esta extensión. Esto la quita de todos los proyectos que la usan."
			},
			toggleAriaLabel: "Alternar {{name}}",
			toggleErrorTitle: "Error al actualizar la extensión",
			toggleError: "No se pudo actualizar la extensión. Inténtalo de nuevo.",
			delete: "Eliminar extensión",
			deleteErrorTitle: "Error al eliminar la extensión",
			deleteError: "No se pudo eliminar la extensión. Inténtalo de nuevo.",
			deleteConfirm: {
				headline: "¿Eliminar la extensión?",
				notification: "Esto elimina los archivos de extensión de \"{{name}}\" y la quita del proyecto. Sus datos almacenados se conservan para restaurarlos al reinstalar.",
				deleteDataLabel: "Eliminar también los datos de esta extensión (no se puede deshacer)",
				button: "Eliminar",
				notificationShared: "Esto elimina los archivos de extensión de \"{{name}}\" y la quita de todos los proyectos que la usan. Sus datos almacenados se conservan para restaurarlos al reinstalar."
			},
			enabledInProject: "Activada en este proyecto",
			replace: {
				title: "¿Reemplazar {{name}}?",
				message: "Esto reemplaza los archivos instalados. Los otros proyectos que usan esta extensión también usarán los nuevos archivos.",
				action: "Reemplazar"
			}
		}
	},
	list: {
		settings: "Configuración",
		createProject: "Crear proyecto",
		noProjectsYet: "Aún no hay proyectos",
		noProjectsDescription: "Crea tu primer proyecto para comenzar."
	}
}, Fe = {
	runtimeSettings: {
		title: "Configuración de ejecución",
		description: "Configura el valor global de concurrencia usado por la cola de sesiones.",
		save: "Guardar",
		saveSuccess: "Configuración de ejecución guardada",
		saveError: "No se pudo guardar la configuración de ejecución",
		loadError: "No se pudo cargar la configuración de ejecución",
		loadErrorDescription: "Inténtalo de nuevo antes de editar esta opción.",
		retry: "Reintentar",
		maxConcurrentSessions: {
			label: "Máximo de sesiones concurrentes",
			helper: "Déjalo en blanco para sesiones ilimitadas. Usa 1 para configuraciones con LLM local que solo pueden ejecutar una sesión a la vez.",
			placeholder: "none",
			none: "ninguno",
			current: "Valor actual: {{value}}",
			invalid: "Introduce un número entero mayor que 0, o déjalo en blanco para ninguno."
		}
	},
	agentRow: {
		failedToSetDefaultHarness: "No se pudo establecer el harness predeterminado",
		failedToSetDefaultModel: "No se pudo establecer el modelo predeterminado"
	},
	betaFeatures: {
		title: "Funciones beta",
		description: "Prueba funciones beta. Este ajuste se aplica a todos los proyectos y paneles conectados a esta instalación.",
		notifications: "Notificaciones",
		machineTokens: "Tokens de máquina",
		loading: "Cargando ajustes…"
	},
	developerTools: {
		title: "Herramientas para desarrolladores",
		description: "Herramientas para revisar cómo funciona esta app. Estos ajustes se guardan solo en este dispositivo."
	},
	performance: {
		settings: {
			description: "Mide la tasa de fotogramas, la CPU y los fotogramas lentos de esta aplicación. No se mide nada mientras esté desactivada. Las mediciones se quedan en este dispositivo y nunca se suben.",
			enable: "Habilitar supervisión del rendimiento",
			helperDesktopOn: "Activada en este dispositivo. Muestra la tasa de fotogramas en la barra de estado. Toma una muestra cada 2 segundos y guarda los últimos 30 segundos.",
			helperBrowserOn: "Activada en este navegador. Muestra la tasa de fotogramas en la barra de estado y registra los fotogramas lentos mientras esta pestaña esté abierta.",
			saveError: "No se pudo cambiar la supervisión del rendimiento."
		},
		popover: {
			title: "Rendimiento",
			statusLabel: "Tasa de fotogramas {{fps}} fps. Mostrar detalles de rendimiento.",
			avgMin: "media {{avg}} · mín. {{min}}",
			ago: "hace 30 s",
			now: "ahora",
			cpu: "CPU",
			window: "últimos 30 s",
			workbench: "Workbench",
			workbenchDetail: "Esta ventana",
			views_one: "{{count}} vista",
			views_other: "{{count}} vistas",
			paused: "En pausa · vistas descargadas",
			pause: "Pausar {{name}}",
			pauseTooltip: "Pausar {{name}} · descarga sus vistas",
			resume: "Reanudar",
			resumeLabel: "Reanudar {{name}}",
			more_one: "{{count}} extensión más",
			more_other: "{{count}} extensiones más",
			fewer: "Mostrar las {{count}} más activas",
			cpuUnavailableTitle: "No se pudo leer la CPU.",
			cpuUnavailableBody: "La tasa de fotogramas sigue actualizándose. Pausar sigue funcionando.",
			browserTitle: "La CPU se mide en la aplicación de escritorio",
			browserBody: "Una pestaña del navegador no puede leer la CPU. Pausar sigue funcionando.",
			sustainedTitle: "CPU alta sostenida",
			sustainedBody: "{{process}} promedió {{cpu}} de CPU en los últimos {{seconds}} segundos.",
			unknownExtension: "Extensión desconocida",
			roles: {
				main: "Aplicación",
				gpu: "GPU",
				utility: "Proceso auxiliar",
				startup: "Ventana de inicio",
				renderer: "Renderizador",
				other: "Otro proceso",
				"extension-frames": "Marcos de extensiones",
				workbench: "Workbench"
			}
		},
		paused: {
			title: "{{name}} está en pausa",
			body: "Se pausó desde el monitor de rendimiento. Sus vistas siguen descargadas hasta que la reanudes."
		}
	},
	appearance: {
		title: "Apariencia",
		description: "Elige cómo se ve Prompt Studio. También puedes cambiar el tema con Alt+Shift+T.",
		theme: "Tema",
		themeHelper: "Se aplica a todos los proyectos.",
		openRelatedResources: "Abrir recursos relacionados",
		openRelatedResourcesHelper: "Abrir automáticamente un recurso relacionado reciente de cada tipo como vista previa sin fijar."
	},
	connectionStatus: {
		description: "Mostrar el estado de conexión al servidor en la barra de estado.",
		enable: "Mostrar estado de conexión",
		saveError: "No se pudo cambiar la visualización del estado de conexión."
	},
	updates: {
		title: "Canal de actualización",
		description: "Elige a qué versiones se actualiza esta aplicación. La configuración se aplica solo a este dispositivo.",
		channel: "Canal",
		loading: "Cargando…",
		stable: "Estable",
		stableHelper: "Versiones publicadas. Recomendado.",
		nightly: "Nightly",
		nightlyHelper: "Una compilación firmada de la última rama main, publicada una vez al día. Puede tener errores y aplica nuevas migraciones de base de datos a tus datos.",
		switchBackNote: "Si vuelves a Estable, se mantiene esta versión hasta que salga una versión estable más reciente.",
		currentVersion: "Versión actual",
		saveError: "No se pudo cambiar el canal de actualización."
	}
}, Ie = {
	browserSignIn: {
		title: "Ouvrez Prompt Studio depuis un terminal",
		description: "Ce navigateur n'est pas connecté. Exécutez cette commande dans un terminal pour ouvrir un tableau de bord connecté."
	},
	connection: {
		lost: "Connexion au serveur perdue. Reconnexion automatique en cours.",
		connected: "Connecté au serveur.",
		unavailable: "Serveur indisponible"
	}
}, Le = {
	title: "Projets",
	loading: "Chargement des projets...",
	chatInput: {
		agent: {
			selectLabel: "Sélectionner un harness",
			unknown: "Aucun harness disponible",
			loading: "Chargement des harness..."
		},
		model: {
			selectLabel: "Sélectionner un modèle",
			none: "Aucun modèle",
			noneAvailable: "Aucun modèle disponible",
			loading: "Chargement des modèles..."
		}
	},
	projectSettings: {
		machineTokens: {
			title: "Jetons machine",
			description: "Émettez des identifiants temporaires pour des commandes d’automatisation précises de ce projet.",
			issuedTitle: "Copiez ce jeton maintenant",
			issuedDescription: "Le jeton brut n’est affiché qu’une fois et ne pourra pas être récupéré.",
			copy: "Copier",
			issueTitle: "Émettre un jeton",
			name: "Responsable et objectif",
			scopes: "Identifiants de commande autorisés",
			scopesHint: "Saisissez un identifiant de commande activée pour l’automatisation par ligne.",
			expiry: "Expire dans (jours)",
			issue: "Émettre le jeton",
			issueFailed: "Échec de l’émission du jeton machine",
			activeTitle: "Jetons actifs",
			empty: "Aucun jeton machine actif.",
			expires: "Expire le {{date}}",
			revoke: "Révoquer"
		},
		extensionsPanel: {
			empty: "Aucune extension installée pour ce projet.",
			loadError: "Échec du chargement des extensions.",
			title: "Extensions",
			searchPlaceholder: "Rechercher des extensions…",
			installedGroup: "Installées · {{count}}",
			noSearchResults: "Aucune extension ne correspond à \"{{query}}\".",
			noDescription: "Aucune description fournie.",
			scope: {
				repo: "repo",
				global: "partagée"
			},
			status: { error: "Échec du chargement" },
			health: {
				triggerAriaLabel: "Afficher les problèmes de {{name}}",
				failedToLoad: "Échec du chargement",
				incompatibleVersions: "Versions incompatibles",
				issues_one: "{{count}} problème",
				issues_other: "{{count}} problèmes",
				lastLoaded: "Dernier chargement {{time}}",
				unknownError: "L'extension n'a pas pu être chargée.",
				copyError: "Copier l'erreur",
				errorCopied: "Erreur copiée"
			},
			upgrade: {
				action: "Mettre à niveau",
				succeeded: "Extension mise à niveau",
				current: "L'extension est déjà à jour",
				failed: "Échec de la mise à niveau de l'extension"
			},
			upgradeAll: {
				action: "Tout mettre à niveau",
				succeeded_one: "{{count}} extension mise à niveau",
				succeeded_other: "{{count}} extensions mises à niveau",
				failed_one: "{{count}} extension n'a pas pu être mise à niveau",
				failed_other: "{{count}} extensions n'ont pas pu être mises à niveau"
			},
			reload: {
				action: "Recharger",
				hint: "Le dossier source a changé. Rechargez pour utiliser la nouvelle version.",
				succeeded: "Modifications locales chargées",
				failed: "Modifications locales refusées"
			},
			dropZone: {
				title: "Déposez un dossier d'extension ici",
				hint: "Le serveur installe l’extension dans la portée qu’elle déclare.",
				uploading: "Ajout de {{name}}…",
				succeeded: "{{name}} ajoutée",
				failed: "Impossible d'ajouter le dossier de l'extension",
				notFolder: "Déposez un dossier, pas un fichier."
			},
			automations: {
				title: "Automatisations",
				toggleAriaLabel: "Activer/désactiver l'automatisation {{name}}",
				listStatus: "{{enabled}} automatisations activées sur {{count}}",
				cron: "cron {{cron}}",
				stateOn: "activé",
				stateOff: "désactivé"
			},
			connections: {
				title: "Connexions",
				description: "Connectez cette extension à ses services distants. Les identifiants restent dans l’hôte Prompt Studio.",
				endpoint: "Point de terminaison",
				credential: "Identifiant",
				credentialUnchanged: "Laissez vide pour conserver l’identifiant actuel",
				credentialRequired: "Saisissez un identifiant",
				connected: "Authentifiée",
				notConnected: "Non connectée",
				lastCheckOk: "Dernière vérification réussie ({{status}})",
				lastCheckFailed: "Dernière vérification échouée ({{status}})",
				connect: "Connecter",
				reconnect: "Reconnecter",
				check: "Vérifier",
				revoke: "Révoquer",
				saved: "Connexion enregistrée",
				actionFailed: "Échec de l’action sur la connexion"
			},
			detail: {
				back: "Extensions",
				sourcePath: "Dossier source",
				tabs: {
					settings: "Paramètres",
					contributions: "Contributions"
				},
				noContributions: "Cette extension ne déclare aucune contribution.",
				noSettings: "Cette extension ne déclare aucun paramètre.",
				dangerZone: "Zone de danger",
				deleteHint: "Supprimer les fichiers de cette extension et la retirer du projet.",
				copyCommand: "Copier la commande",
				contributionKinds: {
					harnesses: "Harness",
					commands: "Commandes",
					modes: "Modes",
					views: "Vues",
					placements: "Emplacements",
					menuContributions: "Éléments de menu",
					settingsPanels: "Panneaux de paramètres",
					skills: "Compétences",
					templates: "Modèles",
					themes: "Thèmes",
					navigationItems: "Éléments de navigation",
					commandPaletteResources: "Ressources de la palette de commandes"
				},
				deleteHintShared: "Supprimer les fichiers de cette extension. Elle est retirée de tous les projets qui l'utilisent."
			},
			toggleAriaLabel: "Activer/désactiver {{name}}",
			toggleErrorTitle: "Échec de la mise à jour de l'extension",
			toggleError: "Impossible de mettre à jour l'extension. Veuillez réessayer.",
			delete: "Supprimer l'extension",
			deleteErrorTitle: "Échec de la suppression de l'extension",
			deleteError: "Impossible de supprimer l'extension. Veuillez réessayer.",
			deleteConfirm: {
				headline: "Supprimer l'extension ?",
				notification: "Cela supprime les fichiers d'extension de \"{{name}}\" et la retire du projet. Ses données stockées sont conservées afin qu'une réinstallation les restaure.",
				deleteDataLabel: "Supprimer aussi les données de cette extension (irréversible)",
				button: "Supprimer",
				notificationShared: "Cela supprime les fichiers d'extension de \"{{name}}\" et la retire de tous les projets qui l'utilisent. Ses données stockées sont conservées afin qu'une réinstallation les restaure."
			},
			enabledInProject: "Activée dans ce projet",
			replace: {
				title: "Remplacer {{name}} ?",
				message: "Les fichiers installés seront remplacés. Les autres projets qui utilisent cette extension utiliseront aussi les nouveaux fichiers.",
				action: "Remplacer"
			}
		}
	},
	list: {
		settings: "Paramètres",
		createProject: "Créer un projet",
		noProjectsYet: "Aucun projet pour le moment",
		noProjectsDescription: "Créez votre premier projet pour commencer."
	}
}, Re = {
	runtimeSettings: {
		title: "Paramètres d'exécution",
		description: "Configurez la valeur de concurrence globale utilisée par la file de sessions.",
		save: "Enregistrer",
		saveSuccess: "Paramètres d'exécution enregistrés",
		saveError: "Échec de l'enregistrement des paramètres d'exécution",
		loadError: "Échec du chargement des paramètres d'exécution",
		loadErrorDescription: "Réessayez avant de modifier ce paramètre.",
		retry: "Réessayer",
		maxConcurrentSessions: {
			label: "Nombre maximal de sessions simultanées",
			helper: "Laissez vide pour des sessions illimitées. Définissez 1 pour les configurations LLM locales qui ne peuvent exécuter qu'une session à la fois.",
			placeholder: "none",
			none: "aucune",
			current: "Valeur actuelle : {{value}}",
			invalid: "Saisissez un entier supérieur à 0, ou laissez vide pour aucune."
		}
	},
	agentRow: {
		failedToSetDefaultHarness: "Échec de la définition du harness par défaut",
		failedToSetDefaultModel: "Échec de la définition du modèle par défaut"
	},
	betaFeatures: {
		title: "Fonctionnalités bêta",
		description: "Essayez les fonctionnalités bêta. Ce réglage s’applique à tous les projets et tableaux de bord connectés à cette installation.",
		notifications: "Notifications",
		machineTokens: "Jetons machine",
		loading: "Chargement des paramètres…"
	},
	developerTools: {
		title: "Outils de développement",
		description: "Outils pour vérifier le fonctionnement de cette app. Ces réglages sont enregistrés sur cet appareil uniquement."
	},
	performance: {
		settings: {
			description: "Mesure la fréquence d'images, le CPU et les images lentes dans cette application. Rien n'est mesuré quand cette option est désactivée. Les mesures restent sur cet appareil et ne sont jamais envoyées.",
			enable: "Activer la surveillance des performances",
			helperDesktopOn: "Activée sur cet appareil. Affiche la fréquence d'images dans la barre d'état. Mesure toutes les 2 secondes et garde les 30 dernières secondes.",
			helperBrowserOn: "Activée dans ce navigateur. Affiche la fréquence d'images dans la barre d'état et enregistre les images lentes tant que cet onglet est ouvert.",
			saveError: "Impossible de modifier la surveillance des performances."
		},
		popover: {
			title: "Performances",
			statusLabel: "Fréquence d'images {{fps}} fps. Afficher les détails des performances.",
			avgMin: "moy. {{avg}} · min {{min}}",
			ago: "il y a 30 s",
			now: "maintenant",
			cpu: "CPU",
			window: "30 dernières s",
			workbench: "Workbench",
			workbenchDetail: "Cette fenêtre",
			views_one: "{{count}} vue",
			views_other: "{{count}} vues",
			paused: "En pause · vues déchargées",
			pause: "Mettre en pause {{name}}",
			pauseTooltip: "Mettre en pause {{name}} · décharge ses vues",
			resume: "Reprendre",
			resumeLabel: "Reprendre {{name}}",
			more_one: "{{count}} extension de plus",
			more_other: "{{count}} extensions de plus",
			fewer: "Afficher les {{count}} plus actives",
			cpuUnavailableTitle: "Impossible de lire le CPU.",
			cpuUnavailableBody: "La fréquence d'images continue de se mettre à jour. La mise en pause fonctionne toujours.",
			browserTitle: "Le CPU est mesuré dans l'application de bureau",
			browserBody: "Un onglet de navigateur ne peut pas lire le CPU. La mise en pause fonctionne toujours.",
			sustainedTitle: "CPU élevé prolongé",
			sustainedBody: "{{process}} a utilisé en moyenne {{cpu}} de CPU au cours des {{seconds}} dernières secondes.",
			unknownExtension: "Extension inconnue",
			roles: {
				main: "Application",
				gpu: "GPU",
				utility: "Processus utilitaire",
				startup: "Fenêtre de démarrage",
				renderer: "Moteur de rendu",
				other: "Autre processus",
				"extension-frames": "Cadres d'extensions",
				workbench: "Workbench"
			}
		},
		paused: {
			title: "{{name}} est en pause",
			body: "Mise en pause depuis le moniteur de performances. Ses vues restent déchargées jusqu'à ce que vous la repreniez."
		}
	},
	appearance: {
		title: "Apparence",
		description: "Choisissez l'apparence de Prompt Studio. Vous pouvez aussi changer de thème avec Alt+Shift+T.",
		theme: "Thème",
		themeHelper: "S'applique à tous les projets.",
		openRelatedResources: "Ouvrir les ressources liées",
		openRelatedResourcesHelper: "Ouvrir automatiquement une ressource liée récente de chaque type dans un aperçu non épinglé."
	},
	connectionStatus: {
		description: "Afficher l’état de connexion au serveur dans la barre d’état.",
		enable: "Afficher l’état de la connexion",
		saveError: "Impossible de modifier l’affichage de l’état de la connexion."
	},
	updates: {
		title: "Canal de mise à jour",
		description: "Choisissez les versions vers lesquelles cette application se met à jour. Ce réglage s’applique à cet appareil uniquement.",
		channel: "Canal",
		loading: "Chargement…",
		stable: "Stable",
		stableHelper: "Versions publiées. Recommandé.",
		nightly: "Nightly",
		nightlyHelper: "Une version signée de la dernière branche main, publiée une fois par jour. Elle peut contenir des bugs et applique de nouvelles migrations de base de données à vos données.",
		switchBackNote: "Si vous revenez à Stable, cette version reste installée jusqu’à la publication d’une version stable plus récente.",
		currentVersion: "Version actuelle",
		saveError: "Impossible de modifier le canal de mise à jour."
	}
}, ze = {
	browserSignIn: {
		title: "ターミナルから Prompt Studio を開いてください",
		description: "このブラウザーはサインインしていません。ターミナルでこのコマンドを実行すると、サインイン済みのダッシュボードが開きます。"
	},
	connection: {
		lost: "サーバーとの接続が切れました。自動的に再接続しています。",
		connected: "バックエンドに接続しています。",
		unavailable: "バックエンドに接続できません"
	}
}, Be = {
	title: "プロジェクト",
	loading: "プロジェクトを読み込み中...",
	chatInput: {
		agent: {
			selectLabel: "ハーネスを選択",
			unknown: "利用可能なハーネスがありません",
			loading: "ハーネスを読み込み中..."
		},
		model: {
			selectLabel: "モデルを選択",
			none: "モデルなし",
			noneAvailable: "利用可能なモデルがありません",
			loading: "モデルを読み込み中..."
		}
	},
	projectSettings: {
		machineTokens: {
			title: "マシントークン",
			description: "このプロジェクトの特定の自動化コマンドに、有効期限付きの認証情報を発行します。",
			issuedTitle: "今すぐこのトークンをコピーしてください",
			issuedDescription: "生のトークンは一度だけ表示され、後から復元できません。",
			copy: "コピー",
			issueTitle: "トークンを発行",
			name: "所有者と目的",
			scopes: "許可するコマンド ID",
			scopesHint: "自動化が有効な正確なコマンド ID を1行に1つ入力してください。",
			expiry: "有効日数",
			issue: "トークンを発行",
			issueFailed: "マシントークンを発行できませんでした",
			activeTitle: "有効なトークン",
			empty: "有効なマシントークンはありません。",
			expires: "有効期限: {{date}}",
			revoke: "取り消す"
		},
		extensionsPanel: {
			empty: "このプロジェクトにはインストール済みの拡張機能がありません。",
			loadError: "拡張機能の読み込みに失敗しました。",
			title: "拡張機能",
			searchPlaceholder: "拡張機能を検索…",
			installedGroup: "インストール済み · {{count}}",
			noSearchResults: "\"{{query}}\"に一致する拡張機能はありません。",
			noDescription: "説明がありません。",
			scope: {
				repo: "repo",
				global: "共有"
			},
			status: { error: "読み込みに失敗しました" },
			health: {
				triggerAriaLabel: "{{name}}の問題を表示",
				failedToLoad: "読み込みに失敗しました",
				incompatibleVersions: "互換性のないバージョン",
				issues_one: "{{count}}件の問題",
				issues_other: "{{count}}件の問題",
				lastLoaded: "最終読み込み {{time}}",
				unknownError: "拡張機能の読み込みに失敗しました。",
				copyError: "エラーをコピー",
				errorCopied: "エラーをコピーしました"
			},
			upgrade: {
				action: "アップグレード",
				succeeded: "拡張機能をアップグレードしました",
				current: "拡張機能はすでに最新です",
				failed: "拡張機能をアップグレードできませんでした"
			},
			upgradeAll: {
				action: "すべてアップグレード",
				succeeded_other: "{{count}} 件の拡張機能をアップグレードしました",
				failed_other: "{{count}} 件の拡張機能をアップグレードできませんでした"
			},
			reload: {
				action: "再読み込み",
				hint: "ソースフォルダーが変更されました。新しいバージョンを使うには再読み込みしてください。",
				succeeded: "ローカルの変更を読み込みました",
				failed: "ローカルの変更は拒否されました"
			},
			dropZone: {
				title: "拡張機能のフォルダーをここにドロップ",
				hint: "ホストが拡張機能で宣言された範囲にインストールします。",
				uploading: "{{name}} を追加しています…",
				succeeded: "{{name}} を追加しました",
				failed: "拡張機能のフォルダーを追加できませんでした",
				notFolder: "ファイルではなくフォルダーをドロップしてください。"
			},
			automations: {
				title: "自動化",
				toggleAriaLabel: "自動化{{name}}を切り替え",
				listStatus: "{{count}}件中{{enabled}}件の自動化が有効",
				cron: "cron {{cron}}",
				stateOn: "オン",
				stateOff: "オフ"
			},
			connections: {
				title: "接続",
				description: "この拡張機能をリモートサービスに接続します。認証情報は Prompt Studio ホスト内に保持されます。",
				endpoint: "エンドポイント",
				credential: "認証情報",
				credentialUnchanged: "現在の認証情報を保持するには空欄にします",
				credentialRequired: "認証情報を入力してください",
				connected: "認証済み",
				notConnected: "未接続",
				lastCheckOk: "前回の確認は成功しました ({{status}})",
				lastCheckFailed: "前回の確認は失敗しました ({{status}})",
				connect: "接続",
				reconnect: "再接続",
				check: "確認",
				revoke: "取り消す",
				saved: "接続を保存しました",
				actionFailed: "接続操作に失敗しました"
			},
			detail: {
				back: "拡張機能",
				sourcePath: "ソースフォルダー",
				tabs: {
					settings: "設定",
					contributions: "コントリビューション"
				},
				noContributions: "この拡張機能はコントリビューションを宣言していません。",
				noSettings: "この拡張機能は設定を宣言していません。",
				dangerZone: "危険な操作",
				deleteHint: "この拡張機能のファイルを削除し、プロジェクトから取り除きます。",
				copyCommand: "コマンドをコピー",
				contributionKinds: {
					harnesses: "ハーネス",
					commands: "コマンド",
					modes: "モード",
					views: "ビュー",
					placements: "配置",
					menuContributions: "メニュー項目",
					settingsPanels: "設定パネル",
					skills: "スキル",
					templates: "テンプレート",
					themes: "テーマ",
					navigationItems: "ナビゲーション項目",
					commandPaletteResources: "コマンドパレットリソース"
				},
				deleteHintShared: "この拡張機能のファイルを削除します。使用しているすべてのプロジェクトから取り除かれます。"
			},
			toggleAriaLabel: "{{name}}を切り替え",
			toggleErrorTitle: "拡張機能の更新に失敗しました",
			toggleError: "拡張機能を更新できませんでした。もう一度お試しください。",
			delete: "拡張機能を削除",
			deleteErrorTitle: "拡張機能の削除に失敗しました",
			deleteError: "拡張機能を削除できませんでした。もう一度お試しください。",
			deleteConfirm: {
				headline: "拡張機能を削除しますか？",
				notification: "\"{{name}}\"の拡張機能ファイルを削除し、プロジェクトから取り除きます。保存されたデータは保持されるため、再インストールすると復元されます。",
				deleteDataLabel: "この拡張機能のデータも削除する（元に戻せません）",
				button: "削除",
				notificationShared: "\"{{name}}\"の拡張機能ファイルを削除し、使用しているすべてのプロジェクトから取り除きます。保存されたデータは保持されるため、再インストールすると復元されます。"
			},
			enabledInProject: "このプロジェクトで有効",
			replace: {
				title: "{{name}} を置き換えますか？",
				message: "インストール済みのファイルを置き換えます。この拡張機能を使用する他のプロジェクトも新しいファイルを使用します。",
				action: "置き換える"
			}
		}
	},
	list: {
		settings: "設定",
		createProject: "プロジェクトを作成",
		noProjectsYet: "まだプロジェクトがありません",
		noProjectsDescription: "最初のプロジェクトを作成して始めましょう。"
	}
}, Ve = {
	runtimeSettings: {
		title: "ランタイム設定",
		description: "セッションキューのスケジューリングで使うグローバル同時実行値を設定します。",
		save: "保存",
		saveSuccess: "ランタイム設定を保存しました",
		saveError: "ランタイム設定を保存できませんでした",
		loadError: "ランタイム設定を読み込めませんでした",
		loadErrorDescription: "この設定を編集する前にもう一度試してください。",
		retry: "再試行",
		maxConcurrentSessions: {
			label: "最大同時セッション数",
			helper: "無制限にする場合は空欄にします。一度に 1 セッションしか実行できないローカル LLM 環境では 1 を設定します。",
			placeholder: "none",
			none: "なし",
			current: "現在の値: {{value}}",
			invalid: "0 より大きい整数を入力するか、なしにする場合は空欄にしてください。"
		}
	},
	agentRow: {
		failedToSetDefaultHarness: "デフォルトのハーネスを設定できませんでした",
		failedToSetDefaultModel: "デフォルトのモデルを設定できませんでした"
	},
	betaFeatures: {
		title: "ベータ機能",
		description: "ベータ機能を試せます。この設定は、このインストールに接続するすべてのプロジェクトとダッシュボードに適用されます。",
		notifications: "通知",
		machineTokens: "マシントークン",
		loading: "設定を読み込み中…"
	},
	developerTools: {
		title: "開発者ツール",
		description: "このアプリの動作を確認するためのツールです。これらの設定はこのデバイスにのみ保存されます。"
	},
	performance: {
		settings: {
			description: "このアプリのフレームレート、CPU、遅いフレームを計測します。オフの間は何も計測しません。計測データはこのデバイスにのみ保存され、アップロードされることはありません。",
			enable: "パフォーマンス監視を有効にする",
			helperDesktopOn: "このデバイスでオンです。ステータスバーにフレームレートを表示します。2秒ごとに計測し、直近30秒分を保持します。",
			helperBrowserOn: "このブラウザでオンです。ステータスバーにフレームレートを表示し、このタブが開いている間は遅いフレームを記録します。",
			saveError: "パフォーマンス監視を変更できませんでした。"
		},
		popover: {
			title: "パフォーマンス",
			statusLabel: "フレームレート {{fps}} fps。パフォーマンスの詳細を表示します。",
			avgMin: "平均 {{avg}} · 最小 {{min}}",
			ago: "30 秒前",
			now: "現在",
			cpu: "CPU",
			window: "直近 30 秒",
			workbench: "Workbench",
			workbenchDetail: "このウィンドウ",
			views_one: "{{count}} 個のビュー",
			views_other: "{{count}} 個のビュー",
			paused: "一時停止中 · ビューはアンロード済み",
			pause: "{{name}} を一時停止",
			pauseTooltip: "{{name}} を一時停止 · ビューをアンロードします",
			resume: "再開",
			resumeLabel: "{{name}} を再開",
			more_one: "ほか {{count}} 個の拡張機能",
			more_other: "ほか {{count}} 個の拡張機能",
			fewer: "負荷の高い上位 {{count}} 個を表示",
			cpuUnavailableTitle: "CPU を読み取れませんでした。",
			cpuUnavailableBody: "フレームレートは引き続き更新されます。一時停止も使えます。",
			browserTitle: "CPU はデスクトップアプリで計測されます",
			browserBody: "ブラウザのタブでは CPU を読み取れません。一時停止は使えます。",
			sustainedTitle: "CPU 高負荷が継続",
			sustainedBody: "{{process}} は直近 {{seconds}} 秒間、平均 {{cpu}} の CPU を使用しました。",
			unknownExtension: "不明な拡張機能",
			roles: {
				main: "アプリ",
				gpu: "GPU",
				utility: "ユーティリティプロセス",
				startup: "起動ウィンドウ",
				renderer: "レンダラー",
				other: "その他のプロセス",
				"extension-frames": "拡張機能のフレーム",
				workbench: "Workbench"
			}
		},
		paused: {
			title: "{{name}} は一時停止中です",
			body: "パフォーマンスモニターから一時停止されました。再開するまでビューはアンロードされたままです。"
		}
	},
	appearance: {
		title: "外観",
		description: "Prompt Studio の見た目を選びます。Alt+Shift+T でもテーマを変更できます。",
		theme: "テーマ",
		themeHelper: "すべてのプロジェクトに適用されます。",
		openRelatedResources: "関連リソースを開く",
		openRelatedResourcesHelper: "各種類の最近の関連リソースを、ピン留めされていないプレビューで自動的に開きます。"
	},
	connectionStatus: {
		description: "ステータスバーにバックエンドの接続状態を表示します。",
		enable: "接続状態を表示",
		saveError: "接続状態の表示を変更できませんでした。"
	},
	updates: {
		title: "アップデートチャネル",
		description: "このアプリの更新先となるビルドを選びます。この設定はこのデバイスにのみ適用されます。",
		channel: "チャネル",
		loading: "読み込み中…",
		stable: "安定版",
		stableHelper: "リリース済みのバージョンです。推奨。",
		nightly: "ナイトリー",
		nightlyHelper: "最新の main ブランチから作られた署名済みビルドで、1 日 1 回公開されます。不具合がある可能性があり、データに新しいデータベースマイグレーションを実行します。",
		switchBackNote: "安定版に戻しても、より新しい安定版が出るまではこのバージョンのままです。",
		currentVersion: "現在のバージョン",
		saveError: "アップデートチャネルを変更できませんでした。"
	}
}, He = {
	browserSignIn: {
		title: "터미널에서 Prompt Studio를 여세요",
		description: "이 브라우저는 로그인되어 있지 않습니다. 터미널에서 이 명령을 실행하면 로그인된 대시보드가 열립니다."
	},
	connection: {
		lost: "서버 연결이 끊어졌습니다. 자동으로 다시 연결하는 중입니다.",
		connected: "백엔드에 연결되었습니다.",
		unavailable: "백엔드에 연결할 수 없음"
	}
}, Ue = {
	title: "프로젝트",
	loading: "프로젝트 로딩 중...",
	chatInput: {
		agent: {
			selectLabel: "하니스 선택",
			unknown: "사용 가능한 하니스가 없습니다",
			loading: "하니스 불러오는 중..."
		},
		model: {
			selectLabel: "모델 선택",
			none: "모델 없음",
			noneAvailable: "사용 가능한 모델 없음",
			loading: "모델 로딩 중..."
		}
	},
	projectSettings: {
		machineTokens: {
			title: "머신 토큰",
			description: "이 프로젝트의 정확한 자동화 명령에 만료되는 자격 증명을 발급합니다.",
			issuedTitle: "지금 이 토큰을 복사하세요",
			issuedDescription: "원본 토큰은 한 번만 표시되며 나중에 복구할 수 없습니다.",
			copy: "복사",
			issueTitle: "토큰 발급",
			name: "소유자 및 용도",
			scopes: "허용된 명령 ID",
			scopesHint: "자동화가 활성화된 정확한 명령 ID를 한 줄에 하나씩 입력하세요.",
			expiry: "만료 일수",
			issue: "토큰 발급",
			issueFailed: "머신 토큰을 발급하지 못했습니다",
			activeTitle: "활성 토큰",
			empty: "활성 머신 토큰이 없습니다.",
			expires: "{{date}} 만료",
			revoke: "폐기"
		},
		extensionsPanel: {
			empty: "이 프로젝트에 설치된 확장이 없습니다.",
			loadError: "확장을 불러오지 못했습니다.",
			title: "확장",
			searchPlaceholder: "확장 검색…",
			installedGroup: "설치됨 · {{count}}",
			noSearchResults: "\"{{query}}\"과(와) 일치하는 확장이 없습니다.",
			noDescription: "설명이 없습니다.",
			scope: {
				repo: "repo",
				global: "공유"
			},
			status: { error: "로드 실패" },
			health: {
				triggerAriaLabel: "{{name}}의 문제 표시",
				failedToLoad: "로드 실패",
				incompatibleVersions: "호환되지 않는 버전",
				issues_one: "{{count}}개의 문제",
				issues_other: "{{count}}개의 문제",
				lastLoaded: "마지막 로드 {{time}}",
				unknownError: "확장을 로드하지 못했습니다.",
				copyError: "오류 복사",
				errorCopied: "오류를 복사했습니다"
			},
			upgrade: {
				action: "업그레이드",
				succeeded: "확장을 업그레이드했습니다",
				current: "확장이 이미 최신입니다",
				failed: "확장을 업그레이드하지 못했습니다"
			},
			upgradeAll: {
				action: "모두 업그레이드",
				succeeded_other: "확장 {{count}}개를 업그레이드했습니다",
				failed_other: "확장 {{count}}개를 업그레이드하지 못했습니다"
			},
			reload: {
				action: "다시 불러오기",
				hint: "소스 폴더가 변경되었습니다. 새 버전을 사용하려면 다시 불러오세요.",
				succeeded: "로컬 변경 사항을 불러왔습니다",
				failed: "로컬 변경 사항이 거부되었습니다"
			},
			dropZone: {
				title: "확장 폴더를 여기에 놓으세요",
				hint: "호스트가 확장에 선언된 범위에 설치합니다.",
				uploading: "{{name}} 추가 중…",
				succeeded: "{{name}}이(가) 추가되었습니다",
				failed: "확장 폴더를 추가할 수 없습니다",
				notFolder: "파일이 아닌 폴더를 놓으세요."
			},
			automations: {
				title: "자동화",
				toggleAriaLabel: "자동화 {{name}} 전환",
				listStatus: "자동화 {{count}}개 중 {{enabled}}개 활성화됨",
				cron: "cron {{cron}}",
				stateOn: "켜짐",
				stateOff: "꺼짐"
			},
			connections: {
				title: "연결",
				description: "이 확장 프로그램을 원격 서비스에 연결합니다. 자격 증명은 Prompt Studio 호스트에 유지됩니다.",
				endpoint: "엔드포인트",
				credential: "자격 증명",
				credentialUnchanged: "현재 자격 증명을 유지하려면 비워 두세요",
				credentialRequired: "자격 증명을 입력하세요",
				connected: "인증됨",
				notConnected: "연결되지 않음",
				lastCheckOk: "마지막 확인 성공 ({{status}})",
				lastCheckFailed: "마지막 확인 실패 ({{status}})",
				connect: "연결",
				reconnect: "다시 연결",
				check: "확인",
				revoke: "폐기",
				saved: "연결을 저장했습니다",
				actionFailed: "연결 작업에 실패했습니다"
			},
			detail: {
				back: "확장",
				sourcePath: "소스 폴더",
				tabs: {
					settings: "설정",
					contributions: "기여"
				},
				noContributions: "이 확장은 기여를 선언하지 않습니다.",
				noSettings: "이 확장은 설정을 선언하지 않습니다.",
				dangerZone: "위험 구역",
				deleteHint: "이 확장의 파일을 삭제하고 프로젝트에서 제거합니다.",
				copyCommand: "명령 복사",
				contributionKinds: {
					harnesses: "하니스",
					commands: "명령",
					modes: "모드",
					views: "뷰",
					placements: "배치",
					menuContributions: "메뉴 항목",
					settingsPanels: "설정 패널",
					skills: "스킬",
					templates: "템플릿",
					themes: "테마",
					navigationItems: "탐색 항목",
					commandPaletteResources: "명령 팔레트 리소스"
				},
				deleteHintShared: "이 확장의 파일을 삭제합니다. 이 확장을 사용하는 모든 프로젝트에서 제거됩니다."
			},
			toggleAriaLabel: "{{name}} 전환",
			toggleErrorTitle: "확장 업데이트 실패",
			toggleError: "확장을 업데이트하지 못했습니다. 다시 시도해 주세요.",
			delete: "확장 삭제",
			deleteErrorTitle: "확장 삭제 실패",
			deleteError: "확장을 삭제하지 못했습니다. 다시 시도해 주세요.",
			deleteConfirm: {
				headline: "확장을 삭제하시겠습니까?",
				notification: "\"{{name}}\"의 확장 파일을 삭제하고 프로젝트에서 제거합니다. 저장된 데이터는 유지되므로 재설치하면 복원됩니다.",
				deleteDataLabel: "이 확장의 데이터도 삭제 (되돌릴 수 없음)",
				button: "삭제",
				notificationShared: "\"{{name}}\"의 확장 파일을 삭제하고 이 확장을 사용하는 모든 프로젝트에서 제거합니다. 저장된 데이터는 유지되므로 재설치하면 복원됩니다."
			},
			enabledInProject: "이 프로젝트에서 사용",
			replace: {
				title: "{{name}}을(를) 교체할까요?",
				message: "설치된 파일을 교체합니다. 이 확장을 사용하는 다른 프로젝트도 새 파일을 사용합니다.",
				action: "교체"
			}
		}
	},
	list: {
		settings: "설정",
		createProject: "프로젝트 생성",
		noProjectsYet: "아직 프로젝트가 없습니다",
		noProjectsDescription: "첫 번째 프로젝트를 만들어 시작하세요."
	}
}, We = {
	runtimeSettings: {
		title: "런타임 설정",
		description: "세션 큐 스케줄링에서 사용할 전역 동시 실행 값을 설정합니다.",
		save: "저장",
		saveSuccess: "런타임 설정을 저장했습니다",
		saveError: "런타임 설정을 저장하지 못했습니다",
		loadError: "런타임 설정을 불러오지 못했습니다",
		loadErrorDescription: "이 설정을 편집하기 전에 다시 시도하세요.",
		retry: "다시 시도",
		maxConcurrentSessions: {
			label: "최대 동시 세션 수",
			helper: "무제한 세션은 비워 둡니다. 한 번에 하나의 세션만 실행할 수 있는 로컬 LLM 설정에는 1을 입력하세요.",
			placeholder: "none",
			none: "없음",
			current: "현재 값: {{value}}",
			invalid: "0보다 큰 정수를 입력하거나, 없음으로 두려면 비워 두세요."
		}
	},
	agentRow: {
		failedToSetDefaultHarness: "기본 하니스를 설정하지 못했습니다",
		failedToSetDefaultModel: "기본 모델을 설정하지 못했습니다"
	},
	betaFeatures: {
		title: "베타 기능",
		description: "베타 기능을 사용해 보세요. 이 설정은 이 설치에 연결된 모든 프로젝트와 대시보드에 적용됩니다.",
		notifications: "알림",
		machineTokens: "머신 토큰",
		loading: "설정 불러오는 중…"
	},
	developerTools: {
		title: "개발자 도구",
		description: "이 앱의 동작을 확인하는 도구입니다. 이 설정은 이 기기에만 저장됩니다."
	},
	performance: {
		settings: {
			description: "이 앱의 프레임 속도, CPU, 느린 프레임을 측정합니다. 꺼져 있는 동안에는 아무것도 측정하지 않습니다. 측정값은 이 기기에만 남고 업로드되지 않습니다.",
			enable: "성능 모니터링 사용",
			helperDesktopOn: "이 기기에서 켜져 있습니다. 상태 표시줄에 프레임 속도를 표시합니다. 2초마다 측정하고 최근 30초를 보관합니다.",
			helperBrowserOn: "이 브라우저에서 켜져 있습니다. 상태 표시줄에 프레임 속도를 표시하고, 이 탭이 열려 있는 동안 느린 프레임을 기록합니다.",
			saveError: "성능 모니터링을 변경하지 못했습니다."
		},
		popover: {
			title: "성능",
			statusLabel: "프레임 속도 {{fps}} fps. 성능 세부 정보를 표시합니다.",
			avgMin: "평균 {{avg}} · 최소 {{min}}",
			ago: "30초 전",
			now: "현재",
			cpu: "CPU",
			window: "최근 30초",
			workbench: "Workbench",
			workbenchDetail: "이 창",
			views_one: "뷰 {{count}}개",
			views_other: "뷰 {{count}}개",
			paused: "일시 중지됨 · 뷰 언로드됨",
			pause: "{{name}} 일시 중지",
			pauseTooltip: "{{name}} 일시 중지 · 뷰를 언로드합니다",
			resume: "재개",
			resumeLabel: "{{name}} 재개",
			more_one: "확장 프로그램 {{count}}개 더 보기",
			more_other: "확장 프로그램 {{count}}개 더 보기",
			fewer: "사용량 상위 {{count}}개만 표시",
			cpuUnavailableTitle: "CPU를 읽지 못했습니다.",
			cpuUnavailableBody: "프레임 속도는 계속 업데이트됩니다. 일시 중지도 계속 작동합니다.",
			browserTitle: "CPU는 데스크톱 앱에서 측정됩니다",
			browserBody: "브라우저 탭에서는 CPU를 읽을 수 없습니다. 일시 중지는 계속 작동합니다.",
			sustainedTitle: "높은 CPU 사용 지속",
			sustainedBody: "{{process}}이(가) 최근 {{seconds}}초 동안 평균 {{cpu}} CPU를 사용했습니다.",
			unknownExtension: "알 수 없는 확장 프로그램",
			roles: {
				main: "앱",
				gpu: "GPU",
				utility: "유틸리티 프로세스",
				startup: "시작 창",
				renderer: "렌더러",
				other: "기타 프로세스",
				"extension-frames": "확장 프로그램 프레임",
				workbench: "Workbench"
			}
		},
		paused: {
			title: "{{name}} 일시 중지됨",
			body: "성능 모니터에서 일시 중지했습니다. 재개할 때까지 뷰는 언로드된 상태로 유지됩니다."
		}
	},
	appearance: {
		title: "모양",
		description: "Prompt Studio의 모양을 선택합니다. Alt+Shift+T로도 테마를 바꿀 수 있습니다.",
		theme: "테마",
		themeHelper: "모든 프로젝트에 적용됩니다.",
		openRelatedResources: "관련 리소스 열기",
		openRelatedResourcesHelper: "각 유형의 최근 관련 리소스를 고정되지 않은 미리보기로 자동으로 엽니다."
	},
	connectionStatus: {
		description: "상태 표시줄에 백엔드 연결 상태를 표시합니다.",
		enable: "연결 상태 표시",
		saveError: "연결 상태 표시를 변경하지 못했습니다."
	},
	updates: {
		title: "업데이트 채널",
		description: "이 앱이 업데이트할 빌드를 선택합니다. 이 설정은 이 기기에만 적용됩니다.",
		channel: "채널",
		loading: "불러오는 중…",
		stable: "안정 버전",
		stableHelper: "출시된 버전입니다. 권장.",
		nightly: "나이틀리",
		nightlyHelper: "최신 main 브랜치로 만든 서명된 빌드로, 하루에 한 번 게시됩니다. 버그가 있을 수 있으며 데이터에 새 데이터베이스 마이그레이션을 실행합니다.",
		switchBackNote: "안정 버전으로 되돌려도 더 새로운 안정 버전이 나올 때까지 이 버전을 유지합니다.",
		currentVersion: "현재 버전",
		saveError: "업데이트 채널을 변경하지 못했습니다."
	}
}, Ge = {
	browserSignIn: {
		title: "请从终端打开 Prompt Studio",
		description: "此浏览器尚未登录。在终端中运行此命令，即可打开已登录的仪表板。"
	},
	connection: {
		lost: "与服务器的连接已断开，正在自动重新连接。",
		connected: "已连接到后端。",
		unavailable: "后端不可用"
	}
}, Ke = {
	title: "项目",
	loading: "加载项目中...",
	chatInput: {
		agent: {
			selectLabel: "选择 Harness",
			unknown: "没有可用的 Harness",
			loading: "正在加载 Harness..."
		},
		model: {
			selectLabel: "选择模型",
			none: "无模型",
			noneAvailable: "暂无可用模型",
			loading: "加载模型中..."
		}
	},
	projectSettings: {
		machineTokens: {
			title: "机器令牌",
			description: "为此项目中的指定自动化命令签发有过期时间的凭据。",
			issuedTitle: "立即复制此令牌",
			issuedDescription: "原始令牌只显示一次，之后无法恢复。",
			copy: "复制",
			issueTitle: "签发令牌",
			name: "所有者和用途",
			scopes: "允许的命令 ID",
			scopesHint: "每行输入一个已启用自动化的确切命令 ID。",
			expiry: "有效天数",
			issue: "签发令牌",
			issueFailed: "无法签发机器令牌",
			activeTitle: "有效令牌",
			empty: "没有有效的机器令牌。",
			expires: "到期时间：{{date}}",
			revoke: "撤销"
		},
		extensionsPanel: {
			empty: "此项目未安装任何扩展。",
			loadError: "加载扩展失败。",
			title: "扩展",
			searchPlaceholder: "搜索扩展…",
			installedGroup: "已安装 · {{count}}",
			noSearchResults: "没有与\"{{query}}\"匹配的扩展。",
			noDescription: "未提供描述。",
			scope: {
				repo: "repo",
				global: "共享"
			},
			status: { error: "加载失败" },
			health: {
				triggerAriaLabel: "显示 {{name}} 的问题",
				failedToLoad: "加载失败",
				incompatibleVersions: "版本不兼容",
				issues_one: "{{count}} 个问题",
				issues_other: "{{count}} 个问题",
				lastLoaded: "上次加载于 {{time}}",
				unknownError: "扩展加载失败。",
				copyError: "复制错误",
				errorCopied: "错误已复制"
			},
			upgrade: {
				action: "升级",
				succeeded: "扩展已升级",
				current: "扩展已是最新",
				failed: "扩展升级失败"
			},
			upgradeAll: {
				action: "全部升级",
				succeeded_other: "已升级 {{count}} 个扩展",
				failed_other: "{{count}} 个扩展升级失败"
			},
			reload: {
				action: "重新加载",
				hint: "源文件夹已更改。重新加载以使用新版本。",
				succeeded: "已加载本地更改",
				failed: "本地更改被拒绝"
			},
			dropZone: {
				title: "将扩展文件夹拖放到此处",
				hint: "主机将按扩展声明的范围安装。",
				uploading: "正在添加 {{name}}…",
				succeeded: "已添加 {{name}}",
				failed: "无法添加扩展文件夹",
				notFolder: "请拖放文件夹，而不是文件。"
			},
			automations: {
				title: "自动化",
				toggleAriaLabel: "切换自动化 {{name}}",
				listStatus: "{{count}} 个自动化中已启用 {{enabled}} 个",
				cron: "cron {{cron}}",
				stateOn: "开",
				stateOff: "关"
			},
			connections: {
				title: "连接",
				description: "将此扩展连接到远程服务。凭据保留在 Prompt Studio 主机中。",
				endpoint: "端点",
				credential: "凭据",
				credentialUnchanged: "留空以保留当前凭据",
				credentialRequired: "输入凭据",
				connected: "已认证",
				notConnected: "未连接",
				lastCheckOk: "上次检查通过 ({{status}})",
				lastCheckFailed: "上次检查失败 ({{status}})",
				connect: "连接",
				reconnect: "重新连接",
				check: "检查",
				revoke: "撤销",
				saved: "连接已保存",
				actionFailed: "连接操作失败"
			},
			detail: {
				back: "扩展",
				sourcePath: "源文件夹",
				tabs: {
					settings: "设置",
					contributions: "贡献"
				},
				noContributions: "此扩展未声明任何贡献。",
				noSettings: "此扩展未声明任何设置。",
				dangerZone: "危险区域",
				deleteHint: "删除此扩展的文件并将其从项目中移除。",
				copyCommand: "复制命令",
				contributionKinds: {
					harnesses: "Harness",
					commands: "命令",
					modes: "模式",
					views: "视图",
					placements: "布局位置",
					menuContributions: "菜单项",
					settingsPanels: "设置面板",
					skills: "技能",
					templates: "模板",
					themes: "主题",
					navigationItems: "导航项",
					commandPaletteResources: "命令面板资源"
				},
				deleteHintShared: "删除此扩展的文件。它将从所有使用它的项目中移除。"
			},
			toggleAriaLabel: "切换 {{name}}",
			toggleErrorTitle: "更新扩展失败",
			toggleError: "更新扩展失败。请重试。",
			delete: "删除扩展",
			deleteErrorTitle: "删除扩展失败",
			deleteError: "删除扩展失败。请重试。",
			deleteConfirm: {
				headline: "删除扩展？",
				notification: "这将删除\"{{name}}\"的扩展文件并将其从项目中移除。其存储的数据会保留，重新安装后可恢复。",
				deleteDataLabel: "同时删除此扩展的数据（无法撤销）",
				button: "删除",
				notificationShared: "这将删除\"{{name}}\"的扩展文件并将其从所有使用它的项目中移除。其存储的数据会保留，重新安装后可恢复。"
			},
			enabledInProject: "在此项目中启用",
			replace: {
				title: "替换 {{name}}？",
				message: "这将替换已安装的文件。使用此扩展的其他项目也会使用新文件。",
				action: "替换"
			}
		}
	},
	list: {
		settings: "设置",
		createProject: "创建项目",
		noProjectsYet: "暂无项目",
		noProjectsDescription: "创建您的第一个项目以开始使用。"
	}
}, qe = {
	runtimeSettings: {
		title: "运行时设置",
		description: "配置会话队列调度使用的全局并发值。",
		save: "保存",
		saveSuccess: "运行时设置已保存",
		saveError: "运行时设置保存失败",
		loadError: "运行时设置加载失败",
		loadErrorDescription: "请重试后再编辑此设置。",
		retry: "重试",
		maxConcurrentSessions: {
			label: "最大并发会话数",
			helper: "留空表示不限制会话数。对于一次只能运行一个会话的本地 LLM 设置，请设为 1。",
			placeholder: "none",
			none: "无",
			current: "当前值：{{value}}",
			invalid: "请输入大于 0 的整数，或留空表示无。"
		}
	},
	agentRow: {
		failedToSetDefaultHarness: "无法设置默认 Harness",
		failedToSetDefaultModel: "无法设置默认模型"
	},
	betaFeatures: {
		title: "测试版功能",
		description: "试用测试版功能。此设置适用于连接到此安装实例的所有项目和仪表板。",
		notifications: "通知",
		machineTokens: "机器令牌",
		loading: "正在加载设置…"
	},
	developerTools: {
		title: "开发者工具",
		description: "用于检查此应用运行情况的工具。这些设置仅保存在此设备上。"
	},
	performance: {
		settings: {
			description: "测量此应用的帧率、CPU 和慢帧。关闭时不会测量任何内容。测量数据仅保存在此设备上，绝不会上传。",
			enable: "启用性能监控",
			helperDesktopOn: "已在此设备上开启。在状态栏中显示帧率。每 2 秒采样一次，保留最近 30 秒的数据。",
			helperBrowserOn: "已在此浏览器中开启。在状态栏中显示帧率，并在此标签页打开期间记录慢帧。",
			saveError: "无法更改性能监控。"
		},
		popover: {
			title: "性能",
			statusLabel: "帧率 {{fps}} fps。显示性能详情。",
			avgMin: "平均 {{avg}} · 最低 {{min}}",
			ago: "30 秒前",
			now: "现在",
			cpu: "CPU",
			window: "最近 30 秒",
			workbench: "Workbench",
			workbenchDetail: "此窗口",
			views_one: "{{count}} 个视图",
			views_other: "{{count}} 个视图",
			paused: "已暂停 · 视图已卸载",
			pause: "暂停 {{name}}",
			pauseTooltip: "暂停 {{name}} · 卸载其视图",
			resume: "恢复",
			resumeLabel: "恢复 {{name}}",
			more_one: "另外 {{count}} 个扩展",
			more_other: "另外 {{count}} 个扩展",
			fewer: "仅显示占用最高的 {{count}} 个",
			cpuUnavailableTitle: "无法读取 CPU。",
			cpuUnavailableBody: "帧率仍在更新。暂停功能仍可使用。",
			browserTitle: "CPU 在桌面应用中测量",
			browserBody: "浏览器标签页无法读取 CPU。暂停功能仍可使用。",
			sustainedTitle: "CPU 持续偏高",
			sustainedBody: "{{process}} 在最近 {{seconds}} 秒内平均占用 {{cpu}} CPU。",
			unknownExtension: "未知扩展",
			roles: {
				main: "应用",
				gpu: "GPU",
				utility: "实用工具进程",
				startup: "启动窗口",
				renderer: "渲染器",
				other: "其他进程",
				"extension-frames": "扩展框架",
				workbench: "Workbench"
			}
		},
		paused: {
			title: "{{name}} 已暂停",
			body: "已从性能监视器暂停。在恢复之前，其视图将保持卸载状态。"
		}
	},
	appearance: {
		title: "外观",
		description: "选择 Prompt Studio 的外观。也可以按 Alt+Shift+T 更改主题。",
		theme: "主题",
		themeHelper: "适用于所有项目。",
		openRelatedResources: "打开相关资源",
		openRelatedResourcesHelper: "自动以未固定的预览打开每种类型的最近相关资源。"
	},
	connectionStatus: {
		description: "在状态栏中显示后端连接状态。",
		enable: "显示连接状态",
		saveError: "无法更改连接状态显示。"
	},
	updates: {
		title: "更新渠道",
		description: "选择此应用要更新到哪种构建。此设置仅适用于此设备。",
		channel: "渠道",
		loading: "正在加载…",
		stable: "稳定版",
		stableHelper: "已发布的版本。推荐。",
		nightly: "每日构建版",
		nightlyHelper: "基于最新 main 分支的已签名构建，每天发布一次。可能存在问题，并会对你的数据运行新的数据库迁移。",
		switchBackNote: "切换回稳定版后，会保留当前版本，直到有更新的稳定版发布。",
		currentVersion: "当前版本",
		saveError: "无法更改更新渠道。"
	}
}, Je = {
	browserSignIn: {
		title: "請從終端機開啟 Prompt Studio",
		description: "此瀏覽器尚未登入。在終端機中執行此命令，即可開啟已登入的儀表板。"
	},
	connection: {
		lost: "與伺服器的連線已中斷，正在自動重新連線。",
		connected: "已連線至後端。",
		unavailable: "後端無法使用"
	}
}, Ye = {
	title: "專案",
	loading: "載入專案中...",
	chatInput: {
		agent: {
			selectLabel: "選擇 Harness",
			unknown: "沒有可用的 Harness",
			loading: "正在載入 Harness..."
		},
		model: {
			selectLabel: "選擇模型",
			none: "無模型",
			noneAvailable: "暫無可用模型",
			loading: "載入模型中..."
		}
	},
	projectSettings: {
		machineTokens: {
			title: "機器權杖",
			description: "為此專案中的指定自動化命令簽發有到期時間的憑證。",
			issuedTitle: "立即複製此權杖",
			issuedDescription: "原始權杖只顯示一次，之後無法復原。",
			copy: "複製",
			issueTitle: "簽發權杖",
			name: "擁有者和用途",
			scopes: "允許的命令 ID",
			scopesHint: "每行輸入一個已啟用自動化的確切命令 ID。",
			expiry: "有效天數",
			issue: "簽發權杖",
			issueFailed: "無法簽發機器權杖",
			activeTitle: "有效權杖",
			empty: "沒有有效的機器權杖。",
			expires: "到期時間：{{date}}",
			revoke: "撤銷"
		},
		extensionsPanel: {
			empty: "此專案未安裝任何擴充功能。",
			loadError: "載入擴充功能失敗。",
			title: "擴充功能",
			searchPlaceholder: "搜尋擴充功能…",
			installedGroup: "已安裝 · {{count}}",
			noSearchResults: "沒有符合\"{{query}}\"的擴充功能。",
			noDescription: "未提供描述。",
			scope: {
				repo: "repo",
				global: "共用"
			},
			status: { error: "載入失敗" },
			health: {
				triggerAriaLabel: "顯示 {{name}} 的問題",
				failedToLoad: "載入失敗",
				incompatibleVersions: "版本不相容",
				issues_one: "{{count}} 個問題",
				issues_other: "{{count}} 個問題",
				lastLoaded: "上次載入於 {{time}}",
				unknownError: "擴充功能載入失敗。",
				copyError: "複製錯誤",
				errorCopied: "錯誤已複製"
			},
			upgrade: {
				action: "升級",
				succeeded: "擴充功能已升級",
				current: "擴充功能已是最新",
				failed: "擴充功能升級失敗"
			},
			upgradeAll: {
				action: "全部升級",
				succeeded_other: "已升級 {{count}} 個擴充功能",
				failed_other: "{{count}} 個擴充功能升級失敗"
			},
			reload: {
				action: "重新載入",
				hint: "來源資料夾已變更。重新載入以使用新版本。",
				succeeded: "已載入本機變更",
				failed: "本機變更遭拒絕"
			},
			dropZone: {
				title: "將擴充功能資料夾拖放到這裡",
				hint: "主機會按擴充功能宣告的範圍安裝。",
				uploading: "正在新增 {{name}}…",
				succeeded: "已新增 {{name}}",
				failed: "無法新增擴充功能資料夾",
				notFolder: "請拖放資料夾，而非檔案。"
			},
			automations: {
				title: "自動化",
				toggleAriaLabel: "切換自動化 {{name}}",
				listStatus: "{{count}} 個自動化中已啟用 {{enabled}} 個",
				cron: "cron {{cron}}",
				stateOn: "開",
				stateOff: "關"
			},
			connections: {
				title: "連線",
				description: "將此擴充功能連線到遠端服務。憑證保留在 Prompt Studio 主機中。",
				endpoint: "端點",
				credential: "憑證",
				credentialUnchanged: "留空以保留目前的憑證",
				credentialRequired: "輸入憑證",
				connected: "已驗證",
				notConnected: "未連線",
				lastCheckOk: "上次檢查通過 ({{status}})",
				lastCheckFailed: "上次檢查失敗 ({{status}})",
				connect: "連線",
				reconnect: "重新連線",
				check: "檢查",
				revoke: "撤銷",
				saved: "連線已儲存",
				actionFailed: "連線操作失敗"
			},
			detail: {
				back: "擴充功能",
				sourcePath: "來源資料夾",
				tabs: {
					settings: "設定",
					contributions: "貢獻"
				},
				noContributions: "此擴充功能未宣告任何貢獻。",
				noSettings: "此擴充功能未宣告任何設定。",
				dangerZone: "危險區域",
				deleteHint: "刪除此擴充功能的檔案並將其從專案中移除。",
				copyCommand: "複製命令",
				contributionKinds: {
					harnesses: "Harness",
					commands: "命令",
					modes: "模式",
					views: "檢視",
					placements: "配置",
					menuContributions: "選單項目",
					settingsPanels: "設定面板",
					skills: "技能",
					templates: "範本",
					themes: "主題",
					navigationItems: "導覽項目",
					commandPaletteResources: "命令面板資源"
				},
				deleteHintShared: "刪除此擴充功能的檔案。它將從所有使用它的專案中移除。"
			},
			toggleAriaLabel: "切換 {{name}}",
			toggleErrorTitle: "更新擴充功能失敗",
			toggleError: "更新擴充功能失敗。請再試一次。",
			delete: "刪除擴充功能",
			deleteErrorTitle: "刪除擴充功能失敗",
			deleteError: "刪除擴充功能失敗。請再試一次。",
			deleteConfirm: {
				headline: "要刪除擴充功能嗎？",
				notification: "這將刪除\"{{name}}\"的擴充功能檔案並將其從專案中移除。其儲存的資料會保留，重新安裝後即可還原。",
				deleteDataLabel: "同時刪除此擴充功能的資料（無法復原）",
				button: "刪除",
				notificationShared: "這將刪除\"{{name}}\"的擴充功能檔案並將其從所有使用它的專案中移除。其儲存的資料會保留，重新安裝後即可還原。"
			},
			enabledInProject: "在此專案中啟用",
			replace: {
				title: "取代 {{name}}？",
				message: "這將取代已安裝的檔案。使用此擴充功能的其他專案也會使用新檔案。",
				action: "取代"
			}
		}
	},
	list: {
		settings: "設定",
		createProject: "建立專案",
		noProjectsYet: "尚無專案",
		noProjectsDescription: "建立您的第一個專案以開始使用。"
	}
}, Xe = {
	runtimeSettings: {
		title: "執行階段設定",
		description: "設定工作階段佇列排程使用的全域並行值。",
		save: "儲存",
		saveSuccess: "執行階段設定已儲存",
		saveError: "無法儲存執行階段設定",
		loadError: "無法載入執行階段設定",
		loadErrorDescription: "請重試後再編輯此設定。",
		retry: "重試",
		maxConcurrentSessions: {
			label: "最大並行工作階段數",
			helper: "留空表示不限制工作階段。對於一次只能執行一個工作階段的本機 LLM 設定，請設為 1。",
			placeholder: "none",
			none: "無",
			current: "目前值：{{value}}",
			invalid: "請輸入大於 0 的整數，或留空表示無。"
		}
	},
	agentRow: {
		failedToSetDefaultHarness: "無法設定預設 Harness",
		failedToSetDefaultModel: "無法設定預設模型"
	},
	betaFeatures: {
		title: "測試版功能",
		description: "試用測試版功能。此設定適用於連線到此安裝執行個體的所有專案和儀表板。",
		notifications: "通知",
		machineTokens: "機器權杖",
		loading: "正在載入設定…"
	},
	developerTools: {
		title: "開發者工具",
		description: "用於檢查此應用程式執行情況的工具。這些設定只會儲存在此裝置上。"
	},
	performance: {
		settings: {
			description: "測量此應用程式的影格率、CPU 和慢速影格。關閉時不會測量任何內容。測量資料只保留在此裝置上，絕不會上傳。",
			enable: "啟用效能監控",
			helperDesktopOn: "已在此裝置上開啟。在狀態列中顯示影格率。每 2 秒取樣一次，保留最近 30 秒的資料。",
			helperBrowserOn: "已在此瀏覽器中開啟。在狀態列中顯示影格率，並在此分頁開啟期間記錄慢速影格。",
			saveError: "無法變更效能監控。"
		},
		popover: {
			title: "效能",
			statusLabel: "影格率 {{fps}} fps。顯示效能詳細資訊。",
			avgMin: "平均 {{avg}} · 最低 {{min}}",
			ago: "30 秒前",
			now: "現在",
			cpu: "CPU",
			window: "最近 30 秒",
			workbench: "Workbench",
			workbenchDetail: "此視窗",
			views_one: "{{count}} 個檢視",
			views_other: "{{count}} 個檢視",
			paused: "已暫停 · 檢視已卸載",
			pause: "暫停 {{name}}",
			pauseTooltip: "暫停 {{name}} · 卸載其檢視",
			resume: "繼續",
			resumeLabel: "繼續 {{name}}",
			more_one: "另外 {{count}} 個擴充功能",
			more_other: "另外 {{count}} 個擴充功能",
			fewer: "僅顯示佔用最高的 {{count}} 個",
			cpuUnavailableTitle: "無法讀取 CPU。",
			cpuUnavailableBody: "影格率仍會更新。暫停功能仍可使用。",
			browserTitle: "CPU 在桌面應用程式中測量",
			browserBody: "瀏覽器分頁無法讀取 CPU。暫停功能仍可使用。",
			sustainedTitle: "CPU 持續偏高",
			sustainedBody: "{{process}} 在最近 {{seconds}} 秒內平均使用 {{cpu}} CPU。",
			unknownExtension: "未知的擴充功能",
			roles: {
				main: "應用程式",
				gpu: "GPU",
				utility: "公用程式處理程序",
				startup: "啟動視窗",
				renderer: "轉譯器",
				other: "其他處理程序",
				"extension-frames": "擴充功能框架",
				workbench: "Workbench"
			}
		},
		paused: {
			title: "{{name}} 已暫停",
			body: "已從效能監視器暫停。在繼續之前，其檢視會保持卸載狀態。"
		}
	},
	appearance: {
		title: "外觀",
		description: "選擇 Prompt Studio 的外觀。也可以按 Alt+Shift+T 變更主題。",
		theme: "主題",
		themeHelper: "套用至所有專案。",
		openRelatedResources: "開啟相關資源",
		openRelatedResourcesHelper: "自動以未釘選的預覽開啟每種類型的最近相關資源。"
	},
	connectionStatus: {
		description: "在狀態列中顯示後端連線狀態。",
		enable: "顯示連線狀態",
		saveError: "無法變更連線狀態顯示。"
	},
	updates: {
		title: "更新通道",
		description: "選擇此應用程式要更新到哪種組建。此設定僅適用於此裝置。",
		channel: "通道",
		loading: "正在載入…",
		stable: "穩定版",
		stableHelper: "已發布的版本。建議使用。",
		nightly: "每日組建版",
		nightlyHelper: "根據最新 main 分支建立的已簽署組建，每天發布一次。可能有錯誤，並會對你的資料執行新的資料庫遷移。",
		switchBackNote: "切換回穩定版後，會保留目前版本，直到有更新的穩定版發布。",
		currentVersion: "目前版本",
		saveError: "無法變更更新通道。"
	}
}, $ = (e, t, n) => ({
	common: e,
	projects: t,
	settings: n
}), Ze = {
	en: $(Ae, je, Me),
	es: $(Ne, Pe, Fe),
	fr: $(Ie, Le, Re),
	ja: $(ze, Be, Ve),
	ko: $(He, Ue, We),
	"zh-Hans": $(Ge, Ke, qe),
	"zh-Hant": $(Je, Ye, Xe)
};
// packages/pstdio-dashboard/src/i18n/config.ts
W.use(Oe).use(fe).init({
	resources: Ze,
	fallbackLng: {
		"zh-TW": ["zh-Hant"],
		"zh-HK": ["zh-Hant"],
		"zh-MO": ["zh-Hant"],
		zh: ["zh-Hans"],
		default: ["en"]
	},
	defaultNS: "common",
	fallbackNS: "common",
	debug: !1,
	supportedLngs: [
		...ke,
		"zh",
		"zh-TW",
		"zh-HK",
		"zh-MO"
	],
	nonExplicitSupportedLngs: !0,
	load: "all",
	interpolation: { escapeValue: !1 },
	react: { useSuspense: !1 },
	detection: {
		order: ["navigator", "htmlTag"],
		caches: []
	}
});
var Qe = W;
export { Qe as t };
