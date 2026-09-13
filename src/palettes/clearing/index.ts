import { PaletteRegistry } from "../registry";
import { clearingPalette } from "./definition";

export { clearingPalette } from "./definition";

export const createOfficialPaletteRegistry = (): PaletteRegistry => {
  const registry = new PaletteRegistry();
  registry.register(clearingPalette);
  return registry;
};
