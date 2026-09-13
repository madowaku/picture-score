import type { Language } from "../i18n/messages";
import { download, pictureFile } from "../music/export";
import { loadProject } from "../music/project";
import { createVisualNotes } from "../music/score";

type RuntimeEnv = Record<string, string | undefined>;

type ShareResult =
  | "shared"
  | "copied-and-downloaded"
  | "downloaded"
  | "cancelled";

function runtimeEnv(): RuntimeEnv {
  return ((import.meta as ImportMeta & { env?: RuntimeEnv }).env ?? {});
}

export function publicAppUrl(): string {
  const configured = runtimeEnv().VITE_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return `${window.location.origin}${window.location.pathname}`.replace(/\/+$/, "");
}

export function plusCheckoutUrl(): string {
  return runtimeEnv().VITE_STRIPE_CHECKOUT_URL?.trim() ?? "";
}

export function plusPurchaseEnabled(): boolean {
  return runtimeEnv().VITE_PLUS_PURCHASE_ENABLED?.trim().toLowerCase() === "true";
}

export function shareCopy(language: Language, title: string) {
  const cleanTitle = title.trim() || (language === "ja" ? "無題のピクスコ" : "Untitled Picture Score");
  return language === "ja"
    ? {
        title: `${cleanTitle} | ピクスコ`,
        text: `🎨 「${cleanTitle}」\n描いた線から、音が育ちました。\nピクスコ | Picture Score`,
      }
    : {
        title: `${cleanTitle} | Picture Score`,
        text: `🎨 “${cleanTitle}”\nI drew a line, and music grew from it.\nPicture Score`,
      };
}

function shareFilename(title: string) {
  const clean = title
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
    .trim()
    .slice(0, 80);
  return `${clean || "picture-score"}-pixusco.png`;
}

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export async function shareCurrentProject(language: Language): Promise<ShareResult> {
  const project = loadProject();
  if (!project.strokes.length) throw new Error("empty-project");

  const notes = createVisualNotes(project.strokes, project.magnet);
  const image = await pictureFile(project, notes, language);
  const file = new File([image], shareFilename(project.title), { type: "image/png" });
  const copy = shareCopy(language, project.title);
  const url = publicAppUrl();

  if (typeof navigator.share === "function") {
    const supportsFiles = typeof navigator.canShare !== "function" || navigator.canShare({ files: [file] });
    if (supportsFiles) {
      try {
        await navigator.share({ ...copy, url, files: [file] });
        return "shared";
      } catch (error) {
        if (isAbort(error)) return "cancelled";
      }
    }

    try {
      await navigator.share({ ...copy, url });
      return "shared";
    } catch (error) {
      if (isAbort(error)) return "cancelled";
    }
  }

  const caption = `${copy.text}\n${url}`;
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(caption);
      download(image, `${project.title}-pixusco`, "png");
      return "copied-and-downloaded";
    } catch {
      // Fall through to a plain image download when clipboard access is blocked.
    }
  }

  download(image, `${project.title}-pixusco`, "png");
  return "downloaded";
}
