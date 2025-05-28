import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Import the main module components to test
import { LogViewerProvider, LogItem } from '../logViewer';

suite('Log Reader Test Suite', () => {
    // Create a temporary directory for test logs
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'magento-logviewer-test-'));
    const logFilePath = path.join(tempDir, 'test.log');

    // Sample log content with different log levels
    const sampleLogContent = `[2025-05-28T21:13:28.751586+00:00] .Info: Broken reference: the 'amcompany_toolbar_link' element cannot be added as child to 'header.links', because the latter doesn't exist
[2025-05-28T21:13:28.751586+00:00] .Warn: Broken reference: the 'amcompany_toolbar_link' element cannot be added as child to 'header.links', because the latter doesn't exist
[2025-05-28T21:13:29.123456+00:00] .Debug: Debug message: initializing module
[2025-05-28T21:13:30.234567+00:00] .Error: Failed to load resource: server responded with status 404
[2025-05-28T21:13:31.345678+00:00] .Critical: Database connection failed`;

    // Set up and tear down
    suiteSetup(() => {
        // Create the test log file before tests
        fs.writeFileSync(logFilePath, sampleLogContent);
    });

    suiteTeardown(() => {
        // Clean up test files after tests
        try {
            fs.unlinkSync(logFilePath);
            fs.rmdirSync(tempDir);
        } catch (err) {
            console.error('Failed to clean up test files:', err);
        }
    });

    test('Log file should exist', () => {
        assert.strictEqual(fs.existsSync(logFilePath), true, 'Test log file should exist');
    });

    test('Log file should be readable', () => {
        const content = fs.readFileSync(logFilePath, 'utf-8');
        assert.strictEqual(content, sampleLogContent, 'Log file content should match the sample content');
    });

    test('LogViewerProvider should read log file correctly', async () => {
        // Create a LogViewerProvider instance with the temp directory as root
        const logProvider = new LogViewerProvider(tempDir);

        // Get access to private method (this requires modifying the class or using a test-specific subclass)
        // For this test, we'll test indirectly through the public API

        // Use Reflection to access the private method (not ideal but works for testing)
        const provider = logProvider as any;
        const logItems = provider.getLogFileLines(logFilePath);

        // Get all log levels from the items
        const logLevels = logItems.map((item: LogItem) => item.label?.toString().split(' ')[0]);
        console.log('Found log levels:', logLevels);

        // Verify log file is parsed correctly and contains expected entries
        assert.ok(logItems.length > 0, 'Should parse log entries');

        // Find if any log level contains Info, Warn, etc (case-insensitive)
        assert.ok(logLevels.some((level: unknown) => typeof level === 'string' && level.includes('INFO')), 'Should contain INFO level logs');
        assert.ok(logLevels.some((level: unknown) => typeof level === 'string' && level.includes('WARN')), 'Should contain WARN level logs');
        assert.ok(logLevels.some((level: unknown) => typeof level === 'string' && level.includes('DEBUG')), 'Should contain DEBUG level logs');
        assert.ok(logLevels.some((level: unknown) => typeof level === 'string' && level.includes('ERROR')), 'Should contain ERROR level logs');
        assert.ok(logLevels.some((level: unknown) => typeof level === 'string' && level.includes('CRITICAL')), 'Should contain CRITICAL level logs');
    });
});
