import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useIsAdmin } from "@/hooks/use-admin";
import { analyzeLore, applyLore } from "@/lib/ingest.functions";
import type { Extraction } from "@/lib/lore-merge";

export const Route = createFileRoute("/_authenticated/ingest")({
  head: () => ({
    meta: [
      { title: "Lore Ingest — SCU Admin" },
      { name: "description", content: "Upload story PDFs to update the SCU archive." },
      { property: "og:title", content: "Lore Ingest — SCU Admin" },
      { property: "og:description", content: "Upload story PDFs to update the SCU archive." },
    ],
  }),
  component: Ingest,
});

async function readPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const c = await page.getTextContent();
    text += c.items.map((it) => ("str" in it ? it.str : "")).join(" ") + "\n\n";
  }
  return text;
}

type Sel = { e: boolean[]; u: boolean[]; v: boolean[] };

function Ingest() {
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const analyze = useServerFn(analyzeLore);
  const apply = useServerFn(applyLore);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<"idle" | "reading" | "analyzing" | "review" | "saving">("idle");
  const [result, setResult] = useState<Extraction | null>(null);
  const [sel, setSel] = useState<Sel>({ e: [], u: [], v: [] });

  if (!isAdmin) return <main className="mx-auto max-w-xl px-5 pt-32 text-sm text-muted-foreground">Only the admin can use this page.</main>;

  const run = async () => {
    if (!file) return;
    try {
      setStage("reading");
      const text = await readPdf(file);
      if (text.trim().length < 20) throw new Error("No readable text found in this PDF.");
      setStage("analyzing");
      const r = await analyze({ data: { text } });
      setResult(r);
      setSel({ e: r.new_entities.map(() => true), u: r.updates.map(() => true), v: r.events.map(() => true) });
      setStage("review");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setStage("idle");
    }
  };

  const save = async () => {
    if (!result || !file) return;
    setStage("saving");
    try {
      const r = await apply({
        data: {
          filename: file.name,
          new_entities: result.new_entities.filter((_, i) => sel.e[i]),
          updates: result.updates.filter((_, i) => sel.u[i]),
          events: result.events.filter((_, i) => sel.v[i]),
        },
      });
      toast.success(`Added ${r.created}, updated ${r.updated}, ${r.events} timeline events`);
      qc.invalidateQueries();
      setResult(null); setFile(null); setStage("idle");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
      setStage("review");
    }
  };

  const toggle = (k: keyof Sel, i: number) => setSel({ ...sel, [k]: sel[k].map((b, j) => (j === i ? !b : b)) });

  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-28">
      <p className="text-[11px] uppercase tracking-[0.25em] text-accent">Admin</p>
      <h1 className="mt-2 text-5xl font-medium">Lore Ingest</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Upload a story PDF. Only names and facts written in the text are proposed, each with its quote. Pictures are never added automatically, and fields you edited by hand are never overwritten.
      </p>

      <label className="mt-10 flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed bg-card p-6">
        <FileText className="h-6 w-6 text-muted-foreground" />
        <span className="flex-1 text-sm">{file ? file.name : "Choose a PDF"}</span>
        <input type="file" accept="application/pdf" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); setStage("idle"); }} />
      </label>
      <Button className="mt-4" disabled={!file || (stage !== "idle" && stage !== "review")} onClick={run}>
        {stage === "reading" ? "Reading PDF…" : stage === "analyzing" ? "Analyzing lore…" : "Analyze"}
      </Button>

      {result && (
        <div className="mt-12 grid gap-10">
          <Group title="New entries" empty="No new characters or groups found.">
            {result.new_entities.map((e, i) => (
              <Item key={i} checked={!!sel.e[i]} onToggle={() => toggle("e", i)} quote={e.quote}
                title={`${e.name}${e.alias ? ` “${e.alias}”` : ""}`} meta={[e.kind, e.role, e.status].filter(Boolean).join(" · ")} body={e.description} />
            ))}
          </Group>
          <Group title="Additions to existing entries" empty="No new details for existing entries.">
            {result.updates.map((u, i) => (
              <Item key={i} checked={!!sel.u[i]} onToggle={() => toggle("u", i)} quote={u.quote}
                title={u.existing_name} meta={u.status ? `Status → ${u.status}` : ""} body={u.new_facts} />
            ))}
          </Group>
          <Group title="Timeline events" empty="No events found.">
            {result.events.map((v, i) => (
              <Item key={i} checked={!!sel.v[i]} onToggle={() => toggle("v", i)} quote={v.quote} title={v.title} meta={v.era ?? ""} body={v.description} />
            ))}
          </Group>
          <Button onClick={save} disabled={stage === "saving"}>{stage === "saving" ? "Saving…" : "Approve & save selected"}</Button>
        </div>
      )}
    </main>
  );
}

function Group({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <section>
      <h2 className="mb-4 text-2xl font-medium">{title}</h2>
      {children.length ? <div className="grid gap-3">{children}</div> : <p className="text-sm text-muted-foreground">{empty}</p>}
    </section>
  );
}

function Item({ checked, onToggle, title, meta, body, quote }: { checked: boolean; onToggle: () => void; title: string; meta: string; body: string; quote: string }) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-xl border bg-card p-4">
      <Checkbox checked={checked} onCheckedChange={onToggle} className="mt-1" />
      <div className="min-w-0 text-sm">
        <p className="font-medium">{title}</p>
        {meta && <p className="text-xs capitalize text-muted-foreground">{meta}</p>}
        {body && <p className="mt-2">{body}</p>}
        <p className="mt-2 border-l-2 border-accent/60 pl-2 text-xs italic text-muted-foreground">“{quote}”</p>
      </div>
    </label>
  );
}
