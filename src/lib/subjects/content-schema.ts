import { z } from "zod";

/**
 * Shape of `subject_profiles.content`.
 *
 * Official university facts (name, code, credits, seats, basket, programme)
 * never live here; they come from the elective offering itself. Everything in
 * this file is supplementary guidance, and every section says where it came
 * from and whether anyone has verified it, so the UI can label it honestly.
 */

export const PROVENANCE_STATUSES = ["OFFICIAL", "PROPOSED", "UNVERIFIED"] as const;
export type ProvenanceStatus = (typeof PROVENANCE_STATUSES)[number];

export const provenanceSchema = z.object({
  /** OFFICIAL = approved by the university/faculty. PROPOSED = drafted guidance, not approved. UNVERIFIED = not checked yet. */
  status: z.enum(PROVENANCE_STATUSES),
  /** Who or what the content came from, e.g. "Faculty syllabus, Dept. of CA" or "Electify editorial draft". */
  source: z.string().trim().max(200).optional(),
  /** ISO date the content was last checked against its source. */
  verifiedAt: z.string().date().optional(),
  verifiedBy: z.string().trim().max(120).optional(),
});
export type Provenance = z.infer<typeof provenanceSchema>;

const text = (max = 600) => z.string().trim().min(1).max(max);

/** Only absolute https URLs are ever rendered as links. */
export function safeExternalUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && url.hostname.includes(".") ? url.toString() : null;
  } catch {
    return null;
  }
}

export const resourceSchema = z.object({
  title: text(160),
  url: z.string().refine((v) => safeExternalUrl(v) !== null, "Must be an absolute https:// URL"),
  provider: text(80),
  description: text(400),
  kind: z.enum(["standard", "course", "documentation", "reference"]),
  relevance: text(200).optional(),
  /** Set only by the explicit link-check process (scripts/seed-subject-profiles.ts --check-links). */
  lastCheckedAt: z.string().datetime().optional(),
  lastCheckStatus: z.enum(["ok", "redirect", "failed"]).optional(),
});
export type SubjectResource = z.infer<typeof resourceSchema>;

export const subjectContentSchema = z.object({
  tags: z.array(text(40)).max(20).default([]),
  overview: z
    .object({
      provenance: provenanceSchema,
      paragraphs: z.array(text(900)).min(1).max(6),
      learnPoints: z.array(text(240)).max(8).default([]),
    })
    .optional(),
  syllabus: z
    .object({
      provenance: provenanceSchema,
      note: text(400).optional(),
      units: z
        .array(z.object({ title: text(120), summary: text(400).optional(), topics: z.array(text(200)).min(1).max(15) }))
        .min(1)
        .max(10),
    })
    .optional(),
  outcomes: z.object({ provenance: provenanceSchema, items: z.array(text(300)).min(1).max(10) }).optional(),
  prerequisites: z
    .object({
      /** University-mandated prerequisites. Empty with status OFFICIAL means "none"; absent means "not provided". */
      official: z.object({ provenance: provenanceSchema, items: z.array(text(240)).max(10) }).optional(),
      recommended: z.array(text(240)).max(10).default([]),
      helpfulSkills: z.array(text(240)).max(10).default([]),
    })
    .optional(),
  difficulty: z
    .object({
      level: z.enum(["BEGINNER", "MODERATE", "ADVANCED"]),
      provenance: provenanceSchema,
      challenges: z.array(text(240)).max(6).default([]),
    })
    .optional(),
  careers: z
    .object({
      provenance: provenanceSchema,
      roles: z.array(z.object({ title: text(80), summary: text(300), skills: z.array(text(80)).min(1).max(8) })).min(1).max(8),
    })
    .optional(),
  resources: z.array(resourceSchema).max(20).default([]),
  examples: z.array(z.object({ title: text(100), description: text(300) })).max(8).default([]),
});
export type SubjectContent = z.infer<typeof subjectContentSchema>;

/**
 * Lenient reader for rendering: validates section by section and drops anything
 * malformed (e.g. one bad resource URL) instead of failing the whole page.
 */
export function readSubjectContent(raw: unknown): SubjectContent {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pick = <T,>(schema: z.ZodType<T>, value: unknown): T | undefined => {
    const r = schema.safeParse(value);
    return r.success ? r.data : undefined;
  };
  const shape = subjectContentSchema.shape;

  const resources = Array.isArray(input.resources)
    ? input.resources.map((r) => pick(resourceSchema, r)).filter((r): r is SubjectResource => Boolean(r))
    : [];

  return {
    tags: pick(shape.tags, input.tags) ?? [],
    overview: pick(shape.overview, input.overview),
    syllabus: pick(shape.syllabus, input.syllabus),
    outcomes: pick(shape.outcomes, input.outcomes),
    prerequisites: pick(shape.prerequisites, input.prerequisites),
    difficulty: pick(shape.difficulty, input.difficulty),
    careers: pick(shape.careers, input.careers),
    resources,
    examples: pick(shape.examples, input.examples) ?? [],
  };
}

/** Normalises subject names for matching offerings to profiles. */
export function normalizeSubjectName(name: string) {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
