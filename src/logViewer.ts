import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { pathExists, getLineCount, getIconForLogLevel, getLogItems, parseReportTitle, getIconForReport, formatTimestamp, getCachedFileContent } from './helpers';

export class LogViewerProvider implements vscode.TreeDataProvider<LogItem>, vscode.Disposable {
  private _onDidChangeTreeData: vscode.EventEmitter<LogItem | undefined | void> = new vscode.EventEmitter<LogItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<LogItem | undefined | void> = this._onDidChangeTreeData.event;
  public static statusBarItem: vscode.StatusBarItem;
  private groupByMessage: boolean;
  private disposables: vscode.Disposable[] = [];
  private isInitialized: boolean = false;
  public searchTerm: string = '';
  public searchCaseSensitive: boolean = false;
  public searchUseRegex: boolean = false;

  constructor(private workspaceRoot: string) {
    if (!LogViewerProvider.statusBarItem) {
      LogViewerProvider.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
      LogViewerProvider.statusBarItem.command = 'magento-log-viewer.refreshLogFiles';
      LogViewerProvider.statusBarItem.show();
    }

    const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri || null;
    const config = vscode.workspace.getConfiguration('magentoLogViewer', workspaceUri);
    this.groupByMessage = config.get<boolean>('groupByMessage', true);
    this.searchCaseSensitive = config.get<boolean>('searchCaseSensitive', false);
    this.searchUseRegex = config.get<boolean>('searchUseRegex', false);
    this.updateRefreshButtonVisibility();

    // Delay initial heavy operations to avoid competing with indexing
    this.initializeAsync();
  }

  private async initializeAsync(): Promise<void> {
    try {
      // Wait a bit for VS Code indexing to settle
      await new Promise(resolve => setTimeout(resolve, 300));
      this.updateBadge();
      this.isInitialized = true;
    } catch (error) {
      console.error('Error during LogViewerProvider initialization:', error);
      this.isInitialized = true; // Set to true anyway to prevent blocking
    }
  }

  private updateRefreshButtonVisibility(): void {
    vscode.commands.executeCommand('setContext', 'magentoLogViewer.hasMagentoRoot', !!this.workspaceRoot);
    vscode.commands.executeCommand('setContext', 'magentoLogViewer.hasActiveSearch', !!this.searchTerm);
  }

  // Search functionality
  public async searchInLogs(): Promise<void> {
    const searchOptions = await vscode.window.showInputBox({
      prompt: 'Search in log entries...',
      placeHolder: 'Enter search term (supports regex if enabled in settings)',
      value: this.searchTerm
    });

    if (searchOptions !== undefined) {
      this.searchTerm = searchOptions;
      this.updateRefreshButtonVisibility();
      this.refresh();

      if (this.searchTerm) {
        vscode.window.showInformationMessage(`Searching for: "${this.searchTerm}"`);
      }
    }
  }

  public clearSearch(): void {
    this.searchTerm = '';
    this.updateRefreshButtonVisibility();
    this.refresh();
    vscode.window.showInformationMessage('Search cleared');
  }

  public matchesSearchTerm(text: string): boolean {
    if (!this.searchTerm) {
      return true; // No search term, show all
    }

    try {
      if (this.searchUseRegex) {
        const flags = this.searchCaseSensitive ? 'g' : 'gi';
        const regex = new RegExp(this.searchTerm, flags);
        return regex.test(text);
      } else {
        const searchText = this.searchCaseSensitive ? text : text.toLowerCase();
        const searchTerm = this.searchCaseSensitive ? this.searchTerm : this.searchTerm.toLowerCase();
        return searchText.includes(searchTerm);
      }
    } catch (error) {
      // Invalid regex, fall back to simple string search
      const searchText = this.searchCaseSensitive ? text : text.toLowerCase();
      const searchTerm = this.searchCaseSensitive ? this.searchTerm : this.searchTerm.toLowerCase();
      return searchText.includes(searchTerm);
    }
  }

  refresh(): void {
    if (!this.workspaceRoot) {
      vscode.window.showErrorMessage('No workspace root found. Please open a Magento project.');
      return;
    }
    this._onDidChangeTreeData.fire();
    this.updateBadge();
  }

  getTreeItem(element: LogItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: LogItem): Thenable<LogItem[]> {
    if (!this.workspaceRoot) {
      return Promise.resolve([]);
    }

    // Show loading state if not yet initialized
    if (!this.isInitialized) {
      return Promise.resolve([new LogItem('Loading log files...', vscode.TreeItemCollapsibleState.None)]);
    }

    if (element) {
      return Promise.resolve(element.children || []);
    } else {
      return new Promise((resolve) => {
        // Use setTimeout to yield control and prevent blocking the UI thread
        setTimeout(() => {
          try {
            const logPath = path.join(this.workspaceRoot, 'var', 'log');
            const logItems = this.getLogItems(logPath, 'Logs');
            resolve(logItems);
          } catch (error) {
            console.error('Error getting log children:', error);
            resolve([new LogItem('Error loading log files', vscode.TreeItemCollapsibleState.None)]);
          }
        }, 0);
      });
    }
  }

  private isValidLogDirectory(dir: string): boolean {
    const normalizedDir = path.normalize(dir);
    const normalizedLogPath = path.normalize(path.join(this.workspaceRoot, 'var', 'log'));
    return normalizedDir === normalizedLogPath;
  }

  private getLogItems(dir: string, label: string): LogItem[] {
    if (!pathExists(dir)) {
      return [new LogItem(`No items found`, vscode.TreeItemCollapsibleState.None)];
    }

    const files = fs.readdirSync(dir);
    if (files.length === 0) {
      return [new LogItem(`No items found`, vscode.TreeItemCollapsibleState.None)];
    }

    const items = files.map(file => {
      const filePath = path.join(dir, file);
      if (!fs.lstatSync(filePath).isFile()) {
        return null;
      }      // First determine the children (log entries)
      const children = this.getLogFileLines(filePath);

      // Then count the actual number of log entries (instead of line count)
      const logEntryCount = children.reduce((total, level) => {
        // Extract the count from the label, e.g. "ERROR (5)"
        const match = level.label.match(/\((\d+)(?:,\s*grouped)?\)/);
        return total + (match ? parseInt(match[1], 10) : 0);
      }, 0);

      // Only if there are log entries or the file is empty (0)
      const displayCount = logEntryCount > 0 ? logEntryCount : 0;
      const logFile = new LogItem(`${file} (${displayCount})`,
        // Only make expandable if there are actual entries
        displayCount > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
        {
          command: 'magento-log-viewer.openFile',
          title: 'Open Log File',
          arguments: [filePath]
        }
      );
      logFile.iconPath = new vscode.ThemeIcon('file');
      logFile.children = displayCount > 0 ? children : [];
      return logFile;
    }).filter(Boolean) as LogItem[];

    return items;
  }

  public getLogFileLines(filePath: string): LogItem[] {
    const fileContent = getCachedFileContent(filePath);
    if (!fileContent) {
      return [];
    }
    const lines = fileContent.split('\n');
    const groupedLines = this.groupLogEntries(lines, filePath);
    return groupedLines;
  }

  public groupLogEntries(lines: string[], filePath: string): LogItem[] {
    const groupedByType = new Map<string, { message: string, line: string, lineNumber: number }[]>();

    lines.forEach((line, index) => {
      const match = line.match(/\.(\w+):/);
      if (match) {
        const level = match[1].toUpperCase();
        const message = line.replace(/^\[.*?\]\s*\.\w+:\s*/, '');

        // Apply search filter
        if (this.matchesSearchTerm(line) || this.matchesSearchTerm(message)) {
          const entries = groupedByType.get(level) || [];
          entries.push({ message, line, lineNumber: index });
          groupedByType.set(level, entries);
        }
      }
    });

    return Array.from(groupedByType.entries()).map(([level, entries]) => {
      if (this.groupByMessage) {
        const groupedByMessage = new Map<string, { line: string, lineNumber: number }[]>();

        entries.forEach(entry => {
          // Apply additional search filtering on message level
          if (this.matchesSearchTerm(entry.message) || this.matchesSearchTerm(entry.line)) {
            const messageGroup = groupedByMessage.get(entry.message) || [];
            messageGroup.push({ line: entry.line, lineNumber: entry.lineNumber });
            groupedByMessage.set(entry.message, messageGroup);
          }
        });

        const messageGroups = Array.from(groupedByMessage.entries()).map(([message, messageEntries]) => {
          const count = messageEntries.length;
          const label = `${message} (${count})`;
          return new LogItem(label, vscode.TreeItemCollapsibleState.Collapsed, undefined,
            messageEntries.map(entry => {
              const lineNumber = (entry.lineNumber + 1).toString().padStart(2, '0');
              // Format the timestamp in the log entry
              const formattedLine = formatTimestamp(entry.line);
              return new LogItem(
                `Line ${lineNumber}:  ${formattedLine}`,
                vscode.TreeItemCollapsibleState.None,
                {
                  command: 'magento-log-viewer.openFileAtLine',
                  title: 'Open Log File at Line',
                  arguments: [filePath, entry.lineNumber]
                }
              );
            }).sort((a, b) => a.label.localeCompare(b.label)) // Sort entries alphabetically
          );
        }).sort((a, b) => a.label.localeCompare(b.label)); // Sort message groups alphabetically

        // Only add log level if it has matching entries after filtering
        if (messageGroups.length > 0) {
          const logFile = new LogItem(`${level} (${entries.length}, grouped)`, vscode.TreeItemCollapsibleState.Collapsed, undefined, messageGroups);
          logFile.iconPath = getIconForLogLevel(level);
          return logFile;
        }
        return null;
      } else {
        // Filter entries in non-grouped mode too
        const filteredEntries = entries.filter(entry =>
          this.matchesSearchTerm(entry.message) || this.matchesSearchTerm(entry.line)
        );

        if (filteredEntries.length > 0) {
          const logFile = new LogItem(`${level} (${filteredEntries.length})`, vscode.TreeItemCollapsibleState.Collapsed, undefined,
            filteredEntries.map(entry => {
              const lineNumber = (entry.lineNumber + 1).toString().padStart(2, '0');
              // Format the timestamp in the log entry
              const formattedLine = formatTimestamp(entry.line);
              return new LogItem(
                `Line ${lineNumber}:  ${formattedLine}`,
                vscode.TreeItemCollapsibleState.None,
                {
                  command: 'magento-log-viewer.openFileAtLine',
                  title: 'Open Log File at Line',
                  arguments: [filePath, entry.lineNumber]
                }
              );
            }).sort((a, b) => a.label.localeCompare(b.label)) // Sort entries alphabetically
          );
          logFile.iconPath = getIconForLogLevel(level);
          return logFile;
        }
        return null;
      }
    }).filter((item): item is LogItem => item !== null).sort((a, b) => a.label.localeCompare(b.label)); // Sort log files alphabetically
  }

  getLogFilesWithoutUpdatingBadge(dir: string): LogItem[] {
    if (pathExists(dir)) {
      const files = fs.readdirSync(dir);
      return files.map(file => {
        const filePath = path.join(dir, file);
        if (!fs.lstatSync(filePath).isFile()) {
          return null;
        }        // Count the actual log entries instead of just lines
        let logEntryCount = 0;
        try {
          const fileContent = getCachedFileContent(filePath);
          if (fileContent) {
            const lines = fileContent.split('\n');

            // Only count valid log entries matching the expected pattern
            lines.forEach(line => {
              if (line.match(/\.(\w+):/)) { // The pattern for log entries
                logEntryCount++;
              }
            });
          }
        } catch (error) {
            console.error(`Error reading file ${filePath}:`, error);
        }

        return new LogItem(`${file} (${logEntryCount})`, vscode.TreeItemCollapsibleState.None, {
          command: 'magento-log-viewer.openFile',
          title: 'Open Log File',
          arguments: [filePath]
        });
      }).filter(Boolean) as LogItem[];
    } else {
      return [];
    }
  }

  public pathExists(p: string): boolean {
    try {
      fs.accessSync(p);
    } catch (err) {
      return false;
    }
    return true;
  }

  private updateBadge(): void {
    const logPath = path.join(this.workspaceRoot, 'var', 'log');
    const logFiles = this.getLogFilesWithoutUpdatingBadge(logPath);
    const totalEntries = logFiles.reduce((count, file) => count + parseInt(file.description?.match(/\d+/)?.[0] || '0', 10), 0);

    const searchInfo = this.searchTerm ? ` | Search: "${this.searchTerm}"` : '';
    LogViewerProvider.statusBarItem.text = `Magento Log-Entries: ${totalEntries}${searchInfo}`;
  }

  dispose() {
    this._onDidChangeTreeData.dispose();
    if (LogViewerProvider.statusBarItem) {
      LogViewerProvider.statusBarItem.dispose();
      LogViewerProvider.statusBarItem = null as any;
    }
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}

export class ReportViewerProvider implements vscode.TreeDataProvider<LogItem>, vscode.Disposable {
  private _onDidChangeTreeData: vscode.EventEmitter<LogItem | undefined | void> = new vscode.EventEmitter<LogItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<LogItem | undefined | void> = this._onDidChangeTreeData.event;
  private groupByMessage: boolean;
  private disposables: vscode.Disposable[] = [];
  private isInitialized: boolean = false;

  constructor(private workspaceRoot: string) {
    const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri || null;
    const config = vscode.workspace.getConfiguration('magentoLogViewer', workspaceUri);
    this.groupByMessage = config.get<boolean>('groupByMessage', true);

    // Initialize asynchronously to avoid competing with indexing
    this.initializeAsync();
  }

  private async initializeAsync(): Promise<void> {
    try {
      // Wait a bit for VS Code indexing to settle
      await new Promise(resolve => setTimeout(resolve, 300));
      this.isInitialized = true;
    } catch (error) {
      console.error('Error during ReportViewerProvider initialization:', error);
      this.isInitialized = true; // Set to true anyway to prevent blocking
    }
  }

  refresh(): void {
    if (!this.workspaceRoot) {
      vscode.window.showErrorMessage('No workspace root found. Please open a Magento project.');
      return;
    }
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: LogItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: LogItem): Thenable<LogItem[]> {
    if (!this.workspaceRoot) {
      return Promise.resolve([]);
    }

    // Show loading state if not yet initialized
    if (!this.isInitialized) {
      return Promise.resolve([new LogItem('Loading report files...', vscode.TreeItemCollapsibleState.None)]);
    }

    if (element) {
      return Promise.resolve(element.children || []);
    } else {
      return new Promise((resolve) => {
        // Use setTimeout to yield control and prevent blocking the UI thread
        setTimeout(() => {
          try {
            const reportPath = path.join(this.workspaceRoot, 'var', 'report');
            const reportItems = this.getLogItems(reportPath, 'Reports');
            if (reportItems.length === 0) {
              resolve([new LogItem('No report files found', vscode.TreeItemCollapsibleState.None)]);
            } else {
              resolve(reportItems);
            }
          } catch (error) {
            console.error('Error getting report children:', error);
            resolve([new LogItem('Error loading report files', vscode.TreeItemCollapsibleState.None)]);
          }
        }, 0);
      });
    }
  }

  private getLogItems(dir: string, label: string): LogItem[] {
    const items = getLogItems(dir, parseReportTitle, getIconForReport).map(item => {
      item.contextValue = 'reportItem';
      return item;
    });

    const groupedItems = this.groupReportItems(items);
    return groupedItems;
  }

  private groupReportItems(items: LogItem[]): LogItem[] {
    const groupedByTitle = new Map<string, LogItem[]>();

    items.forEach(item => {
      const title = item.label;
      const group = groupedByTitle.get(title) || [];
      group.push(item);
      groupedByTitle.set(title, group);
    });

    return Array.from(groupedByTitle.entries()).map(([title, group]) => {
      if (group.length > 1) {
        return new LogItem(`${title} (${group.length})`, vscode.TreeItemCollapsibleState.Collapsed, undefined, group);
      } else {
        return group[0];
      }
    });
  }

  getLogFilesWithoutUpdatingBadge(dir: string): LogItem[] {
    if (pathExists(dir)) {
      const files = fs.readdirSync(dir);
      return files.map(file => {
        const filePath = path.join(dir, file);
        if (!fs.lstatSync(filePath).isFile()) {
          return null;
        }
        const lineCount = getLineCount(filePath);
        return new LogItem(`${file} (${lineCount})`, vscode.TreeItemCollapsibleState.None, {
          command: 'magento-log-viewer.openFile',
          title: 'Open Log File',
          arguments: [filePath]
        });
      }).filter(Boolean) as LogItem[];
    } else {
      return [];
    }
  }

  dispose() {
    this._onDidChangeTreeData.dispose();
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}

export class LogItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command,
    public children?: LogItem[],
    public iconPath?: vscode.ThemeIcon
  ) {
    super(label, collapsibleState as vscode.TreeItemCollapsibleState);
    this.description = this.label.match(/\(\d+\)/)?.[0] || '';
    this.label = this.label.replace(/\(\d+\)/, '').trim();

    // Add colors based on log level
    if (this.label.includes('ERROR')) {
      this.tooltip = 'Error Message';
      this.resourceUri = vscode.Uri.parse('error');
    } else if (this.label.includes('WARN')) {
      this.tooltip = 'Warning Message';
      this.resourceUri = vscode.Uri.parse('warning');
    } else if (this.label.includes('DEBUG')) {
      this.tooltip = 'Debug Message';
      this.resourceUri = vscode.Uri.parse('debug');
    } else if (this.label.includes('INFO')) {
      this.tooltip = 'Info Message';
      this.resourceUri = vscode.Uri.parse('info');
    }
  }

  contextValue = 'logItem';
  description = '';
}
