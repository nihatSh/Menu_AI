// Shared between client and server so the tracker and the kitchen screen agree.
// Kept out of lib/store.js because that module is server-only.
export const ORDER_STAGE_LIST = ["received", "cooking", "ready", "served"];
