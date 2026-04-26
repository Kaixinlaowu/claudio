use actix_web::{web, App, HttpResponse, HttpServer};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::Duration;

pub struct NeteaseState {
    pub client: Client,
    pub cookie: String,
}

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    keywords: String,
}

#[derive(Debug, Deserialize)]
pub struct SongUrlQuery {
    id: String,
}

#[derive(Debug, Deserialize)]
pub struct DetailQuery {
    ids: String,
}

#[derive(Debug, Deserialize)]
pub struct LyricQuery {
    id: String,
}

#[derive(Debug, Deserialize)]
pub struct AlbumQuery {
    id: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct TtsRequest {
    url: String,
    api_key: Option<String>,
    model: Option<String>,
    messages: Option<Vec<serde_json::Value>>,
    audio: Option<bool>,
}

fn get_netease_headers(cookie: &str) -> reqwest::header::HeaderMap {
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
    headers
}

pub async fn search(
    state: web::Data<Mutex<NeteaseState>>,
    query: web::Query<SearchQuery>,
) -> HttpResponse {
    let state = state.lock().unwrap();
    let url = "https://music.163.com/api/search/get";
    log::info!("[NETEASE_API] search called with keywords: {}", query.keywords);
    log::info!("[NETEASE_API] cookie length: {}", state.cookie.len());

    match state
        .client
        .get(url)
        .headers(get_netease_headers(&state.cookie))
        .query(&[("s", &query.keywords), ("type", &"1".to_string()), ("limit", &"20".to_string())])
        .send()
        .await
    {
        Ok(resp) => {
            let status = resp.status().as_u16();
            log::info!("[NETEASE_API] Netease response status: {}", status);
            match resp.text().await {
                Ok(text) => {
                    log::info!("[NETEASE_API] Response body length: {}", text.len());
                    // Log first 200 chars of response
                    let preview = if text.len() > 200 { format!("{}...", &text[..200]) } else { text.clone() };
                    log::info!("[NETEASE_API] Response preview: {}", preview);
                    HttpResponse::Ok()
                        .content_type("application/json")
                        .body(text)
                },
                Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()})),
            }
        }
        Err(e) => {
            log::error!("[NETEASE_API] Failed to call Netease: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()}))
        },
    }
}

pub async fn song_url(
    state: web::Data<Mutex<NeteaseState>>,
    query: web::Query<SongUrlQuery>,
) -> HttpResponse {
    let state = state.lock().unwrap();
    let url = "https://music.163.com/api/song/enhance/player/url";

    let body = format!("ids=[{}]&br=320000", query.id);

    match state
        .client
        .post(url)
        .headers(get_netease_headers(&state.cookie))
        .header(reqwest::header::CONTENT_TYPE, "application/x-www-form-urlencoded")
        .body(body)
        .send()
        .await
    {
        Ok(resp) => {
            match resp.text().await {
                Ok(text) => HttpResponse::Ok()
                    .content_type("application/json")
                    .body(text),
                Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()})),
            }
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()})),
    }
}

pub async fn song_detail(
    state: web::Data<Mutex<NeteaseState>>,
    query: web::Query<DetailQuery>,
) -> HttpResponse {
    let state = state.lock().unwrap();
    let url = "https://music.163.com/api/song/detail";

    let ids_param = format!("[{}]", query.ids);

    match state
        .client
        .get(url)
        .headers(get_netease_headers(&state.cookie))
        .query(&[("ids", &ids_param)])
        .send()
        .await
    {
        Ok(resp) => {
            match resp.text().await {
                Ok(text) => HttpResponse::Ok()
                    .content_type("application/json")
                    .body(text),
                Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()})),
            }
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()})),
    }
}

pub async fn lyric(query: web::Query<LyricQuery>) -> HttpResponse {
    let client = Client::new();
    let url = "https://music.163.com/api/song/lyric";

    match client
        .get(url)
        .header(reqwest::header::USER_AGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .header(reqwest::header::REFERER, "https://music.163.com")
        .query(&[("id", &query.id), ("lv", &"1".to_string()), ("kv", &"1".to_string())])
        .timeout(Duration::from_secs(10))
        .send()
        .await
    {
        Ok(resp) => {
            match resp.text().await {
                Ok(text) => HttpResponse::Ok()
                    .content_type("application/json")
                    .body(text),
                Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()})),
            }
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()})),
    }
}

pub async fn album(query: web::Query<AlbumQuery>) -> HttpResponse {
    let client = Client::new();
    let url = "https://music.163.com/api/album";

    match client
        .get(url)
        .header(reqwest::header::USER_AGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .header(reqwest::header::REFERER, "https://music.163.com")
        .query(&[("id", &query.id)])
        .timeout(Duration::from_secs(10))
        .send()
        .await
    {
        Ok(resp) => {
            match resp.text().await {
                Ok(text) => HttpResponse::Ok()
                    .content_type("application/json")
                    .body(text),
                Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()})),
            }
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()})),
    }
}

pub async fn health() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "ok",
        "service": "NeteaseApi-Rust"
    }))
}

pub async fn debug_state(state: web::Data<Mutex<NeteaseState>>) -> HttpResponse {
    let state = state.lock().unwrap();
    let cookie_present = !state.cookie.is_empty();
    let cookie_preview = if state.cookie.len() > 50 {
        format!("{}...", &state.cookie[..50])
    } else {
        state.cookie.clone()
    };
    HttpResponse::Ok().json(serde_json::json!({
        "status": "ok",
        "cookie_present": cookie_present,
        "cookie_length": state.cookie.len(),
        "cookie_preview": cookie_preview,
    }))
}

pub async fn test_search(state: web::Data<Mutex<NeteaseState>>) -> HttpResponse {
    let state = state.lock().unwrap();
    let test_url = "https://music.163.com/api/search/get";

    match state
        .client
        .get(test_url)
        .headers(get_netease_headers(&state.cookie))
        .query(&[("s", "周杰伦"), ("type", "1"), ("limit", "3")])
        .send()
        .await
    {
        Ok(resp) => {
            let status = resp.status().as_u16();
            match resp.text().await {
                Ok(text) => HttpResponse::Ok().json(serde_json::json!({
                    "status": status,
                    "response": text,
                })),
                Err(e) => HttpResponse::Ok().json(serde_json::json!({
                    "status": status,
                    "error": e.to_string()
                })),
            }
        }
        Err(e) => HttpResponse::Ok().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}

pub async fn tts_proxy(body: web::Json<TtsRequest>) -> HttpResponse {
    let client = Client::new();

    let TtsRequest {
        url,
        api_key,
        model,
        messages,
        audio,
    } = body.into_inner();

    if url.is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "url is required"}));
    }

    let request_body = serde_json::to_string(&TtsRequest {
        url: url.clone(),
        api_key: api_key.clone(),
        model: model.clone(),
        messages: messages.clone(),
        audio,
    }).unwrap_or_default();

    match client
        .post(&url)
        .header(reqwest::header::CONTENT_TYPE, "application/json; charset=utf-8")
        .header("api-key", api_key.as_deref().unwrap_or(""))
        .body(request_body)
        .timeout(Duration::from_secs(30))
        .send()
        .await
    {
        Ok(resp) => {
            match resp.bytes().await {
                Ok(bytes) => HttpResponse::Ok()
                    .content_type("application/json")
                    .body(bytes.to_vec()),
                Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()})),
            }
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()})),
    }
}

pub fn start_server(cookie: String) {
    let cookie_clone = cookie.clone();
    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().expect("Failed to create runtime");

        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        let state = web::Data::new(Mutex::new(NeteaseState {
            client,
            cookie: cookie_clone,
        }));

        let server = HttpServer::new(move || {
            App::new()
                .app_data(state.clone())
                .route("/", web::get().to(health))
                .route("/debug", web::get().to(debug_state))
                .route("/test_search", web::get().to(test_search))
                .route("/search", web::get().to(search))
                .route("/song/url", web::get().to(song_url))
                .route("/song/detail", web::get().to(song_detail))
                .route("/lyric", web::get().to(lyric))
                .route("/album", web::get().to(album))
                .route("/tts", web::post().to(tts_proxy))
        })
        .bind("127.0.0.1:3000")
        .expect("Failed to bind to port 3000");

        log::info!("[NETEASE_API] Server binding to 127.0.0.1:3000");
        rt.block_on(server.run()).expect("Server error");
    });

    // Give the server a moment to start
    std::thread::sleep(std::time::Duration::from_millis(500));
    log::info!("[NETEASE_API] Server startup complete");
}
