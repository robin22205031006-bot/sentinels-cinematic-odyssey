import { createFileRoute } from "@tanstack/react-router";
import { EntitySection } from "@/components/entity-section";

export const Route = createFileRoute("/characters")({
  head: () => ({
    meta: [
      { title: "Characters — Sentinels Cinematic Universe" },
      { name: "description", content: "Dossiers for every character in the Sentinels Cinematic Universe." },
      { property: "og:title", content: "Characters — SCU" },
      { property: "og:description", content: "Dossiers for every character in the Sentinels Cinematic Universe." },
    ],
  }),
  component: () => (
    <EntitySection kinds={["character"]} title="Characters" subtitle="Tap a dossier to open it." />
  ),
});
