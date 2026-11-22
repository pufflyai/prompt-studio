import type { WorkspaceCount } from "./workspace-history";

const chartColors = ["--history-text", "--history-grid", "--history-line", "--history-fill"];

export function drawWorkspaceHistory(
  canvas: HTMLCanvasElement,
  points: WorkspaceCount[],
  peak: number,
  selected: number,
  locale?: string,
) {
  const context = canvas.getContext("2d");
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const first = points[0];
  const last = points.at(-1);
  if (!context) return;

  const ratio = window.devicePixelRatio;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  if (!first || !last || width < 90 || height < 70) return;
  context.scale(ratio, ratio);

  const style = getComputedStyle(canvas);
  const [text, grid, line, fill] = chartColors.map((color) => style.getPropertyValue(color).trim());
  const left = 36;
  const right = width - 18;
  const top = 14;
  const bottom = height - 31;
  const tick = Math.max(1, Math.ceil(peak / 4));
  const highest = tick * Math.max(1, Math.ceil(peak / tick));
  const duration = last.time - first.time;
  const x = (time: number) => left + (duration === 0 ? 0.5 : (time - first.time) / duration) * (right - left);
  const y = (count: number) => bottom - (count / highest) * (bottom - top);

  context.font = "12px system-ui";
  context.textBaseline = "middle";
  context.textAlign = "right";
  for (let count = 0; count <= highest; count += tick) {
    const height = y(count);
    context.beginPath();
    context.strokeStyle = grid;
    context.moveTo(left, height);
    context.lineTo(right, height);
    context.stroke();
    context.fillStyle = text;
    context.fillText(String(count), left - 8, height);
  }

  const formatter = new Intl.DateTimeFormat(
    locale,
    duration > 25 * 3600_000 ? { month: "short", day: "numeric" } : { hour: "numeric", minute: "2-digit" },
  );
  let columns = width < 460 ? 2 : 4;
  if (duration === 0) columns = 0;
  for (let index = 0; index <= columns; index += 1) {
    const time = columns === 0 ? first.time : first.time + duration * (index / columns);
    context.textAlign = "center";
    if (columns > 0 && index === 0) context.textAlign = "left";
    if (columns > 0 && index === columns) context.textAlign = "right";
    context.fillText(formatter.format(time), x(time), bottom + 17);
  }

  const trace = () => {
    context.moveTo(x(first.time), y(first.count));
    let count = first.count;
    for (const point of points.slice(1)) {
      context.lineTo(x(point.time), y(count));
      context.lineTo(x(point.time), y(point.count));
      count = point.count;
    }
  };

  context.beginPath();
  trace();
  context.lineTo(x(last.time), bottom);
  context.lineTo(x(first.time), bottom);
  context.closePath();
  context.fillStyle = fill;
  context.fill();

  context.beginPath();
  trace();
  context.strokeStyle = line;
  context.lineWidth = 2;
  context.lineJoin = "round";
  context.stroke();

  const marker = points[selected] ?? last;
  context.beginPath();
  context.arc(x(marker.time), y(marker.count), 4, 0, 2 * Math.PI);
  context.fillStyle = line;
  context.fill();
}
