# Changelog

All notable changes to the "magento-log-viewer" extension will be documented in this file.


## Next release

- feat: improved timestamp formatting for log entries
- fix: Pre-compilation of regular expressions for timestamps: Prevents repeated compilation on each call.
- fix: Caching for JSON reports: Avoids redundant reading and parsing of JSON files.
- fix: Optimized line counting with caching: Reduces time spent counting lines in large files and avoids repeated calculations for unchanged files.
- fix: Improved badge updates with throttling and debouncing: Prevents too frequent updates and implements more efficient counting methods.
- fix: improve type safety in report handling functions
- i18n: translations added
- test: add log reader test suite with file existence and content validation
- test: add report reader test suite with file existence and content validation
---

## Latest Release

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
