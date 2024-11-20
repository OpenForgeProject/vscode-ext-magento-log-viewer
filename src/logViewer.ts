import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { pathExists, getLineCount, getIconForLogLevel } from './helpers';

export class LogViewerProvider implements vscode.TreeDataProvider<LogFile>, vscode.Disposable {
  private _onDidChangeTreeData: vscode.EventEmitter<LogFile | undefined | void> = new vscode.EventEmitter<LogFile | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<LogFile | undefined | void> = this._onDidChangeTreeData.event;
  private statusBarItem: vscode.StatusBarItem;
  private groupByMessage: boolean;

  constructor(private workspaceRoot: string) {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.statusBarItem.command = 'magento-log-viewer.refreshLogFiles';
    this.statusBarItem.show();
    this.groupByMessage = vscode.workspace.getConfiguration('magentoLogViewer').get<boolean>('groupByMessage', true);
    this.updateBadge();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
    this.updateBadge();
  }

  getTreeItem(element: LogFile): vscode.TreeItem {
    return element;
  }

  getChildren(element?: LogFile): Thenable<LogFile[]> {
    if (!this.workspaceRoot) {
      return Promise.resolve([]);
    }

    if (element) {
      return Promise.resolve(element.children || []);
    } else {
      const logPath = path.join(this.workspaceRoot, 'var', 'log');
      if (pathExists(logPath)) {
        const logFiles = this.getLogFiles(logPath);
        if (logFiles.length === 0) {
          return Promise.resolve([new LogFile('No log files found', vscode.TreeItemCollapsibleState.None)]);
        }
        return Promise.resolve(logFiles);
      } else {
        this.updateBadge();
        return Promise.resolve([new LogFile('No log files found', vscode.TreeItemCollapsibleState.None)]);
      }
    }
  }

  private isValidLogDirectory(dir: string): boolean {
    const normalizedDir = path.normalize(dir);
    const normalizedLogPath = path.normalize(path.join(this.workspaceRoot, 'var', 'log'));
    return normalizedDir === normalizedLogPath;
  }

  public getLogFiles(dir: string): LogFile[] {
    if (!this.isValidLogDirectory(dir)) {
      console.error('Invalid log directory path');
      return [];
    }

    if (pathExists(dir)) {
      const files = fs.readdirSync(dir);
      this.updateBadge();
      return files.map(file => {
        // Validate file path is within log directory
        const filePath = path.join(dir, file);
        if (!filePath.startsWith(dir)) {
          console.error('Invalid file path detected');
          return null;
        }
        const lineCount = getLineCount(filePath);
        const logFile = new LogFile(`${file} (${lineCount})`, vscode.TreeItemCollapsibleState.Collapsed, {
          command: 'magento-log-viewer.openFile',
          title: 'Open Log File',
          arguments: [filePath]
        });
        logFile.iconPath = new vscode.ThemeIcon('file');
        logFile.children = this.getLogFileLines(filePath);
        return logFile;
      }).filter(Boolean) as LogFile[];
    } else {
      this.updateBadge();
      return [];
    }
  }

  private getLogFileLines(filePath: string): LogFile[] {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const lines = fileContent.split('\n');
    const groupedLines = this.groupLogEntries(lines, filePath);
    return groupedLines;
  }

  private groupLogEntries(lines: string[], filePath: string): LogFile[] {
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
          return new LogFile(label, vscode.TreeItemCollapsibleState.Collapsed, undefined,
            messageEntries.map(entry => {
              const lineNumber = (entry.lineNumber + 1).toString().padStart(2, '0');
              return new LogFile(
                `Line ${lineNumber}:  ${entry.line}`,
                vscode.TreeItemCollapsibleState.None,
                {
                  command: 'magento-log-viewer.openFileAtLine',
                  title: 'Open Log File at Line',
                  arguments: [filePath, entry.lineNumber]
                }
              );
            })
          );
        });

        const logFile = new LogFile(`${level} (${entries.length}, grouped)`, vscode.TreeItemCollapsibleState.Collapsed, undefined, messageGroups);
        logFile.iconPath = getIconForLogLevel(level);
        return logFile;
      } else {
        const logFile = new LogFile(`${level} (${entries.length})`, vscode.TreeItemCollapsibleState.Collapsed, undefined,
          entries.map(entry => {
            const lineNumber = (entry.lineNumber + 1).toString().padStart(2, '0');
            return new LogFile(
              `Line ${lineNumber}:  ${entry.line}`,
              vscode.TreeItemCollapsibleState.None,
              {
                command: 'magento-log-viewer.openFileAtLine',
                title: 'Open Log File at Line',
                arguments: [filePath, entry.lineNumber]
              }
            );
          })
        );
        logFile.iconPath = getIconForLogLevel(level);
        return logFile;
      }
    });
  }

  getLogFilesWithoutUpdatingBadge(dir: string): LogFile[] {
    if (pathExists(dir)) {
      const files = fs.readdirSync(dir);
      return files.map(file => {
        const filePath = path.join(dir, file);
        const lineCount = getLineCount(filePath);
        return new LogFile(`${file} (${lineCount})`, vscode.TreeItemCollapsibleState.None, {
          command: 'magento-log-viewer.openFile',
          title: 'Open Log File',
          arguments: [filePath]
        });
      });
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

export class LogFile extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command,
    public children?: LogFile[]
  ) {
    super(label, collapsibleState as vscode.TreeItemCollapsibleState);
    this.description = this.label.match(/\(\d+\)/)?.[0] || '';
    this.label = this.label.replace(/\(\d+\)/, '').trim();
  }

  iconPath = new vscode.ThemeIcon('list');

  contextValue = 'logFile';
  description = '';
}
