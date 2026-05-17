export function appBaseUrl() {
  return (process.env.APP_URL || process.env.NEXTAUTH_URL || "https://ordertable-pilot.vercel.app").replace(/\/$/, "");
}
