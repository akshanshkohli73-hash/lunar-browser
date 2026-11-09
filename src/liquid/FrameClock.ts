/** One browser RAF, multiplexed for graphics and existing finite dock/light settling. */
export class FrameClock {
  private frame = 0;
  private next = 1;
  private callbacks = new Map<number, FrameRequestCallback>();
  constructor(
    private request = (callback: FrameRequestCallback) =>
      requestAnimationFrame(callback),
    private cancel = (id: number) => cancelAnimationFrame(id),
  ) {}
  requestFrame = (callback: FrameRequestCallback): number => {
    const id = this.next++;
    this.callbacks.set(id, callback);
    if (!this.frame) this.frame = this.request(this.tick);
    return id;
  };
  cancelFrame = (id: number) => {
    this.callbacks.delete(id);
    if (!this.callbacks.size && this.frame) {
      this.cancel(this.frame);
      this.frame = 0;
    }
  };
  private tick = (time: number) => {
    this.frame = 0;
    const pending = [...this.callbacks.values()];
    this.callbacks.clear();
    for (const callback of pending) callback(time);
  };
  dispose() {
    if (this.frame) this.cancel(this.frame);
    this.frame = 0;
    this.callbacks.clear();
  }
}
