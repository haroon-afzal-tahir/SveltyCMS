/**
 * @file src/routes/api/query/DELETE.ts
 * @description Handler for DELETE operations on collections.
 *
 * This module provides functionality to:
 * - Delete multiple documents from a specified collection
 * - Handle associated link deletions
 * - Perform pre-deletion modifications via modifyRequest
 *
 * Features:
 * - Multiple document deletion support
 * - Associated link cleanup
 * - Pre-deletion request modification
 * - Error handling and logging
 *
 * Usage:
 * Called by the main query handler for DELETE operations
 * Expects FormData with 'ids' field containing a JSON array of document IDs to delete
 *
 * Note: This handler assumes that user authentication and authorization
 * have already been performed by the calling function.
 */

import type { Schema } from '@src/collections/types';
import type { User } from '@src/auth/types';

import { dbAdapter, getCollectionModels } from '@src/databases/db';
import { modifyRequest } from './modifyRequest';

// System logger
import logger from '@src/utils/logger';

// Function to handle DELETE requests for a specified collection
export const _DELETE = async ({ data, schema, user }: { data: FormData; schema: Schema; user: User }) => {
	try {
		logger.debug(`DELETE request received for schema: ${schema.name}, user_id: ${user._id}`);

		if (!dbAdapter) {
			logger.error('Database adapter is not initialized.');
			return new Response('Internal server error: Database adapter not initialized', { status: 500 });
		}

		const collections = await getCollectionModels(); // Get collection models from the database
		logger.debug(`Collection models retrieved: ${Object.keys(collections).join(', ')}`);

		const collection = collections[schema.name];

		// Check if the collection exists
		if (!collection) {
			logger.error(`Collection not found for schema: ${schema.name}`);
			return new Response('Collection not found', { status: 404 });
		}

		// Parse the IDs from the form data
		const ids = data.get('ids');
		if (!ids) {
			logger.error('No IDs provided for deletion');
			return new Response('No IDs provided for deletion', { status: 400 });
		}

		const idsArray: string[] = JSON.parse(ids as string);
		logger.debug(`IDs to delete: ${idsArray.join(', ')}`);

		// Modify request for each ID
		for (const id of idsArray) {
			await modifyRequest({
				collection,
				data: [{ _id: id }],
				user,
				fields: schema.fields,
				type: 'DELETE'
			});
			logger.debug(`Request modified for ID: ${id}`);

			// Handle link deletions for each ID
			for (const link of schema.links || []) {
				await dbAdapter.deleteMany(link, {
					_link_id: id,
					_linked_collection: schema.name
				});
				logger.debug(`Links deleted for ID: ${id} in collection: ${link}`);
			}
		}

		// Delete the documents with the specified IDs
		const result = await collection.deleteMany({
			_id: { $in: idsArray }
		});
		logger.info(`Documents deleted: ${result.deletedCount} for schema: ${schema.name}`);

		// Return the result as a JSON response
		return new Response(JSON.stringify(result), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		logger.error(`Error occurred during DELETE request: ${errorMessage}`);
		return new Response(errorMessage, { status: 500 });
	}
};
