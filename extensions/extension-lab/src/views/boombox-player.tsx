import { boomboxStore, Player } from "../apps/boombox";
import { createExampleView, viewBackgrounds } from "../create-view";
import type { ExampleViewInput } from "../view-context";

const View = (props: { input: ExampleViewInput }) => <Player host={props.input.host} />;
export default createExampleView(View, boomboxStore, viewBackgrounds.panel);
