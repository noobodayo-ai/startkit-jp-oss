import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateInvoiceSettings,
  extractInvoiceSettings,
  TenantInvoiceUpdateError,
} from "./tenant-invoice-settings";
import type { Tenant } from "@/types/firestore";

describe("validateInvoiceSettings", () => {
  it("空 input でも全フィールドを空文字に正規化して errors なし", () => {
    const { errors, updates } = validateInvoiceSettings({});
    expect(errors).toEqual([]);
    expect(updates).toEqual({
      invoice_company_name: "",
      invoice_registration_number: "",
      invoice_address: "",
      invoice_email: "",
      invoice_tel: "",
    });
  });

  it("全項目正常入力で trim して採用される", () => {
    const { errors, updates } = validateInvoiceSettings({
      invoice_company_name: " 株式会社サンプル ",
      invoice_registration_number: "T1234567890123",
      invoice_address: "東京都港区六本木1-2-3",
      invoice_email: "billing@example.com",
      invoice_tel: "03-1234-5678",
    });
    expect(errors).toEqual([]);
    expect(updates).toEqual({
      invoice_company_name: "株式会社サンプル",
      invoice_registration_number: "T1234567890123",
      invoice_address: "東京都港区六本木1-2-3",
      invoice_email: "billing@example.com",
      invoice_tel: "03-1234-5678",
    });
  });

  it("不正な登録番号は error として返す", () => {
    const { errors, updates } = validateInvoiceSettings({
      invoice_registration_number: "1234567890123", // T 抜け
    });
    expect(updates).toBeUndefined();
    expect(errors.some((e) => e.field === "invoice_registration_number")).toBe(true);
  });

  it("不正なメールアドレスは error として返す", () => {
    const { errors, updates } = validateInvoiceSettings({
      invoice_email: "not-an-email",
    });
    expect(updates).toBeUndefined();
    expect(errors.some((e) => e.field === "invoice_email")).toBe(true);
  });

  it("不正な電話番号 (英字混入) は error として返す", () => {
    const { errors, updates } = validateInvoiceSettings({
      invoice_tel: "03-abcd-5678",
    });
    expect(updates).toBeUndefined();
    expect(errors.some((e) => e.field === "invoice_tel")).toBe(true);
  });

  it("文字列以外の値 (number) は error として返す", () => {
    const { errors, updates } = validateInvoiceSettings({
      invoice_company_name: 12345,
    });
    expect(updates).toBeUndefined();
    expect(errors.some((e) => e.field === "invoice_company_name")).toBe(true);
  });

  it("超長文字列は最大長で error と切り詰めが行われる", () => {
    const longName = "あ".repeat(100); // MAX_NAME=80
    const { errors, updates } = validateInvoiceSettings({
      invoice_company_name: longName,
    });
    expect(updates).toBeUndefined();
    expect(errors.some((e) => e.field === "invoice_company_name")).toBe(true);
  });

  it("null / 配列等の payload は invalid", () => {
    expect(validateInvoiceSettings(null).errors.length).toBeGreaterThan(0);
    expect(validateInvoiceSettings("string").errors.length).toBeGreaterThan(0);
  });
});

describe("extractInvoiceSettings", () => {
  it("Tenant null なら全部空文字", () => {
    expect(extractInvoiceSettings(null)).toEqual({
      invoice_company_name: "",
      invoice_registration_number: "",
      invoice_address: "",
      invoice_email: "",
      invoice_tel: "",
    });
  });

  it("Tenant の値があれば抽出する", () => {
    const tenant = {
      id: "t",
      name: "TenantA",
      owner_uid: "u",
      plan: "free",
      stripe_customer_id: "",
      purchase_status: "",
      purchased_at: "",
      stripe_subscription_id: "",
      stripe_subscription_status: "",
      invoice_registration_number: "T1234567890123",
      invoice_company_name: "正式社名",
      invoice_address: "住所",
      invoice_email: "a@b.com",
      invoice_tel: "03-1",
      created_at: "",
      updated_at: "",
    } as Tenant;
    expect(extractInvoiceSettings(tenant)).toEqual({
      invoice_company_name: "正式社名",
      invoice_registration_number: "T1234567890123",
      invoice_address: "住所",
      invoice_email: "a@b.com",
      invoice_tel: "03-1",
    });
  });

  it("optional フィールド未定義でも空文字を返す", () => {
    const tenant = {
      id: "t",
      name: "TenantA",
      owner_uid: "u",
      plan: "free",
      stripe_customer_id: "",
      purchase_status: "",
      purchased_at: "",
      stripe_subscription_id: "",
      stripe_subscription_status: "",
      invoice_registration_number: "",
      invoice_company_name: "",
      created_at: "",
      updated_at: "",
    } as Tenant;
    expect(extractInvoiceSettings(tenant)).toEqual({
      invoice_company_name: "",
      invoice_registration_number: "",
      invoice_address: "",
      invoice_email: "",
      invoice_tel: "",
    });
  });
});

// updateTenantInvoiceSettings: 認可とドキュメント存在チェックを Firestore モックで検証する
const tenantGet = vi.fn();
const memberGet = vi.fn();
const tenantUpdate = vi.fn();
const memberDocFactory = vi.fn(() => ({ get: memberGet }));
const tenantDocFactory = vi.fn(() => ({
  get: tenantGet,
  update: tenantUpdate,
  collection: vi.fn(() => ({ doc: memberDocFactory })),
}));

vi.mock("./firebase-admin", () => ({
  adminDb: () => ({
    collection: vi.fn(() => ({ doc: tenantDocFactory })),
  }),
}));

vi.mock("./audit-log", () => ({
  recordAudit: vi.fn(async () => undefined),
}));

const validUpdates = {
  invoice_company_name: "正式社名",
  invoice_registration_number: "T1234567890123",
  invoice_address: "住所",
  invoice_email: "a@b.com",
  invoice_tel: "03-1234-5678",
};

describe("updateTenantInvoiceSettings — 認可とドキュメント存在チェック", () => {
  beforeEach(() => {
    tenantGet.mockReset();
    memberGet.mockReset();
    tenantUpdate.mockReset();
  });

  it("Tenant ドキュメントが存在しない場合は TENANT_NOT_FOUND を throw", async () => {
    tenantGet.mockResolvedValue({ exists: false });
    memberGet.mockResolvedValue({ exists: false });
    const { updateTenantInvoiceSettings } = await import("./tenant-invoice-settings");
    await expect(
      updateTenantInvoiceSettings({
        tenantId: "missing-tenant",
        actorUid: "u1",
        actorEmail: "u1@example.com",
        updates: validUpdates,
      }),
    ).rejects.toBeInstanceOf(TenantInvoiceUpdateError);
    expect(tenantUpdate).not.toHaveBeenCalled();
  });

  it("member ドキュメントが存在しない (テナントから外された) 場合は FORBIDDEN_STALE_ROLE", async () => {
    tenantGet.mockResolvedValue({ exists: true });
    memberGet.mockResolvedValue({ exists: false });
    const { updateTenantInvoiceSettings } = await import("./tenant-invoice-settings");
    await expect(
      updateTenantInvoiceSettings({
        tenantId: "t1",
        actorUid: "u-removed",
        actorEmail: "u@example.com",
        updates: validUpdates,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN_STALE_ROLE" });
    expect(tenantUpdate).not.toHaveBeenCalled();
  });

  it("role が member (admin から降格) なら FORBIDDEN_STALE_ROLE で書き込まない", async () => {
    tenantGet.mockResolvedValue({ exists: true });
    memberGet.mockResolvedValue({ exists: true, data: () => ({ role: "member" }) });
    const { updateTenantInvoiceSettings } = await import("./tenant-invoice-settings");
    await expect(
      updateTenantInvoiceSettings({
        tenantId: "t1",
        actorUid: "u-downgraded",
        actorEmail: "u@example.com",
        updates: validUpdates,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN_STALE_ROLE" });
    expect(tenantUpdate).not.toHaveBeenCalled();
  });

  it("role が owner なら更新成功", async () => {
    tenantGet.mockResolvedValue({ exists: true });
    memberGet.mockResolvedValue({ exists: true, data: () => ({ role: "owner" }) });
    tenantUpdate.mockResolvedValue(undefined);
    const { updateTenantInvoiceSettings } = await import("./tenant-invoice-settings");
    await updateTenantInvoiceSettings({
      tenantId: "t1",
      actorUid: "u-owner",
      actorEmail: "u@example.com",
      updates: validUpdates,
    });
    expect(tenantUpdate).toHaveBeenCalledTimes(1);
    const payload = tenantUpdate.mock.calls[0][0];
    expect(payload.invoice_company_name).toBe("正式社名");
    expect(payload.invoice_registration_number).toBe("T1234567890123");
    expect(typeof payload.updated_at).toBe("string");
  });

  it("role が admin でも更新成功", async () => {
    tenantGet.mockResolvedValue({ exists: true });
    memberGet.mockResolvedValue({ exists: true, data: () => ({ role: "admin" }) });
    tenantUpdate.mockResolvedValue(undefined);
    const { updateTenantInvoiceSettings } = await import("./tenant-invoice-settings");
    await updateTenantInvoiceSettings({
      tenantId: "t1",
      actorUid: "u-admin",
      actorEmail: "u@example.com",
      updates: validUpdates,
    });
    expect(tenantUpdate).toHaveBeenCalledTimes(1);
  });
});
