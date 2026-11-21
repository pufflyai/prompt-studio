import { carry } from "../agents";
import { card, ISO_TINT, slab } from "../greek";
import { clamp, pick } from "../motion";
import type { Agent, IsoBox, IsoScene } from "../scene";

export type Ticket = IsoBox & { column: number };

const BOARD = { x: 20, y: 20, w: 180, d: 150 };
const AREA = { x: BOARD.x + 8, y: BOARD.y + 16, w: BOARD.w - 16, d: BOARD.d - 24 };
const COLUMN_W = (AREA.w - 10) / 3;
const START = [3, 2, 1];
const columnX = (column: number) => AREA.x + column * (COLUMN_W + 5);
const rowY = (row: number) => AREA.y + 6 + row * 26;

/**
 * A three-column ticket board. `changed` runs whenever a ticket lands in a column, so other
 * tools reading the same tickets can update.
 */
export const createBoard = (scene: IsoScene, changed: () => void) => {
  scene.add({ ...BOARD, h: 10, html: slab() });
  for (let column = 0; column < 3; column++)
    scene.add({ x: columnX(column), y: AREA.y, w: COLUMN_W, d: AREA.d, h: 2, z: 10, color: ISO_TINT });
  const tickets: Ticket[] = START.flatMap((count, column) =>
    Array.from({ length: count }, (_, row) =>
      scene.add({
        x: columnX(column) + 4,
        y: rowY(row),
        w: COLUMN_W - 8,
        d: 22,
        h: 5,
        z: 12,
        html: card(),
        drag: true,
        column,
      }),
    ),
  );
  const counts = () => [0, 1, 2].map((column) => tickets.filter((ticket) => ticket.column === column).length);
  const restack = () => {
    for (let column = 0; column < 3; column++)
      tickets
        .filter((ticket) => ticket.column === column && !ticket.held && !ticket.carried)
        .sort((a, b) => a.t.y - b.t.y)
        .forEach((ticket, row) => {
          Object.assign(ticket.t, { x: columnX(column) + 4, y: rowY(row), z: 12 });
        });
    changed();
  };
  const landingSpot = (column: number) => ({ x: columnX(column) + 4, y: rowY(counts()[column]), z: 12 });
  // Clicking a ticket moves it on, like the agents do; done tickets go back to the start.
  const advance = (ticket: Ticket) => {
    ticket.column = (ticket.column + 1) % 3;
    restack();
  };
  for (const ticket of tickets) ticket.click = () => advance(ticket);
  scene.onFree = (box) => {
    const ticket = box as Ticket;
    if (!tickets.includes(ticket)) return;
    ticket.column = clamp(Math.floor((ticket.t.x + ticket.t.w / 2 - AREA.x) / (COLUMN_W + 5)), 0, 2);
    restack();
  };
  const work = async (agent: Agent) => {
    const open = tickets.filter((ticket) => ticket.column < 2 && !ticket.held && !ticket.carried);
    if (!open.length) {
      for (const ticket of tickets) ticket.column = 0;
      restack();
      return;
    }
    const ticket = pick(open);
    if (await carry(agent, ticket, landingSpot(ticket.column + 1), 26)) ticket.column += 1;
    restack();
  };
  return { counts, work };
};
