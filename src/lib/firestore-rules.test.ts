import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Firestore Security Rules は OR 評価。特定パスの `allow write: if false` は
// 「拒否」ではなく「許可しない」でしかないので、同じ階層に再帰ワイルドカードを
// 置くとその制限が丸ごと打ち消される。エミュレータ無しで検出できる最小の砦。
const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf-8");

describe("firestore.rules", () => {
  it("tenants/{tenantId} 直下に再帰ワイルドカードを置かない", () => {
    const tenantBlock = rules.slice(
      rules.indexOf("match /tenants/{tenantId}"),
      rules.indexOf("match /invites/{id}"),
    );
    expect(tenantBlock).not.toBe("");
    // `match /{document=**}` は members / audit_logs の write:false を無効化する
    expect(tenantBlock).not.toMatch(/match\s+\/\{document=\*\*\}/);
    expect(tenantBlock).toMatch(/match\s+\/data\/\{document=\*\*\}/);
  });

  it("末尾の fallback は全拒否のまま", () => {
    const fallback = rules.slice(rules.lastIndexOf("match /{document=**}"));
    expect(fallback).toMatch(/allow read,\s*write:\s*if false;/);
  });
});
