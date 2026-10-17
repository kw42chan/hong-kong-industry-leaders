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

  it("tells a visitor a missing search link is wrong, without saying it expired", () => {
    expect(en.Search.notFoundBody).toBe("This link may be wrong.");
    expect(zhHK.Search.notFoundBody).toBe("條連結可能有錯。");
    expect(en.Search.notFoundBody.toLowerCase()).not.toContain("expired");
    expect(zhHK.Search.notFoundBody).not.toContain("過期");
  });
});
