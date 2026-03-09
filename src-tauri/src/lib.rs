mod window;

use window::state::WindowState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(WindowState::default())
        .invoke_handler(tauri::generate_handler![
            window::commands::get_window_type,
            window::commands::resize_window,
            window::commands::open_window,
            window::commands::update_context_window,
            window::commands::close_current_window,
            window::commands::minimize_current_window,
            window::commands::get_context_data
        ])
        .setup(window::runtime::setup)
        .on_window_event(window::runtime::on_window_event)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
