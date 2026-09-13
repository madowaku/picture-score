import { describe, expect, it } from "vitest";
import { shareCopy } from "./share";

describe("shareCopy", () => {
  it("builds Japanese copy with the work title and brand", () => {
    expect(shareCopy("ja", "夜に咲いた線")).toEqual({
      title: "夜に咲いた線 | ピクスコ",
      text: "🎨 「夜に咲いた線」\n描いた線から、音が育ちました。\nピクスコ | Picture Score",
    });
  });

  it("builds English copy and falls back for a blank title", () => {
    expect(shareCopy("en", "   ")).toEqual({
      title: "Untitled Picture Score | Picture Score",
      text: "🎨 “Untitled Picture Score”\nI drew a line, and music grew from it.\nPicture Score",
    });
  });
});
