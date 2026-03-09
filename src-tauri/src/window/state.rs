use serde_json::Value;
use std::{collections::HashMap, sync::Mutex};

#[derive(Default)]
pub struct WindowState {
    pub latest_context_data: Mutex<Option<Value>>,
    pub context_data_by_window: Mutex<HashMap<String, Value>>,
    pub context_window_by_key: Mutex<HashMap<String, String>>,
}
