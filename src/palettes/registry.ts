import { validatePaletteDefinition } from "./schema";
import type { PaletteDefinition } from "./types";

export class PaletteRegistry {
  private readonly definitions = new Map<string, PaletteDefinition>();

  register(definition: PaletteDefinition): PaletteDefinition {
    validatePaletteDefinition(definition);
    if (this.definitions.has(definition.id))
      throw new Error(`palette already registered: ${definition.id}`);
    this.definitions.set(definition.id, definition);
    return definition;
  }

  get(id: string): PaletteDefinition {
    const definition = this.definitions.get(id);
    if (!definition) throw new Error(`palette not registered: ${id}`);
    return definition;
  }

  has(id: string): boolean {
    return this.definitions.has(id);
  }

  list(): PaletteDefinition[] {
    return [...this.definitions.values()].sort((a, b) =>
      a.id.localeCompare(b.id),
    );
  }
}
