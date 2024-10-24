/**
 * @file src/routes/api/virtualFolder/[folderId]/+server.ts
 * @description API endpoint to manage virtual folders and their contents within a media gallery system.
 *
 * Features:
 * - GET: Retrieve contents of a specific folder
 * - POST: Create a new subfolder within a specified folder
 * - PATCH: Update folder details (name, parent)
 * - DELETE: Remove a folder and its contents
 *
 * Usage:
 * - Use 'root' as folderId to interact with the root folder
 * - Ensure dbAdapter is properly initialized before using this endpoint
 * - Handle ARIA labels in frontend for improved accessibility
 */

import { publicEnv } from '@root/config/public';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbAdapter } from '@src/databases/db';
import { logger } from '@utils/logger';

// Define the structure of a virtual folder
interface VirtualFolder {
	_id: string;
	name: string;
	parent?: string | null;
	path: string;
}

// Define the structure of folder contents
interface FolderContents {
	subfolders: VirtualFolder[];
	mediaFiles: any[]; // Replace 'any' with a more specific type if available
}

// Retrieve or create the root folder
async function getRootFolder(): Promise<VirtualFolder> {
	const rootFolder = await dbAdapter.findOne('VirtualFolder', {
		name: publicEnv.MEDIA_FOLDER,
		parent: null
	});

	if (!rootFolder) {
		// Create root folder if it doesn't exist
		return await dbAdapter.createVirtualFolder({
			name: publicEnv.MEDIA_FOLDER,
			parent: null,
			path: publicEnv.MEDIA_FOLDER
		});
	}

	return rootFolder;
}

// Generate a standardized error response
function errorResponse(message: string, status: number = 500) {
	logger.error(message);
	return json({ success: false, error: message }, { status });
}

// Recursively update paths of child folders
async function updateChildPaths(folderId: string, newParentPath: string) {
	const children = await dbAdapter.find('VirtualFolder', { parent: folderId });
	for (const child of children) {
		const newPath = `${newParentPath}/${child.name}`;
		await dbAdapter.updateVirtualFolder(child._id, { path: newPath });
		await updateChildPaths(child._id, newPath);
	}
}

// GET: Retrieve folder contents
export const GET: RequestHandler = async ({ params }) => {
	const { folderId } = params;

	try {
		if (!dbAdapter) {
			return errorResponse('Database adapter is not initialized', 500);
		}

		// Handle root folder specially
		const folder = folderId === 'root' ? await getRootFolder() : await dbAdapter.findOne('VirtualFolder', { _id: folderId });

		if (!folder) {
			return errorResponse('Folder not found', 404);
		}

		// Fetch folder contents
		let contents: FolderContents;
		try {
			contents = await dbAdapter.getVirtualFolderContents(folder._id.toString());
		} catch (error) {
			logger.warn('Error fetching folder contents:', error);
			contents = { subfolders: [], mediaFiles: [] };
		}

		// Ensure contents has the correct structure
		const safeContents: FolderContents = {
			subfolders: Array.isArray(contents?.subfolders) ? contents.subfolders : [],
			mediaFiles: Array.isArray(contents?.mediaFiles) ? contents.mediaFiles : []
		};

		// Return folder info and contents
		return json({
			success: true,
			contents: safeContents,
			folder: {
				id: folder._id,
				name: folder.name,
				path: folder.path,
				ariaLabel: `Folder: ${folder.name}`
			}
		});
	} catch (error) {
		return errorResponse(`Failed to fetch folder contents: ${error}`, 500);
	}
};

// POST: Create a new subfolder
export const POST: RequestHandler = async ({ params, request }) => {
	const { folderId } = params;

	try {
		if (!dbAdapter) {
			return errorResponse('Database adapter is not initialized', 500);
		}

		const { name } = await request.json();

		if (!name) {
			return errorResponse('Folder name is required', 400);
		}

		// Get parent folder (root or specified)
		const parentFolder = folderId === 'root' ? await getRootFolder() : await dbAdapter.findOne('VirtualFolder', { _id: folderId });

		if (!parentFolder) {
			return errorResponse('Parent folder not found', 404);
		}

		// Create new folder
		const newPath = `${parentFolder.path}/${name}`;
		const newFolder = await dbAdapter.createVirtualFolder({
			name,
			parent: parentFolder._id,
			path: newPath
		});

		logger.info(`Subfolder created: ${name} under folderId ${parentFolder._id}`);

		// Return new folder info
		return json(
			{
				success: true,
				folder: {
					...newFolder,
					ariaLabel: `New folder: ${name}`
				}
			},
			{ status: 201 }
		);
	} catch (error) {
		return errorResponse(`Failed to create subfolder: ${error}`, 500);
	}
};

// PATCH: Update folder details
export const PATCH: RequestHandler = async ({ params, request }) => {
	const { folderId } = params;

	try {
		const { name, parent } = await request.json();

		if (!name) {
			return errorResponse('Folder name is required', 400);
		}

		// Get folder to update
		const folder = folderId === 'root' ? await getRootFolder() : await dbAdapter.findOne('VirtualFolder', { _id: folderId });

		if (!folder) {
			return errorResponse('Folder not found', 404);
		}

		// Handle parent folder change
		let newParent: VirtualFolder | null = null;
		if (parent) {
			newParent = parent === 'root' ? await getRootFolder() : await dbAdapter.findOne('VirtualFolder', { _id: parent });
			if (!newParent) {
				return errorResponse('New parent folder not found', 404);
			}
		}

		// Prepare update data
		const updateData: Partial<VirtualFolder> = { name };
		if (newParent) {
			updateData.parent = newParent._id;
			updateData.path = `${newParent.path}/${name}`;
		} else {
			updateData.path = `${folder.path.split('/').slice(0, -1).join('/')}/${name}`;
		}

		// Update folder
		const updatedFolder = await dbAdapter.updateVirtualFolder(folder._id, updateData);

		// Update child paths if parent changed
		if (newParent) {
			await updateChildPaths(folder._id, updatedFolder.path);
		}

		logger.info(`Folder with ID ${folder._id} updated successfully`);

		// Return updated folder info
		return json({
			success: true,
			folder: {
				...updatedFolder,
				ariaLabel: `Updated folder: ${updatedFolder.name}`
			}
		});
	} catch (error) {
		return errorResponse(`Failed to update folder: ${error}`, 500);
	}
};

// DELETE: Remove a folder and its contents
export const DELETE: RequestHandler = async ({ params }) => {
	const { folderId } = params;

	try {
		if (folderId === 'root') {
			return errorResponse('Cannot delete root folder', 400);
		}

		// Find folder to delete
		const folder = await dbAdapter.findOne('VirtualFolder', { _id: folderId });
		if (!folder) {
			return errorResponse('Folder not found', 404);
		}

		// Delete folder
		const success = await dbAdapter.deleteVirtualFolder(folderId);

		if (!success) {
			return errorResponse('Folder deletion failed', 500);
		}

		logger.info(`Folder with ID ${folderId} deleted successfully`);

		// Return success message
		return json({
			success: true,
			message: `Folder "${folder.name}" deleted successfully`,
			ariaLabel: `Deleted folder: ${folder.name}`
		});
	} catch (error) {
		return errorResponse(`Failed to delete folder: ${error}`, 500);
	}
};
