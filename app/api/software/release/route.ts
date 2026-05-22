import { NextResponse } from "next/server";
import { getSoftwareReleasePayload } from "@/lib/software-licensing";

export const dynamic = "force-dynamic";

export async function GET() {
  const release = await getSoftwareReleasePayload();
  return NextResponse.json(release, { headers: { "Cache-Control": "no-store" } });
}

