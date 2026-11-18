import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { resolveStoredFileUrl } from '../lib/storageUpload';

export interface FilePreviewModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  description?: string;
  fileUrl: string;
  fileName?: string;
  fileType?: string;
  onClose: () => void;
  onNotify?: (type: 'success' | 'error' | 'info', message: string) => void;
}

function getCleanPathFromUrl(url: string): string {
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return new URL(url).pathname;
    }
  } catch {
    // ignore malformed URL
  }
  return url.split('#')[0].split('?')[0];
}

function getGoogleDriveEmbedUrl(url: string): string | null {
  if (!url.includes('drive.google.com')) return null;
  const fileIdMatch =
    url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (!fileIdMatch?.[1]) return null;
  return `https://drive.google.com/file/d/${fileIdMatch[1]}/preview`;
}

function isImageResource(mimeType: string, fileType?: string, fileName?: string, fileUrl?: string): boolean {
  if (mimeType.startsWith('image/')) return true;
  if (fileUrl?.startsWith('data:image/')) return true;
  const upperType = (fileType || '').toUpperCase();
  if (['JPG', 'JPEG', 'PNG', 'WEBP', 'GIF'].includes(upperType)) return true;
  if (fileName && /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(fileName)) return true;
  if (fileUrl && /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(getCleanPathFromUrl(fileUrl))) return true;
  return false;
}

function isPdfResource(mimeType: string, fileType?: string, fileName?: string, fileUrl?: string): boolean {
  if (mimeType === 'application/pdf') return true;
  if (fileUrl?.startsWith('data:application/pdf')) return true;
  if ((fileType || '').toUpperCase() === 'PDF') return true;
  if (fileName && /\.pdf$/i.test(fileName)) return true;
  if (fileUrl && /\.pdf$/i.test(getCleanPathFromUrl(fileUrl))) return true;
  return false;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  open,
  title,
  subtitle,
  description,
  fileUrl,
  fileName,
  fileType,
  onClose,
  onNotify,
}) => {
  const [resolvedUrl, setResolvedUrl] = useState('');
  const [mimeType, setMimeType] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [detectedPdfByMagic, setDetectedPdfByMagic] = useState(false);

  // PDF canvas rendering state
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pdfRenderError, setPdfRenderError] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [zoom, setZoom] = useState(1);

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const onNotifyRef = useRef(onNotify);
  onNotifyRef.current = onNotify;

  // Lock background scroll and close on Escape while open
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  // Resolve stored file URL (data:, firestore-blob://, or https://)
  useEffect(() => {
    if (!open) {
      setResolvedUrl('');
      setMimeType('');
      setLoadError('');
      setDetectedPdfByMagic(false);
      setPdfDoc(null);
      setNumPages(0);
      setPdfRenderError('');
      setZoom(1);
      return;
    }

    if (!fileUrl) {
      setLoadError('Tautan atau berkas pratinjau tidak tersedia.');
      setLoading(false);
      return;
    }

    let active = true;
    let revokeUrl = '';
    setLoading(true);
    setLoadError('');
    setDetectedPdfByMagic(false);
    setPdfDoc(null);
    setNumPages(0);
    setPdfRenderError('');

    resolveStoredFileUrl(fileUrl)
      .then(async ({ resolvedUrl: nextUrl, isObjectUrl, mimeType: nextMime }) => {
        if (!active) {
          if (isObjectUrl && nextUrl) URL.revokeObjectURL(nextUrl);
          return;
        }
        if (isObjectUrl) revokeUrl = nextUrl;

        let resolvedMime = nextMime || '';
        let magicIsPdf = false;
        if (isObjectUrl && nextUrl && (!resolvedMime || resolvedMime === 'application/octet-stream')) {
          try {
            const headResp = await fetch(nextUrl);
            const slice = await headResp.arrayBuffer();
            const headerBytes = new Uint8Array(slice.slice(0, 5));
            const magic = String.fromCharCode(...headerBytes);
            if (magic === '%PDF-') {
              magicIsPdf = true;
              resolvedMime = 'application/pdf';
            }
          } catch {
            // ignore header sniff errors
          }
        }

        if (!active) return;
        setResolvedUrl(nextUrl);
        setMimeType(resolvedMime);
        setDetectedPdfByMagic(magicIsPdf);
      })
      .catch((err: unknown) => {
        if (!active) return;
        const msg = err instanceof Error ? err.message : 'Gagal memuat pratinjau berkas.';
        setLoadError(msg);
        onNotifyRef.current?.('error', msg);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (revokeUrl) URL.revokeObjectURL(revokeUrl);
    };
  }, [open, fileUrl]);

  const driveEmbedUrl = getGoogleDriveEmbedUrl(resolvedUrl || fileUrl);
  const isImage = !detectedPdfByMagic && isImageResource(mimeType, fileType, fileName, fileUrl);
  const isPdf = !isImage && (detectedPdfByMagic || isPdfResource(mimeType, fileType, fileName, fileUrl));

  // Load PDF into pdf.js so it renders crisply on mobile Chrome & iOS Safari without iframe plugins
  useEffect(() => {
    if (!open || !resolvedUrl || !isPdf || driveEmbedUrl) {
      setPdfDoc(null);
      setNumPages(0);
      setPdfLoading(false);
      return;
    }

    let active = true;
    let loadingTask: PDFDocumentLoadingTask | null = null;
    setPdfLoading(true);
    setPdfRenderError('');

    Promise.all([
      import('pdfjs-dist'),
      fetch(resolvedUrl).then((resp) => {
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.arrayBuffer();
      }),
    ])
      .then(([pdfjsLib, buf]) => {
        if (!active) return null;
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buf) });
        return loadingTask.promise;
      })
      .then((doc) => {
        if (!active || !doc) {
          loadingTask?.destroy().catch(() => undefined);
          return;
        }
        setPdfDoc(doc);
        setNumPages(doc.numPages);
      })
      .catch(() => {
        if (!active) return;
        // Fallback if external HTTPS URL blocks CORS
        setPdfRenderError('Pratinjau langsung PDF terhalang CORS dari sumber eksternal.');
      })
      .finally(() => {
        if (active) setPdfLoading(false);
      });

    return () => {
      active = false;
      if (loadingTask) {
        loadingTask.destroy().catch(() => undefined);
      }
    };
  }, [open, resolvedUrl, isPdf, driveEmbedUrl]);

  // Render all PDF pages to responsive high-DPI canvas elements
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!pdfDoc || !container) return;

    let cancelled = false;
    container.innerHTML = '';

    const renderPages = async () => {
      const maxRenderPages = Math.min(pdfDoc.numPages, 25);
      const containerWidth = Math.max(container.clientWidth - 16, 260);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      for (let pageNum = 1; pageNum <= maxRenderPages; pageNum++) {
        if (cancelled) break;
        const page = await pdfDoc.getPage(pageNum);
        if (cancelled) break;

        const baseViewport = page.getViewport({ scale: 1 });
        const fitScale = (containerWidth / baseViewport.width) * zoom;
        const viewport = page.getViewport({ scale: fitScale });

        const pageWrap = document.createElement('div');
        pageWrap.className =
          'mx-auto overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800';
        pageWrap.style.width = `${Math.floor(viewport.width)}px`;
        pageWrap.style.maxWidth = '100%';

        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        canvas.style.display = 'block';
        canvas.style.maxWidth = '100%';
        canvas.style.height = 'auto';

        pageWrap.appendChild(canvas);
        container.appendChild(pageWrap);

        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        await page.render({
          canvas,
          canvasContext: ctx,
          viewport,
        }).promise;
      }

      if (pdfDoc.numPages > maxRenderPages && !cancelled) {
        const notice = document.createElement('p');
        notice.className = 'text-center text-xs text-slate-500 dark:text-slate-400 py-2';
        notice.textContent = `Menampilkan ${maxRenderPages} dari ${pdfDoc.numPages} halaman. Unduh berkas untuk melihat seluruh halaman.`;
        container.appendChild(notice);
      }
    };

    renderPages().catch(() => {
      if (!cancelled) {
        setPdfRenderError('PDF tidak dapat dirender langsung di browser ini.');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, zoom]);

  if (!open) return null;

  const safeDownloadName = fileName || `${title.replace(/[^\w.-]+/g, '_') || 'berkas'}${isPdf ? '.pdf' : ''}`;
  const effectiveHref = resolvedUrl || fileUrl;
  const externalHttpUrl =
    effectiveHref.startsWith('http://') || effectiveHref.startsWith('https://')
      ? effectiveHref
      : '';

  const modalNode = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Pratinjau ${title}`}
      className="no-print fixed inset-0 z-[9999] flex items-end justify-center bg-slate-950/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:h-auto sm:max-h-[92dvh] sm:rounded-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3.5 py-3 sm:px-5 sm:py-4 dark:border-slate-800">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-bold text-slate-900 dark:text-white">
              {title}
            </h3>
            {subtitle && (
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {subtitle}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {effectiveHref && !loading && (
              <>
                <a
                  href={effectiveHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  title="Buka di tab baru"
                >
                  <i className="fa-solid fa-up-right-from-square" aria-hidden="true" />
                  <span className="hidden sm:inline">Buka Penuh</span>
                </a>
                <a
                  href={effectiveHref}
                  download={safeDownloadName}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <i className="fa-solid fa-download" aria-hidden="true" />
                  <span>Unduh</span>
                </a>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Tutup pratinjau"
            >
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Scrollable Preview Body */}
        <div className="flex-1 overflow-y-auto bg-slate-50 p-3 sm:p-5 dark:bg-slate-950">
          {loading ? (
            <div className="flex h-[50dvh] flex-col items-center justify-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
              <span>Memuat berkas untuk pratinjau...</span>
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-200">
              <i className="fa-solid fa-triangle-exclamation text-2xl" aria-hidden="true" />
              <p className="mt-2 font-semibold">Pratinjau tidak dapat dimuat</p>
              <p className="mt-1">{loadError}</p>
            </div>
          ) : isImage ? (
            <div className="flex flex-col items-center justify-center">
              <img
                src={effectiveHref}
                alt={title}
                referrerPolicy="no-referrer"
                className="max-h-[70dvh] w-full rounded-xl bg-white object-contain p-1 shadow-sm dark:bg-slate-900"
              />
            </div>
          ) : driveEmbedUrl ? (
            <div className="space-y-3">
              <iframe
                title={title}
                src={driveEmbedUrl}
                className="h-[62dvh] w-full rounded-xl border border-slate-200 bg-white dark:border-slate-800"
                allow="autoplay"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-900">
                <span className="text-slate-600 dark:text-slate-300">
                  Tautan Google Drive terdeteksi.
                </span>
                <a
                  href={effectiveHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-700"
                >
                  Buka di Google Drive
                </a>
              </div>
            </div>
          ) : isPdf ? (
            <div className="space-y-3">
              {pdfDoc && (
                <div className="sticky top-0 z-10 flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-xs backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95">
                  <span className="font-mono-tabular font-semibold text-slate-700 dark:text-slate-200">
                    {numPages} Halaman
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setZoom((z) => Math.max(0.75, Number((z - 0.25).toFixed(2))))}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      aria-label="Perkecil"
                    >
                      <i className="fa-solid fa-minus text-[10px]" aria-hidden="true" />
                    </button>
                    <span className="min-w-[46px] text-center font-mono-tabular text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {Math.round(zoom * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setZoom((z) => Math.min(2.25, Number((z + 0.25).toFixed(2))))}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      aria-label="Perbesar"
                    >
                      <i className="fa-solid fa-plus text-[10px]" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}

              {pdfLoading && !pdfDoc && (
                <div className="flex h-[46dvh] flex-col items-center justify-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
                  <span>Merender halaman PDF...</span>
                </div>
              )}

              <div ref={canvasContainerRef} className="space-y-3 overflow-x-auto" />

              {pdfRenderError && (
                <div className="space-y-3">
                  <iframe
                    title={title}
                    src={
                      externalHttpUrl
                        ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(externalHttpUrl)}`
                        : effectiveHref
                    }
                    className="h-[52dvh] w-full rounded-xl border border-slate-200 bg-white dark:border-slate-800"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-900">
                    <span className="text-slate-600 dark:text-slate-300">
                      Gunakan tombol berikut jika sumber eksternal membatasi pratinjau langsung:
                    </span>
                    <div className="flex items-center gap-2">
                      <a
                        href={effectiveHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        Buka PDF
                      </a>
                      <a
                        href={effectiveHref}
                        download={safeDownloadName}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-700"
                      >
                        Unduh
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : externalHttpUrl ? (
            <div className="space-y-3">
              <iframe
                title={title}
                src={`https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(externalHttpUrl)}`}
                className="h-[54dvh] w-full rounded-xl border border-slate-200 bg-white dark:border-slate-800"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-900">
                <span className="text-slate-600 dark:text-slate-300">
                  Berkas {fileType || 'dokumen'} ({fileName || title})
                </span>
                <div className="flex items-center gap-2">
                  <a
                    href={effectiveHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                  >
                    Buka Asli
                  </a>
                  <a
                    href={effectiveHref}
                    download={safeDownloadName}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-700"
                  >
                    Unduh
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center sm:p-8 dark:border-slate-800 dark:bg-slate-900">
              <i className="fa-solid fa-file-lines text-4xl text-blue-600" aria-hidden="true" />
              <p className="mt-3 break-words text-sm font-semibold text-slate-900 dark:text-white">
                {fileName || title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Format berkas {fileType || 'dokumen'} perlu dibuka atau diunduh ke perangkat HP Anda untuk melihat isinya.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <a
                  href={effectiveHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <i className="fa-solid fa-up-right-from-square" aria-hidden="true" />
                  <span>Buka di Aplikasi HP</span>
                </a>
                <a
                  href={effectiveHref}
                  download={safeDownloadName}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <i className="fa-solid fa-download" aria-hidden="true" />
                  <span>Unduh Berkas</span>
                </a>
              </div>
            </div>
          )}

          {description && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3.5 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              {description}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
};
