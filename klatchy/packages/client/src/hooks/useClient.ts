import { createContext, useContext } from "react";
import type { KlatchyClient } from "../ws.js";

const ClientContext = createContext<KlatchyClient | null>(null);

export { ClientContext };

export function useClient(): KlatchyClient {
  const ctx = useContext(ClientContext);
  if (!ctx) throw new Error("useClient must be used within ClientProvider");
  return ctx;
}
