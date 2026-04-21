/** Pure helpers — safe to import from client components (no Pinecone client / env). */

export function getNamespace(siteId: string, liveVersion?: number) {
  if (liveVersion && liveVersion > 0) {
    // Namespace prefix should be the raw siteId.
    return `${siteId}-live-v${liveVersion}`;
  }
  return `${siteId}`;
}

export function resolvePineconeTarget(
  site: {
    id: string;
    liveVersion: number;
    pineconeIndex: string | null | undefined;
    pineconeNs: string | null | undefined;
    livePineconeNs?: string | null | undefined;
  },
  envFallbackIndex: string,
  envIndexHost?: string,
) {
  const idx = site.pineconeIndex?.trim();
  const ns = site.pineconeNs?.trim();
  const live = site.livePineconeNs?.trim();
  const indexName = idx || envFallbackIndex;
  const namespace = live || ns || getNamespace(site.id, site.liveVersion);
  return {
    indexName,
    namespace,
    // Host URLs are specific to an index. Use the env host when we are effectively
    // targeting the env index (even if the site redundantly overrides to same name).
    indexHostUrl:
      indexName === envFallbackIndex ? envIndexHost : undefined,
    indexSource: idx ? ("site" as const) : ("env" as const),
    namespaceSource: live
      ? ("live" as const)
      : ns
        ? ("override" as const)
        : ("derived" as const),
  };
}
