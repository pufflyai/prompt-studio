// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./tooltip-BweQW627.ts";
import { t } from "./icon-options-BaFkbkcp.ts";
import { t as n } from "./list-row-BhxGCvIh.ts";
import { useState as r } from "react";
import { Button as i, Field as a, HStack as o, Icon as s, Input as c, Menu as l, Popover as u, Portal as d, Stack as f, Tag as p, Text as m, chakra as h, useSlotRecipe as g } from "@chakra-ui/react";
import { jsx as _, jsxs as v } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/components/harness-controls.tsx
var y = (t) => {
	let { tag: n } = t;
	return /* @__PURE__ */ v(l.Root, { children: [/* @__PURE__ */ _(e, {
		content: n.description,
		closeDelay: 150,
		children: /* @__PURE__ */ v(p.Root, {
			variant: "ticket",
			size: "composer",
			children: [/* @__PURE__ */ _(l.Trigger, {
				asChild: !0,
				children: /* @__PURE__ */ _(p.Label, {
					asChild: !0,
					children: /* @__PURE__ */ _("button", {
						type: "button",
						"aria-label": n.description,
						children: n.label
					})
				})
			}), /* @__PURE__ */ _(p.CloseTrigger, {
				"aria-label": n.closeLabel ?? `Remove ${n.label}`,
				onClick: n.onClose
			})]
		})
	}), /* @__PURE__ */ _(d, { children: /* @__PURE__ */ _(l.Positioner, { children: /* @__PURE__ */ _(l.Content, { children: /* @__PURE__ */ _(m, {
		p: "sm",
		textStyle: "label/S/regular",
		overflowWrap: "anywhere",
		children: n.description
	}) }) }) })] });
}, b = (l) => {
	let { mode: y, pending: b, unavailable: x, onRequestConfirmation: S, onAction: C } = l, w = g({ key: "menu" })(), [T, E] = r(null), [D, O] = r(""), [k, A] = r(!1), j = y.actions.find((e) => e.id === y.closeActionId && !e.argument), M = async (e, t, n = y) => {
		try {
			return await C(y.id, e.id, t, n), E(null), A(!1), !0;
		} catch {
			return !1;
		}
	}, N = y.state;
	return b && (N = `Checking · Last confirmed: ${y.state}`), x && (N = `Status unavailable · Last confirmed: ${y.state}`), /* @__PURE__ */ v(u.Root, {
		open: k,
		positioning: { placement: "top-start" },
		onOpenChange: (e) => {
			A(e.open), e.open || E(null);
		},
		children: [/* @__PURE__ */ _(e, {
			content: `${y.label}: ${y.description} · ${N}`,
			closeDelay: 150,
			children: /* @__PURE__ */ v(p.Root, {
				variant: "ticket",
				size: "composer",
				children: [
					y.indicator ? /* @__PURE__ */ _(p.StartElement, { children: /* @__PURE__ */ _(h.span, {
						role: "img",
						"aria-label": x ? "Status unavailable" : y.indicator.label,
						"data-status-dot": "",
						"data-tone": x ? "neutral" : y.indicator.tone
					}) }) : null,
					/* @__PURE__ */ _(u.Trigger, {
						asChild: !0,
						children: /* @__PURE__ */ _(p.Label, {
							asChild: !0,
							children: /* @__PURE__ */ _("button", {
								type: "button",
								"aria-label": `${y.label} details`,
								children: y.label
							})
						})
					}),
					j ? /* @__PURE__ */ _(p.CloseTrigger, {
						"aria-label": j.label,
						disabled: b || x,
						onClick: () => void M(j)
					}) : null
				]
			})
		}), /* @__PURE__ */ _(d, { children: /* @__PURE__ */ _(u.Positioner, { children: /* @__PURE__ */ v(u.Content, {
			css: w.content,
			"aria-label": `${y.label} details`,
			children: [/* @__PURE__ */ v(f, {
				p: "sm",
				gap: "xs",
				children: [
					/* @__PURE__ */ _(m, {
						textStyle: "label/S/medium",
						children: y.label
					}),
					/* @__PURE__ */ _(m, {
						textStyle: "label/S/regular",
						overflowWrap: "anywhere",
						children: y.description
					}),
					/* @__PURE__ */ _(m, {
						textStyle: "label/XS/regular",
						color: "fg.muted",
						children: N
					}),
					T?.action.argument ? /* @__PURE__ */ v(a.Root, { children: [
						/* @__PURE__ */ _(a.Label, { children: T.action.argument.label }),
						/* @__PURE__ */ _(c, {
							autoFocus: !0,
							size: "sm",
							value: D,
							onChange: (e) => O(e.target.value)
						}),
						/* @__PURE__ */ v(o, { children: [/* @__PURE__ */ _(i, {
							size: "xs",
							variant: "ghost",
							onClick: () => E(null),
							children: "Cancel"
						}), /* @__PURE__ */ _(i, {
							size: "xs",
							variant: "ghost",
							disabled: b || x || !D.trim(),
							onClick: () => void M(T.action, D, T.mode),
							children: "Apply"
						})] })
					] }) : null
				]
			}), T ? null : y.actions.map((e) => /* @__PURE__ */ _(n, {
				role: "button",
				variant: "full-width",
				label: e.label,
				icon: e.icon ? /* @__PURE__ */ _(s, {
					as: t(e.icon),
					boxSize: "icon-xs"
				}) : void 0,
				disabled: b || x || e.id === y.confirmation?.actionId && !S,
				onActivate: () => {
					e.id === y.confirmation?.actionId ? (A(!1), S?.(y.id)) : e.argument ? (O(e.argument.value ?? ""), E({
						action: e,
						mode: y
					})) : M(e);
				}
			}, e.id))]
		}) }) })]
	});
}, x = (e) => {
	let { modes: t, draftTag: n, sentTag: r, pending: i, unavailable: a, onRequestConfirmation: s, onAction: c } = e;
	return /* @__PURE__ */ v(o, {
		gap: "2xs",
		minW: "0",
		"aria-label": "Harness controls",
		children: [
			t.map((e) => /* @__PURE__ */ _(b, {
				mode: e,
				pending: i,
				unavailable: a,
				onRequestConfirmation: s,
				onAction: c
			}, e.id)),
			n ? /* @__PURE__ */ _(y, { tag: n }) : null,
			r ? /* @__PURE__ */ _(y, { tag: r }) : null
		]
	});
};
export { x as t };
