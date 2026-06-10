export type OriginGateResult =
  | { ok: true; corsOrigin: string }
  | { ok: false; status: 400 | 403; error: string; corsOrigin: string };

export function normalizeAllowedDomain(value: string): string | null {
  const raw = value.trim().toLowerCase();
  if (!raw) return null;

  if (raw.startsWith("*.")) {
    const wildcardHost = raw.slice(2).split("/")[0]?.trim();
    return wildcardHost && wildcardHost.includes(".") ? `*.${wildcardHost}` : null;
  }

  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!parsed.hostname) return null;
    return parsed.host;
  } catch {
    const host = raw.replace(/^https?:\/\//i, "").split("/")[0]?.trim();
    return host && (host.includes(".") || host.startsWith("localhost")) ? host : null;
  }
}

export function normalizeAllowedDomains(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeAllowedDomain(value))
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

const LOCAL_DEVELOPMENT_HOST_RE =
  /^(localhost(:\d+)?|127\.0\.0\.1(:\d+)?|\[::1\](:\d+)?)$/i;

export function isLocalDevelopmentHost(value: string) {
  return LOCAL_DEVELOPMENT_HOST_RE.test(value.trim());
}

export function getUserFacingAllowedDomains(
  values: string[],
  appOriginOrHost?: string | null,
) {
  const appHost = appOriginOrHost
    ? (normalizeAllowedDomain(appOriginOrHost) ?? appOriginOrHost.trim().toLowerCase())
    : "";

  return normalizeAllowedDomains(values).filter((domain) => {
    const normalized = domain.toLowerCase();
    if (isLocalDevelopmentHost(normalized)) return false;
    return !appHost || normalized !== appHost;
  });
}

export function splitDomainInput(value: string) {
  return value
    .split(/[,\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function hostnameFromHost(host: string) {
  return host.replace(/:\d+$/, "");
}

export function originMatchesAllowedDomains(origin: string, allowedDomains: string[]) {
  const originHost = normalizeAllowedDomain(origin);
  if (!originHost) return false;
  const originHostname = hostnameFromHost(originHost);

  return normalizeAllowedDomains(allowedDomains).some((allowed) => {
    const wildcard = allowed.startsWith("*.");
    const allowedHost = wildcard ? allowed.slice(2) : allowed;
    const allowedHostname = hostnameFromHost(allowedHost);

    if (wildcard) return originHostname.endsWith(`.${allowedHostname}`);
    if (originHost === allowedHost) return true;
    if (originHostname === allowedHostname) return true;
    return !allowedHost.includes(":") && originHostname.endsWith(`.${allowedHostname}`);
  });
}

export function checkOriginAllowed(
  origin: string,
  allowedDomains: string[],
  opts: { allowOpaqueOrigin?: boolean } = {},
): OriginGateResult {
  const corsOrigin = origin && origin !== "null" ? origin : "*";
  const normalizedAllowed = normalizeAllowedDomains(allowedDomains);
  if (normalizedAllowed.length === 0) return { ok: true, corsOrigin };

  const opaqueOrigin = origin === "" || origin === "null";
  if (opaqueOrigin) {
    if (opts.allowOpaqueOrigin) return { ok: true, corsOrigin };
    return {
      ok: false,
      status: 400,
      error: "Origin header required for this site",
      corsOrigin,
    };
  }

  if (!normalizeAllowedDomain(origin)) {
    return { ok: false, status: 400, error: "Invalid Origin", corsOrigin };
  }

  if (!originMatchesAllowedDomains(origin, normalizedAllowed)) {
    return { ok: false, status: 403, error: "Domain not allowed", corsOrigin };
  }

  return { ok: true, corsOrigin };
}
