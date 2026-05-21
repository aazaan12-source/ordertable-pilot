export type DemoOrderStatus = "PENDING" | "ACCEPTED" | "PREPARING" | "READY" | "SERVED" | "BILL_REQUESTED" | "PAID" | "CANCELLED";

export type DemoOrderItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  note?: string;
};

export type DemoOrder = {
  id: string;
  orderNumber: string;
  tableNumber: number;
  source: "Customer QR" | "Waiter Assisted";
  customerName?: string;
  waiterName?: string;
  status: DemoOrderStatus;
  paymentStatus: "UNPAID" | "PAID";
  items: DemoOrderItem[];
  total: number;
  createdAt: string;
};

export type DemoRequest = {
  id: string;
  tableNumber: number;
  type: "CALL_WAITER" | "BILL_REQUEST";
  status: "PENDING" | "RESOLVED";
  createdAt: string;
};

export type DemoState = {
  orders: DemoOrder[];
  requests: DemoRequest[];
};

export const demoMenuItems = [
  {
    id: "zinger-burger",
    name: "Zinger Burger",
    category: "Burgers",
    description: "Crispy chicken fillet, lettuce, house sauce, soft bun.",
    price: 650,
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "chicken-karahi",
    name: "Chicken Karahi",
    category: "Karahi",
    description: "Fresh tomato gravy, ginger, green chilli, served hot.",
    price: 1800,
    image: "https://images.pexels.com/photos/12737913/pexels-photo-12737913.jpeg?auto=compress&cs=tinysrgb&w=800"
  },
  {
    id: "chicken-pulao",
    name: "Chicken Pulao",
    category: "Rice",
    description: "Fragrant rice, chicken piece, raita and salad style serving.",
    price: 520,
    image: "https://images.pexels.com/photos/12737916/pexels-photo-12737916.jpeg?auto=compress&cs=tinysrgb&w=800"
  },
  {
    id: "mint-margarita",
    name: "Mint Margarita",
    category: "Drinks",
    description: "Cold mint lemon drink for dine-in service.",
    price: 350,
    image: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "kheer-cup",
    name: "Kheer Cup",
    category: "Desserts",
    description: "Creamy rice dessert served chilled after the meal.",
    price: 260,
    image: "https://images.pexels.com/photos/3026808/pexels-photo-3026808.jpeg?auto=compress&cs=tinysrgb&w=800"
  }
];

export const demoCategories = ["Burgers", "Karahi", "Rice", "Drinks", "Desserts"];

export const demoStatuses: DemoOrderStatus[] = ["PENDING", "ACCEPTED", "PREPARING", "READY", "SERVED", "BILL_REQUESTED", "PAID", "CANCELLED"];

export const demoStatusLabels: Record<DemoOrderStatus, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  READY: "Ready",
  SERVED: "Served",
  BILL_REQUESTED: "Bill Requested",
  PAID: "Paid",
  CANCELLED: "Cancelled"
};

export const demoStatusActions: Partial<Record<DemoOrderStatus, { label: string; next: DemoOrderStatus; tone?: "danger" | "success" }[]>> = {
  PENDING: [
    { label: "Accept", next: "ACCEPTED" },
    { label: "Cancel", next: "CANCELLED", tone: "danger" }
  ],
  ACCEPTED: [{ label: "Start Preparing", next: "PREPARING" }],
  PREPARING: [{ label: "Mark Ready", next: "READY" }],
  READY: [{ label: "Mark Served", next: "SERVED" }],
  SERVED: [
    { label: "Ask Bill", next: "BILL_REQUESTED" },
    { label: "Mark Paid", next: "PAID", tone: "success" }
  ],
  BILL_REQUESTED: [{ label: "Mark Paid", next: "PAID", tone: "success" }]
};

const eventName = "ordertable-demo-state";

export function demoStateKey(session: string) {
  return `ordertable_demo_simulation_${session || "public-demo"}`;
}

export function emptyDemoState(): DemoState {
  return { orders: [], requests: [] };
}

export function loadDemoState(session: string): DemoState {
  if (typeof window === "undefined") return emptyDemoState();
  try {
    const raw = window.localStorage.getItem(demoStateKey(session));
    if (!raw) return emptyDemoState();
    const parsed = JSON.parse(raw) as DemoState;
    return {
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      requests: Array.isArray(parsed.requests) ? parsed.requests : []
    };
  } catch {
    return emptyDemoState();
  }
}

export function saveDemoState(session: string, state: DemoState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(demoStateKey(session), JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(eventName, { detail: { session } }));
  try {
    const channel = new BroadcastChannel(eventName);
    channel.postMessage({ session });
    channel.close();
  } catch {
    // BroadcastChannel is not required; localStorage events still keep same-browser tabs useful.
  }
}

export function listenDemoState(session: string, callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const onLocal = (event: Event) => {
    if (event instanceof CustomEvent && event.detail?.session === session) callback();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === demoStateKey(session)) callback();
  };
  window.addEventListener(eventName, onLocal);
  window.addEventListener("storage", onStorage);
  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(eventName);
    channel.onmessage = (event) => {
      if (event.data?.session === session) callback();
    };
  } catch {
    channel = null;
  }
  return () => {
    window.removeEventListener(eventName, onLocal);
    window.removeEventListener("storage", onStorage);
    channel?.close();
  };
}

export function demoOrderNumber(tableNumber: number, orderCount: number) {
  return `DEMO-T${tableNumber}-${String(orderCount + 1).padStart(3, "0")}`;
}
