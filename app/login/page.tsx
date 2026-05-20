"use client";

import { Suspense, useEffect, useState } from "react";
import { getSession, signIn } from "next-auth/react";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSession().then((session) => {
      if (cancelled || !session?.user) return;
      const callbackUrl = search.get("callbackUrl");
      if (session.user.role === "PLATFORM_ADMIN") {
        router.replace(callbackUrl?.startsWith("/admin") ? callbackUrl : "/admin");
      } else {
        router.replace(callbackUrl || "/dashboard");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [router, search]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (result?.error) {
      setError("Invalid email or password.");
      return;
    }
    const session = await getSession();
    const callbackUrl = search.get("callbackUrl");
    if (session?.user?.role === "PLATFORM_ADMIN") {
      router.push(callbackUrl?.startsWith("/admin") ? callbackUrl : "/admin");
    } else {
      router.push(callbackUrl || "/dashboard");
    }
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>OrderTable Login</CardTitle>
          <p className="text-sm text-muted-foreground">Sign in to continue to your OrderTable workspace.</p>
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
          <p className="mt-5 rounded-md bg-muted p-3 text-xs text-muted-foreground">
            Use the login details provided for your restaurant or platform account.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
