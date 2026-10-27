// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { Badge as e, Box as t, HStack as n, SimpleGrid as r, Stack as i, Text as a } from "@chakra-ui/react";
import { jsx as o, jsxs as s } from "react/jsx-runtime";
// packages/ui/src/components/internal/performance-panel.tsx
var c = 132, l = 28, u = 60, d = (e) => e === null ? "pending" : e < 10 ? `${e.toFixed(2)} ms` : `${Math.round(e)} ms`, f = (e) => e === null ? "pending" : e < 10 ? `${e.toFixed(1)} fps` : `${Math.round(e)} fps`, p = (e) => ({
	value: null,
	averageValue: null,
	samples: [],
	startedAtMs: e,
	totalFrames: 0
}), m = () => {
	let e = performance.now();
	return window.__performancePanelFrameRate ??= p(e), window.__performancePanelFrameRate.averageValue ??= null, window.__performancePanelFrameRate.samples ??= [], window.__performancePanelFrameRate.startedAtMs ??= e, window.__performancePanelFrameRate.totalFrames ??= 0, window.__performancePanelFrameRate;
}, h = () => {
	if (typeof window > "u" || window.__performancePanelFrameRateSamplerInstalled) return;
	m(), window.__performancePanelFrameRateSamplerInstalled = !0;
	let e = 0, t = performance.now(), n = (r) => {
		let i = m();
		e += 1, i.totalFrames += 1;
		let a = r - t, o = r - i.startedAtMs;
		if (i.averageValue = o > 0 ? i.totalFrames * 1e3 / o : null, a >= 500) {
			let n = e * 1e3 / a, o = i.samples;
			o.push(n), o.length > u && o.splice(0, o.length - u), i.value = n, e = 0, t = r;
		}
		window.requestAnimationFrame(n);
	};
	window.requestAnimationFrame(n);
}, g = () => {
	if (typeof window > "u" || typeof performance > "u") return {
		framesPerSecond: null,
		averageFramesPerSecond: null,
		frameRateSamples: []
	};
	let e = window.__performancePanelFrameRate;
	return {
		framesPerSecond: e?.value ?? null,
		averageFramesPerSecond: e?.averageValue ?? null,
		frameRateSamples: e?.samples.slice(-60) ?? []
	};
}, _ = (e) => {
	if (e.length === 0) return "";
	let t = Math.max(60, ...e), n = e.length > 1 ? c / (e.length - 1) : 0;
	return e.map((e, r) => {
		let i = r * n, a = l - Math.max(0, Math.min(e, t)) / t * l;
		return `${i.toFixed(1)},${a.toFixed(1)}`;
	}).join(" ");
}, v = (e) => {
	let { label: t, value: n } = e;
	return /* @__PURE__ */ s(i, {
		gap: "0",
		children: [/* @__PURE__ */ o(a, {
			textStyle: "label/XS/regular",
			color: "fg.muted",
			children: t
		}), /* @__PURE__ */ o(a, {
			textStyle: "label/S/medium",
			color: "fg",
			fontFamily: "mono",
			children: n
		})]
	});
}, y = (e) => {
	let { samples: n } = e, r = _(n);
	return /* @__PURE__ */ o(t, {
		w: "full",
		h: "28px",
		color: "fg.info",
		children: /* @__PURE__ */ s("svg", {
			viewBox: `0 0 ${c} ${l}`,
			width: "100%",
			height: "100%",
			"aria-label": "FPS over time",
			role: "img",
			children: [/* @__PURE__ */ o("line", {
				x1: "0",
				x2: c,
				y1: 27.5,
				y2: 27.5,
				stroke: "currentColor",
				strokeOpacity: "0.18"
			}), r ? /* @__PURE__ */ o("polyline", {
				points: r,
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.5",
				vectorEffect: "non-scaling-stroke"
			}) : null]
		})
	});
}, b = (e) => {
	let { value: t, averageValue: n, samples: r } = e;
	return /* @__PURE__ */ s(i, {
		gap: "xxs",
		minW: "0",
		children: [
			/* @__PURE__ */ o(v, {
				label: "FPS",
				value: f(t)
			}),
			/* @__PURE__ */ s(a, {
				textStyle: "label/XS/regular",
				color: "fg.muted",
				fontFamily: "mono",
				children: ["Avg ", f(n)]
			}),
			/* @__PURE__ */ o(y, { samples: r })
		]
	});
}, x = (c) => {
	let { title: l = "Performance", subtitle: u, badgeLabel: d, metrics: f, framesPerSecond: p = null, averageFramesPerSecond: m = null, frameRateSamples: h = [], rootProps: g, testId: _ = "performance-panel" } = c;
	return /* @__PURE__ */ o(t, {
		flex: "1",
		minW: "420px",
		maxW: "720px",
		borderWidth: "1px",
		borderColor: "border",
		borderRadius: "sm",
		bg: "bg",
		p: "sm",
		"data-testid": _,
		...g,
		children: /* @__PURE__ */ s(i, {
			gap: "sm",
			children: [/* @__PURE__ */ s(n, {
				justify: "space-between",
				align: "center",
				children: [/* @__PURE__ */ s(i, {
					gap: "0",
					children: [/* @__PURE__ */ o(a, {
						textStyle: "label/S/medium",
						children: l
					}), /* @__PURE__ */ o(a, {
						textStyle: "label/XS/regular",
						color: "fg.muted",
						children: u
					})]
				}), /* @__PURE__ */ o(e, {
					size: "sm",
					variant: "number",
					colorPalette: "gray",
					children: d
				})]
			}), /* @__PURE__ */ s(r, {
				columns: 3,
				gap: "xs",
				children: [f.map((e) => /* @__PURE__ */ o(v, {
					label: e.label,
					value: e.value
				}, e.label)), /* @__PURE__ */ o(b, {
					value: p,
					averageValue: m,
					samples: h
				})]
			})]
		})
	});
};
export { g as i, d as n, h as r, x as t };
