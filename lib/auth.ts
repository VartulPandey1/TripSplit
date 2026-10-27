import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db/mongoose';
import User from '@/lib/db/models/User';

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) return null;

          const email = String(credentials.email).trim().toLowerCase();
          const password = String(credentials.password);

          await connectDB();
          const user = await User.findOne({ email });
          if (!user || !user.passwordHash) return null;

          const isValid = await bcrypt.compare(password, user.passwordHash);
          if (!isValid) return null;

          return {
            id: user._id.toString(),
            name: user.username,
            email: user.email,
            image: user.avatarId || 'avatar-fox.svg',
          };
        } catch (error) {
          console.error('Authorize error:', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.image = user.image;
      }
      return token;
    },
    async session({ session, token }) {
      const targetId = (token?.id as string) || (token?.sub as string);
      if (targetId) {
        try {
          await connectDB();
          const user = await User.findById(targetId).select('_id username email avatarId').lean();
          if (!user) {
            // User was removed from the database: invalidate stale session
            return null as any;
          }
          session.user.id = user._id.toString();
          session.user.name = user.username;
          session.user.email = user.email;
          session.user.image = (user as any).avatarId || 'avatar-fox.svg';
        } catch {
          return null as any;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt' },
});
