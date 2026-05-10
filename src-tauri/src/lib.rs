mod config;
mod netease;

use chrono::Utc;
use rusqlite::{Connection, params, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use tauri::{State, Manager};
use tokio::sync::Mutex;
use thiserror::Error;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

#[derive(Error, Debug)]
pub enum DbError {
    #[error("Database error: {0}")]
    Sqlite(#[from] rusqlite::Error),
}

impl Serialize for DbError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SongMeta {
    pub song_id: String,
    pub name: String,
    pub artist: String,
    pub album: String,
    pub cover_url: Option<String>,
    pub duration: Option<i64>,
    pub local_cover: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlaylistInfo {
    pub id: i64,
    pub name: String,
    pub song_count: i64,
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

    conn.execute(
        "CREATE TABLE IF NOT EXISTS songs (
            song_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            artist TEXT NOT NULL DEFAULT '',
            album TEXT NOT NULL DEFAULT '',
            cover_url TEXT,
            duration INTEGER DEFAULT 0,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS playlist_songs (
            playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
            song_id TEXT NOT NULL REFERENCES songs(song_id),
            position INTEGER NOT NULL,
            PRIMARY KEY (playlist_id, song_id)
        )",
        [],
    )?;

    conn.execute("CREATE INDEX IF NOT EXISTS idx_plays_song_id ON plays(song_id)", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_plays_liked ON plays(liked)", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_plays_played_at ON plays(played_at)", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_ps_playlist ON playlist_songs(playlist_id, position)", [])?;

    Ok(())
}

fn migrate_v2(conn: &Connection) -> SqliteResult<()> {
    // Migrate songs from plays table
    conn.execute(
        "INSERT OR IGNORE INTO songs (song_id, name, artist, album, cover_url)
         SELECT DISTINCT song_id, song_name, artist, album, cover_url
         FROM plays WHERE song_id IS NOT NULL AND song_id != ''",
        [],
    )?;

    // Migrate playlist songs from CSV
    let mut stmt = conn.prepare("SELECT id, song_ids FROM playlists WHERE song_ids IS NOT NULL AND song_ids != ''")?;
    let rows: Vec<(i64, String)> = stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
        .filter_map(|r| r.ok())
        .collect();

    for (playlist_id, csv) in rows {
        let song_ids: Vec<&str> = csv.split(',').filter(|s| !s.is_empty()).collect();
        for (pos, song_id) in song_ids.iter().enumerate() {
            // Ensure song exists in songs table
            conn.execute(
                "INSERT OR IGNORE INTO songs (song_id, name, artist, album) VALUES (?1, ?1, '', '')",
                params![song_id],
            )?;
            conn.execute(
                "INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, position) VALUES (?1, ?2, ?3)",
                params![playlist_id, song_id, pos as i64],
            )?;
        }
    }

    log::info!("Database migration v2 completed");
    Ok(())
}

fn migrate_v3(conn: &Connection) -> SqliteResult<()> {
    // Add local_cover column to songs table
    conn.execute(
        "ALTER TABLE songs ADD COLUMN local_cover TEXT",
        [],
    ).ok(); // Ignore if column already exists
    log::info!("Database migration v3 completed");
    Ok(())
}

#[tauri::command]
async fn add_play_record(state: State<'_, AppState>, record: PlayRecord) -> Result<PlayRecord, DbError> {
    let conn = state.db.lock().await;
    // Upsert into songs table
    conn.execute(
        "INSERT INTO songs (song_id, name, artist, album, cover_url)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(song_id) DO UPDATE SET
           name = excluded.name, artist = excluded.artist, album = excluded.album,
           cover_url = excluded.cover_url, updated_at = CURRENT_TIMESTAMP",
        params![&record.song_id, &record.song_name, &record.artist, &record.album, &record.cover_url],
    )?;
    // Insert play record (keep redundant columns for backward compat)
    conn.execute("DELETE FROM plays WHERE song_id = ?1", params![&record.song_id])?;
    conn.execute(
        "INSERT INTO plays (song_id, song_name, artist, album, cover_url, url, liked)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            &record.song_id, &record.song_name, &record.artist,
            &record.album, &record.cover_url, &record.url, record.liked,
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
async fn delete_play_record(state: State<'_, AppState>, id: i64) -> Result<(), DbError> {
    let conn = state.db.lock().await;
    conn.execute("DELETE FROM plays WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
async fn get_play_history(state: State<'_, AppState>, limit: Option<i64>) -> Result<Vec<PlayRecord>, DbError> {
    let conn = state.db.lock().await;
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
async fn get_liked_songs(state: State<'_, AppState>, limit: Option<i64>) -> Result<Vec<PlayRecord>, DbError> {
    let conn = state.db.lock().await;
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
async fn toggle_like(state: State<'_, AppState>, id: i64, liked: bool) -> Result<(), DbError> {
    let conn = state.db.lock().await;
    conn.execute("UPDATE plays SET liked = ?1 WHERE id = ?2", params![liked, id])?;
    Ok(())
}

#[tauri::command]
async fn save_playlist(state: State<'_, AppState>, playlist: Playlist) -> Result<Playlist, DbError> {
    let conn = state.db.lock().await;
    if let Some(id) = playlist.id {
        conn.execute(
            "UPDATE playlists SET name = ?1 WHERE id = ?2",
            params![&playlist.name, id],
        )?;
        Ok(playlist)
    } else {
        conn.execute(
            "INSERT INTO playlists (name, song_ids) VALUES (?1, '')",
            params![&playlist.name],
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
async fn get_playlists(state: State<'_, AppState>) -> Result<Vec<PlaylistInfo>, DbError> {
    let conn = state.db.lock().await;
    let mut stmt = conn.prepare(
        "SELECT p.id, p.name, COUNT(ps.song_id), p.created_at
         FROM playlists p
         LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
         GROUP BY p.id ORDER BY p.created_at DESC"
    )?;
    let playlists = stmt.query_map([], |row| {
        Ok(PlaylistInfo {
            id: row.get(0)?,
            name: row.get(1)?,
            song_count: row.get(2)?,
            created_at: row.get(3)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    Ok(playlists)
}

#[tauri::command]
async fn delete_playlist(state: State<'_, AppState>, id: i64) -> Result<(), DbError> {
    let conn = state.db.lock().await;
    conn.execute("DELETE FROM playlists WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
async fn set_preference(state: State<'_, AppState>, key: String, value: String) -> Result<(), DbError> {
    let conn = state.db.lock().await;
    conn.execute(
        "INSERT OR REPLACE INTO preferences (key, value) VALUES (?1, ?2)",
        params![&key, &value],
    )?;
    Ok(())
}

#[tauri::command]
async fn get_preference(state: State<'_, AppState>, key: String) -> Result<Option<String>, DbError> {
    let conn = state.db.lock().await;
    let result = conn.query_row(
        "SELECT value FROM preferences WHERE key = ?1",
        params![&key],
        |row| row.get(0),
    ).ok();
    Ok(result)
}

#[tauri::command]
async fn upsert_song(state: State<'_, AppState>, song: SongMeta) -> Result<(), DbError> {
    let conn = state.db.lock().await;
    conn.execute(
        "INSERT INTO songs (song_id, name, artist, album, cover_url, duration, local_cover)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(song_id) DO UPDATE SET
           name = excluded.name, artist = excluded.artist, album = excluded.album,
           cover_url = excluded.cover_url, duration = excluded.duration,
           local_cover = COALESCE(excluded.local_cover, songs.local_cover),
           updated_at = CURRENT_TIMESTAMP",
        params![
            &song.song_id, &song.name, &song.artist, &song.album,
            &song.cover_url, song.duration.unwrap_or(0), &song.local_cover,
        ],
    )?;
    Ok(())
}

#[tauri::command]
async fn get_songs_by_ids(state: State<'_, AppState>, ids: Vec<String>) -> Result<Vec<SongMeta>, DbError> {
    if ids.is_empty() { return Ok(vec![]); }
    let conn = state.db.lock().await;
    let placeholders: Vec<String> = ids.iter().enumerate().map(|(i, _)| format!("?{}", i + 1)).collect();
    let sql = format!(
        "SELECT song_id, name, artist, album, cover_url, duration, local_cover FROM songs WHERE song_id IN ({})",
        placeholders.join(",")
    );
    let params_val: Vec<Box<dyn rusqlite::types::ToSql>> = ids.into_iter()
        .map(|id| Box::new(id) as Box<dyn rusqlite::types::ToSql>)
        .collect();
    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params_val.iter().map(|p| p.as_ref()).collect();
    let mut stmt = conn.prepare(&sql)?;
    let songs = stmt.query_map(param_refs.as_slice(), |row| {
        Ok(SongMeta {
            song_id: row.get(0)?,
            name: row.get(1)?,
            artist: row.get(2)?,
            album: row.get(3)?,
            cover_url: row.get(4)?,
            duration: row.get(5)?,
            local_cover: row.get(6)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    Ok(songs)
}

#[tauri::command]
async fn save_playlist_songs(state: State<'_, AppState>, playlist_id: i64, song_ids: Vec<String>) -> Result<(), DbError> {
    let conn = state.db.lock().await;
    conn.execute("DELETE FROM playlist_songs WHERE playlist_id = ?1", params![playlist_id])?;
    for (pos, song_id) in song_ids.iter().enumerate() {
        conn.execute(
            "INSERT OR IGNORE INTO songs (song_id, name, artist, album) VALUES (?1, ?1, '', '')",
            params![song_id],
        )?;
        conn.execute(
            "INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES (?1, ?2, ?3)",
            params![playlist_id, song_id, pos as i64],
        )?;
    }
    Ok(())
}

#[tauri::command]
async fn get_playlist_song_ids(state: State<'_, AppState>, playlist_id: i64) -> Result<Vec<String>, DbError> {
    let conn = state.db.lock().await;
    let mut stmt = conn.prepare(
        "SELECT song_id FROM playlist_songs WHERE playlist_id = ?1 ORDER BY position"
    )?;
    let ids = stmt.query_map(params![playlist_id], |row| row.get(0))?
        .collect::<Result<Vec<String>, _>>()?;
    Ok(ids)
}

#[tauri::command]
fn check_cookie_status() -> Result<String, String> {
    config::check_cookie_status()
}

#[tauri::command]
async fn cache_cover(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
    song_id: String,
    cover_url: String,
) -> Result<Option<String>, String> {
    if cover_url.is_empty() {
        return Ok(None);
    }

    let covers_dir = app_handle.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join("covers");
    std::fs::create_dir_all(&covers_dir).map_err(|e| e.to_string())?;

    let mut hasher = DefaultHasher::new();
    cover_url.hash(&mut hasher);
    let hash = format!("{:016x}", hasher.finish());
    let ext = if cover_url.contains(".png") { "png" } else { "jpg" };
    let filename = format!("{}.{}", hash, ext);
    let local_path = covers_dir.join(&filename);

    if local_path.exists() {
        let path_str = local_path.to_string_lossy().to_string();
        let conn = state.db.lock().await;
        conn.execute(
            "UPDATE songs SET local_cover = ?1 WHERE song_id = ?2 AND (local_cover IS NULL OR local_cover = '')",
            params![&path_str, &song_id],
        ).ok();
        return Ok(Some(path_str));
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client.get(&cover_url)
        .send().await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Ok(None);
    }

    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    std::fs::write(&local_path, &bytes).map_err(|e| e.to_string())?;

    let path_str = local_path.to_string_lossy().to_string();
    let conn = state.db.lock().await;
    conn.execute(
        "UPDATE songs SET local_cover = ?1 WHERE song_id = ?2",
        params![&path_str, &song_id],
    ).ok();

    Ok(Some(path_str))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_dir = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("claudio");
    std::fs::create_dir_all(&app_dir).ok();

    config::init_caches();
    log::info!("Config caches initialized, cookie length: {}", config::get_cached_cookie().len());

    let db_path = app_dir.join("claudio.db");
    let conn = Connection::open(&db_path).unwrap_or_else(|e| {
        log::warn!("DB open failed: {}, trying in-memory", e);
        Connection::open_in_memory().expect("Cannot open any database")
    });
    init_db(&conn).ok();
    migrate_v2(&conn).ok();
    migrate_v3(&conn).ok();

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
            delete_play_record,
            get_play_history,
            get_liked_songs,
            toggle_like,
            save_playlist,
            get_playlists,
            delete_playlist,
            set_preference,
            get_preference,
            netease::netease_search,
            netease::netease_song_url,
            netease::netease_song_detail,
            netease::netease_lyric,
            netease::netease_user_playlists,
            netease::netease_playlist_detail,
            check_cookie_status,
            upsert_song,
            get_songs_by_ids,
            save_playlist_songs,
            get_playlist_song_ids,
            cache_cover,

            netease::tts_synthesize,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
