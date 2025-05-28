# Magento Log Viewer
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/04d20d74a4bb4f7fb144d320f7008edb)](https://app.codacy.com/gh/OpenForgeProject/vscode-ext-magento-log-viewer/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade) [![GitHub Actions](https://github.com/OpenForgeProject/vscode-ext-magento-log-viewer/actions/workflows/test.yml/badge.svg)](https://github.com/OpenForgeProject/vscode-ext-magento-log-viewer/actions/workflows/test.yml)
![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/MathiasElle.magento-log-viewer?color=0891B2)

The Magento Log Viewer extension for Visual Studio Code provides a convenient way to view and manage Magento log files directly in your workspace.

![Magento Log Viewer Screenshot](resources/logVideo.gif)

## Features

- Tree view of log files from Magento's `var/log` directory
- Section for Grouped log entries by severity level (ERROR, WARN, DEBUG, INFO)
- Section for Report files with parsed and optimized titles
- Option to group log entries by message content
- Direct file opening with line highlighting
- One-click log file clearing with confirmation popup
- Status bar showing total log entries
- Real-time log file monitoring
- Badge in the tree view showing the total number of log entries
- Improved report file titles by parsing content for better readability
- Color-coded icons for different log levels (ERROR, WARN, DEBUG, INFO)
- Individual report file deletion through context menu
- Automatic update notifications for new extension versions
- Line-by-line navigation within log files
- Collapsible sections for identical report error titles
- Project setting retention between workspace sessions

## Setup

1. Install the extension from VS Code marketplace
2. Open your Magento project workspace
3. When prompted, confirm it's a Magento project
4. Select your Magento root directory
5. The extension will now load your log files

Note: Settings are workspace-specific, allowing different configurations for each Magento project.

## Usage

- **View Logs**: Open the Magento Log Viewer sidebar (M logo)
- **Clear Logs**: Click the trash icon in the view header. A confirmation popup will appear to confirm the action.
- **Refresh**: Click the refresh icon or wait for auto-update
- **Navigate**: Click on log entries to jump to specific lines
- **Filter**: Expand log files to see entries grouped by severity
- **Group by Message**: Enable or disable grouping of log entries by message content in the settings. When enabled, the counter will display "grouped" (e.g., `INFO (128, grouped)`).
- **Delete Reports**: Right-click on a report file entry and select "Delete Report File" from the context menu
- **View Updates**: Review update notifications when the extension is updated with links to changelog and GitHub

## Requirements

- VS Code 1.95.0+

**Enjoy!**
