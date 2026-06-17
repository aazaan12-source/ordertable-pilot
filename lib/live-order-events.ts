type Listener = () => void;

type LiveOrderBus = {
  listeners: Map<string, Set<Listener>>;
};

const globalForLiveOrders = globalThis as unknown as { ordertableLiveOrderBus?: LiveOrderBus };

function getBus() {
  if (!globalForLiveOrders.ordertableLiveOrderBus) {
    globalForLiveOrders.ordertableLiveOrderBus = {
      listeners: new Map()
    };
  }
  return globalForLiveOrders.ordertableLiveOrderBus;
}

export function emitLiveOrdersChanged(restaurantId: string) {
  const bus = getBus();
  const listeners = Array.from(bus.listeners.get(restaurantId) || []);
  queueMicrotask(() => {
    for (const listener of listeners) listener();
  });
}

export function onLiveOrdersChanged(restaurantId: string, listener: Listener) {
  const bus = getBus();
  const listeners = bus.listeners.get(restaurantId) || new Set<Listener>();
  listeners.add(listener);
  bus.listeners.set(restaurantId, listeners);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) bus.listeners.delete(restaurantId);
  };
}
