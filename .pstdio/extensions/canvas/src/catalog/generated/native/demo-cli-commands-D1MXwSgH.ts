// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
// clients/landing-page/src/content/demo-cli-commands.ts
var e = "prompt-studio:demo-command", t = (e) => {
	if (e.tool === "icons") return `pst icons rename --id ${e.id} --name ${e.name}`;
	if (e.tool === "shaders") return `pst shaders update --scale ${e.scale} --speed ${e.speed}`;
	if (e.tool === "agents") return `pst tickets update --id ${e.id} --status "In Progress"`;
	let t = Object.entries(e.inputs).map(([e, t]) => `--${e} ${t}`).join(" ");
	return `pst formulas calculate --id ${e.id} ${t}`;
}, n = (e) => e.tool === "icons" ? "✓ Icon renamed" : e.tool === "shaders" ? "✓ Preview updated" : e.tool === "agents" ? "✓ Ticket moved to In progress" : "✓ Calculation updated";
export { n, t as r, e as t };
