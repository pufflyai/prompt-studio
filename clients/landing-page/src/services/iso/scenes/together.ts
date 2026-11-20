import { addAgent, agentFive, carry, job, moveAgent, puff, raise, toss } from "../agents";
import { clock, ISO_ACCENT, kindColor, kpi, lines, live, note, slab } from "../greek";
import { clamp } from "../motion";
import type { IsoBox, IsoScene } from "../scene";

export const TOGETHER_WORLD = { W: 420, D: 320, top: 80, bottom: 28 };

const SLOT = { x: 236, y: 186, w: 148, d: 70 };
const CORNER = { x: 372, y: 138, z: 10 };
const CLOCK_HOME = { x: 70, y: 240, z: 0 };
const PAUSE_AFTER_USER_MS = 4500;

/** A live chart copied from a dashboard into notes, then scheduled into a weekly report. */
export const setupTogetherScene = (scene: IsoScene) => {
  let values = [40, 62, 35, 70, 52, 80, 66];
  // Both charts read the same numbers, so the copy in the note moves with the original.
  const push = (value: number) => {
    values = [...values.slice(1), value];
    for (const chart of scene.boxes.filter((box) => "chart" in box))
      chart.top.querySelectorAll<HTMLElement>(".g-live i").forEach((bar, i) => {
        bar.style.height = `${values[i]}%`;
      });
  };
  scene.every(1400, () => push(clamp(values[values.length - 1] + (Math.random() * 40 - 18), 20, 98)));
  scene.add({ x: 20, y: 20, w: 180, d: 150, h: 10, html: slab() });
  scene.add({ x: 32, y: 38, w: 72, d: 28, h: 4, z: 10, html: kpi() });
  scene.add({ x: 114, y: 38, w: 74, d: 28, h: 4, z: 10, html: kpi() });
  const chartSpec = { w: 90, d: 84, h: 6, z: 10, chart: true };
  const chart = scene.add({ x: 32, y: 76, ...chartSpec, html: live(values), drag: true });
  scene.onGrab = (box) => {
    if ("chart" in box) box.top.innerHTML = live(values);
    // Lifting the clock off the note cancels the schedule.
    if (box === schedule && scheduled) unschedule();
  };
  chart.copy = { ...chartSpec, html: live(values) };
  scene.add({ x: 130, y: 76, w: 58, d: 84, h: 4, z: 10, html: lines() });
  const notes = scene.add({ x: 220, y: 130, w: 180, d: 170, h: 10, html: note() });
  const schedule = scene.add({
    ...CLOCK_HOME,
    w: 28,
    d: 28,
    h: 24,
    color: kindColor("automation"),
    html: clock(),
    drag: true,
    home: CLOCK_HOME,
  });
  const codex = addAgent(scene, { name: "Codex", color: "var(--chakra-colors-agent-codex)", x: 380, y: 60, z: 60 });
  const claude = addAgent(scene, { name: "Claude", color: "var(--chakra-colors-agent-claude)", x: 150, y: 270, z: 50 });
  // OpenCode lives inside the schedule and only comes out when it runs.
  const opencode = addAgent(scene, {
    name: "OpenCode",
    color: "var(--chakra-colors-agent-opencode)",
    x: CORNER.x + 10,
    y: CORNER.y + 10,
    z: 30,
  });
  opencode.task = true;
  opencode.el.classList.add("iso-away");
  let copy: IsoBox | null = null;
  let scheduled = false;

  const placeChart = (box: IsoBox) => {
    copy = box;
    box.drag = false;
    Object.assign(box.t, SLOT, { z: 10, h: 4 });
    notes.top.querySelector(".g-note")!.classList.add("g-filled");
  };
  const placeClock = () => {
    scheduled = true;
    Object.assign(schedule.t, CORNER, { w: 20, d: 20, h: 16 });
  };
  const unschedule = () => {
    scheduled = false;
    scene.label(schedule, "");
    Object.assign(schedule.t, CLOCK_HOME, { w: 28, d: 28, h: 24 });
  };
  // Clicking does what Codex does: copy the chart into the note, then schedule it.
  chart.click = () => {
    if (copy) return;
    placeChart(scene.add({ ...chartSpec, x: chart.x, y: chart.y, html: live(values), className: "iso-pop" }));
  };
  schedule.click = () => {
    if (scheduled) unschedule();
    else if (copy) placeClock();
  };
  const flash = () => {
    notes.el.classList.remove("iso-flash");
    void notes.el.offsetWidth;
    notes.el.classList.add("iso-flash");
  };
  // When the countdown ends, OpenCode climbs out of the clock and brings fresh data to the report.
  const run = async () => {
    Object.assign(opencode, { x: CORNER.x + 10, y: CORNER.y + 10, z: 22 });
    opencode.el.classList.remove("iso-away");
    puff(scene, CORNER.x + 10, CORNER.y + 10, 26);
    const data = scene.add({
      x: CORNER.x + 3,
      y: CORNER.y + 3,
      z: 26,
      w: 14,
      d: 14,
      h: 10,
      color: ISO_ACCENT,
      html: lines(),
      className: "iso-pop",
      drag: true,
    });
    await scene.wait(300);
    const delivered = await carry(
      opencode,
      data,
      { x: SLOT.x + SLOT.w / 2 - 7, y: SLOT.y + SLOT.d / 2 - 7, z: 14 },
      40,
    );
    scene.fadeOut(data);
    if (delivered) {
      puff(scene, SLOT.x + SLOT.w / 2, SLOT.y + SLOT.d / 2, 14);
      push(96);
      flash();
    }
    await moveAgent(opencode, CORNER.x + 10, CORNER.y + 10, 30, 600);
    opencode.el.classList.add("iso-away");
  };
  const countdown = async () => {
    for (let left = 5; left > 0; left--) {
      if (!scheduled) return false;
      scene.label(schedule, `<small>next report in</small>0:0${left}`);
      await scene.wait(1000);
    }
    scene.label(schedule, "");
    return scheduled;
  };
  scene.targets.push({
    ...SLOT,
    accept: (box) => box.isCopy && !copy,
    drop: (box) => {
      placeChart(box);
      raise(codex);
    },
  });
  scene.targets.push({
    x: 220,
    y: 130,
    w: 180,
    d: 170,
    accept: (box) => box === schedule && Boolean(copy) && !scheduled,
    drop: () => {
      placeClock();
      raise(claude);
    },
  });

  const copyChart = () =>
    job(codex, async () => {
      await moveAgent(codex, chart.x + 45, chart.y + 42, 30, 600);
      const fresh = scene.add({ ...chartSpec, x: chart.x, y: chart.y, html: live(values), className: "iso-pop" });
      if ((await carry(codex, fresh, { ...SLOT, z: 10 }, 30)) && !copy) placeChart(fresh);
      else scene.remove(fresh);
    });
  const scheduleReport = async () => {
    await job(codex, async () => {
      if (await carry(codex, schedule, CORNER, 40)) placeClock();
    });
    await scene.wait(400);
    await agentFive(scene, codex, claude);
  };
  // Two scheduled runs, then Claude puts the clock back and the scene starts over.
  const runReports = async () => {
    for (let report = 0; report < 2; report++) {
      if (!(await countdown())) return;
      await run();
    }
    await scene.wait(1200);
    if (scene.userBusy(PAUSE_AFTER_USER_MS)) return;
    await job(claude, async () => {
      schedule.drag = true;
      await toss(scene, claude, schedule, CLOCK_HOME, 90);
      Object.assign(schedule.t, { w: 28, d: 28, h: 24 });
    });
    if (copy) scene.fadeOut(copy);
    copy = null;
    scheduled = false;
    notes.top.querySelector(".g-note")!.classList.remove("g-filled");
  };

  scene.run(async () => {
    await scene.wait(1000);
    for (;;) {
      await scene.awake();
      if (scene.userBusy(PAUSE_AFTER_USER_MS)) {
        await scene.wait(500);
        continue;
      }
      if (!copy) await copyChart();
      else if (!scheduled) await scheduleReport();
      else await runReports();
      await scene.wait(1100);
    }
  });
};
