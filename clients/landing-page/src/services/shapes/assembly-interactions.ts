import { DEMO_CLI_EVENT, demoCliResult, demoCliText } from "../../content/demo-cli-commands";
import type { ToolExampleId } from "../../content/tool-examples-content";
import { TOOL_INTERACTIONS, type ToolInteraction } from "../../content/tool-interactions";
import { MOTION_DURATION_SCALE, type Point, travel } from "./assembly-motion";

interface PanelAgent {
  position: Point;
  element: SVGGElement;
}
interface InteractionJob {
  action: ToolInteraction;
  target: HTMLElement;
  from: Point;
  started: number;
  duration: number;
  phase: "approach" | "act";
  initialText: string;
  applied: boolean;
}

const setInput = (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  // Use the native setter so React receives a normal input change.
  Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.setSelectionRange(value.length, value.length);
};

const revealInFrame = (parent: HTMLElement, element: HTMLElement, editingEnd: boolean) => {
  const frame = parent.getBoundingClientRect();
  const target = element.getBoundingClientRect();
  const scale = frame.height / parent.clientHeight;
  const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight);
  const top = editingEnd ? target.bottom - lineHeight * scale : target.top;
  // A tall field cannot fit both edges. Keep its edited line visible instead of alternating between them.
  if (!editingEnd && target.height > frame.height && target.top < frame.bottom && target.bottom > frame.top) return;
  if (target.bottom > frame.bottom) parent.scrollTop += (target.bottom - frame.bottom + 8) / scale;
  else if (top < frame.top) parent.scrollTop += (top - frame.top - 8) / scale;
};

/** Agents use the same controls and React handlers as the example pages. */
export const createAssemblyInteractions = (scene: SVGSVGElement, agents: PanelAgent[]) => {
  const preview = scene.querySelector<HTMLElement>("[data-tool-preview]")!;
  let example: ToolExampleId | undefined;
  let index = 0;
  let nextAction = 0;
  let job: InteractionJob | undefined;
  const reset = () => {
    job?.target.removeAttribute("data-agent-owner");
    job = undefined;
    example = undefined;
    index = 0;
    nextAction = 0;
    delete scene.dataset.assemblyAction;
  };
  const reveal = (element: HTMLElement, editingEnd = false) => {
    for (let parent = element.parentElement; parent && preview.contains(parent); parent = parent.parentElement) {
      if (!parent.clientHeight || parent.scrollHeight <= parent.clientHeight) continue;
      if (["visible", "clip"].includes(getComputedStyle(parent).overflowY)) continue;
      revealInFrame(parent, element, editingEnd);
    }
  };
  const point = (element: HTMLElement, typing: boolean) => {
    const rect = element.getBoundingClientRect();
    let { left, right, top, bottom } = rect;
    for (let parent = element.parentElement; parent && preview.contains(parent); parent = parent.parentElement) {
      if (getComputedStyle(parent).overflow === "visible") continue;
      const frame = parent.getBoundingClientRect();
      left = Math.max(left, frame.left);
      right = Math.min(right, frame.right);
      top = Math.max(top, frame.top);
      bottom = Math.min(bottom, frame.bottom);
    }
    const p = new DOMPoint(
      typing ? left + Math.min(30, (right - left) / 2) : (left + right) / 2,
      (top + bottom) / 2,
    ).matrixTransform(scene.getScreenCTM()!.inverse());
    return { x: p.x - 5, y: p.y - 5 };
  };
  const type = (current: InteractionJob, progress: number) => {
    if (current.action.kind !== "type") return;
    const suffix = current.action.edit === "shader" ? "\n// Codex: brighten the ribbon colours." : "-spark";
    let characters = Math.floor(suffix.length * Math.min(1, progress));
    // Insert the comment delimiter together so intermediate keystrokes remain valid GLSL.
    if (current.action.edit === "shader" && characters > 0) characters = Math.max(3, characters);
    let value = current.initialText + suffix.slice(0, characters);
    if (progress >= 1 && current.action.edit === "shader") value = value.replace("glow * 0.55", "glow * 0.85");
    const input = current.target as HTMLInputElement | HTMLTextAreaElement;
    if (input.value !== value) setInput(input, value);
    if (current.action.edit === "shader") reveal(input, true);
  };
  const start = (now: number, action: ToolInteraction) => {
    if (action.kind === "cli") {
      const cursor = agents[action.agent].element;
      cursor.querySelector("[data-cursor-command]")!.textContent = "$ ▍";
      const result = cursor.querySelector("[data-cursor-result]")!;
      result.textContent = "";
      result.removeAttribute("aria-label");
      job = {
        action,
        target: preview.firstElementChild as HTMLElement,
        from: { ...agents[action.agent].position },
        started: now,
        duration: demoCliText(action.command).length * 55 + 1600,
        phase: "act",
        initialText: "",
        applied: false,
      };
      return;
    }
    const target = preview.querySelectorAll<HTMLElement>(action.selector)[action.index ?? 0];
    if (!target || target.hasAttribute("disabled")) return;
    reveal(target, action.kind === "type" && target instanceof HTMLTextAreaElement);
    const from = { ...agents[action.agent].position };
    const targetPoint = point(target, false);
    job = {
      action,
      target,
      from,
      started: now,
      duration: (700 + Math.hypot(from.x - targetPoint.x, from.y - targetPoint.y) * 0.5) * MOTION_DURATION_SCALE,
      phase: "approach",
      initialText: "",
      applied: false,
    };
  };
  const approach = (current: InteractionJob, now: number, progress: number) => {
    const agent = agents[current.action.agent];
    agent.position = travel(current.from, point(current.target, false), progress, 28);
    if (progress < 1) return;
    current.phase = "act";
    current.started = now;
    current.duration = current.action.kind === "type" ? 2200 : 550;
    current.initialText = (current.target as HTMLInputElement).value ?? "";
    current.target.dataset.agentOwner = agent.element.dataset.cursorName;
  };
  const act = (current: InteractionJob, now: number, progress: number) => {
    if (current.action.kind === "cli") {
      const line = demoCliText(current.action.command);
      const characters = Math.min(line.length, Math.floor((now - current.started) / 55));
      const cursor = agents[current.action.agent].element;
      const command = cursor.querySelector<HTMLElement>("[data-cursor-command]")!;
      command.textContent = `$ ${line.slice(0, characters)}${characters < line.length ? "▍" : ""}`;
      command.scrollLeft = characters < line.length ? command.scrollWidth : 0;
      if (characters === line.length && !current.applied) {
        current.applied = true;
        current.target.dispatchEvent(new CustomEvent(DEMO_CLI_EVENT, { detail: current.action.command }));
        const result = cursor.querySelector("[data-cursor-result]")!;
        result.textContent = "✓";
        result.setAttribute("aria-label", demoCliResult(current.action.command));
      }
    } else actOnControl(current, progress);
    if (progress < 1) return;
    current.target.removeAttribute("data-agent-owner");
    job = undefined;
    index++;
    nextAction = now + 600;
  };
  const actOnControl = (current: InteractionJob, progress: number) => {
    const typing = current.action.kind === "type";
    agents[current.action.agent].position = point(current.target, typing);
    if (typing) type(current, progress);
    else if (progress > 0.35 && !current.applied) {
      current.applied = true;
      if (current.action.kind === "click") current.target.click();
      else if (current.action.kind === "key") {
        // Enter the slider's keyboard state without taking the visitor's focus.
        current.target.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
        current.target.dispatchEvent(new KeyboardEvent("keydown", { key: current.action.key, bubbles: true }));
        current.target.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
      }
    }
  };
  return {
    update: (now: number, nextExample: ToolExampleId | undefined, available: (index: number) => boolean) => {
      if (!nextExample) {
        reset();
        return undefined;
      }
      if (example !== nextExample) {
        reset();
        example = nextExample;
        nextAction = now + 700;
      }
      const actions = TOOL_INTERACTIONS[example];
      if (!job && index < actions.length && now >= nextAction) {
        const action = actions[index];
        if (!available(action.agent)) return undefined;
        start(now, action);
      }
      if (!job) return undefined;
      const current = job;
      const progress = (now - current.started) / current.duration;
      if (current.phase === "approach") approach(current, now, progress);
      else act(current, now, progress);
      scene.dataset.assemblyAction = `${example}:${index}:${current.phase}:${current.action.kind}`;
      return current.action.agent;
    },
    mode: (agent: number) => {
      if (job?.action.agent !== agent || job.phase !== "act") return "pointer";
      if (job.action.kind === "cli") return "chat";
      return job.action.kind === "type" ? "text" : "pointer";
    },
    pressed: (agent: number) =>
      Boolean(
        job?.action.agent === agent && job.phase === "act" && ["click", "key"].includes(job.action.kind) && job.applied,
      ),
    done: () => Boolean(example && index === TOOL_INTERACTIONS[example].length && !job),
    reset,
  };
};
