// @effect-diagnostics globalConsole:off
// Hermes 0.81 ships no TextDecoder/TextEncoder. The fast-text-encoding
// polyfill provides both but rejects the `fatal` option, which some library
// code requests; non-fatal utf-8 decoding is acceptable for those call sites.
import "fast-text-encoding";

const Polyfilled = globalThis.TextDecoder;

class TolerantTextDecoder extends Polyfilled {
  constructor(label?: string) {
    super(label);
  }
}

globalThis.TextDecoder = TolerantTextDecoder as unknown as typeof globalThis.TextDecoder;
