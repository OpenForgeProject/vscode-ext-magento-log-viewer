
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class LogViewerProvider implements vscode.TreeDataProvider<LogFile> {
  private _onDidChangeTreeData: vscode.EventEmitter<LogFile | undefined | void> = new vscode.EventEmitter<LogFile | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<LogFile | undefined | void> = this._onDidChangeTreeData.event;

  constructor(private workspaceRoot: string) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
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
        return Promise.resolve([]);
      }
    }
  }

  private getLogFiles(dir: string): LogFile[] {
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
