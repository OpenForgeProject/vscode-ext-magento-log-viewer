# Copilot Instructions for Magento Log Viewer Extension

## Architecture Overview

This is a VS Code extension that provides intelligent viewing and management of Magento log files. The extension follows a modular architecture with clear separation of concerns:

- **`src/extension.ts`** - Entry point with asynchronous initialization pattern to avoid blocking VS Code startup
- **`src/logViewer.ts`** - Core TreeDataProvider implementations (`LogViewerProvider`, `ReportViewerProvider`)
- **`src/helpers.ts`** - Utility functions, caching system, file operations, and command handlers
- **`src/updateNotifier.ts`** - Version update notifications and changelog integration

## Key Architectural Patterns

### Workspace-Scoped Configuration
The extension uses workspace-scoped settings via `vscode.workspace.getConfiguration('magentoLogViewer', workspaceUri)`. All configuration is stored per-workspace, allowing different Magento projects to have independent settings.

### Asynchronous Initialization
```typescript
// Pattern: Delay heavy operations to let VS Code indexing settle
await new Promise(resolve => setTimeout(resolve, 500));
```

### Intelligent File Caching System
The extension implements a sophisticated caching mechanism in `helpers.ts`:
- **Line count caching** - Avoids re-reading files for badge counts
- **File content caching** - Smart memory management with size limits
- **Cache invalidation** - File system watchers automatically invalidate stale cache entries
- Use `getCacheStatistics()`, `clearFileContentCache()`, `invalidateFileCache()` for cache management

### Context-Driven UI
Commands are conditionally shown using VS Code's `when` clauses:
- `magentoLogViewer.hasMagentoRoot` - Controls visibility of most features
- `magentoLogViewer.hasActiveSearch` - Shows/hides search clear button
- `magentoLogViewer.hasLogFiles` - Controls log file operations

## Critical Development Workflows

### Build & Development
```bash
npm run compile      # Webpack build for development
npm run watch        # Watch mode during development
npm run package      # Production build for publishing
npm run test         # Run extension tests
```

### Testing Strategy
Tests are located in `src/test/` with focused test files:
- `extension.test.ts` - Basic extension lifecycle
- `caching.test.ts` - Cache system validation
- `search.test.ts` - Search functionality
- Run tests with `npm run test` or F5 debug launch

### Extension Configuration Flow
1. Extension activates on `onStartupFinished`
2. Checks `isMagentoProject` setting ("Please select" → prompt user)
3. Validates `magentoRoot` path → auto-opens folder picker if invalid
4. Creates providers and activates file system watchers on `var/log` and `var/report`

## Project-Specific Conventions

### File System Patterns
- **Log files**: `{magentoRoot}/var/log/*.log`
- **Report files**: `{magentoRoot}/var/report/` (recursive directory scanning)
- **Icons**: Color-coded by log level (ERROR=red, WARN=orange, DEBUG=yellow, INFO=blue)

### TreeItem Structure
```typescript
// Pattern: LogItem extends vscode.TreeItem with command integration
new LogItem(label, collapsibleState, {
  command: 'magento-log-viewer.openFile',
  arguments: [filePath, lineNumber]
})
```

### Search Implementation
- Real-time filtering via `quickPick.onDidChangeValue`
- Supports regex patterns when `searchUseRegex` is enabled
- Case sensitivity controlled by `searchCaseSensitive` setting
- Search state managed through context variables for UI updates

### Error Handling Pattern
```typescript
// Pattern: User-friendly error messages with actionable buttons
vscode.window.showErrorMessage('Error message', 'Action Button').then(selection => {
  if (selection === 'Action Button') {
    // Provide immediate solution
  }
});
```

### Memory Management
- Dispose pattern: All providers implement `dispose()` with cleanup of disposables array
- Cache optimization: `optimizeCacheSize()` runs automatically to prevent memory leaks
- File watchers: Properly disposed in `deactivate()` function

## Integration Points

### VS Code APIs Used
- **TreeDataProvider**: Custom tree views for log/report files
- **FileSystemWatcher**: Real-time file change detection
- **QuickPick**: Search interface and file selection
- **Workspace Configuration**: Per-workspace settings
- **Status Bar**: Badge counts and search indicators

### External Dependencies
- **Webpack**: Bundles TypeScript to single `dist/extension.js`
- **Node.js fs**: Synchronous and async file operations
- **VS Code Test Framework**: `@vscode/test-cli` for extension testing

## Performance Considerations

- **Lazy loading**: Heavy operations delayed until user interaction
- **Throttled badge updates**: Maximum one badge update per second
- **Smart caching**: File content cached with automatic memory limits
- **Async file operations**: Uses `fs.promises` for non-blocking I/O where possible

When modifying this extension, prioritize user experience with immediate feedback, maintain the caching system integrity, and ensure proper disposal of resources to prevent memory leaks.
