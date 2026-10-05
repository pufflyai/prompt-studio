import { Calendar, CircleDashed, Hash, SquareCheck, Tags, Type, UserRound } from "lucide-react";
import type { AttributeDescriptor } from "../kanban-renderer/types";

const FIELD_ICONS = {
  string: Type,
  number: Hash,
  date: Calendar,
  boolean: SquareCheck,
  enum: CircleDashed,
  "enum-multi": Tags,
  user: UserRound,
};

export const fieldIcon = (field: AttributeDescriptor) => FIELD_ICONS[field.type.kind];
