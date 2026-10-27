// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, p as t, r as n } from "./test-whhQHjQi.ts";
import { t as r } from "./folder-picker-dialog-BV80klEG.ts";
import { useLayoutEffect as i, useState as a } from "react";
import { jsx as o } from "react/jsx-runtime";
// packages/ui/src/components/overlays/folder-picker-dialog.stories.tsx
var s = {
	title: "Overlays/FolderPickerDialog",
	component: r,
	tags: ["folder-picker"],
	parameters: { docs: { description: { component: "Open a project in an existing folder or create a folder first. The host owns navigation and creation. Hidden folders start hidden; press Cmd/Ctrl+Shift+. to toggle them. Matches the folder picker states in Pencil node LmcML." } } },
	args: {
		open: !0,
		currentPath: "/Users/alex/Documents",
		entries: [
			".research",
			"1234",
			"Drafts",
			"研究"
		].map((e) => ({
			name: e,
			path: `/Users/alex/Documents/${e}`,
			isDirectory: !0
		})),
		onClose: () => {},
		onSelect: () => {},
		onNavigate: () => {},
		onCreateFolder: async () => {}
	}
}, c = { play: async ({ canvasElement: r }) => {
	let i = e(r.ownerDocument.body), a = i.getByRole("button", { name: "Go to home directory" }).getBoundingClientRect(), o = i.getByRole("textbox", { name: "Folder path" }).getBoundingClientRect(), s = i.getByRole("button", {
		name: "New folder",
		exact: !0
	}).getBoundingClientRect(), c = i.getByRole("textbox", { name: "Filter folders" }), l = c.getBoundingClientRect();
	await n(a.width).toBeCloseTo(a.height, 0), await n(o.y).toBeCloseTo(a.y, 0), await n(s.y).toBeCloseTo(a.y, 0), await n(l.width).toBeCloseTo(s.right - a.x, 0), await t.type(c, "Draft"), await n(e(i.getByLabelText("Folders")).getAllByRole("option")).toHaveLength(1), await t.clear(c);
} }, l = { args: { entries: [] } }, u = { args: { isLoading: !0 } }, d = (e) => {
	let [t, n] = a({
		currentPath: "",
		isLoading: !0
	});
	return i(() => {
		let e = () => n({
			currentPath: "/Users/alex/Documents",
			isLoading: !1
		});
		return document.addEventListener("folder-picker-list-loaded", e, { once: !0 }), () => document.removeEventListener("folder-picker-list-loaded", e);
	}, []), /* @__PURE__ */ o(r, {
		...e,
		...t
	});
}, f = {
	tags: ["!manifest", "folder-path-regression"],
	render: (e) => /* @__PURE__ */ o(d, { ...e }),
	play: async ({ canvasElement: r }) => {
		let i = e(r.ownerDocument.body).getByRole("textbox", { name: "Folder path" });
		await n(i).toBeDisabled();
		let a = Promise.withResolvers(), o = new MutationObserver(() => {
			i.disabled || (o.disconnect(), a.resolve(i.value));
		});
		o.observe(i, {
			attributes: !0,
			attributeFilter: ["disabled"]
		});
		try {
			r.ownerDocument.dispatchEvent(new Event("folder-picker-list-loaded"));
			let e = await a.promise, o = "/Users/alex/研究/new tool";
			await t.clear(i), await t.type(i, o, { delay: null }), await n(i).toHaveValue(o), await n(e).toBe("/Users/alex/Documents");
		} finally {
			o.disconnect();
		}
	}
}, p = { args: { isOpening: !0 } }, m = { args: { error: "A folder with that name already exists." } }, h = { args: { error: "Permission denied while opening this folder." } }, g = { args: {
	currentPath: "C:\\",
	entries: []
} }, _ = { args: {
	currentPath: "\\\\server\\share",
	entries: []
} }, v = { play: async ({ canvasElement: r }) => {
	let i = e(r.ownerDocument.body);
	await t.click(i.getByRole("button", {
		name: "New folder",
		exact: !0
	})), await n(i.getByRole("button", {
		name: "Create folder",
		exact: !0
	})).toBeDisabled(), await n(i.queryByRole("button", {
		name: "Open folder",
		exact: !0
	})).not.toBeInTheDocument(), await n(i.getAllByRole("button", {
		name: "Cancel",
		exact: !0
	})).toHaveLength(1);
} }, y = { play: async ({ canvasElement: r }) => {
	let i = e(r.ownerDocument.body);
	await t.click(i.getByRole("button", {
		name: "New folder",
		exact: !0
	})), await t.type(i.getByRole("textbox", { name: "New folder name" }), "assets"), await n(i.getByRole("button", {
		name: "Create folder",
		exact: !0
	})).toBeEnabled(), await n(i.queryByRole("textbox", { name: "Filter folders" })).not.toBeInTheDocument();
} }, b = { play: async ({ canvasElement: r }) => {
	let i = e(r.ownerDocument.body), a = e(i.getByLabelText("Folders")), o = i.getByRole("textbox", { name: "Filter folders" });
	await n(a.queryByRole("option", { name: ".research" })).not.toBeInTheDocument(), await t.click(o), await t.keyboard("{Control>}{Shift>}[Period]{/Shift}{/Control}"), await n(a.getByRole("option", { name: ".research" })).toBeVisible(), await n(o).toHaveValue(""), await t.type(o, "research"), await n(a.getAllByRole("option")).toHaveLength(1), await t.keyboard("{Meta>}{Shift>}[Period]{/Shift}{/Meta}"), await n(a.queryByRole("option", { name: ".research" })).not.toBeInTheDocument(), await t.clear(o), await n(a.getAllByRole("option")).toHaveLength(3);
} };
export { v as CreateFolderEmpty, y as CreateFolderNamed, m as CreationCollision, l as Empty, c as Folders, b as HiddenFolders, u as Loading, _ as NetworkShareRoot, p as Opening, h as PermissionError, f as TypedPathAfterLoading, g as WindowsDriveRoot, s as default };
