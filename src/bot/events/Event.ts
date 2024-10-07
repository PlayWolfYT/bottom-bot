import { Client, type ClientEvents } from "discord.js";

export type Event = {
  [K in keyof ClientEvents]: {
    event: K;
    once?: boolean;
    execute(client: Client, ...args: ClientEvents[K]): any;
  };
}[keyof ClientEvents];

export function isEvent(event: Event | any): event is Event {
  if (typeof event !== "object" || event === null) {
    return false;
  }

  return (
    "event" in event &&
    "execute" in event &&
    typeof event.execute === "function"
  );
}
