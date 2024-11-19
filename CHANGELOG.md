# Change Log

All notable changes to the "magento-log-viewer" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## [1.3.0] - 2024-11-19

### Added

- Added Feature in Workspace configuration option to group log entries by message content.
- Added Video to `README.md`
- Added Setting to group Logfile Messages. The counter will display "grouped" (e.g., `INFO (128, grouped)`).

## [1.2.2] - 2024-11-19

### Fixed

- Fixed code dublication by extracting the logic into functions to improve Extension Performance
- Fixed trailing comma in `tsconfig.json`

## [1.2.1] - 2024-11-19

### Added

- Added Codacy Code Quality Badge to `README.md`

### Fixed

- Fixed TypeScript ES2022 issues

## [1.2.0] - 2024-11-17

### Added

- Comprehensive bug report template
- Detailed feature request template

### Changed

- Settings are now saved in the workspace instead of globally in the USER.

## [1.1.0] - 2024-11-16

### Added

- Improved the user interface of the webview panel.
- Added line number formatting with leading zeros.
- Removed timestamp and dot from log entries in the summary.

### Changed

- Log levels are now displayed in uppercase format (e.g. ERROR, WARN, DEBUG, INFO, ...)

### Fixed

- Fixed potential security issue with non-literal argument in `fs.existsSync`.
- Fixed potential object injection issue in `groupLogEntries` method.

## [1.0.2] - 2024-10-10

### Changed

- Repository URL to `https://github.com/OpenForgeProject/vscode-ext-magento-log-viewer`

## v1.0.1

### Added

- Extension Logo
- Screenshot in the README file.
- Added a "Getting Started" section to the README.

## v1.0.0

### Added

- View log files in the `var/log` directory of your Magento project.
- Open log files directly in the editor by clicking on them in the tree view.
- Expand log files to view individual lines.
- Clear all log files with a single command.
- Status bar item showing the number of log entries.
- Badge in the tree view showing the total number of log entries.
- Repository field in `package.json`.

### Changed

- Status bar item now shows the total number of log entries instead of the number of log files.
- Updated README to reflect the change in the status bar item text.
