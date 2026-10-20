fn main() {
    if let Err(error) = apple_store_inventory_monitor_lib::run_inventory_service() {
        eprintln!("本机库存服务启动失败：{error}");
        std::process::exit(1);
    }
}
