// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import * as e from "react";
import { useLayoutEffect as t, useState as n } from "react";
import { flushSync as r } from "react-dom";
// node_modules/.bun/@tanstack+virtual-core@3.17.7/node_modules/@tanstack/virtual-core/dist/esm/lazy-measurements.js
function i(e, t, n) {
	let r = Array(e);
	return new Proxy(r, { get(r, i, a) {
		if (typeof i == "string") {
			let a = i.charCodeAt(0);
			if (a >= 48 && a <= 57) {
				let a = +i;
				if (Number.isInteger(a) && a >= 0 && a < e) {
					let e = r[a];
					if (!e) {
						let i = t[a * 2];
						e = r[a] = {
							index: a,
							key: n(a),
							start: i,
							size: t[a * 2 + 1],
							end: i + t[a * 2 + 1],
							lane: 0
						};
					}
					return e;
				}
			}
			if (i === "length") return e;
		}
		return Reflect.get(r, i, a);
	} });
}
// node_modules/.bun/@tanstack+virtual-core@3.17.7/node_modules/@tanstack/virtual-core/dist/esm/utils.js
function a(e, t, n) {
	let r = n.initialDeps ?? [], i, a = !0;
	function o() {
		let o = e();
		return (o.length !== r.length || o.some((e, t) => r[t] !== e)) && (r = o, i = t(...o), n?.onChange && !(a && n.skipInitialOnChange) && n.onChange(i), a = !1), i;
	}
	return o.updateDeps = (e) => {
		r = e;
	}, o;
}
function o(e, t) {
	if (e === void 0) throw Error(`Unexpected undefined${t ? `: ${t}` : ""}`);
	return e;
}
var s = (e, t) => Math.abs(e - t) < 1.01, c = (e, t, n) => {
	let r;
	return function(...i) {
		e.clearTimeout(r), r = e.setTimeout(() => t.apply(this, i), n);
	};
}, l, u = () => {
	if (l !== void 0) return l;
	if (typeof navigator > "u") return l = !1;
	if (/iP(hone|od|ad)/.test(navigator.userAgent)) return l = !0;
	let e = navigator.maxTouchPoints;
	return l = navigator.platform === "MacIntel" && e !== void 0 && e > 0;
}, d = (e) => {
	let { offsetWidth: t, offsetHeight: n } = e;
	return {
		width: t,
		height: n
	};
}, f = (e) => e, p = (e) => {
	let t = Math.max(e.startIndex - e.overscan, 0), n = Math.min(e.endIndex + e.overscan, e.count - 1) - t + 1, r = Array(n);
	for (let e = 0; e < n; e++) r[e] = t + e;
	return r;
}, m = (e, t) => {
	let n = e.scrollElement;
	if (!n) return;
	let r = e.targetWindow;
	if (!r) return;
	let i = (e) => {
		let { width: n, height: r } = e;
		t({
			width: Math.round(n),
			height: Math.round(r)
		});
	};
	if (i(d(n)), !r.ResizeObserver) return () => {};
	let a = new r.ResizeObserver((t) => {
		let r = () => {
			let e = t[0];
			if (e?.borderBoxSize) {
				let t = e.borderBoxSize[0];
				if (t) {
					i({
						width: t.inlineSize,
						height: t.blockSize
					});
					return;
				}
			}
			i(d(n));
		};
		e.options.useAnimationFrameWithResizeObserver ? requestAnimationFrame(r) : r();
	});
	return a.observe(n, { box: "border-box" }), () => {
		a.unobserve(n);
	};
}, h = { passive: !0 }, g = typeof window > "u" || "onscrollend" in window, _ = (e, t, n) => {
	let r = e.scrollElement;
	if (!r) return;
	let i = e.targetWindow;
	if (!i) return;
	let a = e.options.useScrollendEvent && g, o = 0, s = a ? null : c(i, () => t(o, !1), e.options.isScrollingResetDelay), l = (e) => () => {
		o = n(r), s?.(), t(o, e);
	}, u = l(!0), d = l(!1);
	return r.addEventListener("scroll", u, h), a && r.addEventListener("scrollend", d, h), () => {
		r.removeEventListener("scroll", u), a && r.removeEventListener("scrollend", d);
	};
}, v = (e, t) => _(e, t, (t) => {
	let { horizontal: n, isRtl: r } = e.options;
	return n ? t.scrollLeft * (r && -1 || 1) : t.scrollTop;
}), y = (e, t, n) => {
	if (n.options.useCachedMeasurements) {
		let t = n.indexFromElement(e), r = n.options.getItemKey(t);
		return n.itemSizeCache.get(r) ?? n.options.estimateSize(t);
	}
	if (t?.borderBoxSize) {
		let e = t.borderBoxSize[0];
		if (e) return Math.round(e[n.options.horizontal ? "inlineSize" : "blockSize"]);
	}
	if (!t) {
		let t = n.indexFromElement(e), r = n.options.getItemKey(t), i = n.itemSizeCache.get(r);
		if (i !== void 0) return i;
	}
	return e[n.options.horizontal ? "offsetWidth" : "offsetHeight"];
}, b = (e, { adjustments: t = 0, behavior: n }, r) => {
	var i, a;
	(a = (i = r.scrollElement)?.scrollTo) == null || a.call(i, {
		[r.options.horizontal ? "left" : "top"]: e + t,
		behavior: n
	});
}, x = class {
	constructor(e) {
		this.unsubs = [], this.scrollElement = null, this.targetWindow = null, this.isScrolling = !1, this.scrollState = null, this.measurementsCache = [], this._flatMeasurements = null, this.itemSizeCache = /* @__PURE__ */ new Map(), this.itemSizeCacheVersion = 0, this.laneAssignments = /* @__PURE__ */ new Map(), this.pendingMin = null, this.prevLanes = void 0, this.lanesChangedFlag = !1, this.lanesSettling = !1, this.pendingScrollAnchor = null, this.scrollRect = null, this.scrollOffset = null, this.scrollDirection = null, this.scrollAdjustments = 0, this._iosDeferredAdjustment = 0, this._iosTouching = !1, this._iosJustTouchEnded = !1, this._iosTouchEndTimerId = null, this._intendedScrollOffset = null, this.elementsCache = /* @__PURE__ */ new Map(), this.now = () => {
			var e;
			return ((e = this.targetWindow?.performance)?.now)?.call(e) ?? Date.now();
		}, this.observer = /* @__PURE__ */ (() => {
			let e = null, t = () => e || (!this.targetWindow || !this.targetWindow.ResizeObserver ? null : e = new this.targetWindow.ResizeObserver((e) => {
				e.forEach((e) => {
					let t = () => {
						let t = e.target, n = this.indexFromElement(t);
						if (t.isConnected) this.shouldMeasureDuringScroll(n) && this.resizeItem(n, this.options.measureElement(t, e, this));
						else {
							this.observer.unobserve(t);
							for (let [e, n] of this.elementsCache) if (n === t) {
								this.elementsCache.delete(e);
								break;
							}
						}
					};
					this.options.useAnimationFrameWithResizeObserver ? requestAnimationFrame(t) : t();
				});
			}));
			return {
				disconnect: () => {
					var n;
					(n = t()) == null || n.disconnect(), e = null;
				},
				observe: (e) => t()?.observe(e, { box: "border-box" }),
				unobserve: (e) => t()?.unobserve(e)
			};
		})(), this.range = null, this.setOptions = (e) => {
			let t = {
				debug: !1,
				initialOffset: 0,
				overscan: 1,
				paddingStart: 0,
				paddingEnd: 0,
				scrollPaddingStart: 0,
				scrollPaddingEnd: 0,
				horizontal: !1,
				getItemKey: f,
				rangeExtractor: p,
				onChange: () => {},
				measureElement: y,
				initialRect: {
					width: 0,
					height: 0
				},
				scrollMargin: 0,
				gap: 0,
				indexAttribute: "data-index",
				initialMeasurementsCache: [],
				lanes: 1,
				anchorTo: "start",
				followOnAppend: !1,
				scrollEndThreshold: 1,
				isScrollingResetDelay: 150,
				enabled: !0,
				isRtl: !1,
				useScrollendEvent: !1,
				useAnimationFrameWithResizeObserver: !1,
				laneAssignmentMode: "estimate",
				useCachedMeasurements: !1
			};
			for (let n in e) {
				let r = e[n];
				r !== void 0 && (t[n] = r);
			}
			let n = this.options, r = null, i = null, a = !1;
			if (n !== void 0 && n.enabled && t.enabled && t.anchorTo === "end" && this.scrollElement !== null) {
				let e = n.count, o = t.count, s = this.getMeasurements(), c = e > 0 ? s[0]?.key ?? n.getItemKey(0) : null, l = e > 0 ? s[e - 1]?.key ?? n.getItemKey(e - 1) : null;
				if (o !== e || e > 0 && o > 0 && (t.getItemKey(0) !== c || t.getItemKey(o - 1) !== l)) {
					a = !0;
					let c = e > 0 ? this.getVirtualItemForOffset(this.getScrollOffset()) ?? s[0] : null;
					c && (r = [c.key, this.getScrollOffset() - c.start]);
					let u = t.followOnAppend === !0 ? "auto" : t.followOnAppend || null;
					u && o > e && this.isAtEnd(n.scrollEndThreshold) && (e === 0 || t.getItemKey(o - 1) !== l) && (i = u);
				}
			}
			this.options = t, a && (this.pendingMin = 0, this.itemSizeCacheVersion++);
			let o = !1, s = 0;
			if (r && this.scrollOffset !== null) {
				let [e, t] = r, n = this.getMeasurements(), { count: i, getItemKey: a } = this.options, c = 0;
				for (; c < i && a(c) !== e;) c++;
				if (c < i) {
					let e = n[c];
					if (e) {
						let n = Math.max(0, e.start + t);
						n !== this.scrollOffset && (s = n - this.scrollOffset, this.scrollOffset = n, o = !0);
					}
				}
			}
			(o || i) && (this.pendingScrollAnchor = [
				o ? r[0] : null,
				o ? r[1] : 0,
				i,
				s
			]);
		}, this.notify = (e) => {
			var t, n;
			(n = (t = this.options).onChange) == null || n.call(t, this, e);
		}, this.maybeNotify = a(() => (this.calculateRange(), [
			this.isScrolling,
			this.range ? this.range.startIndex : null,
			this.range ? this.range.endIndex : null
		]), (e) => {
			this.notify(e);
		}, {
			key: !1,
			debug: () => this.options.debug,
			initialDeps: [
				this.isScrolling,
				this.range ? this.range.startIndex : null,
				this.range ? this.range.endIndex : null
			]
		}), this.cleanup = () => {
			this.unsubs.filter(Boolean).forEach((e) => e()), this.unsubs = [], this.observer.disconnect(), this.rafId != null && this.targetWindow && (this.targetWindow.cancelAnimationFrame(this.rafId), this.rafId = null), this.scrollState = null, this._iosDeferredAdjustment = 0, this._iosTouching = !1, this._iosJustTouchEnded = !1, this.scrollElement = null, this.targetWindow = null;
		}, this._didMount = () => () => {
			this.cleanup();
		}, this._willUpdate = () => {
			let e = this.options.enabled ? this.options.getScrollElement() : null;
			if (this.scrollElement !== e) {
				if (this.cleanup(), !e) {
					this.maybeNotify();
					return;
				}
				if (this.scrollElement = e, this.targetWindow = this.scrollElement && "ownerDocument" in this.scrollElement ? this.scrollElement.ownerDocument.defaultView : this.scrollElement?.window ?? null, this.elementsCache.forEach((e) => {
					this.observer.observe(e);
				}), this.unsubs.push(this.options.observeElementRect(this, (e) => {
					this.scrollRect = e, this.maybeNotify();
				})), this.unsubs.push(this.options.observeElementOffset(this, (e, t) => {
					if (t && this._intendedScrollOffset === null && e === this.scrollOffset) return;
					this._intendedScrollOffset !== null && Math.abs(e - this._intendedScrollOffset) < 1.5 && (e = this._intendedScrollOffset), this._intendedScrollOffset = null, this.scrollAdjustments = 0;
					let n = this.getScrollOffset();
					this.scrollDirection = t ? n === e ? this.scrollDirection : n < e ? "forward" : "backward" : null, this.scrollOffset = e, this.isScrolling = t, this._flushIosDeferredIfReady(), this.scrollState && this.scheduleScrollReconcile(), this.maybeNotify();
				})), "addEventListener" in this.scrollElement) {
					let e = this.scrollElement, t = () => {
						this._iosTouching = !0, this._iosJustTouchEnded = !1, this._iosTouchEndTimerId !== null && this.targetWindow != null && (this.targetWindow.clearTimeout(this._iosTouchEndTimerId), this._iosTouchEndTimerId = null);
					}, n = () => {
						this._iosTouching = !1, u() && this.targetWindow != null && (this._iosJustTouchEnded = !0, this._iosTouchEndTimerId = this.targetWindow.setTimeout(() => {
							this._iosJustTouchEnded = !1, this._iosTouchEndTimerId = null, this._flushIosDeferredIfReady();
						}, 150));
					};
					e.addEventListener("touchstart", t, h), e.addEventListener("touchend", n, h), this.unsubs.push(() => {
						e.removeEventListener("touchstart", t), e.removeEventListener("touchend", n), this._iosTouchEndTimerId !== null && this.targetWindow != null && (this.targetWindow.clearTimeout(this._iosTouchEndTimerId), this._iosTouchEndTimerId = null);
					});
				}
				this._scrollToOffset(this.getScrollOffset(), {
					adjustments: void 0,
					behavior: void 0
				});
			}
			let t = this.pendingScrollAnchor;
			if (this.pendingScrollAnchor = null, t && this.scrollElement && this.options.enabled) {
				let [e, n, r, i] = t;
				e !== null && !r && (u() && (this.isScrolling || this._iosTouching || this._iosJustTouchEnded) ? i !== 0 && (this._iosDeferredAdjustment += i) : this._scrollToOffset(this.getScrollOffset(), {
					adjustments: void 0,
					behavior: void 0
				})), r && this.scrollToEnd({ behavior: r });
			}
		}, this._flushIosDeferredIfReady = () => {
			if (this._iosDeferredAdjustment === 0 || this.isScrolling || this._iosTouching || this._iosJustTouchEnded) return;
			let e = this.getScrollOffset(), t = this.getMaxScrollOffset();
			if (e < 0 || e > t) return;
			if (this._iosDeferredAdjustment < 0 && e >= t - 1) {
				this._iosDeferredAdjustment = 0;
				return;
			}
			let n = this._iosDeferredAdjustment;
			this._iosDeferredAdjustment = 0, this._scrollToOffset(e, {
				adjustments: this.scrollAdjustments += n,
				behavior: void 0
			});
		}, this.rafId = null, this.getSize = () => this.options.enabled ? (this.scrollRect = this.scrollRect ?? this.options.initialRect, this.scrollRect[this.options.horizontal ? "width" : "height"]) : (this.scrollRect = null, 0), this.getScrollOffset = () => this.options.enabled ? (this.scrollOffset = this.scrollOffset ?? (typeof this.options.initialOffset == "function" ? this.options.initialOffset() : this.options.initialOffset), this.scrollOffset) : (this.scrollOffset = null, 0), this.getMeasurementOptions = a(() => [
			this.options.count,
			this.options.paddingStart,
			this.options.scrollMargin,
			this.options.getItemKey,
			this.options.enabled,
			this.options.lanes,
			this.options.laneAssignmentMode,
			this.options.gap
		], (e, t, n, r, i, a, o, s) => (this.prevLanes !== void 0 && this.prevLanes !== a && (this.lanesChangedFlag = !0), this.prevLanes = a, this.pendingMin = null, {
			count: e,
			paddingStart: t,
			scrollMargin: n,
			getItemKey: r,
			enabled: i,
			lanes: a,
			laneAssignmentMode: o,
			gap: s
		}), { key: !1 }), this.getMeasurements = a(() => [this.getMeasurementOptions(), this.itemSizeCacheVersion], ({ count: e, paddingStart: t, scrollMargin: n, getItemKey: r, enabled: a, lanes: o, laneAssignmentMode: s, gap: c }, l) => {
			let u = this.itemSizeCache;
			if (!a) return this.measurementsCache = [], this.itemSizeCache.clear(), this.laneAssignments.clear(), [];
			if (this.laneAssignments.size > e) for (let t of this.laneAssignments.keys()) t >= e && this.laneAssignments.delete(t);
			this.lanesChangedFlag && (this.lanesChangedFlag = !1, this.lanesSettling = !0, this.measurementsCache = [], this.itemSizeCache.clear(), this.laneAssignments.clear(), this.pendingMin = null), this.measurementsCache.length === 0 && !this.lanesSettling && (this.measurementsCache = this.options.initialMeasurementsCache, this.measurementsCache.forEach((e) => {
				this.itemSizeCache.set(e.key, e.size);
			}));
			let d = this.lanesSettling ? 0 : this.pendingMin ?? 0;
			if (this.pendingMin = null, this.lanesSettling && this.measurementsCache.length === e && (this.lanesSettling = !1), o === 1) {
				let a = e * 2, o = this._flatMeasurements;
				if (!o || o.length < a) {
					let e = new Float64Array(a);
					o && d > 0 && e.set(o.subarray(0, d * 2)), o = e, this._flatMeasurements = o;
				}
				let s;
				if (d === 0) s = t + n;
				else {
					let e = d - 1;
					s = o[e * 2] + o[e * 2 + 1] + c;
				}
				for (let t = d; t < e; t++) {
					let e = r(t), n = u.get(e), i = typeof n == "number" ? n : this.options.estimateSize(t);
					o[t * 2] = s, o[t * 2 + 1] = i, s += i + c;
				}
				let l = i(e, o, r);
				return this.measurementsCache = l, l;
			}
			let f = this.measurementsCache.slice(0, d), p = Array(o).fill(void 0), m = new Float64Array(o), h = 0;
			for (let e = 0; e < d; e++) {
				let t = f[e];
				t && (p[t.lane] === void 0 && h++, p[t.lane] = e, m[t.lane] = t.end);
			}
			for (let i = d; i < e; i++) {
				let e = r(i), a = this.laneAssignments.get(i), l, d, g = s === "estimate" || u.has(e);
				if (a !== void 0 && this.options.lanes > 1) {
					l = a;
					let e = p[l], r = e === void 0 ? void 0 : f[e];
					d = r ? r.end + c : t + n;
				} else if (h === o) {
					let e = 0, t = m[0], n = p[0];
					for (let r = 1; r < o; r++) {
						let i = m[r];
						(i < t || i === t && p[r] < n) && (e = r, t = i, n = p[r]);
					}
					l = e, d = t + c, g && this.laneAssignments.set(i, l);
				} else l = i % this.options.lanes, d = t + n, g && this.laneAssignments.set(i, l);
				let _ = u.get(e), v = typeof _ == "number" ? _ : this.options.estimateSize(i), y = d + v;
				f[i] = {
					index: i,
					start: d,
					size: v,
					end: y,
					key: e,
					lane: l
				}, p[l] === void 0 && h++, p[l] = i, m[l] = y;
			}
			return this.measurementsCache = f, f;
		}, {
			key: !1,
			debug: () => this.options.debug
		}), this.calculateRange = a(() => [
			this.getMeasurements(),
			this.getSize(),
			this.getScrollOffset(),
			this.options.lanes
		], (e, t, n, r) => e.length === 0 || t === 0 ? (this.range = null, null) : (this.range = w(e, t, n, r, r === 1 && this._flatMeasurements != null ? this._flatMeasurements : null), this.range), {
			key: !1,
			debug: () => this.options.debug
		}), this.getVirtualIndexes = a(() => {
			let e = null, t = null, n = this.calculateRange();
			return n && (e = n.startIndex, t = n.endIndex), this.maybeNotify.updateDeps([
				this.isScrolling,
				e,
				t
			]), [
				this.options.rangeExtractor,
				this.options.overscan,
				this.options.count,
				e,
				t
			];
		}, (e, t, n, r, i) => r === null || i === null ? [] : e({
			startIndex: r,
			endIndex: i,
			overscan: t,
			count: n
		}), {
			key: !1,
			debug: () => this.options.debug
		}), this.indexFromElement = (e) => {
			let t = this.options.indexAttribute, n = e.getAttribute(t);
			return n ? parseInt(n, 10) : (console.warn(`Missing attribute name '${t}={index}' on measured element.`), -1);
		}, this.shouldMeasureDuringScroll = (e) => {
			if (!this.scrollState || this.scrollState.behavior !== "smooth") return !0;
			let t = this.scrollState.index ?? this.getVirtualItemForOffset(this.scrollState.lastTargetOffset)?.index;
			if (t !== void 0 && this.range) {
				let n = Math.max(this.options.overscan, Math.ceil((this.range.endIndex - this.range.startIndex) / 2)), r = Math.max(0, t - n), i = Math.min(this.options.count - 1, t + n);
				return e >= r && e <= i;
			}
			return !0;
		}, this.measureElement = (e) => {
			if (!e) {
				this.elementsCache.forEach((e, t) => {
					e.isConnected || (this.observer.unobserve(e), this.elementsCache.delete(t));
				});
				return;
			}
			let t = this.indexFromElement(e), n = this.options.getItemKey(t), r = this.elementsCache.get(n);
			r !== e && (r && this.observer.unobserve(r), this.observer.observe(e), this.elementsCache.set(n, e)), (!this.isScrolling || this.scrollState) && this.shouldMeasureDuringScroll(t) && this.resizeItem(t, this.options.measureElement(e, void 0, this));
		}, this.resizeItem = (e, t) => {
			if (e < 0 || e >= this.options.count) return;
			let n, r, i, a = this._flatMeasurements;
			if (this.options.lanes === 1 && a !== null) i = this.options.getItemKey(e), r = a[e * 2], n = a[e * 2 + 1];
			else {
				let t = this.measurementsCache[e];
				if (!t) return;
				i = t.key, r = t.start, n = t.size;
			}
			let o = this.itemSizeCache.get(i) ?? n, s = t - o;
			if (s !== 0) {
				let a = this.options.anchorTo === "end" && this.scrollState?.behavior !== "smooth" && this.getVirtualDistanceFromEnd() <= this.options.scrollEndThreshold, c = a ? this.getTotalSize() : 0, l = this.getScrollOffset() + this.scrollAdjustments, u = this.itemSizeCache.has(i) ? r + o <= l && this.scrollDirection !== "backward" : r < l, d = this.scrollState?.behavior !== "smooth" && (this.shouldAdjustScrollPositionOnItemSizeChange === void 0 ? u : this.shouldAdjustScrollPositionOnItemSizeChange(this.measurementsCache[e] ?? {
					index: e,
					key: i,
					start: r,
					size: n,
					end: r + n,
					lane: 0
				}, s, this));
				(this.pendingMin === null || e < this.pendingMin) && (this.pendingMin = e), this.itemSizeCache.set(i, t), this.itemSizeCacheVersion++;
				let f = !1;
				a ? f = this.applyScrollAdjustment(this.getTotalSize() - c) : d && (f = this.applyScrollAdjustment(s)), this.notify(f);
			}
		}, this.getVirtualItems = a(() => [this.getVirtualIndexes(), this.getMeasurements()], (e, t) => {
			let n = [];
			for (let r = 0, i = e.length; r < i; r++) {
				let i = t[e[r]];
				n.push(i);
			}
			return n;
		}, {
			key: !1,
			debug: () => this.options.debug
		}), this.getVirtualItemForOffset = (e) => {
			let t = this.getMeasurements();
			if (t.length === 0) return;
			let n = this._flatMeasurements, r = this.options.lanes === 1 && n != null;
			return o(t[S(0, t.length - 1, r ? (e) => n[e * 2] : (e) => o(t[e]).start, e)]);
		}, this.getMaxScrollOffset = () => {
			if (!this.scrollElement) return 0;
			if ("scrollHeight" in this.scrollElement) return this.options.horizontal ? this.scrollElement.scrollWidth - this.scrollElement.clientWidth : this.scrollElement.scrollHeight - this.scrollElement.clientHeight;
			{
				let e = this.scrollElement.document.documentElement;
				return this.options.horizontal ? e.scrollWidth - this.scrollElement.innerWidth : e.scrollHeight - this.scrollElement.innerHeight;
			}
		}, this.getVirtualDistanceFromEnd = () => Math.max(this.getTotalSize() - this.getSize() - this.getScrollOffset(), 0), this.getDistanceFromEnd = () => Math.max(this.getMaxScrollOffset() - this.getScrollOffset(), 0), this.isAtEnd = (e = this.options.scrollEndThreshold) => this.getDistanceFromEnd() <= e, this.getOffsetForAlignment = (e, t, n = 0) => {
			if (!this.scrollElement) return 0;
			let r = this.getSize(), i = this.getScrollOffset();
			t === "auto" && (t = e >= i + r ? "end" : "start"), t === "center" ? e += (n - r) / 2 : t === "end" && (e -= r);
			let a = this.getMaxScrollOffset();
			return Math.max(Math.min(a, e), 0);
		}, this.getOffsetForIndex = (e, t = "auto") => {
			e = Math.max(0, Math.min(e, this.options.count - 1));
			let n = this.getSize(), r = this.getScrollOffset(), i = this.measurementsCache[e];
			if (!i) return;
			if (t === "auto") {
				if (i.end >= r + n - this.options.scrollPaddingEnd) t = "end";
				else if (i.start <= r + this.options.scrollPaddingStart) t = "start";
				else return [r, t];
			}
			if (t === "end" && e === this.options.count - 1) return [this.getMaxScrollOffset(), t];
			let a = t === "end" ? i.end + this.options.scrollPaddingEnd : i.start - this.options.scrollPaddingStart;
			return [this.getOffsetForAlignment(a, t, i.size), t];
		}, this.scrollToOffset = (e, { align: t = "start", behavior: n = "auto" } = {}) => {
			this._iosDeferredAdjustment = 0;
			let r = this.getOffsetForAlignment(e, t), i = this.now();
			this.scrollState = {
				index: null,
				align: t,
				behavior: n,
				startedAt: i,
				lastTargetOffset: r,
				stableFrames: 0
			}, this._scrollToOffset(r, {
				adjustments: void 0,
				behavior: n
			}), this.scheduleScrollReconcile();
		}, this.scrollToIndex = (e, { align: t = "auto", behavior: n = "auto" } = {}) => {
			this._iosDeferredAdjustment = 0, e = Math.max(0, Math.min(e, this.options.count - 1));
			let r = this.getOffsetForIndex(e, t);
			if (!r) return;
			let [i, a] = r, o = this.now();
			this.scrollState = {
				index: e,
				align: a,
				behavior: n,
				startedAt: o,
				lastTargetOffset: i,
				stableFrames: 0
			}, this._scrollToOffset(i, {
				adjustments: void 0,
				behavior: n
			}), this.scheduleScrollReconcile();
		}, this.scrollBy = (e, { behavior: t = "auto" } = {}) => {
			let n = this.getScrollOffset() + e, r = this.now();
			this.scrollState = {
				index: null,
				align: "start",
				behavior: t,
				startedAt: r,
				lastTargetOffset: n,
				stableFrames: 0
			}, this._scrollToOffset(n, {
				adjustments: void 0,
				behavior: t
			}), this.scheduleScrollReconcile();
		}, this.scrollToEnd = ({ behavior: e = "auto" } = {}) => {
			this.options.count > 0 ? this.scrollToIndex(this.options.count - 1, {
				align: "end",
				behavior: e
			}) : this.scrollToOffset(Math.max(this.getTotalSize() - this.getSize(), 0), { behavior: e });
		}, this.getTotalSize = () => {
			let e = this.getMeasurements(), t;
			if (e.length === 0) t = this.options.paddingStart;
			else if (this.options.lanes === 1) {
				let n = e.length - 1, r = this._flatMeasurements;
				t = r == null ? e[n]?.end ?? 0 : r[n * 2] + r[n * 2 + 1];
			} else {
				let n = Array(this.options.lanes).fill(null), r = e.length - 1;
				for (; r >= 0 && n.some((e) => e === null);) {
					let t = e[r];
					n[t.lane] === null && (n[t.lane] = t.end), r--;
				}
				t = Math.max(...n.filter((e) => e !== null));
			}
			return Math.max(t - this.options.scrollMargin + this.options.paddingEnd, 0);
		}, this.takeSnapshot = () => {
			let e = [];
			if (this.itemSizeCache.size === 0) return e;
			let t = this.getMeasurements();
			for (let n of t) n && this.itemSizeCache.has(n.key) && e.push({
				index: n.index,
				key: n.key,
				start: n.start,
				size: n.size,
				end: n.end,
				lane: n.lane
			});
			return e;
		}, this._scrollToOffset = (e, { adjustments: t, behavior: n }) => {
			this._intendedScrollOffset = e + (t ?? 0), this.options.scrollToFn(e, {
				behavior: n,
				adjustments: t
			}, this);
		}, this.measure = () => {
			this.pendingMin = null, this.itemSizeCache.clear(), this.laneAssignments.clear(), this.itemSizeCacheVersion++, this.notify(!1);
		}, this.setOptions(e);
	}
	applyScrollAdjustment(e, t) {
		return e === 0 ? !1 : u() && (this.isScrolling || this._iosTouching || this._iosJustTouchEnded) ? (this._iosDeferredAdjustment += e, !1) : (this._scrollToOffset(this.getScrollOffset(), {
			adjustments: this.scrollAdjustments += e,
			behavior: t
		}), this.scrollOffset !== null && (this.scrollOffset += this.scrollAdjustments, this.scrollOffset < 0 && (this.scrollOffset = 0), this.scrollAdjustments = 0), !0);
	}
	scheduleScrollReconcile() {
		this.targetWindow ? this.rafId ??= this.targetWindow.requestAnimationFrame(() => {
			this.rafId = null, this.reconcileScroll();
		}) : this.scrollState = null;
	}
	reconcileScroll() {
		if (!this.scrollState || !this.scrollElement) return;
		if (this.now() - this.scrollState.startedAt > 5e3) {
			this.scrollState = null;
			return;
		}
		let e = this.scrollState.index == null ? void 0 : this.getOffsetForIndex(this.scrollState.index, this.scrollState.align), t = e ? e[0] : this.scrollState.lastTargetOffset, n = t !== this.scrollState.lastTargetOffset;
		if (!n && s(t, this.getScrollOffset())) {
			if (this.scrollState.stableFrames++, this.scrollState.stableFrames >= 1) {
				this.getScrollOffset() !== t && this._scrollToOffset(t, {
					adjustments: void 0,
					behavior: "auto"
				}), this.scrollState = null;
				return;
			}
		} else if (this.scrollState.stableFrames = 0, n) {
			let e = this.getSize() || 600, n = Math.abs(t - this.getScrollOffset()), r = this.scrollState.behavior === "smooth" && n > e;
			this.scrollState.lastTargetOffset = t, r || (this.scrollState.behavior = "auto"), this._scrollToOffset(t, {
				adjustments: void 0,
				behavior: r ? "smooth" : "auto"
			});
		}
		this.scheduleScrollReconcile();
	}
}, S = (e, t, n, r) => {
	for (; e <= t;) {
		let i = (e + t) / 2 | 0, a = n(i);
		if (a < r) e = i + 1;
		else if (a > r) t = i - 1;
		else return i;
	}
	return e > 0 ? e - 1 : 0;
};
function C(e, t, n) {
	let r = 0;
	for (; r <= t;) {
		let i = (r + t) / 2 | 0, a = e[i * 2];
		if (a < n) r = i + 1;
		else if (a > n) t = i - 1;
		else return i;
	}
	return r > 0 ? r - 1 : 0;
}
function w(e, t, n, r, i) {
	let a = e.length - 1;
	if (e.length <= r) return {
		startIndex: 0,
		endIndex: a
	};
	if (r === 1 && i !== null) {
		let e = C(i, a, n), r = e, o = n + t;
		for (; r < a && i[r * 2] + i[r * 2 + 1] < o;) r++;
		return {
			startIndex: e,
			endIndex: r
		};
	}
	let o = S(0, a, (t) => e[t].start, n), s = o;
	if (r === 1) for (; s < a && e[s].end < n + t;) s++;
	else if (r > 1) {
		let i = Array(r).fill(0);
		for (; s < a && i.some((e) => e < n + t);) {
			let t = e[s];
			i[t.lane] = t.end, s++;
		}
		let c = Array(r).fill(n + t);
		for (; o >= 0 && c.some((e) => e >= n);) {
			let t = e[o];
			c[t.lane] = t.start, o--;
		}
		o = Math.max(0, o - o % r), s = Math.min(a, s + (r - 1 - s % r));
	}
	return {
		startIndex: o,
		endIndex: s
	};
}
// node_modules/.bun/@tanstack+react-virtual@3.14.9+bf16f8eded5e12ee/node_modules/@tanstack/react-virtual/dist/esm/index.js
var T = typeof document < "u" ? e.useLayoutEffect : e.useEffect;
function E({ useFlushSync: t = !0, directDomUpdates: n = !1, directDomUpdatesMode: i = "transform", ...a }) {
	let o = e.useReducer((e) => e + 1, 0)[1], s = e.useRef({
		enabled: n,
		mode: i,
		container: null,
		lastSize: null,
		lastPositions: /* @__PURE__ */ new WeakMap(),
		prevRange: null
	});
	s.current.enabled = n, s.current.mode = i;
	let c = (e) => {
		let t = s.current;
		if (!t.enabled || !t.container) return;
		let n = e.getTotalSize();
		if (n !== t.lastSize) {
			t.lastSize = n;
			let r = e.options.horizontal ? "width" : "height";
			t.container.style[r] = `${n}px`;
		}
	}, l = (e) => {
		let t = s.current;
		if (!t.enabled || !t.container) return;
		c(e);
		let n = !!e.options.horizontal, r = t.mode === "transform", i = n ? "left" : "top", a = e.options.scrollMargin, o = e.getVirtualItems();
		for (let s of o) {
			let o = s.start - a, c = e.elementsCache.get(s.key);
			c && t.lastPositions.get(c) !== o && (t.lastPositions.set(c, o), r ? c.style.transform = n ? `translate3d(${o}px, 0, 0)` : `translate3d(0, ${o}px, 0)` : c.style[i] = `${o}px`);
		}
	}, u = {
		...a,
		onChange: (e, n) => {
			var i;
			let c = s.current, u = !0;
			if (c.enabled) {
				l(e);
				let t = e.range, n = c.prevRange;
				u = !n || n.isScrolling !== e.isScrolling || n.startIndex !== t?.startIndex || n.endIndex !== t?.endIndex, u && (c.prevRange = t ? {
					startIndex: t.startIndex,
					endIndex: t.endIndex,
					isScrolling: e.isScrolling
				} : null);
			}
			u && (t && n ? r(o) : o()), (i = a.onChange) == null || i.call(a, e, n);
		}
	}, [d] = e.useState(() => {
		let e = new x(u);
		return Object.assign(e, { containerRef: (t) => {
			let n = s.current;
			if (n.container = t, n.lastSize = null, t && n.enabled) {
				let r = e.getTotalSize();
				n.lastSize = r;
				let i = e.options.horizontal ? "width" : "height";
				t.style[i] = `${r}px`;
			}
		} });
	});
	return d.setOptions(u), T(() => d._didMount(), []), T(() => (c(d), d._willUpdate())), T(() => {
		l(d);
	}), d;
}
function D(e) {
	return E({
		observeElementRect: m,
		observeElementOffset: v,
		scrollToFn: b,
		...e
	});
}
// packages/ui/src/utils/use-virtualizer.ts
var O = (e) => {
	let [, r] = n(!1);
	t(() => r(!0), []);
	let i = e.measureElement ?? y, a = D({
		...e,
		measureElement: (e, t, n) => {
			if (e.getClientRects().length > 0) return i(e, t, n);
			let r = n.indexFromElement(e);
			return n.itemSizeCache.get(n.options.getItemKey(r)) ?? n.options.estimateSize(r);
		},
		useFlushSync: !1
	});
	return {
		virtualizer: a,
		virtualItems: a.getVirtualItems(),
		totalSize: a.getTotalSize(),
		measurements: a.measurementsCache
	};
};
export { p as n, O as t };
