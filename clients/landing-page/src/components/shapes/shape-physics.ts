import Matter from "matter-js";
import type { FieldPiece, FieldSize, FieldWall } from "./field-layout";

export type Piece = ReturnType<typeof createPiece>;

export const createPiece = (item: FieldPiece) => {
  const x = item.x + item.width / 2;
  const y = item.y + item.height / 2;
  const options: Matter.IBodyDefinition = {
    restitution: 0.28,
    friction: 0.45,
    frictionStatic: 0.6,
    // Let the pile settle quickly after a throw.
    frictionAir: 0.035,
    density: 0.0018,
  };
  const body =
    item.kind === "automation"
      ? Matter.Bodies.circle(x, y, item.height / 2, options)
      : Matter.Bodies.rectangle(x, y, item.width, item.height, {
          ...options,
          chamfer: { radius: Math.min(item.width, item.height) * 0.28 },
        });

  return { id: item.id, kind: item.kind, width: item.width, height: item.height, body };
};

export const createWalls = (walls: FieldWall[], size: FieldSize) => [
  Matter.Bodies.rectangle(size.width / 2, size.height + 30, size.width * 3, 60, { isStatic: true }),
  Matter.Bodies.rectangle(-30, size.height / 2, 60, size.height * 4, { isStatic: true }),
  Matter.Bodies.rectangle(size.width + 30, size.height / 2, 60, size.height * 4, { isStatic: true }),
  ...walls.map((wall) =>
    Matter.Bodies.rectangle(wall.cx, wall.cy, wall.width, wall.height, { isStatic: true, angle: wall.angle }),
  ),
];
