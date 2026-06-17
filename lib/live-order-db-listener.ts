import { Client } from "pg";

const liveOrderChannel = "ordertable_live_orders";

function pgSslForUrl(connectionString: string) {
  try {
    const url = new URL(connectionString);
    const hostname = url.hostname.toLowerCase();
    const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
    if (isLocal) return undefined;
    return { rejectUnauthorized: false };
  } catch {
    return undefined;
  }
}

export async function createLiveOrderDbListener(restaurantId: string, onChange: () => void) {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) return async () => {};

  const client = new Client({
    connectionString,
    ssl: pgSslForUrl(connectionString),
    application_name: "ordertable-live-orders"
  });

  client.on("notification", (message) => {
    if (message.channel !== liveOrderChannel) return;
    if (message.payload !== restaurantId) return;
    onChange();
  });

  client.on("error", (error) => {
    console.error("LIVE_ORDER_DB_LISTENER_ERROR", error);
  });

  await client.connect();
  await client.query(`LISTEN ${liveOrderChannel}`);

  return async () => {
    try {
      await client.query(`UNLISTEN ${liveOrderChannel}`);
    } catch {
      // Connection may already be closed.
    }
    await client.end().catch(() => {});
  };
}
