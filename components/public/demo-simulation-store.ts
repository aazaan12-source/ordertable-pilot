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
  updatedAt?: string;
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
    id: "beef-burger",
    name: "Beef Burger",
    category: "Burgers",
    description: "Juicy beef patty, cheese, pickles, onion, and burger sauce.",
    price: 780,
    image: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "chicken-cheese-burger",
    name: "Chicken Cheese Burger",
    category: "Burgers",
    description: "Grilled chicken, melted cheese, lettuce, and creamy sauce.",
    price: 720,
    image: "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "double-patty-burger",
    name: "Double Patty Burger",
    category: "Burgers",
    description: "Two patties, double cheese, caramelized onion, and house sauce.",
    price: 980,
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "crispy-fish-burger",
    name: "Crispy Fish Burger",
    category: "Burgers",
    description: "Crispy fish fillet, tartar sauce, lettuce, and soft bun.",
    price: 760,
    image: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?auto=format&fit=crop&w=800&q=80"
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
    id: "half-chicken-karahi",
    name: "Half Chicken Karahi",
    category: "Karahi",
    description: "Half serving of chicken karahi with tomato gravy and spices.",
    price: 1150,
    image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "mutton-karahi",
    name: "Mutton Karahi",
    category: "Karahi",
    description: "Tender mutton cooked in traditional karahi masala.",
    price: 2600,
    image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "white-karahi",
    name: "White Karahi",
    category: "Karahi",
    description: "Creamy white karahi with green chilli, ginger, and black pepper.",
    price: 2100,
    image: "https://images.pexels.com/photos/12737913/pexels-photo-12737913.jpeg?auto=compress&cs=tinysrgb&w=800"
  },
  {
    id: "boneless-karahi",
    name: "Boneless Karahi",
    category: "Karahi",
    description: "Boneless chicken pieces cooked in rich karahi gravy.",
    price: 2200,
    image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=800&q=80"
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
    id: "beef-pulao",
    name: "Beef Pulao",
    category: "Rice",
    description: "Aromatic pulao rice with tender beef and mild spices.",
    price: 680,
    image: "https://images.unsplash.com/photo-1563379091339-03246963d29a?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "chicken-biryani",
    name: "Chicken Biryani",
    category: "Rice",
    description: "Spicy layered rice with chicken, potatoes, and raita.",
    price: 620,
    image: "https://images.unsplash.com/photo-1563379091339-03246963d29a?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "plain-rice",
    name: "Plain Rice",
    category: "Rice",
    description: "Steamed basmati rice for pairing with karahi and curry.",
    price: 280,
    image: "https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "kabuli-pulao",
    name: "Kabuli Pulao",
    category: "Rice",
    description: "Rice with carrots, raisins, tender meat, and mild spices.",
    price: 780,
    image: "https://images.unsplash.com/photo-1563379091339-03246963d29a?auto=format&fit=crop&w=800&q=80"
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
    id: "pepsi",
    name: "Pepsi",
    category: "Drinks",
    description: "Chilled regular soft drink bottle.",
    price: 160,
    image: "https://upload.wikimedia.org/wikipedia/commons/d/dd/Pepsi_Can.jpg"
  },
  {
    id: "coke",
    name: "Coca Cola",
    category: "Drinks",
    description: "Chilled regular soft drink bottle.",
    price: 160,
    image: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "fresh-lime",
    name: "Fresh Lime",
    category: "Drinks",
    description: "Fresh lime drink served chilled.",
    price: 280,
    image: "https://images.unsplash.com/photo-1523371054106-bbf80586c38c?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "mineral-water",
    name: "Mineral Water",
    category: "Drinks",
    description: "Sealed mineral water bottle.",
    price: 120,
    image: "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "kheer-cup",
    name: "Kheer Cup",
    category: "Desserts",
    description: "Creamy rice dessert served chilled after the meal.",
    price: 260,
    image: "https://images.pexels.com/photos/3026808/pexels-photo-3026808.jpeg?auto=compress&cs=tinysrgb&w=800"
  },
  {
    id: "gulab-jamun",
    name: "Gulab Jamun",
    category: "Desserts",
    description: "Warm sweet gulab jamun served with syrup.",
    price: 240,
    image: "https://upload.wikimedia.org/wikipedia/commons/5/56/Gulab_Jamun.jpg"
  },
  {
    id: "brownie",
    name: "Chocolate Brownie",
    category: "Desserts",
    description: "Soft chocolate brownie with rich cocoa flavor.",
    price: 420,
    image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "ice-cream",
    name: "Vanilla Ice Cream",
    category: "Desserts",
    description: "Classic vanilla ice cream scoop.",
    price: 300,
    image: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "firni",
    name: "Firni",
    category: "Desserts",
    description: "Traditional chilled milk dessert in a small bowl.",
    price: 280,
    image: "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=800&q=80"
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
