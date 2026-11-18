import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { db, firebaseConfig, storage } from './firebase';

export type StorageFolder =
  | 'profile-photo'
  | 'documents'
  | 'certificates'
  | 'achievements'
  | 'activities'
  | 'gallery';

export interface UploadResult {
  downloadUrl: string;
  storagePath: string;
  fileName: string;
  fileSize: number;
  storedInline?: boolean;
}

const MAX_INLINE_SINGLE_DOC_BYTES = 145 * 1024;
const MAX_CHUNKED_DOC_BYTES = 7 * 1024 * 1024; // 7 MB via Firestore chunked storage
const CHUNK_CHAR_SIZE = 420000;
const BLOB_CACHE = new Map<string, Blob>();

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

let cachedBucketAvailable: boolean | null = null;

async function isStorageBucketAvailable(): Promise<boolean> {
  if (cachedBucketAvailable !== null) return cachedBucketAvailable;
  if (!firebaseConfig.storageBucket) {
    cachedBucketAvailable = false;
    return false;
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 2500);
  try {
    const resp = await fetch(
      `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(firebaseConfig.storageBucket)}/o`,
      { method: 'GET', signal: controller.signal }
    );
    cachedBucketAvailable = resp.status !== 404;
    return cachedBucketAvailable;
  } catch {
    cachedBucketAvailable = false;
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

function isImageFile(file: File): boolean {
  if (file.type && file.type.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Gagal membaca berkas.'));
      }
    };
    reader.onerror = () => reject(new Error('Gagal membaca berkas lokal.'));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Format gambar tidak dapat diproses browser.'));
    img.src = src;
  });
}

async function compressImageToDataUrl(
  file: File,
  maxDimension: number,
  maxCharLength: number
): Promise<string> {
  const rawDataUrl = await readFileAsDataUrl(file);
  const img = await loadImageElement(rawDataUrl);

  let dim = maxDimension;
  const qualities = [0.82, 0.68, 0.55, 0.42, 0.3];

  for (let pass = 0; pass < 3; pass++) {
    const scale = Math.min(1, dim / Math.max(img.width || 1, img.height || 1));
    const width = Math.max(1, Math.round((img.width || dim) * scale));
    const height = Math.max(1, Math.round((img.height || dim) * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return rawDataUrl.slice(0, maxCharLength);
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    for (const q of qualities) {
      const candidate = canvas.toDataURL('image/jpeg', q);
      if (candidate.length <= maxCharLength) {
        return candidate;
      }
    }
    dim = Math.round(dim * 0.72);
  }

  throw new Error(
    'Ukuran foto terlalu besar setelah dikompresi. Gunakan foto beresolusi lebih kecil.'
  );
}

async function uploadChunkedBlobToFirestore(
  uid: string,
  file: File,
  dataUrl: string,
  onProgress?: (percent: number) => void
): Promise<UploadResult> {
  const commaIdx = dataUrl.indexOf(',');
  const header = commaIdx >= 0 ? dataUrl.slice(0, commaIdx) : '';
  const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  const mimeMatch = header.match(/data:([^;]+)/);
  const mimeType = (mimeMatch ? mimeMatch[1] : file.type) || 'application/octet-stream';

  const chunks: string[] = [];
  for (let i = 0; i < base64.length; i += CHUNK_CHAR_SIZE) {
    chunks.push(base64.slice(i, i + CHUNK_CHAR_SIZE));
  }
  if (chunks.length === 0 || chunks.length > 28) {
    throw new Error('Ukuran berkas melebihi kapasitas penyimpanan pecahan Firestore (maks 7 MB).');
  }

  const blobId = `blob_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const parentRef = doc(db, 'fileBlobs', blobId);

  onProgress?.(20);
  await setDoc(parentRef, {
    uid,
    fileName: file.name.slice(0, 255) || 'berkas',
    mimeType: mimeType.slice(0, 150),
    chunkCount: chunks.length,
    totalSize: Math.max(1, file.size),
    isPublic: true,
    createdAt: serverTimestamp(),
  });

  try {
    for (let i = 0; i < chunks.length; i++) {
      await setDoc(doc(db, 'fileBlobs', blobId, 'chunks', String(i)), {
        uid,
        index: i,
        data: chunks[i],
        createdAt: serverTimestamp(),
      });
      const pct = 20 + Math.round(((i + 1) / chunks.length) * 78);
      onProgress?.(pct);
    }
  } catch (err) {
    // Cleanup partial chunks and parent metadata if any chunk fails
    await Promise.all(
      Array.from({ length: chunks.length }, (_, idx) =>
        deleteDoc(doc(db, 'fileBlobs', blobId, 'chunks', String(idx))).catch(() => undefined)
      )
    );
    await deleteDoc(parentRef).catch(() => undefined);
    throw err;
  }

  const blob = base64ToBlob(base64, mimeType);
  BLOB_CACHE.set(blobId, blob);

  onProgress?.(100);
  const refUrl = `firestore-blob://${blobId}`;
  return {
    downloadUrl: refUrl,
    storagePath: refUrl,
    fileName: file.name,
    fileSize: file.size,
    storedInline: true,
  };
}

async function createInlineFallback(
  folder: StorageFolder,
  uid: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadResult> {
  onProgress?.(25);
  if (isImageFile(file)) {
    const maxDim = folder === 'profile-photo' ? 560 : 880;
    const maxChars = folder === 'profile-photo' ? 120000 : 145000;
    const dataUrl = await compressImageToDataUrl(file, maxDim, maxChars);
    onProgress?.(100);
    return {
      downloadUrl: dataUrl,
      storagePath: '',
      fileName: file.name,
      fileSize: Math.round((dataUrl.length * 3) / 4),
      storedInline: true,
    };
  }

  if (file.size > MAX_CHUNKED_DOC_BYTES) {
    throw new Error(
      `Ukuran berkas maksimal 7 MB saat disimpan di database (file Anda ${(file.size / (1024 * 1024)).toFixed(1)} MB). Kompres berkas atau tempel URL Google Drive/HTTPS.`
    );
  }

  const dataUrl = await readFileAsDataUrl(file);
  if (file.size <= MAX_INLINE_SINGLE_DOC_BYTES && dataUrl.length <= 200000) {
    onProgress?.(100);
    return {
      downloadUrl: dataUrl,
      storagePath: '',
      fileName: file.name,
      fileSize: file.size,
      storedInline: true,
    };
  }

  return uploadChunkedBlobToFirestore(uid, file, dataUrl, onProgress);
}

function mapStorageError(error: unknown): string {
  const code = (error as { code?: string })?.code || '';
  const msg = error instanceof Error ? error.message : String(error);

  if (code === 'storage/unauthorized') {
    return 'Izin unggah Firebase Storage ditolak. Pastikan storage.rules sudah diterapkan.';
  }
  if (code === 'storage/bucket-not-found' || code === 'storage/project-not-found') {
    return `Bucket Firebase Storage (${firebaseConfig.storageBucket}) belum diaktifkan di Firebase Console -> Storage.`;
  }
  if (code === 'storage/retry-limit-exceeded') {
    return 'Koneksi unggah ke Firebase Storage terputus (timeout).';
  }
  return msg || 'Gagal mengunggah berkas ke Firebase Storage.';
}

export async function uploadFileToStorage(
  folder: StorageFolder,
  uid: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadResult> {
  const bucketReady = await isStorageBucketAvailable();
  if (!bucketReady) {
    return createInlineFallback(folder, uid, file, onProgress);
  }

  const safeName = `${Date.now()}_${sanitizeFileName(file.name)}`;
  const storagePath = `${folder}/${uid}/${safeName}`;
  const storageRef = ref(storage, storagePath);

  try {
    const result = await new Promise<UploadResult>((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, file, {
        contentType: file.type || 'application/octet-stream',
      });

      const hardTimeout = window.setTimeout(() => {
        try {
          task.cancel();
        } catch {
          // ignore
        }
        reject(new Error('storage/retry-limit-exceeded'));
      }, 7000);

      task.on(
        'state_changed',
        (snapshot) => {
          if (onProgress && snapshot.totalBytes > 0) {
            const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            onProgress(pct);
          }
        },
        (error) => {
          window.clearTimeout(hardTimeout);
          reject(error);
        },
        async () => {
          window.clearTimeout(hardTimeout);
          try {
            const downloadUrl = await getDownloadURL(task.snapshot.ref);
            resolve({
              downloadUrl,
              storagePath,
              fileName: file.name,
              fileSize: file.size,
              storedInline: false,
            });
          } catch (err) {
            reject(err);
          }
        }
      );
    });
    return result;
  } catch (err) {
    const code = ((err as { code?: string })?.code || '').toLowerCase();
    const rawMsg = (err instanceof Error ? err.message : String(err)).toLowerCase();
    if (
      code === 'storage/unauthorized' ||
      code === 'storage/bucket-not-found' ||
      code === 'storage/project-not-found' ||
      code === 'storage/retry-limit-exceeded' ||
      rawMsg.includes('retry-limit-exceeded')
    ) {
      cachedBucketAvailable = false;
    }
    const msg = mapStorageError(err);
    console.warn('Storage upload unavailable, switching to Firestore fallback:', msg);
    return createInlineFallback(folder, uid, file, onProgress);
  }
}

export async function syncBlobVisibility(fileUrl: string, isPublic: boolean): Promise<void> {
  if (!fileUrl.startsWith('firestore-blob://')) return;
  const blobId = fileUrl.replace('firestore-blob://', '').trim();
  if (!blobId) return;
  try {
    await updateDoc(doc(db, 'fileBlobs', blobId), { isPublic });
  } catch {
    // Ignore if already deleted or unchanged
  }
}

export async function deleteStorageFile(storagePath?: string): Promise<void> {
  if (!storagePath) return;
  if (storagePath.startsWith('firestore-blob://')) {
    const blobId = storagePath.replace('firestore-blob://', '').trim();
    if (!blobId) return;
    BLOB_CACHE.delete(blobId);
    try {
      const parentRef = doc(db, 'fileBlobs', blobId);
      const snap = await getDoc(parentRef);
      if (snap.exists()) {
        const count = Number((snap.data() as { chunkCount?: number }).chunkCount || 0);
        await Promise.all(
          Array.from({ length: count }, (_, idx) =>
            deleteDoc(doc(db, 'fileBlobs', blobId, 'chunks', String(idx))).catch(() => undefined)
          )
        );
        await deleteDoc(parentRef).catch(() => undefined);
      }
    } catch (err) {
      console.warn('Blob delete warning:', err);
    }
    return;
  }

  try {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
  } catch (err) {
    console.warn('Storage delete warning:', err);
  }
}

function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

export function dataUrlToBlobUrl(dataUrl: string): string {
  if (!dataUrl.startsWith('data:')) return dataUrl;
  const parts = dataUrl.split(',');
  if (parts.length < 2) return dataUrl;
  const header = parts[0];
  const base64 = parts[1];
  const mimeMatch = header.match(/data:([^;]+)/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  return URL.createObjectURL(base64ToBlob(base64, mime));
}

export async function resolveStoredFileUrl(
  url: string
): Promise<{ resolvedUrl: string; isObjectUrl: boolean; mimeType?: string }> {
  if (!url) return { resolvedUrl: '', isObjectUrl: false };
  if (url.startsWith('data:')) {
    const header = url.split(',')[0] || '';
    const mimeMatch = header.match(/data:([^;]+)/);
    return {
      resolvedUrl: dataUrlToBlobUrl(url),
      isObjectUrl: true,
      mimeType: mimeMatch ? mimeMatch[1] : undefined,
    };
  }
  if (url.startsWith('firestore-blob://')) {
    const blobId = url.replace('firestore-blob://', '').trim();
    const cached = BLOB_CACHE.get(blobId);
    if (cached) {
      return {
        resolvedUrl: URL.createObjectURL(cached),
        isObjectUrl: true,
        mimeType: cached.type || undefined,
      };
    }
    const parentSnap = await getDoc(doc(db, 'fileBlobs', blobId));
    if (!parentSnap.exists()) {
      throw new Error('Berkas tidak ditemukan di database.');
    }
    const meta = parentSnap.data() as { chunkCount: number; mimeType?: string };
    const chunkSnaps = await Promise.all(
      Array.from({ length: meta.chunkCount }, (_, idx) =>
        getDoc(doc(db, 'fileBlobs', blobId, 'chunks', String(idx)))
      )
    );
    const fullBase64 = chunkSnaps
      .map((s) => (s.exists() ? String((s.data() as { data?: string }).data || '') : ''))
      .join('');
    if (!fullBase64) {
      throw new Error('Isi berkas kosong atau rusak.');
    }
    const mimeType = meta.mimeType || 'application/octet-stream';
    const blob = base64ToBlob(fullBase64, mimeType);
    BLOB_CACHE.set(blobId, blob);
    return { resolvedUrl: URL.createObjectURL(blob), isObjectUrl: true, mimeType };
  }
  return { resolvedUrl: url, isObjectUrl: false };
}

export async function openOrDownloadFile(
  url: string,
  fileName = 'berkas',
  mode: 'open' | 'download' = 'open'
): Promise<void> {
  if (!url) return;
  const { resolvedUrl, isObjectUrl } = await resolveStoredFileUrl(url);

  const a = document.createElement('a');
  a.href = resolvedUrl;
  if (mode === 'download' || url.startsWith('firestore-blob://')) {
    a.download = fileName;
  }
  if (!isObjectUrl || mode === 'open') {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  }
  document.body.appendChild(a);
  a.click();
  a.remove();

  if (isObjectUrl) {
    window.setTimeout(() => URL.revokeObjectURL(resolvedUrl), 60000);
  }
}
