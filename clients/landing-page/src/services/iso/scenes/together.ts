import { addAgent, agentFive, carry, job, moveAgent, puff, raise, toss } from "../agents";
import { clock, dashboard, ISO_ACCENT, kindColor, lines, live } from "../greek";
import { clamp } from "../motion";
import type { IsoBox, IsoScene } from "../scene";
import { createBoard } from "./together-board";

export const TOGETHER_WORLD = { W: 420, D: 320, top: 80, bottom: 28 };

const PANEL = { x: 220, y: 130, w: 180, d: 170 };
const BOARD_CHART = { x: 236, y: 146, w: 128, d: 62 };
const REPORT_CHART = { x: 236, y: 222, w: 128, d: 64 };
const CORNER = { x: 372, y: 138, z: 10 };
const CLOCK_HOME = { x: 70, y: 240, z: 0 };
const PAUSE_AFTER_USER_MS = 4500;

/**
 * A ticket board and a dashboard read the same tickets: moving a card updates the dashboard's
 * chart. Scheduling the dashboard adds a weekly report that OpenCode fills in on every run.
 */
export const setupTogetherScene = (scene: IsoScene) => {
  scene.add({ ...PANEL, h: 10, html: dashboard() });
  const boardChart = scene.add({ ...BOARD_CHART, h: 5, z: 10, html: live([0, 0, 0]) });
  const showCounts = () => {
    const columns = counts();
    const total = Math.max(
      1,
      columns.reduce((sum, count) => sum + count, 0),
    );
    boardChart.top.querySelectorAll<HTMLElement>(".g-live i").forEach((bar, column) => {
      bar.style.height = `${Math.max(6, (columns[column] / total) * 100)}%`;
    });
  };
  const { counts, work } = createBoard(scene, () => showCounts());
  showCounts();

  let weekly = [20, 34, 28, 40, 36, 48, 44];
  let report: IsoBox | null = null;
  const pushWeekly = (value: number) => {
    weekly = [...weekly.slice(1), value];
    report?.top.querySelectorAll<HTMLElement>(".g-live i").forEach((bar, i) => {
      bar.style.height = `${weekly[i]}%`;
    });
  };
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
  const codex = addAgent(scene, { name: "Codex", color: "var(--chakra-colors-agent-codex)", x: 120, y: 190, z: 60 });
  const claude = addAgent(scene, { name: "Claude", color: "var(--chakra-colors-agent-claude)", x: 300, y: 70, z: 55 });
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

  // Scheduling the dashboard adds a second chart: a weekly report the schedule keeps filling in.
  const placeClock = () => {
    Object.assign(schedule.t, CORNER, { w: 20, d: 20, h: 16 });
    if (report) return;
    report = scene.add({ ...REPORT_CHART, h: 4, z: 10, html: live(weekly), className: "iso-pop" });
  };
  const unschedule = () => {
    scene.label(schedule, "");
    Object.assign(schedule.t, CLOCK_HOME, { w: 28, d: 28, h: 24 });
    if (report) scene.fadeOut(report);
    report = null;
  };
  const scheduled = () => Boolean(report);
  scene.onGrab = (box) => {
    if (box === schedule && scheduled()) unschedule();
  };
  schedule.click = () => {
    if (scheduled()) unschedule();
    else placeClock();
  };
  scene.targets.push({
    ...PANEL,
    accept: (box) => box === schedule && !scheduled(),
    drop: () => {
      placeClock();
      raise(claude);
    },
  });

  const countdown = async () => {
    for (let left = 5; left > 0; left--) {
      if (!scheduled()) return false;
      scene.label(schedule, `<small>next report in</small>0:0${left}`);
      await scene.wait(1000);
    }
    scene.label(schedule, "");
    return scheduled();
  };
  // When the countdown ends, OpenCode climbs out of the clock and brings this week's numbers.
  const deliver = async () => {
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
    const dest = { x: REPORT_CHART.x + REPORT_CHART.w / 2 - 7, y: REPORT_CHART.y + REPORT_CHART.d / 2 - 7, z: 14 };
    const delivered = await carry(opencode, data, dest, 40);
    scene.fadeOut(data);
    if (delivered && report) {
      puff(scene, dest.x + 7, dest.y + 7, 14);
      pushWeekly(clamp(weekly[weekly.length - 1] + 6 + Math.random() * 18, 20, 96));
      report.el.classList.remove("iso-flash");
      void report.el.offsetWidth;
      report.el.classList.add("iso-flash");
    }
    await moveAgent(opencode, CORNER.x + 10, CORNER.y + 10, 30, 600);
    opencode.el.classList.add("iso-away");
  };

  // Codex keeps working the board; the dashboard follows every move.
  scene.run(async () => {
    await scene.wait(800);
    for (;;) {
      await scene.awake();
      if (!scene.userBusy(PAUSE_AFTER_USER_MS)) await job(codex, () => work(codex));
      await scene.wait(1400 + Math.random() * 900);
    }
  });
  // Claude schedules the dashboard, two reports run, then Claude takes the schedule off again.
  scene.run(async () => {
    await scene.wait(4000);
    for (;;) {
      await scene.awake();
      if (scene.userBusy(PAUSE_AFTER_USER_MS)) {
        await scene.wait(500);
        continue;
      }
      if (!scheduled()) {
        await job(claude, async () => {
          if (await carry(claude, schedule, CORNER, 40)) placeClock();
        });
        await agentFive(scene, codex, claude);
      }
      for (let run = 0; run < 2 && (await countdown()); run++) await deliver();
      await scene.wait(1500);
      if (!scheduled() || scene.userBusy(PAUSE_AFTER_USER_MS)) continue;
      await job(claude, async () => {
        await toss(scene, claude, schedule, CLOCK_HOME, 90);
        unschedule();
      });
      await scene.wait(4000);
    }
  });
};
