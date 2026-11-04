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

`GanttChart` composes group summaries, task bars, completed portions, milestones, and finish-to-start dependency arrows, following [TanStack's Gantt Dependencies example](https://tanstack.com/charts/catalog/charts/198-gantt-dependencies). Supply unique IDs even when task labels repeat. Start and end are numbers in the caller's units, such as elapsed hours or Unix timestamps. `formatValue` supplies axis and tooltip labels. The component groups rows in input order, resolves dependencies by ID, and uses Arrow keys plus Enter for selection through `onSelect`. Set `now` to show the reference line. Application code owns forecasts, due dates, filtering, and persistence.

Explore `charts.canvas.tsx`: `BarsAndLines`, `Statistics`, `GanttDependencies`, and `EmptySchedule`. Use Canvas theme controls to compare light, dark, and custom preferences. Chart updates have no animation by default.
