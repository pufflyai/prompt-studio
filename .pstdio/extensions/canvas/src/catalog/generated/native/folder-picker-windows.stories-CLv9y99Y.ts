// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, h as t, m as n, p as r, r as i } from "./test-whhQHjQi.ts";
import { t as a } from "./folder-picker-dialog-BV80klEG.ts";
import { useState as o } from "react";
import { jsx as s } from "react/jsx-runtime";
// packages/ui/src/components/overlays/folder-picker-windows.stories.tsx
var c = [
	"C",
	"D",
	"E"
].map((e) => ({
	name: `${e}:`,
	path: `${e}:\\`
})), l = {
	"C:\\Users\\Alex": ["Documents", "Downloads"],
	"C:\\": ["Users", "Windows"],
	"D:\\": ["Projects", "Shared"],
	"D:\\Projects": [
		"My tools",
		"Notes",
		"Prototypes"
	],
	"D:\\Projects\\My tools": [],
	"\\\\server\\share": ["Team"]
}, u = (e) => (l[e] ?? []).map((t) => ({
	name: t,
	path: `${e.replace(/\\$/, "")}\\${t}`,
	isDirectory: !0
})), d = (e) => {
	let [t, n] = o(e.currentPath), r = !Object.hasOwn(l, t);
	return /* @__PURE__ */ s(a, {
		...e,
		currentPath: t,
		entries: u(t),
		isUnavailable: r,
		error: r ? "This drive is unavailable." : void 0,
		onNavigate: (e) => n(e === "~" ? "C:\\Users\\Alex" : e.replaceAll("/", "\\"))
	});
}, f = {
	title: "Overlays/FolderPickerDialog/Windows",
	component: a,
	tags: ["folder-picker"],
	parameters: { docs: { description: { component: "Windows drives come from the runtime host. Selection only navigates; Open folder confirms. Matches Pencil frame XuQrP. Unix runtimes supply no drives. UNC paths leave the drive unselected." } } },
	args: {
		open: !0,
		currentPath: "D:\\Projects",
		entries: u("D:\\Projects"),
		drives: c,
		onClose: e(),
		onSelect: e(),
		onNavigate: e(),
		onCreateFolder: async () => {}
	},
	render: (e) => /* @__PURE__ */ s(d, { ...e })
}, p = { play: async ({ canvasElement: e, args: n }) => {
	let a = t(e.ownerDocument.body);
	await r.click(a.getByRole("button", {
		name: "Drive",
		exact: !0
	})), await r.click(a.getByRole("menuitem", {
		name: "C:",
		exact: !0
	})), await i(a.getByRole("textbox", { name: "Folder path" })).toHaveValue("C:\\"), await i(a.getByRole("button", { name: "Go to parent directory" })).toBeDisabled(), await i(n.onSelect).not.toHaveBeenCalled(), await r.click(a.getByRole("button", { name: "Go to home directory" })), await i(a.getByRole("textbox", { name: "Folder path" })).toHaveValue("C:\\Users\\Alex");
} }, m = { play: async ({ canvasElement: e }) => {
	let n = t(e.ownerDocument.body);
	await r.click(n.getByRole("button", {
		name: "Drive",
		exact: !0
	})), await i(n.getAllByRole("menuitem")).toHaveLength(3);
} }, h = {
	args: { currentPath: "E:\\" },
	play: async ({ canvasElement: e }) => {
		let a = t(e.ownerDocument.body);
		await n(() => i(a.getByRole("alert")).toBeVisible()), await i(a.getByRole("button", {
			name: "Open folder",
			exact: !0
		})).toBeDisabled(), await i(a.getByRole("button", {
			name: "New folder",
			exact: !0
		})).toBeDisabled(), await r.click(a.getByRole("button", {
			name: "Drive",
			exact: !0
		})), await r.click(a.getByRole("menuitem", {
			name: "D:",
			exact: !0
		})), await i(a.queryByRole("alert")).not.toBeInTheDocument(), await i(a.getByRole("button", {
			name: "Open folder",
			exact: !0
		})).toBeEnabled();
	}
}, g = { play: async ({ canvasElement: e, args: a }) => {
	let o = t(e.ownerDocument.body), s = o.getByRole("button", {
		name: "Drive",
		exact: !0
	});
	await n(() => i(s).toBeVisible()), s.focus(), await r.keyboard("{ArrowDown}{Escape}"), await i(s).toHaveFocus(), await r.keyboard("{ArrowDown}{Home}{ArrowDown}{Enter}"), await i(o.getByRole("textbox", { name: "Folder path" })).toHaveValue("D:\\"), await i(a.onSelect).not.toHaveBeenCalled();
} }, _ = { play: async ({ canvasElement: e }) => {
	let n = t(e.ownerDocument.body), a = n.getByRole("textbox", { name: "Folder path" });
	await r.clear(a), await r.type(a, "C:\\Users\\Alex{Enter}"), await i(n.getByRole("button", {
		name: "Drive",
		exact: !0
	})).toHaveTextContent("C:"), await r.clear(a), await r.type(a, "\\\\server\\share{Enter}"), await i(n.getByRole("button", {
		name: "Drive",
		exact: !0
	})).toHaveTextContent("Drive"), await i(n.getByRole("button", { name: "Go to parent directory" })).toBeDisabled();
} }, v = { args: {
	currentPath: "C:\\",
	drives: c.slice(0, 1)
} }, y = { args: { isLoading: !0 } };
export { p as Browse, m as DriveMenu, g as KeyboardNavigation, y as Loading, v as SingleDrive, _ as TypedPath, h as UnavailableDrive, f as default };
