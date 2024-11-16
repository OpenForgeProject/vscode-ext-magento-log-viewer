import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class LogViewerProvider implements vscode.TreeDataProvider<LogFile>, vscode.Disposable {
  private _onDidChangeTreeData: vscode.EventEmitter<LogFile | undefined | void> = new vscode.EventEmitter<LogFile | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<LogFile | undefined | void> = this._onDidChangeTreeData.event;
  private statusBarItem: vscode.StatusBarItem;

  constructor(private workspaceRoot: string) {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.statusBarItem.command = 'magento-log-viewer.refreshLogFiles';
    this.statusBarItem.show();
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
      if (this.pathExists(logPath)) {
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

  public getLogFiles(dir: string): LogFile[] {
    if (this.pathExists(dir)) {
      const files = fs.readdirSync(dir);
      this.updateBadge();
      return files.map(file => {
        const filePath = path.join(dir, file);
        const lineCount = this.getLineCount(filePath);
        const logFile = new LogFile(`${file} (${lineCount})`, vscode.TreeItemCollapsibleState.Collapsed, {
          command: 'magento-log-viewer.openFile',
          title: 'Open Log File',
          arguments: [filePath]
        });
        logFile.iconPath = new vscode.ThemeIcon('file');
        logFile.children = this.getLogFileLines(filePath);
        return logFile;
      });
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
    const grouped: { [key: string]: { line: string, lineNumber: number }[] } = {};

    lines.forEach((line, index) => {
      const match = line.match(/\.(\w+):/);
      if (match) {
        const level = match[1];
        if (!grouped[level]) {
          grouped[level] = [];
        }
        grouped[level].push({ line, lineNumber: index });
      }
    });

    const summary = Object.keys(grouped).map(level => {
      const count = grouped[level].length;
      const label = `${level} (${count})`;
      const logFile = new LogFile(label, vscode.TreeItemCollapsibleState.Collapsed, undefined, grouped[level].map(entry => new LogFile(`Line ${entry.lineNumber + 1}: ${entry.line}`, vscode.TreeItemCollapsibleState.None, {
        command: 'magento-log-viewer.openFileAtLine',
        title: 'Open Log File at Line',
        arguments: [filePath, entry.lineNumber]
      })));
      switch (level.toLowerCase()) {
        case 'error':
          logFile.iconPath = new vscode.ThemeIcon('error');
          break;
        case 'warn':
          logFile.iconPath = new vscode.ThemeIcon('warning');
          break;
        case 'debug':
          logFile.iconPath = new vscode.ThemeIcon('debug');
          break;
        case 'info':
          logFile.iconPath = new vscode.ThemeIcon('info');
          break;
        default:
          logFile.iconPath = new vscode.ThemeIcon('file');
      }
      return logFile;
    });

    return summary;
  }

  getLogFilesWithoutUpdatingBadge(dir: string): LogFile[] {
    if (this.pathExists(dir)) {
      const files = fs.readdirSync(dir);
      return files.map(file => {
        const filePath = path.join(dir, file);
        const lineCount = this.getLineCount(filePath);
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

  private getLineCount(filePath: string): number {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    return fileContent.split('\n').length;
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
    super(label, collapsibleState);
    this.description = this.label.match(/\(\d+\)/)?.[0] || '';
    this.label = this.label.replace(/\(\d+\)/, '').trim();
  }

  iconPath = new vscode.ThemeIcon('list');

  contextValue = 'logFile';
  description = '';
}
