use crate::window::{
    constants::{
        EVENT_SEARCH_FOCUS_CHANGED, SEARCH_FOCUSED_OPACITY, SEARCH_UNFOCUSED_OPACITY, WINDOW_SEARCH,
    },
    manager,
};
use std::time::Duration;
use tauri::{Emitter, Window, WindowEvent};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

fn reinforce_window_policy(window: &Window) {
    let _ = window.set_always_on_top(true);
    let _ = window.set_visible_on_all_workspaces(true);
    let _ = window.set_content_protected(true);
    let _ = window.set_skip_taskbar(true);
}

pub fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    manager::open_standard_window(app.handle(), WINDOW_SEARCH)
        .map_err(|e| -> Box<dyn std::error::Error> { e.into() })?;

    let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::Space);
    app.global_shortcut()
        .on_shortcut(shortcut, |app, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                let _ = manager::toggle_search_window(app);
            }
        })
        .map_err(|e| -> Box<dyn std::error::Error> { e.into() })?;

    // Wayland/WM can occasionally drop topmost hints; reinforce policy periodically.
    let app_handle = app.handle().clone();
    std::thread::spawn(move || loop {
        manager::enforce_window_policy_for_all(&app_handle);
        std::thread::sleep(Duration::from_secs(2));
    });

    Ok(())
}

pub fn on_window_event(window: &Window, event: &WindowEvent) {
    match event {
        WindowEvent::CloseRequested { api, .. } => {
            if window.label() == WINDOW_SEARCH {
                api.prevent_close();
                let _ = window.hide();
            }
        }
        WindowEvent::Focused(focused) => {
            if window.label() == WINDOW_SEARCH {
                let _ = window.emit(
                    EVENT_SEARCH_FOCUS_CHANGED,
                    if *focused {
                        SEARCH_FOCUSED_OPACITY
                    } else {
                        SEARCH_UNFOCUSED_OPACITY
                    },
                );
            }
        }
        _ => {}
    }

    reinforce_window_policy(window);
}
