/** Pure helpers — safe to import from client components (no Pinecone client / env). */

export function getNamespace(siteId: string, liveVersion?: number) {
  if (liveVersion && liveVersion > 0) {
    return `site-${siteId}-live-v${liveVersion}`;
  }
  return `site-${siteId}`;
}

export function resolvePineconeTarget(
  site: {
    id: string;
    liveVersion: number;
    pineconeIndex: string | null | undefined;
    pineconeNs: string | null | undefined;
  },
  envFallbackIndex: string,
  envIndexHost?: string,
) {
  const idx = site.pineconeIndex?.trim();
  const ns = site.pineconeNs?.trim();
  const indexName = idx || envFallbackIndex;
  const namespace = ns || getNamespace(site.id, site.liveVersion);
  return {
    indexName,
    namespace,
    // Host URLs are specific to an index. Use the env host when we are effectively
    // targeting the env index (even if the site redundantly overrides to same name).
    indexHostUrl:
      indexName === envFallbackIndex ? envIndexHost : undefined,
    indexSource: idx ? ("site" as const) : ("env" as const),
    namespaceSource: ns ? ("override" as const) : ("derived" as const),
  };
}
