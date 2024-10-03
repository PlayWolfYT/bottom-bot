import { Client, type ClientEvents } from "discord.js";

export interface Event<K extends keyof ClientEvents> {
  name: K;
  once?: boolean;
  execute: (client: Client, ...args: ClientEvents[K]) => void | Promise<void>;
}

export function isEvent(event: Event<any> | any): event is Event<any> {
  if (typeof event !== "object" || event === null) {
    return false;
  }

  return (
    "name" in event &&
    "execute" in event &&
    typeof event.execute === "function"
  );
}
