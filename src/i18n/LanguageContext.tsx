import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { LANGUAGE_KEY, loadLanguage, translate } from "./messages";
import type { Language } from "./messages";

const LanguageContext = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
} | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(loadLanguage);
  const t = useCallback(
    (key: string, values?: Record<string, string | number>) => translate(language, key, values),
    [language],
  );
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = language === "ja"
      ? "ピクスコ | Picture Score — 描くと、音が育つ。"
      : "Picture Score — Draw a line. Grow a sound.";
    try {
      localStorage.setItem(LANGUAGE_KEY, language);
    } catch {
      // The selector still works when browser storage is unavailable.
    }
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("LanguageProvider is missing");
  return value;
}

export function LanguageSwitch() {
  const { language, setLanguage } = useLanguage();
  return (
    <label className="language-switch">
      <span aria-hidden="true">文 / A</span>
      <select
        aria-label="Language / 言語"
        value={language}
        onChange={(event) => setLanguage(event.target.value as Language)}
      >
        <option value="ja" lang="ja">日本語</option>
        <option value="en" lang="en">English</option>
      </select>
    </label>
  );
}
