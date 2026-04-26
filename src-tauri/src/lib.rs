mod netease_api;

use rusqlite::{Connection, Result as SqliteResult, params};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;
use chrono::Utc;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum DbError {
    #[error("Database error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("Lock error")]
    Lock,
}

impl Serialize for DbError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

// Netease API types
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NeteaseSearchResult {
    pub songs: Vec<NeteaseSong>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub debug_info: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NeteaseSong {
    pub id: u64,
    pub name: String,
    pub artists: Vec<NeteaseArtist>,
    pub album: NeteaseAlbum,
    pub duration: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NeteaseArtist {
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NeteaseAlbum {
    pub name: String,
    pub pic_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NeteaseSongDetail {
    pub id: u64,
    pub name: String,
    pub artists: Vec<NeteaseArtist>,
    pub album: NeteaseAlbum,
    pub duration: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NeteaseSongUrlResult {
    pub data: Vec<NeteaseSongUrl>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NeteaseSongUrl {
    pub id: u64,
    pub url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlayRecord {
    pub id: Option<i64>,
    pub song_id: String,
    pub song_name: String,
    pub artist: String,
    pub album: String,
    pub cover_url: String,
    pub url: String,
    pub played_at: Option<String>,
    pub liked: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Playlist {
    pub id: Option<i64>,
    pub name: String,
    pub song_ids: String,
    pub created_at: Option<String>,
}

pub struct AppState {
    pub db: Mutex<Connection>,
}

fn init_db(conn: &Connection) -> SqliteResult<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS plays (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            song_id TEXT NOT NULL,
            song_name TEXT,
            artist TEXT,
            album TEXT,
            cover_url TEXT,
            url TEXT,
            played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            liked BOOLEAN DEFAULT FALSE
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS playlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            song_ids TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS preferences (
            key TEXT PRIMARY KEY,
            value TEXT
        )",
        [],
    )?;

    Ok(())
}

#[tauri::command]
fn add_play_record(state: State<AppState>, record: PlayRecord) -> Result<PlayRecord, DbError> {
    let conn = state.db.lock().map_err(|_| DbError::Lock)?;
    conn.execute(
        "DELETE FROM plays WHERE song_id = ?1",
        params![&record.song_id],
    )?;
    conn.execute(
        "INSERT INTO plays (song_id, song_name, artist, album, cover_url, url, liked)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            &record.song_id,
            &record.song_name,
            &record.artist,
            &record.album,
            &record.cover_url,
            &record.url,
            record.liked,
        ],
    )?;
    let id = conn.last_insert_rowid();
    Ok(PlayRecord {
        id: Some(id),
        played_at: Some(Utc::now().to_rfc3339()),
        ..record
    })
}

#[tauri::command]
fn get_play_history(state: State<AppState>, limit: Option<i64>) -> Result<Vec<PlayRecord>, DbError> {
    let conn = state.db.lock().map_err(|_| DbError::Lock)?;
    let limit = limit.unwrap_or(50);
    let mut stmt = conn.prepare(
        "SELECT id, song_id, song_name, artist, album, cover_url, url, played_at, liked
         FROM plays ORDER BY played_at DESC LIMIT ?1"
    )?;
    let records = stmt.query_map(params![limit], |row| {
        Ok(PlayRecord {
            id: Some(row.get(0)?),
            song_id: row.get(1)?,
            song_name: row.get(2)?,
            artist: row.get(3)?,
            album: row.get(4)?,
            cover_url: row.get(5)?,
            url: row.get(6)?,
            played_at: row.get(7)?,
            liked: row.get(8)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    Ok(records)
}

#[tauri::command]
fn get_liked_songs(state: State<AppState>, limit: Option<i64>) -> Result<Vec<PlayRecord>, DbError> {
    let conn = state.db.lock().map_err(|_| DbError::Lock)?;
    let limit = limit.unwrap_or(100);
    let mut stmt = conn.prepare(
        "SELECT id, song_id, song_name, artist, album, cover_url, url, played_at, liked
         FROM plays WHERE liked = 1 ORDER BY played_at DESC LIMIT ?1"
    )?;
    let records = stmt.query_map(params![limit], |row| {
        Ok(PlayRecord {
            id: Some(row.get(0)?),
            song_id: row.get(1)?,
            song_name: row.get(2)?,
            artist: row.get(3)?,
            album: row.get(4)?,
            cover_url: row.get(5)?,
            url: row.get(6)?,
            played_at: row.get(7)?,
            liked: row.get(8)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    Ok(records)
}

#[tauri::command]
fn toggle_like(state: State<AppState>, id: i64, liked: bool) -> Result<(), DbError> {
    let conn = state.db.lock().map_err(|_| DbError::Lock)?;
    conn.execute("UPDATE plays SET liked = ?1 WHERE id = ?2", params![liked, id])?;
    Ok(())
}

#[tauri::command]
fn save_playlist(state: State<AppState>, playlist: Playlist) -> Result<Playlist, DbError> {
    let conn = state.db.lock().map_err(|_| DbError::Lock)?;
    if let Some(id) = playlist.id {
        conn.execute(
            "UPDATE playlists SET name = ?1, song_ids = ?2 WHERE id = ?3",
            params![&playlist.name, &playlist.song_ids, id],
        )?;
        Ok(playlist)
    } else {
        conn.execute(
            "INSERT INTO playlists (name, song_ids) VALUES (?1, ?2)",
            params![&playlist.name, &playlist.song_ids],
        )?;
        let id = conn.last_insert_rowid();
        Ok(Playlist {
            id: Some(id),
            created_at: Some(Utc::now().to_rfc3339()),
            ..playlist
        })
    }
}

#[tauri::command]
fn get_playlists(state: State<AppState>) -> Result<Vec<Playlist>, DbError> {
    let conn = state.db.lock().map_err(|_| DbError::Lock)?;
    let mut stmt = conn.prepare("SELECT id, name, song_ids, created_at FROM playlists")?;
    let playlists = stmt.query_map([], |row| {
        Ok(Playlist {
            id: Some(row.get(0)?),
            name: row.get(1)?,
            song_ids: row.get(2)?,
            created_at: row.get(3)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    Ok(playlists)
}

#[tauri::command]
fn set_preference(state: State<AppState>, key: String, value: String) -> Result<(), DbError> {
    let conn = state.db.lock().map_err(|_| DbError::Lock)?;
    conn.execute(
        "INSERT OR REPLACE INTO preferences (key, value) VALUES (?1, ?2)",
        params![&key, &value],
    )?;
    Ok(())
}

#[tauri::command]
fn get_preference(state: State<AppState>, key: String) -> Result<Option<String>, DbError> {
    let conn = state.db.lock().map_err(|_| DbError::Lock)?;
    let result = conn.query_row(
        "SELECT value FROM preferences WHERE key = ?1",
        params![&key],
        |row| row.get(0),
    ).ok();
    Ok(result)
}

fn load_cookie() -> String {
    // Try environment variable first (NETEASE_COOKIE or MUSIC_U)
    for cookie_env in ["NETEASE_COOKIE", "MUSIC_U"] {
        if let Ok(cookie) = std::env::var(cookie_env) {
            if !cookie.is_empty() {
                log::info!("Loaded {} from environment", cookie_env);
                return cookie;
            }
        }
    }

    // Helper to try loading .env from a specific path
    let try_load_env = |env_path: &std::path::Path| -> Option<String> {
        if env_path.exists() {
            if let Ok(content) = std::fs::read_to_string(env_path) {
                for line in content.lines() {
                    // Check both NETEASE_COOKIE and MUSIC_U
                    for cookie_key in ["NETEASE_COOKIE=", "MUSIC_U="] {
                        if line.starts_with(cookie_key) {
                            let cookie = line.trim_start_matches(cookie_key).trim();
                            if !cookie.is_empty() {
                                log::info!("Loaded {} from {}", cookie_key.trim_end_matches('='), env_path.display());
                                return Some(cookie.to_string());
                            }
                        }
                    }
                }
            }
        }
        None
    };

    // Try app data directory (for installed app)
    if let Some(app_dir) = dirs::data_local_dir() {
        let env_path = app_dir.join("claudio").join(".env");
        if let Some(cookie) = try_load_env(&env_path) {
            return cookie;
        }
    }

    // Try executable directory (for dev and portable installs)
    if let Ok(exe_path) = std::env::current_exe() {
        let exe_dir = exe_path.parent();
        if let Some(exe_dir) = exe_dir {
            let env_path = exe_dir.join(".env");
            if let Some(cookie) = try_load_env(&env_path) {
                return cookie;
            }
            // Also try claudio/.env relative to exe for development builds
            let env_path = exe_dir.join("claudio").join(".env");
            if let Some(cookie) = try_load_env(&env_path) {
                return cookie;
            }
        }
    }

    log::warn!("No NETEASE_COOKIE found, using fallback hardcoded cookie");
    // Fallback hardcoded cookie for packaged builds
    String::from("MUSIC_U=007E7FBB4BEB13E354FE205035D7CEA1E6207E39EA1036A601BEEE9D5476A4027EBB51733F45FC3E724BFE926810E1C7C6305E739459921355DEFFD14B4D05AF24D4C6D6A7895A998DA6D84702D22EBBE86C917F42FA9ED24F9E90E7C9BCF182F17D9E60A7240A2FD034652889ABC077EBC5F4627B018F397B927D8434E6256BB4F64B6CD11C07961511D92C6684FE6B6DF2D8DC668B36E56CB587A6B316EEA6F13C17D57DAE4B938B37A3E3BC462EBFF59341D803442F4D7F0E7A10EA8A873CDC94BFFE59D59E18D0CFC30AF0A47ABBCC0C8DBB0FAA1394858EB77E39A680EDD58CD0F310ADCD3054074038A199C42A6EA77081F18EEDA4ED5D3E4CF8B13D44573468CA9EB3111B98D0E3EA88204B6FD5F44BDD74F2B85906993CB7138E11A041E03769554DA7D396EEE5A9CD7B20B0677202DDB57DF495B8C887223F98F8571BF6206929C9C9A5C97F1E2C7245561902E4BD3B8986585F7F3A13EB04DC97D87D5288068EE24BB06224B7D58A7D4941BC2C8C3A0AC840B21ABEE37C0D6F84D210B8435B9DCE20EDBFA6FBADB4D43AB814A19E0CB77BA184729B838E6A1E9E5FE7")
}

// Netease API Tauri commands - using IPC instead of HTTP
#[tauri::command]
async fn netease_search(keywords: String) -> Result<NeteaseSearchResult, String> {
    log::info!("[NETEASE_CMD] search called with: {}", keywords);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let cookie = load_cookie();
    log::info!("[NETEASE_CMD] cookie length: {}", cookie.len());

    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::USER_AGENT,
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36".parse().unwrap(),
    );
    headers.insert(
        reqwest::header::REFERER,
        "https://music.163.com".parse().unwrap(),
    );
    if !cookie.is_empty() {
        headers.insert(
            reqwest::header::COOKIE,
            cookie.parse().unwrap(),
        );
    }

    let url = "https://music.163.com/api/search/get";
    let resp = client
        .get(url)
        .headers(headers)
        .query(&[("s", &keywords), ("type", &"1".to_string()), ("limit", &"20".to_string())])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = resp.status();
    let text = resp.text().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        return Err(format!("API returned error status {}: {}", status, &text[..std::cmp::min(200, text.len())]));
    }

    // Parse the JSON
    let json: serde_json::Value = serde_json::from_str(&text).map_err(|e| {
        let msg = format!("JSON parse error: {}. Body: {}", e, &text[..std::cmp::min(200, text.len())]);
        log::error!("[NETEASE_CMD] {}", msg);
        msg
    })?;

    // Extract songs manually
    let songs_array = json.get("result")
        .and_then(|r| r.get("songs"))
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    log::info!("[NETEASE_CMD] Found {} songs in JSON", songs_array.len());

    // Build NeteaseSong structs
    let songs: Vec<NeteaseSong> = songs_array
        .iter()
        .filter_map(|song| {
            Some(NeteaseSong {
                id: song.get("id")?.as_u64()?,
                name: song.get("name")?.as_str()?.to_string(),
                artists: song.get("artists")?
                    .as_array()?
                    .iter()
                    .filter_map(|a| {
                        Some(NeteaseArtist {
                            name: a.get("name")?.as_str()?.to_string(),
                        })
                    })
                    .collect(),
                album: NeteaseAlbum {
                    name: song.get("album")?.get("name")?.as_str().map(|s| s.to_string()).unwrap_or_default(),
                    pic_url: song.get("album")?.get("picUrl")?.as_str().map(|s| s.to_string()),
                },
                duration: song.get("duration")?.as_u64().unwrap_or(0),
            })
        })
        .collect();

    log::info!("[NETEASE_CMD] Built {} NeteaseSong structs", songs.len());

    // Serialize to JSON string to debug
    let debug_json = serde_json::to_string(&NeteaseSearchResult {
        songs: songs.clone(),
        debug_info: Some(format!("Built {} songs from JSON with {} array items", songs.len(), songs_array.len()))
    }).unwrap_or_else(|_| "序列化失败".to_string());

    log::info!("[NETEASE_CMD] Debug JSON preview: {}", &debug_json[..std::cmp::min(300, debug_json.len())]);

    Ok(NeteaseSearchResult { songs, debug_info: Some(debug_json) })
}

#[tauri::command]
async fn netease_song_url(id: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let cookie = load_cookie();
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::USER_AGENT,
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36".parse().unwrap(),
    );
    headers.insert(
        reqwest::header::REFERER,
        "https://music.163.com".parse().unwrap(),
    );
    if !cookie.is_empty() {
        headers.insert(
            reqwest::header::COOKIE,
            cookie.parse().unwrap(),
        );
    }

    let url = "https://music.163.com/api/song/enhance/player/url";
    let body = format!("ids=[{}]&br=320000", id);

    let resp = client
        .post(url)
        .headers(headers)
        .header(reqwest::header::CONTENT_TYPE, "application/x-www-form-urlencoded")
        .body(body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let json: serde_json::Value = serde_json::from_str(&resp.text().await.map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;

    let url = json.pointer("/data/0/url")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_default();

    Ok(url)
}

#[tauri::command]
async fn netease_song_detail(ids: Vec<String>) -> Result<Vec<NeteaseSongDetail>, String> {
    if ids.is_empty() {
        return Ok(vec![]);
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let cookie = load_cookie();
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::USER_AGENT,
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36".parse().unwrap(),
    );
    headers.insert(
        reqwest::header::REFERER,
        "https://music.163.com".parse().unwrap(),
    );
    if !cookie.is_empty() {
        headers.insert(
            reqwest::header::COOKIE,
            cookie.parse().unwrap(),
        );
    }

    let ids_param = format!("[{}]", ids.join(","));
    let url = "https://music.163.com/api/song/detail";

    let resp = client
        .get(url)
        .headers(headers)
        .query(&[("ids", &ids_param)])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let text = resp.text().await.map_err(|e| e.to_string())?;
    let json: serde_json::Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;

    let songs_array = json.pointer("/songs")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let songs: Vec<NeteaseSongDetail> = songs_array
        .into_iter()
        .filter_map(|song| {
            Some(NeteaseSongDetail {
                id: song.get("id")?.as_u64()?,
                name: song.get("name")?.as_str()?.to_string(),
                artists: song.get("artists")?
                    .as_array()?
                    .iter()
                    .filter_map(|a| {
                        Some(NeteaseArtist {
                            name: a.get("name")?.as_str()?.to_string(),
                        })
                    })
                    .collect(),
                album: NeteaseAlbum {
                    name: song.get("album")?.get("name")?.as_str().map(|s| s.to_string()).unwrap_or_default(),
                    pic_url: song.get("album")?.get("picUrl")?.as_str().map(|s| s.to_string()),
                },
                duration: song.get("duration")?.as_u64().unwrap_or(0),
            })
        })
        .collect();

    Ok(songs)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_dir = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("claudio");
    std::fs::create_dir_all(&app_dir).ok();

    // Load cookie for Netease API
    let cookie = load_cookie();
    log::info!("[DEBUG] Loaded cookie length: {}", cookie.len());

    let db_path = app_dir.join("claudio.db");
    let conn = Connection::open(&db_path).expect("Failed to open database");
    init_db(&conn).expect("Failed to initialize database");

    let app_state = AppState {
        db: Mutex::new(conn),
    };

    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            add_play_record,
            get_play_history,
            get_liked_songs,
            toggle_like,
            save_playlist,
            get_playlists,
            set_preference,
            get_preference,
            netease_search,
            netease_song_url,
            netease_song_detail,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
