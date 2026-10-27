// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, f as t, g as n, h as r, n as i } from "./schemas-D84h_Ad-.ts";
import { t as a } from "./iso-Dyo-gxfV.ts";
import { t as o } from "./useQuery-OeRqqLZF.ts";
import { t as s } from "./gauge-DTjFId-E.ts";
import { t as c } from "./triangle-alert-DcqN2fDE.ts";
import { t as l } from "./useTranslation-DvWg4zeU.ts";
import { _ as u } from "./workbench-core-kaLFKJEn.ts";
import { t as d } from "./widget-ids-CvvbLhYP.ts";
import { t as f } from "./use-workbench-store-BMaFgEbb.ts";
import { t as p } from "./settings-resources-BmVO5oBi.ts";
import { n as m } from "./project-context-BR7AjHlE.ts";
import { n as ee } from "./module-Dixbes9T.ts";
import { t as h } from "./commands-Bp5w85f4.ts";
import { n as te, t as g } from "./paused-extensions-CHjmYZiy.ts";
import { n as _, r as v, t as ne } from "./performance-popover-content-D6WrD5CF.ts";
import { createContext as y, useContext as b, useRef as re, useState as x, useSyncExternalStore as S } from "react";
import { Box as ie, Button as ae, HStack as C, Popover as w, Portal as oe, Stack as T, StackSeparator as E, Text as D } from "@chakra-ui/react";
import { AlertMessage as O, ScrollArea as k, Switch as A, Tooltip as j } from "@pstdio/ui";
import { jsx as M, jsxs as N } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/shared/app/dashboard-storage.ts
var se = () => {
	let e = /* @__PURE__ */ new Map();
	return {
		getItem: (t) => e.get(t) ?? null,
		setItem: (t, n) => {
			e.set(t, n);
		},
		removeItem: (t) => {
			e.delete(t);
		}
	};
}, P = (e) => e || (typeof localStorage < "u" ? localStorage : se()), F = /* @__PURE__ */ new WeakMap(), ce = (e, t) => (F.set(e, t), () => {
	F.get(e) === t && F.delete(e);
}), le = y(((e) => {
	let t = "pstdio-dashboard:connection-status", n = /* @__PURE__ */ new Set();
	return {
		getEnabled: () => e.getItem(t) === "true",
		setEnabled: (r) => {
			e.setItem(t, String(r));
			for (let e of n) e();
		},
		subscribe: (e) => (n.add(e), () => {
			n.delete(e);
		})
	};
})(P(void 0))), ue = () => b(le), I = (e) => {
	let { label: t, helper: n, checked: r, disabled: i, onChange: a } = e;
	return /* @__PURE__ */ N(C, {
		gap: "sm",
		alignItems: "center",
		padding: "md",
		children: [/* @__PURE__ */ N(T, {
			gap: "3xs",
			flex: "1",
			children: [/* @__PURE__ */ M(D, {
				textStyle: "label/S/medium",
				children: t
			}), /* @__PURE__ */ M(D, {
				textStyle: "label/S/regular",
				color: "fg.muted",
				children: n
			})]
		}), /* @__PURE__ */ M(A, {
			checked: r,
			inputProps: {
				checked: r,
				"aria-label": t
			},
			disabled: i,
			onCheckedChange: (e) => a(e.checked)
		})]
	});
}, L = (e) => {
	let { host: t, performanceEnabled: n, performanceSaving: r, connectionStatusEnabled: i, error: a, onPerformanceChange: o, onConnectionStatusChange: s, onDismissError: c } = e, { t: u } = l("settings"), d = u("performance.settings.description");
	return n && t === "desktop" && (d = u("performance.settings.helperDesktopOn")), n && t === "browser" && (d = u("performance.settings.helperBrowserOn")), /* @__PURE__ */ N(T, {
		gap: "md",
		padding: "lg",
		maxW: "720px",
		children: [
			/* @__PURE__ */ N(T, {
				gap: "2xs",
				children: [/* @__PURE__ */ M(D, {
					textStyle: "heading/S",
					children: u("developerTools.title")
				}), /* @__PURE__ */ M(D, {
					textStyle: "paragraph/S/regular",
					color: "fg.muted",
					children: u("developerTools.description")
				})]
			}),
			a ? /* @__PURE__ */ M(O, {
				status: "error",
				title: a,
				onClose: c
			}) : null,
			/* @__PURE__ */ N(T, {
				gap: "0",
				borderWidth: "1px",
				borderColor: "border.subtle",
				borderRadius: "md",
				separator: /* @__PURE__ */ M(E, { borderColor: "border.subtle" }),
				children: [/* @__PURE__ */ M(I, {
					label: u("performance.settings.enable"),
					helper: d,
					checked: n === !0,
					disabled: n === void 0 || r,
					onChange: o
				}), /* @__PURE__ */ M(I, {
					label: u("connectionStatus.enable"),
					helper: u("connectionStatus.description"),
					checked: i,
					onChange: s
				})]
			})
		]
	});
}, R = (e) => {
	let { controller: t } = e, { t: n } = l("settings"), r = S(t.subscribe, t.getEnabled), i = ue(), a = S(i.subscribe, i.getEnabled), [o, s] = x(!1), [c, u] = x(), d = async (e) => {
		s(!0), u(void 0);
		try {
			await t.setEnabled(e);
		} catch {
			u(n("performance.settings.saveError"));
		} finally {
			s(!1);
		}
	};
	return /* @__PURE__ */ M(L, {
		host: t.host.kind,
		performanceEnabled: r,
		performanceSaving: o,
		connectionStatusEnabled: a,
		error: c,
		onPerformanceChange: (e) => void d(e),
		onConnectionStatusChange: (e) => {
			u(void 0);
			try {
				i.setEnabled(e);
			} catch {
				u(n("connectionStatus.saveError"));
			}
		},
		onDismissError: () => u(void 0)
	});
}, z = /* @__PURE__ */ new Map(), B = /* @__PURE__ */ new Map(), V = /* @__PURE__ */ new Set(), H = (e, t, n) => {
	let r = z.get(e) ?? /* @__PURE__ */ new Map(), i = (r.get(t) ?? 0) + n;
	i > 0 ? r.set(t, i) : r.delete(t), r.size > 0 ? z.set(e, r) : z.delete(e), B = new Map([...z].map(([e, t]) => [e, t.size]));
	for (let e of V) e();
}, U = {
	get: () => B,
	open: (e, t) => (H(e, t, 1), () => H(e, t, -1)),
	subscribe: (e) => (V.add(e), () => {
		V.delete(e);
	})
}, de = () => S(U.subscribe, U.get), W = 2e3, fe = ["performance-snapshot"], pe = (e) => {
	let { controller: t, workbench: n } = e, r = f(n.context.store, (e) => {
		let t = e.values[m];
		return typeof t == "string" ? t : void 0;
	}), i = re(null), { t: a } = l("settings"), u = S(t.frameRate.subscribe, t.frameRate.getBuckets), d = S(t.subscribe, t.getPopoverOpen), p = te(), h = de(), y = o({
		queryKey: fe,
		queryFn: () => t.host.snapshot(),
		refetchInterval: W,
		gcTime: 0
	}), b = ee(r), x = (e) => b.data?.extensions.find((t) => t.installedExtensionId === e)?.displayName ?? a("performance.popover.unknownExtension"), T = u.at(-1), E = y.data?.processes.find((e) => e.sustainedHighCpu);
	return /* @__PURE__ */ N(w.Root, {
		lazyMount: !0,
		unmountOnExit: !0,
		open: d,
		initialFocusEl: () => i.current,
		onOpenChange: (e) => t.setPopoverOpen(e.open),
		positioning: {
			placement: "top-end",
			offset: { mainAxis: 4 }
		},
		children: [/* @__PURE__ */ M(j, {
			content: a("performance.popover.statusLabel", { fps: T ?? "–" }),
			disabled: d,
			children: /* @__PURE__ */ M(w.Trigger, {
				asChild: !0,
				children: /* @__PURE__ */ M(ae, {
					variant: "ghost",
					size: "2xs",
					gap: "xs",
					"aria-label": a("performance.popover.statusLabel", { fps: T ?? "–" }),
					"data-testid": "performance-status-item",
					children: /* @__PURE__ */ N(C, {
						gap: "xs",
						children: [
							E ? /* @__PURE__ */ M(ie, {
								as: "span",
								display: "inline-flex",
								color: "fg.warning",
								children: /* @__PURE__ */ M(c, {})
							}) : /* @__PURE__ */ M(s, {}),
							/* @__PURE__ */ M(_, {
								buckets: u,
								count: 12,
								height: "performance-meter",
								width: "performance-bar",
								gap: "performance-bar-gap"
							}),
							/* @__PURE__ */ M(D, {
								textStyle: "mono/XS",
								color: v(T),
								"data-testid": "performance-status-fps",
								children: T === void 0 ? "– fps" : `${T} fps`
							}),
							E ? /* @__PURE__ */ M(D, {
								textStyle: "mono/XS",
								color: "fg.warning",
								children: `CPU ${E.averageCpuPercent}%`
							}) : null
						]
					})
				})
			})
		}), /* @__PURE__ */ M(oe, { children: /* @__PURE__ */ M(w.Positioner, { children: /* @__PURE__ */ M(w.Content, {
			ref: i,
			width: "performance-popover",
			maxW: "calc(100vw - var(--chakra-spacing-md) * 2)",
			maxH: "70dvh",
			overflow: "hidden",
			children: /* @__PURE__ */ M(w.Body, {
				minH: "0",
				display: "flex",
				flexDirection: "column",
				children: /* @__PURE__ */ M(k, {
					minH: "0",
					children: /* @__PURE__ */ M(ne, {
						snapshot: y.data,
						error: y.error?.message,
						buckets: u,
						paused: p,
						openViews: h,
						extensionName: x,
						onPause: g.pause,
						onResume: g.resume
					})
				})
			})
		}) }) })]
	});
}, G = {
	frames: 50,
	framesPerReport: 20,
	scriptsPerFrame: 5,
	text: 120,
	frameRateSeconds: 30,
	pausedExtensions: 100
}, K = n().max(G.text), q = t().finite().nonnegative(), me = i([
	"long-animation-frame",
	"longtask",
	"unsupported"
]), he = r({
	invokerType: K,
	invoker: K,
	source: K.nullable(),
	functionName: K.nullable(),
	durationMs: q
}), ge = r({
	startedAt: a(),
	durationMs: q,
	blockingDurationMs: q.nullable(),
	scripts: e(he).max(G.scriptsPerFrame)
});
r({
	source: me,
	frames: e(ge).max(G.framesPerReport)
}), r({
	frameRate: e(t().int().nonnegative().max(1e3)).max(G.frameRateSeconds),
	pausedExtensionIds: e(K).max(G.pausedExtensions)
});
// packages/pstdio-dashboard/src/modules/performance/performance-host.ts
var J = "pstdio-dashboard:performance-monitoring", _e = (e) => !!(e && typeof e == "object" && "getPerformanceSnapshot" in e && typeof e.getPerformanceSnapshot == "function"), ve = (e) => ({
	kind: "desktop",
	retainCapture: async () => {
		let t = crypto.randomUUID();
		return await e.retainPerformanceCapture?.(t), async () => {
			await e.releasePerformanceCapture?.(t);
		};
	},
	isEnabled: () => e.getPerformanceMonitoring(),
	setEnabled: (t) => e.setPerformanceMonitoring(t),
	snapshot: () => e.getPerformanceSnapshot(),
	recordings: async () => e.getPerformanceRecordings?.() ?? null,
	reportFrames: (t) => {
		e.reportSlowFrames(t).catch(() => {});
	},
	reportState: (t) => {
		e.reportRendererState(t).catch(() => {});
	}
}), ye = (e) => {
	let t = e.getItem(J) === "true", n = [], r = null, i = {
		frameRate: [],
		pausedExtensionIds: []
	};
	return {
		kind: "browser",
		isEnabled: async () => t,
		setEnabled: async (a) => {
			t = a, n = [], r = null, i = {
				frameRate: [],
				pausedExtensionIds: []
			}, a ? e.setItem(J, "true") : e.removeItem?.(J);
		},
		snapshot: async () => t ? {
			version: 1,
			host: "browser",
			capturedAt: (/* @__PURE__ */ new Date()).toISOString(),
			sampleIntervalMs: null,
			warning: null,
			measurementWindowMs: null,
			capabilities: {
				processMetrics: !1,
				idleWakeups: !1,
				privateMemory: !1,
				slowFrames: r
			},
			processes: [],
			frames: n,
			...i
		} : null,
		reportFrames: (e) => {
			t && (r = e.source, n = [...[...e.frames].reverse(), ...n].slice(0, G.frames));
		},
		reportState: (e) => {
			t && (i = e);
		}
	};
}, be = (e, t) => _e(e) ? ve(e) : ye(t), Y = (e) => ({
	buckets: [],
	secondStartedAt: e,
	count: 0
}), xe = (e, t) => {
	let n = Math.floor((t - e.secondStartedAt) / 1e3);
	if (n < 1) return {
		...e,
		count: e.count + 1
	};
	let r = Math.min(n - 1, 30);
	return {
		buckets: [
			...e.buckets,
			e.count,
			...Array(r).fill(0)
		].slice(-30),
		secondStartedAt: e.secondStartedAt + n * 1e3,
		count: 1
	};
}, Se = () => {
	let e = Y(performance.now()), t, n = /* @__PURE__ */ new Set(), r = (i) => {
		let a = e.buckets;
		if (e = xe(e, i), e.buckets !== a) for (let e of n) e();
		t = requestAnimationFrame(r);
	}, i = () => {
		t === void 0 && document.visibilityState !== "hidden" && (e = {
			...e,
			secondStartedAt: performance.now(),
			count: 0
		}, t = requestAnimationFrame(r));
	}, a = () => {
		t !== void 0 && cancelAnimationFrame(t), t = void 0;
	}, o = () => document.visibilityState === "hidden" ? a() : i();
	return {
		start: () => {
			typeof requestAnimationFrame == "function" && (e = Y(performance.now()), document.addEventListener("visibilitychange", o), i());
		},
		stop: () => {
			if (typeof requestAnimationFrame == "function") {
				document.removeEventListener("visibilitychange", o), a(), e = Y(performance.now());
				for (let e of n) e();
			}
		},
		getBuckets: () => e.buckets,
		subscribe: (e) => (n.add(e), () => {
			n.delete(e);
		})
	};
}, Ce = /\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, X = (e) => e.slice(0, G.text), Z = (e, t) => {
	if (!e) return null;
	try {
		let n = new URL(e, t);
		return n.origin !== t || !n.protocol.startsWith("http") ? "external script" : n.pathname.startsWith("/v1/extensions/webviews/") ? "extension webview" : X(n.pathname.split("/").at(-1) || "document");
	} catch {
		return "external script";
	}
}, we = (e, t, n) => t === "classic-script" || t === "module-script" ? Z(e, n) ?? "script" : X(e.replace(Ce, "[url]")), Te = (e, t) => ({
	startedAt: new Date(t.timeOrigin + e.startTime).toISOString(),
	durationMs: Math.round(e.duration),
	blockingDurationMs: e.blockingDuration === void 0 ? null : Math.round(e.blockingDuration),
	scripts: [...e.scripts ?? []].sort((e, t) => t.duration - e.duration).slice(0, G.scriptsPerFrame).map((e) => ({
		invokerType: X(e.invokerType),
		invoker: we(e.invoker, e.invokerType, t.origin),
		source: Z(e.sourceURL, t.origin),
		functionName: e.sourceFunctionName ? X(e.sourceFunctionName) : null,
		durationMs: Math.round(e.duration)
	}))
}), Ee = 1e3, De = () => {
	let e = globalThis.PerformanceObserver?.supportedEntryTypes ?? [];
	return e.includes("long-animation-frame") ? "long-animation-frame" : e.includes("longtask") ? "longtask" : "unsupported";
}, Oe = (e) => {
	let t = De();
	if (e({
		source: t,
		frames: []
	}), t === "unsupported") return () => {};
	let n = {
		timeOrigin: performance.timeOrigin,
		origin: location.origin
	}, r = [], i, a = () => {
		i = void 0;
		let n = r.slice(-G.framesPerReport);
		r = [], e({
			source: t,
			frames: n
		});
	}, o = new PerformanceObserver((e) => {
		for (let t of e.getEntries()) r.push(Te(t, n));
		r = r.slice(-G.framesPerReport), i ??= setTimeout(a, Ee);
	});
	return o.observe({ type: t }), () => {
		o.disconnect(), i && clearTimeout(i), r = [];
	};
}, ke = (e) => {
	let t = Se(), n, r = !1, i, a, o = !1, s, c = /* @__PURE__ */ new Set(), l = /* @__PURE__ */ new Set(), u, d = () => {
		let t = !0, n = !1, r = async () => {
			if (!n) {
				n = !0;
				try {
					let n = await e.snapshot();
					if (t) for (let e of l) e(n);
				} finally {
					n = !1;
				}
			}
		}, i = setInterval(() => {
			r().catch(() => {});
		}, 2e3);
		return r().catch(() => {}), () => {
			t = !1, clearInterval(i);
		};
	}, f = () => {
		let n = () => e.reportState({
			frameRate: t.getBuckets(),
			pausedExtensionIds: [...g.get()]
		});
		n();
		let r = t.subscribe(n), i = g.subscribe(n);
		return () => {
			r(), i();
		};
	}, p = (s) => {
		if (!o) {
			if (s && !n && t.start(), !s && n && t.stop(), n = s, s) i ??= Oe(e.reportFrames), a ??= f(), l.size && (u ??= d());
			else {
				i?.(), i = void 0, a?.(), a = void 0, u?.(), u = void 0;
				for (let e of l) e(null);
				r = !1;
			}
			for (let e of c) e();
		}
	};
	return {
		host: e,
		frameRate: t,
		getPopoverOpen: () => r,
		setPopoverOpen: (e) => {
			r = e && n === !0;
			for (let e of c) e();
		},
		retainCapture: async () => e.retainCapture?.() ?? (async () => {}),
		load: async () => {
			s ??= await e.retainCapture?.(), o ? await s?.() : p(await e.isEnabled());
		},
		getEnabled: () => n,
		setEnabled: async (t) => {
			t || p(!1);
			try {
				await e.setEnabled(t);
			} catch (e) {
				throw t || p(!0), e;
			}
			t && p(!0);
		},
		subscribeSnapshots: (e) => (l.add(e), n && !o && (u ??= d()), () => {
			l.delete(e), l.size || (u?.(), u = void 0);
		}),
		subscribe: (e) => (c.add(e), () => {
			c.delete(e);
		}),
		dispose: () => {
			o = !0, s?.().catch(() => {}), s = void 0, n && t.stop(), a?.(), i?.(), i = void 0, u?.(), l.clear(), c.clear();
		}
	};
}, Ae = (e) => ({
	state: async () => ({
		enabled: await e.host.isEnabled(),
		host: e.host.kind
	}),
	snapshot: e.host.snapshot,
	retain: e.retainCapture,
	recordings: async () => e.host.recordings?.() ?? null,
	subscribe: e.subscribeSnapshots,
	control: async (t) => {
		if (!navigator.userActivation?.isActive) throw Error("Performance controls require a local user interaction");
		if (t.operation === "set-enabled") return e.setEnabled(t.enabled);
		t.operation === "pause-extension" && g.pause(t.installedExtensionId), t.operation === "resume-extension" && g.resume(t.installedExtensionId);
	}
}), Q = "developer-tools", $ = "dashboard.settings.developer-tools", je = (e) => ({
	id: "dashboard.performance",
	activate(t) {
		let n = globalThis.promptStudioDesktop, r = ke(be(n, P(void 0))), i = ce(e, Ae(r));
		r.load();
		let a, o = r.subscribe(() => {
			let e = r.getEnabled() === !0;
			if (e && !a) {
				let e = t.views.registerView({
					id: d.performance,
					title: "Performance",
					body: {
						kind: "react",
						render: (e) => /* @__PURE__ */ M(pe, {
							controller: r,
							workbench: e.workbench
						})
					}
				}), n = t.statusBar.registerItem({
					id: d.performance,
					viewId: d.performance,
					slot: "trailing"
				});
				a = { dispose: () => {
					n.dispose(), e.dispose();
				} };
			}
			!e && a && (a.dispose(), a = void 0);
		});
		return [
			t.views.registerView({
				id: $,
				title: "Developer tools",
				body: {
					kind: "react",
					render: () => /* @__PURE__ */ M(R, { controller: r })
				}
			}),
			t.settings.registerPanel({
				kind: "view",
				id: Q,
				title: "Developer tools",
				section: "workbench",
				scope: "global",
				order: 40,
				icon: "Wrench",
				viewId: $
			}),
			t.commands.registerCommand({
				id: h.openPerformance,
				label: "Show performance",
				category: "Developer",
				icon: "Gauge"
			}, { execute: async () => {
				let e = t.modes.getMode(t.modes.getActiveModeId() ?? "");
				!a || e?.chrome?.status !== void 0 ? await t.commands.executeCommand(p, { panelId: Q }) : r.setPopoverOpen(!0);
			} }),
			t.commands.registerCommand({
				id: h.copyPerformanceSnapshot,
				label: "Copy performance snapshot",
				category: "Developer",
				icon: "Copy"
			}, { execute: async () => {
				let e = await r.host.snapshot();
				if (!e) throw Error("Performance monitoring is off. Turn it on in Settings → Developer tools.");
				await navigator.clipboard.writeText(JSON.stringify(e, null, 2)), t.notifications.show({
					level: "success",
					title: "Performance snapshot copied"
				});
			} }),
			t.layout.registerMenuItem(u, {
				commandId: h.openPerformance,
				order: 46
			}),
			{ dispose: () => {
				o(), a?.dispose(), r.dispose(), i();
			} }
		];
	}
});
export { L as n, je as t };
