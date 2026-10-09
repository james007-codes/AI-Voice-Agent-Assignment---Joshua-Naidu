import { z } from "zod";

/** zod → JSON Schema in the shape Gemini accepts (no `$schema` key). */
export function toModelJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  return json;
}
