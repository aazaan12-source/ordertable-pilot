import { NextRequest, NextResponse } from "next/server";
import { clearSuperAdminSession } from "@/lib/super-admin-auth";

const authCookies = [
  "ordertable_super_admin"
];

export async function GET(request: NextRequest) {
  await clearSuperAdminSession();
  const response = NextResponse.redirect(new URL("/login", request.url));
  for (const name of authCookies) {
    response.cookies.set(name, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0
    });
    response.cookies.set(name, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/admin",
      maxAge: 0
    });
  }
  return response;
}
