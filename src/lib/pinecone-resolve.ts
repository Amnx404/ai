/** Pure helpers — safe to import from client components (no Pinecone client / env). */

export function resolvePineconeTarget(
  site: {
    id: string;
    livePineconeNs?: string | null | undefined;
  },
  envFallbackIndex: string,
  envIndexHost?: string,
) {
  const live = site.livePineconeNs?.trim();
  const indexName = envFallbackIndex;
  const namespace = live || site.id;
  return {
    indexName,
    namespace,
    // Host URLs are specific to an index. Use the env host when we are effectively
    // targeting the env index (even if the site redundantly overrides to same name).
    indexHostUrl:
      indexName === envFallbackIndex ? envIndexHost : undefined,
    indexSource: "env" as const,
    namespaceSource: live ? ("live" as const) : ("derived" as const),
  };
}
