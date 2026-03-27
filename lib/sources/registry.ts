import { genericJsonAdapter } from "./adapters/generic-json";
import type { SourceAdapter } from "./types";

const adapters: Record<string, SourceAdapter> = {
  [genericJsonAdapter.sourceType]: genericJsonAdapter,
};

export function registerSourceAdapter(adapter: SourceAdapter): void {
  adapters[adapter.sourceType] = adapter;
}

export function getSourceAdapter(sourceType: string): SourceAdapter {
  const adapter = adapters[sourceType];
  if (!adapter) {
    throw new Error(
      `Unknown source_type "${sourceType}". Register a SourceAdapter in lib/sources/registry.ts.`,
    );
  }
  return adapter;
}
