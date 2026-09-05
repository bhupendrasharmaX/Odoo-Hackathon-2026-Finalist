import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import api, { TOKEN_KEY, USER_KEY } from '../api';
import type { AuthUser, MeResult, Role } from '../types';

interface AuthState {
  user: AuthUser | null;
  profile: MeResult | null;
  role: Role | undefined;
  /** True until the stored token has been re-checked against /auth/me. */
  booting: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    // A corrupted entry must not brick the app on boot.
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readStoredUser);
  const [profile, setProfile] = useState<MeResult | null>(null);
  const [booting, setBooting] = useState(Boolean(localStorage.getItem(TOKEN_KEY)));

  const logout = useCallback(() => {
    setUser(null);
    setProfile(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.auth.login(email, password);
    localStorage.setItem(TOKEN_KEY, result.token);
    localStorage.setItem(USER_KEY, JSON.stringify(result.user));
    setUser(result.user);
    // Non-blocking: the session is already usable without the profile.
    api.auth.me().then(setProfile).catch(() => undefined);
    return result.user;
  }, []);

  /**
   * Re-read the session from /auth/me on boot rather than trusting what is in
   * localStorage. An admin can change someone's role mid-session, and this is
   * how the UI notices; a dead token drops us back to the login screen.
   */
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setBooting(false);
      return;
    }

    let cancelled = false;

    api.auth
      .me()
      .then((me) => {
        if (cancelled) return;
        const fresh: AuthUser = {
          id: me.id,
          email: me.email,
          name: me.name,
          role: me.role,
          employeeId: me.employeeId,
        };
        setProfile(me);
        setUser(fresh);
        localStorage.setItem(USER_KEY, JSON.stringify(fresh));
      })
      .catch(() => {
        if (!cancelled) logout();
      })
      .finally(() => {
        if (!cancelled) setBooting(false);
      });

    return () => {
      cancelled = true;
    };
  }, [logout]);

  // Signing out in one tab signs out the others.
  useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (event.key === TOKEN_KEY && !event.newValue) {
        setUser(null);
        setProfile(null);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      profile,
      role: user?.role,
      booting,
      login,
      logout,
      isAuthenticated: Boolean(user),
    }),
    [user, profile, booting, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
