export interface SyncEvent {
  table: string;
  op: "set" | "delete";
  data: unknown;
  seq: number;
}

type Subscriber = (event: SyncEvent) => void;

const DEFAULT_BUFFER_SIZE = 1000;

export class EventBus {
  private _seq = 0;
  private buffer: SyncEvent[] = [];
  private bufferSize: number;
  private subscribers = new Set<Subscriber>();

  constructor(options?: { bufferSize?: number }) {
    this.bufferSize = options?.bufferSize ?? DEFAULT_BUFFER_SIZE;
  }

  get seq() {
    return this._seq;
  }

  emit(table: string, op: "set" | "delete", data: unknown) {
    this._seq++;
    const event: SyncEvent = { table, op, data, seq: this._seq };

    this.buffer.push(event);
    if (this.buffer.length > this.bufferSize) {
      this.buffer.shift();
    }

    for (const cb of this.subscribers) {
      cb(event);
    }
  }

  subscribe(cb: Subscriber) {
    this.subscribers.add(cb);
    return () => {
      this.subscribers.delete(cb);
    };
  }

  getSince(seq: number) {
    return this.buffer.filter((e) => e.seq > seq);
  }
}
