import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createAttachmentManager,
  formatFileSize,
  DEFAULT_ALLOWED_TYPES,
} from '../attachment-manager';

// Mock URL.createObjectURL and revokeObjectURL
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

beforeEach(() => {
  URL.createObjectURL = vi.fn((blob: Blob) => `blob:mock-url-${blob.size}`);
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
});

function createMockFile(
  name: string,
  size: number,
  type: string,
): File {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name, { type });
}

describe('createAttachmentManager', () => {
  describe('add()', () => {
    it('adds valid files and returns them', () => {
      const manager = createAttachmentManager();
      const file = createMockFile('test.png', 1024, 'image/png');

      const result = manager.add([file]);

      expect(result.added).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      expect(result.added[0].name).toBe('test.png');
      expect(result.added[0].size).toBe(1024);
      expect(result.added[0].type).toBe('image/png');
      expect(result.added[0].id).toBeTruthy();
    });

    it('adds multiple files at once', () => {
      const manager = createAttachmentManager();
      const files = [
        createMockFile('a.png', 100, 'image/png'),
        createMockFile('b.pdf', 200, 'application/pdf'),
        createMockFile('c.txt', 300, 'text/plain'),
      ];

      const result = manager.add(files);

      expect(result.added).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
      expect(manager.getAll()).toHaveLength(3);
    });

    it('creates preview URL for image files', () => {
      const manager = createAttachmentManager();
      const file = createMockFile('photo.jpg', 1024, 'image/jpeg');

      const result = manager.add([file]);

      expect(result.added[0].previewUrl).toBeDefined();
      expect(URL.createObjectURL).toHaveBeenCalledWith(file);
    });

    it('does not create preview URL for non-image files', () => {
      const manager = createAttachmentManager();
      const file = createMockFile('doc.pdf', 1024, 'application/pdf');

      const result = manager.add([file]);

      expect(result.added[0].previewUrl).toBeUndefined();
    });

    it('rejects files exceeding max file size', () => {
      const manager = createAttachmentManager({
        maxFileSize: 1024,
      });
      const file = createMockFile('big.png', 2048, 'image/png');

      const result = manager.add([file]);

      expect(result.added).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].reason).toContain('File too large');
    });

    it('rejects files with disallowed MIME types', () => {
      const manager = createAttachmentManager();
      const file = createMockFile('script.js', 100, 'application/javascript');

      const result = manager.add([file]);

      expect(result.added).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].reason).toContain('not allowed');
    });

    it('rejects files when max file count is reached', () => {
      const manager = createAttachmentManager({ maxFiles: 2 });
      const files = [
        createMockFile('a.png', 100, 'image/png'),
        createMockFile('b.png', 100, 'image/png'),
        createMockFile('c.png', 100, 'image/png'),
      ];

      const result = manager.add(files);

      expect(result.added).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].reason).toContain('Maximum 2 files');
    });

    it('rejects files when total size exceeds max total size', () => {
      const manager = createAttachmentManager({
        maxTotalSize: 500,
      });

      const result1 = manager.add([
        createMockFile('a.png', 400, 'image/png'),
      ]);
      expect(result1.added).toHaveLength(1);

      const result2 = manager.add([
        createMockFile('b.png', 200, 'image/png'),
      ]);
      expect(result2.added).toHaveLength(0);
      expect(result2.errors).toHaveLength(1);
      expect(result2.errors[0].reason).toContain('Total attachment size');
    });

    it('allows custom allowed types', () => {
      const manager = createAttachmentManager({
        allowedTypes: ['application/javascript'],
      });
      const file = createMockFile('app.js', 100, 'application/javascript');

      const result = manager.add([file]);

      expect(result.added).toHaveLength(1);
    });

    it('handles FileList input', () => {
      const manager = createAttachmentManager();
      const file = createMockFile('test.png', 100, 'image/png');

      // Create a mock FileList
      const fileList = {
        length: 1,
        0: file,
        item: (i: number) => (i === 0 ? file : null),
        [Symbol.iterator]: function* () {
          yield file;
        },
      } as unknown as FileList;

      const result = manager.add(fileList);
      expect(result.added).toHaveLength(1);
    });
  });

  describe('remove()', () => {
    it('removes a file by ID', () => {
      const manager = createAttachmentManager();
      const file = createMockFile('test.png', 100, 'image/png');
      const { added } = manager.add([file]);

      expect(manager.getAll()).toHaveLength(1);

      manager.remove(added[0].id);

      expect(manager.getAll()).toHaveLength(0);
    });

    it('revokes preview URL when removing image', () => {
      const manager = createAttachmentManager();
      const file = createMockFile('photo.jpg', 100, 'image/jpeg');
      const { added } = manager.add([file]);

      const previewUrl = added[0].previewUrl;
      manager.remove(added[0].id);

      expect(URL.revokeObjectURL).toHaveBeenCalledWith(previewUrl);
    });

    it('is a no-op for unknown IDs', () => {
      const manager = createAttachmentManager();
      manager.add([createMockFile('test.png', 100, 'image/png')]);

      manager.remove('nonexistent-id');

      expect(manager.getAll()).toHaveLength(1);
    });
  });

  describe('getAll()', () => {
    it('returns a copy of attachments', () => {
      const manager = createAttachmentManager();
      manager.add([createMockFile('test.png', 100, 'image/png')]);

      const all = manager.getAll();
      all.push({
        id: 'fake',
        file: createMockFile('fake.png', 1, 'image/png'),
        name: 'fake.png',
        size: 1,
        type: 'image/png',
      });

      expect(manager.getAll()).toHaveLength(1);
    });
  });

  describe('clear()', () => {
    it('removes all attachments', () => {
      const manager = createAttachmentManager();
      manager.add([
        createMockFile('a.png', 100, 'image/png'),
        createMockFile('b.png', 100, 'image/png'),
      ]);

      expect(manager.getAll()).toHaveLength(2);

      manager.clear();

      expect(manager.getAll()).toHaveLength(0);
    });

    it('revokes all preview URLs', () => {
      const manager = createAttachmentManager();
      manager.add([
        createMockFile('a.jpg', 100, 'image/jpeg'),
        createMockFile('b.jpg', 100, 'image/jpeg'),
      ]);

      manager.clear();

      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    });
  });

  describe('getTotalSize()', () => {
    it('returns 0 when empty', () => {
      const manager = createAttachmentManager();
      expect(manager.getTotalSize()).toBe(0);
    });

    it('returns sum of all file sizes', () => {
      const manager = createAttachmentManager();
      manager.add([
        createMockFile('a.png', 100, 'image/png'),
        createMockFile('b.png', 250, 'image/png'),
      ]);

      expect(manager.getTotalSize()).toBe(350);
    });

    it('updates after removal', () => {
      const manager = createAttachmentManager();
      const { added } = manager.add([
        createMockFile('a.png', 100, 'image/png'),
        createMockFile('b.png', 250, 'image/png'),
      ]);

      manager.remove(added[0].id);

      expect(manager.getTotalSize()).toBe(250);
    });
  });

  describe('destroy()', () => {
    it('clears all attachments and revokes URLs', () => {
      const manager = createAttachmentManager();
      manager.add([
        createMockFile('a.jpg', 100, 'image/jpeg'),
        createMockFile('b.png', 100, 'image/png'),
      ]);

      manager.destroy();

      expect(manager.getAll()).toHaveLength(0);
      expect(URL.revokeObjectURL).toHaveBeenCalled();
    });
  });

  describe('default config', () => {
    it('uses default max files of 5', () => {
      const manager = createAttachmentManager();

      for (let i = 0; i < 5; i++) {
        manager.add([createMockFile(`f${i}.png`, 100, 'image/png')]);
      }
      expect(manager.getAll()).toHaveLength(5);

      const result = manager.add([
        createMockFile('overflow.png', 100, 'image/png'),
      ]);
      expect(result.errors).toHaveLength(1);
    });

    it('uses default max file size of 5MB', () => {
      const manager = createAttachmentManager();
      const oversized = createMockFile(
        'big.png',
        5 * 1024 * 1024 + 1,
        'image/png',
      );

      const result = manager.add([oversized]);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].reason).toContain('File too large');
    });

    it('uses default max total size of 10MB', () => {
      const manager = createAttachmentManager();
      // Add two files that together exceed 10MB
      manager.add([createMockFile('a.png', 5 * 1024 * 1024, 'image/png')]);
      manager.add([createMockFile('b.png', 5 * 1024 * 1024, 'image/png')]);
      // Total is exactly 10MB — adding one more byte should fail
      const result = manager.add([
        createMockFile('c.png', 1, 'image/png'),
      ]);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].reason).toContain('Total attachment size');
    });

    it('allows all default MIME types', () => {
      // Use a large maxFiles so we can test all types
      const manager = createAttachmentManager({
        maxFiles: DEFAULT_ALLOWED_TYPES.length,
      });

      for (const type of DEFAULT_ALLOWED_TYPES) {
        const ext = type.split('/')[1] || 'dat';
        const result = manager.add([
          createMockFile(`test.${ext}`, 100, type),
        ]);
        expect(result.errors).toHaveLength(0);
      }
    });
  });
});

describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500B');
  });

  it('formats kilobytes', () => {
    expect(formatFileSize(12000)).toBe('12KB');
  });

  it('formats megabytes', () => {
    expect(formatFileSize(1.2 * 1024 * 1024)).toBe('1.2MB');
  });

  it('formats exact 1KB', () => {
    expect(formatFileSize(1024)).toBe('1KB');
  });
});
