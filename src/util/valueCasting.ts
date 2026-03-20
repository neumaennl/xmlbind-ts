/**
 * Casts a value to the specified type, handling primitives, enums, and custom types.
 *
 * Performs type coercion for String, Number, Boolean, and Date types.
 * When the type is Object (emitted by TypeScript for union types such as
 * `number | "unbounded"`), numeric-looking strings are coerced to numbers so
 * that e.g. `maxOccurs="2"` deserialises as `2` while `maxOccurs="unbounded"`
 * remains the string `"unbounded"`.
 * For enum types (objects with enum values), attempts to match the value or key.
 * Returns the value unchanged for unrecognised types.
 *
 * @param val - The value to cast (can be any type)
 * @param type - The target type constructor or enum object (optional)
 * @returns The casted value, or the original value if no casting is needed
 */
export function castValue(val: any, type?: any) {
  if (val === null || val === undefined) return val;
  if (!type) return val;
  if (type === String) return String(val);
  if (type === Number) return Number(val);
  if (type === Boolean) return val === "true" || val === true;
  if (type === Date) return new Date(val);
  // TypeScript emits Object as the design:type for union types (e.g. number | "unbounded").
  // Apply natural coercion: numeric-looking strings become numbers, everything else stays as-is.
  if (type === Object && typeof val === "string") {
    const trimmed = val.trim();
    if (trimmed !== "") {
      const num = Number(trimmed);
      if (!Number.isNaN(num)) return num;
    }
  }
  // Handle enum types - check if type is an object with enum values
  if (typeof type === "object" && !Array.isArray(type)) {
    // It's likely an enum, return the value if it exists in the enum
    const enumValues = Object.values(type);
    if (enumValues.includes(val)) {
      return val;
    }
    // If val is a key, return the corresponding value
    if (val in type) {
      return type[val];
    }
  }
  return val;
}

/**
 * Serializes a primitive value to its XML string representation.
 *
 * Handles special formatting for Date (ISO string) and Boolean (lowercase string).
 * For other types including enums, converts to string.
 *
 * @param val - The value to serialize
 * @param type - The type constructor (optional, used for Date detection)
 * @returns The serialized string representation
 */
export function serializePrimitive(val: any, type?: any) {
  if (type === Date && val instanceof Date) return val.toISOString();
  if (typeof val === "boolean") return val ? "true" : "false";
  // Enum values are already strings, just convert to string
  return String(val);
}
