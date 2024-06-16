// Define the hardcoded admin role
export const adminRole = 'admin';

// Define flexible roles
export const flexibleRoles = ['developer', 'editor', 'user'] as const;

// Combine all roles
export const roles = [adminRole, ...flexibleRoles] as const;

// Define the type for roles
export type Roles = (typeof roles)[number];

// Permissions for roles
export const permissions = [
	'create', // This permission allows users to create new content.
	'read', // This permission allows users to view the content. They can't make any changes to it.
	'write', // This permission allows users to create new content and make changes to existing content.
	'delete' // This permission allows users to remove content from the system
] as const;

// Defines Permissions type for flexible role-based permissions.
export type Permissions = {
	[K in Roles]?: { [permission in (typeof permissions)[number]]?: boolean };
};

// Define a user Role permission that can be overwritten
export const defaultPermissions = roles.reduce((acc, role) => {
	return {
		...acc,
		[role]: permissions.reduce((acc, permission) => {
			switch (role) {
				case 'admin':
				case 'developer':
					return { ...acc, [permission]: true };
				case 'editor':
					return { ...acc, [permission]: true };
				case 'user':
					return { ...acc, [permission]: true, write: false };
				default:
					return { ...acc, [permission]: false };
			}
		}, {})
	} as Permissions;
}, {} as Permissions);

// Icons permission
export const icon = {
	create: 'bi:plus-circle-fill',
	read: 'bi:eye-fill',
	write: 'bi:pencil-fill',
	delete: 'bi:trash-fill'
} as const;

// Colors permission
export const color = {
	disabled: {
		create: 'variant-outline-primary',
		read: 'variant-outline-tertiary',
		write: 'variant-outline-warning',
		delete: 'variant-outline-error'
	},
	enabled: {
		create: 'variant-filled-primary',
		read: 'variant-filled-tertiary',
		write: 'variant-filled-warning',
		delete: 'variant-filled-error'
	}
} as const;

// Define the schema for a User
export const UserSchema = {
	// Can be changed by /user
	email: { type: String, required: true }, // The email associated email
	password: String, // The password of the user
	role: { type: String, required: true }, // The role of the user
	username: String, // The username of the user
	avatar: String, // The URL of the user's avatar media_image

	// Cannot be changed by /user
	lastAuthMethod: String, // The last method the user used to authenticate
	lastActiveAt: Date, // The last time the user was active
	expiresAt: Date, // When the reset token expires
	is_registered: Boolean, // Whether the user has completed registration
	blocked: Boolean, // Whether the user is blocked
	resetRequestedAt: String, // The last time the user requested a password reset
	resetToken: String // The token for resetting the user's password
};

// Define the schema for a Session
export const SessionSchema = {
	user_id: { type: String, required: true }, // The ID of the user who owns the session
	expires: { type: Date, required: true } // When the session expires
};

// Define the schema for a Token
export const TokenSchema = {
	user_id: { type: String, required: true }, // The ID of the user who owns the token
	token: { type: String, required: true }, // The token string
	email: String, // The email associated with the token
	expires: { type: Date, required: true } // When the token expires
};

// Define the TypeScript types based on the schemas
export interface User {
	id: string;
	email: string;
	password?: string;
	role: string;
	username?: string;
	avatar?: string;
	lastAuthMethod?: string;
	lastActiveAt?: Date;
	expiresAt?: Date;
	is_registered?: boolean;
	blocked?: boolean;
	resetRequestedAt?: string;
	resetToken?: string;
}

export interface Session {
	id: string;
	user_id: string;
	expires: Date;
}

export interface Token {
	id: string;
	user_id: string;
	token: string;
	email?: string;
	expires: Date;
}

// Define the type for a Cookie
export type Cookie = {
	name: string; // The name of the cookie
	value: string; // The value of the cookie
	attributes: {
		sameSite: boolean | 'lax' | 'strict' | 'none' | undefined; // The SameSite attribute of the cookie
		path: string; // The path of the cookie
		httpOnly: true; // Whether the cookie is HTTP only
		expires: Date; // When the cookie expires
		secure: boolean; // Whether the cookie is secure
	};
};

// Sanitizes a permissions dictionary by removing empty roles
// (roles with no permissions) and returning undefined if all roles are empty.
export const sanitizePermissions = (permissions: any) => {
	const res = Object.keys(permissions).reduce((acc, r) => {
		acc[r] = Object.keys(permissions[r]).reduce((acc, p) => {
			// Include permission only if it's denied (false)
			if (permissions[r][p] != defaultPermissions[r][p]) {
				acc[p] = permissions[r][p];
			}
			return acc;
		}, {});

		// Remove role if it has no permissions (empty object)
		if (Object.keys(acc[r]).length == 0) delete acc[r];
		return acc;
	}, {});

	// Return undefined if all roles are empty (no valid permissions)
	if (Object.keys(res).length == 0) return undefined;
	return res;
};

// Define the type for a Model
export interface Model<T> {
	create(data: Partial<T>): Promise<T>;
	findOne(query: Partial<T>): Promise<T | null>;
	find(query: Partial<T>): Promise<T[]>;
	updateOne(query: Partial<T>, update: Partial<T>): Promise<void>;
	deleteOne(query: Partial<T>): Promise<void>;
	countDocuments(query?: Partial<T>): Promise<number>;
}

export type WidgetId = string;
