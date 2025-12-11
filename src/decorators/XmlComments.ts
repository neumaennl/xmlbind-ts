import { ensureMeta } from "../metadata/MetadataRegistry";

/**
 * Decorator to mark a property as a container for XML comments.
 *
 * This property will capture all XML comments (<!-- ... -->) found within
 * an element during unmarshalling. The comments are stored in order and
 * re-inserted during marshalling to preserve them in roundtrips.
 *
 * The property should be typed as string[] and will contain the comment text
 * without the <!-- and --> delimiters.
 *
 * @returns A property decorator function
 *
 * @example
 * ```typescript
 * @XmlRoot('Document')
 * class Document {
 *   @XmlElement('Title')
 *   title?: string;
 *
 *   @XmlComments()
 *   comments?: string[];
 * }
 * 
 * // Unmarshalling this XML:
 * // <Document>
 * //   <!-- This is a comment -->
 * //   <Title>My Title</Title>
 * //   <!-- Another comment -->
 * // </Document>
 * //
 * // Results in: { title: 'My Title', comments: [' This is a comment ', ' Another comment '] }
 * ```
 */
export function XmlComments() {
  return function (contextOrTarget: any, propertyKeyOrContext?: string | symbol | any) {
    // Stage 3 decorators: contextOrTarget is undefined/value, propertyKeyOrContext is context object
    if (propertyKeyOrContext && typeof propertyKeyOrContext === "object" && "kind" in propertyKeyOrContext) {
      const context = propertyKeyOrContext;
      context.addInitializer(function(this: any) {
        const ctor = this.constructor;
        const m = ensureMeta(ctor);
        m.fields.push({
          key: context.name.toString(),
          name: "#comment",
          kind: "comments",
          isArray: true,
        } as any);
      });
      return;
    }
    
    // Legacy decorators: contextOrTarget is the target, propertyKeyOrContext is the property key
    if (typeof propertyKeyOrContext === "string" || typeof propertyKeyOrContext === "symbol") {
      const target = contextOrTarget as any;
      if (!target || !target.constructor) {
        return;
      }
      const ctor = target.constructor;
      const m = ensureMeta(ctor);
      m.fields.push({
        key: propertyKeyOrContext.toString(),
        name: "#comment",
        kind: "comments",
        isArray: true,
      } as any);
      return;
    }
    
    // Fallback for other decorator patterns
    return function (target: any, prop: string | symbol) {
      if (!target || !target.constructor) {
        return;
      }
      const ctor = target.constructor;
      const m = ensureMeta(ctor);
      m.fields.push({
        key: prop.toString(),
        name: "#comment",
        kind: "comments",
        isArray: true,
      } as any);
    };
  } as any;
}
