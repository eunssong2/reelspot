const listeners = new Set<() => void>();

export function subscribeUploadQueue(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function notifyUploadQueue() {
  listeners.forEach((listener) => listener());
}
