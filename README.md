# Magento Log Viewer

The Magento Log Viewer extension for Visual Studio Code allows you to easily view and manage log files in your Magento project. This extension provides a tree view of log files, the ability to open and clear log files, and a status bar item showing the number of log entries.

## Features

- **View Log Files**: Displays a tree view of log files in the `var/log` directory of your Magento project.
- **Open Log Files**: Open log files directly in the editor by clicking on them in the tree view.
- **Collapsible Log Lines**: Each log file can be expanded to view individual lines.
- **Clear Log Files**: Clear all log files with a single command.
- **Status Bar Item**: Shows the number of log entries in the status bar.

## Requirements

- Visual Studio Code version 1.95.0 or higher.
- A Magento project with log files located in the `var/log` directory.

## Extension Settings

This extension contributes the following settings:

- `magentoLogViewer.isMagentoProject`: Indicates whether the current workspace is a Magento project. Options are "Yes", "No", and "Please select".
- `magentoLogViewer.magentoRoot`: The path to the Magento root folder.

## Usage

1. **Install the extension**: Install the Magento Log Viewer extension from the Visual Studio Code marketplace.
2. **Configure the extension**: When you open a workspace, the extension will prompt you to specify if it is a Magento project. If you select "Yes", you will be prompted to select the Magento root folder.
3. **View log files**: The log files will be displayed in the tree view under the "Magento Log Viewer" activity bar.
4. **Open log files**: Click on any log file in the tree view to open it in the editor.
5. **Expand log files**: Click on the arrow next to a log file to expand and view individual lines.
6. **Clear log files**: Use the "Clear all Logs" command to delete all log files in the `var/log` directory.

## Known Issues

- None at the moment. Please report any issues you encounter.

## Release Notes

### 0.0.1

- Initial release of Magento Log Viewer.

---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
