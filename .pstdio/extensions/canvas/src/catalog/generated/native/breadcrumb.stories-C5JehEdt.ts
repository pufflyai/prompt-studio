// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, p as t, r as n } from "./test-whhQHjQi.ts";
import { t as r } from "./chevron-right-CRFNEcZT.ts";
import { t as i } from "./file-text-B9-uT4dU.ts";
import { t as a } from "./folder-DJ8ZbA4G.ts";
import { t as o } from "./house-BBkmrnwf.ts";
import { t as s } from "./message-circle-DP0BFDQF.ts";
import { t as c } from "./breadcrumb-Crt-ijRq.ts";
import { useState as l } from "react";
import { Avatar as u, Box as d, Button as f, HStack as p, Icon as m, Text as h } from "@chakra-ui/react";
import { Fragment as g, jsx as _, jsxs as v } from "react/jsx-runtime";
// packages/ui/src/components/primitives/breadcrumb.stories.tsx
var y = {
	title: "Components/Navigation/Breadcrumb",
	component: c,
	decorators: [(e) => /* @__PURE__ */ _(d, {
		padding: "sm",
		background: "bg",
		children: /* @__PURE__ */ _(e, {})
	})],
	args: {
		items: [
			{
				title: /* @__PURE__ */ v(g, { children: [/* @__PURE__ */ _(m, {
					as: o,
					boxSize: "14px"
				}), "Dashboard"] }),
				url: "/"
			},
			{
				title: /* @__PURE__ */ v(g, { children: [/* @__PURE__ */ _(m, {
					as: a,
					boxSize: "14px"
				}), "Invoices"] }),
				url: "/invoices"
			},
			{ title: /* @__PURE__ */ v(g, { children: [/* @__PURE__ */ _(m, {
				as: i,
				boxSize: "14px"
			}), "Northwind Traders Q4 2024"] }) }
		],
		separator: "/",
		separatorGap: "xs"
	}
}, b = {}, x = () => {
	let [e, t] = l("Meeting notes");
	return /* @__PURE__ */ _(c, {
		items: [{ title: "Notes" }, {
			title: e,
			contextMenuActions: [{
				key: "rename",
				label: "Rename note",
				icon: /* @__PURE__ */ _(i, { size: 14 }),
				onClick: () => t("Renamed note")
			}]
		}],
		separator: "/"
	});
}, S = {
	render: () => /* @__PURE__ */ _(x, {}),
	play: async ({ canvasElement: r }) => {
		let i = e(r), a = e(r.ownerDocument.body);
		await t.tab(), await n(i.getByText("Meeting notes", { exact: !0 })).toHaveFocus(), await t.keyboard("{Shift>}{F10}{/Shift}"), await a.findByRole("menuitem", { name: "Rename note" }), await t.keyboard("{Home}{Enter}"), await n(await i.findByText("Renamed note", { exact: !0 })).toBeVisible();
	}
}, C = { args: { separator: /* @__PURE__ */ _(m, {
	as: r,
	boxSize: "12px",
	color: "fg.muted"
}) } }, w = {
	args: { items: [{
		title: /* @__PURE__ */ v(g, { children: [/* @__PURE__ */ _(m, {
			as: a,
			boxSize: "14px"
		}), "Projects"] }),
		url: "/"
	}, { title: /* @__PURE__ */ v(g, { children: [/* @__PURE__ */ _(m, {
		as: i,
		boxSize: "14px"
	}), "PS-246 Update chat panel styles and responsive properties panel"] }) }] },
	decorators: [(e) => /* @__PURE__ */ _(d, {
		padding: "sm",
		background: "bg",
		width: "220px",
		children: /* @__PURE__ */ _(e, {})
	})]
}, T = { args: { items: [{ title: /* @__PURE__ */ v(g, { children: [/* @__PURE__ */ _(m, {
	as: a,
	boxSize: "14px"
}), "Sessions"] }) }, { title: /* @__PURE__ */ v(g, { children: [/* @__PURE__ */ _(m, {
	as: i,
	boxSize: "14px"
}), "Current session"] }) }] } }, E = {
	args: { items: [{
		title: /* @__PURE__ */ v(g, { children: [/* @__PURE__ */ _(m, {
			as: s,
			boxSize: "14px"
		}), "Sessions"] }),
		url: "/sessions"
	}, { title: /* @__PURE__ */ v(g, { children: [/* @__PURE__ */ _(m, {
		as: s,
		boxSize: "14px"
	}), "Level session"] }) }] },
	render: (e) => /* @__PURE__ */ v(p, {
		gap: "xs",
		minW: "0",
		children: [
			/* @__PURE__ */ _(f, {
				px: "xs",
				variant: "ghost",
				size: "xs",
				minW: "0",
				justifyContent: "flex-start",
				_hover: { bg: "bg.menu-item.hover" },
				_active: { bg: "bg.menu-item.selected" },
				children: /* @__PURE__ */ v(p, {
					gap: "xs",
					minW: "0",
					children: [/* @__PURE__ */ _(u.Root, {
						size: "2xs",
						children: /* @__PURE__ */ _(u.Fallback, {
							name: "Prompt Studio",
							background: "bg.muted",
							color: "fg.muted"
						})
					}), /* @__PURE__ */ _(h, {
						textStyle: "label/S/medium",
						truncate: !0,
						children: "Prompt Studio"
					})]
				})
			}),
			/* @__PURE__ */ _(h, {
				"aria-hidden": "true",
				color: "fg.subtle",
				flexShrink: 0,
				children: "/"
			}),
			/* @__PURE__ */ _(c, { ...e })
		]
	})
};
export { b as Default, C as IconSeparator, w as Narrow, E as ProjectCrumb, S as ResourceActions, T as StaticAncestor, y as default };
