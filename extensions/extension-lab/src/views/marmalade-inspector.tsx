import { MarmaladeInspector } from "../apps/marmalade/marmalade-inspector";
import { marmaladeStore } from "../apps/marmalade/marmalade-store";
import { createExampleView, viewBackgrounds } from "../create-view";
export default createExampleView(MarmaladeInspector, marmaladeStore, viewBackgrounds.widget);
