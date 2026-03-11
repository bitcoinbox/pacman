export default class EventBus {
  constructor() {
    this._listeners = {};
  }

  on(event, fn) {
    (this._listeners[event] ||= []).push(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    const list = this._listeners[event];
    if (!list) return;
    if (fn) {
      this._listeners[event] = list.filter(f => f !== fn);
    } else {
      delete this._listeners[event];
    }
  }

  emit(event, ...args) {
    const list = this._listeners[event];
    if (list) list.forEach(fn => fn(...args));
  }

  clear() {
    this._listeners = {};
  }
}
