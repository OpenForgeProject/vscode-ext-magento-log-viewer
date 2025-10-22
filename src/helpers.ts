import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import { LogViewerProvider, ReportViewerProvider, LogItem } from './logViewer';

// Prompts the user to confirm if the current project is a Magento project.
export function promptMagentoProjectSelection(config: vscode.WorkspaceConfiguration, context: vscode.ExtensionContext): void {
  if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
    vscode.window.showInformationMessage('Is this a Magento project?', 'Yes', 'No').then(selection => {
      if (selection === 'Yes') {
        selectMagentoRootFolder(config, context);
      } else if (selection === 'No') {
        updateConfig(config, 'isMagentoProject', selection);
      }
    });
  }
}

// Prompts the user to select the Magento root folder and updates the configuration.
export function selectMagentoRootFolder(config: vscode.WorkspaceConfiguration, context: vscode.ExtensionContext): void {
  vscode.window.showInformationMessage('Please select the Magento root folder.', 'Select Magento Root Folder').then(buttonSelection => {
    if (buttonSelection === 'Select Magento Root Folder') {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      const defaultUri = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri : undefined;
      vscode.window.showOpenDialog({ defaultUri, canSelectFolders: true, canSelectMany: false, openLabel: 'Select Magento Root Folder' }).then(folderUri => {
        if (folderUri?.[0]) {
          const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri || null;
          const newConfig = vscode.workspace.getConfiguration('magentoLogViewer', workspaceUri);
          const relativePath = vscode.workspace.asRelativePath(folderUri[0].fsPath);
          updateConfig(newConfig, 'magentoRoot', relativePath).then(() => {
            showInformationMessage('Magento root folder successfully saved!');
            updateConfig(newConfig, 'isMagentoProject', 'Yes');
            activateExtension(context, folderUri[0].fsPath, new ReportViewerProvider(folderUri[0].fsPath));
          });
        }
      });
    }
  });
}

// Directly opens the folder selection dialog without showing the information message first.
export function selectMagentoRootFolderDirect(config: vscode.WorkspaceConfiguration, context: vscode.ExtensionContext): void {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const defaultUri = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri : undefined;
  vscode.window.showOpenDialog({
    defaultUri,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: 'Select Magento Root Folder',
    title: 'Select Magento Root Folder'
  }).then(folderUri => {
    if (folderUri?.[0]) {
      const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri || null;
      const newConfig = vscode.workspace.getConfiguration('magentoLogViewer', workspaceUri);
      const relativePath = vscode.workspace.asRelativePath(folderUri[0].fsPath);
      updateConfig(newConfig, 'magentoRoot', relativePath).then(() => {
        showInformationMessage('Magento root folder successfully saved!');
        updateConfig(newConfig, 'isMagentoProject', 'Yes');
        activateExtension(context, folderUri[0].fsPath, new ReportViewerProvider(folderUri[0].fsPath));
      });
    }
  });
}

// Opens folder selection dialog from Command Palette and updates the magentoRoot configuration.
export async function selectMagentoRootFromSettings(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const workspaceUri = workspaceFolders?.[0]?.uri || null;

  // Get current configuration for display
  const config = vscode.workspace.getConfiguration('magentoLogViewer', workspaceUri);
  const currentPath = config.get<string>('magentoRoot', '');
  const currentPathDisplay = currentPath || 'Not set (using workspace root)';

  // Show info about current setting
  const proceed = await vscode.window.showInformationMessage(
    `Current Magento root: ${currentPathDisplay}\n\nDo you want to select a new Magento root folder?`,
    'Select New Folder',
    'Cancel'
  );

  if (proceed === 'Select New Folder') {
    const defaultUri = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri : undefined;

    const folderUri = await vscode.window.showOpenDialog({
      defaultUri,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Select Magento Root Folder',
      title: 'Select Magento Root Folder'
    });

    if (folderUri?.[0]) {
      try {
        // Store the relative path instead of absolute path
        const relativePath = vscode.workspace.asRelativePath(folderUri[0].fsPath);
        await updateConfig(config, 'magentoRoot', relativePath);

        // Also set the project as Magento project if not already set
        const isMagentoProject = config.get<string>('isMagentoProject', 'Please select');
        if (isMagentoProject !== 'Yes') {
          await updateConfig(config, 'isMagentoProject', 'Yes');
        }

        // Show success message with the new path
        showInformationMessage(`✅ Magento root updated to: ${relativePath}`);

        // Suggest reloading the window for changes to take effect
        const reload = await vscode.window.showInformationMessage(
          'Reload the window for all changes to take effect.',
          'Reload Window',
          'Later'
        );

        if (reload === 'Reload Window') {
          vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
      } catch (error) {
        showErrorMessage(`Failed to update Magento root path: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
}

// Updates the specified configuration key with the given value.
export function updateConfig(config: vscode.WorkspaceConfiguration, key: string, value: unknown): Thenable<void> {
  return config.update(key, value, vscode.ConfigurationTarget.Workspace);
}

// Displays an information message to the user.
export function showInformationMessage(message: string): void {
  try {
    vscode.window.showInformationMessage(message);
  } catch (error) {
    console.error('Failed to show information message:', error instanceof Error ? error.message : String(error));
  }
}

// Displays an error message to the user.
export function showErrorMessage(message: string): void {
  try {
    vscode.window.showErrorMessage(message);
  } catch (error) {
    console.error('Failed to show error message:', error instanceof Error ? error.message : String(error));
  }
}

// Activates the extension by setting up the log viewer and file system watcher.
export function activateExtension(context: vscode.ExtensionContext, magentoRoot: string, reportViewerProvider: ReportViewerProvider): void {
  const logViewerProvider = new LogViewerProvider(magentoRoot);

  const logTreeView = vscode.window.createTreeView('logFiles', { treeDataProvider: logViewerProvider });
  const reportTreeView = vscode.window.createTreeView('reportFiles', { treeDataProvider: reportViewerProvider });

  registerCommands(context, logViewerProvider, reportViewerProvider, magentoRoot);
  context.subscriptions.push(logTreeView, reportTreeView);

  updateBadge(logTreeView, logViewerProvider, reportViewerProvider, magentoRoot);

  const logPath = path.join(magentoRoot, 'var', 'log');
  const reportPath = path.join(magentoRoot, 'var', 'report');

  const logWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(logPath, '*'));
  logWatcher.onDidChange((uri) => {
    invalidateFileCache(uri.fsPath);
    logViewerProvider.refresh();
  });
  logWatcher.onDidCreate(() => logViewerProvider.refresh());
  logWatcher.onDidDelete(() => logViewerProvider.refresh());

  const reportWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(reportPath, '*'));
  reportWatcher.onDidChange((uri) => {
    invalidateFileCache(uri.fsPath);
    reportViewerProvider.refresh();
  });
  reportWatcher.onDidCreate(() => reportViewerProvider.refresh());
  reportWatcher.onDidDelete(() => reportViewerProvider.refresh());

  context.subscriptions.push(logWatcher, reportWatcher);
}

// Registers commands for the extension.
export function registerCommands(context: vscode.ExtensionContext, logViewerProvider: LogViewerProvider, reportViewerProvider: ReportViewerProvider, magentoRoot: string): void {
  vscode.commands.registerCommand('magento-log-viewer.refreshLogFiles', () => logViewerProvider.refresh());
  vscode.commands.registerCommand('magento-log-viewer.refreshReportFiles', () => reportViewerProvider.refresh());

  // Search commands
  vscode.commands.registerCommand('magento-log-viewer.searchLogs', () => logViewerProvider.searchInLogs());
  vscode.commands.registerCommand('magento-log-viewer.clearSearch', () => logViewerProvider.clearSearch());

  // Cache management commands
  vscode.commands.registerCommand('magento-log-viewer.showCacheStatistics', () => {
    const stats = getCacheStatistics();
    const message = `Cache: ${stats.size}/${stats.maxSize} files | Memory: ${stats.memoryUsage} | Max file size: ${Math.round(stats.maxFileSize / 1024 / 1024)} MB`;
    vscode.window.showInformationMessage(message);
  });  // Improved command registration for openFile
  vscode.commands.registerCommand('magento-log-viewer.openFile', async (filePath: string | unknown, lineNumber?: number) => {
    // If filePath is not a string, show a selection box with available log files
    if (typeof filePath !== 'string') {
      await handleOpenFileWithoutPathAsync(magentoRoot);
      return;
    }

    // If it's just a line number (e.g. "/20")
    if (filePath.startsWith('/') && !filePath.includes('/')) {
      const possibleLineNumber = parseInt(filePath.substring(1));
      if (!isNaN(possibleLineNumber)) {
        await handleOpenFileWithoutPathAsync(magentoRoot, possibleLineNumber);
        return;
      }
    }

    openFile(filePath, lineNumber);
  });

  vscode.commands.registerCommand('magento-log-viewer.openFileAtLine', (filePath: string, lineNumber: number) => {
    openFile(filePath, lineNumber);
  });
  vscode.commands.registerCommand('magento-log-viewer.clearAllLogFiles', () => {
    clearAllLogFiles(logViewerProvider, magentoRoot);
  });
}

// Opens a file in the editor at the specified line number.
export function openFile(filePath: string, lineNumber?: number): void {
  try {
    if (typeof filePath !== 'string' || !filePath) {
      showErrorMessage('Cannot open file: Invalid file path');
      return;
    }

    // Check if the path is absolute or just contains a line number like "/20"
    if (filePath.startsWith('/') && !filePath.includes('/var/log/') && !filePath.includes('/var/report/')) {
      // Possibly only a line number was specified, e.g. "/20"
      const possibleLineNumber = parseInt(filePath.substring(1));
      if (!isNaN(possibleLineNumber)) {
        // We have a valid line number, but no file path
        showErrorMessage(`Cannot open file: Only a line number (${possibleLineNumber}) was specified, but no file path`);
        return;
      }
    }

    // Make sure the path exists
    if (!fs.existsSync(filePath)) {
      showErrorMessage(`Cannot open file: File does not exist: ${filePath}`);
      return;
    }

    const options: vscode.TextDocumentShowOptions = lineNumber !== undefined && typeof lineNumber === 'number' ? {
      selection: new vscode.Range(new vscode.Position(lineNumber, 0), new vscode.Position(lineNumber, 0))
    } : {};

    vscode.window.showTextDocument(vscode.Uri.file(filePath), options);
  } catch (error) {
    showErrorMessage(`Error opening file: ${error instanceof Error ? error.message : String(error)}`);
    console.error('Error opening file:', error);
  }
}

// Clears all log files in the Magento log directory.
export function clearAllLogFiles(logViewerProvider: LogViewerProvider, magentoRoot: string): void {
  vscode.window.showWarningMessage('Are you sure you want to delete all log files?', 'Yes', 'No').then(selection => {
    if (selection === 'Yes') {
      const logPath = path.join(magentoRoot, 'var', 'log');
      if (pathExists(logPath)) {
        const files = fs.readdirSync(logPath);
        files.forEach(file => fs.unlinkSync(path.join(logPath, file)));
        logViewerProvider.refresh();
        showInformationMessage('All log files have been cleared.');
      } else {
        showInformationMessage('No log files found to clear.');
      }
    }
  });
}

// Deletes a report file.
export function deleteReportFile(filePath: string): void {
  try {
    fs.unlinkSync(filePath);
    showInformationMessage(`Report file ${filePath} deleted successfully.`);
  } catch (error) {
    showErrorMessage(`Failed to delete report file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Cache for badge updates
let lastUpdateTime = 0;
const BADGE_UPDATE_THROTTLE = 1000; // Maximum one update per second

// Updates the badge count for the tree view based on the number of log entries.
export function updateBadge(treeView: vscode.TreeView<unknown>, logViewerProvider: LogViewerProvider, reportViewerProvider: ReportViewerProvider, magentoRoot: string): void {
  const updateBadgeCount = () => {
    // Throttling - only update once per second
    const now = Date.now();
    if (now - lastUpdateTime < BADGE_UPDATE_THROTTLE) {
      return;
    }
    lastUpdateTime = now;

    const logPath = path.join(magentoRoot, 'var', 'log');
    const reportPath = path.join(magentoRoot, 'var', 'report');

    // Check if directories exist before reading them
    const logFilesExist = pathExists(logPath);
    const reportFilesExist = pathExists(reportPath);

    let totalLogEntries = 0;
    let totalReportFiles = 0;

    if (logFilesExist) {
      const logFiles = logViewerProvider.getLogFilesWithoutUpdatingBadge(logPath);
      totalLogEntries = logFiles.reduce((count, file) => count + parseInt(file.description?.match(/\d+/)?.[0] || '0', 10), 0);
    }

    if (reportFilesExist) {
      // Only count the number of report files, not load their content
      try {
        totalReportFiles = countFilesInDirectory(reportPath);
      } catch (error) {
        console.error('Error counting report files:', error);
      }
    }

    const totalEntries = totalLogEntries + totalReportFiles;
    treeView.badge = { value: totalEntries, tooltip: `${totalEntries} log and report entries` };

    vscode.commands.executeCommand('setContext', 'magentoLogViewer.hasLogFiles', totalEntries > 0);

    // Update status bar item
    LogViewerProvider.statusBarItem.text = `Magento Log-Entries: ${totalEntries}`;
  };

  // Debounced event handler
  let updateTimeout: NodeJS.Timeout | null = null;
  const debouncedUpdate = () => {
    if (updateTimeout) {
      clearTimeout(updateTimeout);
    }
    updateTimeout = setTimeout(updateBadgeCount, 200);
  };

  logViewerProvider.onDidChangeTreeData(debouncedUpdate);
  reportViewerProvider.onDidChangeTreeData(debouncedUpdate);
  updateBadgeCount();

  vscode.commands.executeCommand('setContext', 'magentoLogViewerBadge', 0);
}

// Helper function for efficiently counting files in a directory
function countFilesInDirectory(dir: string): number {
  if (!pathExists(dir)) {
    return 0;
  }

  let count = 0;
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stats = fs.statSync(fullPath);

    if (stats.isFile()) {
      count++;
    } else if (stats.isDirectory()) {
      count += countFilesInDirectory(fullPath);
    }
  }

  return count;
}

function getAllReportFiles(dir: string): LogItem[] {
  if (!pathExists(dir)) {
    return [];
  }

  const items: LogItem[] = [];
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.lstatSync(filePath).isDirectory()) {
      items.push(...getAllReportFiles(filePath));
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

// Checks if the given path is a valid directory.
export function isValidPath(filePath: string): boolean {
  try {
    return fs.existsSync(filePath) && fs.lstatSync(filePath).isDirectory();
  } catch (error) {
    return false;
  }
}

/**
 * Checks if the given path exists (asynchronous version)
 * @param p Path to check
 * @returns Promise<boolean> - true if path exists, false otherwise
 */
export async function pathExistsAsync(p: string): Promise<boolean> {
  try {
    await fsPromises.access(p);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Checks if the given path exists (synchronous fallback for compatibility)
 * @param p Path to check
 * @returns boolean - true if path exists, false otherwise
 */
export function pathExists(p: string): boolean {
  try {
    fs.accessSync(p);
  } catch (err) {
    return false;
  }
  return true;
}

/**
 * Gets the effective Magento root path. If the configured path is empty,
 * returns the workspace root as the default.
 * @param workspaceUri The workspace URI to get configuration from
 * @returns string - The effective Magento root path
 */
export function getEffectiveMagentoRoot(workspaceUri?: vscode.Uri | null): string {
  const config = vscode.workspace.getConfiguration('magentoLogViewer', workspaceUri);
  const configuredRoot = config.get<string>('magentoRoot', '');
  const workspaceFolders = vscode.workspace.workspaceFolders;

  // If configured root is not empty, resolve it
  if (configuredRoot && configuredRoot.trim()) {
    // If it's already an absolute path, use it as is
    if (path.isAbsolute(configuredRoot)) {
      return configuredRoot;
    }

    // If it's a relative path, resolve it against the workspace root
    if (workspaceFolders && workspaceFolders.length > 0) {
      return path.resolve(workspaceFolders[0].uri.fsPath, configuredRoot);
    }

    // Fallback: return the configured path as is
    return configuredRoot;
  }

  // Otherwise, use workspace root as default
  if (workspaceFolders && workspaceFolders.length > 0) {
    return workspaceFolders[0].uri.fsPath;
  }

  // Fallback: return empty string if no workspace
  return '';
}

// Cache for file line counts
const lineCountCache = new Map<string, { count: number, timestamp: number }>();

// Returns the number of lines in the specified file.
export function getLineCount(filePath: string): number {
  try {
    const stats = fs.statSync(filePath);
    const cachedCount = lineCountCache.get(filePath);

    if (cachedCount && cachedCount.timestamp >= stats.mtime.getTime()) {
      return cachedCount.count;
    }

    // More efficient counting with streams for large files
    if (stats.size > 1024 * 1024) { // For files > 1MB
      // If the file is very large, estimate the line count
      // based on a sample of the first 100KB
      const sampleSize = 102400; // 100KB
      const buffer = Buffer.alloc(sampleSize);
      const fd = fs.openSync(filePath, 'r');
      const bytesRead = fs.readSync(fd, buffer, 0, sampleSize, 0);
      fs.closeSync(fd);

      const sample = buffer.toString('utf-8', 0, bytesRead);
      const lines = sample.split('\n').length - 1;

      // Estimate the total line count based on the sample
      const estimatedLines = Math.ceil(lines * (stats.size / bytesRead));

      lineCountCache.set(filePath, {
        count: estimatedLines,
        timestamp: stats.mtime.getTime()
      });

      return estimatedLines;
    } else {
      // For smaller files, use cached content
      const fileContent = getCachedFileContent(filePath);
      if (!fileContent) {
        return 0;
      }

      const lineCount = fileContent.split('\n').length;

      lineCountCache.set(filePath, {
        count: lineCount,
        timestamp: stats.mtime.getTime()
      });

      return lineCount;
    }
  } catch (error) {
    return 0; // Return 0 in case of error
  }
}

// Returns the appropriate icon for the given log level.
export function getIconForLogLevel(level: string): vscode.ThemeIcon {
  switch (level.toUpperCase()) {
    case 'CRITICAL':
      return new vscode.ThemeIcon('error', new vscode.ThemeColor('magentoLogViewer.criticalColor'));
    case 'ERROR':
      return new vscode.ThemeIcon('error', new vscode.ThemeColor('magentoLogViewer.errorColor'));
    case 'WARN':
      return new vscode.ThemeIcon('warning', new vscode.ThemeColor('magentoLogViewer.warningColor'));
    case 'DEBUG':
      return new vscode.ThemeIcon('debug', new vscode.ThemeColor('magentoLogViewer.debugColor'));
    case 'INFO':
      return new vscode.ThemeIcon('info', new vscode.ThemeColor('magentoLogViewer.infoColor'));
    default:
      return new vscode.ThemeIcon('circle-outline');
  }
}

// Asynchronous version of getLogItems for better performance
export async function getLogItemsAsync(dir: string, parseTitle: (filePath: string) => string, getIcon: (filePath: string) => vscode.ThemeIcon): Promise<LogItem[]> {
  if (!(await pathExistsAsync(dir))) {
    return [];
  }

  const items: LogItem[] = [];

  try {
    const files = await fsPromises.readdir(dir);

    // Process files in batches to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);

      const batchPromises = batch.map(async (file) => {
        const filePath = path.join(dir, file);

        try {
          const stats = await fsPromises.stat(filePath);

          if (stats.isDirectory()) {
            const subItems = await getLogItemsAsync(filePath, parseTitle, getIcon);
            return subItems.length > 0 ? subItems : [];
          } else if (stats.isFile()) {
            const title = parseTitle(filePath);
            const logFile = new LogItem(title, vscode.TreeItemCollapsibleState.None, {
              command: 'magento-log-viewer.openFile',
              title: 'Open Log File',
              arguments: [filePath]
            });
            logFile.iconPath = getIcon(filePath);
            return [logFile];
          }
        } catch (error) {
          console.error(`Error processing file ${filePath}:`, error);
        }

        return [];
      });

      const batchResults = await Promise.all(batchPromises);
      items.push(...batchResults.flat());

      // Small delay between batches to prevent blocking
      if (i + batchSize < files.length) {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }

  return items;
}

export function getLogItems(dir: string, parseTitle: (filePath: string) => string, getIcon: (filePath: string) => vscode.ThemeIcon): LogItem[] {
  if (!pathExists(dir)) {
    return [];
  }

  const items: LogItem[] = [];
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.lstatSync(filePath).isDirectory()) {
      const subItems = getLogItems(filePath, parseTitle, getIcon);
      if (subItems.length > 0) {
        items.push(...subItems);
      }
    } else if (fs.lstatSync(filePath).isFile()) {
      const title = parseTitle(filePath);
      const logFile = new LogItem(title, vscode.TreeItemCollapsibleState.None, {
        command: 'magento-log-viewer.openFile',
        title: 'Open Log File',
        arguments: [filePath]
      });
      logFile.iconPath = getIcon(filePath);
      items.push(logFile);
    }
  });

  return items;
}

// Cache for JSON reports to avoid repeated parsing
const reportCache = new Map<string, { content: unknown, timestamp: number }>();

// Cache for file contents to avoid repeated reads
const fileContentCache = new Map<string, { content: string, timestamp: number }>();

// Dynamic cache configuration based on available memory and user settings
const getCacheConfig = () => {
  // Get user configuration
  const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri || null;
  const config = vscode.workspace.getConfiguration('magentoLogViewer', workspaceUri);

  const userMaxFiles = config.get<number>('cacheMaxFiles', 0);
  const userMaxFileSize = config.get<number>('cacheMaxFileSize', 0);

  // If user has set specific values, use them
  if (userMaxFiles > 0 && userMaxFileSize > 0) {
    return {
      maxSize: userMaxFiles,
      maxFileSize: userMaxFileSize * 1024 * 1024 // Convert MB to bytes
    };
  }

  // Otherwise use automatic calculation
  const totalMemory = process.memoryUsage().heapTotal;
  const availableMemory = totalMemory - process.memoryUsage().heapUsed;

  // Use up to 10% of available heap memory for caching
  const maxCacheMemory = Math.min(availableMemory * 0.1, 50 * 1024 * 1024); // Max 50MB

  const autoMaxSize = userMaxFiles > 0 ? userMaxFiles : Math.max(20, Math.min(100, Math.floor(maxCacheMemory / (2 * 1024 * 1024))));
  const autoMaxFileSize = userMaxFileSize > 0 ? userMaxFileSize * 1024 * 1024 : Math.max(1024 * 1024, Math.min(10 * 1024 * 1024, maxCacheMemory / 10));

  return {
    maxSize: autoMaxSize,
    maxFileSize: autoMaxFileSize
  };
};const CACHE_CONFIG = getCacheConfig();

// Helper function for reading and parsing JSON reports with caching
function getReportContent(filePath: string): unknown | null {
  try {
    const stats = fs.statSync(filePath);
    const cachedReport = reportCache.get(filePath);

    if (cachedReport && cachedReport.timestamp >= stats.mtime.getTime()) {
      return cachedReport.content;
    }

    const fileContent = getCachedFileContent(filePath);
    if (!fileContent) {
      return null;
    }

    const report = JSON.parse(fileContent);

    reportCache.set(filePath, {
      content: report,
      timestamp: stats.mtime.getTime()
    });

    return report;
  } catch (error) {
    return null;
  }
}

// Enhanced file content caching function (asynchronous)
export async function getCachedFileContentAsync(filePath: string): Promise<string | null> {
  try {
    // Check if file exists first
    if (!(await pathExistsAsync(filePath))) {
      return null;
    }

    const stats = await fsPromises.stat(filePath);

    // For very large files (>50MB), use streaming
    if (stats.size > 50 * 1024 * 1024) {
      return readLargeFileAsync(filePath);
    }

    // Don't cache files larger than configured limit to prevent memory issues
    if (stats.size > CACHE_CONFIG.maxFileSize) {
      return await fsPromises.readFile(filePath, 'utf-8');
    }

    const cachedContent = fileContentCache.get(filePath);

    // Return cached content if it's still valid
    if (cachedContent && cachedContent.timestamp >= stats.mtime.getTime()) {
      return cachedContent.content;
    }

    // Read file content asynchronously
    const content = await fsPromises.readFile(filePath, 'utf-8');

    // Manage cache size - remove oldest entries if cache is full
    if (fileContentCache.size >= CACHE_CONFIG.maxSize) {
      // Remove multiple old entries if we're significantly over the limit
      const entriesToRemove = Math.max(1, Math.floor(CACHE_CONFIG.maxSize * 0.1));
      const keys = Array.from(fileContentCache.keys());

      for (let i = 0; i < entriesToRemove && keys.length > 0; i++) {
        fileContentCache.delete(keys[i]);
      }
    }

    // Cache the content
    fileContentCache.set(filePath, {
      content,
      timestamp: stats.mtime.getTime()
    });

    return content;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

// Stream-based reading for very large files
async function readLargeFileAsync(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: string[] = [];
    const stream = fs.createReadStream(filePath, { encoding: 'utf8' });

    stream.on('data', (chunk: string | Buffer) => {
      const chunkStr = typeof chunk === 'string' ? chunk : chunk.toString();
      chunks.push(chunkStr);
    });

    stream.on('end', () => {
      resolve(chunks.join(''));
    });

    stream.on('error', (error) => {
      console.error(`Error reading large file ${filePath}:`, error);
      reject(error);
    });
  });
}// Enhanced file content caching function (synchronous - for compatibility)
export function getCachedFileContent(filePath: string): string | null {
  try {
    // Check if file exists first
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const stats = fs.statSync(filePath);

    // Don't cache files larger than configured limit to prevent memory issues
    if (stats.size > CACHE_CONFIG.maxFileSize) {
      return fs.readFileSync(filePath, 'utf-8');
    }

    const cachedContent = fileContentCache.get(filePath);

    // Return cached content if it's still valid
    if (cachedContent && cachedContent.timestamp >= stats.mtime.getTime()) {
      return cachedContent.content;
    }

    // Read file content
    const content = fs.readFileSync(filePath, 'utf-8');

    // Manage cache size - remove oldest entries if cache is full
    if (fileContentCache.size >= CACHE_CONFIG.maxSize) {
      // Remove multiple old entries if we're significantly over the limit
      const entriesToRemove = Math.max(1, Math.floor(CACHE_CONFIG.maxSize * 0.1));
      const keys = Array.from(fileContentCache.keys());

      for (let i = 0; i < entriesToRemove && keys.length > 0; i++) {
        fileContentCache.delete(keys[i]);
      }
    }

    // Cache the content
    fileContentCache.set(filePath, {
      content,
      timestamp: stats.mtime.getTime()
    });

    return content;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

// Function to clear file content cache (useful for testing or memory management)
export function clearFileContentCache(): void {
  fileContentCache.clear();
}

// Function to get cache statistics for monitoring
export function getCacheStatistics(): { size: number; maxSize: number; maxFileSize: number; memoryUsage: string } {
  const currentConfig = getCacheConfig();
  const memoryUsed = Array.from(fileContentCache.values())
    .reduce((total, item) => total + (item.content.length * 2), 0); // Rough estimate (UTF-16)

  const stats = {
    size: fileContentCache.size,
    maxSize: currentConfig.maxSize,
    maxFileSize: currentConfig.maxFileSize,
    memoryUsage: `${Math.round(memoryUsed / 1024 / 1024 * 100) / 100} MB`
  };

  // Log statistics if enabled in settings
  const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri || null;
  const config = vscode.workspace.getConfiguration('magentoLogViewer', workspaceUri);
  const enableLogging = config.get<boolean>('enableCacheStatistics', false);

  if (enableLogging) {
    console.log('Magento Log Viewer Cache Statistics:', stats);
  }

  return stats;
}// Function to invalidate cache for a specific file
export function invalidateFileCache(filePath: string): void {
  fileContentCache.delete(filePath);
  reportCache.delete(filePath);
  lineCountCache.delete(filePath);
}

// Function to optimize cache size based on current memory pressure
export function optimizeCacheSize(): void {
  const memoryUsage = process.memoryUsage();
  const heapUsedRatio = memoryUsage.heapUsed / memoryUsage.heapTotal;

  // If memory usage is high (>80%), aggressively clean cache
  if (heapUsedRatio > 0.8) {
    const targetSize = Math.floor(fileContentCache.size * 0.5);
    const keys = Array.from(fileContentCache.keys());
    const entriesToRemove = fileContentCache.size - targetSize;

    for (let i = 0; i < entriesToRemove && keys.length > 0; i++) {
      fileContentCache.delete(keys[i]);
    }

    console.log(`Cache optimized: Removed ${entriesToRemove} entries due to memory pressure`);
  }
}

export function parseReportTitle(filePath: string): string {
  try {
    const report = getReportContent(filePath);
    if (!report) {
      return path.basename(filePath);
    }

    if (filePath.includes('/api/')) {
      const folderName = path.basename(path.dirname(filePath));
      const capitalizedFolderName = folderName.charAt(0).toUpperCase() + folderName.slice(1);
      return `${capitalizedFolderName}: ${String(report)}`;
    }

    // Type guard to check if report is a record type with string keys
    if (report && typeof report === 'object' && report !== null) {
      const reportObj = report as Record<string, unknown>;
      if ('0' in reportObj && typeof reportObj['0'] === 'string') {
        return reportObj['0'] || path.basename(filePath);
      }
    }

    return path.basename(filePath);
  } catch (error) {
    return path.basename(filePath);
  }
}

export function getIconForReport(filePath: string): vscode.ThemeIcon {
  try {
    const report = getReportContent(filePath);
    if (!report) {
      return new vscode.ThemeIcon('file');
    }

    if (filePath.includes('/api/')) {
      return new vscode.ThemeIcon('warning');
    }

    // Type guard to check if report is a record type with string keys
    if (report && typeof report === 'object' && report !== null) {
      const reportObj = report as Record<string, unknown>;
      if ('0' in reportObj && typeof reportObj['0'] === 'string' &&
          reportObj['0'].toLowerCase().includes('error')) {
        return new vscode.ThemeIcon('error');
      }
    }

    return new vscode.ThemeIcon('file');
  } catch (error) {
    return new vscode.ThemeIcon('file');
  }
}

export function getReportItems(dir: string): LogItem[] {
  if (!pathExists(dir)) {
    return [];
  }

  const items: LogItem[] = [];
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.lstatSync(filePath).isDirectory()) {
      const subItems = getReportItems(filePath);
      if (subItems.length > 0) {
        items.push(...subItems);
      }
    } else if (fs.lstatSync(filePath).isFile()) {
      const title = parseReportTitle(filePath);
      const reportFile = new LogItem(title, vscode.TreeItemCollapsibleState.None, {
        command: 'magento-log-viewer.openFile',
        title: 'Open Report File',
        arguments: [filePath]
      });
      reportFile.iconPath = getIconForReport(filePath);
      items.push(reportFile);
    }
  });

  return items;
}

// Vorkompilierter regulärer Ausdruck für Zeitstempel
const timestampRegex = /(\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}\])/;

// Formats a timestamp from ISO format to localized user format
export function formatTimestamp(timestamp: string): string {
  try {
    // Look for Magento log timestamp pattern: [2025-05-27T19:42:17.646000+00:00]
    const match = timestamp.match(timestampRegex);

    if (!match || !match[1]) {
      return timestamp; // Return original if no timestamp format matches
    }

    // Extract the timestamp without brackets
    const dateTimeStr = match[1].substring(1, match[1].length - 1);

    try {
      const date = new Date(dateTimeStr);

      // Check if date is valid
      if (isNaN(date.getTime())) {
        return timestamp; // Return original if date parsing failed
      }

      // Format the date according to user's locale
      const localizedTimestamp = date.toLocaleString(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });

      // Replace the ISO timestamp with the localized one
      return timestamp.replace(match[1], `[${localizedTimestamp}]`);
    } catch (parseError) {
      console.error("Error parsing date:", parseError);
      return timestamp; // Return original on date parsing error
    }
  } catch (error) {
    console.error('Failed to format timestamp:', error instanceof Error ? error.message : String(error));
    return timestamp; // Return original on error
  }
}

// Shows a dialog to select a log file when no path is provided (async version)
export async function handleOpenFileWithoutPathAsync(magentoRoot: string, lineNumber?: number): Promise<void> {
  try {
    // Collect log and report files asynchronously
    const logPath = path.join(magentoRoot, 'var', 'log');
    const reportPath = path.join(magentoRoot, 'var', 'report');
    const logFiles: string[] = [];
    const reportFiles: string[] = [];

    // Check directories and read files in parallel
    const [logExists, reportExists] = await Promise.all([
      pathExistsAsync(logPath),
      pathExistsAsync(reportPath)
    ]);

    const fileReadPromises: Promise<void>[] = [];

    if (logExists) {
      fileReadPromises.push(
        fsPromises.readdir(logPath).then(files => {
          return Promise.all(files.map(async file => {
            const filePath = path.join(logPath, file);
            const stats = await fsPromises.stat(filePath);
            if (stats.isFile()) {
              logFiles.push(filePath);
            }
          }));
        }).then(() => {})
      );
    }

    if (reportExists) {
      fileReadPromises.push(
        fsPromises.readdir(reportPath).then(files => {
          return Promise.all(files.map(async file => {
            const filePath = path.join(reportPath, file);
            const stats = await fsPromises.stat(filePath);
            if (stats.isFile()) {
              reportFiles.push(filePath);
            }
          }));
        }).then(() => {})
      );
    }

    await Promise.all(fileReadPromises);

    // Create a list of options for the quick pick
    const options: { label: string; description: string; filePath: string }[] = [
      ...logFiles.map(filePath => ({
        label: path.basename(filePath),
        description: 'Log File',
        filePath
      })),
      ...reportFiles.map(filePath => ({
        label: path.basename(filePath),
        description: 'Report File',
        filePath
      }))
    ];

    // If no files were found
    if (options.length === 0) {
      showErrorMessage('No log or report files found.');
      return;
    }

    // Show a quick pick dialog
    const selection = await vscode.window.showQuickPick(options, {
      placeHolder: lineNumber !== undefined ?
        `Select a file to navigate to line ${lineNumber}` :
        'Select a log or report file'
    });

    if (selection) {
      openFile(selection.filePath, lineNumber);
    }
  } catch (error) {
    showErrorMessage(`Error fetching log files: ${error instanceof Error ? error.message : String(error)}`);
    console.error('Error fetching log files:', error);
  }
}

// Shows a dialog to select a log file when no path is provided (sync fallback)
export function handleOpenFileWithoutPath(magentoRoot: string, lineNumber?: number): void {
  try {
    // Collect log and report files
    const logPath = path.join(magentoRoot, 'var', 'log');
    const reportPath = path.join(magentoRoot, 'var', 'report');
    const logFiles: string[] = [];
    const reportFiles: string[] = [];

    // Check if the directories exist
    if (pathExists(logPath)) {
      const files = fs.readdirSync(logPath);
      files.forEach(file => {
        const filePath = path.join(logPath, file);
        if (fs.lstatSync(filePath).isFile()) {
          logFiles.push(filePath);
        }
      });
    }

    if (pathExists(reportPath)) {
      const files = fs.readdirSync(reportPath);
      files.forEach(file => {
        const filePath = path.join(reportPath, file);
        if (fs.lstatSync(filePath).isFile()) {
          reportFiles.push(filePath);
        }
      });
    }

    // Create a list of options for the quick pick
    const options: { label: string; description: string; filePath: string }[] = [
      ...logFiles.map(filePath => ({
        label: path.basename(filePath),
        description: 'Log File',
        filePath
      })),
      ...reportFiles.map(filePath => ({
        label: path.basename(filePath),
        description: 'Report File',
        filePath
      }))
    ];

    // If no files were found
    if (options.length === 0) {
      showErrorMessage('No log or report files found.');
      return;
    }

    // Show a quick pick dialog
    vscode.window.showQuickPick(options, {
      placeHolder: lineNumber !== undefined ?
        `Select a file to navigate to line ${lineNumber}` :
        'Select a log or report file'
    }).then(selection => {
      if (selection) {
        openFile(selection.filePath, lineNumber);
      }
    });
  } catch (error) {
    showErrorMessage(`Error fetching log files: ${error instanceof Error ? error.message : String(error)}`);
    console.error('Error fetching log files:', error);
  }
}
