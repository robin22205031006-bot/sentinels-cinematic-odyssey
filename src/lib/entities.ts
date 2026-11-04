import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Entity = Tables<"entities">;
export type LoreNote = Tables<"lore_notes">;
export type TimelineEvent = Tables<"timeline_events">;

export const CHARACTER_STATUSES = ["Alive", "Dead", "Retired", "Missing", "Legend"];
export const GROUP_STATUSES = ["Active", "Inactive"];
export const GROUP_KINDS = ["organization", "clan", "bloodline", "faction"] as const;

export const entitiesQuery = (kinds: string[]) =>
  queryOptions({
    queryKey: ["entities", kinds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entities")
        .select("*")
        .in("kind", kinds as Entity["kind"][])
        .order("name");
      if (error) throw error;
      return data;
    },
  });

export const notesQuery = (entityId: string) =>
  queryOptions({
    queryKey: ["notes", entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lore_notes")
        .select("*")
        .eq("entity_id", entityId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

export const timelineQuery = queryOptions({
  queryKey: ["timeline"],
  queryFn: async () => {
    const { data, error } = await supabase.from("timeline_events").select("*").order("sort_order");
    if (error) throw error;
    return data;
  },
});

/** Resize an image file to a small data URL so it can be stored with the entry. */
export async function fileToDataUrl(file: File, max = 640): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.82);
}
