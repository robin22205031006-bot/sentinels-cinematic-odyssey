import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/use-admin";
import { entitiesQuery, notesQuery, type Entity } from "@/lib/entities";
import { EntityDialog } from "./entity-dialog";

const statusClass: Record<string, string> = {
  Alive: "text-status-alive", Active: "text-status-alive",
  Dead: "text-status-dead", Inactive: "text-status-neutral",
  Legend: "text-status-legend",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] ${statusClass[status] ?? "text-status-neutral"}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />{status}
    </span>
  );
}

function Dossier({ e }: { e: Entity }) {
  const { data: notes } = useQuery(notesQuery(e.id));
  const stats = Object.entries((e.stats as Record<string, string>) ?? {});
  return (
    <div className="mt-5 grid gap-5 border-t pt-5 text-sm leading-relaxed animate-in fade-in slide-in-from-top-1 duration-300">
      {e.description && <p className="whitespace-pre-line text-foreground/85">{e.description}</p>}
      {stats.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
          {stats.map(([k, v]) => (
            <div key={k}><dt className="text-[11px] uppercase tracking-widest text-muted-foreground">{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
      )}
      {notes && notes.length > 0 && (
        <div className="grid gap-3">
          <h4 className="text-[11px] uppercase tracking-widest text-muted-foreground">Lore notes</h4>
          {notes.map((n) => (
            <div key={n.id} className="border-l-2 border-accent/60 pl-3">
              <p>{n.text}</p>
              {n.source && <p className="mt-1 text-xs text-muted-foreground">From {n.source}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function EntitySection({
  kinds, title, subtitle,
}: { kinds: Entity["kind"][]; title: string; subtitle: string }) {
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(entitiesQuery(kinds));
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<Entity | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Entity | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const list = (data ?? []).filter((e) => filter === "all" || e.kind === filter);

  const doDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("entities").delete().eq("id", deleting.id);
    if (error) toast.error(error.message);
    else { toast.success(`${deleting.name} deleted`); qc.invalidateQueries({ queryKey: ["entities"] }); }
    setDeleting(null);
  };

  return (
    <main className="mx-auto max-w-5xl px-5 pb-24 pt-28">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-accent">Archive</p>
          <h1 className="mt-2 text-5xl font-medium">{title}</h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {isAdmin && <Button onClick={() => setEditing(null)} size="sm"><Plus className="h-4 w-4" />New</Button>}
      </header>

      {kinds.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-1.5">
          {["all", ...kinds].map((k) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`rounded-full px-3 py-1 text-xs capitalize ${filter === k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
              {k === "all" ? "All" : `${k}s`}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : list.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Nothing in the archive yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((e) => {
            const expanded = open === e.id;
            return (
              <article key={e.id}
                className={`group rounded-2xl border bg-card p-5 transition-all duration-500 ${expanded ? "sm:col-span-2 rounded-tl-[2rem]" : "hover:rounded-tr-[2rem]"}`}>
                <div className="flex gap-4">
                  {e.image_url ? (
                    <img src={e.image_url} alt={e.name} className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-secondary font-display text-2xl text-muted-foreground">
                      {e.name[0]}
                    </div>
                  )}
                  <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(expanded ? null : e.id)}>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <StatusBadge status={e.status} />
                      {kinds.length > 1 && <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{e.kind}</span>}
                    </div>
                    <h2 className="mt-1 truncate text-2xl font-medium">{e.name}</h2>
                    <p className="truncate text-sm text-muted-foreground">{[e.alias, e.role].filter(Boolean).join(" · ") || "—"}</p>
                  </button>
                  {isAdmin && (
                    <div className="flex shrink-0 flex-col gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Edit" onClick={() => setEditing(e)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label="Delete" onClick={() => setDeleting(e)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  )}
                </div>
                {expanded && <Dossier e={e} />}
              </article>
            );
          })}
        </div>
      )}

      {editing !== undefined && (
        <EntityDialog key={editing?.id ?? "new"} open onOpenChange={(o) => !o && setEditing(undefined)}
          entity={editing} defaultKind={kinds[0] ?? "character"} allowedKinds={kinds} />
      )}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the entry and its lore notes.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
