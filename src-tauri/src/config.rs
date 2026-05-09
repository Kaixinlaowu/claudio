use std::path::{Path, PathBuf};
use std::sync::OnceLock;

/// Try to read a value from a .env file at the given path.
fn read_env_key(env_path: &Path, key: &str) -> Option<String> {
    if !env_path.exists() {
        return None;
    }
    let content = std::fs::read_to_string(env_path).ok()?;
    let prefix = format!("{}=", key);
    for line in content.lines() {
        if line.starts_with(&prefix) {
            let val = line.trim_start_matches(&prefix).trim();
            if !val.is_empty() {
                return Some(val.to_string());
            }
        }
    }
    None
}

/// Search for a key across standard .env locations.
pub fn load_env_value(key: &str) -> Option<String> {
    // 1. Environment variable
    if let Ok(val) = std::env::var(key) {
        if !val.is_empty() {
            log::info!("Loaded {} from environment", key);
            return Some(val);
        }
    }

    // 2. Standard .env file locations
    let candidates = env_file_candidates();
    for path in &candidates {
        if let Some(val) = read_env_key(path, key) {
            log::info!("Loaded {} from {}", key, path.display());
            return Some(val);
        }
    }

    None
}

/// Load cookie for Netease API, checking multiple keys in priority order.
pub fn load_cookie() -> String {
    for key in ["VITE_NET_COOKIE", "NETEASE_COOKIE", "MUSIC_U"] {
        if let Some(val) = load_env_value(key) {
            return val;
        }
    }

    // Also try reading from .env files directly (VITE_NET_COOKIE has __csrf etc.)
    let candidates = env_file_candidates();
    for path in &candidates {
        if !path.exists() {
            continue;
        }
        if let Ok(content) = std::fs::read_to_string(path) {
            for key in ["VITE_NET_COOKIE=", "NETEASE_COOKIE=", "MUSIC_U="] {
                for line in content.lines() {
                    if line.starts_with(key) {
                        let val = line.trim_start_matches(key).trim();
                        if !val.is_empty() {
                            log::info!("Loaded {} from {}", key.trim_end_matches('='), path.display());
                            return val.to_string();
                        }
                    }
                }
            }
        }
    }

    log::warn!("No NETEASE_COOKIE found");
    String::new()
}

/// Load TTS configuration (api_key, model, api_url).
pub fn load_tts_config() -> (String, String, String) {
    let default_model = "mimo-v2.5-tts";
    let default_url = "https://api.xiaomimimo.com/v1/chat/completions";

    let api_key = load_env_value("VITE_TTS_KEY")
        .or_else(|| load_env_value("VITE_CHAT_API_KEY"))
        .unwrap_or_default();

    let model = load_env_value("VITE_TTS_MODEL")
        .unwrap_or_else(|| default_model.to_string());

    let api_url = load_env_value("VITE_TTS_URL")
        .unwrap_or_else(|| default_url.to_string());

    (
        if api_key.is_empty() { String::new() } else { api_key },
        model,
        api_url,
    )
}

/// Build list of .env file candidates to search.
fn env_file_candidates() -> Vec<PathBuf> {
    let mut paths = Vec::new();

    // App data directory (installed app)
    if let Some(app_dir) = dirs::data_local_dir() {
        paths.push(app_dir.join("claudio").join(".env"));
    }

    // Executable directory (dev / portable)
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            paths.push(exe_dir.join(".env"));
            paths.push(exe_dir.join("claudio").join(".env"));
            paths.push(exe_dir.join("resources").join(".env"));
        }
    }

    // Cargo manifest dir (Tauri dev mode)
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    paths.push(manifest_dir.join("..").join(".env"));
    paths.push(manifest_dir.join(".env"));

    // Current working directory
    paths.push(PathBuf::from(".env"));

    // Android internal storage
    #[cfg(target_os = "android")]
    {
        paths.push(PathBuf::from("/data/data/com.claudio.app/files/.env"));
        paths.push(PathBuf::from("/data/user/0/com.claudio.app/files/.env"));
    }

    paths
}

pub fn check_cookie_status() -> Result<String, String> {
    let cookie = get_cached_cookie();
    if cookie.is_empty() {
        Err("Cookie 未配置。请在 .env 文件中设置 VITE_NET_COOKIE 环境变量。".to_string())
    } else {
        Ok(format!("Cookie 已加载，长度 {} 字符", cookie.len()))
    }
}

// --- Static caches (loaded once at startup) ---

static COOKIE: OnceLock<String> = OnceLock::new();
static TTS_CONFIG: OnceLock<(String, String, String)> = OnceLock::new();

/// Initialize all caches. Call once from `run()`.
pub fn init_caches() {
    COOKIE.get_or_init(|| load_cookie());
    TTS_CONFIG.get_or_init(|| load_tts_config());
}

/// Get cached cookie (zero-allocation after first call).
pub fn get_cached_cookie() -> &'static str {
    COOKIE.get().map(|s| s.as_str()).unwrap_or("")
}

/// Get cached TTS config (api_key, model, api_url).
pub fn get_cached_tts_config() -> &'static (String, String, String) {
    TTS_CONFIG.get_or_init(|| load_tts_config())
}
