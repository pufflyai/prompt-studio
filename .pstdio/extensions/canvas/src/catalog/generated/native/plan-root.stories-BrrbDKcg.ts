// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, m as t, p as n, r } from "./test-whhQHjQi.ts";
import { n as i } from "./ticket-page-target-B06ixsvs.ts";
import { p as a, s as o } from "./tracks-EnwyuZ-9.ts";
import { t as s } from "./auto-build-button-_xC8oBDp.ts";
import { t as c } from "./background-menu-DxLq3w4D.ts";
import { t as l } from "./events-C3q9NYT-.ts";
import "./planner-Bje3Dhof.ts";
import { t as u } from "./plan-graph-D9ApLaZ-.ts";
import { t as d } from "./timeline-presentation-D6H7HEWi.ts";
import { n as f, r as p } from "./timeline-display-menu-BwCkJQKU.ts";
import { t as ee } from "./visible-tracks-Bzo-AUT3.ts";
import { t as m } from "./plan-header-B4KCIQTd.ts";
import { n as te, t as ne } from "./use-plan-actions-C5MIALJI.ts";
import "./write-guard-Biqs4uSg.ts";
import { Suspense as h, lazy as g, useEffect as _, useState as v } from "react";
import { Box as y, Fieldset as b, Flex as x, Skeleton as S, Stack as C } from "@chakra-ui/react";
import { HostStorageProvider as w, installPrismGlobal as T } from "@pstdio/ui";
import { jsx as E, jsxs as D } from "react/jsx-runtime";
import { createWebviewClient as O, eventRef as k, viewDataEvents as A, workbenchPanels as j } from "@pstdio/sdk/extensions";
import { filterRowsByView as re, searchRows as ie, useCollectionViewStore as M } from "@pstdio/ui/collection-view";
// extensions/pstdio-planner/src/data/auto-build-mode.ts
var N = k({
	extensionId: "pstdio.pstdio-planner",
	id: "auto-build.changed"
});
// extensions/pstdio-planner/src/timeline/view/live-read.ts
function P(e, t) {
	let n = !0, r = !1, i = !1;
	return {
		async refresh() {
			if (i = !0, !r && n) {
				r = !0;
				try {
					for (; n && i;) {
						i = !1;
						try {
							let r = await e();
							n && !i && t.onValue(r);
						} catch (e) {
							n && !i && t.onError(e);
						}
					}
				} finally {
					r = !1;
				}
			}
		},
		dispose() {
			n = !1;
		}
	};
}
// extensions/pstdio-planner/src/timeline/view/timeline-notice.ts
var F = (e, t) => e.notify.toast({
	type: "error",
	title: "Project Planner",
	message: t instanceof Error ? t.message : String(t)
}).catch(() => {}), I = 5e3;
function L(e, t, n, r) {
	let [i, a] = v();
	return _(() => {
		let i, o = P(() => t(e, r), {
			onValue: (e) => {
				a(e);
			},
			onError: (t) => {
				F(e, t), i = setTimeout(() => void s(), I);
			}
		}), s = async () => {
			clearTimeout(i), await o.refresh();
		}, c = n.map((t) => e.events.subscribe(t, () => void s()));
		return s(), () => {
			o.dispose(), clearTimeout(i);
			for (let e of c) e();
		};
	}, [
		e,
		t,
		n,
		r
	]), {
		value: i,
		setValue: a
	};
}
// extensions/pstdio-planner/src/timeline/view/use-auto-build.ts
var R = (e) => e.commands["auto-build.read"](), z = [
	N,
	l,
	A.sessionsChanged,
	k({
		extensionId: "pstdio.pstdio-planner",
		id: "automation-run-changed"
	})
];
function B(e) {
	let { value: t, setValue: n } = L(e, R, z), [r, i] = v(!1), [a, o] = v();
	return {
		mode: t,
		saving: r,
		error: a,
		configure: async (t, r, a, s, c) => {
			i(!0), o(void 0);
			try {
				let i = await e.commands["auto-build.configure"]({
					enabled: t,
					prompt: r,
					requireMergedDependencies: a,
					eligible: s,
					supervisorModel: c
				});
				return n((e) => e && {
					...e,
					...i
				}), !0;
			} catch (e) {
				return o(e instanceof Error ? e.message : String(e)), !1;
			} finally {
				i(!1);
			}
		},
		transition: async (t) => {
			i(!0), o(void 0);
			try {
				let r = await e.commands[`auto-build.${t}`]();
				return n((e) => e && {
					...e,
					...r
				}), !0;
			} catch (e) {
				return o(e instanceof Error ? e.message : String(e)), !1;
			} finally {
				i(!1);
			}
		}
	};
}
// extensions/pstdio-planner/src/timeline/view/auto-build-control.tsx
function V(e) {
	let { host: t, client: n, t: r, data: a } = e, o = B(n);
	return /* @__PURE__ */ E(s, {
		enabled: o.mode?.enabled ?? !1,
		paused: o.mode?.state === "paused",
		reviewRequests: o.mode?.reviewRequests,
		requestErrors: o.mode?.requestErrors,
		onOpenRequest: (e) => void t.call("navigation.open", { target: i({
			type: "ticket",
			id: e.ticketId,
			extensionId: "pstdio.pstdio-planner"
		}) }),
		onPause: () => o.transition("pause"),
		onResume: () => o.transition("resume"),
		completed: o.mode?.completed,
		matchingTicketCount: o.mode?.matchingTicketCount,
		readyTicketCount: o.mode?.readyTicketCount,
		waitingTickets: o.mode?.waitingTickets,
		starting: o.mode?.running,
		supervisor: o.mode?.supervisor,
		sessions: o.mode?.sessions ?? [],
		running: o.mode?.capacity.running ?? 0,
		capacity: o.mode?.capacity.limit ?? 0,
		stuck: o.mode?.stuck,
		error: o.mode?.configurationError ?? o.mode?.error,
		onOpenSession: (e) => void t.call("navigation.open", { target: {
			kind: "panel",
			panel: j.projectSession,
			open: "preview",
			resource: {
				type: "session",
				id: e.id,
				extensionId: "pstdio",
				label: e.title
			}
		} }),
		actionError: o.error,
		disabled: !o.mode || o.saving,
		configuration: o.mode ? {
			prompt: o.mode.prompt,
			supervisorModel: o.mode.supervisorModel,
			host: t,
			requireMergedDependencies: o.mode.requireMergedDependencies,
			eligible: o.mode.eligible,
			data: a,
			saving: o.saving,
			error: o.error,
			onEnable: (e, t, n, r) => o.configure(!0, e, t, n, r)
		} : void 0,
		onStop: () => o.transition("stop"),
		t: r
	});
}
// extensions/pstdio-planner/src/timeline/view/plan-loading.tsx
var H = {
	getItem: () => null,
	setItem: () => {}
}, U = {
	storageKey: "planner-timeline-loading",
	attributes: [],
	rows: []
};
function W(e) {
	let { t } = e;
	return /* @__PURE__ */ D(x, {
		direction: "column",
		h: "full",
		minH: "0",
		minW: "0",
		children: [/* @__PURE__ */ E(b.Root, {
			disabled: !0,
			border: "0",
			p: "0",
			m: "0",
			minW: "0",
			children: /* @__PURE__ */ E(w, {
				storage: H,
				children: /* @__PURE__ */ E(m, {
					data: U,
					search: "",
					onSearchChange: () => {},
					resultLabel: "",
					actions: /* @__PURE__ */ E(s, {
						disabled: !0,
						enabled: !1,
						sessions: [],
						running: 0,
						capacity: 0,
						onOpenSession: () => {},
						onStop: async () => !0,
						t
					})
				})
			})
		}), /* @__PURE__ */ D(x, {
			role: "region",
			"aria-label": t("timeline.loading", "Loading timeline"),
			"aria-busy": "true",
			flex: "1",
			minH: "0",
			overflow: "hidden",
			p: "md",
			gap: "lg",
			children: [/* @__PURE__ */ E(C, {
				"aria-hidden": "true",
				w: "20",
				flexShrink: "0",
				gap: "2xl",
				children: [
					0,
					1,
					2
				].map((e) => /* @__PURE__ */ E(S, {
					h: "3",
					w: "full",
					borderRadius: "xs"
				}, e))
			}), /* @__PURE__ */ E(x, {
				"aria-hidden": "true",
				flex: "1",
				minW: "0",
				gap: "lg",
				children: [
					0,
					1,
					2
				].map((e) => /* @__PURE__ */ D(C, {
					flex: "1",
					minW: "64",
					gap: "md",
					children: [/* @__PURE__ */ E(S, {
						h: "4",
						w: "32",
						borderRadius: "xs"
					}), [
						0,
						1,
						2
					].map((e) => /* @__PURE__ */ E(S, {
						h: "28",
						w: "full",
						borderRadius: "xs"
					}, e))]
				}, e))
			})]
		})]
	});
}
// extensions/pstdio-planner/src/timeline/view/timeline-storage.ts
var G = {
	name: "timelineViewState",
	scope: { scope: "project" }
}, K = async (e, t) => {
	let n = { ...await e.call("preferences.get", G) }, r = Promise.resolve();
	return {
		getItem: (e) => n[e] ?? null,
		setItem(i, a) {
			n[i] = a;
			let o = { ...n };
			return r = r.then(async () => {
				await e.call("preferences.set", {
					...G,
					value: o
				});
			}).catch(t), r;
		}
	};
}, q = (e) => ({
	...e,
	settings: e.settings
});
function J(e, t) {
	return {
		views: t.views.map(q),
		defaultViewId: t.defaultViewId,
		onCreateView: async (t) => q(await e.commands["timeline.views.create"]({ value: t })),
		onUpdateView: async (t, n) => {
			await e.commands["timeline.views.update"]({
				id: t,
				value: n
			});
		},
		onDeleteView: async (t) => {
			await e.commands["timeline.views.delete"]({ id: t });
		},
		onSetDefaultView: async (t) => {
			await e.commands["timeline.views.default"]({ id: t ?? void 0 });
		}
	};
}
// extensions/pstdio-planner/src/timeline/contracts.ts
var ae = k({
	extensionId: "pstdio.pstdio-planner",
	id: "timeline.plan.changed"
}), oe = (e) => e.commands["timeline.plan.read"](), se = [
	l,
	ae,
	A.boardViewsChanged
];
function ce(e) {
	let [t] = v(() => O(e)), { value: n } = L(t, oe, se);
	return {
		client: t,
		plan: n
	};
}
// extensions/pstdio-planner/src/timeline/view/plan-root.tsx
var le = g(async () => (await T(), import("./details-C_4OQVR9.ts").then((e) => ({ default: e.Details })))), Y = g(async () => (await T(), import("./plan-editor-B7ITsn3O.ts").then((e) => ({ default: e.PlanEditor }))));
function ue(e) {
	let { host: t, t: n } = e, { client: r, plan: i } = ce(t), [a, o] = v();
	if (_(() => {
		let e = !0, n = (t) => {
			e && F(r, t);
		};
		return K(t, n).then((t) => {
			e && o(t);
		}).catch(n), () => {
			e = !1;
		};
	}, [r, t]), !i || !a) return /* @__PURE__ */ E(W, { t: n });
	let s = J(r, i.savedViews);
	return /* @__PURE__ */ E(w, {
		storage: a,
		children: /* @__PURE__ */ E(d, {
			projectId: i.projectId,
			storage: a,
			children: /* @__PURE__ */ E(de, {
				host: t,
				t: n,
				client: r,
				plan: i,
				viewsSource: s
			})
		}, i.projectId)
	});
}
function de(e) {
	let { host: t, t: n, client: r, plan: a, viewsSource: s } = e, [l, d] = v(""), g = p(a, n), _ = M(g.storageKey, f, (e) => e.filter), b = M(g.storageKey, f, (e) => e.settings.displayProperties), S = re(g.rows, _, g.attributes), C = ie(S, l, (e) => [e.title, String(e.attributes.id)]), w = ee(a, _, g.attributes), { sections: T, toggle: O } = o(a, new Set(C.map(({ id: e }) => e))), { viewProps: k, selected: A, open: j, review: N, editor: P, context: F, setSelectedId: I, setContext: L, setEditor: R, done: z } = ne({
		host: t,
		client: r,
		plan: a,
		sections: T,
		tracks: w,
		toggle: O
	});
	return /* @__PURE__ */ D(x, {
		direction: "column",
		h: "full",
		minH: "0",
		minW: "0",
		children: [
			/* @__PURE__ */ E(m, {
				data: g,
				viewsSource: s,
				search: l,
				onSearchChange: d,
				resultLabel: `${T.reduce((e, t) => e + t.rows.length, 0)} of ${S.length}`,
				actions: /* @__PURE__ */ E(V, {
					host: t,
					client: r,
					t: n,
					data: g
				})
			}),
			/* @__PURE__ */ D(x, {
				flex: "1",
				minH: "0",
				minW: "0",
				children: [/* @__PURE__ */ E(y, {
					flex: "1",
					minH: "0",
					minW: "0",
					children: /* @__PURE__ */ E(u, {
						...k,
						today: a.today,
						cardInteraction: {
							host: t,
							client: r,
							attributes: g.attributes,
							displayProperties: b,
							rows: new Map(g.rows.map((e) => [e.id, e]))
						},
						onOpenRequests: (e) => {
							t.call("navigation.open", { target: i(e.target.resource) });
						}
					})
				}), A ? /* @__PURE__ */ E(h, {
					fallback: null,
					children: /* @__PURE__ */ E(le, {
						row: A,
						plan: a,
						client: r,
						onOpen: j,
						onSelect: I,
						onClose: () => I(void 0),
						review: N?.includes(A.id) ? {
							position: N.indexOf(A.id) + 1,
							total: N.length,
							onStep: (e) => I(te(N, A.id, e))
						} : void 0
					}, A.id)
				}) : null]
			}),
			P ? /* @__PURE__ */ E(h, {
				fallback: null,
				children: /* @__PURE__ */ E(Y, {
					host: t,
					t: n,
					editor: P,
					client: r,
					plan: a,
					onDone: z
				}, JSON.stringify(P))
			}) : null,
			F ? /* @__PURE__ */ E(c, {
				context: F,
				onClose: () => L(void 0),
				onCreate: (e, t) => {
					L(void 0), R({
						kind: e,
						context: t
					});
				}
			}) : null
		]
	});
}
// extensions/pstdio-planner/src/timeline/view/plan-root.stories.tsx
var X = "This workspace has no ready local process target.", Z = "Auto Build could not save its settings.", fe = {
	...a({
		tickets: [],
		statuses: [],
		tags: [],
		today: "2026-10-15",
		plan: {
			deadlines: [],
			order: []
		}
	}),
	projectId: "timeline-error-story",
	ticketRows: [],
	ticketAttributes: [],
	savedViews: {
		views: [],
		defaultViewId: null
	}
};
function pe(e) {
	let { failConfigure: t, loading: n } = e;
	return /* @__PURE__ */ E(y, {
		h: "600px",
		children: /* @__PURE__ */ E(ue, {
			host: {
				extensionId: "pstdio.pstdio-planner",
				call: async (e, r) => {
					if (e === "preferences.get" && n === "preferences") return new Promise(() => {});
					if (e === "preferences.get" || e === "preferences.set") return;
					if (e !== "commands.execute") throw Error(`Unexpected capability: ${e}`);
					let i;
					switch (r?.commandId?.split(".command.")[1]) {
						case "timeline.plan.read":
							if (n === "tickets") return new Promise(() => {});
							i = fe;
							break;
						case "auto-build.read":
							i = {
								enabled: !1,
								prompt: "Choose small independent tickets.",
								eligible: {
									conjunction: "and",
									rules: []
								},
								requireMergedDependencies: !1,
								sessions: [],
								capacity: {
									running: 0,
									limit: 2
								},
								error: X
							};
							break;
						case "auto-build.configure":
							if (t) throw Error(Z);
							i = {};
							break;
						default: throw Error(`Unexpected command: ${r?.commandId}`);
					}
					return { outcome: {
						ok: !0,
						status: "success",
						value: i
					} };
				},
				onEvent: () => () => {}
			},
			t: (e, t) => t ?? e
		})
	});
}
var me = {
	title: "Extensions/Planner/Timeline",
	component: pe
}, Q = {
	args: { loading: "tickets" },
	play: async ({ canvasElement: t }) => {
		let n = e(t);
		r(await n.findByRole("button", { name: "Filter" })).toBeDisabled(), r(n.getByRole("button", { name: "Auto Build" })).toBeDisabled(), r(n.getByRole("region", { name: "Loading timeline" })).toHaveAttribute("aria-busy", "true");
	}
}, he = {
	...Q,
	args: { loading: "preferences" }
}, $ = { play: async ({ canvasElement: i }) => {
	let a = e(i.ownerDocument.body), o = await a.findByRole("button", { name: "Auto Build" });
	await t(() => r(o).toBeEnabled()), r(a.queryByRole("alert")).toBeNull(), await n.click(o), r(await a.findByRole("alert")).toHaveTextContent(X);
	let s = a.getByRole("dialog");
	await n.click(e(s).getByRole("button", { name: "Auto Build" })), await a.findByRole("dialog", { name: "Auto Build" }), r(a.queryByRole("alert")).toBeNull();
} }, ge = {
	args: { failConfigure: !0 },
	play: async (i) => {
		await $.play(i);
		let a = e(i.canvasElement.ownerDocument.body), o = a.getByRole("dialog", { name: "Auto Build" });
		await n.click(e(o).getByRole("button", { name: "Auto Build" })), await t(() => r(e(o).getByRole("alert")).toHaveTextContent(Z)), r(a.getAllByRole("alert")).toHaveLength(1);
	}
};
export { ge as ConfigureFailure, he as LoadingPreferences, Q as LoadingTickets, $ as SavedAutoBuildFailure, me as default };
