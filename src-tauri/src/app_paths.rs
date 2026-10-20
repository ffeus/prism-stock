//! Fork data isolation. Never import upstream profiles or settings automatically.
use std::path::PathBuf;

fn resolve_root(isolated: Option<PathBuf>, config: Option<PathBuf>) -> Option<PathBuf> {
    isolated.or_else(|| config.map(|root| root.join("prism-stock")))
}

pub(crate) fn root() -> Option<PathBuf> {
    resolve_root(crate::test_workspace::root(), dirs::config_dir())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fork_data_does_not_share_upstream_identity() {
        let config = PathBuf::from("settings-parent");
        assert_eq!(
            resolve_root(None, Some(config.clone())),
            Some(config.join("prism-stock"))
        );
    }

    #[test]
    fn debug_isolation_takes_precedence_without_reading_disk() {
        let isolated = PathBuf::from("isolated-test");
        assert_eq!(
            resolve_root(Some(isolated.clone()), Some(PathBuf::from("real-config"))),
            Some(isolated)
        );
        assert_eq!(resolve_root(None, None), None);
    }
}
