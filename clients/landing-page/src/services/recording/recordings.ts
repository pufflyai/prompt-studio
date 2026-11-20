import type { ToolExampleId } from "../../content/tool-examples-content";
import type { Director } from "./director";

interface Recording {
  reset: (d: Director) => void;
  play: (d: Director, id: number) => Promise<void>;
}

type Card = [id: string, title: string, column: number, agent: string, state: "Queued" | "Running" | "Done"];

const CARDS: Card[] = [
  ["TOOL-18", "Add a color picker to the shader editor", 0, "Codex", "Queued"],
  ["TOOL-19", "Compare two savings scenarios", 0, "Claude Code", "Queued"],
  ["TOOL-16", "Use the icon set in the shader preview", 1, "Codex", "Running"],
  ["TOOL-17", "Add a loan repayment command", 1, "OpenCode", "Running"],
  ["TOOL-14", "Export icons as SVG", 2, "Claude Code", "Done"],
];
const COLUMNS = ["Queued", "In progress", "Ready for review"];
const STATE_ICON = { Queued: "", Running: "rec-run", Done: "rec-done" };

const element = (className: string, text = "") => {
  const el = document.createElement("div");
  el.className = className;
  el.textContent = text;
  return el;
};

const cardElement = ([id, title, , agent, state]: Card) => {
  const card = element("rec-card");
  card.dataset.card = id;
  const meta = element("rec-card-meta");
  const icon = element(`rec-state ${STATE_ICON[state]}`);
  meta.append(icon, `${agent} · Build `, element("rec-muted", state));
  card.append(element("rec-card-id", id), element("rec-card-title", title), meta);
  return card;
};

const countCards = (d: Director) => {
  for (const column of d.root.querySelectorAll("[data-column]"))
    column.querySelector(".rec-count")!.textContent = String(column.querySelectorAll(".rec-card").length);
  d.find("[data-rec=board-count]").textContent =
    `${d.root.querySelectorAll(".rec-card").length} tickets · Agent sessions`;
};

const addMessage = (d: Director, kind: "user" | "agent", text: string) => {
  const message = element(`rec-msg rec-${kind}`, text);
  if (kind === "agent") message.dataset.who = "Codex";
  d.find("[data-rec=messages]").append(message);
  return message;
};

const stream = async (d: Director, id: number, text: string) => {
  const message = addMessage(d, "agent", "");
  for (const word of text.split(" ")) {
    message.textContent += (message.textContent ? " " : "") + word;
    await d.step(id, 70);
  }
};

const board: Recording = {
  reset: (d) => {
    const kanban = d.find("[data-rec=kanban]");
    kanban.replaceChildren(
      ...COLUMNS.map((name, column) => {
        const el = element("rec-column");
        el.dataset.column = String(column);
        const head = element("rec-column-head");
        head.append(element(`rec-state ${["", "rec-run", "rec-done"][column]}`), name, element("rec-count"));
        el.append(head, ...CARDS.filter((card) => card[2] === column).map(cardElement));
        return el;
      }),
    );
    d.find("[data-rec=messages]").replaceChildren();
    addMessage(d, "user", "Use the new icon set in the shader preview.");
    addMessage(d, "agent", "On it. Swapping the preview icons now.");
    d.find("[data-rec=composer]").textContent = "";
    countCards(d);
  },
  play: async (d, id) => {
    const card = d.find('[data-card="TOOL-16"]');
    await d.moveTo(id, card, 0.6);
    await d.step(id, 700);
    card.querySelector(".rec-state")!.className = "rec-state rec-done";
    card.querySelector(".rec-muted")!.textContent = "Done";
    await d.step(id, 500);
    d.flip(card, () => d.find('[data-column="2"]').append(card));
    countCards(d);
    await d.step(id, 700);
    await stream(d, id, "Swapped the preview icons for the new set. Ready for review.");
    const composer = d.find("[data-rec=composer]");
    await d.moveTo(id, composer, 0.3);
    await d.click(id);
    await d.type(id, composer, "Add an SVG export button");
    await d.moveTo(id, d.find("[data-rec=send]"), 0.5, 0.5, 400);
    await d.click(id);
    addMessage(d, "user", composer.textContent ?? "");
    composer.textContent = "";
    await d.step(id, 500);
    const created = cardElement(["TOOL-20", "Add an SVG export button", 0, "Claude Code", "Queued"]);
    created.classList.add("rec-enter");
    d.find('[data-column="0"]').append(created);
    countCards(d);
    await stream(d, id, "Created TOOL-20 and queued it for Claude Code.");
    await d.step(id, 1400);
  },
};

const selectLayer = (d: Director, layer: string) => {
  for (const row of d.root.querySelectorAll<HTMLElement>("[data-layer-row]"))
    row.dataset.selected = String(row.dataset.layerRow === layer);
  const art = d.find("[data-rec=artboard]").getBoundingClientRect();
  const rect = d.find(`[data-layer="${layer}"]`).getBoundingClientRect();
  Object.assign(d.find("[data-rec=selection]").style, {
    left: `${(rect.left - art.left) / d.scale}px`,
    top: `${(rect.top - art.top) / d.scale}px`,
    width: `${rect.width / d.scale}px`,
    height: `${rect.height / d.scale}px`,
    opacity: "1",
  });
};

const setOpacity = (d: Director, value: number) => {
  d.find("[data-rec=slider-fill]").style.width = `${value}%`;
  d.find("[data-rec=slider-knob]").style.left = `${value}%`;
  d.find("[data-rec=prop-opacity]").textContent = `${Math.round(value)}%`;
  d.find('[data-layer="wave"]').style.opacity = String(value / 100);
};

const image: Recording = {
  reset: (d) => {
    d.find('[data-layer="wave"]').style.transform = "";
    setOpacity(d, 100);
    d.find("[data-rec=selection]").style.opacity = "0";
    for (const row of d.root.querySelectorAll<HTMLElement>("[data-layer-row]")) row.dataset.selected = "false";
    d.find("[data-rec=prop-x]").textContent = "40";
    d.find("[data-rec=prop-y]").textContent = "90";
  },
  play: async (d, id) => {
    await d.moveTo(id, d.find('[data-layer-row="wave"]'));
    await d.click(id);
    selectLayer(d, "wave");
    await d.step(id, 400);
    const wave = d.find('[data-layer="wave"]');
    await d.moveTo(id, wave, 0.5, 0.45);
    await d.drag(id, 1000, -36, -14, (k) => {
      wave.style.transform = `translate(${-36 * k}px,${-14 * k}px)`;
      selectLayer(d, "wave");
      d.find("[data-rec=prop-x]").textContent = String(Math.round(40 - 36 * k));
      d.find("[data-rec=prop-y]").textContent = String(Math.round(90 - 14 * k));
    });
    await d.step(id, 300);
    await d.moveTo(id, d.find("[data-rec=slider-knob]"));
    const width = d.find("[data-rec=slider]").offsetWidth;
    await d.drag(id, 800, -width * 0.4, 0, (k) => setOpacity(d, 100 - 40 * k));
    await d.step(id, 300);
    await d.moveTo(id, d.find('[data-layer-row="sun"]'));
    await d.click(id);
    selectLayer(d, "sun");
    await d.step(id, 1300);
  },
};

const selectFrame = (d: Director, frame: string | null) => {
  for (const el of d.root.querySelectorAll<HTMLElement>("[data-frame]"))
    el.dataset.selected = String(el.dataset.frame === frame);
  const selected = frame ? d.find(`[data-frame="${frame}"]`) : null;
  d.find("[data-rec=frame-name]").textContent =
    selected?.querySelector(".rec-frame-title")?.textContent ?? "None selected";
  const dark = selected?.dataset.theme === "dark";
  for (const option of d.root.querySelectorAll<HTMLElement>("[data-theme-option]"))
    option.dataset.selected = String(option.dataset.themeOption === (dark ? "dark" : "light"));
};

const darken = async (d: Director, id: number, frame: string) => {
  await d.moveTo(id, d.find(`[data-frame="${frame}"]`), 0.5, 0.45);
  await d.click(id);
  selectFrame(d, frame);
  await d.step(id, 400);
  await d.moveTo(id, d.find('[data-theme-option="dark"]'));
  await d.click(id);
  d.find(`[data-frame="${frame}"]`).dataset.theme = "dark";
  selectFrame(d, frame);
};

const canvas: Recording = {
  reset: (d) => {
    d.find("[data-rec=canvas-world]").style.transform = "";
    for (const frame of d.root.querySelectorAll<HTMLElement>("[data-frame]")) frame.dataset.theme = "light";
    selectFrame(d, null);
  },
  play: async (d, id) => {
    await darken(d, id, "card");
    await d.step(id, 600);
    await d.moveTo(id, d.find("[data-rec=canvas]"), 0.9, 0.9);
    const world = d.find("[data-rec=canvas-world]");
    await d.drag(id, 900, -40, -30, (k) => {
      world.style.transform = `translate(${-40 * k}px,${-30 * k}px)`;
    });
    await d.step(id, 300);
    await darken(d, id, "chart");
    await d.step(id, 1200);
  },
};

const spin = (d: Director) => d.find("[data-rec=cube]").getAnimations()[0];
const formatTime = (frame: number) =>
  `00:${String(Math.floor(frame / 30)).padStart(2, "0")}:${String(frame % 30).padStart(2, "0")}`;

const scene: Recording = {
  reset: (d) => {
    const turn = spin(d);
    if (turn) turn.playbackRate = 1;
    const playhead = d.find("[data-rec=playhead]");
    playhead.style.transition = "none";
    playhead.style.left = "0%";
    d.find("[data-rec=play]").textContent = "▶";
    d.find("[data-rec=time]").textContent = formatTime(0);
    d.find("[data-rec=rotate-y]").textContent = "0°";
    for (const key of d.root.querySelectorAll<HTMLElement>("[data-keyframe]")) key.dataset.selected = "false";
  },
  play: async (d, id) => {
    await d.moveTo(id, d.find("[data-rec=play]"));
    await d.click(id);
    d.find("[data-rec=play]").textContent = "❚❚";
    const turn = spin(d);
    if (turn) turn.playbackRate = 6;
    const playhead = d.find("[data-rec=playhead]");
    void playhead.offsetWidth;
    playhead.style.transition = "left 3.2s linear";
    playhead.style.left = "86%";
    for (let frame = 0; frame <= 96; frame += 3) {
      d.find("[data-rec=time]").textContent = formatTime(frame);
      d.find("[data-rec=rotate-y]").textContent = `${Math.round((frame / 96) * 360)}°`;
      await d.step(id, 100);
    }
    if (turn) turn.playbackRate = 1;
    d.find("[data-rec=play]").textContent = "▶";
    const key = d.find('[data-keyframe="2"]');
    await d.moveTo(id, key);
    await d.click(id);
    key.dataset.selected = "true";
    d.find("[data-rec=rotate-y]").textContent = "180°";
    await d.step(id, 1300);
  },
};

export const RECORDINGS: Record<ToolExampleId, Recording> = { board, image, canvas, scene };

const moveCardOn = (d: Director, card: HTMLElement) => {
  const column = Number(card.closest<HTMLElement>("[data-column]")?.dataset.column ?? 0);
  d.flip(card, () => d.find(`[data-column="${(column + 1) % 3}"]`).append(card));
  countCards(d);
};

const togglePlay = (d: Director) => {
  const turn = spin(d);
  const playing = d.find("[data-rec=play]").textContent === "❚❚";
  if (turn) turn.playbackRate = playing ? 1 : 6;
  d.find("[data-rec=play]").textContent = playing ? "▶" : "❚❚";
};

/** Lets the visitor click what the recorded cursor clicks. */
export const interact = (d: Director, target: Element) => {
  const layer = target.closest<HTMLElement>("[data-layer-row], [data-layer]");
  const name = layer?.dataset.layerRow ?? layer?.dataset.layer;
  if (name && d.root.querySelector(`[data-layer="${name}"]`)) return selectLayer(d, name);
  const option = target.closest<HTMLElement>("[data-theme-option]");
  const picked = d.root.querySelector<HTMLElement>('[data-frame][data-selected="true"]');
  if (option && picked) {
    picked.dataset.theme = option.dataset.themeOption;
    return selectFrame(d, picked.dataset.frame!);
  }
  const frame = target.closest<HTMLElement>("[data-frame]");
  if (frame) return selectFrame(d, frame.dataset.frame!);
  if (target.closest("[data-rec=play]")) return togglePlay(d);
  const key = target.closest<HTMLElement>("[data-keyframe]");
  if (key) {
    for (const other of d.root.querySelectorAll<HTMLElement>("[data-keyframe]"))
      other.dataset.selected = String(other === key);
    return;
  }
  const card = target.closest<HTMLElement>("[data-card]");
  if (card) moveCardOn(d, card);
};
