import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Import the main module components to test
import { ReportViewerProvider, LogItem } from '../logViewer';

suite('Report Reader Test Suite', () => {
    // Create a temporary directory for test reports
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'magento-reportviewer-test-'));
    const reportFilePath = path.join(tempDir, 'report.json');

    // Sample report content (Magento error report format)
    const sampleReportContent = JSON.stringify({
        "0": "Error",
        "1": "Exception: Broken reference: the 'amcompany_toolbar_link' element cannot be added as child to 'header.links', because the latter doesn't exist",
        "2": "#1 Magento\\Framework\\View\\Layout\\Generator\\Structure->scheduleStructure() called at /var/www/html/vendor/magento/framework/View/Layout/GeneratorPool.php:105",
        "3": "#2 Magento\\Framework\\View\\Layout\\GeneratorPool->process() called at /var/www/html/vendor/magento/framework/View/Layout.php:352",
        "url": "/customer/account/login/",
        "script_name": "/index.php",
        "report_id": "12345abcde"
    }, null, 2);

    // Set up and tear down
    suiteSetup(() => {
        // Create the test report file before tests
        fs.writeFileSync(reportFilePath, sampleReportContent);
    });

    suiteTeardown(() => {
        // Clean up test files after tests
        try {
            fs.unlinkSync(reportFilePath);
            fs.rmdirSync(tempDir);
        } catch (err) {
            console.error('Failed to clean up test files:', err);
        }
    });

    test('Report file should exist', () => {
        assert.strictEqual(fs.existsSync(reportFilePath), true, 'Test report file should exist');
    });

    test('Report file should be readable', () => {
        const content = fs.readFileSync(reportFilePath, 'utf-8');
        assert.strictEqual(content, sampleReportContent, 'Report file content should match the sample content');
    });

    test('ReportViewerProvider should read report file correctly', async () => {
        // Create a ReportViewerProvider instance with the temp directory as root
        const reportProvider = new ReportViewerProvider(tempDir);

        // Interface for accessing private methods for testing
        interface ReportViewerInternals {
            getLogItems(dir: string, label: string): LogItem[];
        }

        // Access the provider's internal methods
        const provider = reportProvider as unknown as ReportViewerInternals;

        // Get report items from the directory
        const reportItems = provider.getLogItems(tempDir, 'Reports');

        // Basic validation that reports were found
        assert.ok(reportItems.length > 0, 'Should find report entries');

        // Verify report content is correctly parsed
        const reportItem = reportItems[0];
        assert.ok(reportItem.label?.toString().includes('Error'), 'Report label should include the error type from the report');

        // Also check if the command arguments contain the file path
        assert.ok(reportItem.command &&
                 reportItem.command.arguments &&
                 reportItem.command.arguments[0] &&
                 reportItem.command.arguments[0].endsWith('report.json'),
                 'Report item should have command with file path');
    });

    // Additional test for report content parsing if needed
});
