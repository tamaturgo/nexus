import {
  listContextHistory,
  getContextHistoryItem,
  saveContextHistory,
  toggleContextFavorite,
  deleteContextHistory
} from "../../infra/ipc/electronBridge.js";

export const loadHistory = async () => {
  return await listContextHistory?.();
};

export const getHistoryItem = async (contextId) => {
  return await getContextHistoryItem?.(contextId);
};

export const saveHistoryItem = async (payload) => {
  return await saveContextHistory?.(payload);
};

export const toggleFavorite = async (contextId) => {
  return await toggleContextFavorite?.(contextId);
};

export const deleteHistoryItem = async (contextId) => {
  return await deleteContextHistory?.(contextId);
};
