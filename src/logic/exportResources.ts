import type { Resource } from "../types/navigator";
import {
  CONTEXT_EXPAND,
  CONTEXT_GATED,
  MODALITY_LOCKED,
} from "../data/resourceGating";
import { resources } from "../data/resources";

export const RESOURCE_CATALOG_PATH = "resources.json";
export const RESOURCE_CSV_PATH = "resources.csv";
export const RESOURCE_KB_DIR = "kb";
/** Single catalog tuned for Gemini Gem knowledge upload (markdown). */
export const RESOURCE_GEM_MD_PATH = "resources-for-gem.md";
/** Same catalog as a text-extractable PDF for Gem uploads that prefer PDF. */
export const RESOURCE_GEM_PDF_PATH = "resources-for-gem.pdf";

export interface ResourceCatalog {
  source: "next-move";
  version: string;
  resourceCount: number;
  usage: {
    json: string;
    csv: string;
    knowledgeBase: string;
    gemMarkdown: string;
    gemPdf: string;
  };
  gating: {
    modalityLocked: Record<string, string[]>;
    contextGated: Record<string, string[]>;
    contextExpand: Record<string, string[]>;
  };
  resources: Resource[];
}

export function buildResourceCatalog(version = "0.2.0"): ResourceCatalog {
  return {
    source: "next-move",
    version,
    resourceCount: resources.length,
    usage: {
      json: "Fetch this file from the deployed site. Botpress Execute Code can filter rows; do not RAG-search this blob as one document.",
      csv: "Import into a Botpress Table (one row per program). Use | -separated array columns for filters.",
      knowledgeBase:
        "Upload public/kb/*.md (one file per program) as a Knowledge Base source for conversational search.",
      gemMarkdown:
        "Upload resources-for-gem.md into a Gemini Gem. Prefer this when the Gem accepts markdown; one program per block with explicit field labels.",
      gemPdf:
        "Upload resources-for-gem.pdf into a Gemini Gem when PDF is required. Text-based (not scanned); same content as the gem markdown.",
    },
    gating: {
      modalityLocked: MODALITY_LOCKED,
      contextGated: CONTEXT_GATED,
      contextExpand: CONTEXT_EXPAND,
    },
    resources,
  };
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function joinList(values: string[] | undefined): string {
  return (values ?? []).join("|");
}

export function catalogToCsv(catalog: ResourceCatalog): string {
  const headers = [
    "id",
    "title",
    "organization",
    "url",
    "contact",
    "internality",
    "needs",
    "inventionTypes",
    "locations",
    "domains",
    "states",
    "problemsSolved",
    "whatYouGet",
    "whyYouMightCare",
    "usefulWhen",
    "notFor",
    "eligibility",
    "caveats",
    "investigatorReturns",
    "funding",
    "status",
    "nextDeadline",
    "companyRequired",
    "requiresDisclosure",
    "contextGate",
    "modalityLock",
  ];

  const rows = catalog.resources.map((resource) =>
    [
      resource.id,
      resource.title,
      resource.organization,
      resource.url,
      resource.contact ?? "",
      resource.internality,
      joinList(resource.needs),
      joinList(resource.inventionTypes),
      joinList(resource.locations),
      joinList(resource.domains),
      joinList(resource.states),
      joinList(resource.problemsSolved),
      resource.whatYouGet,
      resource.whyYouMightCare,
      joinList(resource.usefulWhen),
      joinList(resource.notFor),
      resource.eligibility,
      joinList(resource.caveats),
      joinList(resource.investigatorReturns),
      resource.funding ?? "",
      resource.status,
      resource.nextDeadline ?? "",
      String(resource.companyRequired),
      String(resource.requiresDisclosure),
      joinList(catalog.gating.contextGated[resource.id]),
      joinList(catalog.gating.modalityLocked[resource.id]),
    ]
      .map((cell) => csvCell(cell))
      .join(","),
  );

  return [headers.join(","), ...rows].join("\n") + "\n";
}

function listSection(title: string, items: string[]): string {
  if (!items.length) return "";
  return `\n## ${title}\n${items.map((item) => `- ${item}`).join("\n")}\n`;
}

export function resourceToMarkdown(resource: Resource, catalog: ResourceCatalog): string {
  const gate = catalog.gating.contextGated[resource.id];
  const lock = catalog.gating.modalityLocked[resource.id];
  return [
    `# ${resource.title}`,
    "",
    `id: ${resource.id}`,
    `Organization: ${resource.organization}`,
    `URL: ${resource.url}`,
    resource.contact ? `Contact: ${resource.contact}` : null,
    `Location: ${resource.locations.join(", ")}`,
    `Invention types: ${resource.inventionTypes.join(", ")}`,
    `Domains: ${resource.domains.join(", ")}`,
    `Stages: ${resource.states.join(", ")}`,
    `Needs: ${resource.needs.join(", ")}`,
    lock ? `Modality lock: ${lock.join(", ")}` : null,
    gate ? `Only show when context includes: ${gate.join(", ")}` : null,
    resource.companyRequired ? "Requires a company: yes" : "Requires a company: no",
    "",
    "## What you get",
    resource.whatYouGet,
    "",
    "## Why you might care",
    resource.whyYouMightCare,
    listSection("Useful when", resource.usefulWhen),
    listSection("Not for", resource.notFor),
    "",
    "## Eligibility",
    resource.eligibility,
    listSection("Caveats", resource.caveats),
    listSection("Problems solved", resource.problemsSolved),
    resource.funding ? `\n## Funding\n${resource.funding}\n` : "",
  ]
    .filter((line) => line !== null)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

function bulletLines(items: string[]): string {
  if (!items.length) return "- (none listed)";
  return items.map((item) => `- ${item}`).join("\n");
}

function formatGateMap(
  title: string,
  map: Record<string, string[]>,
  resourcesById: Map<string, Resource>,
): string {
  const entries = Object.entries(map);
  if (!entries.length) return `${title}\n- (none)\n`;
  const lines = entries.map(([id, values]) => {
    const titleLabel = resourcesById.get(id)?.title ?? id;
    return `- ${titleLabel} (${id}): ${values.join(", ")}`;
  });
  return `${title}\n${lines.join("\n")}\n`;
}

/**
 * One continuous knowledge document for a Gemini Gem.
 * Uses repeated field labels, discrete PROGRAM blocks, and explicit routing
 * rules so the model can cite eligibility and "not for" before recommending.
 */
export function catalogToGemMarkdown(catalog: ResourceCatalog): string {
  const byId = new Map(catalog.resources.map((resource) => [resource.id, resource]));
  const sorted = [...catalog.resources].sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
  );

  const preamble = [
    "# NextMove resource catalog (for Gemini Gem)",
    "",
    `Source: ${catalog.source}`,
    `Version: ${catalog.version}`,
    `Program count: ${catalog.resourceCount}`,
    `Last generated for Gem upload. Prefer this file (or resources-for-gem.pdf) over resources.json for conversational grounding.`,
    "",
    "## How the Gem should use this catalog",
    "",
    "1. Treat each PROGRAM block as one distinct resource. Do not merge programs.",
    "2. Before recommending a program, check NOT FOR, ELIGIBILITY, COMPANY REQUIRED, MODALITY LOCK, and CONTEXT GATE.",
    "3. Patents, licenses, and startups are vehicles — not destinations. Prefer academic returns when the investigator wants research impact, funding, trainees, or distribution without founding.",
    "4. If COMPANY REQUIRED is no, do not imply the investigator must start a company.",
    "5. If a CONTEXT GATE is listed, only recommend that program when the user's situation matches (for example emergency care, cancer, digital health).",
    "6. If a MODALITY LOCK is listed, only recommend when the invention type matches (for example therapeutics-only or devices-only).",
    "7. When unsure, ask a clarifying question rather than guessing eligibility.",
    "8. Cite the OFFICIAL URL when pointing the investigator to a next step.",
    "",
    "## Global gating rules",
    "",
    formatGateMap(
      "### Modality locks (recommend only for these invention types)",
      catalog.gating.modalityLocked,
      byId,
    ),
    formatGateMap(
      "### Context gates (recommend only when context matches)",
      catalog.gating.contextGated,
      byId,
    ),
    "### Context expand aliases",
    ...Object.entries(catalog.gating.contextExpand).map(
      ([key, values]) => `- ${key} → ${values.join(", ")}`,
    ),
    "",
    "## Program index",
    "",
    ...sorted.map(
      (resource, index) =>
        `${index + 1}. ${resource.title} — id \`${resource.id}\``,
    ),
    "",
    "---",
    "",
  ];

  const programs = sorted.flatMap((resource) => {
    const lock = catalog.gating.modalityLocked[resource.id];
    const gate = catalog.gating.contextGated[resource.id];
    return [
      `## PROGRAM: ${resource.title}`,
      "",
      `ID: ${resource.id}`,
      `ORGANIZATION: ${resource.organization}`,
      `OFFICIAL URL: ${resource.url}`,
      resource.contact ? `CONTACT: ${resource.contact}` : null,
      `LOCATION: ${resource.locations.join(", ")}`,
      `SCOPE: ${resource.internality}`,
      `NEEDS ADDRESSED: ${resource.needs.join(", ") || "(none)"}`,
      `INVENTION TYPES: ${resource.inventionTypes.join(", ") || "(none)"}`,
      `DOMAINS: ${resource.domains.join(", ") || "(none)"}`,
      `JOURNEY STAGES: ${resource.states.join(", ") || "(none)"}`,
      `PRIORITY: ${resource.priority ?? "unspecified"}`,
      `COMPANY REQUIRED: ${resource.companyRequired ? "yes" : "no"}`,
      `DISCLOSURE TYPICALLY NEEDED: ${resource.requiresDisclosure ? "yes" : "no"}`,
      `STATUS: ${resource.status}`,
      resource.nextDeadline ? `NEXT DEADLINE: ${resource.nextDeadline}` : null,
      `LAST VERIFIED: ${resource.lastVerified}`,
      lock ? `MODALITY LOCK: ${lock.join(", ")}` : "MODALITY LOCK: none",
      gate
        ? `CONTEXT GATE: only when context includes ${gate.join(", ")}`
        : "CONTEXT GATE: none",
      "",
      "WHAT YOU GET:",
      resource.whatYouGet,
      "",
      "WHY AN INVESTIGATOR MIGHT CARE:",
      resource.whyYouMightCare,
      "",
      "USEFUL WHEN:",
      bulletLines(resource.usefulWhen),
      "",
      "NOT FOR (do not recommend when):",
      bulletLines(resource.notFor),
      "",
      "ELIGIBILITY:",
      resource.eligibility,
      "",
      "CAVEATS:",
      bulletLines(resource.caveats),
      "",
      "ACADEMIC RETURNS:",
      bulletLines(resource.investigatorReturns),
      "",
      "PROBLEMS SOLVED:",
      bulletLines(resource.problemsSolved),
      resource.funding ? `\nFUNDING:\n${resource.funding}` : null,
      resource.sourceUrls.length
        ? `\nSOURCE URLS:\n${bulletLines(resource.sourceUrls)}`
        : null,
      "",
      "---",
      "",
    ].filter((line) => line !== null);
  });

  return [...preamble, ...programs].join("\n").replace(/\n{3,}/g, "\n\n");
}
