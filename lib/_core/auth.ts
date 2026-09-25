import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { SESSION_TOKEN_KEY, USER_INFO_KEY } from "@/constants/oauth";

export type User = { id: number; openId: string; name: string | null; email: string | null; loginMethod: string | null; lastSignedIn: Date };

export async function getSessionToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try { return await SecureStore.getItemAsync(SESSION_TOKEN_KEY); } catch { return null; }
}

export async function setSessionToken(token: string): Promise<void> {
  if (Platform.OS === "web") return;
  await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
}

export async function removeSessionToken(): Promise<void> {
  if (Platform.OS === "web") return;
  try { await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY); } catch { /* best effort */ }
}

export async function getUserInfo(): Promise<User | null> {
  try {
    const info = Platform.OS === "web" ? window.localStorage.getItem(USER_INFO_KEY) : await SecureStore.getItemAsync(USER_INFO_KEY);
    return info ? JSON.parse(info) as User : null;
  } catch { return null; }
}

export async function setUserInfo(user: User): Promise<void> {
  if (Platform.OS === "web") { window.localStorage.setItem(USER_INFO_KEY, JSON.stringify(user)); return; }
  await SecureStore.setItemAsync(USER_INFO_KEY, JSON.stringify(user));
}

export async function clearUserInfo(): Promise<void> {
  if (Platform.OS === "web") { window.localStorage.removeItem(USER_INFO_KEY); return; }
  try { await SecureStore.deleteItemAsync(USER_INFO_KEY); } catch { /* best effort */ }
}
