import { describe, expect, it } from "vitest";

import { dateBadge, formatDate, formatNumber, formatRange, formatTime, localized } from "@/lib/format";

// 2026-12-01 09:30 in Colombo (UTC+05:30).
const START = "2026-12-01T04:00:00Z";
const END = "2026-12-02T11:30:00Z";

describe("dates and times", () => {
  it("formats a date in each language, in the conference's time zone", () => {
    expect(formatDate(START, "en", "long")).toBe("Tuesday, 1 December 2026");
    expect(formatDate(START, "en")).toBe("1 December 2026");
    expect(formatDate(START, "si", "long")).toBe("2026 දෙසැම්බර් 1, අඟහරුවාදා");
    expect(formatDate(START, "ta")).toBe("1 டிசம்பர் 2026");
  });

  it("turns the evening of 30 November UTC into 1 December in Colombo", () => {
    expect(formatDate("2026-11-30T20:00:00Z", "en")).toBe("1 December 2026");
    expect(formatDate("2026-11-30T20:00:00Z", "en", "medium", "UTC")).toBe("30 November 2026");
  });

  it("formats the time of day", () => {
    expect(formatTime(START, "en")).toMatch(/9:30/);
  });

  it("gives the month and day for the date badge", () => {
    expect(dateBadge(START, "en")).toEqual({ month: expect.stringMatching(/^dec/i), day: 1 });
  });

  it("shows a range across two days and collapses a single day", () => {
    expect(formatRange(START, END, "en")).toBe("1 Dec – 2 Dec 2026");
    expect(formatRange(START, "2027-01-02T10:00:00Z", "en")).toBe("1 Dec 2026 – 2 Jan 2027");
    expect(formatRange(START, "2026-12-01T10:00:00Z", "en")).toBe("1 December 2026");
  });

  it("is the same on every machine (no reliance on the runtime's locale data)", () => {
    const again = formatDate(START, "ta", "long");
    expect(formatDate(START, "ta", "long")).toBe(again);
    expect(formatDate(START, "ta", "long")).not.toMatch(/December/);
  });
});

describe("numbers and text", () => {
  it("groups thousands", () => {
    expect(formatNumber(12345, "en")).toBe("12,345");
  });

  it("falls back to English when a translation is missing", () => {
    expect(localized({ en: "Hello", si: "", ta: null }, "si")).toBe("Hello");
    expect(localized({ en: "Hello", si: "ආයුබෝවන්", ta: null }, "si")).toBe("ආයුබෝවන්");
    expect(localized(null, "ta")).toBe("");
  });
});
