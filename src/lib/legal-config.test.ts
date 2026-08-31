import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getLegalConfig } from "./legal-config";

const ENV_KEYS = [
  "NEXT_PUBLIC_APP_NAME",
  "NEXT_PUBLIC_APP_URL",
  "INVOICE_ISSUER_NAME",
  "INVOICE_ISSUER_OPERATOR",
  "INVOICE_ISSUER_ADDRESS",
  "INVOICE_ISSUER_TEL",
  "INVOICE_ISSUER_EMAIL",
  "INVOICE_ISSUER_REGISTRATION_NUMBER",
] as const;

describe("getLegalConfig", () => {
  const snapshot: Partial<Record<string, string | undefined>> = {};
  beforeEach(() => {
    for (const k of ENV_KEYS) {
      snapshot[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (snapshot[k] === undefined) delete process.env[k];
      else process.env[k] = snapshot[k];
    }
  });

  it("env が空文字でも未設定と同じ扱いになる（.env.local を打ち消す運用のため）", () => {
    process.env.INVOICE_ISSUER_ADDRESS = "";
    process.env.INVOICE_ISSUER_TEL = "";
    process.env.INVOICE_ISSUER_REGISTRATION_NUMBER = "";
    const cfg = getLegalConfig();
    expect(cfg.issuerAddress).toBe("請求があれば遅滞なく開示します");
    expect(cfg.issuerPhone).toBe("請求があれば遅滞なく開示します");
    expect(cfg.isInvoiceRegistered).toBe(false);
  });

  it("env 未設定なら全フィールドが安全なデフォルトを返す", () => {
    const cfg = getLegalConfig();
    expect(cfg.appName).toBe("本サービス");
    expect(cfg.appUrl).toBe("https://example.com");
    // 氏名も省令8条1号に含まれ省略可。住所・電話だけ請求時開示にするのは片手落ちになる
    expect(cfg.issuerName).toBe("請求があれば遅滞なく開示します");
    // 屋号を issuerName に入れても、運営責任者の氏名は別枠で扱う
    expect(cfg.operatorName).toBe("請求があれば遅滞なく開示します");
    expect(cfg.issuerAddress).toBe("請求があれば遅滞なく開示します");
    expect(cfg.issuerPhone).toBe("請求があれば遅滞なく開示します");
    expect(cfg.issuerEmail).toBe("support@example.com");
    expect(cfg.registrationNumber).toBe("T0000000000000");
    // ダミー番号のままで「適格請求書発行事業者です」と名乗らせない（消費税法57条の5）
    expect(cfg.isInvoiceRegistered).toBe(false);
    expect(cfg.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("env が設定されていればそれを優先する", () => {
    process.env.NEXT_PUBLIC_APP_NAME = "StartKit JP";
    process.env.NEXT_PUBLIC_APP_URL = "https://startkit.jp";
    process.env.INVOICE_ISSUER_NAME = "○○合同会社";
    process.env.INVOICE_ISSUER_ADDRESS = "大阪府大阪市〇〇区";
    process.env.INVOICE_ISSUER_TEL = "06-0000-0000";
    process.env.INVOICE_ISSUER_EMAIL = "billing@startkit.jp";
    process.env.INVOICE_ISSUER_REGISTRATION_NUMBER = "T1234567890123";

    const cfg = getLegalConfig();
    expect(cfg.appName).toBe("StartKit JP");
    expect(cfg.appUrl).toBe("https://startkit.jp");
    expect(cfg.issuerName).toBe("○○合同会社");
    expect(cfg.issuerAddress).toBe("大阪府大阪市〇〇区");
    expect(cfg.issuerPhone).toBe("06-0000-0000");
    expect(cfg.issuerEmail).toBe("billing@startkit.jp");
    expect(cfg.registrationNumber).toBe("T1234567890123");
    expect(cfg.isInvoiceRegistered).toBe(true);
  });

  it("空文字はデフォルトに落ちる（旧実装の `??` は空文字を素通りさせていた）", () => {
    // 販売サイトのビルドで .env.production.local から .env.local の値を
    // 打ち消す手段が「空文字を設定する」しかないため、空文字＝未設定として扱う。
    // 素通りさせると特商法ページの事業者情報が空欄で公開されてしまう。
    process.env.NEXT_PUBLIC_APP_NAME = "";
    const cfg = getLegalConfig();
    expect(cfg.appName).toBe("本サービス");
  });

  it("undefined のときはデフォルトに落ちる (nullish coalescing の挙動確認)", () => {
    delete process.env.NEXT_PUBLIC_APP_NAME;
    expect(getLegalConfig().appName).toBe("本サービス");
  });
});
