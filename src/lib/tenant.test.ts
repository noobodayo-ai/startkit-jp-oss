import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// in-memory Firestore fake:
//   tenantsStore: tenantId → tenant doc
//   membersStore: `${tenantId}:${uid}` → member doc
//   invitesStore: inviteId → invite doc
// 個別 mock を組むより読みやすく、 関数間で副作用の整合性も取れる。
const tenantsStore = new Map<string, Record<string, unknown>>();
const membersStore = new Map<string, Record<string, unknown>>();
const invitesStore = new Map<string, Record<string, unknown>>();

const setCustomUserClaimsMock = vi.fn(async () => {});
const revokeRefreshTokensMock = vi.fn(async () => {});
const recordAuditMock = vi.fn(async () => {});

vi.mock("./firebase-admin", () => ({
  adminAuth: () => ({
    setCustomUserClaims: setCustomUserClaimsMock,
    revokeRefreshTokens: revokeRefreshTokensMock,
  }),
  adminDb: () => fakeDb,
}));
vi.mock("./audit-log", () => ({
  recordAudit: recordAuditMock,
}));
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: () => "<SERVER_TIMESTAMP>",
  },
}));

function inviteDocRef(id: string) {
  return {
    update: vi.fn(async (patch: Record<string, unknown>) => {
      const cur = invitesStore.get(id);
      if (cur) invitesStore.set(id, { ...cur, ...patch });
    }),
  };
}

function memberDocApi(tenantId: string, uid: string) {
  const key = `${tenantId}:${uid}`;
  return {
    set: vi.fn(async (data: Record<string, unknown>) => {
      membersStore.set(key, data);
    }),
    get: vi.fn(async () => {
      const data = membersStore.get(key);
      return {
        exists: data !== undefined,
        data: () => data,
      };
    }),
    delete: vi.fn(async () => {
      membersStore.delete(key);
    }),
    update: vi.fn(async (patch: Record<string, unknown>) => {
      const cur = membersStore.get(key);
      if (cur) membersStore.set(key, { ...cur, ...patch });
    }),
  };
}

function tenantDocApi(tenantId: string) {
  return {
    set: vi.fn(async (data: Record<string, unknown>) => {
      tenantsStore.set(tenantId, data);
    }),
    get: vi.fn(async () => {
      const data = tenantsStore.get(tenantId);
      return {
        exists: data !== undefined,
        data: () => data,
      };
    }),
    collection: vi.fn((sub: string) => {
      if (sub !== "members") throw new Error(`unexpected subcollection: ${sub}`);
      return {
        doc: (uid: string) => memberDocApi(tenantId, uid),
        get: vi.fn(async () => ({
          docs: [...membersStore.entries()]
            .filter(([k]) => k.startsWith(`${tenantId}:`))
            .map(([k, data]) => ({
              id: k.split(":")[1]!,
              data: () => data,
            })),
        })),
      };
    }),
  };
}

function inviteCollectionApi() {
  return {
    doc: (id: string) => ({
      set: vi.fn(async (data: Record<string, unknown>) => {
        invitesStore.set(id, data);
      }),
    }),
    where: vi.fn((field: string, op: string, value: unknown) => ({
      limit: vi.fn(() => ({
        get: vi.fn(async () => {
          const matched = [...invitesStore.entries()].filter(([, data]) => {
            if (field === "code" && op === "==") return data.code === value;
            return false;
          });
          return {
            empty: matched.length === 0,
            docs: matched.map(([id, data]) => ({
              id,
              data: () => data,
              ref: inviteDocRef(id),
            })),
          };
        }),
      })),
    })),
  };
}

const fakeDb = {
  collection: vi.fn((name: string) => {
    if (name === "tenants") {
      return { doc: (tid: string) => tenantDocApi(tid) };
    }
    if (name === "invites") {
      return inviteCollectionApi();
    }
    throw new Error(`unexpected collection: ${name}`);
  }),
};

beforeEach(() => {
  tenantsStore.clear();
  membersStore.clear();
  invitesStore.clear();
  setCustomUserClaimsMock.mockClear();
  revokeRefreshTokensMock.mockClear();
  recordAuditMock.mockClear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("createTenant", () => {
  it("tenant doc + owner member + Custom Claims + audit を書き込み tenantId を返す", async () => {
    const { createTenant } = await import("./tenant");
    const tid = await createTenant({
      ownerUid: "uid-1",
      ownerEmail: "owner@example.com",
      name: "Acme",
    });
    expect(typeof tid).toBe("string");
    expect(tid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}/);

    const tenant = tenantsStore.get(tid);
    expect(tenant).toMatchObject({
      id: tid,
      name: "Acme",
      owner_uid: "uid-1",
      plan: "free",
      purchase_status: "",
      stripe_subscription_status: "",
    });

    const member = membersStore.get(`${tid}:uid-1`);
    expect(member).toMatchObject({
      id: "uid-1",
      email: "owner@example.com",
      role: "owner",
    });

    expect(setCustomUserClaimsMock).toHaveBeenCalledWith("uid-1", {
      tenantId: tid,
      role: "owner",
    });

    expect(recordAuditMock).toHaveBeenCalledWith(tid, {
      action: "tenant.create",
      actor_uid: "uid-1",
      actor_email: "owner@example.com",
      metadata: { name: "Acme" },
    });
  });
});

describe("createInvite", () => {
  it("invite doc を作成して 8 文字コードと expires_at を返す + audit", async () => {
    const { createInvite } = await import("./tenant");
    const invite = await createInvite({
      tenantId: "tenant-1",
      email: "new@example.com",
      role: "admin",
      invitedByUid: "owner-1",
    });
    expect(invite.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    expect(invite.role).toBe("admin");
    expect(invite.tenant_id).toBe("tenant-1");
    expect(invite.used_at).toBe("");

    // 既定 ttlDays=7 で expires_at が未来 (約 7 日後)
    const expiresAt = new Date(invite.expires_at).getTime();
    const createdAt = new Date(invite.created_at).getTime();
    expect(expiresAt - createdAt).toBeCloseTo(7 * 86400 * 1000, -3);

    expect(invitesStore.get(invite.id)).toMatchObject({ code: invite.code });

    expect(recordAuditMock).toHaveBeenCalledWith("tenant-1", expect.objectContaining({
      action: "invite.create",
      actor_uid: "owner-1",
      target_email: "new@example.com",
    }));
  });

  it("ttlDays を指定するとそれが反映される", async () => {
    const { createInvite } = await import("./tenant");
    const invite = await createInvite({
      tenantId: "tenant-1",
      role: "member",
      invitedByUid: "owner-1",
      ttlDays: 30,
    });
    const expiresAt = new Date(invite.expires_at).getTime();
    const createdAt = new Date(invite.created_at).getTime();
    expect(expiresAt - createdAt).toBeCloseTo(30 * 86400 * 1000, -3);
  });

  it("email を省略すると空文字で保存される", async () => {
    const { createInvite } = await import("./tenant");
    const invite = await createInvite({
      tenantId: "tenant-1",
      role: "member",
      invitedByUid: "owner-1",
    });
    expect(invite.email).toBe("");
  });
});

describe("acceptInvite", () => {
  function seedInvite(overrides: Partial<Record<string, unknown>> = {}) {
    const base = {
      id: "inv-1",
      tenant_id: "tenant-1",
      email: "",
      code: "CODE1234",
      role: "member",
      invited_by_uid: "owner-1",
      expires_at: new Date(Date.now() + 86400 * 1000).toISOString(),
      used_at: "",
      used_by_uid: "",
      created_at: new Date().toISOString(),
    };
    invitesStore.set("inv-1", { ...base, ...overrides });
  }

  it("code が見つからなければ INVITE_NOT_FOUND", async () => {
    const { acceptInvite } = await import("./tenant");
    await expect(
      acceptInvite({ code: "NOMATCH00", uid: "u", email: "u@ex.com" }),
    ).rejects.toThrow("INVITE_NOT_FOUND");
  });

  it("invite.used_at がセット済なら INVITE_USED", async () => {
    seedInvite({ used_at: "2026-05-01T00:00:00Z", used_by_uid: "other" });
    const { acceptInvite } = await import("./tenant");
    await expect(
      acceptInvite({ code: "CODE1234", uid: "u", email: "u@ex.com" }),
    ).rejects.toThrow("INVITE_USED");
  });

  it("expires_at が過去なら INVITE_EXPIRED", async () => {
    seedInvite({ expires_at: new Date(Date.now() - 86400 * 1000).toISOString() });
    const { acceptInvite } = await import("./tenant");
    await expect(
      acceptInvite({ code: "CODE1234", uid: "u", email: "u@ex.com" }),
    ).rejects.toThrow("INVITE_EXPIRED");
  });

  it("invite.email と引数 email が一致しないと INVITE_EMAIL_MISMATCH (大小無視)", async () => {
    seedInvite({ email: "expected@example.com" });
    const { acceptInvite } = await import("./tenant");
    await expect(
      acceptInvite({ code: "CODE1234", uid: "u", email: "OTHER@example.com" }),
    ).rejects.toThrow("INVITE_EMAIL_MISMATCH");
    // 大小違いはマッチして成功
    await expect(
      acceptInvite({ code: "CODE1234", uid: "u", email: "EXPECTED@EXAMPLE.com" }),
    ).resolves.toMatchObject({ tenantId: "tenant-1", role: "member" });
  });

  it("成功時に member 作成 + invite.used_at 更新 + Custom Claims + audit", async () => {
    seedInvite({ email: "" }); // email 制約なし
    const { acceptInvite } = await import("./tenant");
    const result = await acceptInvite({
      code: "CODE1234",
      uid: "new-uid",
      email: "new@example.com",
    });
    expect(result).toEqual({ tenantId: "tenant-1", role: "member" });

    expect(membersStore.get("tenant-1:new-uid")).toMatchObject({
      id: "new-uid",
      email: "new@example.com",
      role: "member",
    });
    expect(invitesStore.get("inv-1")).toMatchObject({
      used_at: "<SERVER_TIMESTAMP>",
      used_by_uid: "new-uid",
    });
    expect(setCustomUserClaimsMock).toHaveBeenCalledWith("new-uid", {
      tenantId: "tenant-1",
      role: "member",
    });
    expect(recordAuditMock).toHaveBeenCalledWith("tenant-1", expect.objectContaining({
      action: "invite.accept",
      actor_uid: "new-uid",
    }));
  });
});

describe("listMembers", () => {
  it("該当 tenant のメンバーのみ返す", async () => {
    membersStore.set("tenant-1:u1", { id: "u1", email: "a", role: "owner", joined_at: "" });
    membersStore.set("tenant-1:u2", { id: "u2", email: "b", role: "member", joined_at: "" });
    membersStore.set("tenant-2:u3", { id: "u3", email: "c", role: "owner", joined_at: "" });

    const { listMembers } = await import("./tenant");
    const list = await listMembers("tenant-1");
    expect(list).toHaveLength(2);
    expect(list.map((m) => m.id).sort()).toEqual(["u1", "u2"]);
  });

  it("メンバーがいなければ空配列", async () => {
    const { listMembers } = await import("./tenant");
    expect(await listMembers("empty-tenant")).toEqual([]);
  });
});

describe("removeMember", () => {
  function seedTenantWithOwnerAndMember() {
    tenantsStore.set("tenant-1", {
      id: "tenant-1",
      owner_uid: "owner-1",
      name: "Acme",
    });
    membersStore.set("tenant-1:owner-1", {
      id: "owner-1",
      email: "owner@example.com",
      role: "owner",
      joined_at: "",
    });
    membersStore.set("tenant-1:member-1", {
      id: "member-1",
      email: "member@example.com",
      role: "member",
      joined_at: "",
    });
  }

  it("tenant が存在しなければ TENANT_NOT_FOUND", async () => {
    const { removeMember } = await import("./tenant");
    await expect(
      removeMember({
        tenantId: "no-such-tenant",
        targetUid: "u",
        actorUid: "a",
        actorEmail: "a@ex.com",
      }),
    ).rejects.toThrow("TENANT_NOT_FOUND");
  });

  it("Owner を削除しようとすると CANNOT_REMOVE_OWNER", async () => {
    seedTenantWithOwnerAndMember();
    const { removeMember } = await import("./tenant");
    await expect(
      removeMember({
        tenantId: "tenant-1",
        targetUid: "owner-1",
        actorUid: "owner-1",
        actorEmail: "owner@example.com",
      }),
    ).rejects.toThrow("CANNOT_REMOVE_OWNER");
  });

  it("メンバーが存在しなければ MEMBER_NOT_FOUND", async () => {
    seedTenantWithOwnerAndMember();
    const { removeMember } = await import("./tenant");
    await expect(
      removeMember({
        tenantId: "tenant-1",
        targetUid: "no-such-uid",
        actorUid: "owner-1",
        actorEmail: "owner@example.com",
      }),
    ).rejects.toThrow("MEMBER_NOT_FOUND");
  });

  it("正常: member を削除 + Custom Claims クリア + audit", async () => {
    seedTenantWithOwnerAndMember();
    const { removeMember } = await import("./tenant");
    await removeMember({
      tenantId: "tenant-1",
      targetUid: "member-1",
      actorUid: "owner-1",
      actorEmail: "owner@example.com",
    });
    expect(membersStore.has("tenant-1:member-1")).toBe(false);
    expect(setCustomUserClaimsMock).toHaveBeenCalledWith("member-1", { tenantId: "", role: "" });
    expect(recordAuditMock).toHaveBeenCalledWith("tenant-1", expect.objectContaining({
      action: "member.remove",
      target_uid: "member-1",
      target_email: "member@example.com",
      metadata: { previous_role: "member" },
    }));
  });
});

describe("changeMemberRole", () => {
  function seedTenantWithMembers() {
    tenantsStore.set("tenant-1", {
      id: "tenant-1",
      owner_uid: "owner-1",
      name: "Acme",
    });
    membersStore.set("tenant-1:owner-1", {
      id: "owner-1",
      email: "owner@example.com",
      role: "owner",
      joined_at: "",
    });
    membersStore.set("tenant-1:member-1", {
      id: "member-1",
      email: "member@example.com",
      role: "member",
      joined_at: "",
    });
  }

  it("newRole='owner' は CANNOT_PROMOTE_TO_OWNER で弾く", async () => {
    const { changeMemberRole } = await import("./tenant");
    await expect(
      changeMemberRole({
        tenantId: "tenant-1",
        targetUid: "member-1",
        newRole: "owner",
        actorUid: "owner-1",
        actorEmail: "owner@example.com",
      }),
    ).rejects.toThrow("CANNOT_PROMOTE_TO_OWNER");
  });

  it("tenant が存在しなければ TENANT_NOT_FOUND", async () => {
    const { changeMemberRole } = await import("./tenant");
    await expect(
      changeMemberRole({
        tenantId: "no-such",
        targetUid: "u",
        newRole: "admin",
        actorUid: "a",
        actorEmail: "a@ex.com",
      }),
    ).rejects.toThrow("TENANT_NOT_FOUND");
  });

  it("Owner の role を変更しようとすると CANNOT_CHANGE_OWNER", async () => {
    seedTenantWithMembers();
    const { changeMemberRole } = await import("./tenant");
    await expect(
      changeMemberRole({
        tenantId: "tenant-1",
        targetUid: "owner-1",
        newRole: "admin",
        actorUid: "owner-1",
        actorEmail: "owner@example.com",
      }),
    ).rejects.toThrow("CANNOT_CHANGE_OWNER");
  });

  it("メンバーが存在しなければ MEMBER_NOT_FOUND", async () => {
    seedTenantWithMembers();
    const { changeMemberRole } = await import("./tenant");
    await expect(
      changeMemberRole({
        tenantId: "tenant-1",
        targetUid: "no-such",
        newRole: "admin",
        actorUid: "owner-1",
        actorEmail: "owner@example.com",
      }),
    ).rejects.toThrow("MEMBER_NOT_FOUND");
  });

  it("同 role を渡すと no-op (副作用なし)", async () => {
    seedTenantWithMembers();
    const { changeMemberRole } = await import("./tenant");
    await changeMemberRole({
      tenantId: "tenant-1",
      targetUid: "member-1",
      newRole: "member",
      actorUid: "owner-1",
      actorEmail: "owner@example.com",
    });
    expect(setCustomUserClaimsMock).not.toHaveBeenCalled();
    expect(recordAuditMock).not.toHaveBeenCalled();
  });

  it("正常: member の role を更新 + Custom Claims + audit", async () => {
    seedTenantWithMembers();
    const { changeMemberRole } = await import("./tenant");
    await changeMemberRole({
      tenantId: "tenant-1",
      targetUid: "member-1",
      newRole: "admin",
      actorUid: "owner-1",
      actorEmail: "owner@example.com",
    });
    expect(membersStore.get("tenant-1:member-1")).toMatchObject({ role: "admin" });
    expect(setCustomUserClaimsMock).toHaveBeenCalledWith("member-1", {
      tenantId: "tenant-1",
      role: "admin",
    });
    expect(recordAuditMock).toHaveBeenCalledWith("tenant-1", expect.objectContaining({
      action: "member.role_change",
      target_uid: "member-1",
      metadata: { from: "member", to: "admin" },
    }));
  });
});

describe("canManageMembers", () => {
  it("owner と admin は true", async () => {
    const { canManageMembers } = await import("./tenant");
    expect(canManageMembers("owner")).toBe(true);
    expect(canManageMembers("admin")).toBe(true);
  });

  it("member と 空文字は false", async () => {
    const { canManageMembers } = await import("./tenant");
    expect(canManageMembers("member")).toBe(false);
    expect(canManageMembers("")).toBe(false);
  });
});

// ===== セキュリティ回帰テスト（2026-08-05 の敵対的レビューで発見した2件） =====
// これらが落ちる状態は「member が owner に昇格できる」「除名してもセッションが生き残る」
// という本番テナント乗っ取り経路が開いていることを意味する。緩めないこと。

describe("[SECURITY] createInvite は owner ロールの招待を拒否する", () => {
  beforeEach(() => {
    tenantsStore.set("t-sec", { id: "t-sec", name: "Sec", owner_uid: "owner-1" });
  });

  it("role=owner を指定した招待は作成できない", async () => {
    const { createInvite } = await import("./tenant");
    await expect(
      createInvite({
        tenantId: "t-sec",
        role: "owner",
        invitedByUid: "member-1",
      }),
    ).rejects.toThrow("INVALID_INVITE_ROLE");
    expect(invitesStore.size).toBe(0);
  });

  it("未知のロール文字列も拒否する", async () => {
    const { createInvite } = await import("./tenant");
    await expect(
      createInvite({
        tenantId: "t-sec",
        role: "superadmin" as never,
        invitedByUid: "member-1",
      }),
    ).rejects.toThrow("INVALID_INVITE_ROLE");
  });

  it("member / admin は従来どおり作成できる", async () => {
    const { createInvite } = await import("./tenant");
    await expect(
      createInvite({ tenantId: "t-sec", role: "member", invitedByUid: "owner-1" }),
    ).resolves.toBeTruthy();
    await expect(
      createInvite({ tenantId: "t-sec", role: "admin", invitedByUid: "owner-1" }),
    ).resolves.toBeTruthy();
  });
});

describe("[SECURITY] メンバー除名・降格で既存セッションを失効させる", () => {
  beforeEach(() => {
    tenantsStore.set("t-sec2", { id: "t-sec2", name: "Sec2", owner_uid: "owner-1" });
    membersStore.set("t-sec2:member-1", {
      id: "member-1",
      email: "m@example.com",
      role: "admin",
      joined_at: "2026-01-01T00:00:00.000Z",
    });
  });

  it("removeMember は revokeRefreshTokens を呼ぶ", async () => {
    const { removeMember } = await import("./tenant");
    await removeMember({
      tenantId: "t-sec2",
      targetUid: "member-1",
      actorUid: "owner-1",
      actorEmail: "o@example.com",
    });
    expect(revokeRefreshTokensMock).toHaveBeenCalledWith("member-1");
  });

  it("changeMemberRole は revokeRefreshTokens を呼ぶ", async () => {
    const { changeMemberRole } = await import("./tenant");
    await changeMemberRole({
      tenantId: "t-sec2",
      targetUid: "member-1",
      newRole: "member",
      actorUid: "owner-1",
      actorEmail: "o@example.com",
    });
    expect(revokeRefreshTokensMock).toHaveBeenCalledWith("member-1");
  });
});
