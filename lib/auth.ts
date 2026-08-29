import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectToDatabase } from "./mongodb";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        console.log('[AUTHORIZE] Entered authorize()');
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials");
        }

        console.log('[AUTHORIZE] Connecting to MongoDB...');
        const client = await connectToDatabase();
        console.log('[AUTHORIZE] Connected to MongoDB. Querying user...');
        const usersCollection = client.db().collection('users');

        const query = { email: credentials.email };
        console.log(`[AUTHORIZE] Running query against 'users' collection:`, JSON.stringify(query));
        const user = await usersCollection.findOne(query);
        console.log('[AUTHORIZE] Query resolved. User found:', !!user);

        if (!user || !user.password) {
          throw new Error('No user found with this email');
        }

        console.log('[AUTHORIZE] Comparing password with bcrypt...');
        const isPasswordValid = bcrypt.compareSync(credentials.password, user.password);
        console.log('[AUTHORIZE] bcrypt.compareSync() resolved. isValid:', isPasswordValid);

        if (!isPasswordValid) {
          throw new Error('Invalid password');
        }

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
        };
      }
    })
  ],
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: '/auth/signin',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.id;
      }
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
};
