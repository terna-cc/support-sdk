// ─── Types ──────────────────────────────────────────────────────────

export interface Attachment {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  previewUrl?: string;
}

export interface AttachmentValidationError {
  file: File;
  reason: string;
}

export interface AddResult {
  added: Attachment[];
  errors: AttachmentValidationError[];
}

export interface AttachmentConfig {
  enabled?: boolean;
  maxFiles?: number;
  maxFileSize?: number;
  maxTotalSize?: number;
  allowedTypes?: string[];
}

export interface AttachmentManager {
  add(files: FileList | File[]): AddResult;
  remove(id: string): void;
  getAll(): Attachment[];
  clear(): void;
  getTotalSize(): number;
  destroy(): void;
}

// ─── Defaults ───────────────────────────────────────────────────────

const DEFAULT_MAX_FILES = 5;
const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_MAX_TOTAL_SIZE = 10 * 1024 * 1024; // 10MB

export const DEFAULT_ALLOWED_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // Documents
  'application/pdf',
  'text/plain',
  'text/csv',
  // Logs
  'application/json',
  'text/xml',
];

// ─── Helpers ────────────────────────────────────────────────────────

let idCounter = 0;

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `attachment-${++idCounter}`;
}

function isImageType(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ─── Factory ────────────────────────────────────────────────────────

export function createAttachmentManager(
  config?: AttachmentConfig,
): AttachmentManager {
  const maxFiles = config?.maxFiles ?? DEFAULT_MAX_FILES;
  const maxFileSize = config?.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
  const maxTotalSize = config?.maxTotalSize ?? DEFAULT_MAX_TOTAL_SIZE;
  const allowedTypes = config?.allowedTypes ?? DEFAULT_ALLOWED_TYPES;

  const attachments: Attachment[] = [];

  function add(files: FileList | File[]): AddResult {
    const fileArray = Array.from(files);
    const added: Attachment[] = [];
    const errors: AttachmentValidationError[] = [];

    for (const file of fileArray) {
      // Check file count limit
      if (attachments.length + added.length >= maxFiles) {
        errors.push({
          file,
          reason: `Maximum ${maxFiles} files allowed`,
        });
        continue;
      }

      // Check file type
      if (!allowedTypes.includes(file.type)) {
        errors.push({
          file,
          reason: `File type "${file.type || 'unknown'}" is not allowed`,
        });
        continue;
      }

      // Check individual file size
      if (file.size > maxFileSize) {
        errors.push({
          file,
          reason: `File too large (max ${formatFileSize(maxFileSize)})`,
        });
        continue;
      }

      // Check total size
      const currentTotal =
        getTotalSize() + added.reduce((s, a) => s + a.size, 0);
      if (currentTotal + file.size > maxTotalSize) {
        errors.push({
          file,
          reason: `Total attachment size exceeds ${formatFileSize(maxTotalSize)}`,
        });
        continue;
      }

      const attachment: Attachment = {
        id: generateId(),
        file,
        name: file.name,
        size: file.size,
        type: file.type,
      };

      // Create preview URL for images
      if (isImageType(file.type)) {
        attachment.previewUrl = URL.createObjectURL(file);
      }

      added.push(attachment);
    }

    attachments.push(...added);
    return { added, errors };
  }

  function remove(id: string): void {
    const index = attachments.findIndex((a) => a.id === id);
    if (index === -1) return;

    const attachment = attachments[index];
    if (attachment.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl);
    }
    attachments.splice(index, 1);
  }

  function getAll(): Attachment[] {
    return [...attachments];
  }

  function clear(): void {
    for (const attachment of attachments) {
      if (attachment.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
      }
    }
    attachments.length = 0;
  }

  function getTotalSize(): number {
    return attachments.reduce((total, a) => total + a.size, 0);
  }

  function destroy(): void {
    clear();
  }

  return {
    add,
    remove,
    getAll,
    clear,
    getTotalSize,
    destroy,
  };
}
