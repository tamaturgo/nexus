use crate::window::{
    constants::{
        window_size, EVENT_CONTEXT_DATA, WINDOW_CONTEXT, WINDOW_HISTORY, WINDOW_SEARCH,
        WINDOW_SETTINGS,
    },
    state::WindowState,
};
use serde_json::Value;
use tauri::{
    window::Color, AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};

fn sanitize_label_key(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for ch in input.chars() {
        if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
            out.push(ch.to_ascii_lowercase());
        } else {
            out.push('-');
        }
    }

    let trimmed = out.trim_matches('-');
    if trimmed.is_empty() {
        "default".to_string()
    } else {
        trimmed.to_string()
    }
}

pub fn apply_window_policy(window: &WebviewWindow) {
    if let Err(error) = window.set_always_on_top(true) {
        log::warn!("set_always_on_top failed for {}: {}", window.label(), error);
    }
    if let Err(error) = window.set_visible_on_all_workspaces(true) {
        log::warn!(
            "set_visible_on_all_workspaces failed for {}: {}",
            window.label(),
            error
        );
    }
    if let Err(error) = window.set_content_protected(true) {
        log::warn!(
            "set_content_protected failed for {}: {}",
            window.label(),
            error
        );
    }
    if let Err(error) = window.set_skip_taskbar(true) {
        log::warn!("set_skip_taskbar failed for {}: {}", window.label(), error);
    }
    if let Err(error) = window.set_background_color(Some(Color(0, 0, 0, 0))) {
        log::warn!(
            "set_background_color failed for {}: {}",
            window.label(),
            error
        );
    }
}

pub fn enforce_window_policy_for_all(app: &AppHandle) {
    for window in app.webview_windows().values() {
        apply_window_policy(window);
    }
}

pub fn build_popup_window(
    app: &AppHandle,
    label: &str,
    window_type: &str,
    width: f64,
    height: f64,
) -> Result<WebviewWindow, String> {
    if let Some(window) = app.get_webview_window(label) {
        apply_window_policy(&window);
        return Ok(window);
    }

    let url = WebviewUrl::App(format!("index.html?window={window_type}").into());

    let window = WebviewWindowBuilder::new(app, label, url)
        .title("nexus")
        .inner_size(width, height)
        .resizable(true)
        .transparent(true)
        .background_color(Color(0, 0, 0, 0))
        .decorations(false)
        .always_on_top(true)
        .visible_on_all_workspaces(true)
        .skip_taskbar(true)
        .content_protected(true)
        .shadow(false)
        .build()
        .map_err(|e| e.to_string())?;

    apply_window_policy(&window);
    Ok(window)
}

pub fn show_focus_window(window: &WebviewWindow) {
    apply_window_policy(window);
    let _ = window.show();
    let _ = window.set_focus();
}

fn save_context_payload(state: &WindowState, window_label: &str, payload: Value) {
    if let Ok(mut by_window) = state.context_data_by_window.lock() {
        by_window.insert(window_label.to_string(), payload.clone());
    }

    if let Ok(mut latest) = state.latest_context_data.lock() {
        *latest = Some(payload);
    }
}

pub fn context_data_for_window(state: &WindowState, window_label: &str) -> Option<Value> {
    if let Ok(by_window) = state.context_data_by_window.lock() {
        if let Some(payload) = by_window.get(window_label) {
            return Some(payload.clone());
        }
    }

    state
        .latest_context_data
        .lock()
        .ok()
        .and_then(|latest| latest.clone())
}

pub fn open_standard_window(app: &AppHandle, kind: &str) -> Result<(), String> {
    let (width, height) = window_size(kind);
    let window = build_popup_window(app, kind, kind, width, height)?;
    show_focus_window(&window);
    Ok(())
}

pub fn open_context_window(
    app: &AppHandle,
    state: &WindowState,
    payload: Value,
) -> Result<(), String> {
    let context_key = payload
        .get("contextKey")
        .and_then(|v| v.as_str())
        .unwrap_or("default");

    let label = {
        let mut map = state
            .context_window_by_key
            .lock()
            .map_err(|e| e.to_string())?;
        map.entry(context_key.to_string())
            .or_insert_with(|| format!("{WINDOW_CONTEXT}-{}", sanitize_label_key(context_key)))
            .clone()
    };

    let (width, height) = window_size(WINDOW_CONTEXT);
    let window = build_popup_window(app, &label, WINDOW_CONTEXT, width, height)?;
    show_focus_window(&window);

    save_context_payload(state, &label, payload.clone());
    let _ = window.emit(EVENT_CONTEXT_DATA, payload);

    Ok(())
}

pub fn update_context_window(
    app: &AppHandle,
    state: &WindowState,
    payload: Value,
) -> Result<(), String> {
    let context_key = payload
        .get("contextKey")
        .and_then(|v| v.as_str())
        .unwrap_or("default");

    let label = {
        let map = state
            .context_window_by_key
            .lock()
            .map_err(|e| e.to_string())?;
        map.get(context_key).cloned()
    }
    .unwrap_or_else(|| format!("{WINDOW_CONTEXT}-{}", sanitize_label_key(context_key)));

    let (width, height) = window_size(WINDOW_CONTEXT);
    let window = if let Some(existing) = app.get_webview_window(&label) {
        existing
    } else {
        build_popup_window(app, &label, WINDOW_CONTEXT, width, height)?
    };

    save_context_payload(state, &label, payload.clone());
    let _ = window.emit(EVENT_CONTEXT_DATA, payload);

    Ok(())
}

pub fn open_window(
    app: &AppHandle,
    state: &WindowState,
    window_type: &str,
    payload: Option<Value>,
) -> Result<(), String> {
    match window_type {
        WINDOW_CONTEXT => open_context_window(app, state, payload.unwrap_or(Value::Null)),
        WINDOW_SETTINGS | WINDOW_HISTORY => open_standard_window(app, window_type),
        WINDOW_SEARCH => open_standard_window(app, WINDOW_SEARCH),
        _ => Err(format!("window type not supported: {window_type}")),
    }
}

pub fn toggle_search_window(app: &AppHandle) -> Result<(), String> {
    let search = app
        .get_webview_window(WINDOW_SEARCH)
        .ok_or_else(|| "search window not found".to_string())?;

    if search.is_visible().map_err(|e| e.to_string())? {
        search.hide().map_err(|e| e.to_string())?;
    } else {
        show_focus_window(&search);
    }

    Ok(())
}
