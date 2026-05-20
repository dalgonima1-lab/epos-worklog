import { promises as fs } from "fs";
import path from "path";
import type { PhotoSlot } from "./photoUrl";
import {
  getFirebaseBucket,
  isFirebaseConfigured,
  isFirebaseStorageConfigured,
} from "./firebaseAdmin";

export type { PhotoSlot };

const UPLOAD_ROOT = path.join(process.cwd(), "data", "uploads");

function storageObjectName(
  memberId: string,
  date: string,
  slot: PhotoSlot
): string {
  return `uploads/${memberId}/${date}/${slot}.jpg`;
}

export function photoDir(memberId: string, date: string): string {
  return path.join(UPLOAD_ROOT, memberId, date);
}

export function photoPath(
  memberId: string,
  date: string,
  slot: PhotoSlot
): string {
  return path.join(photoDir(memberId, date), `${slot}.jpg`);
}

export async function savePhoto(
  memberId: string,
  date: string,
  slot: PhotoSlot,
  buffer: Buffer
): Promise<string> {
  if (isFirebaseStorageConfigured()) {
    const objectName = storageObjectName(memberId, date, slot);
    const file = getFirebaseBucket().file(objectName);
    await file.save(buffer, {
      metadata: {
        contentType: "image/jpeg",
        cacheControl: "private, max-age=3600",
      },
    });
    return objectName;
  }

  const dir = photoDir(memberId, date);
  await fs.mkdir(dir, { recursive: true });
  const filePath = photoPath(memberId, date, slot);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

export function shouldStorePhotosInFirestore(): boolean {
  return isFirebaseConfigured() && !isFirebaseStorageConfigured();
}

export function bufferToDataUrl(buffer: Buffer, contentType = "image/jpeg") {
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

export function dataUrlToBuffer(dataUrl?: string | null): Buffer | null {
  if (!dataUrl) return null;
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  try {
    return Buffer.from(base64, "base64");
  } catch {
    return null;
  }
}

export async function readPhoto(
  memberId: string,
  date: string,
  slot: PhotoSlot
): Promise<Buffer | null> {
  if (isFirebaseStorageConfigured()) {
    try {
      const [buffer] = await getFirebaseBucket()
        .file(storageObjectName(memberId, date, slot))
        .download();
      return buffer;
    } catch {
      return null;
    }
  }

  try {
    return await fs.readFile(photoPath(memberId, date, slot));
  } catch {
    return null;
  }
}
