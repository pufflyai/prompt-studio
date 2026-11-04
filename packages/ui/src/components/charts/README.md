# Charts

Use `Chart` and `GanttChart` from `@pstdio/ui/charts`. This separate entry keeps chart code out of the light root entry. TanStack Charts owns marks, scales, SVG rendering, pointer focus, keyboard navigation, and tooltips; Prompt Studio owns theme integration and application data.

`Chart` accepts a TanStack chart definition. Its shared recipe maps axes, grid, series, focus indicators, and tooltips to `vis.*`, `bg`, and border tokens. Theme changes update the existing chart through CSS variables. Numeric heights are pixels; string heights accept Chakra tokens such as `"xs"` or `"full"`. A full-height chart needs a bounded parent with `minH="0"`.

```tsx
import { Chart } from "@pstdio/ui/charts";
import { barY, defineChart } from "@tanstack/charts";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";

const definition = defineChart({
  marks: [barY(rows, { x: "day", y: "count" })],
  scales: { x: { scale: scaleBand }, y: { scale: scaleLinear, grid: true } },
}, { tooltip: { use: tooltip } });

<Chart definition={definition} height={240} ariaLabel="Tickets completed per day" />;
```

Import TanStack marks and scales directly from `@tanstack/charts`; declare it as a direct dependency when doing so. Use `chartColor("vis.categorical.1")` for a series with a fixed semantic role. Use the default palette otherwise. Pass configured scale instances to preserve explicit domains; a scale factory infers its domain from the data.

`GanttChart` renders exactly one row per supplied ticket, following [TanStack's Gantt Dependencies example](https://tanstack.com/charts/catalog/charts/198-gantt-dependencies). Supply unique IDs even when titles repeat. Start and end are numbers in the caller's units; `formatValue` supplies axis and tooltip labels. Input order is preserved and dependencies resolve by ID. `group` assigns series colors without adding rows. Supply `milestones` as `{ id, label, value }` vertical reference lines, independently of tickets.

Use `TaskBadges` to supply application badges beside each ticket and `onOpen` for its title action. Arrow keys plus Enter select chart bars through `onSelect`. Set `now` for the current-time reference line and “Now” axis tick. Application code owns forecasts, due dates, filtering, ticket opening, and persistence.

Explore `charts.canvas.tsx` for compact examples and `visualizations.canvas.tsx` for the full gallery: 34 chart examples in Light, Dark, and CustomPalette frames, plus dedicated `PieCharts`, `AreaCharts`, `LinePlots`, and `Palettes` frames. Line examples include five-series traffic, forecast intervals, a seven-day rolling average with spikes, and CPU/latency on independently labeled axes. Bars have square baselines and 2px rounding at their value ends; stacked bars round only their outer ends. Default categorical colors use Carbon’s ordered 14-color light/dark palettes. Seven-step sequential ramps reverse with the theme; diverging ramps retain the same order. Alert colors have their own semantic tokens. Palette reference: [Carbon data visualization color palettes](https://www.carbondesignsystem.com/building-blocks/data-visualization/color-palettes). The custom Forest fixture demonstrates overriding `colors.vis.categorical.*`, `colors.vis.sequential.*`, `colors.vis.axis`, `colors.vis.grid`, and `colors.vis.text.*` using the regular theme preference API. Canvas theme controls can change any frame without remounting it. Chart updates have no animation by default.
