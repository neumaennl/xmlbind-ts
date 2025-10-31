/**
 * Casts a value to the specified type, handling primitives, enums, and custom types.
 *
 * Performs type coercion for String, Number, Boolean, and Date types.
 * For enum types (objects with enum values), attempts to match the value or key.
 * Returns the value unchanged for unrecognized types.
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
