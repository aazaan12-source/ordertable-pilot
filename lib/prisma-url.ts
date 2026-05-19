const DEFAULT_CONNECTION_LIMIT = "5";
const DEFAULT_POOL_TIMEOUT = "30";

export function pooledPrismaUrl(rawUrl = process.env.DATABASE_URL) {
  if (!rawUrl) return rawUrl;

  try {
    const url = new URL(rawUrl);
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", process.env.PRISMA_CONNECTION_LIMIT || DEFAULT_CONNECTION_LIMIT);
    }
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", process.env.PRISMA_POOL_TIMEOUT || DEFAULT_POOL_TIMEOUT);
    }
    if (url.hostname.includes("pooler.supabase.com") && !url.searchParams.has("pgbouncer")) {
      url.searchParams.set("pgbouncer", "true");
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}
