import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Import the main module components to test
import { LogViewerProvider, LogItem } from '../logViewer';

suite('Theme Grouping Test Suite', () => {
    // Create a temporary directory for test logs
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'magento-theme-test-'));
    const logFilePath = path.join(tempDir, 'debug.log');

    // Sample log content with multiple "Broken reference" entries and other themes
    const sampleLogContent = `[2025-12-04T07:44:12.751586+00:00] .INFO: Broken reference: the 'brands-link' element cannot be added as child to 'top.links'
[2025-12-04T07:44:12.752000+00:00] .INFO: Broken reference: the 'footer_blog_link' element cannot be added as child to 'footer'
[2025-12-04T07:44:12.753000+00:00] .INFO: Broken reference: the 'payment.cart' element cannot be added as child to 'checkout.cart'
[2025-12-04T07:44:12.754000+00:00] .INFO: Database connection established successfully
[2025-12-04T07:44:12.755000+00:00] .INFO: Broken reference: the 'paymentgate' element cannot be added
[2025-12-04T07:44:12.756000+00:00] .INFO: Cache invalidation completed
[2025-12-04T07:44:12.757000+00:00] .WARN: Broken reference: the 'magento_html_sitemap' element cannot be found
[2025-12-04T07:44:12.758000+00:00] .ERROR: Broken reference: the 'left_schedule_blocks' element is missing`;

    // Interface to access private methods for testing
    interface LogViewerInternals {
        groupLogEntries(lines: string[], filePath: string): LogItem[];
        groupByMessage: boolean;
    }

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

    test('Theme grouping should group "Broken reference" entries together', () => {
        // Create a LogViewerProvider instance with grouping enabled
        const logProvider = new LogViewerProvider(tempDir);

        // Cast to access internal methods
        const provider = logProvider as unknown as LogViewerInternals;

        // Ensure groupByMessage is enabled
        provider.groupByMessage = true;

        // Split the log content into lines for processing
        const lines = sampleLogContent.split('\n').filter(line => line.trim());

        // Process the lines through groupLogEntries
        const logItems = provider.groupLogEntries(lines, logFilePath);

        // Should have log level groups (INFO, WARN, ERROR)
        assert.ok(logItems.length > 0, 'Should create log level groups');

        // Find the INFO group
        const infoGroup = logItems.find(item => item.label?.toString().includes('INFO'));
        assert.ok(infoGroup, 'Should have INFO log level group');
        assert.ok(infoGroup.children, 'INFO group should have children');

        // Check if "Broken reference" theme group exists
        const brokenRefGroup = infoGroup.children?.find((child: LogItem) =>
            child.label?.toString().includes('Broken reference')
        );
        assert.ok(brokenRefGroup, 'Should have "Broken reference" theme group');

        // Verify the count is in the description (LogItem moves count from label to description)
        const brokenRefLabel = brokenRefGroup.label?.toString() || '';
        const brokenRefDescription = brokenRefGroup.description || '';

        console.log(`Found broken reference group label: "${brokenRefLabel}"`);
        console.log(`Found broken reference group description: "${brokenRefDescription}"`);

        // The count should be in the description as "(X)"
        assert.ok(brokenRefDescription.includes('(') && brokenRefDescription.includes(')'),
            `Broken reference group should show count in description, got: "${brokenRefDescription}"`);

        // Extract count from description like "(5)"
        const countMatch = brokenRefDescription.match(/\((\d+)\)/);
        assert.ok(countMatch, `Should have count in parentheses format in description, got: "${brokenRefDescription}"`);

        const count = parseInt(countMatch![1]);
        assert.ok(count >= 4, `Should group at least 4 "Broken reference" entries, found ${count}`);

        // Verify the group has children (the actual log entries)
        assert.ok(brokenRefGroup.children, 'Broken reference group should have children');
        assert.strictEqual(brokenRefGroup.children.length, count,
            `Broken reference group should have ${count} children matching the count in description`);

        // Verify individual entries are formatted correctly
        const firstEntry = brokenRefGroup.children[0];
        assert.ok(firstEntry.label?.toString().startsWith('Line '),
            'Individual entries should start with "Line "');

        console.log(`✅ Theme grouping test passed: Found "${brokenRefLabel}" with description "${brokenRefDescription}" and ${count} entries`);
    });

    test('Theme grouping should handle multiple log levels with different themes', () => {
        const logProvider = new LogViewerProvider(tempDir);
        const provider = logProvider as unknown as LogViewerInternals;
        provider.groupByMessage = true;

        const lines = sampleLogContent.split('\n').filter(line => line.trim());
        const logItems = provider.groupLogEntries(lines, logFilePath);

        // Should have multiple log level groups
        const logLevels = logItems.map(item => item.label?.toString().split(' ')[0]);
        assert.ok(logLevels.includes('INFO'), 'Should have INFO level');
        assert.ok(logLevels.includes('WARN'), 'Should have WARN level');
        assert.ok(logLevels.includes('ERROR'), 'Should have ERROR level');

        // Each level with "Broken reference" should have the theme group
        const infoGroup = logItems.find(item => item.label?.toString().includes('INFO'));
        const warnGroup = logItems.find(item => item.label?.toString().includes('WARN'));
        const errorGroup = logItems.find(item => item.label?.toString().includes('ERROR'));

        // Check INFO has Broken reference theme
        const infoBrokenRef = infoGroup?.children?.find((child: LogItem) =>
            child.label?.toString().includes('Broken reference')
        );
        assert.ok(infoBrokenRef, 'INFO should have Broken reference theme group');

        // Check WARN has Broken reference theme
        const warnBrokenRef = warnGroup?.children?.find((child: LogItem) =>
            child.label?.toString().includes('Broken reference')
        );
        assert.ok(warnBrokenRef, 'WARN should have Broken reference theme group');

        // Check ERROR has Broken reference theme
        const errorBrokenRef = errorGroup?.children?.find((child: LogItem) =>
            child.label?.toString().includes('Broken reference')
        );
        assert.ok(errorBrokenRef, 'ERROR should have Broken reference theme group');

        console.log('✅ Multi-level theme grouping test passed');
    });

    test('Theme grouping should work with non-grouping mode disabled', () => {
        const logProvider = new LogViewerProvider(tempDir);
        const provider = logProvider as unknown as LogViewerInternals;

        // Disable groupByMessage
        provider.groupByMessage = false;

        const lines = sampleLogContent.split('\n').filter(line => line.trim());
        const logItems = provider.groupLogEntries(lines, logFilePath);

        // Should still have log level groups
        assert.ok(logItems.length > 0, 'Should create log level groups even without theme grouping');

        // Find INFO group
        const infoGroup = logItems.find(item => item.label?.toString().includes('INFO'));
        assert.ok(infoGroup, 'Should have INFO group');

        // In non-grouping mode, should NOT have theme groups
        const hasThemeGroups = infoGroup?.children?.some((child: LogItem) =>
            child.label?.toString().includes('Broken reference') &&
            child.label?.toString().includes('(') // Check for count in parentheses
        );
        assert.ok(!hasThemeGroups, 'Should NOT have theme groups when groupByMessage is false');

        console.log('✅ Non-grouping mode test passed');
    });

    test('Empty log should not crash theme grouping', () => {
        const logProvider = new LogViewerProvider(tempDir);
        const provider = logProvider as unknown as LogViewerInternals;
        provider.groupByMessage = true;

        // Test with empty lines
        const emptyLogItems = provider.groupLogEntries([], logFilePath);
        assert.strictEqual(emptyLogItems.length, 0, 'Empty log should return empty array');

        // Test with invalid log lines
        const invalidLines = ['invalid line', 'another invalid', 'no log format here'];
        const invalidLogItems = provider.groupLogEntries(invalidLines, logFilePath);
        assert.strictEqual(invalidLogItems.length, 0, 'Invalid log lines should return empty array');

        console.log('✅ Edge cases test passed');
    });
});
