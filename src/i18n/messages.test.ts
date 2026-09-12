import { afterEach, describe, expect, it, vi } from "vitest";
import { LANGUAGE_KEY, loadLanguage, messages, translate } from "./messages";

afterEach(() => vi.unstubAllGlobals());

describe("language messages", () => {
  it("has nonempty Japanese and English copy with matching placeholders", () => {
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
    for (const [key, message] of Object.entries(messages)) {
      expect(message.ja.trim(), key).not.toBe("");
      expect(message.en.trim(), key).not.toBe("");
      expect(placeholders(message.ja), key).toEqual(placeholders(message.en));
      expect(message.en, key).not.toMatch(/[ぁ-んァ-ン一-龯]/u);
    }
  });

  it("interpolates names and values without translating user content", () => {
    const name = "私の波 / My wave";
    expect(translate("en", "{title} — {role}。矢印キーで移動", { title: name, role: translate("en", "うた") }))
      .toBe(name + " — Melody. Use arrow keys to move");
    expect(translate("en", "{format}を書き出しました。", { format: "PNG" })).toBe("Exported PNG.");
    expect(translate("ja", "{format}を書き出しました。", { format: "PNG" })).toBe("PNGを書き出しました。");
    expect(translate("en", "Unknown message")).toBe("Unknown message");
  });

  it("restores an English preference", () => {
    const getItem = vi.fn().mockReturnValue("en");
    vi.stubGlobal("localStorage", { getItem });
    expect(loadLanguage()).toBe("en");
    expect(getItem).toHaveBeenCalledWith(LANGUAGE_KEY);
  });

  it.each([null, "ja", "fr", "{broken"] )("defaults safely for stored %s", (value) => {
    vi.stubGlobal("localStorage", { getItem: () => value });
    expect(loadLanguage()).toBe("ja");
  });

  it("works when browser storage is blocked", () => {
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("Blocked"); } });
    expect(loadLanguage()).toBe("ja");
  });
});
