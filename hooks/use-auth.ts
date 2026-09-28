import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

type UseAuthOptions = { autoFetch?: boolean };

export function useAuth(options?: UseAuthOptions) {
  const { autoFetch = true } = options ?? {};
  const [user, setUser] = useState<Auth.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUser = useCallback(async () => {
    let cached: Auth.User | null = null;
    try {
      setLoading(true);
      setError(null);
      if (Platform.OS === "web") {
        const apiUser = await Api.getMe();
        if (apiUser) {
          const userInfo: Auth.User = {
            id: apiUser.id,
            openId: apiUser.openId,
            name: apiUser.name,
            email: apiUser.email,
            loginMethod: apiUser.loginMethod,
            lastSignedIn: new Date(apiUser.lastSignedIn),
          };
          setUser(userInfo);
          await Auth.setUserInfo(userInfo);
        } else {
          setUser(null);
          await Auth.clearUserInfo();
        }
        return;
      }
      const sessionToken = await Auth.getSessionToken();
      if (!sessionToken) {
        setUser(null);
        return;
      }
      // Hydrate the last verified profile before contacting the API. This keeps
      // the native app signed in while a sleeping/unreachable backend wakes up.
      // The session is only removed below when the API explicitly returns 401/403.
      cached = await Auth.getUserInfo();
      if (cached) {
        setUser({ ...cached, lastSignedIn: new Date(cached.lastSignedIn) });
      }
      // On Android, SecureStore may keep the token while the cached profile is
      // missing or stale. Validate the token against the real API before
      // deciding that the user is signed out.
      const apiUser = await Api.getMe();
      if (apiUser) {
        const userInfo: Auth.User = {
          id: apiUser.id,
          openId: apiUser.openId,
          name: apiUser.name,
          email: apiUser.email,
          loginMethod: apiUser.loginMethod,
          lastSignedIn: new Date(apiUser.lastSignedIn),
        };
        setUser(userInfo);
        await Auth.setUserInfo(userInfo);
      } else {
        await Auth.removeSessionToken();
        await Auth.clearUserInfo();
        setUser(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error("تعذر الاتصال بخادم المصادقة"));
      // Keep a previously verified profile visible during a temporary outage.
      // Do not destroy a valid local session merely because the network blinked.
      if (cached) setUser({ ...cached, lastSignedIn: new Date(cached.lastSignedIn) });
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await Api.logout();
    } finally {
      await Auth.removeSessionToken();
      await Auth.clearUserInfo();
      setUser(null);
      setError(null);
    }
  }, []);

  useEffect(() => {
    if (!autoFetch) {
      setLoading(false);
      return;
    }
    void fetchUser();
  }, [autoFetch, fetchUser]);

  return {
    user,
    loading,
    error,
    isAuthenticated: useMemo(() => Boolean(user), [user]),
    refresh: fetchUser,
    logout,
  };
}
