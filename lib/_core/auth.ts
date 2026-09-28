import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { SESSION_TOKEN_KEY, USER_INFO_KEY } from "@/constants/oauth";

export type User = { id: number; openId: string; name: string | null; email: string | null; loginMethod: string | null; lastSignedIn: Date };

export type LocalProfile = {
  id: string;
  name: string;
  profileType: string;
  favoriteModels: string[];
  bio: string;
  imageUri: string | null;
  createdAt: string;
  updatedAt: string;
};

const LOCAL_PROFILE_KEY = "chatbro_local_profile";

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

export async function getLocalProfile(): Promise<LocalProfile | null> {
  try {
    const value = Platform.OS === "web"
      ? window.localStorage.getItem(LOCAL_PROFILE_KEY)
      : await SecureStore.getItemAsync(LOCAL_PROFILE_KEY);
    return value ? JSON.parse(value) as LocalProfile : null;
  } catch {
    return null;
  }
}

export async function saveLocalProfile(profile: LocalProfile): Promise<void> {
  const value = JSON.stringify(profile);
  if (Platform.OS === "web") {
    window.localStorage.setItem(LOCAL_PROFILE_KEY, value);
  } else {
    await SecureStore.setItemAsync(LOCAL_PROFILE_KEY, value);
  }
}

export async function clearLocalProfile(): Promise<void> {
  if (Platform.OS === "web") {
    window.localStorage.removeItem(LOCAL_PROFILE_KEY);
  } else {
    try { await SecureStore.deleteItemAsync(LOCAL_PROFILE_KEY); } catch { /* best effort */ }
  }
}
