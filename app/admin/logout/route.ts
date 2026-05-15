import { redirect } from "next/navigation";
import { clearSuperAdminSession } from "@/lib/super-admin-auth";

export async function GET() {
  await clearSuperAdminSession();
  redirect("/super-admin-login");
}
