// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, t } from "./QueryClientProvider-LIjzams-.ts";
import { t as n } from "./useQuery-OeRqqLZF.ts";
import { t as r } from "./queryClient-BgKKh9f4.ts";
import { t as i } from "./events-C3q9NYT-.ts";
import { StrictMode as a, useEffect as o } from "react";
import { Box as s } from "@chakra-ui/react";
import { ChakraProvider as c, ScrollArea as l, TagSettingsPanel as u, psTheme as d } from "@pstdio/ui";
import { jsx as f } from "react/jsx-runtime";
import { createWebviewClient as p, defineExtensionView as m } from "@pstdio/sdk/extensions";
import "@pstdio/ui/style.css";
import { createRoot as h } from "react-dom/client";
// extensions/pstdio-planner/src/views/view-root.tsx
var g = (e, n) => {
	let i = new r(), o = h(e);
	return o.render(/* @__PURE__ */ f(a, { children: /* @__PURE__ */ f(t, {
		client: i,
		children: /* @__PURE__ */ f(c, {
			value: d,
			children: n
		})
	}) })), () => o.unmount();
}, _ = (e) => ({
	...e,
	name: e.label
}), v = (e) => ({
	...e,
	label: e.name
}), y = (e, t) => e.label !== t.name || e.color !== t.color || e.icon !== t.icon || e.isDefault !== t.isDefault || JSON.stringify(e.actions ?? []) !== JSON.stringify(t.actions ?? []), b = (t) => {
	let { host: r } = t, a = p(r), s = e(), c = ["ticket-status-settings"], d = n({
		queryKey: c,
		queryFn: async () => (await a.commands["ticket-status.read-settings"]()).statuses
	});
	return o(() => p(r).events.subscribe(i, () => {
		s.invalidateQueries({ queryKey: ["ticket-status-settings"] });
	}), [r, s]), /* @__PURE__ */ f(l, {
		h: "full",
		minH: "0",
		children: /* @__PURE__ */ f(u, {
			values: d.data,
			loadError: d.error,
			onSave: async (e) => {
				let t = await a.commands["ticket-status.save-settings"]({ statuses: e.drafts.map(v) });
				s.setQueryData(c, t.statuses);
			},
			toEditorValue: _,
			valueNeedsUpdate: y,
			title: "Ticket status",
			actionsLabel: "Commands",
			actionOptions: [{
				value: "create",
				label: "Create"
			}, {
				value: "archive_all",
				label: "Archive all"
			}],
			framed: !0,
			showColumnHeaders: !0,
			valueColumnLabel: "State",
			showDefault: !0,
			errorTitle: "Unable to update ticket statuses",
			addLabel: "Add state",
			addName: "New status",
			resetLabel: "Reset",
			saveLabel: "Save",
			deleteHeadline: "Delete status?",
			deleteNotificationText: (e) => `This will delete the "${e.name}" status.`,
			deleteButtonText: "Delete status"
		})
	});
};
m({ render({ mount: e, host: t }) {
	return g(e, /* @__PURE__ */ f(b, { host: t }));
} });
var x = {
	title: "Extensions/Planner/Status settings",
	component: () => /* @__PURE__ */ f(c, {
		value: d,
		children: /* @__PURE__ */ f(t, {
			client: new r(),
			children: /* @__PURE__ */ f(s, {
				h: "600px",
				children: /* @__PURE__ */ f(b, { host: {
					extensionId: "pstdio.pstdio-planner",
					call: (async () => ({ outcome: {
						ok: !0,
						status: "success",
						value: { statuses: [{
							id: "backlog",
							label: "Backlog",
							color: "gray",
							sortOrder: 0,
							isDefault: !0,
							actions: ["create"]
						}, {
							id: "done",
							label: "Done",
							color: "green",
							sortOrder: 1,
							actions: ["archive_all"]
						}] }
					} })),
					onEvent: () => () => {}
				} })
			})
		})
	})
}, S = {};
export { S as Default, x as default };
