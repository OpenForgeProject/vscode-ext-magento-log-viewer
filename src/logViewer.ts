import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { pathExists, getLineCount, getIconForLogLevel } from './helpers';

export class LogViewerProvider implements vscode.TreeDataProvider<LogItem>, vscode.Disposable {
  private _onDidChangeTreeData: vscode.EventEmitter<LogItem | undefined | void> = new vscode.EventEmitter<LogItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<LogItem | undefined | void> = this._onDidChangeTreeData.event;
  private statusBarItem: vscode.StatusBarItem;
  private groupByMessage: boolean;

  constructor(private workspaceRoot: string) {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.statusBarItem.command = 'magento-log-viewer.refreshLogFiles';
    this.statusBarItem.show();
    this.groupByMessage = vscode.workspace.getConfiguration('magentoLogViewer').get<boolean>('groupByMessage', true);
    this.updateBadge();
    this.updateRefreshButtonVisibility();
  }

  private updateRefreshButtonVisibility(): void {
    vscode.commands.executeCommand('setContext', 'magentoLogViewer.hasMagentoRoot', !!this.workspaceRoot);
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

    if (element) {
      return Promise.resolve(element.children || []);
    } else {
      const logPath = path.join(this.workspaceRoot, 'var', 'log');
      const logItems = this.getLogItems(logPath, 'Logs');
      return Promise.resolve(logItems);
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
      }
      const lineCount = getLineCount(filePath);
      const logFile = new LogItem(`${file} (${lineCount})`, vscode.TreeItemCollapsibleState.Collapsed, {
        command: 'magento-log-viewer.openFile',
        title: 'Open Log File',
        arguments: [filePath]
      });
      logFile.iconPath = new vscode.ThemeIcon('file');
      logFile.children = this.getLogFileLines(filePath);
      return logFile;
    }).filter(Boolean) as LogItem[];

    return items;
  }

  private getLogFileLines(filePath: string): LogItem[] {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const lines = fileContent.split('\n');
    const groupedLines = this.groupLogEntries(lines, filePath);
    return groupedLines;
  }

  private groupLogEntries(lines: string[], filePath: string): LogItem[] {
    const groupedByType = new Map<string, { message: string, line: string, lineNumber: number }[]>();

    lines.forEach((line, index) => {
      const match = line.match(/\.(\w+):/);
      if (match) {
        const level = match[1].toUpperCase();
        const message = line.replace(/^\[.*?\]\s*\.\w+:\s*/, '');
        const entries = groupedByType.get(level) || [];
        entries.push({ message, line, lineNumber: index });
        groupedByType.set(level, entries);
      }
    });

    return Array.from(groupedByType.entries()).map(([level, entries]) => {
      if (this.groupByMessage) {
        const groupedByMessage = new Map<string, { line: string, lineNumber: number }[]>();

        entries.forEach(entry => {
          const messageGroup = groupedByMessage.get(entry.message) || [];
          messageGroup.push({ line: entry.line, lineNumber: entry.lineNumber });
          groupedByMessage.set(entry.message, messageGroup);
        });

        const messageGroups = Array.from(groupedByMessage.entries()).map(([message, messageEntries]) => {
          const count = messageEntries.length;
          const label = `${message} (${count})`;
          return new LogItem(label, vscode.TreeItemCollapsibleState.Collapsed, undefined,
            messageEntries.map(entry => {
              const lineNumber = (entry.lineNumber + 1).toString().padStart(2, '0');
              return new LogItem(
                `Line ${lineNumber}:  ${entry.line}`,
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

        const logFile = new LogItem(`${level} (${entries.length}, grouped)`, vscode.TreeItemCollapsibleState.Collapsed, undefined, messageGroups);
        logFile.iconPath = getIconForLogLevel(level);
        return logFile;
      } else {
        const logFile = new LogItem(`${level} (${entries.length})`, vscode.TreeItemCollapsibleState.Collapsed, undefined,
          entries.map(entry => {
            const lineNumber = (entry.lineNumber + 1).toString().padStart(2, '0');
            return new LogItem(
              `Line ${lineNumber}:  ${entry.line}`,
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
    }).sort((a, b) => a.label.localeCompare(b.label)); // Sort log files alphabetically
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
    this.statusBarItem.text = `Magento Log-Entries: ${totalEntries}`;
  }

  dispose() {
    this.statusBarItem.dispose();
  }
}

export class ReportViewerProvider implements vscode.TreeDataProvider<LogItem>, vscode.Disposable {
  private _onDidChangeTreeData: vscode.EventEmitter<LogItem | undefined | void> = new vscode.EventEmitter<LogItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<LogItem | undefined | void> = this._onDidChangeTreeData.event;
  private groupByMessage: boolean;

  constructor(private workspaceRoot: string) {
    this.groupByMessage = vscode.workspace.getConfiguration('magentoLogViewer').get<boolean>('groupByMessage', true);
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

    if (element) {
      return Promise.resolve(element.children || []);
    } else {
      const reportPath = path.join(this.workspaceRoot, 'var', 'report');
      const reportItems = this.getLogItems(reportPath, 'Reports');
      return Promise.resolve(reportItems);
    }
  }

  private getLogItems(dir: string, label: string): LogItem[] {
    if (!pathExists(dir)) {
      return [];
    }

    const items: LogItem[] = [];
    const files = fs.readdirSync(dir);

    files.forEach(file => {
      const filePath = path.join(dir, file);
      if (fs.lstatSync(filePath).isDirectory()) {
        const subItems = this.getLogItems(filePath, label);
        if (subItems.length > 0) {
          items.push(...subItems);
        }
      } else if (fs.lstatSync(filePath).isFile()) {
        items.push(new LogItem(file, vscode.TreeItemCollapsibleState.None, {
          command: 'magento-log-viewer.openFile',
          title: 'Open Log File',
          arguments: [filePath]
        }));
      }
    });

    return items;
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
    // Implement dispose logic if needed
  }
}

export class LogItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command,
    public children?: LogItem[]
  ) {
    super(label, collapsibleState as vscode.TreeItemCollapsibleState);
    this.description = this.label.match(/\(\d+\)/)?.[0] || '';
    this.label = this.label.replace(/\(\d+\)/, '').trim();
  }

  iconPath = new vscode.ThemeIcon('list');

  contextValue = 'logItem';
  description = '';
}
