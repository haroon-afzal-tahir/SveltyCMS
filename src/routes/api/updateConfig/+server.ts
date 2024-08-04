/**
 * @file src/routes/api/updateConfig/+server.ts
 * @description API endpoint for updating the CMS configuration file.
 *
 * This module provides functionality to:
 * - Update the collections configuration file based on API input
 * - Validate and transform incoming configuration data
 * - Compare new configuration with existing to avoid unnecessary updates
 * - Handle file operations for reading and writing the config file
 *
 * Features:
 * - Dynamic configuration update without manual file editing
 * - Data transformation from API format to config file format
 * - Hash-based comparison to prevent redundant file writes
 * - Error handling and logging for file operations
 *
 * Usage:
 * POST /api/updateConfig
 * Body: JSON array of category objects with collections
 *
 * Note: This endpoint modifies a crucial configuration file.
 * Ensure proper access controls and input validation are in place.
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import type { RequestHandler } from './$types';
// System Logs
import logger from '@src/utils/logger';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const data = await request.json();

		// If data is undefined, return an error response
		if (!data || !Array.isArray(data)) {
			logger.warn('Invalid or no data provided in the request');
			return new Response('Invalid or no data provided', { status: 400 });
		}

		// Define the path to the config.ts file
		const configFilePath = path.join(process.cwd(), 'src', 'collections', 'config.ts');

		const transformedData = data.map((category: any) => ({
			name: category.name,
			icon: category.icon,
			collections: category.items.map((item: any) => `collections.${item.name}`)
		}));

		const newConfigFileContent = generateConfigFileContent(transformedData);

		const existingContent = await readExistingConfig(configFilePath);

		if (shouldUpdateConfig(newConfigFileContent, existingContent)) {
			await fs.writeFile(configFilePath, newConfigFileContent);
			logger.info('Config file updated successfully by API');
			return new Response('Config file updated successfully', { status: 200 });
		} else {
			logger.info('Config file does not need an update');
			return new Response(null, { status: 304 });
		}
	} catch (error: any) {
		logger.error('Error updating config file:', error);
		return new Response(`Error updating config file: ${error.message}`, { status: 500 });
	}
};

// Define the new content of the config.ts file
function generateConfigFileContent(data: any[]): string {
	let content = `// Configure how Collections are sorted & displayed in Categories section.
// This file is generated by the updateConfig API and will be recreated if altered in GUI

export function createCategories(collections: any) {return [\n`;

	for (const item of data) {
		content += `  {\n    name: "${item.name}",\n    icon: "${item.icon}",\n    collections: [\n`;
		for (const collection of item.collections) {
			content += `      ${collection},\n`;
		}
		content += `    ]\n  },\n`;
	}

	content += ']};\n';
	return content;
}

async function readExistingConfig(filePath: string): Promise<string> {
	try {
		return await fs.readFile(filePath, 'utf8');
	} catch (error) {
		logger.info('Config file does not exist, will create a new one');
		return '';
	}
}

function shouldUpdateConfig(newContent: string, existingContent: string): boolean {
	const newContentHash = crypto.createHash('md5').update(newContent).digest('hex');
	const existingContentHash = existingContent ? crypto.createHash('md5').update(existingContent).digest('hex') : '';
	return newContentHash !== existingContentHash;
}
