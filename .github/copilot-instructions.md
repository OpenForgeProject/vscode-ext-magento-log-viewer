# Copilot Instructions for Magento Log Viewer Extension

## Core Principles

**Maintainability is highest priority.** Clean, well-structured code over quick solutions.

**Performance is a feature** - every change must consider user experience impact.

## Architecture Overview

VS Code extension for intelligent Magento log file viewing and management:

- **`src/extension.ts`** - Entry point with async initialization
- **`src/logViewer.ts`** - TreeDataProvider implementations with theme grouping
- **`src/helpers.ts`** - Utilities, multi-layered caching, auto-cleanup
- **`src/updateNotifier.ts`** - Version update notifications

## Major Features (v1.23+)

### Auto-Cleanup System
- Time-based cleanup: `autoCleanupMaxAge` ("30min", "2h", "7d", "2w", "3M")
- Periodic cleanup: `periodicCleanupInterval` (5min to 24h)
- Functions: `autoCleanupOldLogFiles()`, `startPeriodicCleanup()`, `stopPeriodicCleanup()`

### Theme-Aware Log Grouping
- `groupByMessage` setting reduces duplicate entries
- Detects "Broken reference" patterns and theme issues
- Auto expansion/collapse (see `themeGrouping.test.ts`)

## Performance Guidelines

- **Startup**: Never block VS Code startup
- **Memory**: Monitor usage, implement cleanup, avoid leaks
- **UI**: Use async/await, throttle updates, prevent blocking
- **File I/O**: Cache reads, stream large files, batch operations
- **Background**: Move intensive work to background threads

## Code Organization

- Split large functions (max 20-30 lines)
- Split files when >400-500 lines
- Single responsibility per function/class
- Clear naming without comments
- Testable units
- Strict TypeScript, avoid `any`

## Key Patterns

### Workspace-Scoped Configuration
`vscode.workspace.getConfiguration('magentoLogViewer', workspaceUri)` - per-workspace settings

### Asynchronous Initialization
Extension uses 500ms delay for file operations to avoid blocking VS Code startup

### Intelligent Caching
Multi-layered in `helpers.ts`:
- Line count: `lineCountCache` with timestamp invalidation
- File content: `fileContentCache` with size limits
- Reports: `reportCache` for parsed JSON
- Dynamic config: `getCacheConfig()` adapts to memory/settings

### Context-Driven UI
Commands shown via `when` clauses:
- `magentoLogViewer.hasMagentoRoot`
- `magentoLogViewer.hasActiveSearch/hasActiveSearchReports`
- `magentoLogViewer.hasLogFiles`
- `magentoLogViewer.autoCleanupEnabled/periodicCleanupEnabled`

### Memory Management
- Dispose pattern: cleanup disposables array
- Auto optimization: `optimizeCacheSize()`
- Proper disposal in `deactivate()`

### Error Handling
- User-friendly messages with action buttons
- Graceful degradation with fallbacks
- Console.error for debugging

## Project Conventions

### File System
- Logs: `{magentoRoot}/var/log/*.log`
- Reports: `{magentoRoot}/var/report/` (recursive)
- Icons: Color-coded by log level

### Search
- Real-time filtering via `quickPick.onDidChangeValue`
- Regex support with `searchUseRegex`
- Case sensitivity via `searchCaseSensitive`

### Extension Flow
1. Activate on `onStartupFinished`
2. Check `isMagentoProject` setting
3. Validate `magentoRoot` path
4. Create providers, activate watchers

## Integration

### VS Code APIs
TreeDataProvider, FileSystemWatcher, QuickPick, Workspace Configuration, Status Bar

### Dependencies
Webpack (bundles to `dist/extension.js`), Node.js fs, VS Code Test Framework

### Performance
Lazy loading, throttled updates, smart caching, async file ops, batch operations, stream processing, debounced events

## Development

### Build
```bash
npm run compile  # Development build
npm run watch    # Watch mode
npm run package  # Production build
npm run test     # Run tests
```

### Testing
Tests in `src/test/` - one file per component:
- `extension.test.ts`, `caching.test.ts`, `search.test.ts`
- `autoCleanup.test.ts`, `themeGrouping.test.ts`
- Component tests: `cacheConfiguration.test.ts`, `logReader.test.ts`, `reportReader.test.ts`

Organization: descriptive names, mock dependencies, test edge cases

## Release

Update [CHANGELOG.md](../CHANGELOG.md) with user-friendly descriptions:
- Simple language for end users
- Focus on benefits vs implementation
- Group: Features, Improvements, Bug Fixes
- Example: "Added automatic cleanup" not "Implemented autoCleanupOldLogFiles()"
