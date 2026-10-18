import { Text } from "@chakra-ui/react";
import { useLabHostProps } from "../hooks/host-context";
import { createLabView } from "../renderers/lab-view-shell";
import { LabPage } from "./lab-page";

const LabOverview = () => {
  const { pageLocation } = useLabHostProps();
  return (
    <>
      <Text aria-label="Current section" textStyle="paragraph/S/regular">
        {pageLocation?.section?.anchors.at(-1)?.heading ?? "Whole document"}
      </Text>
      <LabPage />
    </>
  );
};

export default createLabView(() => <LabOverview />);
