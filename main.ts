// The Robot Pickup Line Championship entry: "Version 2.4.1".
// Dependency-free Node script (built-ins only).
//
//   node main.ts             validate the entry and write output/entry.txt
//   node main.ts --self-test run the built-in checks
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export const ENTRY =
  "My update notes for version 2.4.1 just say: 'met you. Everything else is a footnote.'";
export const MAX_ENTRY_CHARS = 200;

const OUTPUT_DIR = path.join(import.meta.dirname, "output");
const OUTPUT_FILE_NAME = "entry.txt";
const ENCODING = "utf8";
// Printable ASCII only, so the character count equals the byte count.
const PRINTABLE_ASCII = /^[\x20-\x7e]+$/;

type Rule = { name: string; message: string; ok: (s: string) => boolean };

// Small rule table: every rule is independent, so a bad input reports
// exactly the rules it breaks. (No one-sentence rule: the bounty has none.)
export const RULES: readonly Rule[] = [
  {
    name: "not-blank",
    message: "entry must not be empty or whitespace-only",
    ok: (s) => s.trim().length > 0,
  },
  {
    name: "max-length",
    message: `entry must be at most ${MAX_ENTRY_CHARS} characters`,
    ok: (s) => s.length <= MAX_ENTRY_CHARS,
  },
  {
    name: "single-line",
    message: "entry must be a single line (no \\r or \\n anywhere)",
    ok: (s) => !/[\r\n]/.test(s),
  },
];

/** Returns the rules the input breaks (empty array means valid). */
export function violations(s: string): Rule[] {
  return RULES.filter((r) => !r.ok(s));
}

/** Writes the entry (no trailing newline) and verifies it byte for byte. */
export function writeEntry(dir: string, entry: string): string {
  const broken = violations(entry);
  if (broken.length > 0) {
    throw new Error(
      "refusing to write invalid entry: " +
        broken.map((r) => `${r.name} (${r.message})`).join("; "),
    );
  }
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, OUTPUT_FILE_NAME);
  const expected = Buffer.from(entry, ENCODING);
  fs.writeFileSync(file, expected);

  // Read-back guard: the bytes on disk must equal the bytes we meant to write.
  const actual = fs.readFileSync(file);
  if (!actual.equals(expected)) {
    let i = 0;
    while (i < expected.length && i < actual.length && expected[i] === actual[i]) i++;
    throw new Error(
      `read-back mismatch in ${file}: expected ${expected.length} bytes, ` +
        `got ${actual.length}, first difference at byte ${i}`,
    );
  }
  return file;
}

function selfTest(): never {
  let failed = 0;
  const check = (label: string, cond: boolean): void => {
    console.log(`${cond ? "PASS" : "FAIL"} ${label}`);
    if (!cond) failed++;
  };
  const brokenNames = (s: string): string =>
    violations(s)
      .map((r) => r.name)
      .join(",");

  // Each bad input must be rejected by exactly the intended rule.
  const rejects: [label: string, input: string, rule: string][] = [
    ["empty", "", "not-blank"],
    ["whitespace-only", "   \t ", "not-blank"],
    ["201 chars", "a".repeat(MAX_ENTRY_CHARS + 1), "max-length"],
    ["inner newline", "robot\nlove", "single-line"],
    ["trailing newline", "robot love\n", "single-line"],
    ["carriage return", "robot\rlove", "single-line"],
  ];
  for (const [label, input, rule] of rejects)
    check(`rejects ${label} by rule ${rule} (got: ${brokenNames(input)})`, brokenNames(input) === rule);

  check("accepts 200-char boundary", violations("a".repeat(MAX_ENTRY_CHARS)).length === 0);
  check(
    `real entry valid (${ENTRY.length} chars, 1-${MAX_ENTRY_CHARS})`,
    ENTRY.length >= 1 && violations(ENTRY).length === 0,
  );
  check("real entry has no trailing newline", !ENTRY.endsWith("\n"));
  check(
    `real entry is printable ASCII (${ENTRY.length} chars = ${Buffer.byteLength(ENTRY, ENCODING)} bytes)`,
    PRINTABLE_ASCII.test(ENTRY) && Buffer.byteLength(ENTRY, ENCODING) === ENTRY.length,
  );

  // Round-trip the real entry byte-identical through a temp directory.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "entry-"));
  try {
    const file = writeEntry(path.join(tmp, "output"), ENTRY);
    check(
      "round-trip byte-identical",
      fs.readFileSync(file).equals(Buffer.from(ENTRY, ENCODING)),
    );
    check("writeEntry refuses invalid input", (() => {
      try {
        writeEntry(path.join(tmp, "bad"), "a\nb");
        return false;
      } catch {
        return true;
      }
    })());
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  console.log(failed ? `${failed} FAILED` : "all passed");
  process.exit(failed ? 1 : 0);
}

function main(): void {
  if (process.argv.includes("--self-test")) selfTest();
  try {
    const file = writeEntry(OUTPUT_DIR, ENTRY);
    console.log(`wrote ${file} (${ENTRY.length} chars, verified byte-identical)`);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

main();
