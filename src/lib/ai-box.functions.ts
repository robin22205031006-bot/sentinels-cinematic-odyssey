import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).min(1).max(30),
});

export const askLore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => input.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const [e, n, t] = await Promise.all([
      sb.from("entities").select("id, kind, name, alias, role, status, category, description, stats"),
      sb.from("lore_notes").select("entity_id, text"),
      sb.from("timeline_events").select("title, era, series, description").order("sort_order"),
    ]);
    const notes = n.data ?? [];
    const lore = [
      "ARCHIVE ENTRIES:",
      ...(e.data ?? []).map((x) =>
        `- ${x.name}${x.alias ? ` (${x.alias})` : ""} [${x.kind}${x.category ? `, ${x.category}` : ""}, ${x.status}]${x.role ? ` — ${x.role}` : ""}: ${x.description} ${JSON.stringify(x.stats)} ${notes.filter((m) => m.entity_id === x.id).map((m) => m.text).join(" ")}`,
      ),
      "TIMELINE:",
      ...(t.data ?? []).map((x) => `- ${[x.era, x.series].filter(Boolean).join(" / ")} ${x.title}: ${x.description}`),
    ].join("\n").slice(0, 200_000);

    const { generateResponse } = await import("@lovable.dev/ai-gateway");
    const res = await generateResponse({
      model: "openai/gpt-6-astra",
      instructions:
        "You are the SCU AI Box, the archivist of the Sentinels Cinematic Universe. Answer ONLY using the SCU lore below. " +
        "If the lore doesn't contain the answer, say it isn't in the archive yet. Never invent characters, events or facts, and decline questions unrelated to the SCU. " +
        "Be concise.\n\n" + lore,
      input: data.messages.map((m) => ({ role: m.role, content: m.content })),
    } as any);
    let text = "";
    for (const item of (res as any).output ?? []) for (const c of item.content ?? []) if (c.type === "output_text") text += c.text;
    return { reply: text || "I couldn't find an answer in the archive." };
  });
