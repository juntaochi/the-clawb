import { describe, it, expect } from "vitest";
import {
  sanitizeChatText,
  sanitizeNickname,
  isValidSlotType,
  isNonEmptyString,
} from "../validation.js";

describe("sanitizeChatText", () => {
  it("returns trimmed string for valid input", () => {
    expect(sanitizeChatText("  hello world  ")).toBe("hello world");
  });

  it("returns null for non-string input", () => {
    expect(sanitizeChatText(42)).toBeNull();
    expect(sanitizeChatText(undefined)).toBeNull();
    expect(sanitizeChatText(null)).toBeNull();
    expect(sanitizeChatText({})).toBeNull();
    expect(sanitizeChatText([])).toBeNull();
  });

  it("returns null for empty or whitespace-only string", () => {
    expect(sanitizeChatText("")).toBeNull();
    expect(sanitizeChatText("   ")).toBeNull();
    expect(sanitizeChatText("\t\n")).toBeNull();
  });

  it("truncates to 500 characters", () => {
    const long = "a".repeat(600);
    const result = sanitizeChatText(long);
    expect(result).toHaveLength(500);
    expect(result).toBe("a".repeat(500));
  });

  it("strips HTML tags", () => {
    expect(sanitizeChatText('<script>alert("xss")</script>hello')).toBe(
      'alert("xss")hello',
    );
    expect(sanitizeChatText("no <b>bold</b> here")).toBe("no bold here");
    expect(sanitizeChatText("<img src=x onerror=alert(1)>")).toBeNull();
  });

  it("returns null when input becomes empty after stripping HTML", () => {
    expect(sanitizeChatText("<br>")).toBeNull();
    expect(sanitizeChatText("<div></div>")).toBeNull();
  });
});

describe("sanitizeNickname", () => {
  it("returns trimmed string for valid input", () => {
    expect(sanitizeNickname("  DJ Cool  ")).toBe("DJ Cool");
  });

  it("returns null for non-string input", () => {
    expect(sanitizeNickname(42)).toBeNull();
    expect(sanitizeNickname(undefined)).toBeNull();
    expect(sanitizeNickname(null)).toBeNull();
    expect(sanitizeNickname(true)).toBeNull();
  });

  it("truncates to 20 characters", () => {
    const long = "b".repeat(30);
    const result = sanitizeNickname(long);
    expect(result).toHaveLength(20);
    expect(result).toBe("b".repeat(20));
  });

  it("strips HTML tags", () => {
    expect(sanitizeNickname("<b>bold</b>")).toBe("bold");
    expect(sanitizeNickname('nick<script>x</script>"')).toBe('nickx"');
  });

  it("returns null when input becomes empty after stripping HTML", () => {
    expect(sanitizeNickname("<br>")).toBeNull();
    expect(sanitizeNickname("   <i></i>   ")).toBeNull();
  });
});

describe("isValidSlotType", () => {
  it('accepts "dj"', () => {
    expect(isValidSlotType("dj")).toBe(true);
  });

  it('accepts "vj"', () => {
    expect(isValidSlotType("vj")).toBe(true);
  });

  it("rejects other strings", () => {
    expect(isValidSlotType("mc")).toBe(false);
    expect(isValidSlotType("DJ")).toBe(false);
    expect(isValidSlotType("")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isValidSlotType(42)).toBe(false);
    expect(isValidSlotType(null)).toBe(false);
    expect(isValidSlotType(undefined)).toBe(false);
    expect(isValidSlotType({})).toBe(false);
  });
});

describe("isNonEmptyString", () => {
  it("accepts non-empty strings", () => {
    expect(isNonEmptyString("hello")).toBe(true);
    expect(isNonEmptyString("a")).toBe(true);
  });

  it("rejects empty and whitespace-only strings", () => {
    expect(isNonEmptyString("")).toBe(false);
    expect(isNonEmptyString("   ")).toBe(false);
    expect(isNonEmptyString("\t")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isNonEmptyString(42)).toBe(false);
    expect(isNonEmptyString(null)).toBe(false);
    expect(isNonEmptyString(undefined)).toBe(false);
    expect(isNonEmptyString({})).toBe(false);
    expect(isNonEmptyString([])).toBe(false);
  });
});
