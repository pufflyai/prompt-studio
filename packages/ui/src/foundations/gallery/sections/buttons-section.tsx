import { Button, ButtonGroup, HStack, Icon, IconButton, Kbd } from "@chakra-ui/react";
import { ChevronDown, Download, Plus, Settings, Trash2 } from "lucide-react";
import { HorizontalMenuStack } from "@/components/layout/horizontal-menu-stack";
import { GalleryCard, GallerySection } from "../gallery-frame";

export const ButtonsSection = () => {
  return (
    <GallerySection title="Buttons & actions" description="Action variants, sizes, states, and groupings.">
      <GalleryCard title="Variants" names={["Button"]}>
        <HStack gap="sm" flexWrap="wrap">
          <Button variant="primary">Primary</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="subtle">Subtle</Button>
        </HStack>
      </GalleryCard>

      <GalleryCard title="Sizes" names={["Button"]}>
        <HStack gap="sm" flexWrap="wrap" alignItems="center">
          <Button size="2xs" variant="primary">
            2xs
          </Button>
          <Button size="xs" variant="primary">
            Xs
            <Kbd as="span" size="sm">
              Ctrl K
            </Kbd>
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
            <Icon as={Settings} />
            Disabled
          </Button>
          <Button variant="ghost" gap="xs">
            <Icon as={Download} />
            With icon
          </Button>
          <Button variant="destructive">
            <Icon as={Trash2} />
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
          <IconButton variant="destructive" aria-label="Delete permanently">
            <Icon as={Trash2} />
          </IconButton>
        </HStack>
      </GalleryCard>

      <GalleryCard title="Groups" names={["HStack", "HorizontalMenuStack", "ButtonGroup"]}>
        <HStack gap="sm">
          <Button variant="primary">Save</Button>
          <Button variant="outline">Cancel</Button>
        </HStack>
        <HStack gap="sm" flexWrap="wrap">
          <ButtonGroup size="sm" variant="outline" attached>
            <Button variant="outline">Button</Button>
            <IconButton variant="outline" aria-label="More actions">
              <Icon as={ChevronDown} />
            </IconButton>
          </ButtonGroup>
          <ButtonGroup size="xs" variant="subtle" attached>
            <Button variant="subtle">Filter</Button>
            <IconButton variant="subtle" aria-label="Filter options">
              <Icon as={ChevronDown} />
            </IconButton>
          </ButtonGroup>
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
