import { DemoState } from "@/components/public/demo-simulation-store";

const maxOrders = 80;
const maxRequests = 80;

type DemoGlobal = typeof globalThis & {
  orderTableDemoStates?: Map<string, DemoState>;
};

function stateMap() {
  const demoGlobal = globalThis as DemoGlobal;
  if (!demoGlobal.orderTableDemoStates) demoGlobal.orderTableDemoStates = new Map<string, DemoState>();
  return demoGlobal.orderTableDemoStates;
}

export function cleanDemoSession(value: unknown) {
  const session = typeof value === "string" ? value : "public-demo";
  return session.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "public-demo";
}

export function getDemoState(sessionInput: unknown): DemoState {
  const session = cleanDemoSession(sessionInput);
  return stateMap().get(session) || { orders: [], requests: [] };
}

export function setDemoState(sessionInput: unknown, state: DemoState) {
  const session = cleanDemoSession(sessionInput);
  const nextState = {
    orders: state.orders.slice(0, maxOrders),
    requests: state.requests.slice(0, maxRequests)
  };
  stateMap().set(session, nextState);
  return nextState;
}
