use crate::window::{
    constants::{window_type_from_label, WINDOW_SEARCH},
    manager,
    state::WindowState,
};
use serde_json::Value;
use tauri::{AppHandle, PhysicalSize, Size, Window};

#[tauri::command]
pub fn get_window_type(window: Window) -> String {
    window_type_from_label(window.label()).to_string()
}

#[tauri::command]
pub fn resize_window(window: Window, width: f64, height: f64) -> Result<(), String> {
    let width = width.max(1.0) as u32;
    let height = height.max(1.0) as u32;
    window
        .set_size(Size::Physical(PhysicalSize::new(width, height)))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_window(
    app: AppHandle,
    state: tauri::State<'_, WindowState>,
    window_type: String,
    payload: Option<Value>,
) -> Result<(), String> {
    manager::open_window(&app, state.inner(), &window_type, payload)
}

#[tauri::command]
pub fn update_context_window(
    app: AppHandle,
    state: tauri::State<'_, WindowState>,
    payload: Value,
) -> Result<(), String> {
    manager::update_context_window(&app, state.inner(), payload)
}

#[tauri::command]
pub fn close_current_window(window: Window) -> Result<(), String> {
    if window.label() == WINDOW_SEARCH {
        window.hide().map_err(|e| e.to_string())
    } else {
        window.close().map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn minimize_current_window(window: Window) -> Result<(), String> {
    if window.label() == WINDOW_SEARCH {
        window.hide().map_err(|e| e.to_string())
    } else {
        window.minimize().map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn get_context_data(window: Window, state: tauri::State<'_, WindowState>) -> Option<Value> {
    manager::context_data_for_window(state.inner(), window.label())
}
