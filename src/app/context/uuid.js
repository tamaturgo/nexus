export const createId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `ctx_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
};
