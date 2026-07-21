import { defineConfig } from '@vscode/test-cli';
import * as fs from 'fs';

const insidersPath = '/Applications/Visual Studio Code - Insiders.app/Contents/MacOS/Code - Insiders';
const stablePath = '/Applications/Visual Studio Code.app/Contents/MacOS/Electron';

function findLocalVSCode() {
	if (fs.existsSync(insidersPath)) {
		return insidersPath;
	}
	if (fs.existsSync(stablePath)) {
		return stablePath;
	}
	return undefined;
}

const localVSCode = findLocalVSCode();

export default defineConfig({
	files: 'out/test/**/*.test.js',
	...(localVSCode ? { useInstallation: { fromPath: localVSCode } } : {}),
});
