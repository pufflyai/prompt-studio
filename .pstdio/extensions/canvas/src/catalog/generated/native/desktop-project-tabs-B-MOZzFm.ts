// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./folder-DJ8ZbA4G.ts";
import { t } from "./plus-CYkLGSPS.ts";
import { t as n } from "./use-workbench-store-BMaFgEbb.ts";
import { n as r, t as i } from "./workbench-panel-toggles-BmSTzznX.ts";
import { n as a } from "./project-context-BR7AjHlE.ts";
import { t as o } from "./commands-Bp5w85f4.ts";
import { a as s, t as c } from "./dashboard-rows-B7KuOiwh.ts";
import { n as l } from "./project-data-C6bf_vDa.ts";
import { useSyncExternalStore as u } from "react";
import { IconButton as d } from "@chakra-ui/react";
import { Tooltip as f, WindowTabs as p, WindowTitleBar as m } from "@pstdio/ui";
import { Fragment as h, jsx as g, jsxs as _ } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/projects/components/desktop-project-tabs.tsx
var v = (t, n) => t.flatMap((t) => {
	let n = l(t);
	return n ? [{
		id: t,
		label: n.name,
		icon: /* @__PURE__ */ g(e, { "aria-hidden": "true" })
	}] : [];
}), y = (e) => {
	let { workbench: l, controller: y, platform: b } = e, x = u(y.subscribe, y.getProjectIds, y.getProjectIds), S = u(s, c, c), C = n(l.context.store, (e) => e.values[a]), w = v(x, S);
	return typeof C == "string" ? /* @__PURE__ */ _(m, {
		platform: b,
		actions: /* @__PURE__ */ _(h, { children: [/* @__PURE__ */ g(i, { workbench: l }), /* @__PURE__ */ g(r, { workbench: l })] }),
		children: [/* @__PURE__ */ g(p, {
			tabs: w,
			selectedId: typeof C == "string" ? C : void 0,
			"aria-label": "Project tabs",
			onSelect: (e) => {
				e === C ? l.pageLocations.navigateToRootLevel() : y.select(l, e);
			},
			onClose: (e) => void y.close(l, e),
			onReorder: (e, t) => y.reorder(l, e, t)
		}), /* @__PURE__ */ g(f, {
			content: "Open / create project",
			positioning: { placement: "bottom" },
			children: /* @__PURE__ */ g(d, {
				"aria-label": "Open / create project",
				variant: "ghost",
				size: "xs",
				onClick: () => void l.commands.executeCommand(o.openProjects),
				children: /* @__PURE__ */ g(t, {})
			})
		})]
	}) : /* @__PURE__ */ g(m, { platform: b });
};
export { y as t };
