import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import zhHK from "../../messages/zh-HK.json";
import { routing } from "./routing";

function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe("i18n routing", () => {
  it("defaults to zh-HK and supports en", () => {
    expect(routing.defaultLocale).toBe("zh-HK");
    expect(routing.locales).toEqual(["zh-HK", "en"]);
  });

  it("has the same message keys in every locale", () => {
    expect(keys(en).sort()).toEqual(keys(zhHK).sort());
  });

  it("does not tell visitors a missing search expired", () => {
    const enBody = en.Search.notFoundBody.toLowerCase();
    const zhBody = zhHK.Search.notFoundBody;
    expect(enBody).not.toMatch(/expir/);
    expect(zhBody).not.toMatch(/過期/);
    expect(enBody).toMatch(/wrong/);
    expect(zhBody).toMatch(/錯/);
  });
});
