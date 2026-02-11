/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (c) 2024-2026 OpenForge Project Contributors
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as path from 'path';
import { pathExists, pathExistsAsync, getLineCount, getIconForLogLevel, getLogItems, parseReportTitle, getIconForReport, formatTimestamp, getCachedFileContent } from './helpers';

export abstract class BaseLogProvider implements vscode.TreeDataProvider<LogItem>, vscode.Disposable {
  protected _onDidChangeTreeData: vscode.EventEmitter<LogItem | undefined | void> = new vscode.EventEmitter<LogItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<LogItem | undefined | void> = this._onDidChangeTreeData.event;
  protected groupByMessage: boolean;
  protected disposables: vscode.Disposable[] = [];
  protected isInitialized: boolean = false;
  public searchTerm: string = '';
  public searchCaseSensitive: boolean = false;
  public searchUseRegex: boolean = false;
  protected cachedSearchRegex: RegExp | null = null;
  protected lastSearchTerm: string = '';
  protected lastSearchFlags: string = '';

  constructor(protected workspaceRoot: string) {
    const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri || null;
    const config = vscode.workspace.getConfiguration('magentoLogViewer', workspaceUri);
    this.groupByMessage = config.get<boolean>('groupByMessage', true);
    this.searchCaseSensitive = config.get<boolean>('searchCaseSensitive', false);
    this.searchUseRegex = config.get<boolean>('searchUseRegex', false);
  }

  protected async initializeAsync(): Promise<void> {
    try {
      // Wait a bit for VS Code indexing to settle
      await new Promise(resolve => setTimeout(resolve, 300));
      this.onInitializationComplete();
      this.isInitialized = true;
      this._onDidChangeTreeData.fire();
    } catch (error) {
      console.error(`Error during ${this.constructor.name} initialization:`, error);
      this.isInitialized = true; // Set to true anyway to prevent blocking
      this._onDidChangeTreeData.fire();
    }
  }

  protected onInitializationComplete(): void {
    // Override in subclass if needed
  }

  abstract updateRefreshButtonVisibility(): void;

  public refresh(specificFilePath?: string): void {
    if (!this.workspaceRoot) {
      vscode.window.showErrorMessage('No workspace root found. Please open a Magento project.');
      return;
    }
    this._onDidChangeTreeData.fire();
  }

  public matchesSearchTerm(text: string): boolean {
    if (!this.searchTerm) {
      return true; // No search term, show all
    }

    try {
      if (this.searchUseRegex) {
        const flags = this.searchCaseSensitive ? 'g' : 'gi';

        // Cache regex compilation
        if (!this.cachedSearchRegex || this.lastSearchTerm !== this.searchTerm || this.lastSearchFlags !== flags) {
          this.cachedSearchRegex = new RegExp(this.searchTerm, flags);
          this.lastSearchTerm = this.searchTerm;
          this.lastSearchFlags = flags;
        }

        return this.cachedSearchRegex.test(text);
      } else {
        const searchText = this.searchCaseSensitive ? text : text.toLowerCase();
        const searchTerm = this.searchCaseSensitive ? this.searchTerm : this.searchTerm.toLowerCase();
        return searchText.includes(searchTerm);
      }
    } catch (error) {
      // Invalid regex, fall back to simple string search
      this.cachedSearchRegex = null;
      const searchText = this.searchCaseSensitive ? text : text.toLowerCase();
      const searchTerm = this.searchCaseSensitive ? this.searchTerm : this.searchTerm.toLowerCase();
      return searchText.includes(searchTerm);
    }
  }

  public clearSearch(): void {
    this.searchTerm = '';
    this.cachedSearchRegex = null;
    this.lastSearchTerm = '';
    this.lastSearchFlags = '';
    this.updateRefreshButtonVisibility();
    this.refresh();
    vscode.window.showInformationMessage('Search cleared');
  }

  abstract getTreeItem(element: LogItem): vscode.TreeItem;
  abstract getChildren(element?: LogItem): Thenable<LogItem[]>;

  dispose() {
    this._onDidChangeTreeData.dispose();
    this.cachedSearchRegex = null;
    this.lastSearchTerm = '';
    this.lastSearchFlags = '';
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}

export class LogViewerProvider extends BaseLogProvider {
  public static statusBarItem: vscode.StatusBarItem | undefined;
  private treeView: vscode.TreeView<LogItem> | null = null;
  private tailingManager: any | null = null; // We'll fix typing in next step if needed, keeping 'any' for now to focus on duplication

  constructor(workspaceRoot: string) {
    super(workspaceRoot);

    if (!LogViewerProvider.statusBarItem) {
      LogViewerProvider.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
      LogViewerProvider.statusBarItem.command = 'magento-log-viewer.refreshLogFiles';
      LogViewerProvider.statusBarItem.show();
    }

    this.updateRefreshButtonVisibility();
    // Initialize asynchronously
    this.initializeAsync();
  }

  /**
   * Sets the tree view reference for auto-scroll functionality
   */
  public setTreeView(treeView: vscode.TreeView<LogItem>): void {
    this.treeView = treeView;
  }

  /**
   * Sets the tailing manager reference for visual indicators
   */
  public setTailingManager(tailingManager: any): void {
    this.tailingManager = tailingManager;
  }

  /**
   * Checks if a file is currently being tailed
   */
  private isTailing(filePath: string): boolean {
    return this.tailingManager?.isTailing(filePath) ?? false;
  }

  protected onInitializationComplete(): void {
    this.updateBadge();
  }

  // Implementation for abstract method
  updateRefreshButtonVisibility(): void {
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
      // Clear cached regex when search term changes
      this.cachedSearchRegex = null;
      this.lastSearchTerm = '';
      this.lastSearchFlags = '';
      this.updateRefreshButtonVisibility();
      this.refresh();

      if (this.searchTerm) {
        vscode.window.showInformationMessage(`Searching for: "${this.searchTerm}"`);
      }
    }
  }

  refresh(specificFilePath?: string): void {
    super.refresh(specificFilePath);
    // Selective refresh logic can remain here but calling super fires event
    if (specificFilePath) {
       // TODO: Implement selective tree item refresh
    }
    this.updateBadge();
  }


  /**
   * Appends new log entries to an existing file's tree without full rebuild
   * Used by real-time tailing to efficiently add new entries
   */
  public async appendNewEntries(filePath: string, newLines: string[], startLineNumber: number): Promise<void> {
    // Parse new lines into log entries
    const newEntries = this.parseIncrementalLines(newLines, startLineNumber);

    if (newEntries.length > 0) {
      // Trigger selective refresh
      this.refresh(filePath);

      // Auto-scroll editor if file is currently open
      const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri || null;
      const config = vscode.workspace.getConfiguration('magentoLogViewer', workspaceUri);
      const autoScroll = config.get<boolean>('tailingAutoScroll', true);

      if (autoScroll) {
        // Scroll opened editor to end of file
        await this.scrollEditorToEnd(filePath);

        // Also scroll tree view
        if (this.treeView) {
          // Small delay to let tree refresh complete
          await new Promise(resolve => setTimeout(resolve, 100));

          // Find the log file item in tree and reveal it
          try {
            // We need to find the actual tree item to reveal
            // For now, we trigger a reveal on undefined which shows the tree view
            await this.treeView.reveal(undefined as any, {
              select: false,
              focus: false,
              expand: true
            });
          } catch (error) {
            // Ignore reveal errors (item might not be visible in current filter)
            console.debug('Auto-scroll tree failed:', error);
          }
        }
      }

      // Show notification for critical errors
      const criticalCount = newEntries.filter(entry =>
        entry.message.toLowerCase().includes('critical') ||
        entry.message.toLowerCase().includes('error')
      ).length;

      if (criticalCount > 0) {
        this.notifyNewErrors(path.basename(filePath), criticalCount);
      }
    }
  }

  /**
   * Scrolls the editor to the end of the file if it's currently open
   */
  private async scrollEditorToEnd(filePath: string): Promise<void> {
    try {
      // Find all visible text editors
      const editors = vscode.window.visibleTextEditors;

      // Find editor with matching file path
      const targetEditor = editors.find(editor => {
        const editorPath = editor.document.uri.fsPath;
        return editorPath === filePath;
      });

      if (targetEditor) {
        // Get last line of document
        const lastLine = targetEditor.document.lineCount - 1;
        const lastCharacter = targetEditor.document.lineAt(lastLine).text.length;

        // Create position at end of document
        const endPosition = new vscode.Position(lastLine, lastCharacter);

        // Create range to reveal
        const endRange = new vscode.Range(endPosition, endPosition);

        // Scroll to end without stealing focus
        targetEditor.revealRange(
          endRange,
          vscode.TextEditorRevealType.Default
        );

        // Optional: Move cursor to end (commented out to not interfere with user's cursor)
        // targetEditor.selection = new vscode.Selection(endPosition, endPosition);
      }
    } catch (error) {
      console.debug('Error scrolling editor to end:', error);
    }
  }

  /**
   * Parses new log lines incrementally without re-reading entire file
   */
  private parseIncrementalLines(lines: string[], startLineNumber: number): Array<{ level: string; message: string; lineNumber: number }> {
    const parsedEntries: Array<{ level: string; message: string; lineNumber: number }> = [];

    lines.forEach((line, index) => {
      const match = line.match(/\.([A-Za-z]+):/);
      if (match) {
        const level = match[1].toUpperCase();
        const message = line.replace(/^\[.*?\]\s*(?:[A-Za-z0-9_]+)?\.[A-Za-z]+:\s*/, '');

        // Apply search filter if active
        if (this.matchesSearchTerm(line) || this.matchesSearchTerm(message)) {
          parsedEntries.push({
            level,
            message,
            lineNumber: startLineNumber + index
          });
        }
      }
    });

    return parsedEntries;
  }

  /**
   * Throttled notification for new errors (max 1 per minute)
   */
  private lastNotificationTime = 0;
  private readonly NOTIFICATION_THROTTLE = 60000; // 1 minute

  private notifyNewErrors(fileName: string, count: number): void {
    const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri || null;
    const config = vscode.workspace.getConfiguration('magentoLogViewer', workspaceUri);
    const showNotifications = config.get<boolean>('tailingShowNotifications', true);

    // Check if notifications are enabled
    if (!showNotifications) {
      return;
    }

    const now = Date.now();

    if (now - this.lastNotificationTime < this.NOTIFICATION_THROTTLE) {
      return; // Throttled
    }

    this.lastNotificationTime = now;

    const message = `🔴 ${count} new error(s) in ${fileName}`;
    vscode.window.showWarningMessage(message, 'Open File').then(selection => {
      if (selection === 'Open File') {
        vscode.commands.executeCommand('magento-log-viewer.openFile', path.join(this.workspaceRoot, 'var', 'log', fileName));
      }
    });
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
        // Use async processing to prevent blocking the UI thread
        this.getLogItemsAsync(this.workspaceRoot).then(logItems => {
          resolve(logItems);
        }).catch((error: Error) => {
          console.error('Error getting log children:', error);
          resolve([new LogItem('Error loading log files', vscode.TreeItemCollapsibleState.None)]);
        });
      });
    }
  }

  private async getLogItemsAsync(workspaceRoot: string): Promise<LogItem[]> {
    const logPath = path.join(workspaceRoot, 'var', 'log');

    if (!(await pathExistsAsync(logPath))) {
      return [new LogItem(`No items found`, vscode.TreeItemCollapsibleState.None)];
    }

    try {
      const files = await fsPromises.readdir(logPath);
      if (files.length === 0) {
        return [new LogItem(`No items found`, vscode.TreeItemCollapsibleState.None)];
      }

      // Process files in batches for better performance
      const items: LogItem[] = [];
      const batchSize = 5;

      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);

        const batchPromises = batch.map(async (file) => {
          const filePath = path.join(logPath, file);

          try {
            const stats = await fsPromises.stat(filePath);
            if (!stats.isFile()) {
              return null;
            }

            // Get children synchronously for now (can be optimized later)
            const children = this.getLogFileLines(filePath);

            // Count log entries directly from file content to avoid search filter issues
            let logEntryCount = 0;
            try {
              const fileContent = getCachedFileContent(filePath);
              if (fileContent) {
                const lines = fileContent.split('\n');
                lines.forEach(line => {
                  if (line.match(/\.(\w+):/)) { // Same regex as in groupLogEntries
                    logEntryCount++;
                  }
                });
              }
            } catch (error) {
              console.error(`Error counting entries in ${filePath}:`, error);
              // Fallback to children count
              logEntryCount = children.reduce((total, level) => {
                const match = level.label.match(/\((\d+)(?:,\s*grouped)?\)/);
                return total + (match ? parseInt(match[1], 10) : 0);
              }, 0);
            }

            const displayCount = logEntryCount > 0 ? logEntryCount : 0;
            const isTailingActive = this.isTailing(filePath);
            const label = isTailingActive ? `${file} (${displayCount}) 📡 Live` : `${file} (${displayCount})`;

            const logFile = new LogItem(label,
              displayCount > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
              {
                command: 'magento-log-viewer.openFile',
                title: 'Open Log File',
                arguments: [filePath]
              }
            );
            // Set broadcast icon for tailed files, otherwise file icon
            logFile.iconPath = isTailingActive
              ? new vscode.ThemeIcon('broadcast', new vscode.ThemeColor('charts.green'))
              : new vscode.ThemeIcon('file');
            logFile.children = displayCount > 0 ? children : [];
            logFile.contextValue = isTailingActive ? 'logItem-tailing' : 'logItem';
            return logFile;
          } catch (error) {
            console.error(`Error processing file ${filePath}:`, error);
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        items.push(...batchResults.filter(Boolean) as LogItem[]);

        // Small delay between batches to prevent UI blocking
        if (i + batchSize < files.length) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }

      return items;
    } catch (error) {
      console.error(`Error reading directory ${logPath}:`, error);
      return [new LogItem('Error loading log files', vscode.TreeItemCollapsibleState.None)];
    }
  }

  private isValidLogDirectory(dir: string): boolean {
    const normalizedDir = path.normalize(dir);
    const normalizedLogPath = path.normalize(path.join(this.workspaceRoot, 'var', 'log'));
    return normalizedDir === normalizedLogPath;
  }

  private getLogItems(dir: string): LogItem[] {
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
      }

      // First determine the children (log entries)
      const children = this.getLogFileLines(filePath);

      // Then count the actual number of log entries (instead of line count)
      const logEntryCount = children.reduce((total, level) => {
        // Extract the count from the label, e.g. "ERROR (5)"
        const match = level.label.match(/\((\d+)(?:,\s*grouped)?\)/);
        return total + (match ? parseInt(match[1], 10) : 0);
      }, 0);

      // Only if there are log entries or the file is empty (0)
      const displayCount = logEntryCount > 0 ? logEntryCount : 0;
      const isTailingActive = this.isTailing(filePath);
      const label = isTailingActive ? `${file} (${displayCount}) 📡 Live` : `${file} (${displayCount})`;

      const logFile = new LogItem(label,
        // Only make expandable if there are actual entries
        displayCount > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
        {
          command: 'magento-log-viewer.openFile',
          title: 'Open Log File',
          arguments: [filePath]
        }
      );
      // Set broadcast icon for tailed files, otherwise file icon
      logFile.iconPath = isTailingActive
        ? new vscode.ThemeIcon('broadcast', new vscode.ThemeColor('charts.green'))
        : new vscode.ThemeIcon('file');
      logFile.children = displayCount > 0 ? children : [];
      logFile.contextValue = isTailingActive ? 'logItem-tailing' : 'logItem';
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

    console.log(`[DEBUG] Processing ${lines.length} lines for ${filePath}`);

    lines.forEach((line, index) => {
      // Enhanced regex to match both formats: .level: and .LEVEL:
      const match = line.match(/\.([A-Za-z]+):/);
      if (match) {
        const level = match[1].toUpperCase();
        // Updated regex to handle optional channel prefix (e.g. main.INFO)
        const message = line.replace(/^\[.*?\]\s*(?:[A-Za-z0-9_]+)?\.[A-Za-z]+:\s*/, '');

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
        // Group by topics (e.g. "Broken reference")
        const groupedByTopic = this.groupByTopics(entries);

        const topicGroups = Array.from(groupedByTopic.entries()).map(([topic, topicEntries]) => {

          // Create the individual log entries directly for this topic
          const logEntries = topicEntries.map(entry => {
            const lineNumber = (entry.lineNumber + 1).toString().padStart(2, '0');
            const formattedLine = formatTimestamp(entry.line);
            return new LogItem(
              `Line ${lineNumber}:  ${formattedLine}`,
              vscode.TreeItemCollapsibleState.None,
              {
                command: 'magento-log-viewer.openFileAtLine',
                title: 'Open Log File at Line',
                arguments: [filePath, entry.lineNumber]
              },
              undefined,
              undefined,
              'logEntry',
              entry.line
            );
          }).sort((a, b) => {
            const aLine = parseInt(a.label.match(/Line (\d+)/)?.[1] || '0');
            const bLine = parseInt(b.label.match(/Line (\d+)/)?.[1] || '0');
            return aLine - bLine;
          });

          // Create topic group with direct log entries as children
          if (topicEntries.length > 0) {
            const topicCount = topicEntries.length;
            const topicLabel = `${topic} (${topicCount})`;
            return new LogItem(topicLabel, vscode.TreeItemCollapsibleState.Collapsed, undefined, logEntries);
          }
          return null;
        }).filter((item): item is LogItem => item !== null).sort((a, b) => {
          // "Other" always at the end
          if (a.label.startsWith('Other')) { return 1; }
          if (b.label.startsWith('Other')) { return -1; }
          return a.label.localeCompare(b.label);
        });

        // Only add log level if it has matching entries after filtering
        if (topicGroups.length > 0) {
          const logFile = new LogItem(`${level} (${entries.length})`, vscode.TreeItemCollapsibleState.Collapsed, undefined, topicGroups);
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
                },
                undefined,
                undefined,
                'logEntry',
                entry.line
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

            // Only count valid log entries matching the expected pattern (enhanced for both formats)
            lines.forEach(line => {
              if (line.match(/\.([A-Za-z]+):/)) { // Updated pattern to match both .level: and .LEVEL:
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

  private updateBadge(): void {
    const logPath = path.join(this.workspaceRoot, 'var', 'log');
    const logFiles = this.getLogFilesWithoutUpdatingBadge(logPath);
    const totalEntries = logFiles.reduce((count, file) => count + parseInt(file.description?.match(/\d+/)?.[0] || '0', 10), 0);

    const searchInfo = this.searchTerm ? ` | Search: "${this.searchTerm}"` : '';
    if (LogViewerProvider.statusBarItem) {
      LogViewerProvider.statusBarItem.text = `Magento Log-Entries: ${totalEntries}${searchInfo}`;
    }
  }

  /**
   * Groups log entries by recurring topics
   */
  private groupByTopics(entries: { message: string, line: string, lineNumber: number }[]): Map<string, { message: string, line: string, lineNumber: number }[]> {
    const groupedByTopic = new Map<string, { message: string, line: string, lineNumber: number }[]>();

    entries.forEach(entry => {
      let assigned = false;

      // First priority: Dynamic detection of topics in the format "[Topic]:"
      const dynamicTopicMatch = entry.message.match(/^([^:]+):/);
      if (dynamicTopicMatch) {
        const topic = dynamicTopicMatch[1].trim();
        const topicEntries = groupedByTopic.get(topic) || [];
        topicEntries.push(entry);
        groupedByTopic.set(topic, topicEntries);
        assigned = true;
      }

      // Fallback: Static topic patterns for messages without ":" format
      if (!assigned) {
        const fallbackPatterns = [
          { pattern: /database|sql|transaction/i, topic: 'Database' },
          { pattern: /cache|redis|varnish/i, topic: 'Cache' },
          { pattern: /session/i, topic: 'Session' },
          { pattern: /payment/i, topic: 'Payment' },
          { pattern: /checkout/i, topic: 'Checkout' },
          { pattern: /catalog/i, topic: 'Catalog' },
          { pattern: /customer/i, topic: 'Customer' },
          { pattern: /order/i, topic: 'Order' },
          { pattern: /shipping/i, topic: 'Shipping' },
          { pattern: /tax/i, topic: 'Tax' },
          { pattern: /inventory/i, topic: 'Inventory' },
          { pattern: /indexer/i, topic: 'Indexer' },
          { pattern: /cron/i, topic: 'Cron' },
          { pattern: /email|newsletter/i, topic: 'Email' },
          { pattern: /search|algolia|elasticsearch/i, topic: 'Search' },
          { pattern: /api|graphql|rest|soap/i, topic: 'API' },
          { pattern: /admin/i, topic: 'Admin' },
          { pattern: /frontend|backend/i, topic: 'Frontend/Backend' },
          { pattern: /theme|layout|template|block|widget/i, topic: 'Theme/Layout' },
          { pattern: /module|plugin|observer|event/i, topic: 'Module/Plugin' },
          { pattern: /url|rewrite/i, topic: 'URL' },
          { pattern: /media|image|upload/i, topic: 'Media' },
          { pattern: /import|export/i, topic: 'Import/Export' },
          { pattern: /translation|locale/i, topic: 'Translation' },
          { pattern: /store|website|scope/i, topic: 'Store' },
          { pattern: /config/i, topic: 'Configuration' },
          { pattern: /memory|timeout|performance/i, topic: 'Performance' },
          { pattern: /security|authentication|authorization|permission|access|login|logout/i, topic: 'Security' }
        ];

        for (const { pattern, topic } of fallbackPatterns) {
          if (pattern.test(entry.message)) {
            const topicEntries = groupedByTopic.get(topic) || [];
            topicEntries.push(entry);
            groupedByTopic.set(topic, topicEntries);
            assigned = true;
            break;
          }
        }
      }

      // If no topic was found, add to "Other"
      if (!assigned) {
        const otherEntries = groupedByTopic.get('Other') || [];
        otherEntries.push(entry);
        groupedByTopic.set('Other', otherEntries);
      }
    });

    return groupedByTopic;
  }

  dispose() {
    this._onDidChangeTreeData.dispose();
    if (LogViewerProvider.statusBarItem) {
      LogViewerProvider.statusBarItem.dispose();
      LogViewerProvider.statusBarItem = undefined;
    }
    // Clear regex cache to prevent memory leaks
    this.cachedSearchRegex = null;
    this.lastSearchTerm = '';
    this.lastSearchFlags = '';
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}

export class ReportViewerProvider extends BaseLogProvider {
  constructor(workspaceRoot: string) {
    super(workspaceRoot);
    this.updateRefreshButtonVisibility();
    this.initializeAsync();
  }

  updateRefreshButtonVisibility(): void {
    vscode.commands.executeCommand('setContext', 'magentoLogViewer.hasMagentoRoot', !!this.workspaceRoot);
    vscode.commands.executeCommand('setContext', 'magentoLogViewer.hasActiveSearchReports', !!this.searchTerm);
  }

  // Search functionality
  public async searchInReports(): Promise<void> {
    const searchOptions = await vscode.window.showInputBox({
      prompt: 'Search in report files...',
      placeHolder: 'Enter search term (supports regex if enabled in settings)',
      value: this.searchTerm
    });

    if (searchOptions !== undefined) {
      this.searchTerm = searchOptions;
      // Clear cached regex when search term changes
      this.cachedSearchRegex = null;
      this.lastSearchTerm = '';
      this.lastSearchFlags = '';
      this.updateRefreshButtonVisibility();
      this.refresh();

      if (this.searchTerm) {
        vscode.window.showInformationMessage(`Searching for: "${this.searchTerm}"`);
      }
    }
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
            const reportItems = this.getLogItems(reportPath);
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

  private getLogItems(dir: string): LogItem[] {
    const allItems = getLogItems(dir, parseReportTitle, getIconForReport);

    // Apply search filter
    const filteredItems = allItems.filter(item => {
      if (!this.searchTerm) {
        return true;
      }

      // Search in filename and content
      const filename = item.label;
      const filepath = item.command?.arguments?.[0] as string;

      // Check filename
      if (this.matchesSearchTerm(filename)) {
        return true;
      }

      // Check file content if filepath exists
      if (filepath) {
        try {
          const fileContent = getCachedFileContent(filepath);
          if (fileContent && this.matchesSearchTerm(fileContent)) {
            return true;
          }
        } catch (error) {
          // Ignore file read errors for search
        }
      }

      return false;
    }).map(item => {
      item.contextValue = 'reportItem';
      return item;
    });

    const groupedItems = this.groupReportItems(filteredItems);
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
    super.dispose();
  }
}

export class LogItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command,
    public children?: LogItem[],
    public iconPath?: vscode.ThemeIcon,
    public contextValue: string = 'logItem',
    public rawText?: string
  ) {
    super(label, collapsibleState as vscode.TreeItemCollapsibleState);
    this.contextValue = contextValue;
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

  description = '';
}
