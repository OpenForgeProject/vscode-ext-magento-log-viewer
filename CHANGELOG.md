# Changelog

All notable changes to the "magento-log-viewer" extension will be documented in this file.

## Next release

---

### [1.23.1] - 2025-12-08

- fix: Enhanced log level detection pattern to support both uppercase and lowercase formats (.WARN:, .warn:, .INFO:, .info: etc.)
- fix: WARN entries now properly appear in `*.log` file listing and categorization
- fix: Improved regex pattern matching from `\.(\w+):` to `\.([A-Za-z]+):` for more reliable log parsing
- fix: Resolved issue where certain log level formats were not being recognized during file analysis
- fix: Enhanced badge counting accuracy for all log level variations
- fix: Null safety improvements for status bar item to prevent potential crashes
- refactor: Removed unused functions and improved code
- refactor: Cleaned up method signatures by removing unnecessary parameters
- fix: Updated test interfaces to match current implementation

## Latest Release

### [1.23.0] - 2025-12-04

- perf: Implement regex caching for improved search performance (50-80% less CPU overhead during regex searches)
- perf: Cache compiled regex patterns to eliminate redundant compilation on each search operation
- perf: Add intelligent cache invalidation when search terms or flags change
- feat: Enhanced log entry counting with more accurate badge numbers showing actual log entries instead of line counts
- feat: Add comprehensive theme grouping tests to ensure reliable categorization of log entries
- test: New theme grouping test suite with edge case handling and multi-level validation
- fix: Improve log entry detection and counting accuracy across different log formats
- dev: Memory leak prevention with proper regex cache cleanup in dispose methods

### [1.22.0] - 2024-12-03

- feat: Complete settings reorganization into logical categories for improved user experience
- ui: Settings now organized into 4 categorized sections: Project Setup, Log Viewing, Auto Cleanup, and Performance & Cache
- ui: Added direct folder picker button in settings - click "Browse for Magento Root Folder" to select directory instantly
- config: Enhanced setting descriptions with practical examples and use-case guidance
- config: Added enum descriptions for dropdown options (periodic cleanup intervals, project selection)
- config: Improved default values: workspace folder (./), 50 cached files, 10MB cache size, 6h cleanup interval
- config: Added path validation with user-friendly error messages for Magento root folder
- ux: Streamlined folder selection - direct file picker without intermediate confirmation dialogs

### [1.21.0] - 2024-12-03

- test: updated github workflows

### [1.20.0] - 2024-12-03

- feat: Enhanced UI organization with maintenance submenus and dynamic cleanup indicators
- ui: Added "Maintenance" dropdown menus to organize cleanup, refresh, and settings commands
- ui: Implemented dynamic delete button titles - shows "(auto cleanup enabled)" when automatic cleanup is enabled
- ui: Added feedback messages for all refresh operations and improved button naming clarity
- config: Enhanced context monitoring for real-time UI updates based on cleanup settings
- ux: Consistent menu structures across Log Files and Report Files views for better usability

### [1.19.0] - 2025-12-02

- update: Updated npm dependencies to latest versions for improved security and performance
- feat: Added Feature-Request: Delete all report files #20 - thanks to [Morgy93](https://github.com/Morgy93)

### [1.18.1] - 2025-11-21

- fix: node module dependency vulnerabilities

### [1.18.0] - 2025-10-22

- config: Default Magento root uses workspace root if unset; paths stored relative to workspace
- ux: "Select Root Folder" command for easy Magento root setup; auto folder picker if path missing/invalid
- fix: Log and report files auto-load; improved error handling with direct path selection
  - Files older than configured age are automatically deleted with proper cache invalidation
  - **NEW**: Added periodic cleanup functionality (cron-like scheduling)
    - New setting `magentoLogViewer.enablePeriodicCleanup` to enable periodic cleanup
    - New setting `magentoLogViewer.periodicCleanupInterval` with predefined intervals (5min-24h)
    - Toggle button (sync icon) for quick enable/disable of periodic cleanup
    - Automatic restart of periodic cleanup when configuration changes
    - Proper cleanup disposal on extension deactivation

### [1.17.1] - 2025-10-21

- revert config setting: Set default Magento root from `./` to empty

### [1.17.0] - 2025-10-21

- config: Set default Magento root to `./` (relative to workspace)
- config: Renamed "Is Magento Project" setting to "Enable Magento Log Viewer" (boolean toggle for activation)

### [1.16.0] - 2025-10-20

- perf: Implemented dynamic cache configuration based on available system memory
- perf: Added intelligent cache size management with automatic optimization under memory pressure
- perf: Enhanced cache statistics and monitoring capabilities for better performance insights
- perf: Replaced synchronous file operations with asynchronous alternatives to prevent UI blocking
- perf: Added stream-based reading for large files (>50MB) to improve memory efficiency
- perf: Implemented batch processing for directory reads to prevent system overload
- feat: Added user-configurable cache settings: `cacheMaxFiles`, `cacheMaxFileSize`, `enableCacheStatistics`
- feat: Added "Show Cache Statistics" command for real-time cache monitoring
- feat: Cache now automatically scales from 20-100 files and 1-10MB based on available memory
- feat: Added asynchronous file content reading with automatic fallback to synchronous for compatibility
- fix: Cache management now removes multiple old entries efficiently instead of one-by-one cleanup
- fix: Added automatic cache optimization when system memory usage exceeds 80%
- fix: Improved memory usage estimation and monitoring for cached file contents
- fix: Eliminated redundant `pathExists` function implementations across modules
- fix: Consolidated all path existence checks to use centralized helpers functions
- test: Added comprehensive test coverage for new cache configuration options
- test: Added async file operations test suite with large file handling validation

### [1.15.0] - 2025-10-01

- feat: Added support for an additional grouping level for log entries by title

### [1.14.0] - 2025-07-02

- feat: Added Quick Search/Filter Box functionality for log entries
- feat: Real-time filtering of log entries with case-sensitive and regex support
- feat: Search UI integration with navigation buttons in tree view header
- feat: Active search indicator with clear search capability
- ui: Enhanced log viewer with search term highlighting and status display

### [1.13.0] - 2025-07-02

- perf: Enhanced file system caching with intelligent memory management
- perf: Reduced redundant file reads by ~80% through centralized file content caching
- perf: Improved cache invalidation with file watcher integration for consistency
- perf: Added memory-safe caching with 50-file limit and 5MB max file size
- perf: Optimized badge updates and log parsing performance
- test: Added comprehensive file caching test suite with 8 test cases covering cache behavior, invalidation, and edge cases
- fix: Resolved UI freezing issues during VS Code startup and file indexing phases

### [1.12.0] - 2025-05-30

- feat: Add functionality to delete report files

### [1.11.0] - 2025-05-29

- feat: improved timestamp formatting for log entries
- i18n: add translations added
- test: add log reader test suite with file existence and content validation
- test: add report reader test suite with file existence and content validation
- fix: Pre-compilation of regular expressions for timestamps: Prevents repeated compilation on each call.
- fix: Caching for JSON reports: Avoids redundant reading and parsing of JSON files.
- fix: Optimized line counting with caching: Reduces time spent counting lines in large files and avoids repeated calculations for unchanged files.
- fix: Improved badge updates with throttling and debouncing: Prevents too frequent updates and implements more efficient counting methods.
- fix: improve type safety in report handling functions

### [1.10.2] - 2025-05-28

- update: `readme.md` update
- fix: update notification for better performance
- fix: update configuration keys for Magento project selection to correctly save "Is this a Magento project" response

### [1.10.1] - 2025-03-12

- fix: update notification message

### [1.10.0] - 2025-03-12

- feat: add update notification for new extension version

### [1.9.0] - 2025-03-12

- feat: add color coding for log levels in log viewer
- fix: project configuration handling and cleanup process for a smoother experience when opening or closing Magento projects.

### [1.8.2] - 2025-01-20

- add: conditional display of "Is this a Magento Project?" message only when project or workspace is loaded

### [1.8.1] - 2024-12-26

- add: Sponsor Link
- add: Install-Counter in `Readme.md`

### [1.8.0] - 2024-12-25

- add: collapsed reports added if error titles are identical
- fix: Removed not used "Hello World" command
- update: Change Logo for Marketplace

### [1.7.1] - 2024-12-09

- add: a message when there are no report files.
- add: Support for Node.js 18.x in GitHub Actions
- add: Automated tests for releases using GitHub Workflows
- fix: an issue where the status bar item was being created multiple times.

### [1.7.0] - 2024-12-08

- add: a right click context menu to delete report files
- add: tests to check the extension features automaticly
- update: `README.md` with latest features
- update: Extension Logo
- update: Changelog Dates for 1.6.0 Release Date

### [1.6.0] - 2024-12-07

- add: icons for different report types based on content.
- add: folder names in titles for files in the "api" subdirectory.
- update: report file titles by parsing content for better readability.
- update: refactor code to improve performance
- fix: extend badge counter to include report files
- fix: fixed issue with empty directories being included in the report list.
### [1.5.1] - 2024-12-05

- fix: issue that caused the Reload button to not display any results

### [1.5.0] - 2024-12-04

- add: sort log entries and message groups alphabetically

### [1.4.0] - 2024-11-20

- add: confirmation popup to ask if you really want to delete all files
- fix: "Delete Logfiles" button visibility based on log file presence
- update: Refactored the Extension to improve readability, performance and maintainability

### [1.3.0] - 2024-11-19

- add: Workspace configuration option to group log entries by message content
- add: Video to `README.md`
- add: Setting to group Logfile Messages with counter display "grouped" (e.g., `INFO (128, grouped)`)

### [1.2.2] - 2024-11-19

- fix: code duplication by extracting logic into functions for improved Extension Performance
- fix: trailing comma in `tsconfig.json`

### [1.2.1] - 2024-11-19

- add: Codacy Code Quality Badge to `README.md`
- fix: TypeScript ES2022 issues

### [1.2.0] - 2024-11-17

- add: Comprehensive bug report template
- add: Detailed feature request template
- update: Settings now saved in workspace instead of globally in USER

### [1.1.0] - 2024-11-16

- Improved the user interface of the webview panel.
- add: line number formatting with leading zeros.
- Removed timestamp and dot from log entries in the summary.
- Log levels are now displayed in uppercase format (e.g. ERROR, WARN, DEBUG, INFO, ...)
- Fixed potential security issue with non-literal argument in `fs.existsSync`.
- Fixed potential object injection issue in `groupLogEntries` method.

### [1.0.2] - 2024-10-10

- Repository URL to `https://github.com/OpenForgeProject/vscode-ext-magento-log-viewer`

### [v1.0.1]

- Extension Logo
- Screenshot in the README file.
- add: a "Getting Started" section to the README.

### [v1.0.0]

- View log files in the `var/log` directory of your Magento project.
- Open log files directly in the editor by clicking on them in the tree view.
- Expand log files to view individual lines.
- Clear all log files with a single command.
- Status bar item showing the number of log entries.
- Badge in the tree view showing the total number of log entries.
- Repository field in `package.json`.
- Status bar item now shows the total number of log entries instead of the number of log files.
- Updated README to reflect the change in the status bar item text.
