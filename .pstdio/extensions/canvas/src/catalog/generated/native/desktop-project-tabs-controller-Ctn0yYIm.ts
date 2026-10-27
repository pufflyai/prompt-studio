// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { s as e } from "./collections-CVGR0OYX.ts";
import { i as t, s as n } from "./project-context-BR7AjHlE.ts";
import { t as r } from "./commands-Bp5w85f4.ts";
import { a as i } from "./dashboard-rows-wkmk8GQV.ts";
import { n as a, t as o } from "./project-data-BZ7dVP-4.ts";
// packages/pstdio-dashboard/src/modules/projects/desktop-project-tabs.ts
var s = (e, t) => e.includes(t) ? e : [...e, t], c = (e, t, n) => {
	let r = e.indexOf(t), i = e.indexOf(n);
	if (r === -1 || i === -1 || r === i) return e;
	let a = [...e];
	return a.splice(r, 1), a.splice(i, 0, t), a;
}, l = (e, t, n) => {
	let r = e.indexOf(t), i = e.filter((e) => e !== t);
	return {
		projectIds: i,
		selectedProjectId: n === t ? i[Math.min(r, i.length - 1)] : n
	};
}, u = (e, t) => {
	let n = new Set(t);
	return e.filter((e) => n.has(e));
}, d = "dashboard.project-tabs.persistence-error", f = class {
	#e;
	#t = /* @__PURE__ */ new Set();
	#n;
	constructor(e, t) {
		this.#e = [...e], this.#n = t;
	}
	getProjectIds = () => this.#e;
	subscribe = (e) => (this.#t.add(e), () => {
		this.#t.delete(e);
	});
	#r(e, t) {
		if (!(t.length === this.#e.length && t.every((e, t) => this.#e[t] === e))) {
			this.#e = t;
			for (let e of this.#t) e();
			this.#n({ projectIds: [...t] }).then(() => e.notifications.dismiss(d), (t) => {
				console.error("[dashboard.project-tabs] Could not save project tabs.", t), e.notifications.show({
					id: d,
					level: "error",
					title: "Could not save project tabs",
					message: "Check that Prompt Studio can write to its application data folder, then open or close a tab to try saving again. Your latest tab order may not survive a restart."
				});
			});
		}
	}
	select(e, t) {
		let n = a(t);
		return n ? e.commands.executeCommand(r.selectProject, { project: n }) : Promise.resolve();
	}
	reorder(e, t, n) {
		this.#r(e, c(this.#e, t, n));
	}
	async close(e, n) {
		let i = t(e), a = l(this.#e, n, i);
		this.#r(e, a.projectIds), i === n && (a.selectedProjectId ? await this.select(e, a.selectedProjectId) : await e.commands.executeCommand(r.clearSelectedProject));
	}
	connect(c) {
		let l = () => {
			let e = t(c);
			e && a(e) && this.#r(c, s(this.#e, e));
		}, d = () => {
			if (!e()) return;
			let n = t(c), i = this.#e, s = u(i, o().map((e) => e.id));
			if (this.#r(c, s), n && !a(n)) {
				let e = i.indexOf(n), t = [...i.slice(e + 1), ...i.slice(0, e).reverse()].find((e) => s.includes(e));
				t ? this.select(c, t) : c.commands.executeCommand(r.clearSelectedProject);
			} else l();
		}, f = n(c, l), p = i(d);
		return d(), { dispose: () => {
			f(), p();
		} };
	}
};
export { f as t };
