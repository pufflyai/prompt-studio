import { MarmaladeNav } from "../apps/marmalade/marmalade-chrome";
import { marmaladeStore } from "../apps/marmalade/marmalade-store";
import { createExampleView, viewBackgrounds } from "../create-view";
export default createExampleView(MarmaladeNav, marmaladeStore, viewBackgrounds.sidenav);
