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
    label="Agents improve one tool at a time on the workbench: each writes a change, carries it in and pats it into the panel. A ticket board gains columns, assignees and a list view; then a new tab starts an image editor, a 3D editor and a UI editor."
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
    label="Agents move tickets on a board while a dashboard chart follows along, and a schedule fills in a weekly report."
  />
);
export const YoursScene = () => (
  <IsoSceneView
    world={YOURS_WORLD}
    setup={setupYoursScene}
    label="An agent tries to move the workbench off the laptop, and it springs back."
  />
);
