import type { VaultSnapshot } from "../src/core/domain-resolver";

export interface NoteSpec {
  frontmatter?: Record<string, unknown>;
  body?: string;
}

export function makeSnapshot(notes: Record<string, NoteSpec>): VaultSnapshot {
  return {
    files: Object.entries(notes).map(([path, spec]) => ({
      path,
      frontmatter: spec.frontmatter ?? null,
    })),
    readFileBody: (path: string) => {
      const spec = notes[path];
      if (!spec) throw new Error(`no such note: ${path}`);
      return Promise.resolve(spec.body ?? "");
    },
  };
}

export function indexPageSpec(
  mode: "series" | "independent",
  extra?: Record<string, unknown>,
  inner = "",
): NoteSpec {
  return {
    frontmatter: { "is-index": true, mode, ...extra },
    body: `<!-- chapter-trail:begin -->\n${inner}\n<!-- chapter-trail:end -->\n`,
  };
}
