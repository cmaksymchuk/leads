import { mortgageVerticalHandler } from "@/lib/verticals/mortgage/handler";
import type { VerticalHandler } from "@/lib/verticals/types";

// capture_mortgage_v1 is registered via mortgageVerticalHandler.sources
// Any new capture vertical must be added here AND to its handler's sources array

const HANDLERS: VerticalHandler[] = [mortgageVerticalHandler];

export function resolveVerticalHandler(
  source: string,
): VerticalHandler | undefined {
  return HANDLERS.find((h) => h.sources.includes(source));
}
