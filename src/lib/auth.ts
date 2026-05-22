import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        // Fetch roles from database
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { roles: true },
        });
        if (dbUser) {
          (session.user as unknown as Record<string, unknown>).roles = dbUser.roles;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
