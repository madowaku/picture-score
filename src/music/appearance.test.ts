import { describe, expect, it } from "vitest";
import { emptyProject, parseProject } from "./project";
import { exampleStrokes } from "./examples";
import { projectMusic } from "./arrangement";
import { parseArtwork } from "../library/store";
import { strokeColor, strokeInk, strokeWidth } from "../wonder/palette";

const original = { ...emptyProject(), strokes: exampleStrokes("cat") };
describe("stroke appearance compatibility", () => {
  it("keeps old project files readable and their automatic colors available", () => {
    const loaded = parseProject(JSON.parse(JSON.stringify(original)));
    expect(loaded).toEqual(original);
    loaded.strokes.forEach((stroke, index) => {
      expect(strokeInk(stroke, index)).toBe(strokeColor(index));
      expect(strokeWidth(stroke, 2.8)).toBe(2.8);
    });
  });
  it("round-trips chosen color and width without changing music or points", () => {
    const colored = { ...original, strokes: original.strokes.map(stroke => ({ ...stroke, color: "#2584ac", width: 5 })) };
    const loaded = parseArtwork(JSON.parse(JSON.stringify({ id: "colored", project: colored, createdAt: 1, updatedAt: 2 }))).project;
    expect(loaded).toEqual(colored);
    expect(projectMusic(loaded)).toEqual(projectMusic(original));
    expect(strokeInk(loaded.strokes[0], 4)).toBe("#2584ac");
    expect(strokeWidth(loaded.strokes[0])).toBe(5);
  });
  it.each(["url(https://example.test)", "red", "#ffff", {}, 123, null])("rejects unsafe or malformed imported ink %j", color => {
    expect(() => parseProject({ ...original, strokes: [{ ...original.strokes[0], color }] })).toThrow();
  });
  it.each([0, -1, 9, Infinity, NaN, "5", null])("rejects invalid imported width %j", width => {
    expect(() => parseProject({ ...original, strokes: [{ ...original.strokes[0], width }] })).toThrow();
  });
});
