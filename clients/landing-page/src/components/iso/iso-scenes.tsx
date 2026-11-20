import { HOME_WORLD, setupHomeScene } from "../../services/iso/scenes/home";
import { SHAPES_WORLD, setupShapesScene } from "../../services/iso/scenes/shapes";
import { setupTogetherScene, TOGETHER_WORLD } from "../../services/iso/scenes/together";
import { setupWhyScene, WHY_WORLD } from "../../services/iso/scenes/why";
import { setupYoursScene, YOURS_WORLD } from "../../services/iso/scenes/yours";
import { IsoSceneView } from "./iso-scene-view";

export const HomeScene = () => (
  <IsoSceneView
    world={HOME_WORLD}
    setup={setupHomeScene}
    label="Agents write code, turn each result into a tool on the workbench, then open a new tab and build again."
  />
);
export const WhyScene = () => (
  <IsoSceneView
    world={WHY_WORLD}
    setup={setupWhyScene}
    label="Agents write scripts and pages that pile up and get forgotten until the workbench gives each one a home."
  />
);
export const ShapesScene = () => (
  <IsoSceneView
    world={SHAPES_WORLD}
    setup={setupShapesScene}
    label="One workbench changes shape: a ticket board, an image editor, a 3D viewer, and a dashboard."
  />
);
export const TogetherScene = () => (
  <IsoSceneView
    world={TOGETHER_WORLD}
    setup={setupTogetherScene}
    label="A live chart is copied from a dashboard into notes and scheduled as a weekly report."
  />
);
export const YoursScene = () => (
  <IsoSceneView
    world={YOURS_WORLD}
    setup={setupYoursScene}
    label="An agent tries to move the workbench off the laptop, and it springs back."
  />
);
