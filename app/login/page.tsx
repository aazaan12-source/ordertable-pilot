"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginShell />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginShell() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>OrderTable Login</CardTitle>
          <p className="text-sm text-muted-foreground">Loading sign in...</p>
        </CardHeader>
      </Card>
    </main>
  );
}

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const demo = search.get("demo");
  const defaultEmail = demo === "manager" ? "manager@demo.com" : "";
  const defaultPassword = demo === "manager" ? "Manager12345" : "";
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState(defaultPassword);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (result?.error) {
      setError("Login failed. Check your email and password.");
      return;
    }
    router.push(search.get("callbackUrl") || "/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>OrderTable Login</CardTitle>
          <p className="text-sm text-muted-foreground">Sign in as restaurant manager. Super admin uses a separate login.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <PasswordInput placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button className="w-full" size="lg" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
          <div className="mt-5 rounded-md bg-muted p-3 text-xs text-muted-foreground">
            <p>Manager: manager@demo.com / Manager12345</p>
            <p>Super admin: /super-admin-login</p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
