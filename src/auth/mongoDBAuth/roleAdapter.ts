import mongoose, { Schema, Document, Model } from 'mongoose';

import { UserSchema } from './userAdapter';
import { PermissionSchema } from './permissionAdapter';

// Types
import type { Permission, Role, User, Session, Token, RoleId, PermissionId } from '../types';
import type { authDBInterface } from '../authDBInterface';

// System Logging
import logger from '@utils/logger';

// Define the Role schema
export const RoleSchema = new Schema(
	{
		name: { type: String, required: true }, // Name of the role, required field
		description: String, // Description of the role, optional field
		permissions: [{ type: Schema.Types.ObjectId, ref: 'auth_permissions' }] // Permissions associated with the role, optional field
	},
	{ timestamps: true }
);

export class RoleAdapter implements Partial<authDBInterface> {
	private RoleModel: Model<Role & Document>;
	private UserModel: Model<User & Document>;

	constructor() {
		// Create the Role model
		this.RoleModel = mongoose.models.auth_roles || mongoose.model<Role & Document>('auth_roles', RoleSchema);
		this.UserModel = mongoose.models.auth_users || mongoose.model<User & Document>('auth_users', UserSchema);
	}

	// Create a new role
	async createRole(roleData: Partial<Role>, currentUserId: string): Promise<Role> {
		try {
			const role = new this.RoleModel(roleData);
			await role.save();
			logger.info(`Role created: ${role.name} by user: ${currentUserId}`);
			return role.toObject() as Role;
		} catch (error) {
			logger.error(`Failed to create role: ${(error as Error).message}`);
			throw error;
		}
	}

	// Update a role
	async updateRole(role_id: string, roleData: Partial<Role>, currentUserId: string): Promise<void> {
		try {
			await this.RoleModel.findByIdAndUpdate(role_id, roleData);
			logger.debug(`Role updated: ${role_id} by user: ${currentUserId}`);
		} catch (error) {
			logger.error(`Failed to update role: ${(error as Error).message}`);
			throw error;
		}
	}

	// Delete a role
	async deleteRole(role_id: string, currentUserId: string): Promise<void> {
		try {
			await this.RoleModel.findByIdAndDelete(role_id);
			logger.info(`Role deleted: ${role_id} by user: ${currentUserId}`);
		} catch (error) {
			logger.error(`Failed to delete role: ${(error as Error).message}`);
			throw error;
		}
	}

	// Get a role by ID
	async getRoleById(role_id: string): Promise<Role | null> {
		try {
			const role = await this.RoleModel.findById(role_id).populate('permissions');
			logger.debug(`Role retrieved by ID: ${role_id}`);
			return role ? (role.toObject() as Role) : null;
		} catch (error) {
			logger.error(`Failed to get role by ID: ${(error as Error).message}`);
			throw error;
		}
	}

	// Get all roles
	async getAllRoles(options?: {
		limit?: number;
		skip?: number;
		sort?: { [key: string]: 1 | -1 } | [string, 1 | -1][];
		filter?: object;
	}): Promise<Role[]> {
		try {
			let query = this.RoleModel.find(options?.filter || {});

			if (options?.sort) {
				query = query.sort(options.sort as any);
			}
			if (typeof options?.skip === 'number') {
				query = query.skip(options.skip);
			}
			if (typeof options?.limit === 'number') {
				query = query.limit(options.limit);
			}

			const roles = await query.exec();
			logger.debug('All roles retrieved');
			return roles.map((role) => role.toObject() as Role);
		} catch (error) {
			logger.error(`Failed to get all roles: ${(error as Error).message}`);
			throw error;
		}
	}

	// Get a role by name
	async getRoleByName(name: string): Promise<Role | null> {
		try {
			const role = await this.RoleModel.findOne({ name }).populate('permissions');
			logger.debug(`Role retrieved by name: ${name}`);
			return role ? (role.toObject() as Role) : null;
		} catch (error) {
			logger.error(`Failed to get role by name: ${(error as Error).message}`);
			throw error;
		}
	}

	// Get all roles for a permission
	async getRolesForPermission(permission_id: string): Promise<Role[]> {
		try {
			const roles = await this.RoleModel.find({ permissions: permission_id });
			return roles.map((role) => role.toObject() as Role);
		} catch (error) {
			logger.error(`Failed to get roles for permission: ${(error as Error).message}`);
			throw error;
		}
	}

	// Get users with a role
	async getUsersWithRole(role_id: string): Promise<User[]> {
		try {
			const users = await this.UserModel.find({ roles: role_id });
			return users.map((user) => user.toObject() as User);
		} catch (error) {
			logger.error(`Failed to get users with role: ${(error as Error).message}`);
			throw error;
		}
	}

	// Get permissions for a role
	async getPermissionsForRole(role_id: string): Promise<Permission[]> {
		try {
			const role = await this.RoleModel.findById(role_id).populate('permissions');
			return role ? (role.permissions as unknown as Permission[]) : [];
		} catch (error) {
			logger.error(`Failed to get permissions for role: ${(error as Error).message}`);
			throw error;
		}
	}

	// Assign a permission to a role
	async assignPermissionToRole(role_id: string, permission_id: string): Promise<void> {
		try {
			await this.RoleModel.findByIdAndUpdate(role_id, { $addToSet: { permissions: permission_id } });
			logger.info(`Permission ${permission_id} assigned to role ${role_id}`);
		} catch (error) {
			logger.error(`Failed to assign permission to role: ${(error as Error).message}`);
			throw error;
		}
	}

	// Remove a permission from a role
	async removePermissionFromRole(role_id: string, permission_id: string): Promise<void> {
		try {
			await this.RoleModel.findByIdAndUpdate(role_id, { $pull: { permissions: permission_id } });
			logger.info(`Permission ${permission_id} removed from role ${role_id}`);
		} catch (error) {
			logger.error(`Failed to remove permission from role: ${(error as Error).message}`);
			throw error;
		}
	}

	// Initialize default roles
	async initializeDefaultRoles(): Promise<void> {
		try {
			const defaultRoles = [
				{ name: 'admin', description: 'Administrator with all permissions' },
				{ name: 'developer', description: 'Developer with elevated permissions' },
				{ name: 'editor', description: 'Content editor' },
				{ name: 'user', description: 'Regular user with basic permissions' }
			];

			for (const role of defaultRoles) {
				// Check if the role already exists
				const existingRole = await this.getRoleByName(role.name);
				if (!existingRole) {
					await this.createRole(role, 'system');
					logger.info(`Default role created: ${role.name}`);
				}
			}
		} catch (error) {
			logger.error(`Failed to initialize default roles: ${(error as Error).message}`);
			throw error;
		}
	}
}
