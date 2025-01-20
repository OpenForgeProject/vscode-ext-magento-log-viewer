# Changelog

All notable changes to the "magento-log-viewer" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## [1.8.2] - 2025-01-20

### Changed

- Show "Is this a Magento Project?" only if a project or workspace has been loaded.


## [1.8.1] - 2024-12-26

### Added

- Added Sponsor Link
- Added Install-Counter in `Readme.md`

---

## [1.8.0] - 2024-12-25

### Added

- Added collapsed reports added if error titles are identical

### Removed

- Removed not used "Hello World" command

### Changed

- Change Logo for Marketplace

---

## [1.7.1] - 2024-12-09

### Added

- Added a message when there are no report files.
- Support for Node.js 18.x in GitHub Actions
- Automated tests for releases using GitHub Workflows

### Fixed

- Fixed an issue where the status bar item was being created multiple times.

---

## [1.7.0] - 2024-12-08

### Added

- Added a right click context menu to delete report files
- Added tests to check the extension features automaticly

### Changed

- Changed `README.md` with latest features
- Changed Extension Logo
- Changed Changelog Dates for 1.6.0 Release Date

---

## [1.6.0] - 2024-12-07

### Added

- Improved report file titles by parsing content for better readability.
- Added icons for different report types based on content.
- Included folder names in titles for files in the "api" subdirectory.
- Refactored code to improve performance
- Extend badge counter to include report files

### Fixed

- Fixed issue with empty directories being included in the report list.

---

## [1.5.1] - 2024-12-05

### Fixed

- Fixed an issue that caused the Reload button to not display any results

---

## [1.5.0] - 2024-12-04

### Changed

- sort log entries and message groups alphabetically

---

## [1.4.0] - 2024-11-20

### Added

- Added a confirmation popup to ask if you really want to delete all files

### Changed

- Update "Delete Logfiles" button visibility based on log file presence
- Refactored the Extention to improve Extention readability, performance and maintainability

---

## [1.3.0] - 2024-11-19

### Added

- Added Feature in Workspace configuration option to group log entries by message content.
- Added Video to `README.md`
- Added Setting to group Logfile Messages. The counter will display "grouped" (e.g., `INFO (128, grouped)`).

---

## [1.2.2] - 2024-11-19

### Fixed

- Fixed code dublication by extracting the logic into functions to improve Extension Performance
- Fixed trailing comma in `tsconfig.json`

---

## [1.2.1] - 2024-11-19

### Added

- Added Codacy Code Quality Badge to `README.md`

### Fixed

- Fixed TypeScript ES2022 issues

---

## [1.2.0] - 2024-11-17

### Added

- Comprehensive bug report template
- Detailed feature request template

### Changed

- Settings are now saved in the workspace instead of globally in the USER.

---

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

---

## [1.0.2] - 2024-10-10

### Changed

- Repository URL to `https://github.com/OpenForgeProject/vscode-ext-magento-log-viewer`

---

## [v1.0.1]

### Added

- Extension Logo
- Screenshot in the README file.
- Added a "Getting Started" section to the README.

---

## [v1.0.0]

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
