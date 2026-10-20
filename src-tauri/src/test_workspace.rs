//! Debug-only isolation for manual desktop smoke tests. Release ignores this override.
pub(crate) fn root() -> Option<std::path::PathBuf> {
    #[cfg(debug_assertions)]
    {
        std::env::var_os("APW_TEST_DATA_DIR")
            .map(std::path::PathBuf::from)
            .filter(|path| path.is_absolute())
    }
    #[cfg(not(debug_assertions))]
    {
        None
    }
}
