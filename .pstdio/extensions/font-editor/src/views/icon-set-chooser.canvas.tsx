import { useState } from "react";
import { IconSetChooser } from "./icon-set-chooser";

export default { title: "Extensions/Icon Set editor/Icon sets" };
export const ChooseIconSet = () => {
  const [value, setValue] = useState("all");
  return <IconSetChooser value={value} disabled={false} onChange={setValue} />;
};
