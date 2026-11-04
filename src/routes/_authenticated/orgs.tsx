import { createFileRoute } from "@tanstack/react-router";
import { EntitySection } from "@/components/entity-section";

export const Route = createFileRoute("/_authenticated/orgs")({
  head: () => ({
    meta: [
      { title: "Orgs & Bloodlines — Sentinels Cinematic Universe" },
      { name: "description", content: "Organizations, clans, bloodlines and factions of the SCU." },
      { property: "og:title", content: "Orgs & Bloodlines — SCU" },
      { property: "og:description", content: "Organizations, clans, bloodlines and factions of the SCU." },
    ],
  }),
  component: () => (
    <EntitySection
      kinds={["organization", "clan", "bloodline", "faction"]}
      title="Orgs & Bloodlines"
      subtitle="Orders, clans, lineages and factions."
    />
  ),
});
