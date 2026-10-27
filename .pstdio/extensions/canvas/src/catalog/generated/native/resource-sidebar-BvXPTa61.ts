// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./arrow-up-right-CUuzCgQb.ts";
import { t } from "./book-open-OD77qyyJ.ts";
import { t as n } from "./circle-dot-DzEudT09.ts";
import { t as r } from "./maximize-2-YC7VD5Yz.ts";
import { t as i } from "./menu-BWYEQEaZ.ts";
import { t as a } from "./messages-square-BlwGm9iJ.ts";
import { t as o } from "./minimize-2-n6cCtFPr.ts";
import { t as s } from "./minus-BdT0RA0-.ts";
import { t as c } from "./newspaper-DQI2-Eer.ts";
import { t as l } from "./x-DqEAa6-d.ts";
import { n as u } from "./use-landing-styles-CQWLl3TI.ts";
import { n as d, r as f, t as p } from "./landing-content-Dr_aPkzK.ts";
import { a as m, o as h } from "./landing-route-DJns_G_o.ts";
import { i as g, n as _ } from "./landing-modules-CRGdVMXC.ts";
import { Suspense as v, useEffect as y, useRef as b, useState as x } from "react";
import { Box as S, Button as C, HStack as w, IconButton as T, Kbd as E, Link as D, Text as O, chakra as k } from "@chakra-ui/react";
import { ListRow as A, ScrollArea as j, Tooltip as M } from "@pstdio/ui";
import { Fragment as N, jsx as P, jsxs as F } from "react/jsx-runtime";
// clients/landing-page/src/services/analytics.ts
var I = async () => ({ capture: () => {} }), L = () => {
	let e = { page_path: window.location.pathname };
	I().then((t) => t.capture("landing_action_menu_opened", e)).catch(() => {});
}, R = (e, t) => {
	let n = {
		page_path: window.location.pathname,
		control: e,
		windowed_before: t,
		windowed_after: !t
	};
	I().then((e) => e.capture("landing_window_control_clicked", n)).catch(() => {});
}, z = () => /* @__PURE__ */ F("svg", {
	width: "100%",
	height: "100%",
	viewBox: "0 0 26 26",
	fill: "none",
	xmlns: "http://www.w3.org/2000/svg",
	children: [/* @__PURE__ */ P("title", { children: "Prompt Studio" }), /* @__PURE__ */ P("path", {
		fillRule: "evenodd",
		clipRule: "evenodd",
		d: "M8 0C3.58172 0 0 3.58172 0 8V18C0 22.4183 3.58172 26 8 26H18C22.4183 26 26 22.4183 26 18V8C26 3.58172 22.4183 0 18 0H8ZM13 11C13 12.6569 11.6569 14 10 14C8.34315 14 7 12.6569 7 11C7 9.34315 8.34315 8 10 8C11.6569 8 13 9.34315 13 11ZM15 11C15 13.7614 12.7614 16 10 16C7.23858 16 5 13.7614 5 11C5 8.23858 7.23858 6 10 6C12.7614 6 15 8.23858 15 11Z",
		fill: "currentColor"
	})]
}), B = (e) => {
	let { open: t, onOpen: n } = e, r = u(), [i, a] = x("Ctrl");
	return y(() => a(navigator.platform.toLowerCase().includes("mac") ? "⌘" : "Ctrl"), []), /* @__PURE__ */ P(M, {
		content: "Open action menu",
		openDelay: 300,
		closeDelay: 150,
		children: /* @__PURE__ */ P(C, {
			type: "button",
			variant: "ghost",
			size: "xs",
			css: r.actionMenuButton,
			"aria-label": "Open action menu",
			"aria-haspopup": "dialog",
			"aria-expanded": t,
			"aria-keyshortcuts": "Meta+P Control+P",
			onClick: n,
			onPointerDown: (e) => e.stopPropagation(),
			onDoubleClick: (e) => e.stopPropagation(),
			children: /* @__PURE__ */ F(E, {
				variant: "plain",
				size: "sm",
				children: [i, " P"]
			})
		})
	});
}, V = [
	{
		section: "studio",
		label: "Prompt Studio",
		icon: /* @__PURE__ */ P(z, {})
	},
	{
		section: "docs",
		label: "Docs",
		icon: /* @__PURE__ */ P(t, {})
	},
	{
		section: "blog",
		label: "Blog",
		icon: /* @__PURE__ */ P(c, {})
	}
], H = (e) => {
	let { selected: t, sectionPath: n } = e, r = u(), i = b(null);
	return y(() => {
		let e = i.current, n = () => {
			e.querySelector(`[data-section="${t}"]`)?.scrollIntoView({
				block: "nearest",
				inline: "nearest"
			});
		};
		n();
		let r = new ResizeObserver(n);
		return r.observe(e), () => r.disconnect();
	}, [t]), /* @__PURE__ */ P(w, {
		as: "nav",
		ref: i,
		"aria-label": "Site",
		css: r.siteTabs,
		children: V.map((e) => /* @__PURE__ */ F(k.a, {
			href: n(e.section),
			"data-section": e.section,
			css: r.siteTab,
			"aria-current": e.section === t ? "page" : void 0,
			onPointerDown: (e) => e.stopPropagation(),
			onDoubleClick: (e) => e.stopPropagation(),
			children: [/* @__PURE__ */ P(S, {
				css: r.siteTabIcon,
				"aria-hidden": "true",
				children: e.icon
			}), /* @__PURE__ */ P(O, {
				as: "span",
				css: r.siteTabLabel,
				children: e.label
			})]
		}, e.section))
	});
}, U = (e) => {
	let { windowed: t, selected: n, sectionPath: a, onToggleWindowed: c, onTitleBarPointerDown: d, onTitleBarDoubleClick: f, actionMenuOpen: p, onOpenActionMenu: m } = e, h = u(t), g = [
		{
			id: "close",
			label: "Close",
			icon: l,
			disabled: t
		},
		{
			id: "minimize",
			label: "Minimize",
			icon: s,
			disabled: t
		},
		{
			id: "zoom",
			label: t ? "Expand window" : "Collapse window",
			icon: t ? r : o,
			disabled: !1
		}
	];
	return /* @__PURE__ */ F(N, { children: [/* @__PURE__ */ F(S, {
		css: h.mobileTitlebar,
		children: [/* @__PURE__ */ F(k.a, {
			href: "/",
			css: h.siteTab,
			"aria-label": "Prompt Studio home",
			children: [/* @__PURE__ */ P(S, {
				css: h.siteTabIcon,
				children: /* @__PURE__ */ P(z, {})
			}), /* @__PURE__ */ P(O, {
				as: "span",
				css: h.siteTabLabel,
				children: "Prompt Studio"
			})]
		}), /* @__PURE__ */ P(T, {
			"aria-label": "Open navigation menu",
			"aria-haspopup": "dialog",
			"aria-expanded": p,
			variant: "ghost",
			size: "sm",
			onClick: m,
			children: /* @__PURE__ */ P(i, {})
		})]
	}), /* @__PURE__ */ F(S, {
		css: h.titlebar,
		onPointerDown: d,
		onDoubleClick: f,
		children: [
			/* @__PURE__ */ P(S, {
				className: "group",
				css: h.windowControls,
				onPointerDown: (e) => e.stopPropagation(),
				onDoubleClick: (e) => e.stopPropagation(),
				children: g.map((e) => /* @__PURE__ */ P(k.button, {
					type: "button",
					css: h.windowControl,
					"data-control": e.id,
					disabled: e.disabled,
					"aria-label": e.label,
					title: e.label,
					onClick: () => {
						R(e.id, t), c();
					},
					children: /* @__PURE__ */ P(e.icon, { strokeWidth: 3 })
				}, e.id))
			}),
			/* @__PURE__ */ P(H, {
				selected: n,
				sectionPath: a
			}),
			/* @__PURE__ */ P(B, {
				open: p,
				onOpen: m
			})
		]
	})] });
}, W = [{
	label: "Issues",
	icon: n,
	href: d.issues
}, {
	label: "Discord",
	icon: a,
	href: d.discord
}], G = (e) => {
	let { page: t } = e;
	return p.map((e) => {
		let n = f[e];
		return /* @__PURE__ */ P(A, {
			icon: /* @__PURE__ */ P(n.icon, {}),
			label: n.label,
			href: m(e),
			role: "link",
			isSelected: e === t.view,
			"aria-current": e === t.view ? "page" : void 0
		}, e);
	});
}, K = (t) => {
	let { page: n, pages: r, onNavigate: i } = t, a = u(), o = h(n);
	return /* @__PURE__ */ F(S, {
		as: "nav",
		"aria-label": "Sections",
		css: a.sidebar,
		children: [/* @__PURE__ */ P(j, {
			css: a.sidebarScroll,
			showVerticalScrollbar: !1,
			children: /* @__PURE__ */ F(S, {
				css: a.sidebarRows,
				children: [o === "studio" && /* @__PURE__ */ P(G, { page: n }), /* @__PURE__ */ F(v, {
					fallback: null,
					children: [o === "docs" && /* @__PURE__ */ P(g.Component, {
						page: n,
						pages: r,
						onNavigate: i
					}), o === "blog" && /* @__PURE__ */ P(_.Component, {
						page: n,
						pages: r
					})]
				})]
			})
		}), /* @__PURE__ */ F(S, {
			css: a.sidebarFooter,
			children: [/* @__PURE__ */ P(O, {
				css: a.sidebarHeading,
				children: "GET INVOLVED"
			}), W.map((t) => /* @__PURE__ */ P(D, {
				href: t.href,
				target: "_blank",
				rel: "noopener",
				variant: "plain",
				children: /* @__PURE__ */ P(A, {
					icon: /* @__PURE__ */ P(t.icon, {}),
					label: t.label,
					endContent: /* @__PURE__ */ P(e, { size: 12 }),
					width: "full"
				})
			}, t.label))]
		})]
	});
};
export { U as n, L as r, K as t };
