import { addAgent, agentSays, carry, job, puff } from "../agents";
import { screen, workbench } from "../greek";
import { pick } from "../motion";
import type { IsoScene } from "../scene";

export const YOURS_WORLD = { W: 300, D: 240, top: 180, bottom: 30 };

const METAL = "color-mix(in oklab, var(--chakra-colors-fg) 22%, var(--chakra-colors-bg-panel))";
const HOME = { x: 62, y: 66, z: 6 };

/** An agent keeps trying to carry the workbench off the laptop; it always springs back. */
export const setupYoursScene = (scene: IsoScene) => {
  scene.add({ x: 40, y: 34, w: 220, d: 6, h: 150, z: 6, color: METAL, sideHtml: screen() });
  scene.add({ x: 40, y: 40, w: 220, d: 170, h: 6, color: METAL });
  const plate = scene.add({ ...HOME, w: 176, d: 124, h: 8, html: workbench(), drag: true, home: HOME });
  const agent = addAgent(
    scene,
    { name: "OpenCode", color: "var(--chakra-colors-agent-opencode)", x: 280, y: 120, z: 60 },
    false,
  );
  const springBack = () => {
    Object.assign(plate.t, HOME);
    puff(scene, HOME.x + 88, HOME.y + 62, 14);
  };
  // A click makes the workbench hop, but it stays put.
  plate.click = () => {
    plate.liftT = 18;
    setTimeout(() => {
      plate.liftT = plate.restLift;
    }, 220);
  };
  scene.onHome = () => {
    springBack();
    agentSays(agent, "it stays here", 1400);
  };
  scene.run(async () => {
    await scene.wait(2000);
    for (;;) {
      await scene.awake();
      if (!scene.userBusy(4000)) {
        await job(agent, async () => {
          const [dx, dy] = pick([
            [-80, 60],
            [90, -50],
            [-40, 110],
          ]);
          if (await carry(agent, plate, { x: HOME.x + dx, y: HOME.y + dy, z: 26, ms: 1100 }, 10)) {
            springBack();
            agentSays(agent, "worth a try", 1400);
          }
        });
      }
      await scene.wait(4500 + Math.random() * 2000);
    }
  });
};
