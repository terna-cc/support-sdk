import { describe, it, expect } from 'vitest';
import { RingBuffer } from './ring-buffer';

describe('RingBuffer', () => {
  it('stores and retrieves items in insertion order', () => {
    const buf = new RingBuffer<number>(5);
    buf.push(1);
    buf.push(2);
    buf.push(3);

    expect(buf.getAll()).toEqual([1, 2, 3]);
  });

  it('reports correct size and capacity', () => {
    const buf = new RingBuffer<string>(3);
    expect(buf.size).toBe(0);
    expect(buf.capacity).toBe(3);

    buf.push('a');
    buf.push('b');
    expect(buf.size).toBe(2);
  });

  it('evicts oldest items when capacity is exceeded', () => {
    const buf = new RingBuffer<number>(3);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    buf.push(4);

    expect(buf.getAll()).toEqual([2, 3, 4]);
    expect(buf.size).toBe(3);
  });

  it('continues evicting correctly over multiple wraps', () => {
    const buf = new RingBuffer<number>(2);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    buf.push(4);
    buf.push(5);

    expect(buf.getAll()).toEqual([4, 5]);
  });

  it('clears the buffer', () => {
    const buf = new RingBuffer<number>(3);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    buf.clear();

    expect(buf.getAll()).toEqual([]);
    expect(buf.size).toBe(0);
  });

  it('works after clear + re-push', () => {
    const buf = new RingBuffer<number>(2);
    buf.push(1);
    buf.push(2);
    buf.clear();
    buf.push(3);

    expect(buf.getAll()).toEqual([3]);
    expect(buf.size).toBe(1);
  });

  it('freeze returns an independent snapshot', () => {
    const buf = new RingBuffer<number>(3);
    buf.push(1);
    buf.push(2);

    const snapshot = buf.freeze();
    buf.push(3);
    buf.push(4);

    expect(snapshot).toEqual([1, 2]);
    expect(buf.getAll()).toEqual([2, 3, 4]);
  });

  it('handles capacity of 0', () => {
    const buf = new RingBuffer<number>(0);
    buf.push(1);
    buf.push(2);

    expect(buf.getAll()).toEqual([]);
    expect(buf.size).toBe(0);
    expect(buf.capacity).toBe(0);
  });

  it('handles capacity of 1', () => {
    const buf = new RingBuffer<string>(1);
    buf.push('a');
    expect(buf.getAll()).toEqual(['a']);

    buf.push('b');
    expect(buf.getAll()).toEqual(['b']);
    expect(buf.size).toBe(1);
  });

  it('throws on negative capacity', () => {
    expect(() => new RingBuffer<number>(-1)).toThrow(
      'RingBuffer capacity must be non-negative',
    );
  });

  it('returns empty array when buffer is empty', () => {
    const buf = new RingBuffer<number>(5);
    expect(buf.getAll()).toEqual([]);
    expect(buf.freeze()).toEqual([]);
  });
});
