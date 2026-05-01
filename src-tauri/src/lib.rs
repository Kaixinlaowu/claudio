// netease_api module removed — functionality migrated to Tauri IPC commands in this file

use rusqlite::{Connection, Result as SqliteResult, params};
use serde::{Deserialize, Serialize};
use std::sync::{Mutex, OnceLock};
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

#[derive(Debug, Serialize, Deserialize)]
pub struct NeteaseUserPlaylist {
    pub id: u64,
    pub name: String,
    #[serde(rename = "trackCount")]
    pub track_count: u64,
    #[serde(rename = "coverImgUrl")]
    pub cover_img_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NeteaseUserPlaylistResponse {
    pub playlist: Vec<NeteaseUserPlaylist>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NeteasePlaylistDetail {
    pub id: u64,
    pub name: String,
    pub tracks: Vec<NeteaseSong>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NeteasePlaylistDetailResponse {
    pub playlist: NeteasePlaylistDetail,
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

static HTTP_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

fn get_http_client() -> &'static reqwest::Client {
    HTTP_CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client")
    })
}

fn netease_headers(cookie: &str) -> reqwest::header::HeaderMap {
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::USER_AGENT,
        reqwest::header::HeaderValue::from_static("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"),
    );
    headers.insert(
        reqwest::header::REFERER,
        reqwest::header::HeaderValue::from_static("https://music.163.com"),
    );
    if !cookie.is_empty() {
        if let Ok(val) = reqwest::header::HeaderValue::from_str(cookie) {
            headers.insert(reqwest::header::COOKIE, val);
        }
    }
    headers
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

    conn.execute("CREATE INDEX IF NOT EXISTS idx_plays_song_id ON plays(song_id)", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_plays_liked ON plays(liked)", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_plays_played_at ON plays(played_at)", [])?;

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
fn delete_playlist(state: State<AppState>, id: i64) -> Result<(), DbError> {
    let conn = state.db.lock().map_err(|_| DbError::Lock)?;
    conn.execute("DELETE FROM playlists WHERE id = ?1", params![id])?;
    Ok(())
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
    for cookie_env in ["VITE_NET_COOKIE", "NETEASE_COOKIE", "MUSIC_U"] {
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
                // Search keys in priority order across ALL lines (not line-by-line)
                // VITE_NET_COOKIE has __csrf etc., MUSIC_U alone is insufficient for VIP songs
                for cookie_key in ["VITE_NET_COOKIE=", "NETEASE_COOKIE=", "MUSIC_U="] {
                    for line in content.lines() {
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

    // Try CARGO_MANIFEST_DIR/../.env (for Tauri dev mode: cwd=src-tauri/, .env in parent claudio/)
    let manifest_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let env_path = manifest_dir.join("..").join(".env");
    if let Some(cookie) = try_load_env(&env_path) {
        return cookie;
    }
    let env_path = manifest_dir.join(".env");
    if let Some(cookie) = try_load_env(&env_path) {
        return cookie;
    }

    // Try current working directory
    let env_path = std::path::PathBuf::from(".env");
    if let Some(cookie) = try_load_env(&env_path) {
        return cookie;
    }

    // Try resources directory (for bundled resources)
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let env_path = exe_dir.join("resources").join(".env");
            if let Some(cookie) = try_load_env(&env_path) {
                return cookie;
            }
        }
    }

    log::warn!("No NETEASE_COOKIE found");
    String::new()
}

// Netease API Tauri commands - using IPC instead of HTTP
#[tauri::command]
async fn netease_search(keywords: String) -> Result<NeteaseSearchResult, String> {
    log::info!("[NETEASE_CMD] netease_search command called with keywords: {}", keywords);
    log::info!("[NETEASE_CMD] This is the IPC command - NOT the HTTP server");

    let client = get_http_client();

    let cookie = load_cookie();
    log::info!("[NETEASE_CMD] cookie length: {}", cookie.len());

    let headers = netease_headers(&cookie);

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

    // Check API response code
    let code = json["code"].as_u64().unwrap_or(0);
    if code != 200 {
        let msg = json["message"].as_str().unwrap_or("Unknown error");
        log::warn!("[NETEASE_CMD] Search API error {}: {}", code, msg);
        return Err(format!("API error {}: {}", code, msg));
    }

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
            let id = match song.get("id") {
                Some(v) => {
                    if let Some(n) = v.as_u64() {
                        Some(n)
                    } else if let Some(s) = v.as_str() {
                        s.parse().ok()
                    } else {
                        None
                    }
                }
                None => None
            };

            let name = match song.get("name") {
                Some(v) => v.as_str().map(|s| s.to_string()),
                None => None
            };

            let artists: Vec<NeteaseArtist> = match song.get("artists") {
                Some(v) => v.as_array().map(|arr| {
                    arr.iter().filter_map(|a| {
                        a.get("name").and_then(|n| n.as_str()).map(|s| NeteaseArtist { name: s.to_string() })
                    }).collect()
                }).unwrap_or_default(),
                None => vec![]
            };

            let album_name = match song.get("album") {
                Some(v) => v.get("name").and_then(|n| n.as_str()).map(|s| s.to_string()).unwrap_or_default(),
                None => String::new()
            };

            let album_pic = match song.get("album") {
                Some(v) => v.get("picUrl").and_then(|n| n.as_str()).map(|s| s.to_string()),
                None => None
            };

            let duration = match song.get("duration") {
                Some(v) => v.as_u64().or_else(|| v.as_str().and_then(|s| s.parse().ok())).unwrap_or(0),
                None => 0
            };

            match (id, name) {
                (Some(id), Some(name)) => Some(NeteaseSong {
                    id,
                    name,
                    artists,
                    album: NeteaseAlbum {
                        name: album_name,
                        pic_url: album_pic,
                    },
                    duration,
                }),
                _ => None
            }
        })
        .collect();

    log::info!("[NETEASE_CMD] Built {} NeteaseSong structs", songs.len());

    // Log the first song for debugging
    if let Some(first) = songs.first() {
        log::info!("[NETEASE_CMD] First song: id={}, name={}, artists={}", first.id, first.name, first.artists.len());
    }

    let result = NeteaseSearchResult { songs };
    log::info!("[NETEASE_CMD] Returning result with {} songs", result.songs.len());

    Ok(result)
}

#[tauri::command]
async fn netease_song_url(id: String) -> Result<String, String> {
    let client = get_http_client();

    let cookie = load_cookie();
    let headers = netease_headers(&cookie);

    // Try quality levels from high to low (VIP songs need lower bitrate)
    let api_url = "https://music.163.com/api/song/enhance/player/url";
    let bitrates = [320000, 192000, 128000];

    for &br in &bitrates {
        let body = format!("ids=[{}]&br={}", id, br);

        let resp = match client
            .post(api_url)
            .headers(headers.clone())
            .header(reqwest::header::CONTENT_TYPE, "application/x-www-form-urlencoded")
            .body(body)
            .send()
            .await
        {
            Ok(r) => r,
            Err(e) => {
                log::warn!("Song URL request failed for br={}: {}", br, e);
                continue;
            }
        };

        let text = match resp.text().await {
            Ok(t) => t,
            Err(e) => {
                log::warn!("Song URL read body failed for br={}: {}", br, e);
                continue;
            }
        };

        let json: serde_json::Value = match serde_json::from_str(&text) {
            Ok(j) => j,
            Err(e) => {
                log::warn!("Song URL JSON parse failed for br={}: {}", br, e);
                continue;
            }
        };

        // Check API response code
        let code = json["code"].as_u64().unwrap_or(0);
        if code != 200 {
            let msg = json["message"].as_str().unwrap_or("Unknown error");
            log::warn!("Song URL API error {} for br={}: {}", code, br, msg);
            continue;
        }

        let song_url = json.pointer("/data/0/url")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string());

        if let Some(u) = song_url {
            log::info!("Song URL found at br={} for id={}", br, id);
            return Ok(u);
        }
        log::info!("Song URL empty at br={} for id={}", br, id);
    }

    log::warn!("No playable URL found for song id={} at any bitrate", id);
    Ok(String::new())
}

#[tauri::command]
async fn netease_song_detail(ids: Vec<String>) -> Result<Vec<NeteaseSongDetail>, String> {
    if ids.is_empty() {
        return Ok(vec![]);
    }

    let client = get_http_client();

    let cookie = load_cookie();
    let headers = netease_headers(&cookie);

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

    // Check API response code
    let code = json["code"].as_u64().unwrap_or(0);
    if code != 200 {
        let msg = json["message"].as_str().unwrap_or("Unknown error");
        log::warn!("Song detail API error {}: {}", code, msg);
        return Err(format!("API error {}: {}", code, msg));
    }

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

#[tauri::command]
async fn netease_lyric(id: String) -> Result<String, String> {
    let client = get_http_client();

    let cookie = load_cookie();
    let headers = netease_headers(&cookie);

    let url = "https://music.163.com/api/song/lyric";

    let resp = client
        .get(url)
        .headers(headers)
        .query(&[("id", &id), ("lv", &"1".to_string()), ("kv", &"1".to_string())])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let text = resp.text().await.map_err(|e| e.to_string())?;
    // Parse to validate, but return raw text for frontend compatibility
    let json: serde_json::Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    let code = json["code"].as_u64().unwrap_or(0);
    if code != 200 {
        let msg = json["message"].as_str().unwrap_or("Unknown error");
        log::warn!("Lyric API error {}: {}", code, msg);
        return Err(format!("API error {}: {}", code, msg));
    }
    Ok(text)
}

#[tauri::command]
async fn netease_user_playlists(uid: String) -> Result<Vec<NeteaseUserPlaylist>, String> {
    let cookie = load_cookie();
    let client = get_http_client();

    let headers = netease_headers(&cookie);

    let url = format!("https://music.163.com/api/user/playlist?uid={}&limit=100&offset=0", uid);

    let resp = client
        .get(&url)
        .headers(headers)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("Read body failed: {}", e))?;

    if !status.is_success() {
        return Err(format!("HTTP {}: {}", status.as_u16(), &text[..text.len().min(200)]));
    }

    let data: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| format!("Parse JSON failed: {}", e))?;

    // Check API response code
    let code = data["code"].as_u64().unwrap_or(0);
    if code != 200 {
        let msg = data["message"].as_str().unwrap_or("Unknown error");
        return Err(format!("API error {}: {}", code, msg));
    }

    let playlists = data["playlist"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .map(|item| NeteaseUserPlaylist {
                    id: item["id"].as_u64().unwrap_or(0),
                    name: item["name"].as_str().unwrap_or("").to_string(),
                    track_count: item["trackCount"].as_u64().unwrap_or(0),
                    cover_img_url: item["coverImgUrl"].as_str().map(|s| s.to_string()),
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(playlists)
}

#[tauri::command]
async fn netease_playlist_detail(id: String) -> Result<Vec<NeteaseSong>, String> {
    let cookie = load_cookie();
    let client = get_http_client();

    let headers = netease_headers(&cookie);

    let url = format!("https://music.163.com/api/playlist/detail?id={}&limit=1000", id);

    let resp = client
        .get(&url)
        .headers(headers)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("Read body failed: {}", e))?;

    if !status.is_success() {
        return Err(format!("HTTP {}: {}", status.as_u16(), &text[..text.len().min(200)]));
    }

    let data: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| format!("Parse JSON failed: {}", e))?;

    // Check API response code
    let code = data["code"].as_u64().unwrap_or(0);
    if code != 200 {
        let msg = data["message"].as_str().unwrap_or("Unknown error");
        log::warn!("Playlist detail API error {}: {}", code, msg);
        return Err(format!("API error {}: {}", code, msg));
    }

    // Try result.tracks first (old API), fallback to playlist.tracks
    let tracks_array = data["result"]["tracks"]
        .as_array()
        .or_else(|| data["playlist"]["tracks"].as_array());

    let tracks: Vec<NeteaseSong> = tracks_array
        .map(|arr| {
            arr.iter()
                .map(|item| {
                    let artists = item["ar"]
                        .as_array()
                        .map(|ar| {
                            ar.iter()
                                .map(|a| NeteaseArtist {
                                    name: a["name"].as_str().unwrap_or("").to_string(),
                                })
                                .collect()
                        })
                        .unwrap_or_default();

                    NeteaseSong {
                        id: item["id"].as_u64().unwrap_or(0),
                        name: item["name"].as_str().unwrap_or("").to_string(),
                        artists,
                        album: NeteaseAlbum {
                            name: item["al"]["name"].as_str().unwrap_or("").to_string(),
                            pic_url: item["al"]["picUrl"].as_str().map(|s| s.to_string()),
                        },
                        duration: item["dt"].as_u64().unwrap_or(0),
                    }
                })
                .collect()
        })
        .unwrap_or_default();

    log::info!("Playlist detail: got {} tracks for id {}", tracks.len(), id);
    Ok(tracks)
}

fn load_tts_config() -> (String, String, String) {
    // Defaults
    let default_key = "";
    let default_model = "mimo-v2.5-tts";
    let default_url = "https://api.xiaomimimo.com/v1/chat/completions";

    let mut api_key = String::new();
    let mut model = String::new();
    let mut api_url = String::new();

    // Check environment variables
    for (env_name, target) in [
        ("VITE_TTS_KEY", &mut api_key),
        ("VITE_TTS_MODEL", &mut model),
        ("VITE_TTS_URL", &mut api_url),
    ] {
        if let Ok(val) = std::env::var(env_name) {
            if !val.is_empty() && target.is_empty() {
                *target = val;
            }
        }
    }
    // Fallback: VITE_CHAT_API_KEY also works for TTS
    if api_key.is_empty() {
        if let Ok(val) = std::env::var("VITE_CHAT_API_KEY") {
            if !val.is_empty() {
                api_key = val;
            }
        }
    }

    // Try .env files for missing values
    let mut try_load = |env_path: &std::path::Path| -> Option<(String, String)> {
        if env_path.exists() {
            if let Ok(content) = std::fs::read_to_string(env_path) {
                let mut found_key = String::new();
                let mut found_url = String::new();
                for line in content.lines() {
                    for key in ["VITE_TTS_KEY=", "VITE_CHAT_API_KEY=", "VITE_TTS_URL=", "VITE_TTS_MODEL="] {
                        if line.starts_with(key) {
                            let val = line.trim_start_matches(key).trim();
                            if !val.is_empty() {
                                match key {
                                    "VITE_TTS_MODEL=" => { if model.is_empty() { model = val.to_string(); } }
                                    "VITE_TTS_URL=" => { if found_url.is_empty() { found_url = val.to_string(); } }
                                    _ => { if found_key.is_empty() { found_key = val.to_string(); } }
                                }
                            }
                        }
                    }
                }
                if !found_key.is_empty() || !found_url.is_empty() {
                    return Some((found_key, found_url));
                }
            }
        }
        None
    };

    // Search .env in standard locations
    if let Some(app_dir) = dirs::data_local_dir() {
        try_load(&app_dir.join("claudio").join(".env"));
    }
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            try_load(&exe_dir.join(".env"));
            try_load(&exe_dir.join("claudio").join(".env"));
            try_load(&exe_dir.join("resources").join(".env"));
        }
    }
    let manifest_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    try_load(&manifest_dir.join("..").join(".env"));
    try_load(&manifest_dir.join(".env"));
    try_load(&std::path::PathBuf::from(".env"));

    (
        if api_key.is_empty() { default_key.to_string() } else { api_key },
        if model.is_empty() { default_model.to_string() } else { model },
        if api_url.is_empty() { default_url.to_string() } else { api_url },
    )
}

#[tauri::command]
async fn tts_synthesize(
    text: String,
    api_key: Option<String>,
    model: Option<String>,
    api_url: Option<String>,
) -> Result<String, String> {
    let (fallback_key, fallback_model, fallback_url) = load_tts_config();
    let api_key = api_key.filter(|k| !k.is_empty()).unwrap_or(fallback_key);
    let model = model.filter(|m| !m.is_empty()).unwrap_or(fallback_model);
    let api_url = api_url.filter(|u| !u.is_empty()).unwrap_or(fallback_url);

    if api_key.is_empty() {
        return Err("TTS API key not configured".to_string());
    }

    let voice_style = "用清澈温柔的女声，语调平稳略带冷淡，像一个忠诚的天使在轻声播报，声音空灵治愈，不带太多情感起伏但能感受到关心。";

    let client = get_http_client();
    let body = serde_json::json!({
        "model": model,
        "messages": [
            { "role": "user", "content": voice_style },
            { "role": "assistant", "content": text }
        ],
        "audio": {
            "format": "wav",
            "voice": "茉莉"
        }
    });

    let resp = client
        .post(&api_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("TTS request failed: {}", e))?;

    let status = resp.status();
    if !status.is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("TTS HTTP {}: {}", status.as_u16(), &text[..text.len().min(200)]));
    }

    let data: serde_json::Value = resp.json().await.map_err(|e| format!("TTS parse error: {}", e))?;

    // Extract base64 audio from response
    let audio_base64 = data["choices"][0]["message"]["audio"]["data"]
        .as_str()
        .or_else(|| data["audio"]["data"].as_str())
        .or_else(|| data["data"]["audio"].as_str())
        .ok_or("No audio data in TTS response")?;

    Ok(audio_base64.to_string())
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
            delete_playlist,
            set_preference,
            get_preference,
            netease_search,
            netease_song_url,
            netease_song_detail,
            netease_lyric,
            netease_user_playlists,
            netease_playlist_detail,
            tts_synthesize,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
