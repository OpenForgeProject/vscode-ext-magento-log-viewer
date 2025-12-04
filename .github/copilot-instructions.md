# Copilot Instructions for Magento Log Viewer Extension

## Core Principles

**Maintainability is the highest priority.** Always prefer clean, well-structured code over quick solutions.

**Performance is a feature** - treat it as such in every implementation decision. Every change must consider impact on user experience.

## Architecture Overview

This is a VS Code extension that provides intelligent viewing and management of Magento log files. The extension follows a modular architecture with clear separation of concerns:

- **`src/extension.ts`** - Entry point with asynchronous initialization pattern to avoid blocking VS Code startup
- **`src/logViewer.ts`** - Core TreeDataProvider implementations (`LogViewerProvider`, `ReportViewerProvider`) with theme grouping and message deduplication
- **`src/helpers.ts`** - Utility functions, multi-layered caching system, auto-cleanup functionality, and command handlers
- **`src/updateNotifier.ts`** - Version update notifications and changelog integration

## New Major Features (v1.23+)

### Auto-Cleanup System
The extension now includes sophisticated automatic log management:
- **Time-based cleanup**: Configurable age thresholds (`autoCleanupMaxAge`: "30min", "2h", "7d", "2w", "3M")
- **Periodic cleanup**: Background cleanup with intervals from 5min to 24h (`periodicCleanupInterval`)
- **Smart parsing**: `parseTimeDuration()` function with extensive validation (see `autoCleanup.test.ts`)
- Functions: `autoCleanupOldLogFiles()`, `startPeriodicCleanup()`, `stopPeriodicCleanup()`

### Theme-Aware Log Grouping
Advanced log entry organization with intelligent grouping:
- **Message grouping**: `groupByMessage` setting reduces duplicate log entries
- **Theme detection**: Identifies "Broken reference" patterns and similar theme-related issues
- **Group management**: Automatic expansion/collapse of grouped entries (see `themeGrouping.test.ts`)

## Critical Performance Guidelines

**Always prioritize end-user performance:**

- **Startup Performance**: Never block VS Code startup - defer heavy operations until needed
- **Memory Efficiency**: Monitor memory usage, implement proper cleanup, avoid memory leaks
- **UI Responsiveness**: Use async/await patterns, throttle UI updates, prevent blocking operations
- **File I/O Optimization**: Cache file reads, use streaming for large files, batch file operations
- **Background Processing**: Move intensive work to background threads when possible

## Code Organization & Maintainability Best Practices

- **Split large functions** - Break complex logic into smaller, testable functions (max 20-30 lines)
- **Create separate files** - When modules exceed 400-500 lines, split into focused files (e.g., `cacheManager.ts`, `cleanupService.ts`)
- **Single responsibility** - Each function/class should have one clear purpose
- **Clear naming** - Use descriptive names that explain intent without comments
- **Testable units** - Write code that can be easily unit tested in isolation
- **Consistent patterns** - Follow established patterns in the codebase
- **Type safety** - Use TypeScript strictly, avoid `any` types
- **Immutable data** - Prefer immutable operations where possible

**Better to have more files with clear responsibilities than fewer files with mixed concerns.**

## Key Architectural Patterns

### Workspace-Scoped Configuration
The extension uses workspace-scoped settings via `vscode.workspace.getConfiguration('magentoLogViewer', workspaceUri)`. All configuration is stored per-workspace, allowing different Magento projects to have independent settings.

### Asynchronous Initialization
```typescript
// Best Practice: Delay heavy operations to let VS Code indexing settle
await new Promise(resolve => setTimeout(resolve, 500));
```

### Intelligent File Caching System
The extension implements a sophisticated multi-layered caching mechanism in `helpers.ts`:
- **Line count caching** - `lineCountCache` Map with timestamp-based invalidation
- **File content caching** - `fileContentCache` with configurable size limits (`cacheMaxFiles`, `cacheMaxFileSize`)
- **Report content caching** - `reportCache` for parsed JSON reports with timestamp validation
- **Dynamic cache configuration** - `getCacheConfig()` adapts to user settings and memory constraints
- **Cache statistics** - `enableCacheStatistics` setting provides performance metrics
- Cache management: `getCacheStatistics()`, `clearFileContentCache()`, `invalidateFileCache()`, `optimizeCacheSize()`

### Context-Driven UI
Commands are conditionally shown using VS Code's `when` clauses:
- `magentoLogViewer.hasMagentoRoot` - Controls visibility of most features
- `magentoLogViewer.hasActiveSearch` / `magentoLogViewer.hasActiveSearchReports` - Shows/hides search clear buttons
- `magentoLogViewer.hasLogFiles` - Controls log file operations
- `magentoLogViewer.autoCleanupEnabled` - Toggles cleanup UI commands
- `magentoLogViewer.periodicCleanupEnabled` - Controls periodic cleanup status

### Memory Management Best Practices
- **Dispose pattern**: All providers implement `dispose()` with cleanup of disposables array
- **Resource cleanup**: Cache optimization via `optimizeCacheSize()` runs automatically
- **File watcher disposal**: Properly disposed in `deactivate()` function
- **Event listener cleanup**: Always remove listeners in dispose methods
- **Timer cleanup**: Clear intervals/timeouts in cleanup functions

## Project-Specific Conventions

### File System Patterns
- **Log files**: `{magentoRoot}/var/log/*.log`
- **Report files**: `{magentoRoot}/var/report/` (recursive directory scanning)
- **Icons**: Color-coded by log level (ERROR=red, WARN=orange, DEBUG=yellow, INFO=blue)

### Search Implementation
- Real-time filtering via `quickPick.onDidChangeValue`
- Supports regex patterns when `searchUseRegex` is enabled
- Case sensitivity controlled by `searchCaseSensitive` setting
- Search state managed through context variables for UI updates

### Extension Configuration Flow
1. Extension activates on `onStartupFinished`
2. Checks `isMagentoProject` setting ("Please select" → prompt user)
3. Validates `magentoRoot` path → auto-opens folder picker if invalid
4. Creates providers and activates file system watchers on `var/log` and `var/report`

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

### Performance Best Practices

- **Lazy loading**: Heavy operations delayed until user interaction
- **Throttled updates**: Maximum one badge update per second to prevent UI blocking
- **Smart caching**: File content cached with automatic memory limits and LRU eviction
- **Async file operations**: Uses `fs.promises` for non-blocking I/O where possible
- **Batch operations**: Group multiple file operations together
- **Stream processing**: Use streams for large files (>50MB) to prevent memory exhaustion
- **Debounced events**: File watcher events are debounced to prevent excessive refreshes

## Critical Development Workflows

### Build & Development
```bash
npm run compile      # Webpack build for development
npm run watch        # Watch mode during development
npm run package      # Production build for publishing
npm run test         # Run extension tests
```

### Testing Best Practices
Tests are located in `src/test/` with focused, single-responsibility test files:
- `extension.test.ts` - Basic extension lifecycle
- `caching.test.ts` - Cache system validation
- `search.test.ts` - Search functionality
- `autoCleanup.test.ts` - Time duration parsing and cleanup logic
- `themeGrouping.test.ts` - Log message grouping and theme detection
- `cacheConfiguration.test.ts`, `logReader.test.ts`, `reportReader.test.ts` - Component-specific tests

**Test Organization Best Practices:**
- One test file per major component/feature
- Use descriptive test names that explain the expected behavior
- Mock external dependencies (file system, VS Code API)
- Test edge cases and error conditions
- Run tests with `npm run test` or F5 debug launch

## Release Documentation

### Changelog Updates
After implementing new features or fixes, update [CHANGELOG.md](../CHANGELOG.md) with user-friendly descriptions:
- Use simple, non-technical language that end users can understand
- Focus on benefits and improvements rather than implementation details
- Group changes by type: Features, Improvements, Bug Fixes
- Example: "Added automatic cleanup of old log files" instead of "Implemented autoCleanupOldLogFiles() function"

When modifying this extension, prioritize user experience with immediate feedback, maintain the caching system integrity, and ensure proper disposal of resources to prevent memory leaks.

## Code Organization & Maintainability Best Practices

**Maintainability is the highest priority.** Always prefer clean, well-structured code over quick solutions:

- **Split large functions** - Break complex logic into smaller, testable functions (max 20-30 lines)
- **Create separate files** - When modules exceed 400-500 lines, split into focused files (e.g., `cacheManager.ts`, `cleanupService.ts`)
- **Single responsibility** - Each function/class should have one clear purpose
- **Clear naming** - Use descriptive names that explain intent without comments
- **Testable units** - Write code that can be easily unit tested in isolation
- **Consistent patterns** - Follow established patterns in the codebase
- **Type safety** - Use TypeScript strictly, avoid `any` types
- **Immutable data** - Prefer immutable operations where possible

**Better to have more files with clear responsibilities than fewer files with mixed concerns.**

## Critical Performance Guidelines

**Always prioritize end-user performance.** Every change must consider impact on user experience:

- **Startup Performance**: Never block VS Code startup - defer heavy operations until needed
- **Memory Efficiency**: Monitor memory usage, implement proper cleanup, avoid memory leaks
- **UI Responsiveness**: Use async/await patterns, throttle UI updates, prevent blocking operations
- **File I/O Optimization**: Cache file reads, use streaming for large files, batch file operations
- **Background Processing**: Move intensive work to background threads when possible

**Performance is a feature - treat it as such in every implementation decision.**
