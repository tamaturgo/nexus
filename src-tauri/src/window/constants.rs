pub const WINDOW_SEARCH: &str = "search";
pub const WINDOW_CONTEXT: &str = "context";
pub const WINDOW_SETTINGS: &str = "settings";
pub const WINDOW_HISTORY: &str = "history";

pub const EVENT_CONTEXT_DATA: &str = "context-data";
pub const EVENT_SEARCH_FOCUS_CHANGED: &str = "search-focus-changed";

pub const SEARCH_FOCUSED_OPACITY: f64 = 1.0;
pub const SEARCH_UNFOCUSED_OPACITY: f64 = 0.58;

pub const SEARCH_WIDTH: f64 = 600.0;
pub const SEARCH_HEIGHT: f64 = 220.0;
pub const CONTEXT_WIDTH: f64 = 600.0;
pub const CONTEXT_HEIGHT: f64 = 720.0;
pub const SETTINGS_WIDTH: f64 = 600.0;
pub const SETTINGS_HEIGHT: f64 = 820.0;
pub const HISTORY_WIDTH: f64 = 600.0;
pub const HISTORY_HEIGHT: f64 = 720.0;

pub fn window_type_from_label(label: &str) -> &'static str {
    if label.starts_with("context-") || label == WINDOW_CONTEXT {
        WINDOW_CONTEXT
    } else if label == WINDOW_SETTINGS {
        WINDOW_SETTINGS
    } else if label == WINDOW_HISTORY {
        WINDOW_HISTORY
    } else {
        WINDOW_SEARCH
    }
}

pub fn window_size(window_type: &str) -> (f64, f64) {
    match window_type {
        WINDOW_CONTEXT => (CONTEXT_WIDTH, CONTEXT_HEIGHT),
        WINDOW_SETTINGS => (SETTINGS_WIDTH, SETTINGS_HEIGHT),
        WINDOW_HISTORY => (HISTORY_WIDTH, HISTORY_HEIGHT),
        _ => (SEARCH_WIDTH, SEARCH_HEIGHT),
    }
}
