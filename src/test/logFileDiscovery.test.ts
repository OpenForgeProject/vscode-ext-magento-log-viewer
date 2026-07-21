import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { LogViewerProvider, LogItem } from '../logViewer';

suite('Log File Discovery Test Suite', () => {
    let tempDir: string;
    let magentoRoot: string;
    let logDir: string;
    let provider: LogViewerProvider;

    const sampleLogContent = `[2025-05-28T21:13:28.751586+00:00] .Info: Broken reference: the 'amcompany_toolbar_link' element cannot be added as child to 'header.links', because the latter doesn't exist
[2025-05-28T21:13:30.234567+00:00] .Error: Failed to load resource: server responded with status 404`;

    suiteSetup(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'magento-logviewer-discovery-'));
        magentoRoot = tempDir;
        logDir = path.join(magentoRoot, 'var', 'log');
        fs.mkdirSync(logDir, { recursive: true });

        fs.writeFileSync(path.join(logDir, 'system.log'), sampleLogContent);
        fs.writeFileSync(path.join(logDir, 'exception.log'), sampleLogContent);
    });

    suiteTeardown(() => {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (err) {
            console.error('Failed to clean up test files:', err);
        }
    });

    setup(() => {
        provider = new LogViewerProvider(magentoRoot);
    });

    teardown(() => {
        provider.dispose();
    });

    async function waitForInitialization(): Promise<void> {
        // Wait for the async initialization in the provider constructor
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    test('LogViewerProvider should discover all .log files under var/log', async () => {
        await waitForInitialization();

        const children = await provider.getChildren();

        const labels = children.map((item: LogItem) => item.label?.toString());
        console.log('Discovered log files:', labels);

        assert.strictEqual(children.length, 2, `Expected 2 log files but found ${children.length}: ${JSON.stringify(labels)}`);
        assert.ok(labels.some((label: unknown) => typeof label === 'string' && label.includes('system.log')), 'Should discover system.log');
        assert.ok(labels.some((label: unknown) => typeof label === 'string' && label.includes('exception.log')), 'Should discover exception.log');
    });

    test('LogViewerProvider should not return "No items found" when log files exist', async () => {
        await waitForInitialization();

        const children = await provider.getChildren();

        assert.ok(children.length > 0, 'Should return at least one child');

        const noItemsFound = children.some((item: LogItem) =>
            item.label?.toString().includes('No items found')
        );
        assert.strictEqual(noItemsFound, false, 'Should not show "No items found" when log files exist');
    });

    test('LogViewerProvider should not show "Loading log files..." indefinitely with an empty workspace root', async () => {
        provider.dispose();
        provider = new LogViewerProvider('');

        await waitForInitialization();

        const children = await provider.getChildren();

        const stillLoading = children.some((item: LogItem) =>
            item.label?.toString().includes('Loading log files...')
        );
        assert.strictEqual(stillLoading, false, 'Should leave loading state even when workspace root is empty');
    });

    test('LogViewerProvider should show a helpful message when workspace root is empty', async () => {
        provider.dispose();
        provider = new LogViewerProvider('');

        await waitForInitialization();

        const children = await provider.getChildren();

        assert.ok(children.length > 0, 'Should return a message item instead of an empty tree');

        const labels = children.map((item: LogItem) => item.label?.toString());
        const hasHelpfulMessage = labels.some((label: unknown) =>
            typeof label === 'string' && label.toLowerCase().includes('magento root')
        );
        assert.strictEqual(hasHelpfulMessage, true, `Should prompt user about Magento root, got: ${JSON.stringify(labels)}`);
    });
});
