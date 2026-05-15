import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSuperAdminSession } from "@/lib/super-admin-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

async function loginSuperAdmin(formData: FormData) {
  "use server";
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const callbackUrl = String(formData.get("callbackUrl") || "/admin");
  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.role !== "PLATFORM_ADMIN" || !user.isActive) redirect("/super-admin-login?error=1");
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) redirect("/super-admin-login?error=1");
  await createSuperAdminSession(user.id);
  redirect(callbackUrl.startsWith("/admin") ? callbackUrl : "/admin");
}

export default async function SuperAdminLoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const { error, callbackUrl = "/admin" } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Super Admin Login</CardTitle>
          <p className="text-sm text-muted-foreground">Independent platform admin session for `/admin`.</p>
        </CardHeader>
        <CardContent>
          <form action={loginSuperAdmin} className="space-y-4">
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <Input name="email" type="email" placeholder="Email" defaultValue="admin@ordertable.pk" required />
            <PasswordInput name="password" placeholder="Password" defaultValue="Admin12345" required />
            {error ? <p className="text-sm text-destructive">Login failed. Check super admin credentials.</p> : null}
            <Button className="w-full" size="lg">Sign in as Super Admin</Button>
          </form>
          <div className="mt-5 rounded-md bg-muted p-3 text-xs text-muted-foreground">
            <p>Super admin: admin@ordertable.pk / Admin12345</p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
