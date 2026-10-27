// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, t } from "./gauge-DTjFId-E.ts";
import { t as n } from "./chevron-down-ZmPqsMG0.ts";
import { t as r } from "./chevron-up-BBUAW_oM.ts";
import { t as i } from "./pause-C8r-dHaS.ts";
import { t as a } from "./play-crlvkPMv.ts";
import { t as o } from "./puzzle-BKD3K9Fw.ts";
import { t as s } from "./useTranslation-DvWg4zeU.ts";
import { useState as c } from "react";
import { Box as l, Button as u, HStack as d, IconButton as f, Stack as p, Text as m } from "@chakra-ui/react";
import { AlertMessage as h, Tooltip as g } from "@pstdio/ui";
import { jsx as _, jsxs as v } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/performance/components/frame-rate-bars.tsx
var y = (e) => e === void 0 ? "fg.subtle" : e >= 50 ? "fg.muted" : e >= 30 ? "fg.warning" : "fg.error", b = (e) => e === void 0 ? "border" : e >= 50 ? "fg.subtle" : y(e), x = (e) => {
	let { buckets: t, count: n, height: r, width: i, gap: a } = e, o = t.slice(-n), s = [...Array(n - o.length).fill(void 0), ...o];
	return /* @__PURE__ */ _(d, {
		h: r,
		gap: a,
		alignItems: "end",
		"aria-hidden": !0,
		children: s.map((e, t) => /* @__PURE__ */ _(l, {
			w: i,
			flex: i === "auto" ? "1" : void 0,
			h: `${Math.max(8, Math.min(e ?? 0, 60) / 60 * 100)}%`,
			bg: b(e),
			borderTopRadius: "2xs"
		}, t))
	});
}, S = (e) => {
	let t = [...new Set(e.extensionFrames.map((e) => e.installedExtensionId))];
	return {
		key: e.role === "workbench" ? "workbench" : t.join(","),
		installedExtensionIds: t,
		views: e.extensionFrames.length,
		cpuPercent: e.averageCpuPercent ?? e.cpuPercent,
		memoryKiB: e.memoryKiB.workingSet,
		sustainedHighCpu: e.sustainedHighCpu,
		paused: !1
	};
}, C = (e, t, n) => {
	let r = e?.processes ?? [], i = r.find((e) => e.role === "workbench"), a = r.filter((e) => e.role === "extension-frames").map(S).filter((e) => !e.installedExtensionIds.every((e) => t.has(e))).sort((e, t) => (t.cpuPercent ?? 0) - (e.cpuPercent ?? 0)), o = new Set(a.flatMap((e) => e.installedExtensionIds)), s = [...n].filter(([e]) => !o.has(e) && !t.has(e)).map(([e, t]) => ({
		key: e,
		installedExtensionIds: [e],
		views: t,
		cpuPercent: null,
		memoryKiB: null,
		sustainedHighCpu: !1,
		paused: !1
	})), c = [...t].map((e) => ({
		key: e,
		installedExtensionIds: [e],
		views: 0,
		cpuPercent: null,
		memoryKiB: null,
		sustainedHighCpu: !1,
		paused: !0
	}));
	return {
		workbench: i ? S(i) : null,
		extensions: [
			...a,
			...s,
			...c
		]
	};
}, w = (e, t) => {
	let n = t ? e : e.slice(0, 5), r = e.slice(n.length);
	return {
		shown: n,
		hidden: r.length,
		hiddenCpuPercent: r.reduce((e, t) => e + (t.cpuPercent ?? 0), 0)
	};
}, T = (e, t) => {
	if (!t) return e;
	let n = (e) => {
		let n = t.indexOf(e.key);
		return n === -1 ? t.length : n;
	};
	return [...e].sort((e, t) => n(e) - n(t));
}, E = (e) => {
	let { title: t, detail: n } = e;
	return /* @__PURE__ */ v(d, {
		justifyContent: "space-between",
		paddingBottom: "2xs",
		children: [/* @__PURE__ */ _(m, {
			textStyle: "label/XS/caps",
			color: "fg.subtle",
			children: t
		}), n ? /* @__PURE__ */ _(m, {
			textStyle: "label/2XS",
			color: "fg.subtle",
			children: n
		}) : null]
	});
}, D = 25, O = (e) => `${Math.round(e * 1024 / 1e6)} MB`, k = (e) => `${e < 10 ? e.toFixed(1).replace(/\.0$/, "") : Math.round(e)}%`, A = (t) => {
	let { name: n, detail: r, cpuPercent: c, icon: h, paused: y, onPause: b, onResume: x } = t, { t: S } = s("settings");
	return /* @__PURE__ */ v(d, {
		gap: "xs",
		paddingY: "2xs",
		"data-testid": "performance-cpu-row",
		"data-name": n,
		children: [
			/* @__PURE__ */ _(l, {
				bg: "bg.muted",
				borderRadius: "xs",
				boxSize: "5",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				color: "fg.muted",
				opacity: y ? .5 : 1,
				flexShrink: 0,
				children: _(h === "workbench" ? e : o, { size: 12 })
			}),
			/* @__PURE__ */ v(p, {
				gap: "0",
				flex: "1",
				minW: "0",
				children: [/* @__PURE__ */ _(m, {
					textStyle: "label/S/regular",
					color: y ? "fg.muted" : void 0,
					truncate: !0,
					children: n
				}), /* @__PURE__ */ _(m, {
					textStyle: "label/2XS",
					color: "fg.subtle",
					truncate: !0,
					children: r
				})]
			}),
			c === null ? null : /* @__PURE__ */ _(m, {
				textStyle: "mono/XS",
				color: c !== null && c >= D ? "fg.warning" : "fg.muted",
				"data-testid": "performance-cpu-value",
				children: k(c)
			}),
			y && x ? /* @__PURE__ */ v(u, {
				size: "2xs",
				variant: "outline",
				"aria-label": S("performance.popover.resumeLabel", { name: n }),
				onClick: x,
				children: [/* @__PURE__ */ _(a, {}), S("performance.popover.resume")]
			}) : null,
			!y && b ? /* @__PURE__ */ _(g, {
				content: S("performance.popover.pauseTooltip", { name: n }),
				children: /* @__PURE__ */ _(f, {
					size: "2xs",
					variant: "ghost",
					"aria-label": S("performance.popover.pause", { name: n }),
					onClick: b,
					children: /* @__PURE__ */ _(i, {})
				})
			}) : null,
			!b && !x ? /* @__PURE__ */ _(l, {
				boxSize: "6",
				flexShrink: 0
			}) : null
		]
	});
}, j = (e) => {
	let { snapshot: t, error: i, paused: a, openViews: o, extensionName: l, onPause: d, onResume: f } = e, { t: g } = s("settings"), [y, b] = c(!1), x = t?.capabilities.processMetrics === !0, [S, D] = c(null), j = C(t, a, o), M = T(j.extensions, S), N = w(M, y), P = () => D((e) => e ?? M.map((e) => e.key)), F = (e) => {
		if (e.paused) return g("performance.popover.paused");
		let t = g("performance.popover.views", { count: e.views });
		return e.memoryKiB === null ? t : `${t} · ${O(e.memoryKiB)}`;
	};
	return /* @__PURE__ */ v(p, {
		gap: "0",
		onPointerEnter: P,
		onPointerLeave: () => D(null),
		onFocus: P,
		onBlur: (e) => {
			e.currentTarget.contains(e.relatedTarget) || D(null);
		},
		children: [
			/* @__PURE__ */ _(E, {
				title: g("performance.popover.cpu"),
				detail: x ? g("performance.popover.window") : void 0
			}),
			i ? /* @__PURE__ */ _(h, {
				status: "error",
				title: g("performance.popover.cpuUnavailableTitle"),
				children: g("performance.popover.cpuUnavailableBody")
			}) : null,
			t && !x ? /* @__PURE__ */ _(h, {
				status: "info",
				title: g("performance.popover.browserTitle"),
				children: g("performance.popover.browserBody")
			}) : null,
			j.workbench ? /* @__PURE__ */ _(A, {
				name: g("performance.popover.workbench"),
				detail: g("performance.popover.workbenchDetail"),
				cpuPercent: j.workbench.cpuPercent,
				icon: "workbench"
			}) : null,
			N.shown.map((e) => {
				let [t] = e.installedExtensionIds, n = e.installedExtensionIds.length === 1 ? t : void 0;
				return /* @__PURE__ */ _(A, {
					name: e.installedExtensionIds.map(l).join(", "),
					detail: F(e),
					cpuPercent: e.paused ? null : e.cpuPercent,
					icon: "extension",
					paused: e.paused,
					onPause: n ? () => d(n) : void 0,
					onResume: n ? () => f(n) : void 0
				}, e.key);
			}),
			j.extensions.length > 5 ? /* @__PURE__ */ v(u, {
				size: "2xs",
				variant: "ghost",
				justifyContent: "start",
				paddingX: "0",
				onClick: () => b((e) => !e),
				"data-testid": "performance-more-extensions",
				children: [
					_(y ? r : n, {}),
					y ? g("performance.popover.fewer", { count: 5 }) : g("performance.popover.more", { count: N.hidden }),
					y ? null : /* @__PURE__ */ _(m, {
						as: "span",
						textStyle: "mono/XS",
						color: "fg.muted",
						marginLeft: "auto",
						children: k(N.hiddenCpuPercent)
					})
				]
			}) : null
		]
	});
}, M = (e) => {
	let { buckets: t } = e, { t: n } = s("settings"), r = t.at(-1), i = t.length > 0 ? Math.round(t.reduce((e, t) => e + t, 0) / t.length) : null, a = t.length > 0 ? Math.min(...t) : null;
	return /* @__PURE__ */ v(p, {
		gap: "2xs",
		children: [
			/* @__PURE__ */ v(d, {
				alignItems: "end",
				gap: "2xs",
				children: [
					/* @__PURE__ */ _(m, {
						textStyle: "mono/3XL/semibold",
						color: r !== void 0 && r >= 50 ? "fg" : y(r),
						children: r ?? "–"
					}),
					/* @__PURE__ */ _(m, {
						textStyle: "label/S/regular",
						color: "fg.muted",
						children: "fps"
					}),
					/* @__PURE__ */ _(m, {
						textStyle: "mono/XS",
						color: "fg.muted",
						marginLeft: "auto",
						children: n("performance.popover.avgMin", {
							avg: i ?? "–",
							min: a ?? "–"
						})
					})
				]
			}),
			/* @__PURE__ */ _(x, {
				buckets: t,
				count: 30,
				height: "performance-chart",
				width: "auto",
				gap: "3xs"
			}),
			/* @__PURE__ */ v(d, {
				justifyContent: "space-between",
				children: [/* @__PURE__ */ _(m, {
					textStyle: "label/2XS",
					color: "fg.subtle",
					children: n("performance.popover.ago")
				}), /* @__PURE__ */ _(m, {
					textStyle: "label/2XS",
					color: "fg.subtle",
					children: n("performance.popover.now")
				})]
			})
		]
	});
}, N = (e) => {
	let { buckets: n, ...r } = e, { snapshot: i, extensionName: a } = r, { t: o } = s("settings"), c = i?.processes.find((e) => e.sustainedHighCpu);
	return /* @__PURE__ */ v(p, {
		gap: "sm",
		"data-testid": "performance-popover",
		children: [
			/* @__PURE__ */ v(d, {
				gap: "xs",
				children: [/* @__PURE__ */ _(t, { size: 14 }), /* @__PURE__ */ _(m, {
					textStyle: "label/M/medium",
					children: o("performance.popover.title")
				})]
			}),
			/* @__PURE__ */ _(M, { buckets: n }),
			c ? /* @__PURE__ */ _(h, {
				status: "warning",
				title: o("performance.popover.sustainedTitle"),
				children: o("performance.popover.sustainedBody", {
					process: c ? c.role === "workbench" ? o("performance.popover.workbench") : c.extensionFrames.length > 0 ? [...new Set(c.extensionFrames.map((e) => a(e.installedExtensionId)))].join(", ") : c.name ?? o(`performance.popover.roles.${c.role}`) : "",
					cpu: `${c.averageCpuPercent}%`,
					seconds: (i?.warning?.windowMs ?? 0) / 1e3
				})
			}) : null,
			/* @__PURE__ */ _(l, {
				borderTopWidth: "1px",
				borderColor: "border.subtle"
			}),
			/* @__PURE__ */ _(j, { ...r })
		]
	});
};
export { x as n, y as r, N as t };
