/** Sample data and a self-contained SVG chart for the artifact publishing workflow. */
export const weeklyActivityHtml = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Weekly activity</title><style>
*{box-sizing:border-box}
body{margin:0;background:var(--artifact-bg,Canvas);color:var(--artifact-fg,CanvasText);font:16px/1.5 var(--artifact-font,system-ui,sans-serif)}
main{max-width:1000px;margin:auto;padding:clamp(24px,5vw,56px)}
.eyebrow{color:var(--artifact-accent);font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-weight:600}
h1{font-size:clamp(30px,4vw,46px);letter-spacing:-.04em;line-height:1.1;margin:14px 0}
p,.caption,footer{color:var(--artifact-muted)}
.intro{max-width:560px;margin-bottom:32px}
.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:32px 0}
.stat,.chart{border:1px solid var(--artifact-border);border-radius:12px;padding:20px}
.stat{background:var(--artifact-surface)}
.number{font-size:30px;letter-spacing:-.03em;font-weight:600;margin-top:8px}
.caption{font-size:13px}
.toolbar,.legend,.week-control{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.toolbar{justify-content:space-between;margin-bottom:20px}
.filters{display:flex;gap:6px;flex-wrap:wrap}
button{font:inherit;font-size:13px;padding:8px 12px;border:1px solid var(--artifact-border);border-radius:6px;background:var(--artifact-bg);color:var(--artifact-fg);cursor:pointer}
button[aria-pressed=true]{background:var(--artifact-surface);border-color:var(--artifact-accent);color:var(--artifact-accent)}
button:focus-visible,input:focus-visible,.day:focus-visible{outline:2px solid var(--artifact-accent);outline-offset:3px}
.legend{font-size:13px;color:var(--artifact-muted)}
.legend span{display:flex;align-items:center;gap:8px}
.dot{width:8px;height:8px;border-radius:50%;background:var(--artifact-accent)}
.dot.operations{background:var(--artifact-fg);opacity:.45}
svg{display:block;width:100%;overflow:visible;margin:24px 0 12px}
svg text{fill:var(--artifact-muted);font:12px var(--artifact-font,system-ui,sans-serif)}
.grid{stroke:var(--artifact-border);stroke-width:1;stroke-dasharray:3 5}
.product{fill:var(--artifact-accent)}.operations-bar{fill:var(--artifact-fg);opacity:.45}
.day{cursor:pointer}.day:hover{opacity:.8}
.week-control{margin-top:24px}.week-control input{flex:1;min-width:120px;accent-color:var(--artifact-accent)}
#selection{min-height:24px;font-size:14px;margin:20px 0 0}
footer{font-size:12px;margin-top:24px}
@media(max-width:540px){.stats{gap:8px}.stat{padding:12px}.number{font-size:24px}.chart{padding:16px}svg text{font-size:20px}}
</style></head><body><main>
<div class="eyebrow">Work in perspective</div>
<h1>Where the week went.</h1>
<p class="intro">Explore the balance between building the product and keeping things running. Choose a week, filter the work, or select a day.</p>
<div class="stats">
  <div class="stat"><div class="caption">Total hours</div><div class="number" id="total">—</div></div>
  <div class="stat"><div class="caption">Product focus</div><div class="number" id="focus">—</div></div>
  <div class="stat"><div class="caption">Busiest day</div><div class="number" id="busiest">—</div></div>
</div>
<section class="chart" aria-label="Weekly activity chart">
  <div class="toolbar"><strong id="week-label">Week 6</strong><div class="filters" aria-label="Activity category">
    <button type="button" data-filter="all" aria-pressed="true">All work</button>
    <button type="button" data-filter="product" aria-pressed="false">Product</button>
    <button type="button" data-filter="operations" aria-pressed="false">Operations</button>
  </div></div>
  <div class="legend"><span><i class="dot"></i>Product</span><span><i class="dot operations"></i>Operations</span></div>
  <svg viewBox="0 0 720 280" role="group" aria-label="Hours by weekday" id="chart"></svg>
  <div class="week-control"><label for="week">Week</label><input id="week" type="range" min="0" max="5" value="5" aria-valuetext="Week 6"><output id="week-value" for="week">6 of 6</output></div>
  <p id="selection" aria-live="polite">Select a day to see its breakdown.</p>
</section><footer>Illustrative sample data · Hours per person · Six weeks</footer>
</main><script>
const weeks=[[[3,3],[4,2],[2,4],[4,3],[3,2]],[[4,2],[3,3],[5,2],[4,2],[4,3]],[[4,3],[5,2],[4,2],[6,1],[4,2]],[[5,2],[4,3],[6,2],[5,2],[5,1]],[[5,2],[6,1],[5,2],[6,2],[5,2]],[[6,2],[5,2],[7,1],[6,2],[5,1]]];
const days=['Mon','Tue','Wed','Thu','Fri'];let filter='all';let selected;
const chart=document.querySelector('#chart');const slider=document.querySelector('#week');
function describe(index){const [product,operations]=weeks[Number(slider.value)][index];document.querySelector('#selection').textContent=days[index]+': '+product+' product hours + '+operations+' operations hours = '+(product+operations)+' hours.';}
function draw(){
  const data=weeks[Number(slider.value)];const visible=data.map(([p,o])=>[filter==='operations'?0:p,filter==='product'?0:o]);
  const totals=visible.map(([p,o])=>p+o);const product=data.reduce((sum,[p])=>sum+p,0);const all=data.reduce((sum,[p,o])=>sum+p+o,0);
  document.querySelector('#total').textContent=totals.reduce((sum,n)=>sum+n,0)+' h';
  document.querySelector('#focus').textContent=Math.round(product/all*100)+'%';
  document.querySelector('#busiest').textContent=days[totals.indexOf(Math.max(...totals))];
  const week=Number(slider.value)+1;document.querySelector('#week-label').textContent='Week '+week;document.querySelector('#week-value').textContent=week+' of 6';slider.setAttribute('aria-valuetext','Week '+week);
  const grid=[0,2,4,6,8,10].map(n=>'<line class="grid" x1="44" x2="704" y1="'+(240-n*21)+'" y2="'+(240-n*21)+'"/><text x="24" y="'+(244-n*21)+'" text-anchor="end">'+n+'</text>').join('');
  const bars=visible.map(([p,o],i)=>{const x=76+i*130;const label=days[i]+': '+(p+o)+' hours';return '<g class="day" data-day="'+i+'" tabindex="0" role="button" aria-label="'+label+'"><title>'+label+'</title><rect class="product" x="'+x+'" y="'+(240-p*21)+'" width="68" height="'+p*21+'" rx="3"/><rect class="operations-bar" x="'+x+'" y="'+(240-(p+o)*21)+'" width="68" height="'+o*21+'" rx="3"/><text x="'+(x+34)+'" y="266" text-anchor="middle">'+days[i]+'</text></g>';}).join('');
  chart.innerHTML='<text x="24" y="16" text-anchor="end">h</text>'+grid+bars;
  if(selected!==undefined)describe(selected);
}
for(const button of document.querySelectorAll('[data-filter]'))button.addEventListener('click',()=>{filter=button.dataset.filter;for(const other of document.querySelectorAll('[data-filter]'))other.setAttribute('aria-pressed',String(other===button));draw();});
slider.addEventListener('input',draw);
chart.addEventListener('click',event=>{const day=event.target.closest('[data-day]');if(day){selected=Number(day.dataset.day);describe(selected);}});
chart.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.target.closest('[data-day]')?.dispatchEvent(new MouseEvent('click',{bubbles:true}));}});
draw();
</script></body></html>`;
