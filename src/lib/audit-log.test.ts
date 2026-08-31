import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Firestore admin SDK + observability の mock を組む。
//   - tenants/{tid}/audit_logs.add(entry) の add 呼び出しを検証
//   - tenants/{tid}/audit_logs.orderBy().limit().get() の検索を検証
//   - 例外時 captureError が呼ばれて throw しないことを検証

const addFn = vi.fn(async (data: Record<string, unknown>) => ({ id: `doc_${Math.random()}`, data }));
const getFn = vi.fn(async () => ({
  docs: [
    {
      id: "log-2",
      data: () => ({
        action: "invoice.issue",
        actor_uid: "system",
        created_at: "2026-05-27T10:00:00Z",
      }),
    },
    {
      id: "log-1",
      data: () => ({
        action: "tenant.create",
        actor_uid: "user-1",
        created_at: "2026-05-26T10:00:00Z",
      }),
    },
  ],
}));
const limitFn = vi.fn(() => ({ get: getFn }));
const orderByFn = vi.fn(() => ({ limit: limitFn }));
const auditLogsCollection = { add: addFn, orderBy: orderByFn };
const tenantDoc = { collection: vi.fn(() => auditLogsCollection) };
const tenantsCollection = { doc: vi.fn(() => tenantDoc) };
const dbCollection = vi.fn((name: string) => {
  if (name === "tenants") return tenantsCollection;
  throw new Error(`unexpected collection: ${name}`);
});

vi.mock("./firebase-admin", () => ({
  adminDb: () => ({ collection: dbCollection }),
}));

const captureErrorMock = vi.fn(async () => {});
vi.mock("./observability", () => ({
  captureError: captureErrorMock,
}));

describe("recordAudit", () => {
  beforeEach(() => {
    addFn.mockClear();
    addFn.mockImplementation(async (data: Record<string, unknown>) => ({ id: "doc_x", data }));
    dbCollection.mockClear();
    tenantsCollection.doc.mockClear();
    tenantDoc.collection.mockClear();
    captureErrorMock.mockClear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("tenants/{tid}/audit_logs に entry + created_at を add する", async () => {
    const { recordAudit } = await import("./audit-log");
    await recordAudit("tenant-1", {
      action: "invoice.issue",
      actor_uid: "system",
      metadata: { invoice_number: "INV-2026-0001" },
    });
    expect(dbCollection).toHaveBeenCalledWith("tenants");
    expect(tenantsCollection.doc).toHaveBeenCalledWith("tenant-1");
    expect(tenantDoc.collection).toHaveBeenCalledWith("audit_logs");
    expect(addFn).toHaveBeenCalledTimes(1);
    const arg = addFn.mock.calls[0]![0]!;
    expect(arg.action).toBe("invoice.issue");
    expect(arg.actor_uid).toBe("system");
    expect(arg.metadata).toEqual({ invoice_number: "INV-2026-0001" });
    expect(typeof arg.created_at).toBe("string");
    expect(arg.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("add() が例外を投げても throw せず captureError に流す", async () => {
    addFn.mockImplementationOnce(async () => {
      throw new Error("firestore down");
    });
    const { recordAudit } = await import("./audit-log");
    await expect(
      recordAudit("tenant-2", {
        action: "stripe.charge_refunded",
        actor_uid: "system",
      }),
    ).resolves.toBeUndefined();
    expect(captureErrorMock).toHaveBeenCalledTimes(1);
    const call = captureErrorMock.mock.calls[0]! as unknown as [unknown, { tags?: Record<string, string> }];
    expect(call[0]).toBeInstanceOf(Error);
    expect((call[0] as Error).message).toBe("firestore down");
    expect(call[1].tags).toMatchObject({
      module: "audit-log",
      tenant_id: "tenant-2",
      action: "stripe.charge_refunded",
    });
  });

});

describe("listAuditLogs", () => {
  beforeEach(() => {
    orderByFn.mockClear();
    limitFn.mockClear();
    getFn.mockClear();
  });

  it("created_at desc + 既定 limit=50 で取得し、 id を含めて返す", async () => {
    const { listAuditLogs } = await import("./audit-log");
    const list = await listAuditLogs("tenant-1");
    expect(orderByFn).toHaveBeenCalledWith("created_at", "desc");
    expect(limitFn).toHaveBeenCalledWith(50);
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({
      id: "log-2",
      action: "invoice.issue",
      actor_uid: "system",
      created_at: "2026-05-27T10:00:00Z",
    });
  });

  it("limit 引数を渡すとそれが使われる", async () => {
    const { listAuditLogs } = await import("./audit-log");
    await listAuditLogs("tenant-1", 10);
    expect(limitFn).toHaveBeenCalledWith(10);
  });
});
