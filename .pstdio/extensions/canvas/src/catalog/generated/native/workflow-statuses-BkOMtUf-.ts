// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./sort-C5A4Nn9L.ts";
import { r as t } from "./seed-DSxmxcWD.ts";
// extensions/pstdio-planner/src/data/status-operations.ts
var n = async (n) => ({ statuses: e(await t(n)) }), r = () => ({
	completedStatusIds: [],
	blockedStatusIds: [],
	activeStatusIds: [],
	mergeTargetStatusId: null
}), i = (e) => {
	if (e == null || e === "") return r();
	if (typeof e != "object") throw Error("Workflow status selections must be an object.");
	let t = e, n = [
		"completedStatusIds",
		"blockedStatusIds",
		"activeStatusIds"
	];
	for (let e of n) if (!Array.isArray(t[e]) || t[e].some((e) => typeof e != "string" || !e)) throw Error("Choose status IDs for each workflow selection.");
	let i = n.flatMap((e) => t[e]);
	if (new Set(i).size !== i.length) throw Error("Completed, blocked, and active statuses must not overlap.");
	if (t.mergeTargetStatusId !== null && !t.completedStatusIds.includes(t.mergeTargetStatusId)) throw Error("The status after merge must be a completed status.");
	return Object.fromEntries([...n.map((e) => [e, [...t[e]]]), ["mergeTargetStatusId", t.mergeTargetStatusId]]);
}, a = async (e) => {
	let t = i((await e.settings.all())["workflow.statuses"]), { statuses: r } = await n(e.storage), a = new Set(r.map(({ id: e }) => e));
	return {
		selections: t,
		statuses: r,
		missingStatusIds: [
			...t.completedStatusIds,
			...t.blockedStatusIds,
			...t.activeStatusIds
		].filter((e) => !a.has(e))
	};
};
export { i as n, a as r, r as t };
