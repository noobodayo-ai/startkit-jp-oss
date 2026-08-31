import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 2026-08-31 の回帰ガード。
 *
 * ログアウトが `<form action="/api/session?_method=DELETE" method="post">` になっており、
 * **一度も動いたことがなかった**。Next.js の Route Handler は POST を DELETE に読み替えない
 * ため、`idToken` を要求する POST ハンドラに落ちて必ず失敗していた。
 *
 * このバグは typecheck / unit test / next build のすべてを通過する。型にも構文にも現れない
 * ので、HTTP メソッドの契約を明示的に固定しておく。疑似メソッドが必要になったら、
 * この route に実際のハンドラを足したうえでこのテストを消すこと。
 */
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : [full];
  });
}

describe("HTTP メソッドの契約", () => {
  it("_method 疑似メソッドに依存していない（Route Handler は解釈しない）", () => {
    const hits = walk("src")
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
      .filter((f) => readFileSync(f, "utf8").includes("_method"));

    expect(hits).toEqual([]);
  });
});
