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
      vscode.window.showInformationMessage('No Magento root folder found');
      return Promise.resolve([]);
    }

    if (element) {
      return Promise.resolve(this.getLogFiles(path.join(this.workspaceRoot, 'var', 'log')));
    } else {
      const logPath = path.join(this.workspaceRoot, 'var', 'log');
      if (this.pathExists(logPath)) {
        return Promise.resolve(this.getLogFiles(logPath));
      } else {
        vscode.window.showInformationMessage('No log files found');
        this.updateBadge(0);
        return Promise.resolve([]);
      }
    }
  }

  public getLogFiles(dir: string): LogFile[] {
    if (this.pathExists(dir)) {
      const files = fs.readdirSync(dir);
      this.updateBadge(files.length);
      return files.map(file => new LogFile(file, vscode.TreeItemCollapsibleState.None, {
        command: 'magento-log-viewer.openFile',
        title: 'Open Log File',
        arguments: [path.join(dir, file)]
      }));
    } else {
      this.updateBadge(0);
      return [];
    }
  }

  getLogFilesWithoutUpdatingBadge(dir: string): LogFile[] {
    if (this.pathExists(dir)) {
      const files = fs.readdirSync(dir);
      return files.map(file => new LogFile(file, vscode.TreeItemCollapsibleState.None, {
        command: 'magento-log-viewer.openFile',
        title: 'Open Log File',
        arguments: [path.join(dir, file)]
      }));
    } else {
      return [];
    }
  }

  private pathExists(p: string): boolean {
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
  }

  iconPath = {
    light: path.join(__filename, '..', '..', 'resources', 'light', 'log.svg'),
    dark: path.join(__filename, '..', '..', 'resources', 'dark', 'log.svg')
  };

  contextValue = 'logFile';
}
