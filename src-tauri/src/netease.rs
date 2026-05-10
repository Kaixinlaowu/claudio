use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

use crate::config::{get_cached_cookie, get_cached_tts_config};

// --- Types ---

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
    #[serde(alias = "picUrl")]
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
pub struct NeteaseUserPlaylist {
    pub id: u64,
    pub name: String,
    #[serde(rename = "trackCount")]
    pub track_count: u64,
    #[serde(rename = "coverImgUrl")]
    pub cover_img_url: Option<String>,
}

// --- HTTP client ---

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
        reqwest::header::HeaderValue::from_static(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        ),
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

/// Shared helper: check API response code and return error if not 200.
fn check_api_code(json: &serde_json::Value) -> Result<(), String> {
    let code = json["code"].as_u64().unwrap_or(0);
    if code != 200 {
        let msg = json["message"].as_str().unwrap_or("Unknown error");
        return Err(format!("API error {}: {}", code, msg));
    }
    Ok(())
}

// --- Tauri commands ---

#[derive(Debug, Serialize)]
pub struct NeteaseSearchResult {
    pub songs: Vec<NeteaseSong>,
}

#[tauri::command]
pub async fn netease_search(keywords: String) -> Result<NeteaseSearchResult, String> {
    let client = get_http_client();
    let headers = netease_headers(get_cached_cookie());

    let resp = client
        .get("https://music.163.com/api/search/get")
        .headers(headers)
        .query(&[
            ("s", keywords.as_str()),
            ("type", "1"),
            ("limit", "20"),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = resp.status();
    let text = resp.text().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        return Err(format!(
            "API returned error status {}: {}",
            status,
            &text[..std::cmp::min(200, text.len())]
        ));
    }

    let json: serde_json::Value = serde_json::from_str(&text).map_err(|e| {
        format!(
            "JSON parse error: {}. Body: {}",
            e,
            &text[..std::cmp::min(200, text.len())]
        )
    })?;

    check_api_code(&json)?;

    let songs: Vec<NeteaseSong> = json
        .pointer("/result/songs")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default();

    log::info!("[netease_search] Found {} songs", songs.len());
    Ok(NeteaseSearchResult { songs })
}

#[tauri::command]
pub async fn netease_song_url(id: String) -> Result<String, String> {
    let client = get_http_client();
    let headers = netease_headers(get_cached_cookie());
    let api_url = "https://music.163.com/api/song/enhance/player/url";

    for &br in &[320000u32, 192000, 128000] {
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

        if check_api_code(&json).is_err() {
            continue;
        }

        if let Some(url) = json
            .pointer("/data/0/url")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
        {
            log::info!("Song URL found at br={} for id={}", br, id);
            return Ok(url.to_string());
        }
    }

    log::warn!("No playable URL found for song id={}", id);
    Ok(String::new())
}

#[tauri::command]
pub async fn netease_song_detail(ids: Vec<String>) -> Result<Vec<NeteaseSongDetail>, String> {
    if ids.is_empty() {
        return Ok(vec![]);
    }

    let client = get_http_client();
    let headers = netease_headers(get_cached_cookie());

    let ids_param = format!("[{}]", ids.join(","));
    let resp = client
        .get("https://music.163.com/api/song/detail")
        .headers(headers)
        .query(&[("ids", &ids_param)])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let text = resp.text().await.map_err(|e| e.to_string())?;
    let json: serde_json::Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    check_api_code(&json)?;

    let songs: Vec<NeteaseSongDetail> = json
        .pointer("/songs")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default();

    Ok(songs)
}

#[tauri::command]
pub async fn netease_lyric(id: String) -> Result<String, String> {
    let client = get_http_client();
    let headers = netease_headers(get_cached_cookie());

    let resp = client
        .get("https://music.163.com/api/song/lyric")
        .headers(headers)
        .query(&[("id", &id), ("lv", &"1".to_string()), ("kv", &"1".to_string()), ("tv", &"1".to_string())])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let text = resp.text().await.map_err(|e| e.to_string())?;
    let json: serde_json::Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    check_api_code(&json)?;
    Ok(text)
}

#[tauri::command]
pub async fn netease_user_playlists(uid: String) -> Result<Vec<NeteaseUserPlaylist>, String> {
    let client = get_http_client();
    let headers = netease_headers(get_cached_cookie());

    let url = format!(
        "https://music.163.com/api/user/playlist?uid={}&limit=100&offset=0",
        uid
    );

    let resp = client
        .get(&url)
        .headers(headers)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| format!("Read body failed: {}", e))?;

    if !status.is_success() {
        return Err(format!(
            "HTTP {}: {}",
            status.as_u16(),
            &text[..text.len().min(200)]
        ));
    }

    let data: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("Parse JSON failed: {}", e))?;
    check_api_code(&data)?;

    let playlists: Vec<NeteaseUserPlaylist> = data["playlist"]
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
pub async fn netease_playlist_detail(id: String) -> Result<Vec<NeteaseSong>, String> {
    let client = get_http_client();
    let headers = netease_headers(get_cached_cookie());

    let url = format!(
        "https://music.163.com/api/v3/playlist/detail?id={}&n=1000",
        id
    );

    let resp = client
        .get(&url)
        .headers(headers.clone())
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| format!("Read body failed: {}", e))?;

    if !status.is_success() {
        return Err(format!(
            "HTTP {}: {}",
            status.as_u16(),
            &text[..text.len().min(200)]
        ));
    }

    let data: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("Parse JSON failed: {}", e))?;
    check_api_code(&data)?;

    // Parse inline tracks from the response (limited to ~100 by the API)
    let inline_tracks: Vec<NeteaseSong> = data["playlist"]["tracks"]
        .as_array()
        .or_else(|| data["result"]["tracks"].as_array())
        .and_then(|arr| serde_json::from_value(serde_json::Value::Array(arr.clone())).ok())
        .unwrap_or_default();

    // Get all track IDs from trackIds array (contains ALL songs)
    let all_track_ids: Vec<u64> = data["playlist"]["trackIds"]
        .as_array()
        .or_else(|| data["result"]["trackIds"].as_array())
        .map(|arr| arr.iter().filter_map(|item| item["id"].as_u64()).collect())
        .unwrap_or_default();

    if all_track_ids.is_empty() {
        log::warn!(
            "Playlist detail: no trackIds for id {}, returning {} inline tracks",
            id,
            inline_tracks.len()
        );
        return Ok(inline_tracks);
    }

    // Collect IDs already fetched from inline tracks
    let inline_ids: std::collections::HashSet<u64> = inline_tracks.iter().map(|t| t.id).collect();
    let missing_ids: Vec<u64> = all_track_ids
        .iter()
        .filter(|id| !inline_ids.contains(id))
        .cloned()
        .collect();

    if missing_ids.is_empty() {
        return Ok(inline_tracks);
    }

    // Batch-fetch missing song details in chunks of 100
    log::info!(
        "Playlist detail: {} inline, {} missing, fetching...",
        inline_tracks.len(),
        missing_ids.len()
    );

    let mut all_tracks = inline_tracks;
    for chunk in missing_ids.chunks(100) {
        let ids_param: Vec<String> = chunk.iter().map(|id| id.to_string()).collect();
        let ids_json = format!("[{}]", ids_param.join(","));

        let detail_resp = client
            .get("https://music.163.com/api/song/detail")
            .headers(headers.clone())
            .query(&[("ids", &ids_json)])
            .send()
            .await;

        match detail_resp {
            Ok(resp) => {
                if let Ok(text) = resp.text().await {
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                        if let Some(songs) = json["songs"].as_array() {
                            if let Ok(parsed) =
                                serde_json::from_value::<Vec<NeteaseSong>>(
                                    serde_json::Value::Array(songs.clone()),
                                )
                            {
                                all_tracks.extend(parsed);
                            }
                        }
                    }
                }
            }
            Err(e) => log::warn!("Failed to fetch song details chunk: {}", e),
        }
    }

    // Reorder to match the original trackIds order
    let id_order: std::collections::HashMap<u64, usize> = all_track_ids
        .iter()
        .enumerate()
        .map(|(i, id)| (*id, i))
        .collect();
    all_tracks.sort_by_key(|t| id_order.get(&t.id).copied().unwrap_or(usize::MAX));

    log::info!("Playlist detail: total {} tracks for id {}", all_tracks.len(), id);
    Ok(all_tracks)
}

#[tauri::command]
pub async fn tts_synthesize(
    text: String,
    api_key: Option<String>,
    model: Option<String>,
    api_url: Option<String>,
) -> Result<String, String> {
    let (ref fallback_key, ref fallback_model, ref fallback_url) = get_cached_tts_config();
    let api_key = api_key.filter(|k| !k.is_empty()).unwrap_or_else(|| fallback_key.clone());
    let model = model.filter(|m| !m.is_empty()).unwrap_or_else(|| fallback_model.clone());
    let api_url = api_url.filter(|u| !u.is_empty()).unwrap_or_else(|| fallback_url.clone());

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
        return Err(format!(
            "TTS HTTP {}: {}",
            status.as_u16(),
            &text[..text.len().min(200)]
        ));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("TTS parse error: {}", e))?;

    let audio_base64 = data["choices"][0]["message"]["audio"]["data"]
        .as_str()
        .or_else(|| data["audio"]["data"].as_str())
        .or_else(|| data["data"]["audio"].as_str())
        .ok_or("No audio data in TTS response")?;

    Ok(audio_base64.to_string())
}
