// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { S as e, t } from "./workbench-core-N58OeDyx.ts";
import { t as n } from "./use-workbench-store-BMaFgEbb.ts";
import { t as r } from "./icon-D3uE7jD-.ts";
import { useState as i } from "react";
import { Badge as a, Box as o, Button as s, Code as c, Flex as l, Grid as u, HStack as d, Stack as f, Text as p } from "@chakra-ui/react";
import { ScrollArea as m } from "@pstdio/ui";
import { Fragment as h, jsx as g, jsxs as _ } from "react/jsx-runtime";
import { resourceKey as v } from "@pstdio/sdk/extensions";
// packages/pstdio-workbench/src/examples/layout-scope/module.tsx
var y = "layout-scope.example.panel", b = "layout-scope.example.secondary", x = "layout-scope.example.sidenav", S = [
	{
		id: "project/demo/mode/tickets/resource/ticket:PS-100",
		label: "Ticket PS-100"
	},
	{
		id: "project/demo/mode/tickets/resource/ticket:PS-200",
		label: "Ticket PS-200"
	},
	{
		id: "project/demo/mode/tickets/aggregate/tickets",
		label: "Tickets aggregate"
	}
], C = (e, t) => {
	e.shell.setRegionOpen("secondary", t);
}, w = () => {
	let e = /* @__PURE__ */ new Map();
	return { layout: {
		getLayout: (t) => e.get(t ?? "__global__"),
		setLayout: (t, n) => {
			e.set(n ?? "__global__", structuredClone(t));
		}
	} };
}, T = (e) => {
	let { workbench: t } = e, r = n(t.layout.store, (e) => e.layout.regions.secondary.size), a = n(t.layout.store, (e) => e.layout.regions.secondary.visible), [l, u] = i(() => t.layout.getPersistenceScope()), m = (e) => {
		t.layout.setPersistenceScope(e, { carryRegionState: ["sidenav"] }), u(e);
	};
	return /* @__PURE__ */ _(f, {
		p: "lg",
		gap: "md",
		children: [
			/* @__PURE__ */ g(p, {
				textStyle: "title/S/semibold",
				children: "Scoped layout persistence"
			}),
			/* @__PURE__ */ g(p, {
				textStyle: "paragraph/M/regular",
				children: "Ticket resources and the aggregate page keep independent Main/Secondary Panel state. The project-owned Sidenav is carried across every switch without remounting."
			}),
			/* @__PURE__ */ g(d, {
				gap: "sm",
				wrap: "wrap",
				children: S.map((e) => /* @__PURE__ */ _(s, {
					size: "sm",
					variant: e.id === l ? "primary" : "outline",
					onClick: () => m(e.id),
					children: ["Switch to ", e.label]
				}, e.label))
			}),
			/* @__PURE__ */ _(d, {
				gap: "sm",
				wrap: "wrap",
				children: [
					/* @__PURE__ */ g(s, {
						size: "sm",
						onClick: () => t.layout.setRegionSize("secondary", (r ?? 240) + 40),
						children: "Secondary +40"
					}),
					/* @__PURE__ */ g(s, {
						size: "sm",
						onClick: () => t.layout.setRegionSize("secondary", Math.max(160, (r ?? 240) - 40)),
						children: "Secondary -40"
					}),
					/* @__PURE__ */ g(s, {
						size: "sm",
						onClick: () => C(t, !a),
						children: "Toggle secondary"
					})
				]
			}),
			/* @__PURE__ */ _(o, { children: [/* @__PURE__ */ g(p, {
				textStyle: "label/S/semibold",
				children: "Active scope"
			}), /* @__PURE__ */ g(c, {
				colorPalette: "gray",
				children: l ?? "global"
			})] }),
			/* @__PURE__ */ _(o, { children: [/* @__PURE__ */ g(p, {
				textStyle: "label/S/semibold",
				children: "Resource-owned state"
			}), /* @__PURE__ */ _(p, {
				textStyle: "paragraph/S/regular",
				children: [
					"secondary open = ",
					String(a),
					" | size = ",
					String(r ?? "default")
				]
			})] })
		]
	});
}, E = () => /* @__PURE__ */ _(f, {
	p: "md",
	gap: "xs",
	children: [/* @__PURE__ */ g(p, {
		textStyle: "label/S/semibold",
		children: "Project Sidenav"
	}), /* @__PURE__ */ g(p, {
		textStyle: "paragraph/S/regular",
		children: "This project-owned chrome stays mounted while resource scopes rotate."
	})]
}), D = () => ({
	id: "layout-scope.example",
	activate(e) {
		e.views.registerView({
			id: y,
			title: "Scope switcher",
			body: {
				kind: "react",
				render: ({ workbench: e }) => /* @__PURE__ */ g(T, { workbench: e })
			}
		}), e.shellPlacements.registerPlacement({
			id: y,
			item: {
				kind: "view",
				presence: "fixed",
				view: {
					kind: "view",
					id: y
				}
			},
			region: "main"
		}), e.views.registerView({
			id: x,
			title: "Project Sidenav",
			body: {
				kind: "react",
				render: () => /* @__PURE__ */ g(E, {})
			}
		}), e.shellPlacements.registerPlacement({
			id: x,
			item: {
				kind: "view",
				presence: "fixed",
				view: {
					kind: "view",
					id: x
				}
			},
			region: "sidenav"
		}), e.views.registerView({
			id: b,
			title: "Resource details",
			body: {
				kind: "react",
				render: () => /* @__PURE__ */ g(E, {})
			}
		}), e.shellPlacements.registerPlacement({
			id: b,
			item: {
				kind: "view",
				presence: "fixed",
				view: {
					kind: "view",
					id: b
				}
			},
			region: "secondary"
		});
	}
}), ee = () => {
	let e = w(), n = t({ layoutPersistence: e.layout });
	n.registerModule(D());
	let r = (e, t, r) => {
		n.layout.setPersistenceScope(e), n.layout.setRegionSize("secondary", t), C(n, r);
	};
	return r(S[0].id, 220, !0), r(S[1].id, 340, !1), r(S[2].id, 280, !1), n;
}, O = "preferences.schemas", k = "preferences.example.editorDensity", A = "preferences.example.defaultOpenRegion", j = { scope: "user" }, M = {
	scope: "project",
	scopeId: "storybook-project"
}, N = [k, A], P = { properties: {
	[k]: {
		type: "string",
		enum: ["comfortable", "compact"],
		default: "comfortable",
		scope: "user",
		description: "Controls the preferred editor density."
	},
	[A]: {
		type: "string",
		enum: [
			"main",
			"secondary",
			"main-right-menu"
		],
		default: "main",
		scope: "project",
		description: "Controls where new resource views open in this project."
	}
} }, F = [{
	value: "comfortable",
	label: "Comfortable",
	icon: "PanelTop"
}, {
	value: "compact",
	label: "Compact",
	icon: "Rows3"
}], I = [
	{
		value: "main",
		label: "Main",
		icon: "PanelTop"
	},
	{
		value: "secondary",
		label: "Bottom",
		icon: "PanelBottom"
	},
	{
		value: "main-right-menu",
		label: "Right",
		icon: "PanelRight"
	}
], L = [
	"README.md",
	"extension.ts",
	"package.json"
], R = (e) => String(e ?? "unset"), z = (e) => {
	let { name: t, schema: n } = e;
	return /* @__PURE__ */ g(o, {
		borderWidth: "1px",
		borderColor: "border.subtle",
		p: "md",
		children: /* @__PURE__ */ _(d, {
			gap: "sm",
			align: "flex-start",
			children: [/* @__PURE__ */ g(r, {
				name: "Settings2",
				size: 16,
				mt: "2px",
				color: "fg.muted"
			}), /* @__PURE__ */ _(f, {
				gap: "xs",
				minW: "0",
				flex: "1",
				children: [
					/* @__PURE__ */ g(c, {
						colorPalette: "gray",
						w: "fit-content",
						maxW: "full",
						overflowWrap: "anywhere",
						children: t
					}),
					/* @__PURE__ */ _(d, {
						gap: "xs",
						wrap: "wrap",
						children: [
							/* @__PURE__ */ g(a, {
								colorPalette: "blue",
								children: n.scope
							}),
							/* @__PURE__ */ g(a, {
								colorPalette: "purple",
								children: n.type
							}),
							/* @__PURE__ */ _(a, {
								colorPalette: "green",
								children: ["default ", R(n.default)]
							})
						]
					}),
					/* @__PURE__ */ g(p, {
						textStyle: "paragraph/S/regular",
						color: "fg.muted",
						children: n.description
					}),
					/* @__PURE__ */ g(p, {
						textStyle: "paragraph/XS/regular",
						color: "fg.muted",
						children: n.scope === "user" ? "The same value follows the user across projects." : "Each project stores its own value."
					})
				]
			})]
		})
	});
}, B = (e) => {
	let { icon: t, label: n, onClick: i, selected: a } = e;
	return /* @__PURE__ */ _(s, {
		"aria-pressed": a,
		colorPalette: a ? "blue" : "gray",
		onClick: i,
		size: "sm",
		variant: a ? "primary" : "outline",
		children: [/* @__PURE__ */ g(r, { name: t }), n]
	});
}, V = (e) => {
	let { input: t } = e, r = n(t.workbench.preferences.store, (e) => e.schemas), [s, l] = i(0), h = t.workbench.preferences.getValue(k, j), v = t.workbench.preferences.getValue(A, M), y = (e, n, r) => {
		t.workbench.preferences.setValue(e, n, r), l((e) => e + 1);
	};
	return /* @__PURE__ */ _(m, {
		h: "full",
		minH: "0",
		"data-preference-revision": s,
		contentProps: {
			p: "lg",
			display: "flex",
			flexDirection: "column",
			gap: "lg"
		},
		children: [
			/* @__PURE__ */ _(f, {
				gap: "xs",
				children: [/* @__PURE__ */ g(p, {
					textStyle: "heading/M/semibold",
					children: "Declare a setting once"
				}), /* @__PURE__ */ g(p, {
					textStyle: "paragraph/S/regular",
					color: "fg.muted",
					maxW: "760px",
					children: "A preference is a named setting that feature code can read. Its schema tells the workbench which values are allowed, which value to use by default, and where to save a user's choice."
				})]
			}),
			/* @__PURE__ */ _(f, {
				gap: "sm",
				children: [/* @__PURE__ */ g(p, {
					textStyle: "label/M/semibold",
					children: "1. The module declares the contract"
				}), /* @__PURE__ */ g(u, {
					templateColumns: {
						base: "1fr",
						lg: "repeat(2, minmax(0, 1fr))"
					},
					gap: "md",
					children: N.map((e) => /* @__PURE__ */ g(z, {
						name: e,
						schema: r[e] ?? P.properties[e]
					}, e))
				})]
			}),
			/* @__PURE__ */ _(f, {
				gap: "sm",
				children: [/* @__PURE__ */ g(p, {
					textStyle: "label/M/semibold",
					children: "2. The settings UI writes values"
				}), /* @__PURE__ */ _(u, {
					templateColumns: {
						base: "1fr",
						lg: "repeat(2, minmax(0, 1fr))"
					},
					gap: "md",
					children: [/* @__PURE__ */ g(o, {
						borderWidth: "1px",
						borderColor: "border.subtle",
						p: "md",
						children: /* @__PURE__ */ _(f, {
							gap: "sm",
							children: [/* @__PURE__ */ _(d, {
								justify: "space-between",
								gap: "sm",
								wrap: "wrap",
								children: [/* @__PURE__ */ g(p, {
									textStyle: "label/S/semibold",
									children: "Editor density"
								}), /* @__PURE__ */ g(a, {
									colorPalette: "blue",
									children: "saved for user"
								})]
							}), /* @__PURE__ */ g(d, {
								gap: "xs",
								wrap: "wrap",
								children: F.map((e) => /* @__PURE__ */ g(B, {
									icon: e.icon,
									label: e.label,
									selected: h === e.value,
									onClick: () => y(k, e.value, j)
								}, e.value))
							})]
						})
					}), /* @__PURE__ */ g(o, {
						borderWidth: "1px",
						borderColor: "border.subtle",
						p: "md",
						children: /* @__PURE__ */ _(f, {
							gap: "sm",
							children: [/* @__PURE__ */ _(d, {
								justify: "space-between",
								gap: "sm",
								wrap: "wrap",
								children: [/* @__PURE__ */ g(p, {
									textStyle: "label/S/semibold",
									children: "Default open region"
								}), /* @__PURE__ */ g(a, {
									colorPalette: "blue",
									children: "saved for this project"
								})]
							}), /* @__PURE__ */ g(d, {
								gap: "xs",
								wrap: "wrap",
								children: I.map((e) => /* @__PURE__ */ g(B, {
									icon: e.icon,
									label: e.label,
									selected: v === e.value,
									onClick: () => y(A, e.value, M)
								}, e.value))
							})]
						})
					})]
				})]
			}),
			/* @__PURE__ */ _(f, {
				gap: "sm",
				children: [/* @__PURE__ */ g(p, {
					textStyle: "label/M/semibold",
					children: "3. Features read the current values"
				}), /* @__PURE__ */ _(u, {
					templateColumns: {
						base: "1fr",
						lg: "repeat(2, minmax(0, 1fr))"
					},
					gap: "md",
					children: [/* @__PURE__ */ g(o, {
						borderWidth: "1px",
						borderColor: "border.subtle",
						p: "md",
						children: /* @__PURE__ */ _(f, {
							gap: "sm",
							children: [/* @__PURE__ */ _(d, {
								justify: "space-between",
								gap: "sm",
								children: [/* @__PURE__ */ g(p, {
									textStyle: "label/S/semibold",
									children: "Editor preview"
								}), /* @__PURE__ */ g(c, {
									colorPalette: "gray",
									children: R(h)
								})]
							}), /* @__PURE__ */ g(f, {
								gap: h === "compact" ? "2xs" : "sm",
								children: L.map((e) => /* @__PURE__ */ g(o, {
									borderWidth: "1px",
									borderColor: "border.subtle",
									px: "sm",
									py: "xs",
									children: /* @__PURE__ */ g(p, {
										textStyle: "paragraph/S/regular",
										children: e
									})
								}, e))
							})]
						})
					}), /* @__PURE__ */ g(o, {
						borderWidth: "1px",
						borderColor: "border.subtle",
						p: "md",
						children: /* @__PURE__ */ _(f, {
							gap: "sm",
							children: [/* @__PURE__ */ _(d, {
								justify: "space-between",
								gap: "sm",
								children: [/* @__PURE__ */ g(p, {
									textStyle: "label/S/semibold",
									children: "New resources open in"
								}), /* @__PURE__ */ g(c, {
									colorPalette: "gray",
									children: R(v)
								})]
							}), /* @__PURE__ */ g(d, {
								gap: "xs",
								wrap: "wrap",
								children: I.map((e) => /* @__PURE__ */ g(a, {
									colorPalette: v === e.value ? "blue" : "gray",
									children: e.label
								}, e.value))
							})]
						})
					})]
				})]
			})
		]
	});
}, H = () => ({
	id: "preferences-example",
	activate(e) {
		e.preferences.registerSchema(P), e.views.registerView({
			id: O,
			title: "Preference schemas",
			body: {
				kind: "react",
				render: (e) => /* @__PURE__ */ g(V, { input: e })
			}
		}), e.shellPlacements.registerPlacement({
			id: O,
			item: {
				kind: "view",
				presence: "fixed",
				view: {
					kind: "view",
					id: O
				}
			},
			region: "main"
		});
	}
}), U = (e) => {
	let { name: t, role: n, uri: r } = e;
	return /* @__PURE__ */ _(h, { children: [
		/* @__PURE__ */ g(p, {
			textStyle: "label/M/medium",
			color: "fg",
			truncate: !0,
			children: t
		}),
		/* @__PURE__ */ g(p, {
			textStyle: "label/XS/medium",
			color: "fg.muted",
			overflowWrap: "anywhere",
			children: n
		}),
		/* @__PURE__ */ g(p, {
			as: "code",
			textStyle: "label/XS/regular",
			color: "fg.subtle",
			overflowWrap: "anywhere",
			children: r
		})
	] });
}, W = (e) => {
	let { name: t, role: n } = e;
	return /* @__PURE__ */ _(d, {
		h: "full",
		minW: "0",
		overflow: "hidden",
		gap: "xs",
		px: "xs",
		children: [/* @__PURE__ */ g(p, {
			textStyle: "label/S/medium",
			color: "fg",
			flexShrink: 0,
			children: t
		}), /* @__PURE__ */ g(p, {
			textStyle: "label/XS/regular",
			color: "fg.muted",
			truncate: !0,
			children: n
		})]
	});
}, G = (e) => {
	let { region: t, name: n, role: r, uri: i } = e;
	return t === "overlay" ? /* @__PURE__ */ g(l, {
		h: "full",
		w: "full",
		p: "xs",
		alignItems: "center",
		justifyContent: "center",
		pointerEvents: "none",
		children: /* @__PURE__ */ g(f, {
			pointerEvents: "auto",
			w: "full",
			children: /* @__PURE__ */ g(U, {
				name: n,
				role: r,
				uri: i
			})
		})
	}) : t === "status" || t === "nav" || t === "main-header" || t === "secondary-header" || t === "side-header" ? /* @__PURE__ */ g(W, {
		name: n,
		role: r
	}) : t === "activity" ? /* @__PURE__ */ g(l, {
		h: "full",
		w: "full",
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
		p: "xs",
		children: /* @__PURE__ */ _(f, {
			alignItems: "center",
			gap: "xs",
			maxH: "full",
			minW: "0",
			overflow: "hidden",
			css: { writingMode: "vertical-rl" },
			children: [/* @__PURE__ */ g(p, {
				textStyle: "label/XS/medium",
				color: "fg",
				truncate: !0,
				children: n
			}), /* @__PURE__ */ g(p, {
				textStyle: "label/XS/regular",
				color: "fg.muted",
				truncate: !0,
				children: r
			})]
		})
	}) : /* @__PURE__ */ g(f, {
		h: "full",
		minH: "0",
		minW: "0",
		justifyContent: "center",
		gap: "2xs",
		overflow: "hidden",
		p: "md",
		children: /* @__PURE__ */ g(U, {
			name: n,
			role: r,
			uri: i
		})
	});
}, K = "workbench-region", q = {
	nav: "Nav (top chrome)",
	activity: "Activity bar",
	sidenav: "Sidenav",
	"main-header": "Main header region",
	"main-left-menu": "Main left menu",
	main: "Main editor region",
	"main-right-menu": "Main right menu",
	"secondary-header": "Secondary header",
	"secondary-left-menu": "Secondary left menu",
	secondary: "Secondary panel",
	"secondary-right-menu": "Secondary right menu",
	status: "Status bar",
	overlay: "Overlay layer",
	"side-header": "Side Panel header",
	"side-left-menu": "Side left menu",
	side: "Side Panel",
	"side-right-menu": "Side right menu"
}, J = (e, t = {}) => ({
	type: K,
	id: t.id ?? e,
	label: t.label ?? q[e],
	icon: "SquareDashed",
	metadata: { region: e }
}), Y = (e) => `region-map.${e}`, X = (t) => {
	if (t !== "nav" && t.endsWith("-header")) return `header region of ${t.slice(0, -7)}`;
	let n = e(t);
	return n.role === "anchor" ? n.anchor === "primary" ? "anchor · primary" : `anchor · ${n.anchor} (${n.persistence}/${n.candidates})` : n.role === "projection" ? `projection → ${n.reads.join(" + ")}${n.navigator ? " · navigator" : ""}` : n.role;
}, te = {
	closeOnInteractOutside: !1,
	modal: !1
}, Z = Y("status"), ne = [
	"nav",
	"activity",
	"sidenav",
	"main-header",
	"main",
	"secondary-header",
	"secondary",
	"side-header",
	"side",
	"overlay"
], Q = [
	"main",
	"secondary",
	"side"
], $ = (e) => {
	let { input: t, region: n } = e, r = J(n), i = /* @__PURE__ */ g(G, {
		region: n,
		role: X(n),
		name: t.instance.resource?.label ?? t.instance.title ?? q[n],
		uri: v(t.instance.resource) ?? v(r)
	});
	return n === "overlay" ? /* @__PURE__ */ g(o, {
		position: "relative",
		h: "full",
		w: "full",
		children: i
	}) : n === "main" ? /* @__PURE__ */ _(f, {
		h: "full",
		w: "full",
		minH: "0",
		minW: "0",
		gap: "0",
		children: [/* @__PURE__ */ g(o, {
			flex: "1",
			minH: "0",
			children: i
		}), /* @__PURE__ */ g(d, {
			justifyContent: "center",
			p: "md",
			children: /* @__PURE__ */ g(s, {
				size: "sm",
				variant: "subtle",
				onClick: () => t.workbench.overlays.openOverlay(Y("overlay")),
				children: "Show overlay"
			})
		})]
	}) : i;
}, re = (e, t) => `${e}-${t}-menu`, ie = (e) => Q.some((t) => t === e), ae = () => ({
	id: "region-map",
	activate(e) {
		e.sidePanel.setMode("attached"), e.resources.registerKind({
			kind: K,
			label: "Workbench region",
			icon: "SquareDashed"
		}), e.views.registerView({
			id: Z,
			title: q.status,
			body: {
				kind: "react",
				render: () => /* @__PURE__ */ g(G, {
					region: "status",
					role: X("status"),
					name: q.status,
					uri: v(J("status"))
				})
			}
		}), e.statusBar.registerItem({
			id: `${Z}.item`,
			viewId: Z,
			slot: "leading"
		});
		for (let t of ne) e.views.registerView({
			id: Y(t),
			title: q[t],
			body: {
				kind: "react",
				render: (e) => /* @__PURE__ */ g($, {
					input: e,
					region: t
				})
			}
		}), t === "overlay" ? e.overlays.registerOverlay({
			id: Y(t),
			viewId: Y(t),
			config: te
		}) : ie(t) || e.shellPlacements.registerPlacement({
			id: Y(t),
			item: {
				kind: "view",
				presence: "fixed",
				view: {
					kind: "view",
					id: Y(t)
				}
			},
			region: t
		});
		for (let t of Q) {
			for (let n of ["left", "right"]) {
				let r = re(t, n), i = Y(r);
				e.views.registerView({
					id: i,
					title: q[r],
					body: {
						kind: "react",
						render: (e) => /* @__PURE__ */ g($, {
							input: e,
							region: r
						})
					}
				}), e.viewMenus.registerViewMenu({
					id: i,
					ownerViewId: Y(t),
					viewId: i,
					side: n,
					regionSize: {
						defaultPx: 160,
						minPx: 120
					}
				});
			}
			e.shellPlacements.registerPlacement({
				id: Y(t),
				item: {
					kind: "view",
					presence: "fixed",
					view: {
						kind: "view",
						id: Y(t)
					}
				},
				region: t
			});
		}
	}
});
export { H as n, ee as r, ae as t };
