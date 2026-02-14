export class RingBuffer<T> {
  private buffer: (T | undefined)[];
  private head = 0;
  private count = 0;
  private readonly cap: number;

  constructor(capacity: number) {
    if (capacity < 0) {
      throw new Error('RingBuffer capacity must be non-negative');
    }
    this.cap = capacity;
    this.buffer = new Array(capacity);
  }

  push(item: T): void {
    if (this.cap === 0) return;
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.cap;
    if (this.count < this.cap) {
      this.count++;
    }
  }

  getAll(): T[] {
    if (this.count === 0) return [];

    const result: T[] = [];
    const start =
      this.count < this.cap
        ? 0
        : this.head; // head points to oldest when full

    for (let i = 0; i < this.count; i++) {
      const index = (start + i) % this.cap;
      result.push(this.buffer[index] as T);
    }

    return result;
  }

  clear(): void {
    this.buffer = new Array(this.cap);
    this.head = 0;
    this.count = 0;
  }

  freeze(): T[] {
    return [...this.getAll()];
  }

  get size(): number {
    return this.count;
  }

  get capacity(): number {
    return this.cap;
  }
}
