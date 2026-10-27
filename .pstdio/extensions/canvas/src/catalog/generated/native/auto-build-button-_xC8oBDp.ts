// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./moon-L5AtxmV1.ts";
import { t } from "./pause-C8r-dHaS.ts";
import { t as n } from "./play-crlvkPMv.ts";
import { t as r } from "./square-CKYOWRAv.ts";
import { t as i } from "./auto-build-help-BidMmd9N.ts";
import { Suspense as a, lazy as o, useRef as s, useState as c } from "react";
import { Button as l, CloseButton as u, Dialog as d, HStack as f, Icon as p, Popover as m, Portal as h, Separator as g, Stack as _, Text as v, useRecipe as y, useSlotRecipe as b } from "@chakra-ui/react";
import { AlertMessage as x, ListRow as S, ScrollArea as C, SessionIndicator as w, installPrismGlobal as T, sessionCompletionStatuses as E } from "@pstdio/ui";
import { Fragment as D, jsx as O, jsxs as k } from "react/jsx-runtime";
import { psTheme as A } from "@pstdio/ui/theme";
// extensions/pstdio-planner/src/timeline/view/auto-build-requests.tsx
function j(e) {
	let { reviewRequests: t = [], requestErrors: n = [], onOpenRequest: r, t: i } = e;
	return !t.length && !n.length ? null : /* @__PURE__ */ k(_, {
		gap: "sm",
		children: [
			/* @__PURE__ */ O(v, {
				textStyle: "label/2XS/medium",
				color: "fg.muted",
				textTransform: "uppercase",
				children: i("timeline.autoBuild.requests", "Needs attention")
			}),
			n.map((e) => /* @__PURE__ */ O(v, {
				role: "alert",
				color: "fg.error",
				children: e
			}, e)),
			t.map((e) => /* @__PURE__ */ k(_, {
				gap: "xs",
				p: "sm",
				bg: "bg.subtle",
				borderRadius: "md",
				children: [
					/* @__PURE__ */ O(v, {
						textStyle: "label/S/medium",
						children: e.title
					}),
					/* @__PURE__ */ O(v, {
						textStyle: "paragraph/S/regular",
						lineClamp: 3,
						children: e.instructions
					}),
					/* @__PURE__ */ O(l, {
						alignSelf: "start",
						size: "sm",
						variant: "ghost",
						onClick: () => r?.(e),
						children: i("timeline.autoBuild.openRequest", "Open request")
					})
				]
			}, e.id))
		]
	});
}
// extensions/pstdio-planner/src/timeline/view/auto-build-indicator.tsx
function M(e) {
	let { enabled: t, completed: n, failed: r, stuck: i, supervisorStatus: a, running: o } = e;
	if (e.paused) return "paused";
	if (r) return "failed";
	if (t) return n ? "completed" : i || a === "awaiting_input" ? "awaiting_input" : o > 0 || a === "in_progress" ? "in_progress" : a === "queued" || e.starting ? "queued" : "sleeping";
}
function N(n) {
	let { status: r, label: i } = n;
	return r === "paused" ? /* @__PURE__ */ O(p, {
		as: t,
		boxSize: "icon-xs",
		color: "fg.muted",
		"aria-label": i
	}) : r === "sleeping" ? /* @__PURE__ */ O(p, {
		as: e,
		boxSize: "icon-xs",
		color: "fg.info",
		"aria-label": i
	}) : /* @__PURE__ */ O(w, {
		status: r,
		boxSize: "icon-xs",
		ariaLabel: i
	});
}
// extensions/pstdio-planner/src/timeline/view/auto-build-session-row.tsx
function P(e) {
	let { session: t, sleeping: n, onOpen: r } = e, i = E.find((e) => e === t.status);
	return /* @__PURE__ */ O(S, {
		id: t.id,
		role: "button",
		variant: "compact",
		label: t.title,
		icon: /* @__PURE__ */ O(N, {
			status: n ? "sleeping" : i,
			label: n ? "Sleeping" : i?.replaceAll("_", " ") ?? "Unknown"
		}),
		onActivate: () => r(t)
	});
}
// extensions/pstdio-planner/src/timeline/view/auto-build-waiting-tickets.tsx
function F(e) {
	let { tickets: t, t: n } = e;
	return /* @__PURE__ */ k(_, {
		gap: "xs",
		children: [/* @__PURE__ */ O(v, {
			textStyle: "paragraph/S/regular",
			children: n("timeline.autoBuild.noReadyTickets", "No tickets are ready to start. Auto Build will resume when new work is available.")
		}), t.map((e) => {
			let t = e.detail ?? n("timeline.autoBuild.waitingWork", "Waiting for prerequisites or available agent capacity.");
			return e.reason === "existing-attempt" && (t = n("timeline.autoBuild.existingWork", "Work already exists. Open the ticket to inspect it.")), e.reason === "assigned" && (t = n("timeline.autoBuild.assignedWork", "An agent is already working on this ticket.")), /* @__PURE__ */ k(v, {
				textStyle: "paragraph/S/regular",
				children: [
					e.ticket,
					" · ",
					t
				]
			}, e.id);
		})]
	});
}
// extensions/pstdio-planner/src/timeline/view/auto-build-sessions.tsx
function I(e) {
	let { enabled: t, completed: n, supervisor: r, sessions: i, running: a, capacity: o, failed: s, error: c, stuck: l, onOpenSession: u, t: d, matchingTicketCount: f, readyTicketCount: p, starting: m, waitingTickets: h = [] } = e, g = [
		"queued",
		"in_progress",
		"awaiting_input"
	].includes(r?.status ?? "");
	return /* @__PURE__ */ k(_, {
		gap: "md",
		children: [
			t && !n && !m && f === 0 ? /* @__PURE__ */ O(v, {
				textStyle: "paragraph/S/regular",
				children: d("timeline.autoBuild.noMatchingTickets", "No unfinished tickets match the current scope and eligible filters. Stop Auto Build to change them, or add matching tickets.")
			}) : null,
			s || !n && (l || r?.status === "awaiting_input") ? /* @__PURE__ */ O(x, {
				role: "alert",
				status: s ? "error" : "warning",
				title: c ?? (s ? d("timeline.autoBuild.failed", "The supervisor failed. Open its session to inspect the error.") : d("timeline.autoBuild.stuck", "Auto Build is stuck. Check dependencies, blockers, and review requests."))
			}) : null,
			t && !n && !m && a === 0 && p === 0 && h.length > 0 ? /* @__PURE__ */ O(F, {
				tickets: h,
				t: d
			}) : null,
			/* @__PURE__ */ k(_, {
				gap: "2xs",
				children: [/* @__PURE__ */ O(v, {
					textStyle: "label/2XS/medium",
					color: "fg.muted",
					textTransform: "uppercase",
					children: d("timeline.autoBuild.sessions", "Ongoing sessions")
				}), r ? /* @__PURE__ */ O(P, {
					session: r,
					sleeping: t && !n && !g && !s,
					onOpen: u
				}) : /* @__PURE__ */ O(v, {
					textStyle: "paragraph/S/regular",
					children: t && m ? d("timeline.autoBuild.starting", "Waiting to start the supervisor") : d("timeline.autoBuild.noSupervisor", "No supervisor session")
				})]
			}),
			/* @__PURE__ */ k(v, {
				textStyle: "label/XS",
				color: "fg.muted",
				children: [
					d("timeline.autoBuild.running", "Running"),
					" · ",
					a,
					" ",
					d("timeline.autoBuild.capacity", "of"),
					" ",
					o,
					" ",
					d("timeline.autoBuild.agents", "agents")
				]
			}),
			/* @__PURE__ */ k(_, {
				gap: "2xs",
				children: [i.map((e) => /* @__PURE__ */ O(P, {
					session: e,
					onOpen: u
				}, e.id)), i.length === 0 ? /* @__PURE__ */ O(v, {
					textStyle: "label/XS",
					color: "fg.muted",
					children: d("timeline.autoBuild.noSessions", "No running ticket sessions")
				}) : null]
			})
		]
	});
}
// extensions/pstdio-planner/src/timeline/view/auto-build-activity.tsx
function L(e) {
	let { open: a, anchor: o, disabled: c, enabled: d, paused: p, onClose: x, onStop: S, onConfigure: w, onPause: T, onResume: E, reviewRequests: D, requestErrors: M, onOpenRequest: N, actionError: P, t: F, ...L } = e, R = s(null), z = y({ recipe: A.getRecipe("button") })({ variant: "destructive" }), B = b({ recipe: A.getSlotRecipe("popover") })({ variant: "panel" });
	return /* @__PURE__ */ O(m.Root, {
		lazyMount: !0,
		unmountOnExit: !0,
		open: a,
		initialFocusEl: () => R.current,
		positioning: {
			placement: "bottom-end",
			getAnchorElement: () => o.current
		},
		onOpenChange: ({ open: e }) => !e && x(),
		children: /* @__PURE__ */ O(h, { children: /* @__PURE__ */ O(m.Positioner, { children: /* @__PURE__ */ k(m.Content, {
			ref: R,
			css: B.content,
			display: "flex",
			flexDirection: "column",
			maxH: "min({sizes.filter-picker-height}, var(--available-height))",
			"aria-label": "Auto Build activity",
			children: [
				/* @__PURE__ */ O(m.Header, {
					flexShrink: "0",
					children: /* @__PURE__ */ k(f, {
						gap: "xs",
						children: [
							/* @__PURE__ */ k(m.Title, { children: [F("timeline.autoBuild.start", "Auto Build"), p ? ` · ${F("timeline.autoBuild.paused", "Paused")}` : ""] }),
							/* @__PURE__ */ O(i, { t: F }),
							/* @__PURE__ */ O(u, {
								size: "sm",
								disabled: c,
								onClick: x,
								marginLeft: "auto"
							})
						]
					})
				}),
				/* @__PURE__ */ O(m.Body, {
					display: "flex",
					flexDirection: "column",
					minH: "0",
					flex: "1",
					children: /* @__PURE__ */ O(C, {
						flex: "1",
						minH: "0",
						h: "0",
						viewportProps: {
							minH: "0",
							flex: "1"
						},
						children: /* @__PURE__ */ k(_, {
							gap: "md",
							children: [/* @__PURE__ */ O(j, {
								reviewRequests: D,
								requestErrors: M,
								onOpenRequest: N,
								t: F
							}), /* @__PURE__ */ O(I, {
								...L,
								enabled: d,
								t: F
							})]
						})
					})
				}),
				/* @__PURE__ */ O(m.Footer, {
					flexShrink: "0",
					children: /* @__PURE__ */ k(_, {
						w: "full",
						alignItems: "end",
						children: [
							/* @__PURE__ */ O(g, { w: "full" }),
							P ? /* @__PURE__ */ O(v, {
								role: "alert",
								color: "fg.error",
								children: P
							}) : null,
							d ? /* @__PURE__ */ k(l, {
								size: "sm",
								variant: "outline",
								disabled: c,
								onClick: () => void T?.(),
								children: [/* @__PURE__ */ O(t, {}), F("timeline.autoBuild.pause", "Pause")]
							}) : null,
							!d && p ? /* @__PURE__ */ k(f, {
								gap: "xs",
								children: [/* @__PURE__ */ k(l, {
									size: "sm",
									variant: "outline",
									disabled: c,
									onClick: () => void E?.(),
									children: [/* @__PURE__ */ O(n, {}), F("timeline.autoBuild.resume", "Resume")]
								}), /* @__PURE__ */ k(l, {
									size: "sm",
									css: z,
									disabled: c,
									onClick: S,
									children: [/* @__PURE__ */ O(r, {}), F("timeline.autoBuild.stop", "Stop Auto Build")]
								})]
							}) : null,
							!d && !p ? /* @__PURE__ */ k(l, {
								size: "sm",
								variant: "outline",
								disabled: c,
								onClick: w,
								children: [/* @__PURE__ */ O(n, {}), F("timeline.autoBuild.start", "Auto Build")]
							}) : null
						]
					})
				})
			]
		}) }) })
	});
}
// extensions/pstdio-planner/src/timeline/view/auto-build-button.tsx
var R = o(async () => (await T(), import("./auto-build-form-ByHaWJ-4.ts").then((e) => ({ default: e.AutoBuildForm }))));
function z(e) {
	let { enabled: t, paused: r, completed: o, supervisor: p, running: m, error: g, stuck: _, disabled: v, configuration: y, onStop: b, starting: x, t: S } = e, [C, w] = c(null), T = s(null), E = !o && p?.status === "failed" || !!g, A = t || r || E, j = M({
		enabled: t,
		paused: r,
		completed: o,
		failed: E,
		stuck: _,
		supervisorStatus: p?.status,
		running: m,
		starting: x
	}), P = j?.replaceAll("_", " ") ?? "off", F = () => {
		v || w(null);
	}, I = async () => {
		await b() && w(null);
	};
	return /* @__PURE__ */ k(D, { children: [
		/* @__PURE__ */ k(l, {
			ref: T,
			"aria-label": S("timeline.autoBuild.start", "Auto Build"),
			"aria-description": t || r || E ? `Auto Build ${P}` : void 0,
			size: "xs",
			variant: "outline",
			disabled: v,
			onClick: () => w(A ? "sessions" : "configuration"),
			children: [j ? /* @__PURE__ */ O(N, {
				status: j,
				label: `Auto Build ${P}`
			}) : /* @__PURE__ */ O(n, {}), S("timeline.autoBuild.start", "Auto Build")]
		}),
		/* @__PURE__ */ O(L, {
			...e,
			open: C === "sessions",
			failed: E,
			anchor: T,
			onClose: F,
			onStop: () => void I(),
			onConfigure: () => w("configuration")
		}),
		/* @__PURE__ */ O(d.Root, {
			lazyMount: !0,
			unmountOnExit: !0,
			open: C === "configuration",
			size: "lg",
			scrollBehavior: "inside",
			onOpenChange: ({ open: e }) => !e && F(),
			children: /* @__PURE__ */ k(h, { children: [/* @__PURE__ */ O(d.Backdrop, {}), /* @__PURE__ */ O(d.Positioner, { children: /* @__PURE__ */ k(d.Content, { children: [/* @__PURE__ */ k(d.Header, { children: [/* @__PURE__ */ k(f, {
				gap: "xs",
				children: [/* @__PURE__ */ O(d.Title, { children: S("timeline.autoBuild.start", "Auto Build") }), /* @__PURE__ */ O(i, { t: S })]
			}), /* @__PURE__ */ O(d.CloseTrigger, {
				asChild: !0,
				children: /* @__PURE__ */ O(u, {
					size: "sm",
					disabled: v
				})
			})] }), C === "configuration" && y ? /* @__PURE__ */ O(a, {
				fallback: null,
				children: /* @__PURE__ */ O(R, {
					...y,
					onClose: () => w(null),
					t: S
				})
			}) : null] }) })] })
		})
	] });
}
export { z as t };
