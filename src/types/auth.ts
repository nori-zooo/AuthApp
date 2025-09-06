import { User, Session } from '@supabase/supabase-js';

export interface AuthUser extends User {}

export interface AuthSession extends Session {}

export interface AuthContextType {
  user: AuthUser | null;
  session: AuthSession | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export interface AuthError {
  message: string;
  code?: string;
}