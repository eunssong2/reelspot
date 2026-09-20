import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { isDemo } from '@/lib/env';
import { DEMO_USER } from '@/lib/demoUser';
import { supabase } from '@/lib/supabase';

import { demoAuth } from './demoSession';

type AuthState = {
  session: Session | null;
  user: User | null;
  /** 최초 세션 복구가 끝나기 전에는 true — 라우팅 게이트에서 깜빡임을 막는다. */
  loading: boolean;
};

const AuthContext = createContext<AuthState | null>(null);

// 데모 모드에서만 쓰는 가짜 세션. 토큰은 어디에도 보내지 않는다.
const DEMO_SESSION = {
  access_token: 'demo',
  refresh_token: 'demo',
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: DEMO_USER.id, user_metadata: { name: DEMO_USER.nickname } },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemo) {
      setLoading(false);
      return demoAuth.subscribe((signedIn) => {
        setSession(signedIn ? (DEMO_SESSION as unknown as Session) : null);
      });
    }

    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({ session, user: session?.user ?? null, loading }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth 는 AuthProvider 안에서만 쓸 수 있습니다.');
  return ctx;
}
