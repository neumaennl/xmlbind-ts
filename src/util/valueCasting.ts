export function castValue(val: any, type?: any) {
  if (val === null || val === undefined) return val;
  if (!type) return val;
  if (type === String) return String(val);
  if (type === Number) return Number(val);
  if (type === Boolean) return val === "true" || val === true;
  if (type === Date) return new Date(val);
  return val;
}

export function serializePrimitive(val: any, type?: any) {
  if (type === Date && val instanceof Date) return val.toISOString();
  if (typeof val === "boolean") return val ? "true" : "false";
  return String(val);
}
