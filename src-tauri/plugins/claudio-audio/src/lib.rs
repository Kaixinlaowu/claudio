// Audio plugin - no-op on all platforms
// On Android, audio is handled by the Kotlin plugin (AudioPlugin.kt)
// On desktop, audio is handled by HTML5 Audio in the frontend

use tauri::plugin::TauriPlugin;

pub fn init() -> TauriPlugin<tauri::Wry> {
    tauri::plugin::Builder::new("claudio-audio")
        .build()
}
