// services/permissionCache.js

import { createClient } from 'redis';
import PermissionAggregator from '../utils/permissionAggregation.js';
import RoleAssignmentModel from '../models/HRModals/RoleAssignment.model.js';
import CONSTANTS from '../config/constants.js';

/**
 * ✅ PERMISSION CACHING SERVICE
 * Redis-based caching for performance
 */

class PermissionCache {
  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });
    
    this.connected = false;
  }

  async connect() {
    if (!this.connected) {
      await this.client.connect();
      this.connected = true;
      console.log('✅ Redis connected for permission caching');
    }
  }

  /**
   * Get permissions (with cache)
   */
  async get(employeeId) {
    try {
      await this.connect();
      
      const key = `permissions:${employeeId}`;
      const cached = await this.client.get(key);
      
      if (cached) {
        console.log(`📦 Cache hit: permissions for ${employeeId}`);
        return JSON.parse(cached);
      }
      
      console.log(`📝 Cache miss: fetching permissions for ${employeeId}`);
      const perms = await PermissionAggregator.getEffectivePermissions(employeeId);
      
      // Cache for TTL
      await this.client.setEx(
        key,
        CONSTANTS.CACHE_TTL.PERMISSIONS,
        JSON.stringify(perms)
      );
      
      return perms;
      
    } catch (error) {
      console.error('❌ Cache get error:', error);
      // Fallback to direct fetch
      return await PermissionAggregator.getEffectivePermissions(employeeId);
    }
  }

  /**
   * Invalidate cache for specific employee
   */
  async invalidate(employeeId) {
    try {
      await this.connect();
      await this.client.del(`permissions:${employeeId}`);
      console.log(`🗑️ Cache invalidated for ${employeeId}`);
    } catch (error) {
      console.error('❌ Cache invalidate error:', error);
    }
  }

  /**
   * Invalidate cache for all employees with a role
   */
  async invalidateByRole(roleId) {
    try {
      const assignments = await RoleAssignmentModel.find({
        roleId,
        isActive: true
      });
      
      await Promise.all(
        assignments.map(a => this.invalidate(a.employeeId))
      );
      
      console.log(`🗑️ Cache invalidated for role ${roleId} (${assignments.length} employees)`);
    } catch (error) {
      console.error('❌ Cache invalidateByRole error:', error);
    }
  }

  /**
   * Clear all permission caches
   */
  async clear() {
    try {
      await this.connect();
      const keys = await this.client.keys('permissions:*');
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
      console.log(`🗑️ Cleared ${keys.length} permission caches`);
    } catch (error) {
      console.error('❌ Cache clear error:', error);
    }
  }
}

// Export singleton
export default new PermissionCache();