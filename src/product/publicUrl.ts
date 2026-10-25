/** Share only a configured public HTTPS origin, never a development address. */
export function publicWebUrl(candidate: string | undefined): string {
  try {
    const url = new URL(candidate?.trim() ?? "");
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.port || url.pathname !== "/" ||
        !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname) ||
        /(^|\.)(localhost|local|invalid|test|example|example\.com|example\.org|example\.net)$/i.test(url.hostname)) return "";
    return url.origin + "/";
  } catch { return ""; }
}
