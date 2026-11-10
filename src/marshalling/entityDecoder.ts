import { EntityDecoder, ENTITY_ACTION } from "@nodable/entities";
import { isUnsafe, HTML, XML } from "is-unsafe";

/**
 * The longest text, in characters, that the expansion of entities may add to
 * one document.
 */
const MAX_EXPANDED_LENGTH = 100000;

/**
 * Creates the entity decoder for the parser of `unmarshal()`.
 *
 * It decodes the five predefined XML entities, character references such as
 * `&#65;` and `&#x41;`, and the entities a DOCTYPE declares; all three are
 * defaults of `EntityDecoder`. HTML entities that XML does not define, such as
 * `&nbsp;`, stay as they are.
 *
 * A parser with its own decoder skips the setup of its default decoder, so
 * this function repeats the protection that `fast-xml-parser` sets up in
 * `OrderedObjParser`: the limit of the expanded length, applied to all
 * entities, and the check that ignores DOCTYPE entities whose value is unsafe
 * in HTML or XML. Compare both when `fast-xml-parser` is updated.
 *
 * @returns The entity decoder to pass as the option `entityDecoder`
 */
export function createEntityDecoder(): EntityDecoder {
  return new EntityDecoder({
    limit: {
      maxExpandedLength: MAX_EXPANDED_LENGTH,
      applyLimitsTo: "all",
    },
    onInputEntity: (_name, value) =>
      isUnsafe(value, [HTML, XML]) ? ENTITY_ACTION.BLOCK : ENTITY_ACTION.ALLOW,
  });
}
