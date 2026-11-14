import { describe, expect, it } from "vitest";

import { axisLabel, niceTicks } from "../components/charts/scale";
import { formatMoneyCompact, formatRelative, initials, pluralize, slugify } from "../lib/format";

describe("formatters", () => {
  it("shows money in full under 10,000 and compact above", () => {
    expect(formatMoneyCompact(1284)).toBe("$1,284");
    expect(formatMoneyCompact(70_412)).toBe("$70.4K");
    expect(formatMoneyCompact(4_200_000)).toBe("$4.2M");
  });

  it("describes times relative to now", () => {
    const now = Date.parse("2026-11-14T12:00:00Z");
    expect(formatRelative("2026-11-14T11:59:40Z", now)).toBe("just now");
    expect(formatRelative("2026-11-14T09:00:00Z", now)).toBe("3 hours ago");
    expect(formatRelative("2026-11-13T12:00:00Z", now)).toBe("yesterday");
    expect(formatRelative(null, now)).toBe("—");
  });

  it("derives initials from a name or an email", () => {
    expect(initials("Marina Costa")).toBe("MC");
    expect(initials(null, "priya.nair@railbyte.com")).toBe("PN");
    expect(initials(null, "owner@railbyte.com")).toBe("OW");
  });

  it("builds workspace slugs the API accepts", () => {
    expect(slugify("  Rail Byte Components! ")).toBe("rail-byte-components");
    expect(slugify("Café Ünïcode")).toBe("cafe-unicode");
  });

  it("pluralizes counts", () => {
    expect(pluralize(1, "order")).toBe("1 order");
    expect(pluralize(1200, "category", "categories")).toBe("1,200 categories");
  });
});

describe("chart scale", () => {
  it("picks round ticks that cover the maximum", () => {
    expect(niceTicks(4800)).toEqual([0, 2000, 4000, 6000]);
    expect(niceTicks(7)).toEqual([0, 2, 4, 6, 8]);
    expect(niceTicks(0)).toEqual([0, 1]);
  });

  it("labels axes in full under 10,000 and compact above", () => {
    expect(axisLabel(2000, 6000, "$")).toBe("$2,000");
    expect(axisLabel(20_000, 40_000, "$")).toBe("$20K");
  });
});
