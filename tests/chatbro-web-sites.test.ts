import { describe, expect, it } from "vitest";
import { aiWebSites } from "../shared/chatbro-web-sites";

describe("AI website directory", () => {
  it("puts the Chat Bro website first for the all-sites list", () => {
    expect(aiWebSites[0]).toMatchObject({ name: "Chat Bro", url: "https://chatbro-web.onrender.com" });
    expect(aiWebSites.every((site) => /^https:\/\//.test(site.url))).toBe(true);
  });
});
