// Real UI for the Home scene: the workbench window shows one tool at a time, and every
// improvement the agents deliver adds to it. Drawn at a design size and scaled onto the plate.

export type HomeTool = "board" | "image" | "scene" | "canvas";

const SCALE = 0.5;
export const PLATE = { x: 30, y: 36, w: 252, d: 204 };
const BENCH = { width: PLATE.w / SCALE, height: PLATE.d / SCALE, top: 34, rail: 40, status: 18, pad: 8 };

/** Where a delivered improvement lands: the middle of the tool panel, in world units. */
export const MAIN_AREA = {
  x: PLATE.x + BENCH.rail * SCALE,
  y: PLATE.y + BENCH.top * SCALE,
  w: (BENCH.width - BENCH.rail) * SCALE,
  d: (BENCH.height - BENCH.top - BENCH.status) * SCALE,
};

export const BLOCK = { w: 28, d: 28, h: 22 };

interface Improvement {
  label: string;
  file: string;
  code: string[];
}

interface ToolSpec {
  name: string;
  color: string;
  icon: string;
  improvements: Improvement[];
  /** The panel body with the first `stage` improvements in; the newest part carries `data-new`. */
  body: (stage: number) => string;
}

const ICONS: Record<HomeTool, string> = {
  board:
    '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="10" rx="1"/><rect x="17" y="4" width="4" height="13" rx="1"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/>',
  scene: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
  canvas:
    '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="5" rx="1"/><rect x="13" y="10" width="8" height="11" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/>',
};

const svg = (paths: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
const fresh = (stage: number, part: number) => (stage === part ? " data-new" : "");

const AGENT = ["claude", "codex", "opencode"];
const CARDS = [
  ["Pricing table", 0, 0],
  ["Fix the mobile menu", 0, 1],
  ["Compress images", 0, 2],
  ["Export icons as SVG", 1, 1],
  ["Docs search", 2, 0],
  ["Release notes", 2, 2],
] as const;
const COLUMNS = ["To do", "Doing", "Done"];

const boardBody = (stage: number) => {
  const columns = Math.min(3, stage + 1);
  const avatar = (who: number) => (stage >= 3 ? `<i class="tp-avatar" data-agent="${AGENT[who]}"></i>` : "");
  if (stage >= 4) {
    const rows = CARDS.map(
      ([title, column, who]) =>
        `<span class="tp-row"><i class="tp-state" data-state="${column}"></i>${title}<em>${COLUMNS[column]}</em>${avatar(who)}</span>`,
    ).join("");
    return `<div class="tp-list" data-new><span class="tp-row tp-head-row"><i></i>Title<em>Status</em></span>${rows}</div>`;
  }
  const cols = COLUMNS.slice(0, columns)
    .map((name, index) => {
      const cards = CARDS.filter(([, column]) => Math.min(column, columns - 1) === index)
        .map(
          ([title, column, who]) =>
            `<span class="tp-card"${stage === 3 ? " data-new" : ""}><i class="tp-state" data-state="${Math.min(column, columns - 1)}"></i>${title}${avatar(who)}</span>`,
        )
        .join("");
      return `<div class="tp-col"${index > 0 ? fresh(stage, index) : ""}><b>${name}<small>${CARDS.filter(([, c]) => Math.min(c, columns - 1) === index).length}</small></b>${cards}</div>`;
    })
    .join("");
  return `<div class="tp-board" style="grid-template-columns:repeat(${columns},minmax(0,1fr))">${cols}</div>`;
};

const imageBody = (stage: number) => {
  const tools =
    stage >= 3
      ? `<div class="tp-tools"${fresh(stage, 3)}>${"<i></i>".repeat(5)}</div>`
      : '<div class="tp-tools-off"></div>';
  const art =
    stage >= 1
      ? `<i class="tp-wave"${fresh(stage, 1)}></i><i class="tp-sun"${fresh(stage, 1)}></i>${stage >= 4 ? `<span class="tp-art-title" data-new>Great Wave</span>` : ""}`
      : '<span class="tp-empty">Untitled</span>';
  const layers =
    stage >= 2
      ? `<div class="tp-layers"${fresh(stage, 2)}><b>Layers</b>${stage >= 4 ? '<span><i style="background:#183659"></i>Title</span>' : ""}<span><i style="background:#e2564b"></i>Sun</span><span class="tp-on"><i style="background:#2c5b8f"></i>Wave</span><span><i style="background:#e9cfa6"></i>Paper</span></div>`
      : "";
  const swatches =
    stage >= 4
      ? `<div class="tp-swatches" data-new>${["#183659", "#2c5b8f", "#e2564b", "#e9cfa6", "#f3e3c7"].map((c) => `<i style="background:${c}"></i>`).join("")}</div>`
      : "";
  return `<div class="tp-image">${tools}<div class="tp-stage"><div class="tp-art">${art}</div>${swatches}</div>${layers}</div>`;
};

const sceneBody = (stage: number) => {
  const cube =
    stage >= 1
      ? `<svg class="tp-cube"${fresh(stage, 1)} viewBox="0 0 60 60"><path d="M30 31L52 18.5v25L30 56z" fill="${stage >= 3 ? "#e2564b" : "var(--chakra-colors-illustration-editor)"}" opacity=".75"/><path d="M30 31L8 18.5v25L30 56z" fill="${stage >= 3 ? "#c2413a" : "var(--chakra-colors-illustration-editor)"}"/><path d="M30 6l22 12.5L30 31 8 18.5z" fill="white" opacity=".6"/></svg>`
      : "";
  const gizmo =
    stage >= 2
      ? `<span class="tp-gizmo"${fresh(stage, 2)}><i></i><i></i><i></i></span><span class="tp-orbit"${fresh(stage, 2)}>Orbit</span>`
      : "";
  const materials =
    stage >= 3
      ? `<div class="tp-materials"${fresh(stage, 3)}><b>Material</b>${["#e2564b", "#3b6fe0", "#30a46c", "#f2b134"].map((c, i) => `<i class="${i === 0 ? "tp-on" : ""}" style="background:${c}"></i>`).join("")}<span>Roughness</span><em></em></div>`
      : "";
  const timeline =
    stage >= 4 ? `<div class="tp-timeline" data-new><b>▶</b><span>${"<i></i>".repeat(4)}</span><em></em></div>` : "";
  return `<div class="tp-scene"><div class="tp-viewport"><div class="tp-grid"></div>${cube}${gizmo}</div>${materials}${timeline}</div>`;
};

const canvasBody = (stage: number) => {
  const button =
    stage >= 1
      ? `<div class="tp-frame"${fresh(stage, 1)}><small>Button</small><span class="tp-btn tp-primary">Save</span><span class="tp-btn">Cancel</span></div>`
      : "";
  const card = (dark: boolean, part: number) =>
    `<div class="tp-frame${dark ? " tp-dark" : ""}"${fresh(stage, part)}><small>Card${dark ? " · dark" : ""}</small><i class="tp-avatar-lg"></i><b>Weekly report</b><i class="tp-line"></i><span class="tp-btn tp-primary">Open</span></div>`;
  const props =
    stage >= 4
      ? `<div class="tp-props" data-new><b>Properties</b><span>Radius<em>8</em></span><span>Padding<em>12</em></span><span>Theme<em>Dark</em></span></div>`
      : "";
  return `<div class="tp-ui"><div class="tp-canvas">${button || '<span class="tp-empty">Drop a component here</span>'}${stage >= 2 ? card(false, 2) : ""}${stage >= 3 ? card(true, 3) : ""}</div>${props}</div>`;
};

export const TOOLS: Record<HomeTool, ToolSpec> = {
  board: {
    name: "Ticket board",
    color: "var(--chakra-colors-illustration-page)",
    icon: ICONS.board,
    improvements: [
      { label: "Doing column", file: "board.tsx", code: ['columns.push("Doing")', "  .sortBy(status)"] },
      { label: "Done column", file: "board.tsx", code: ['columns.push("Done")', "  .collapsible()"] },
      { label: "Assignees", file: "card.tsx", code: ["<Avatar agent={", "  ticket.agent} />"] },
      { label: "List view", file: "views.ts", code: ['views.add("list",', "  <TicketList />)"] },
    ],
    body: boardBody,
  },
  image: {
    name: "Image editor",
    color: "var(--chakra-colors-illustration-skill)",
    icon: ICONS.image,
    improvements: [
      { label: "Shapes", file: "shapes.ts", code: ['draw("wave", path)', '  .fill("#2c5b8f")'] },
      { label: "Layers", file: "layers.tsx", code: ["<LayerList", "  layers={doc.layers} />"] },
      { label: "Toolbar", file: "tools.tsx", code: ["<Toolbar tools={[", "  select, brush, text]} />"] },
      { label: "Text and colors", file: "palette.ts", code: ['addText("Great Wave")', "palette.from(art)"] },
    ],
    body: imageBody,
  },
  scene: {
    name: "3D editor",
    color: "var(--chakra-colors-illustration-editor)",
    icon: ICONS.scene,
    improvements: [
      { label: "Mesh", file: "scene.ts", code: ["scene.add(new Mesh(", "  box, material))"] },
      { label: "Orbit controls", file: "camera.ts", code: ["new OrbitControls(", "  camera, canvas)"] },
      { label: "Materials", file: "material.tsx", code: ["<MaterialPicker", "  roughness={0.4} />"] },
      { label: "Timeline", file: "timeline.ts", code: ["timeline.key(0, pose)", "  .key(60, spin)"] },
    ],
    body: sceneBody,
  },
  canvas: {
    name: "UI editor",
    color: "var(--chakra-colors-illustration-command)",
    icon: ICONS.canvas,
    improvements: [
      { label: "Button", file: "button.canvas.tsx", code: ["<Button>Save</Button>", '<Button variant="ghost" />'] },
      { label: "Card", file: "card.canvas.tsx", code: ["<Card title=", '  "Weekly report" />'] },
      { label: "Dark theme", file: "theme.ts", code: ['frames.add("dark",', "  darkTokens)"] },
      { label: "Properties", file: "props.tsx", code: ["<PropsPanel", "  of={selection} />"] },
    ],
    body: canvasBody,
  },
};
export const TOOL_ORDER: HomeTool[] = ["board", "image", "scene", "canvas"];

/** An improvement on its way to the workbench: a block with the tool's icon and a plus. */
export const blockHtml = (kind: HomeTool) => `<div class="tb-icon">${svg(ICONS[kind])}<b>+</b></div>`;

/** The workbench window: one tab per tool opened so far, the active tool's panel, status bar. */
export const benchHtml = (tabs: number, stage: number) => {
  const active = TOOL_ORDER[tabs - 1];
  const tool = TOOLS[active];
  const tabBar = TOOL_ORDER.slice(0, tabs)
    .map((kind, i) => `<span class="wb-tab${i === tabs - 1 ? " wb-on" : ""}">${TOOLS[kind].name}</span>`)
    .join("");
  const rail = TOOL_ORDER.map(
    (kind) => `<span${kind === active ? ' class="wb-on"' : ""}>${svg(ICONS[kind])}</span>`,
  ).join("");
  const done = tool.improvements.slice(0, stage).map((step) => step.label);
  return `<div class="wb" style="width:${BENCH.width}px;height:${BENCH.height}px;transform:scale(${SCALE})"><div class="wb-top" style="height:${BENCH.top}px"><span class="wb-app"><i></i>Prompt Studio</span><span class="wb-tabs">${tabBar}<b class="wb-plus" data-iso-action="new-tab">+</b></span></div><div class="wb-rail" style="top:${BENCH.top}px;width:${BENCH.rail}px;bottom:${BENCH.status}px">${rail}</div><div class="tp" style="left:${BENCH.rail + BENCH.pad}px;top:${BENCH.top + BENCH.pad}px;right:${BENCH.pad}px;bottom:${BENCH.status + BENCH.pad}px"><div class="tp-head"><span class="tp-icon" style="color:${tool.color}">${svg(tool.icon)}</span>${tool.name}${stage >= 4 && active === "board" ? '<span class="tp-views"><i>Board</i><i class="tp-on">List</i></span>' : ""}</div>${tool.body(stage)}</div><div class="wb-status" style="height:${BENCH.status}px"><span>${done.length ? `${tool.name} · ${done.join(" · ")}` : `${tool.name} · new`}</span><span>main · synced</span></div></div>`;
};

/** The "+" button's position in world units, measured from the rendered workbench. */
export const plusPoint = (top: HTMLElement) => {
  const plus = top.querySelector<HTMLElement>(".wb-plus");
  const bench = top.querySelector<HTMLElement>(".wb");
  if (!plus || !bench) return { x: PLATE.x + 40, y: PLATE.y + 8 };
  let [x, y] = [plus.offsetWidth / 2, plus.offsetHeight / 2];
  for (let node: HTMLElement | null = plus; node && node !== bench; node = node.offsetParent as HTMLElement | null) {
    x += node.offsetLeft;
    y += node.offsetTop;
  }
  return { x: PLATE.x + x * SCALE, y: PLATE.y + y * SCALE };
};
