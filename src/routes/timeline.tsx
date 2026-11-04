import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/use-admin";
import { timelineQuery } from "@/lib/entities";

export const Route = createFileRoute("/timeline")({
  head: () => ({
    meta: [
      { title: "Timeline — Sentinels Cinematic Universe" },
      { name: "description", content: "The chronological history of the Sentinels Cinematic Universe." },
      { property: "og:title", content: "Timeline — SCU" },
      { property: "og:description", content: "The chronological history of the SCU." },
    ],
  }),
  component: Timeline,
});

function Timeline() {
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(timelineQuery);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ title: "", era: "", description: "" });

  const add = async () => {
    if (!f.title.trim()) return;
    const { error } = await supabase.from("timeline_events").insert({ ...f, era: f.era || null, sort_order: (data?.length ?? 0) + 1 });
    if (error) return toast.error(error.message);
    setF({ title: "", era: "", description: "" }); setAdding(false);
    qc.invalidateQueries({ queryKey: ["timeline"] });
  };
  const del = async (id: string) => {
    const { error } = await supabase.from("timeline_events").delete().eq("id", id);
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["timeline"] });
  };

  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-28">
      <header className="mb-12 flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-accent">Chronicle</p>
          <h1 className="mt-2 text-5xl font-medium">Timeline</h1>
        </div>
        {isAdmin && <Button size="sm" onClick={() => setAdding(!adding)}><Plus className="h-4 w-4" />Event</Button>}
      </header>
      {adding && (
        <div className="mb-10 grid gap-3 rounded-2xl border bg-card p-5">
          <Input placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <Input placeholder="Era / year (optional)" value={f.era} onChange={(e) => setF({ ...f, era: e.target.value })} />
          <Textarea placeholder="What happened" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          <Button onClick={add}>Add event</Button>
        </div>
      )}
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : !data?.length ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No events yet.</p>
      ) : (
        <ol className="relative border-l pl-8">
          {data.map((ev) => (
            <li key={ev.id} className="group relative pb-10 last:pb-0">
              <span className="absolute -left-[37px] top-2 h-2.5 w-2.5 rounded-full border-2 border-accent bg-background" />
              {ev.era && <p className="text-[11px] uppercase tracking-widest text-accent">{ev.era}</p>}
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-2xl font-medium">{ev.title}</h2>
                {isAdmin && <button aria-label="Delete event" onClick={() => del(ev.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>}
              </div>
              {ev.description && <p className="mt-1 text-sm leading-relaxed text-foreground/80">{ev.description}</p>}
              {ev.source && <p className="mt-1 text-xs text-muted-foreground">From {ev.source}</p>}
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
