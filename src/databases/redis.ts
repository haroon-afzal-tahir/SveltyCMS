/**
 * @file src/databases/redis.ts
 * @description Redis client initialization and caching operations for the CMS.
 *
 * This module provides functionality for:
 * - Initializing and managing a Redis client connection
 * - Caching and retrieving data using Redis
 * - Handling session caching specifically for user sessions
 *
 * Features:
 * - Conditional Redis initialization based on configuration
 * - Generic caching operations (get, set, clear)
 * - Session-specific caching operations
 * - Error handling and logging for all Redis operations
 * - Connection management (initialization and closure)
 *
 * Usage:
 * This module is used throughout the application for caching purposes,
 * particularly for improving performance of frequently accessed data
 * and managing user sessions.
 */

import { privateEnv } from '@root/config/private';

// Types
import type { User } from '@src/auth/types';

import { createClient } from 'redis';

// System Logs
import logger from '@src/utils/logger';

let redisClient: ReturnType<typeof createClient> | null = null;

export async function initializeRedis() {
	if (!privateEnv.USE_REDIS) {
		logger.info('Redis is disabled in configuration');
		return;
	}

	try {
		redisClient = createClient({
			url: `redis://${privateEnv.REDIS_HOST}:${privateEnv.REDIS_PORT}`,
			password: privateEnv.REDIS_PASSWORD || undefined
		});

		await redisClient.connect();
		logger.info('Redis client connected successfully');

		redisClient.on('error', (err) => logger.error('Redis Client Error', err));
	} catch (error) {
		const err = error as Error;
		logger.error(`Failed to initialize Redis client: ${err.message}`);
		redisClient = null;
	}
}

export async function getCache<T>(key: string): Promise<T | null> {
	if (!redisClient) {
		logger.warn('Redis client is not initialized. Returning null.');
		return null;
	}

	try {
		const value = await redisClient.get(key);
		return value ? JSON.parse(value) : null;
	} catch (error) {
		if (error instanceof Error) {
			logger.error(`Redis get error for key ${key}: ${error.message}`);
		} else {
			logger.error(`Redis get error for key ${key}: ${String(error)}`);
		}
		return null;
	}
}

export async function setCache<T>(key: string, value: T, expirationInSeconds: number = 3600): Promise<void> {
	if (!redisClient) {
		logger.warn('Redis client is not initialized. Skipping cache set.');
		return;
	}

	try {
		await redisClient.set(key, JSON.stringify(value), {
			EX: expirationInSeconds
		});
	} catch (error) {
		if (error instanceof Error) {
			logger.error(`Redis set error for key ${key}: ${error.message}`);
		} else {
			logger.error(`Redis set error for key ${key}: ${String(error)}`);
		}
	}
}

export async function getCachedSession(sessionId: string): Promise<User | null> {
	return getCache<User>(`session:${sessionId}`);
}

export async function setCachedSession(sessionId: string, user: User, expirationInSeconds: number = 3600): Promise<void> {
	await setCache(`session:${sessionId}`, user, expirationInSeconds);
}

export async function clearCachedSession(sessionId: string): Promise<void> {
	await clearCache(`session:${sessionId}`);
}

export async function clearCache(key: string): Promise<void> {
	if (!redisClient) {
		logger.warn('Redis client is not initialized. Skipping cache clear.');
		return;
	}

	try {
		await redisClient.del(key);
	} catch (error) {
		if (error instanceof Error) {
			logger.error(`Redis delete error for key ${key}: ${error.message}`);
		} else {
			logger.error(`Redis delete error for key ${key}: ${String(error)}`);
		}
	}
}

export async function closeRedisConnection() {
	if (redisClient) {
		await redisClient.quit();
		logger.info('Redis connection closed');
	}
}

export function isRedisEnabled(): boolean {
	return !!redisClient;
}
