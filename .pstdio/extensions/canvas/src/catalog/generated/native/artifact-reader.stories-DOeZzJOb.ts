// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, r as t, t as n } from "./artifact-translation-story-DxPvkIDo.ts";
import { t as r } from "./html-preview-DhmLvXIL.ts";
import { Box as i, Button as a, Menu as o, Stack as s, Text as c } from "@chakra-ui/react";
import { Header as l, createGlyphIcon as u } from "@pstdio/ui";
import { jsx as d, jsxs as f } from "react/jsx-runtime";
// extensions/pstdio-artifacts/examples/weekly-activity.ts
var p = "<!doctype html>\n<html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<title>Weekly activity</title><style>\n*{box-sizing:border-box}\nbody{margin:0;background:var(--artifact-bg,Canvas);color:var(--artifact-fg,CanvasText);font:16px/1.5 var(--artifact-font,system-ui,sans-serif)}\nmain{max-width:1000px;margin:auto;padding:clamp(24px,5vw,56px)}\n.eyebrow{color:var(--artifact-accent);font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-weight:600}\nh1{font-size:clamp(30px,4vw,46px);letter-spacing:-.04em;line-height:1.1;margin:14px 0}\np,.caption,footer{color:var(--artifact-muted)}\n.intro{max-width:560px;margin-bottom:32px}\n.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:32px 0}\n.stat,.chart{border:1px solid var(--artifact-border);border-radius:12px;padding:20px}\n.stat{background:var(--artifact-surface)}\n.number{font-size:30px;letter-spacing:-.03em;font-weight:600;margin-top:8px}\n.caption{font-size:13px}\n.toolbar,.legend,.week-control{display:flex;align-items:center;gap:16px;flex-wrap:wrap}\n.toolbar{justify-content:space-between;margin-bottom:20px}\n.filters{display:flex;gap:6px;flex-wrap:wrap}\nbutton{font:inherit;font-size:13px;padding:8px 12px;border:1px solid var(--artifact-border);border-radius:6px;background:var(--artifact-bg);color:var(--artifact-fg);cursor:pointer}\nbutton[aria-pressed=true]{background:var(--artifact-surface);border-color:var(--artifact-accent);color:var(--artifact-accent)}\nbutton:focus-visible,input:focus-visible,.day:focus-visible{outline:2px solid var(--artifact-accent);outline-offset:3px}\n.legend{font-size:13px;color:var(--artifact-muted)}\n.legend span{display:flex;align-items:center;gap:8px}\n.dot{width:8px;height:8px;border-radius:50%;background:var(--artifact-accent)}\n.dot.operations{background:var(--artifact-fg);opacity:.45}\nsvg{display:block;width:100%;overflow:visible;margin:24px 0 12px}\nsvg text{fill:var(--artifact-muted);font:12px var(--artifact-font,system-ui,sans-serif)}\n.grid{stroke:var(--artifact-border);stroke-width:1;stroke-dasharray:3 5}\n.product{fill:var(--artifact-accent)}.operations-bar{fill:var(--artifact-fg);opacity:.45}\n.day{cursor:pointer}.day:hover{opacity:.8}\n.week-control{margin-top:24px}.week-control input{flex:1;min-width:120px;accent-color:var(--artifact-accent)}\n#selection{min-height:24px;font-size:14px;margin:20px 0 0}\nfooter{font-size:12px;margin-top:24px}\n@media(max-width:540px){.stats{gap:8px}.stat{padding:12px}.number{font-size:24px}.chart{padding:16px}svg text{font-size:20px}}\n</style></head><body><main>\n<div class=\"eyebrow\">Work in perspective</div>\n<h1>Where the week went.</h1>\n<p class=\"intro\">Explore the balance between building the product and keeping things running. Choose a week, filter the work, or select a day.</p>\n<div class=\"stats\">\n  <div class=\"stat\"><div class=\"caption\">Total hours</div><div class=\"number\" id=\"total\">—</div></div>\n  <div class=\"stat\"><div class=\"caption\">Product focus</div><div class=\"number\" id=\"focus\">—</div></div>\n  <div class=\"stat\"><div class=\"caption\">Busiest day</div><div class=\"number\" id=\"busiest\">—</div></div>\n</div>\n<section class=\"chart\" aria-label=\"Weekly activity chart\">\n  <div class=\"toolbar\"><strong id=\"week-label\">Week 6</strong><div class=\"filters\" aria-label=\"Activity category\">\n    <button type=\"button\" data-filter=\"all\" aria-pressed=\"true\">All work</button>\n    <button type=\"button\" data-filter=\"product\" aria-pressed=\"false\">Product</button>\n    <button type=\"button\" data-filter=\"operations\" aria-pressed=\"false\">Operations</button>\n  </div></div>\n  <div class=\"legend\"><span><i class=\"dot\"></i>Product</span><span><i class=\"dot operations\"></i>Operations</span></div>\n  <svg viewBox=\"0 0 720 280\" role=\"group\" aria-label=\"Hours by weekday\" id=\"chart\"></svg>\n  <div class=\"week-control\"><label for=\"week\">Week</label><input id=\"week\" type=\"range\" min=\"0\" max=\"5\" value=\"5\" aria-valuetext=\"Week 6\"><output id=\"week-value\" for=\"week\">6 of 6</output></div>\n  <p id=\"selection\" aria-live=\"polite\">Select a day to see its breakdown.</p>\n</section><footer>Illustrative sample data · Hours per person · Six weeks</footer>\n</main><script>\nconst weeks=[[[3,3],[4,2],[2,4],[4,3],[3,2]],[[4,2],[3,3],[5,2],[4,2],[4,3]],[[4,3],[5,2],[4,2],[6,1],[4,2]],[[5,2],[4,3],[6,2],[5,2],[5,1]],[[5,2],[6,1],[5,2],[6,2],[5,2]],[[6,2],[5,2],[7,1],[6,2],[5,1]]];\nconst days=['Mon','Tue','Wed','Thu','Fri'];let filter='all';let selected;\nconst chart=document.querySelector('#chart');const slider=document.querySelector('#week');\nfunction describe(index){const [product,operations]=weeks[Number(slider.value)][index];document.querySelector('#selection').textContent=days[index]+': '+product+' product hours + '+operations+' operations hours = '+(product+operations)+' hours.';}\nfunction draw(){\n  const data=weeks[Number(slider.value)];const visible=data.map(([p,o])=>[filter==='operations'?0:p,filter==='product'?0:o]);\n  const totals=visible.map(([p,o])=>p+o);const product=data.reduce((sum,[p])=>sum+p,0);const all=data.reduce((sum,[p,o])=>sum+p+o,0);\n  document.querySelector('#total').textContent=totals.reduce((sum,n)=>sum+n,0)+' h';\n  document.querySelector('#focus').textContent=Math.round(product/all*100)+'%';\n  document.querySelector('#busiest').textContent=days[totals.indexOf(Math.max(...totals))];\n  const week=Number(slider.value)+1;document.querySelector('#week-label').textContent='Week '+week;document.querySelector('#week-value').textContent=week+' of 6';slider.setAttribute('aria-valuetext','Week '+week);\n  const grid=[0,2,4,6,8,10].map(n=>'<line class=\"grid\" x1=\"44\" x2=\"704\" y1=\"'+(240-n*21)+'\" y2=\"'+(240-n*21)+'\"/><text x=\"24\" y=\"'+(244-n*21)+'\" text-anchor=\"end\">'+n+'</text>').join('');\n  const bars=visible.map(([p,o],i)=>{const x=76+i*130;const label=days[i]+': '+(p+o)+' hours';return '<g class=\"day\" data-day=\"'+i+'\" tabindex=\"0\" role=\"button\" aria-label=\"'+label+'\"><title>'+label+'</title><rect class=\"product\" x=\"'+x+'\" y=\"'+(240-p*21)+'\" width=\"68\" height=\"'+p*21+'\" rx=\"3\"/><rect class=\"operations-bar\" x=\"'+x+'\" y=\"'+(240-(p+o)*21)+'\" width=\"68\" height=\"'+o*21+'\" rx=\"3\"/><text x=\"'+(x+34)+'\" y=\"266\" text-anchor=\"middle\">'+days[i]+'</text></g>';}).join('');\n  chart.innerHTML='<text x=\"24\" y=\"16\" text-anchor=\"end\">h</text>'+grid+bars;\n  if(selected!==undefined)describe(selected);\n}\nfor(const button of document.querySelectorAll('[data-filter]'))button.addEventListener('click',()=>{filter=button.dataset.filter;for(const other of document.querySelectorAll('[data-filter]'))other.setAttribute('aria-pressed',String(other===button));draw();});\nslider.addEventListener('input',draw);\nchart.addEventListener('click',event=>{const day=event.target.closest('[data-day]');if(day){selected=Number(day.dataset.day);describe(selected);}});\nchart.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.target.closest('[data-day]')?.dispatchEvent(new MouseEvent('click',{bubbles:true}));}});\ndraw();\n<\/script></body></html>", m = u("arrow-down-1"), h = u("history"), g = (e) => {
	let { content: n, revisions: u, onSelect: p } = e, { t: g } = t(), _ = u[0], v = _?.title ?? n.title, y = u.findIndex((e) => e.id === n.id), b = n.label || g("reader.version", "Version {{number}}", { number: u.length - y });
	return /* @__PURE__ */ f(s, {
		height: "full",
		gap: "0",
		minHeight: "0",
		children: [/* @__PURE__ */ d(l, {
			flexShrink: "0",
			justifyContent: "space-between",
			children: /* @__PURE__ */ f(o.Root, {
				positioning: { placement: "bottom-start" },
				children: [/* @__PURE__ */ d(o.Trigger, {
					asChild: !0,
					children: /* @__PURE__ */ f(a, {
						variant: "ghost",
						"aria-label": g("reader.versions", "Versions"),
						minWidth: "0",
						flexShrink: "1",
						maxWidth: "full",
						children: [
							/* @__PURE__ */ d(h, {}),
							/* @__PURE__ */ d(c, {
								truncate: !0,
								textStyle: "paragraph/S/medium",
								children: b
							}),
							/* @__PURE__ */ d(m, {})
						]
					})
				}), /* @__PURE__ */ d(o.Positioner, { children: /* @__PURE__ */ d(o.Content, {
					maxHeight: "xl",
					overflowY: "auto",
					children: /* @__PURE__ */ f(o.ItemGroup, { children: [/* @__PURE__ */ d(o.ItemGroupLabel, { children: g("reader.versions", "Versions") }), /* @__PURE__ */ d(o.RadioItemGroup, {
						value: n.id,
						onValueChange: (e) => p(e.value),
						children: u.map((e, t) => /* @__PURE__ */ f(o.RadioItem, {
							value: e.id,
							children: [
								/* @__PURE__ */ d(h, {}),
								/* @__PURE__ */ f(o.ItemText, { children: [e.label || g("reader.version", "Version {{number}}", { number: u.length - t }), e.id === _?.id ? g("reader.latest", " · Latest") : ""] }),
								/* @__PURE__ */ d(o.ItemIndicator, {})
							]
						}, e.id))
					})] })
				}) })]
			})
		}), /* @__PURE__ */ d(i, {
			flex: "1",
			minHeight: "0",
			width: "full",
			bg: "bg.muted",
			overflow: "hidden",
			children: /* @__PURE__ */ d(r, {
				title: g("reader.preview", "Preview: {{title}}", { title: v }),
				html: n.html
			}, n.id)
		})]
	});
}, _ = {
	...e,
	html: "<title>Release overview</title><h1>Release overview</h1><button onclick=\"this.textContent='Complete'\">Mark complete</button>"
}, v = {
	title: "Extensions/Artifacts/Reader",
	component: g,
	decorators: [(e) => /* @__PURE__ */ d(n, { children: /* @__PURE__ */ d(e, {}) }), (e) => /* @__PURE__ */ d(i, {
		height: "100dvh",
		children: /* @__PURE__ */ d(e, {})
	})],
	args: {
		content: _,
		revisions: [e],
		onSelect: () => {}
	}
}, y = {}, b = { args: { revisions: [{
	...e,
	id: "revision-2",
	revisionId: "revision-2",
	label: "Ready"
}, e] } }, x = {
	decorators: [(e) => /* @__PURE__ */ d(i, {
		width: "xs",
		height: "full",
		"data-testid": "narrow-reader",
		children: /* @__PURE__ */ d(e, {})
	})],
	args: { content: {
		..._,
		label: "A longer label for the current version"
	} }
}, S = { args: {
	content: {
		..._,
		title: "Weekly activity",
		html: p
	},
	revisions: [{
		...e,
		title: "Weekly activity"
	}]
} }, C = {
	decorators: [(e) => /* @__PURE__ */ d(n, {
		locale: "fr",
		children: /* @__PURE__ */ d(e, {})
	})],
	args: { revisions: [{
		...e,
		label: void 0
	}] }
};
export { C as French, y as Interactive, x as NarrowHeader, b as NewRevision, S as Visualization, v as default };
