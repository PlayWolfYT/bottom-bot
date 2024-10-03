import type { Client } from "discord.js";

export interface Interval {
  interval: number;
  execute: (client: Client, ...args: any[]) => Promise<void>;
}

export function isInterval(interval: any): interval is Interval {
  return (
    typeof interval === "object" &&
    typeof interval.interval === "number" &&
    typeof interval.execute === "function"
  );
}
