// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, s as t, t as n } from "./test-CYwQ_LKY.ts";
import { t as r } from "./workbench-core-N58OeDyx.ts";
import { t as i } from "./workbench-story-B6F8bQqu.ts";
import { jsx as a } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/breadcrumb/page-grouping.stories.tsx
var o = (e = !1, t) => {
	let n = r();
	n.modes.registerMode({
		id: "project",
		activate() {}
	}), n.views.registerView({
		id: "reader",
		title: "Message",
		body: {
			kind: "react",
			render: () => null
		}
	});
	let i = {
		kind: "page",
		extensionId: "example",
		id: "messages"
	}, a = {
		...i,
		id: "compose"
	};
	n.pages.registerPage({
		id: i.id,
		ref: i,
		title: "Messages",
		icon: "messages-circle",
		path: "messages",
		modeId: "project",
		main: {
			kind: "group",
			default: a
		},
		slots: []
	}), n.pages.registerPage({
		id: a.id,
		ref: a,
		title: "New message",
		icon: "message-circle",
		path: "messages/new",
		modeId: "project",
		parentId: i.id,
		main: {
			kind: "view",
			view: {
				kind: "view",
				id: "reader"
			},
			presentation: "page",
			cardinality: "one",
			tab: { getSnapshot: () => ({
				label: "New message",
				icon: "message-circle"
			}) }
		},
		slots: []
	});
	let o = {
		...i,
		id: "message"
	};
	return n.pages.registerPage({
		id: o.id,
		ref: o,
		title: "Message",
		path: "messages/view",
		modeId: "project",
		parentId: i.id,
		resource: { kinds: [{
			kind: "resource-kind",
			id: "session",
			extensionId: "example"
		}] },
		main: {
			kind: "view",
			view: {
				kind: "view",
				id: "reader"
			},
			presentation: "page",
			cardinality: "one",
			tab: { getSnapshot: () => ({
				label: t,
				icon: t ? "book-open" : void 0
			}) }
		},
		slots: []
	}), n.pageLocations.setProject("page-grouping-story"), n.pageLocations.navigate(e ? {
		kind: "page",
		page: o,
		resource: {
			type: "session",
			extensionId: "example",
			id: "one",
			label: t ? void 0 : "First message",
			icon: "message-circle",
			metadata: { status: "completed" }
		}
	} : {
		kind: "page",
		page: i
	}), n;
}, s = {
	title: "pstdio-workbench/Reference/Core API/Page grouping breadcrumbs",
	component: i,
	parameters: { layout: "fullscreen" },
	tags: ["page-grouping"]
}, c = async (e, r = "message-circle") => {
	let i = t(e), a = t(i.getByRole("navigation", { name: "breadcrumb" }));
	await n(a.getByText("Messages", { exact: !0 })).toBeVisible(), await n(a.queryByRole("button", { name: "Messages" })).toBeNull(), await n(a.queryByRole("link", { name: "Messages" })).toBeNull(), await n(e.querySelector("svg.lucide-messages-circle")).toBeVisible(), await n(e.querySelector(`svg.lucide-${r}`)).toBeVisible();
}, l = {
	args: { workbench: o() },
	play: async ({ canvasElement: e }) => c(e)
}, u = {
	args: { workbench: o(!0) },
	play: async ({ canvasElement: e }) => c(e)
}, d = {
	args: { workbench: o(!0, "Rendered message") },
	play: async ({ canvasElement: e }) => {
		await c(e, "book-open");
		let r = t(t(e).getByRole("navigation", { name: "breadcrumb" }));
		await n(r.getByText("Rendered message", { exact: !0 })).toBeVisible();
	}
}, f = {
	args: { workbench: p() },
	play: async ({ canvasElement: r }) => {
		let i = t(r), a = t(i.getByRole("navigation", { name: "breadcrumb" }));
		await e.click(a.getByRole("button", { name: "Library" })), await n(await i.findByText("Browser content", { exact: !0 })).toBeVisible(), await n(a.queryByRole("button", { name: "Library" })).toBeNull();
	}
};
function p() {
	let e = r();
	e.modes.registerMode({
		id: "project",
		activate() {}
	}), e.views.registerView({
		id: "browser",
		title: "Library",
		body: {
			kind: "react",
			render: () => /* @__PURE__ */ a("div", { children: "Browser content" })
		}
	}), e.views.registerView({
		id: "editor",
		title: "Editor",
		body: {
			kind: "react",
			render: () => null
		}
	});
	let t = {
		kind: "page",
		extensionId: "example",
		id: "library"
	}, n = {
		...t,
		id: "document"
	};
	return e.pages.registerPage({
		id: t.id,
		ref: t,
		title: "Library",
		path: "library",
		modeId: "project",
		main: {
			kind: "view",
			view: {
				kind: "view",
				id: "browser"
			},
			cardinality: "one",
			presentation: "page"
		},
		slots: []
	}), e.pages.registerPage({
		id: n.id,
		ref: n,
		title: "Document",
		path: "document",
		modeId: "project",
		parentId: t.id,
		resource: { kinds: [{
			kind: "resource-kind",
			id: "document"
		}] },
		main: {
			kind: "view",
			view: {
				kind: "view",
				id: "editor"
			},
			cardinality: "one",
			presentation: "page"
		},
		slots: []
	}), e.pageLocations.setProject("browser-breadcrumb-story"), e.pageLocations.navigate({
		kind: "page",
		page: n,
		resource: {
			type: "document",
			id: "one",
			label: "First document"
		}
	}), e;
}
export { f as BrowserParent, l as Landing, d as RendererLabel, u as SelectedResource, s as default };
