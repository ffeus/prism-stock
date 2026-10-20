import { invoke } from "@tauri-apps/api/core";

/** Single transport boundary. IPC command names and wire DTOs remain compatible. */
export function invokeDesktop<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  return invoke<T>(command, args);
}
