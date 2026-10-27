// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { B as e } from "./workbench-core-N58OeDyx.ts";
import { t } from "./icon-D3uE7jD-.ts";
import { r as n } from "./resource-actions-B6hNjsqI.ts";
import { t as r } from "./resource-menu-BPUwurff.ts";
import { t as i } from "./panel-widget-open-DNEH0WG4.ts";
import { useId as a, useRef as o } from "react";
import { Menu as s, Portal as c, VisuallyHidden as l, useMenu as u } from "@chakra-ui/react";
import { ResourceMenuItems as d } from "@pstdio/ui";
import { jsx as f, jsxs as p } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/region/region-tab-menu.tsx
var m = (u) => {
	let { menu: m, label: h, groups: g, placement: _, workbench: v } = u, y = a();
	n(v);
	let b = o(null), x = e(v.layout.getLayout(), _.widgetId)?.regionId, S = v.getPanelDestinations(_.widgetId).filter((e) => e !== x), C = () => {
		let e = _.tabRetention === "preview";
		_.placementIdentity ? v.pinPlacement(_.placementIdentity, e) : v.layout.updatePanel(_.widgetId, { strategy: { kind: e ? "persistent" : "preview" } });
	}, w = () => {
		_.placementIdentity ? v.closePlacement(_.placementIdentity) : v.layout.closePanel(_.widgetId);
	}, T = (e, n, r, i) => ({
		key: e,
		label: n,
		icon: /* @__PURE__ */ f(t, {
			name: r,
			size: 14
		}),
		group: {
			id: "tab",
			label: "Tab"
		},
		...i
	}), E = [
		...r(v, _.resource, { menu: g }, _),
		..._.tabRetention ? [T("pin", _.tabRetention === "preview" ? "Pin tab" : "Unpin tab", "pin", { onSelect: C })] : [],
		...S.map((e) => T(`move-${e}`, `Move to ${i(e)}`, "ArrowRight", { onClick: () => v.movePanel(_.widgetId, e) })),
		..._.closable ? [T("close", "Close tab", "x", { onClick: w })] : [],
		T("reset-layout", "Reset layout", "RotateCcw", { onClick: () => v.resetLayout() })
	];
	return /* @__PURE__ */ f(s.RootProvider, {
		value: m,
		lazyMount: !0,
		unmountOnExit: !0,
		onExitComplete: () => {
			let e = b.current;
			if (b.current = null, e) {
				let e = m.api.getContentProps().id, t = e ? document.getElementById(e) : null, n = document.activeElement;
				if (n === document.body || t?.contains(n)) {
					let e = m.api.getTriggerProps().id;
					e && document.getElementById(e)?.focus({ preventScroll: !0 });
				}
			}
			e?.onClick?.();
		},
		children: /* @__PURE__ */ f(c, { children: /* @__PURE__ */ f(s.Positioner, { children: /* @__PURE__ */ p(s.Content, {
			"aria-labelledby": y,
			children: [/* @__PURE__ */ p(l, {
				id: y,
				children: [h, " context menu"]
			}), m.api.open ? /* @__PURE__ */ f(d, {
				actions: E,
				onSelect: (e) => {
					b.current = e, e.onSelect?.();
				}
			}) : null]
		}) }) })
	});
}, h = (e, t = !1) => {
	let n = o({
		x: 0,
		y: 0,
		width: 0,
		height: 0
	}), r = o(null), i = u({
		ids: { trigger: e },
		positioning: {
			placement: "bottom-start",
			getAnchorRect: () => n.current,
			offset: { mainAxis: 0 }
		},
		onEscapeKeyDown: () => {
			let e = r.current;
			e && requestAnimationFrame(() => e.focus({ preventScroll: !0 }));
		}
	});
	return {
		menu: i,
		show: (e) => {
			if (t) return;
			let n = e.getBoundingClientRect();
			e.dispatchEvent(new window.MouseEvent("contextmenu", {
				bubbles: !0,
				cancelable: !0,
				clientX: n.left,
				clientY: n.bottom
			}));
		},
		onContextMenu: (e) => {
			t ? e.preventDefault() : (e.stopPropagation(), r.current = e.currentTarget, n.current = e.currentTarget.getBoundingClientRect(), i.api.getContextTriggerProps().onContextMenu?.(e));
		}
	};
};
export { m as n, h as t };
