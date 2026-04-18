import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  clearTokens, loadTokens, saveTokens,
  roleFromToken, cityFromToken, emailFromToken,
  type Role, type Tokens,
} from "@/lib/api";

type AuthState = {
  tokens: Tokens | null;
  role: Role | null;
  city: string | null;
  email: string | null;
  setTokens: (t: Tokens) => void;
  logout: () => void;
};

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokensState] = useState<Tokens | null>(() => loadTokens());

  const setTokens = (t: Tokens) => { saveTokens(t); setTokensState(t); };
  const logout = () => { clearTokens(); setTokensState(null); };

  const { role, city, email } = useMemo(() => {
    if (!tokens) return { role: null, city: null, email: null };
    const a = tokens.accessToken;
    return { role: roleFromToken(a), city: cityFromToken(a), email: emailFromToken(a) };
  }, [tokens]);

  return (
    <AuthCtx.Provider value={{ tokens, role, city, email, setTokens, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
