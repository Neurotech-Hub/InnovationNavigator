import { describe, expect, it } from "vitest";
import { resourceById } from "../data";
import {
  CONTEXT_GATED,
  MODALITY_LOCKED,
} from "../data/resourceGating";
import {
  buildResourceCatalog,
  catalogToCsv,
  catalogToGemMarkdown,
  resourceToMarkdown,
} from "./exportResources";

describe("resource catalog export", () => {
  it("includes every resource plus gating rules for Botpress", () => {
    const catalog = buildResourceCatalog("0.2.0");
    expect(catalog.source).toBe("next-move");
    expect(catalog.resourceCount).toBe(catalog.resources.length);
    expect(catalog.resources.some((resource) => resource.id === "gap-fund")).toBe(
      true,
    );
    expect(catalog.gating.contextGated).toEqual(CONTEXT_GATED);
    expect(catalog.gating.modalityLocked).toEqual(MODALITY_LOCKED);
    expect(catalog.resources[0]?.id).toBeDefined();
    expect(catalog.usage.gemPdf).toContain("resources-for-gem.pdf");
  });

  it("flattens array fields in CSV and keeps Gap Fund identifiable", () => {
    const csv = catalogToCsv(buildResourceCatalog());
    expect(csv.startsWith("id,title,organization,url,")).toBe(true);
    expect(csv).toContain("gap-fund");
    expect(csv).toContain("device|diagnostic|software|research-tool");
  });

  it("writes a knowledge-base page with caveats and context gates", () => {
    const catalog = buildResourceCatalog();
    const ecrc = resourceById["ecrc"]!;
    const markdown = resourceToMarkdown(ecrc, catalog);
    expect(markdown).toContain("# Emergency Care Research Core (ECRC)");
    expect(markdown).toContain("Only show when context includes: emergency-care");
    expect(markdown).toContain("## Caveats");
  });

  it("builds a Gem catalog with routing instructions and labeled program blocks", () => {
    const markdown = catalogToGemMarkdown(buildResourceCatalog());
    expect(markdown).toContain("# NextMove resource catalog (for Gemini Gem)");
    expect(markdown).toContain("## How the Gem should use this catalog");
    expect(markdown).toContain("NOT FOR (do not recommend when):");
    expect(markdown).toContain("## PROGRAM:");
    expect(markdown).toContain("ID: gap-fund");
    expect(markdown).toContain("MODALITY LOCK:");
    expect(markdown).toContain("CONTEXT GATE:");
  });
});
