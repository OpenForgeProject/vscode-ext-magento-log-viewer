import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Import the main module components to test
import { LogViewerProvider, LogItem } from '../logViewer';

suite('Search Functionality Test Suite', () => {
    // Create a temporary directory for test logs
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'magento-search-test-'));
    const logFilePath = path.join(tempDir, 'search_test.log');

    // Sample log content with specific search terms
    const sampleLogContent = `[2025-05-28T21:13:28.751586+00:00] .Info: User authentication failed for user admin
[2025-05-28T21:13:28.751586+00:00] .Warn: Database connection timeout
[2025-05-28T21:13:29.123456+00:00] .Debug: Cache warming started for store frontend
[2025-05-28T21:13:30.234567+00:00] .Error: Payment gateway connection failed
[2025-05-28T21:13:31.345678+00:00] .Critical: Database connection completely lost
[2025-05-28T21:13:32.456789+00:00] .Info: User logout successful for user admin
[2025-05-28T21:13:33.567890+00:00] .Error: Failed to process order #12345`;

    // Access private methods for testing
    interface LogViewerInternals {
        getLogFileLines(filePath: string): LogItem[];
        searchTerm: string;
        searchCaseSensitive: boolean;
        searchUseRegex: boolean;
        matchesSearchTerm(text: string): boolean;
        groupLogEntries(lines: string[], filePath: string): LogItem[];
    }

    let logProvider: LogViewerProvider;

    // Set up and tear down
    suiteSetup(() => {
        // Create the test log file before tests
        fs.writeFileSync(logFilePath, sampleLogContent);
        logProvider = new LogViewerProvider(tempDir);
    });

    suiteTeardown(() => {
        // Clean up test files after tests
        try {
            logProvider.dispose();
            fs.unlinkSync(logFilePath);
            fs.rmdirSync(tempDir);
        } catch (err) {
            console.error('Failed to clean up test files:', err);
        }
    });

    test('Search term filtering should work with simple text', () => {
        const provider = logProvider as unknown as LogViewerInternals;

        // Set search term
        provider.searchTerm = 'admin';
        provider.searchCaseSensitive = false;
        provider.searchUseRegex = false;

        // Test matchesSearchTerm method
        assert.strictEqual(provider.matchesSearchTerm('User authentication failed for user admin'), true, 'Should match text containing "admin"');
        assert.strictEqual(provider.matchesSearchTerm('Database connection timeout'), false, 'Should not match text without "admin"');
        assert.strictEqual(provider.matchesSearchTerm('User logout successful for user ADMIN'), true, 'Should match case-insensitive "ADMIN"');
    });

    test('Search term filtering should work with case-sensitive mode', () => {
        const provider = logProvider as unknown as LogViewerInternals;

        // Set case-sensitive search
        provider.searchTerm = 'Admin';
        provider.searchCaseSensitive = true;
        provider.searchUseRegex = false;

        assert.strictEqual(provider.matchesSearchTerm('User authentication failed for user admin'), false, 'Should not match lowercase "admin" when searching for "Admin"');
        assert.strictEqual(provider.matchesSearchTerm('User authentication failed for user Admin'), true, 'Should match exact case "Admin"');
    });

    test('Search term filtering should work with regex mode', () => {
        const provider = logProvider as unknown as LogViewerInternals;

        // Set regex search
        provider.searchTerm = 'connection.*failed';
        provider.searchCaseSensitive = false;
        provider.searchUseRegex = true;

        assert.strictEqual(provider.matchesSearchTerm('Payment gateway connection failed'), true, 'Should match regex pattern');
        assert.strictEqual(provider.matchesSearchTerm('Database connection timeout'), false, 'Should not match when pattern doesn\'t match');
        assert.strictEqual(provider.matchesSearchTerm('connection setup failed'), true, 'Should match regex pattern with different middle text');
    });

    test('Search should filter log entries correctly', () => {
        const provider = logProvider as unknown as LogViewerInternals;

        // Set search for "connection"
        provider.searchTerm = 'connection';
        provider.searchCaseSensitive = false;
        provider.searchUseRegex = false;

        const lines = sampleLogContent.split('\n');
        const filteredEntries = provider.groupLogEntries(lines, logFilePath);

        // Should find entries with "connection" (database timeout, payment gateway, database lost)
        const hasConnectionEntries = filteredEntries.some(entry =>
            entry.label.includes('WARN') || entry.label.includes('ERROR') || entry.label.includes('CRITICAL')
        );

        assert.strictEqual(hasConnectionEntries, true, 'Should find log entries containing "connection"');
    });

    test('Empty search term should show all entries', () => {
        const provider = logProvider as unknown as LogViewerInternals;

        // Clear search term
        provider.searchTerm = '';
        provider.searchCaseSensitive = false;
        provider.searchUseRegex = false;

        assert.strictEqual(provider.matchesSearchTerm('Any log message'), true, 'Empty search should match all entries');
        assert.strictEqual(provider.matchesSearchTerm(''), true, 'Empty search should match empty string');
    });

    test('Invalid regex should fallback to simple string search', () => {
        const provider = logProvider as unknown as LogViewerInternals;

        // Set invalid regex
        provider.searchTerm = '[invalid(regex';
        provider.searchCaseSensitive = false;
        provider.searchUseRegex = true;

        // Should fallback to simple string search without throwing error
        assert.strictEqual(provider.matchesSearchTerm('This contains [invalid(regex pattern'), true, 'Should fallback to string search for invalid regex');
        assert.strictEqual(provider.matchesSearchTerm('This does not contain the pattern'), false, 'Should not match when fallback string search fails');
    });

    test('Search should work with different log levels', () => {
        const provider = logProvider as unknown as LogViewerInternals;

        // Search for "failed"
        provider.searchTerm = 'failed';
        provider.searchCaseSensitive = false;
        provider.searchUseRegex = false;

        const lines = sampleLogContent.split('\n');
        const filteredEntries = provider.groupLogEntries(lines, logFilePath);

        // Should find ERROR and INFO entries with "failed"
        const errorEntries = filteredEntries.filter(entry => entry.label.includes('ERROR'));
        const infoEntries = filteredEntries.filter(entry => entry.label.includes('INFO'));

        assert.ok(errorEntries.length > 0, 'Should find ERROR entries with "failed"');
        assert.ok(infoEntries.length > 0, 'Should find INFO entries with "failed"');
    });

    test('Regex search with flags should work correctly', () => {
        const provider = logProvider as unknown as LogViewerInternals;

        // Test case-insensitive regex
        provider.searchTerm = 'USER.*ADMIN';
        provider.searchCaseSensitive = false;
        provider.searchUseRegex = true;

        assert.strictEqual(provider.matchesSearchTerm('User authentication failed for user admin'), true, 'Should match case-insensitive regex');

        // Test case-sensitive regex
        provider.searchCaseSensitive = true;
        assert.strictEqual(provider.matchesSearchTerm('User authentication failed for user admin'), false, 'Should not match case-sensitive regex with wrong case');
        assert.strictEqual(provider.matchesSearchTerm('USER authentication failed for user ADMIN'), true, 'Should match case-sensitive regex with correct case');
    });
});
