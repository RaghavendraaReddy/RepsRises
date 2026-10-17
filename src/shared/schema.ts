// A small JSON Schema subset, shared by request validation, response validation and the schemas
// sent to model providers. All object fields are required and no extra properties are allowed.
export type Schema = {
  type?: 'object' | 'array' | 'string' | 'integer' | 'number' | 'boolean' | 'null';
  properties?: Record<string, Schema>; required?: string[]; additionalProperties?: false;
  items?: Schema; anyOf?: Schema[]; enum?: (string | number | null)[];
  minLength?: number; maxLength?: number; maxItems?: number; minimum?: number; maximum?: number;
};
export const str = (maxLength = 240, minLength = 1): Schema => ({ type: 'string', minLength, maxLength });
export const int = (minimum: number, maximum: number): Schema => ({ type: 'integer', minimum, maximum });
export const list = (items: Schema, maxItems = 12): Schema => ({ type: 'array', items, maxItems });
export const nullable = (schema: Schema): Schema => ({ anyOf: [schema, { type: 'null' }] });
export const oneOf = (values: readonly string[]): Schema => ({ type: 'string', enum: [...values] });
export const obj = (properties: Record<string, Schema>): Schema => ({
  type: 'object', properties, required: Object.keys(properties), additionalProperties: false,
});

export function valid(schema: Schema, value: unknown): boolean {
  if (schema.anyOf) return schema.anyOf.some(s => valid(s, value));
  if (schema.enum && !schema.enum.includes(value as string)) return false;
  switch (schema.type) {
    case 'null': return value === null;
    case 'string': return typeof value === 'string' && value.length >= (schema.minLength ?? 0) && value.length <= (schema.maxLength ?? Infinity);
    case 'boolean': return typeof value === 'boolean';
    case 'integer':
    case 'number': return typeof value === 'number' && Number.isFinite(value) && (schema.type === 'number' || Number.isInteger(value)) &&
      value >= (schema.minimum ?? -Infinity) && value <= (schema.maximum ?? Infinity);
    case 'array': return Array.isArray(value) && value.length <= (schema.maxItems ?? Infinity) && value.every(v => valid(schema.items!, v));
    case 'object': {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
      const record = value as Record<string, unknown>;
      return Object.keys(record).every(k => Object.hasOwn(schema.properties!, k)) &&
        schema.required!.every(k => Object.hasOwn(record, k) && valid(schema.properties![k], record[k]));
    }
    default: return false;
  }
}

/**
 * The provider-facing copy of a schema. Some structured-output implementations reject numeric and
 * length constraints, so they are removed here and enforced server-side by `valid` instead.
 */
export function wireSchema(schema: Schema): Schema {
  const out: Schema = {};
  if (schema.type) out.type = schema.type;
  if (schema.enum) out.enum = schema.enum;
  if (schema.anyOf) out.anyOf = schema.anyOf.map(wireSchema);
  if (schema.items) out.items = wireSchema(schema.items);
  if (schema.properties) {
    out.properties = Object.fromEntries(Object.entries(schema.properties).map(([key, value]) => [key, wireSchema(value)]));
    out.required = schema.required;
    out.additionalProperties = false;
  }
  return out;
}
