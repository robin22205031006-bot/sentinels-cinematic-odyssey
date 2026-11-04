import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { CHARACTER_STATUSES, GROUP_KINDS, GROUP_STATUSES, fileToDataUrl, type Entity } from "@/lib/entities";
import { mergeLocks } from "@/lib/lore-merge";

type Kind = Entity["kind"];
const FIELDS = ["name", "alias", "role", "status", "description", "image_url", "stats"] as const;

export function EntityDialog({
  open,
  onOpenChange,
  entity,
  defaultKind,
  allowedKinds,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entity?: Entity | null;
  defaultKind: Kind;
  allowedKinds: Kind[];
}) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<Kind>(entity?.kind ?? defaultKind);
  const [form, setForm] = useState({
    name: entity?.name ?? "",
    alias: entity?.alias ?? "",
    role: entity?.role ?? "",
    status: entity?.status ?? (defaultKind === "character" ? "Alive" : "Active"),
    description: entity?.description ?? "",
    image_url: entity?.image_url ?? "",
    stats: entity ? Object.entries((entity.stats as Record<string, string>) ?? {}).map(([k, v]) => `${k}: ${v}`).join("\n") : "",
  });
  const [saving, setSaving] = useState(false);
  const statuses = kind === "character" ? CHARACTER_STATUSES : GROUP_STATUSES;
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    const stats = Object.fromEntries(
      form.stats.split("\n").map((l) => l.split(":")).filter((p) => p.length >= 2 && (p[0] ?? "").trim()).map(([k, ...v]) => [(k ?? "").trim(), v.join(":").trim()]),
    );
    const row = {
      kind,
      name: form.name.trim(),
      alias: form.alias || null,
      role: form.role || null,
      status: form.status,
      description: form.description,
      image_url: form.image_url || null,
      stats,
    };
    let error;
    if (entity) {
      const changed = FIELDS.filter((f) => JSON.stringify((entity as any)[f] ?? "") !== JSON.stringify((row as any)[f] ?? ""));
      ({ error } = await supabase
        .from("entities")
        .update({ ...row, locked_fields: mergeLocks(entity.locked_fields, changed), updated_at: new Date().toISOString() })
        .eq("id", entity.id));
    } else {
      ({ error } = await supabase.from("entities").insert({ ...row, locked_fields: [...FIELDS] }));
    }
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(entity ? "Saved" : "Created");
    qc.invalidateQueries({ queryKey: ["entities"] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{entity ? `Edit ${entity.name}` : "New entry"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          {allowedKinds.length > 1 && (
            <div className="grid gap-1.5">
              <Label>Type</Label>
              <select className="h-9 rounded-md border bg-background px-3 text-sm" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                {allowedKinds.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
          )}
          <div className="grid gap-1.5"><Label>Name</Label><Input value={form.name} onChange={set("name")} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Alias</Label><Input value={form.alias} onChange={set("alias")} /></div>
            <div className="grid gap-1.5"><Label>Role</Label><Input value={form.role} onChange={set("role")} /></div>
          </div>
          <div className="grid gap-1.5">
            <Label>Status</Label>
            <div className="flex flex-wrap gap-1.5">
              {statuses.map((s) => (
                <button key={s} type="button" onClick={() => setForm({ ...form, status: s })}
                  className={`rounded-full border px-3 py-1 text-xs ${form.status === s ? "border-foreground bg-foreground text-background" : "text-muted-foreground"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-1.5"><Label>Description</Label><Textarea rows={5} value={form.description} onChange={set("description")} /></div>
          <div className="grid gap-1.5"><Label>Stats (one per line, e.g. "Power: 9")</Label><Textarea rows={3} value={form.stats} onChange={set("stats")} /></div>
          <div className="grid gap-1.5">
            <Label>Picture</Label>
            {form.image_url && <img src={form.image_url} alt="" className="h-24 w-24 rounded-md object-cover" />}
            <div className="flex gap-2">
              <Input type="file" accept="image/*" onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setForm({ ...form, image_url: await fileToDataUrl(f) });
              }} />
              {form.image_url && <Button variant="ghost" size="sm" onClick={() => setForm({ ...form, image_url: "" })}>Remove</Button>}
            </div>
          </div>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
