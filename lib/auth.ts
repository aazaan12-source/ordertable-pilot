import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { clientIpFromHeaders, isLoginRateLimited, logActivity, recordLoginAttempt } from "@/lib/security";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24
  },
  jwt: {
    maxAge: 60 * 60 * 24 * 30
  },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials.password) return null;
        const email = credentials.email.toLowerCase().trim();
        const ipAddress = clientIpFromHeaders(req?.headers as any);
        if (await isLoginRateLimited(email, ipAddress)) {
          await recordLoginAttempt({ email, ipAddress, success: false });
          return null;
        }

        const user = await db.user.findUnique({ where: { email } });
        if (!user || !user.isActive || user.role !== UserRole.RESTAURANT_MANAGER) {
          await recordLoginAttempt({ email, ipAddress, success: false });
          return null;
        }
        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) {
          await recordLoginAttempt({ email, ipAddress, success: false });
          await logActivity({
            restaurantId: user.restaurantId,
            userId: user.id,
            action: "LOGIN_FAILED",
            description: "Failed login attempt",
            ipAddress
          });
          return null;
        }
        await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => undefined);
        await recordLoginAttempt({ email, ipAddress, success: true });
        await logActivity({
          restaurantId: user.restaurantId,
          userId: user.id,
          action: "LOGIN_SUCCESS",
          description: "User logged in",
          ipAddress
        });
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          restaurantId: user.restaurantId,
          isActive: user.isActive
        } as any;
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.email = (user as any).email;
        token.name = (user as any).name;
        token.role = (user as any).role;
        token.restaurantId = (user as any).restaurantId;
        token.isActive = (user as any).isActive;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id || token.sub;
        (session.user as any).email = token.email || session.user.email;
        (session.user as any).name = token.name || session.user.name;
        (session.user as any).role = token.role;
        (session.user as any).restaurantId = token.restaurantId;
        (session.user as any).isActive = token.isActive;
      }
      return session;
    }
  }
};
