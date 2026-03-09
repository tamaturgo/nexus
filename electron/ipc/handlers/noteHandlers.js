import { ipcMain } from "electron";
import { CHANNELS } from "../../../shared/ipc/channels.js";

export const registerNoteHandlers = ({ noteStore, noteService }) => {
  if (!noteStore || !noteService) return;

  ipcMain.handle(CHANNELS.NOTES.LIST, async () => {
    return noteService.listNotes();
  });

  ipcMain.handle(CHANNELS.NOTES.GET, async (_event, { noteId }) => {
    return noteService.getNote(noteId);
  });

  ipcMain.handle(CHANNELS.NOTES.CREATE, async (_event, payload) => {
    return noteService.createNote(payload || {});
  });

  ipcMain.handle(CHANNELS.NOTES.UPDATE, async (_event, { noteId, patch }) => {
    return noteService.updateNote(noteId, patch || {});
  });

  ipcMain.handle(CHANNELS.NOTES.DELETE, async (_event, { noteId }) => {
    return noteService.deleteNote(noteId);
  });

  ipcMain.handle(CHANNELS.NOTES.PROCESS_QUICK_NOTE, async (_event, payload) => {
    return noteService.enqueueQuickNote(payload || {});
  });
};
