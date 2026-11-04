// Pure helpers for PDF lore ingestion: grounding checks and safe merging.

export type EntityKind = "character" | "organization" | "clan" | "bloodline" | "faction";

export interface ProposedEntity {
  kind: EntityKind;
  name: string;
  alias: string | null;
  role: string | null;
  status: string | null;
  description: string;
  quote: string;
}

export interface ProposedUpdate {
  existing_name: string;
  new_facts: string;
  status: string | null;
  quote: string;
}

export interface ProposedEvent {
  title: string;
  era: string | null;
  description: string;
  quote: string;
}

export interface Extraction {
  new_entities: ProposedEntity[];
  updates: ProposedUpdate[];
  events: ProposedEvent[];
}

export const normalize = (s: string) =>
  s.toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\s+/g, " ").trim();

/** True only if the quote literally appears in the source text. */
export function isGrounded(quote: string, sourceNorm: string): boolean {
  const q = normalize(quote);
  return q.length >= 8 && sourceNorm.includes(q);
}

/** Drop anything whose quote or name isn't literally in the PDF text. */
export function filterGrounded(ex: Extraction, source: string): Extraction {
  const src = normalize(source);
  return {
    new_entities: ex.new_entities.filter(
      (e) => isGrounded(e.quote, src) && src.includes(normalize(e.name)),
    ),
    updates: ex.updates.filter(
      (u) => isGrounded(u.quote, src) && src.includes(normalize(u.existing_name)),
    ),
    events: ex.events.filter((e) => isGrounded(e.quote, src)),
  };
}

export interface MergeTarget {
  status: string;
  locked_fields: string[];
}

/** Returns the patch to apply to an existing entity; never touches locked fields. */
export function buildUpdatePatch(target: MergeTarget, update: ProposedUpdate): Record<string, string> {
  const patch: Record<string, string> = {};
  if (update.status && !target.locked_fields.includes("status") && update.status !== target.status) {
    patch["status"] = update.status;
  }
  return patch;
}

/** Edited fields become locked so later PDFs never overwrite them. */
export function mergeLocks(existing: string[], changed: string[]): string[] {
  return Array.from(new Set([...existing, ...changed]));
}
