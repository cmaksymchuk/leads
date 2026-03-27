/** Shallow + one-level deep merge for JSON-like metadata objects. */
export function mergeMetadata(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...a };
  for (const key of Object.keys(b)) {
    const vb = b[key];
    const va = out[key];
    if (
      vb !== null &&
      typeof vb === "object" &&
      !Array.isArray(vb) &&
      va !== null &&
      typeof va === "object" &&
      !Array.isArray(va)
    ) {
      out[key] = mergeMetadata(
        va as Record<string, unknown>,
        vb as Record<string, unknown>,
      );
    } else if (vb !== undefined) {
      out[key] = vb;
    }
  }
  return out;
}
