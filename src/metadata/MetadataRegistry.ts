import { ClassMeta, Constructor, FieldMeta } from "../types.js";

const GLOBAL_META_KEY = Symbol.for("@neumaennl/xmlbind-ts/META");
const META: WeakMap<Constructor, ClassMeta> =
  (globalThis as any)[GLOBAL_META_KEY] ||
  ((globalThis as any)[GLOBAL_META_KEY] = new WeakMap<Constructor, ClassMeta>());

// TypeScript passes `context.metadata` to Stage 3 decorators only when
// `Symbol.metadata` exists, and JavaScript engines do not provide it yet.
// This module is loaded before any decorated class is defined.
(Symbol as { metadata?: symbol }).metadata ??= Symbol.for("Symbol.metadata");

const STAGE3_FIELDS_KEY = Symbol.for("@neumaennl/xmlbind-ts/fields");

/**
 * The parts of a Stage 3 class field decorator context used by this library.
 *
 * Internal: not exported from the package entry point.
 */
export interface Stage3FieldContext {
  name: string | symbol;
  metadata?: object | null;
  addInitializer(initializer: (this: any) => void): void;
}

/**
 * Returns the field list that Stage 3 decorators stored on a class's own
 * decorator metadata object, optionally creating it.
 */
function stage3Fields(
  metadata: object | null | undefined,
  create: boolean
): FieldMeta[] | undefined {
  if (metadata === null || typeof metadata !== "object") return undefined;
  if (Object.hasOwn(metadata, STAGE3_FIELDS_KEY)) {
    return (metadata as Record<symbol, FieldMeta[]>)[STAGE3_FIELDS_KEY];
  }
  if (!create) return undefined;
  const fields: FieldMeta[] = [];
  Object.defineProperty(metadata, STAGE3_FIELDS_KEY, { value: fields });
  return fields;
}

/**
 * Returns the decorator metadata object (`ctor[Symbol.metadata]`) that a
 * Stage 3 decorated class defines itself, ignoring the inherited one.
 */
function ownDecoratorMetadata(ctor: Constructor): object | undefined {
  const key = (Symbol as { metadata?: symbol }).metadata;
  if (key === undefined || !Object.hasOwn(ctor, key)) return undefined;
  return (ctor as unknown as Record<symbol, object>)[key];
}

/**
 * Makes the class metadata use the field list that Stage 3 field decorators
 * stored on the class's decorator metadata object.
 */
function linkStage3Fields(m: ClassMeta, metadata: object | undefined): void {
  const fields = stage3Fields(metadata, false);
  if (!fields || fields === m.fields) return;
  for (const f of m.fields) {
    if (!fields.includes(f)) fields.push(f);
  }
  m.fields = fields;
}

/**
 * Returns the metadata of a class, creating it if necessary, and links the
 * field list that Stage 3 field decorators stored on `decoratorMetadata`.
 */
function getOrCreateMeta(
  ctor: Constructor,
  decoratorMetadata: object | undefined
): ClassMeta {
  let m = META.get(ctor);
  if (!m) {
    m = { ctor, fields: [] };
    META.set(ctor, m);
  }
  linkStage3Fields(m, decoratorMetadata);
  return m;
}

/**
 * Ensures that metadata exists for a class constructor, creating it if necessary.
 * This is called by decorators to initialize or retrieve metadata for a class.
 *
 * @param ctor - The class constructor
 * @returns The class metadata, either existing or newly created
 */
export function ensureMeta(ctor: Constructor): ClassMeta {
  return getOrCreateMeta(ctor, ownDecoratorMetadata(ctor));
}

/**
 * Like {@link ensureMeta}, for a Stage 3 class decorator. TypeScript defines
 * `ctor[Symbol.metadata]` only after the class decorators have run, so the
 * decorator passes `context.metadata` instead.
 *
 * Internal: not exported from the package entry point.
 *
 * @param ctor - The class constructor
 * @param decoratorMetadata - `context.metadata` of the class decorator
 * @returns The class metadata, either existing or newly created
 */
export function ensureStage3ClassMeta(
  ctor: Constructor,
  decoratorMetadata: object | null | undefined
): ClassMeta {
  return getOrCreateMeta(ctor, decoratorMetadata ?? ownDecoratorMetadata(ctor));
}

/**
 * Retrieves metadata for a class constructor if it exists.
 *
 * @param ctor - The class constructor
 * @returns The class metadata, or undefined if no metadata has been registered
 */
export function getMeta(ctor: Constructor): ClassMeta | undefined {
  if (typeof ctor !== "function") return undefined;
  const decoratorMetadata = ownDecoratorMetadata(ctor);
  if (META.has(ctor) || stage3Fields(decoratorMetadata, false)) {
    return getOrCreateMeta(ctor, decoratorMetadata);
  }
  return undefined;
}

/**
 * Registers field metadata from a Stage 3 field decorator.
 *
 * With `context.metadata` (TypeScript 5.2+), `register` runs once, while the
 * class is defined. Without it, `register` runs when the first instance of
 * each constructor is created, through `context.addInitializer`.
 *
 * Internal: not exported from the package entry point.
 *
 * @param context - The Stage 3 decorator context
 * @param register - Adds or updates entries in the field list of the class
 */
export function registerStage3Field(
  context: Stage3FieldContext,
  register: (fields: FieldMeta[]) => void
): void {
  const fields = stage3Fields(context.metadata, true);
  if (fields) {
    register(fields);
    return;
  }
  const registered = new WeakSet<object>();
  context.addInitializer(function (this: any) {
    const ctor = this.constructor;
    if (registered.has(ctor)) return;
    registered.add(ctor);
    register(ensureMeta(ctor).fields);
  });
}

/**
 * Returns all registered class metadata.
 * Note: WeakMap isn't directly iterable, so this returns an empty array.
 * This function is kept for API compatibility but has limited functionality.
 *
 * @returns An array of all ClassMeta entries (currently always empty)
 */
export function allMeta(): ClassMeta[] {
  const arr: ClassMeta[] = [];
  // WeakMap isn't easily iterable; keep API minimal.
  return arr;
}

export { META };

/**
 * Collects all field metadata for a class, including inherited fields from base classes.
 * Traverses the prototype chain and merges fields, with derived class fields
 * overriding base class fields that have the same key.
 *
 * @param ctor - The class constructor
 * @returns An array of all field metadata entries for the class and its ancestors
 */
export function getAllFields(ctor: Constructor): FieldMeta[] {
  const ctors: Constructor[] = [];
  // Walk prototype chain to Object
  let current: any = ctor;
  while (current && current.prototype) {
    ctors.push(current);
    const proto = Object.getPrototypeOf(current.prototype);
    if (!proto || !proto.constructor || proto.constructor === Object) break;
    current = proto.constructor;
  }

  // Iterate base -> derived so derived overrides win
  const ordered = ctors.reverse();
  const byKey = new Map<string, FieldMeta>();
  for (const c of ordered) {
    const m = getMeta(c);
    if (!m) continue;
    for (const f of m.fields) {
      byKey.set(f.key, f);
    }
  }
  return Array.from(byKey.values());
}
