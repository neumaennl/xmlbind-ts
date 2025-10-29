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

export function serializePrimitive(val: any, type?: any) {
  if (type === Date && val instanceof Date) return val.toISOString();
  if (typeof val === "boolean") return val ? "true" : "false";
  // Enum values are already strings, just convert to string
  return String(val);
}
