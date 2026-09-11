// Pulls the "reply" string out of a JSON object while it is still streaming.
//
// The structured-output response is one JSON object and "reply" is its first
// key. We don't want the guest staring at a spinner until the closing brace,
// so this scans the raw token stream, finds `"reply":"`, and emits the decoded
// characters as they arrive, stopping at the closing quote. Everything else
// (recommendations, notes) is parsed once the stream is complete.

export class ReplyExtractor {
  constructor() {
    this.raw = "";
    this.state = "seek"; // seek -> inside -> done
    this.cursor = 0;
    this.escape = false;
    this.unicode = null; // collects \uXXXX digits
    this.emitted = "";
  }

  /** Feed a chunk; returns the newly decoded reply text (may be ""). */
  push(chunk) {
    this.raw += chunk;
    let out = "";

    if (this.state === "seek") {
      const m = this.raw.match(/"reply"\s*:\s*"/);
      if (!m) return "";
      this.cursor = m.index + m[0].length;
      this.state = "inside";
    }

    if (this.state === "inside") {
      while (this.cursor < this.raw.length) {
        const ch = this.raw[this.cursor++];

        if (this.unicode !== null) {
          this.unicode += ch;
          if (this.unicode.length === 4) {
            out += String.fromCharCode(parseInt(this.unicode, 16));
            this.unicode = null;
          }
          continue;
        }

        if (this.escape) {
          this.escape = false;
          if (ch === "n") out += "\n";
          else if (ch === "t") out += "\t";
          else if (ch === "u") this.unicode = "";
          else out += ch; // \" \\ \/ and anything else
          continue;
        }

        if (ch === "\\") {
          this.escape = true;
          continue;
        }
        if (ch === '"') {
          this.state = "done";
          break;
        }
        out += ch;
      }
    }

    this.emitted += out;
    return out;
  }

  get done() {
    return this.state === "done";
  }
}
