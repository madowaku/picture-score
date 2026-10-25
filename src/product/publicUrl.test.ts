import { expect, it } from "vitest";
import { publicWebUrl } from "./publicUrl";
it("never puts local, placeholder, private or credentialed URLs in shared captions", () => {
  for (const value of [undefined, "", "http://127.0.0.1:5173/", "https://localhost/", "https://192.168.1.2/", "https://example.com/", "https://app.invalid/", "https://u:p@picture-score.jp/", "https://picture-score.jp/?token=secret", "https://picture-score.jp/#draft", "https://picture-score.jp/subpath"])
    expect(publicWebUrl(value)).toBe("");
  expect(publicWebUrl("https://picture-score.jp")).toBe("https://picture-score.jp/");
});
