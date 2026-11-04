import { describe, expect, it } from "vitest";
import { buildUpdatePatch, filterGrounded, mergeLocks } from "@/lib/lore-merge";

const source = "Kael Varn, called the Ashen Blade, swore his oath to the Order of Dusk in the year of fire.";

describe("PDF grounding", () => {
  it("drops a character whose quote is not in the PDF", () => {
    const out = filterGrounded(
      {
        new_entities: [
          { kind: "character", name: "Kael Varn", alias: "Ashen Blade", role: null, status: null, description: "", quote: "Kael Varn, called the Ashen Blade" },
          { kind: "character", name: "Mira", alias: null, role: null, status: null, description: "", quote: "Mira led the rebellion" },
        ],
        updates: [],
        events: [],
      },
      source,
    );
    expect(out.new_entities.map((e) => e.name)).toEqual(["Kael Varn"]);
  });
});

describe("merge respects admin edits", () => {
  it("never changes a locked status", () => {
    const patch = buildUpdatePatch(
      { status: "Alive", locked_fields: ["status"] },
      { existing_name: "Kael", new_facts: "", status: "Dead", quote: "x" },
    );
    expect(patch).toEqual({});
  });
  it("updates status when not locked", () => {
    const patch = buildUpdatePatch(
      { status: "Alive", locked_fields: [] },
      { existing_name: "Kael", new_facts: "", status: "Dead", quote: "x" },
    );
    expect(patch).toEqual({ status: "Dead" });
  });
  it("adds edited fields to locks", () => {
    expect(mergeLocks(["name"], ["status", "name"])).toEqual(["name", "status"]);
  });
});
