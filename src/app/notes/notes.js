import {
  listNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
  processQuickNote
} from "../../infra/ipc/electronBridge.js";

export const loadNotes = async () => {
  return await listNotes?.();
};

export const loadNote = async (noteId) => {
  return await getNote?.(noteId);
};

export const createNoteItem = async (payload) => {
  return await createNote?.(payload);
};

export const updateNoteItem = async (noteId, patch) => {
  return await updateNote?.(noteId, patch);
};

export const deleteNoteItem = async (noteId) => {
  return await deleteNote?.(noteId);
};

export const processQuickNoteItem = async (payload) => {
  return await processQuickNote?.(payload);
};
