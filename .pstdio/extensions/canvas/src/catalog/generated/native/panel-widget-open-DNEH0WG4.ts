// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { c as e } from "./workbench-core-N58OeDyx.ts";
// packages/pstdio-workbench/src/react/region/panel-widget-open.ts
var t = (e) => e === "secondary" ? "Secondary" : e === "side" ? "Side" : "Main", n = async (t) => {
	let { open: n, pinned: r, region: i, resource: a, widget: o, workbench: s } = t;
	n ? await n(a) : o.openCommand ? await e(s, o.title, async () => {
		await s.commands.executeCommand(o.openCommand.commandId, o.openCommand.args, {
			source: "panel-add",
			region: i,
			...a ? { resource: a } : {}
		});
	}) : s.layout.openWidget(o.id, {
		region: i,
		title: o.title,
		closable: !0,
		pinned: r,
		role: i === "main" ? "location" : "sub-panel",
		tabRetention: "persistent"
	}), i === "secondary" && s.shell.setRegionOpen("secondary", !0), i === "side" && s.sidePanel.getMode() === "closed" && s.sidePanel.setMode("attached");
};
export { n, t };
