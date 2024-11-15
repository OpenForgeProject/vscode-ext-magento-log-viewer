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
      return Promise.resolve(this.getLogFiles(path.join(this.workspaceRoot, 'var', 'log')));
    } else {
      const logPath = path.join(this.workspaceRoot, 'var', 'log');
      if (this.pathExists(logPath)) {
        const logFiles = this.getLogFiles(logPath);
        if (logFiles.length === 0) {
          return Promise.resolve([new LogFile('No log files found', vscode.TreeItemCollapsibleState.None)]);
        }
        return Promise.resolve(logFiles);
      } else {
        this.updateBadge(0);
        return Promise.resolve([new LogFile('No log files found', vscode.TreeItemCollapsibleState.None)]);
      }
    }
  }

  public getLogFiles(dir: string): LogFile[] {
    if (this.pathExists(dir)) {
      const files = fs.readdirSync(dir);
      this.updateBadge(files.length);
      return files.map(file => {
        const filePath = path.join(dir, file);
        const lineCount = this.getLineCount(filePath);
        return new LogFile(`${file} (Lines: ${lineCount})`, vscode.TreeItemCollapsibleState.None, {
          command: 'magento-log-viewer.openFile',
          title: 'Open Log File',
          arguments: [filePath]
        });
      });
    } else {
      this.updateBadge(0);
      return [];
    }
  }

  getLogFilesWithoutUpdatingBadge(dir: string): LogFile[] {
    if (this.pathExists(dir)) {
      const files = fs.readdirSync(dir);
      return files.map(file => {
        const filePath = path.join(dir, file);
        const lineCount = this.getLineCount(filePath);
        return new LogFile(`${file} (Lines: ${lineCount})`, vscode.TreeItemCollapsibleState.None, {
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

  private updateBadge(count: number = 0): void {
    this.statusBarItem.text = `Magento Logs: ${count}`;
  }

  dispose() {
    this.statusBarItem.dispose();
  }
}

export class LogFile extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);
    this.description = this.label.match(/\(Lines: \d+\)/)?.[0] || '';
    this.label = this.label.replace(/\(Lines: \d+\)/, '').trim();
  }

  iconPath = {
    light: path.join(__filename, '..', '..', 'resources', 'light', 'log.svg'),
    dark: path.join(__filename, '..', '..', 'resources', 'dark', 'log.svg')
  };

  contextValue = 'logFile';
  description = '';
}
