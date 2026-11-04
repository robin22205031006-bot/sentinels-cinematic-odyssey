import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildUpdatePatch, filterGrounded, type Extraction } from "./lore-merge";

const kinds = ["character", "organization", "clan", "bloodline", "faction"] as const;

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["new_entities", "updates", "events"],
  properties: {
    new_entities: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "name", "alias", "role", "status", "description", "quote"],
        properties: {
          kind: { type: "string", enum: kinds },
          name: { type: "string" },
          alias: { type: ["string", "null"] },
          role: { type: ["string", "null"] },
          status: { type: ["string", "null"] },
          description: { type: "string" },
          quote: { type: "string" },
        },
      },
    },
    updates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["existing_name", "new_facts", "status", "quote"],
        properties: {
          existing_name: { type: "string" },
          new_facts: { type: "string" },
          status: { type: ["string", "null"] },
          quote: { type: "string" },
        },
      },
    },
    events: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "era", "description", "quote"],
        properties: {
          title: { type: "string" },
          era: { type: ["string", "null"] },
          description: { type: "string" },
          quote: { type: "string" },
        },
      },
    },
  },
} as const;

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Only the admin can do this.");
}

export const analyzeLore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ text: z.string().min(20).max(400_000) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: existing } = await context.supabase.from("entities").select("name, kind");
    const names = (existing ?? []).map((e) => `${e.name} (${e.kind})`).join("; ") || "none";

    const { generateResponse } = await import("@lovable.dev/ai-gateway");
    const res = await generateResponse({
      model: "openai/gpt-6-astra",
      instructions:
        "You extract lore from a story text for the Sentinels Cinematic Universe archive. STRICT RULES: " +
        "Only use facts explicitly written in the text. Never invent or guess. " +
        "Only create an organization/clan/bloodline/faction if the text clearly names it as such a group. " +
        "If a character or group already exists in the archive list, put new information in `updates` (use the exact existing name), not `new_entities`. " +
        "Status for characters must be one of Alive, Dead, Retired, Missing, Legend; for groups Active or Inactive; null if the text doesn't say. " +
        "Every item must include `quote`: an exact, verbatim sentence fragment (10-200 chars) copied from the text that supports it. " +
        "Write descriptions concisely using only the text's information.",
      input: [
        {
          role: "user",
          content: `Existing archive entries: ${names}\n\nSTORY TEXT:\n${data.text.slice(0, 300_000)}`,
        },
      ],
      text: { format: { type: "json_schema", name: "lore_extraction", schema, strict: true } },
    } as any);

    const out = (res as any).output ?? [];
    let raw = "";
    for (const item of out) for (const c of item.content ?? []) if (c.type === "output_text") raw += c.text;
    const parsed = JSON.parse(raw) as Extraction;
    return filterGrounded(parsed, data.text);
  });

const applySchema = z.object({
  filename: z.string().max(300),
  new_entities: z.array(
    z.object({
      kind: z.enum(kinds),
      name: z.string(),
      alias: z.string().nullable(),
      role: z.string().nullable(),
      status: z.string().nullable(),
      description: z.string(),
      quote: z.string(),
    }),
  ),
  updates: z.array(
    z.object({ existing_name: z.string(), new_facts: z.string(), status: z.string().nullable(), quote: z.string() }),
  ),
  events: z.array(z.object({ title: z.string(), era: z.string().nullable(), description: z.string(), quote: z.string() })),
});

export const applyLore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => applySchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    await assertAdmin(sb, context.userId);
    const src = data.filename;
    let created = 0, updated = 0, events = 0;

    for (const e of data.new_entities) {
      const { data: dup } = await sb.from("entities").select("id").ilike("name", e.name).maybeSingle();
      if (dup) {
        await sb.from("lore_notes").insert({ entity_id: dup.id, text: e.description, source: src });
        updated++;
        continue;
      }
      const isChar = e.kind === "character";
      const { error } = await sb.from("entities").insert({
        kind: e.kind,
        name: e.name,
        alias: e.alias,
        role: e.role,
        status: e.status ?? (isChar ? "Alive" : "Active"),
        description: e.description,
        image_url: null,
      });
      if (!error) created++;
    }

    for (const u of data.updates) {
      const { data: target } = await sb
        .from("entities")
        .select("id, status, locked_fields")
        .ilike("name", u.existing_name)
        .maybeSingle();
      if (!target) continue;
      if (u.new_facts.trim()) await sb.from("lore_notes").insert({ entity_id: target.id, text: u.new_facts, source: src });
      const patch = buildUpdatePatch(target, u);
      if (Object.keys(patch).length) await sb.from("entities").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", target.id);
      updated++;
    }

    const { count } = await sb.from("timeline_events").select("id", { count: "exact", head: true });
    let order = count ?? 0;
    for (const ev of data.events) {
      const { error } = await sb.from("timeline_events").insert({
        title: ev.title, era: ev.era, description: ev.description, source: src, sort_order: ++order,
      });
      if (!error) events++;
    }

    await sb.from("ingest_jobs").insert({ filename: src, summary: { created, updated, events } });
    return { created, updated, events };
  });
