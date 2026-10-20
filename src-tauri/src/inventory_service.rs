//! JSON-lines transport for the local browser UI. No HTTP listener, login, notifications or checkout.
//! Vite owns the loopback HTTP boundary; this process reuses the existing catalog/fetcher/actor.
use std::io::{BufRead, Read, Write};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant};

use apw_core::catalog::Catalog;
use apw_core::config::{NetworkMode, Settings, SettingsStore};
use apw_core::model::{Category, REGIONS, Target};
use apw_core::watcher::{Event, Watcher, WatcherConfig};
use serde::Deserialize;
use serde_json::{Value, json};
use tokio::sync::Mutex;

use crate::chromium_fetcher::AppleChromiumFetcher;

const MIN_INTERVAL: u64 = 60;
const MAX_TARGETS: usize = 20;
const MAX_LINE: usize = 128 * 1024;

#[derive(Deserialize)]
struct Request {
    id: u64,
    command: String,
    #[serde(default)]
    args: Value,
}

#[derive(Default)]
struct Control {
    once: bool,
    last_start: Option<Instant>,
}

struct Service {
    settings: Settings,
    store: SettingsStore,
    catalog: Catalog,
    watcher: Watcher,
    control: Arc<Mutex<Control>>,
}

fn output(message: Value) {
    let mut stdout = std::io::stdout().lock();
    let _ = writeln!(stdout, "{message}");
    let _ = stdout.flush();
}

fn event(channel: &str, payload: impl serde::Serialize) {
    output(json!({"channel":channel,"payload":payload}));
}

fn validate_targets(catalog: &Catalog, targets: &[Target]) -> Result<(), String> {
    if targets.len() > MAX_TARGETS {
        return Err(format!(
            "浏览器只读模式最多 {MAX_TARGETS} 条监控，请减少商品与门店组合"
        ));
    }
    for target in targets {
        if catalog
            .product_by_part(&target.locale, &target.part_number)
            .is_none()
            || catalog
                .store_by_number(&target.locale, &target.store_number)
                .is_none()
        {
            return Err("商品或门店不在当前地区目录中，请重新选择".into());
        }
    }
    Ok(())
}

fn validate_read_only(settings: &Settings) -> Result<(), String> {
    if settings.checkout.enabled
        || settings.checkout.place_order
        || !settings.checkout.national_id_suffix.is_empty()
        || settings.checkout.fill_contact
        || !settings.checkout.contact_last_name.is_empty()
        || !settings.checkout.contact_first_name.is_empty()
        || !settings.checkout.contact_email.is_empty()
        || !settings.checkout.contact_phone.is_empty()
        || !settings.bark_url.is_empty()
        || !settings.product_bark_urls.is_empty()
        || settings.sound_enabled
        || settings.open_on_hit != apw_core::config::OpenOnHit::None
        || settings.delivery_region.is_some()
        || settings.network.mode != NetworkMode::System
        || !settings.network.clash.secret.is_empty()
    {
        return Err(
            "当前浏览器入口仅查询库存：不开放结账、凭证保存、推送、送货辅助查询或代理控制".into(),
        );
    }
    Ok(())
}

fn defaults() -> Settings {
    Settings {
        interval_seconds: MIN_INTERVAL,
        sound_enabled: false,
        open_on_hit: apw_core::config::OpenOnHit::None,
        ..Settings::default()
    }
}

impl Service {
    async fn save(&mut self, mut next: Settings) -> Result<Value, String> {
        validate_read_only(&next)?;
        validate_targets(&self.catalog, &next.targets)?;
        next.interval_seconds = next.interval_seconds.clamp(MIN_INTERVAL, 3600);
        next.normalize();
        self.catalog.hydrate_watch_targets(&mut next.targets);
        self.catalog.hydrate_store_targets(&mut next.targets);
        self.catalog.attach_pickup_locations(&mut next.targets);
        self.store.save(&next).map_err(|error| error.to_string())?;
        self.watcher.set_targets(next.targets.clone()).await;
        self.watcher.set_interval(next.interval()).await;
        self.settings = next;
        event("watcher://settings", &self.settings);
        event("watcher://snapshot", self.watcher.snapshot().await);
        serde_json::to_value(&self.settings).map_err(|error| error.to_string())
    }

    async fn call(&mut self, request: &Request) -> Result<Value, String> {
        let args = &request.args;
        let locale = || {
            args["locale"]
                .as_str()
                .ok_or_else(|| "缺少地区".to_string())
        };
        match request.command.as_str() {
            "list_regions" => Ok(json!(
                REGIONS
                    .iter()
                    .map(|region| json!({"title":region.title,"locale":region.locale}))
                    .collect::<Vec<_>>()
            )),
            "list_categories" => Ok(json!(
                Category::ALL
                    .iter()
                    .map(|category| json!({"value":category,"title":category.title()}))
                    .collect::<Vec<_>>()
            )),
            "list_products" => serde_json::to_value(
                self.catalog
                    .products(locale()?)
                    .map_err(|error| error.to_string())?,
            )
            .map_err(|error| error.to_string()),
            "list_stores" => serde_json::to_value(
                self.catalog
                    .stores(locale()?)
                    .map_err(|error| error.to_string())?,
            )
            .map_err(|error| error.to_string()),
            "get_settings" => Ok(json!(self.settings)),
            "get_snapshot" => Ok(json!(self.watcher.snapshot().await)),
            "is_running" => Ok(json!(self.watcher.is_running().await)),
            "check_for_update" => Ok(Value::Null),
            "save_settings" => {
                let next: Settings = serde_json::from_value(args["settings"].clone())
                    .map_err(|_| "设置格式无效".to_string())?;
                self.save(next).await
            }
            "set_targets" => {
                let targets: Vec<Target> = serde_json::from_value(args["targets"].clone())
                    .map_err(|_| "监控目标格式无效".to_string())?;
                let mut next = self.settings.clone();
                next.targets = targets;
                self.save(next).await?;
                Ok(json!(self.watcher.snapshot().await))
            }
            "set_interval" => {
                let seconds = args["seconds"].as_u64().ok_or("查询间隔必须是正整数")?;
                let mut next = self.settings.clone();
                next.interval_seconds = seconds;
                self.save(next).await?;
                Ok(json!(self.settings.interval_seconds))
            }
            "stop_watching" => {
                let mut control = self.control.lock().await;
                control.once = false;
                self.watcher.stop().await;
                Ok(Value::Null)
            }
            "start_watching" | "query_once" | "retry_watching_now" => {
                let mut control = self.control.lock().await;
                if self.watcher.is_running().await {
                    return Err("已有查询正在运行，请先暂停或等待本轮完成".into());
                }
                if self.settings.targets.is_empty() {
                    return Err("请先添加监控目标".into());
                }
                if let Some(previous) = control.last_start {
                    let remaining =
                        Duration::from_secs(MIN_INTERVAL).saturating_sub(previous.elapsed());
                    if !remaining.is_zero() {
                        return Err(format!(
                            "为减少访问压力，请约 {} 秒后再查询",
                            remaining.as_secs() + 1
                        ));
                    }
                }
                control.once = request.command != "start_watching";
                control.last_start = Some(Instant::now());
                self.watcher.start().await;
                Ok(if request.command == "retry_watching_now" {
                    json!(true)
                } else {
                    Value::Null
                })
            }
            _ => Err("该操作未开放：本机浏览器服务仅提供库存只读查询".into()),
        }
    }
}

pub(crate) fn run() -> Result<(), String> {
    let mut arguments = std::env::args().skip(1);
    if arguments.next().as_deref() != Some("--data-dir") {
        return Err("必须指定独立的 --data-dir 绝对路径".into());
    }
    let root = PathBuf::from(arguments.next().ok_or("缺少数据目录")?);
    if !root.is_absolute() {
        return Err("数据目录必须是绝对路径".into());
    }
    let runtime = tokio::runtime::Runtime::new().map_err(|error| error.to_string())?;
    runtime.block_on(async move {
        let store = SettingsStore::at(root.join("browser-inventory-settings.json"));
        let mut settings = if store.path().exists() {store.load().map_err(|error|error.to_string())?} else {defaults()};
        validate_read_only(&settings)?;
        let catalog = Catalog::new();
        validate_targets(&catalog,&settings.targets)?;
        settings.interval_seconds = settings.interval_seconds.clamp(MIN_INTERVAL,3600);
        catalog.attach_pickup_locations(&mut settings.targets);
        let fetcher = AppleChromiumFetcher::with_profile_dir(root.join("inventory-browser"));
        let (watcher,mut events,engine) = Watcher::new(fetcher.clone(),WatcherConfig {interval:settings.interval(),concurrency:1,..WatcherConfig::default()});
        let engine = tokio::spawn(engine);
        watcher.set_targets(settings.targets.clone()).await;
        let control = Arc::new(Mutex::new(Control::default()));
        let stop_watcher = watcher.clone();
        let event_control = Arc::clone(&control);
        let event_task = tokio::spawn(async move {
            while let Some(message) = events.recv().await {
                let blocked = matches!(&message,Event::CycleComplete {snapshot,..} if snapshot.iter().any(|row|matches!(&row.availability,apw_core::model::Availability::Unknown(apw_core::model::UnknownReason::Blocked {..} | apw_core::model::UnknownReason::RateLimited))));
                let complete = matches!(&message,Event::CycleComplete {..});
                event("watcher://event",message);
                if complete {
                    let mut control = event_control.lock().await;
                    if control.once || blocked {
                        control.once = false;
                        stop_watcher.stop().await;
                        if blocked {event("watcher://notice","Apple 拒绝或限流，本机实时服务已暂停，不自动连续重试；结果保持未知。");}
                    }
                }
            }
        });
        let mut service = Service {settings,store,catalog,watcher,control};
        let (sender,mut receiver) = tokio::sync::mpsc::channel(16);
        std::thread::spawn(move || {
            let mut input = std::io::stdin().lock();
            loop {
                let mut line = Vec::new();
                match input.by_ref().take((MAX_LINE+1) as u64).read_until(b'\n',&mut line) {
                    Ok(0) | Err(_) => break,
                    Ok(_) if line.len()>MAX_LINE => {eprintln!("拒绝过大的本机请求");break;},
                    Ok(_) => if sender.blocking_send(line).is_err() {break;},
                }
            }
        });
        output(json!({"ready":true,"mode":"read_only_inventory","minIntervalSeconds":MIN_INTERVAL,"maxTargets":MAX_TARGETS}));
        while let Some(line) = receiver.recv().await {
            let request: Request = match serde_json::from_slice(&line) {Ok(value)=>value,Err(_)=>{output(json!({"id":null,"ok":false,"error":"请求格式无效"}));continue;}};
            match service.call(&request).await {
                Ok(result)=>output(json!({"id":request.id,"ok":true,"result":result})),
                Err(error)=>output(json!({"id":request.id,"ok":false,"error":error})),
            }
        }
        service.watcher.stop().await;
        event_task.abort();
        engine.abort();
        let _ = tokio::time::timeout(Duration::from_secs(5),fetcher.shutdown()).await;
        Ok(())
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn readonly_defaults_never_enable_actions() {
        assert!(validate_read_only(&defaults()).is_ok());
    }
    #[test]
    fn readonly_rejects_order_and_credentials() {
        let mut settings = defaults();
        settings.checkout.place_order = true;
        assert!(validate_read_only(&settings).is_err());
        settings = defaults();
        settings.bark_url = "https://example.invalid/key".into();
        assert!(validate_read_only(&settings).is_err());
    }
    #[test]
    fn readonly_rejects_unregistered_targets_and_large_batches() {
        let catalog = Catalog::new();
        let target: Target = serde_json::from_value(json!({"locale":"zh_CN","partNumber":"INVALID","productName":"不可信","storeNumber":"R000","storeTitle":"不可信"})).unwrap();
        assert!(validate_targets(&catalog, std::slice::from_ref(&target)).is_err());
        assert!(
            validate_targets(&catalog, &vec![target; 21])
                .unwrap_err()
                .contains("20")
        );
    }
}
