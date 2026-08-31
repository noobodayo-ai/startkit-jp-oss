import { getApps, initializeApp, cert, getApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";

let _app: App | null = null;
let _firestoreSettingsApplied = false;

function initAdmin(): App {
  if (_app) return _app;
  if (getApps().length > 0) {
    _app = getApp();
    return _app;
  }
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin credentials missing. " +
        "Set FIREBASE_ADMIN_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY",
    );
  }
  // 適格請求書 PDF を Firebase Storage にアップロードするため storageBucket を必ず渡す。
  // 渡し忘れると getStorage().bucket() が "Bucket name not specified" で失敗する。
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  _app = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    ...(storageBucket ? { storageBucket } : {}),
  });
  return _app;
}

export function adminDb(): Firestore {
  initAdmin();
  const db = getFirestore();
  // undefined フィールドを書き込もうとすると Firestore が拒否する (例:
  // Invoice.recipient.registration_number が省略時)。これを ignore して
  // undefined を含むオブジェクトを安全に set できるようにする。
  // settings() は最初の I/O 前に一度だけ呼ぶ必要があるため初回呼び出し時のみ適用。
  if (!_firestoreSettingsApplied) {
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch {
      // 既に I/O が始まっていたら settings() は throw する。その場合は
      // 既存設定のまま使う（hot reload や複数 app の場合に到達することがある）。
    }
    _firestoreSettingsApplied = true;
  }
  return db;
}

export function adminAuth(): Auth {
  initAdmin();
  return getAuth();
}

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}
