import type { Stroke } from "./types";
export type Example = "heart" | "wave" | "cat";
export function exampleStrokes(kind: Example): Stroke[] {
  const line = (points: number[][], suffix: string): Stroke => ({
    id: `example-${kind}-${suffix}-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2)}`,
    points: points.map(([x, y], i) => ({ x, y, pressure: 0.5, time: i * 15 })),
  });
  if (kind === "heart") {
    const points = Array.from({ length: 181 }, (_, i) => {
      const t = (i / 180) * Math.PI * 2;
      return [
        500 + 12 * 16 * Math.sin(t) ** 3,
        200 -
          11 *
            (13 * Math.cos(t) -
              5 * Math.cos(2 * t) -
              2 * Math.cos(3 * t) -
              Math.cos(4 * t)),
      ];
    });
    return [line(points, "outline")];
  }
  if (kind === "wave")
    return [
      line(
        Array.from({ length: 241 }, (_, i) => [
          100 + (i / 240) * 800,
          210 - Math.sin((i / 240) * Math.PI * 4) * (70 + (i / 240) * 35),
        ]),
        "outline",
      ),
    ];
  return [
    line(
      [
        [215, 275],
        [203, 248],
        [197, 204],
        [201, 166],
        [204, 98],
        [253, 142],
        [291, 135],
        [334, 146],
        [378, 96],
        [385, 184],
        [379, 229],
        [355, 260],
        [320, 276],
        [273, 286],
        [237, 281],
        [215, 275],
      ],
      "head",
    ),
    line(
      [
        [355, 260],
        [398, 235],
        [457, 219],
        [534, 218],
        [603, 230],
        [650, 258],
        [669, 300],
        [667, 340],
        [620, 340],
        [610, 291],
        [583, 297],
        [571, 340],
        [524, 340],
        [520, 300],
        [480, 300],
        [466, 340],
        [421, 340],
        [426, 292],
        [384, 288],
        [364, 313],
        [319, 313],
        [323, 278],
      ],
      "body",
    ),
    line(
      [
        [645, 254],
        [698, 244],
        [739, 211],
        [760, 169],
        [756, 134],
        [734, 119],
        [713, 128],
        [709, 150],
        [725, 164],
      ],
      "tail",
    ),
    line(
      [
        [239, 204],
        [247, 197],
        [256, 204],
      ],
      "eye-left",
    ),
    line(
      [
        [319, 204],
        [327, 197],
        [336, 204],
      ],
      "eye-right",
    ),
    line(
      [
        [278, 227],
        [288, 235],
        [298, 227],
      ],
      "nose",
    ),
    line(
      [
        [232, 233],
        [178, 221],
      ],
      "whisker-left",
    ),
    line(
      [
        [336, 233],
        [397, 220],
      ],
      "whisker-right",
    ),
  ];
}
