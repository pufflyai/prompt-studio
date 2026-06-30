import { Button, HStack, Icon, IconButton } from "@chakra-ui/react";
import { Download, Plus, Settings, Trash2 } from "lucide-react";
import { HorizontalMenuStack } from "@/components/horizontal-menu-stack";
import { GalleryCard, GallerySection } from "../gallery-frame";

export const ButtonsSection = () => {
  return (
    <GallerySection title="Buttons & actions" description="Action variants, sizes, states, and groupings.">
      <GalleryCard title="Variants" names={["Button"]}>
        <HStack gap="sm" flexWrap="wrap">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="subtle">Subtle</Button>
        </HStack>
      </GalleryCard>

      <GalleryCard title="Sizes" names={["Button"]}>
        <HStack gap="sm" flexWrap="wrap" alignItems="center">
          <Button size="xs" variant="primary">
            Xs
          </Button>
          <Button size="sm" variant="primary">
            Sm
          </Button>
          <Button size="md" variant="primary">
            Md
          </Button>
          <Button size="lg" variant="primary">
            Lg
          </Button>
        </HStack>
      </GalleryCard>

      <GalleryCard title="States" names={["Button"]}>
        <HStack gap="sm" flexWrap="wrap">
          <Button variant="primary" loading>
            Loading
          </Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
          <Button variant="ghost" gap="xs">
            <Icon as={Download} />
            With icon
          </Button>
          <Button variant="outline" colorPalette="red">
            Destructive
          </Button>
        </HStack>
      </GalleryCard>

      <GalleryCard title="Icon buttons" names={["IconButton"]}>
        <HStack gap="sm">
          <IconButton variant="primary" aria-label="Add item">
            <Icon as={Plus} />
          </IconButton>
          <IconButton variant="outline" aria-label="Settings">
            <Icon as={Settings} />
          </IconButton>
          <IconButton variant="ghost" aria-label="Delete">
            <Icon as={Trash2} />
          </IconButton>
        </HStack>
      </GalleryCard>

      <GalleryCard title="Groups" names={["HStack", "HorizontalMenuStack"]}>
        <HStack gap="sm">
          <Button variant="primary">Save</Button>
          <Button variant="outline">Cancel</Button>
        </HStack>
        <HorizontalMenuStack>
          <HStack gap="sm">
            <Button variant="ghost">Home</Button>
            <Button variant="ghost">About</Button>
          </HStack>
          <Button variant="outline">Settings</Button>
        </HorizontalMenuStack>
      </GalleryCard>
    </GallerySection>
  );
};
