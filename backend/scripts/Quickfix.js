// scripts/categorize-permissions.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

/**
 * 🔄 PERMISSION CATEGORIZATION MIGRATION
 * 
 * Automatically categorizes permissions based on their action name:
 * - INFORMATIONAL: view_, get_, fetch_, list_, check_
 * - ADMINISTRATIVE: approve_, reject_, suspend_, terminate_, block_, delete_, restore_
 * - FUNCTIONAL: Everything else (create_, edit_, assign_, update_, process_)
 * 
 * USAGE: node scripts/categorize-permissions.js
 */

// Define Permission Schema inline (to avoid import issues)
const PermissionSchema = new mongoose.Schema({
  name: String,
  action: String,
  actionType: {
    type: String,
    enum: ["ADMINISTRATIVE", "FUNCTIONAL", "INFORMATIONAL"],
    default: "FUNCTIONAL"
  },
  metadata: {
    bypassHierarchy: { type: Boolean, default: false },
    requiresDoubleApproval: { type: Boolean, default: false },
    requiresAuditLog: { type: Boolean, default: false },
    sensitiveAction: { type: Boolean, default: false }
  },
  hierarchyScope: String,
  statusScope: [String],
  resourceType: String,
  category: String,
  description: String,
  isActive: Boolean,
  isSystem: Boolean
}, { timestamps: true });

const PermissionModel = mongoose.model("Permission", PermissionSchema);

const CATEGORIZATION_RULES = {
  INFORMATIONAL: [
    'view_', 'get_', 'fetch_', 'list_', 'check_', 'read_', 'show_',
    'display_', 'search_', 'find_', 'lookup_', 'View_', 'view'
  ],
  
  ADMINISTRATIVE: [
    'approve_', 'reject_', 'suspend_', 'terminate_', 'block_', 
    'restore_', 'delete_', 'remove_', 'cancel_', 'revoke_',
    'accept', 'reject', 'Delete_', 'restore', 'approve', 'suspend',
    'block', 'terminate'
  ],
  
  FUNCTIONAL: [
    'create_', 'edit_', 'update_', 'assign_', 'register_', 'submit_',
    'process_', 'generate_', 'calculate_', 'transfer_', 'apply',
    'add_', 'modify_', 'Add_', 'create', 'assign', 'transfer', 'take'
  ]
};

function categorizePermission(action) {
  if (!action) return 'FUNCTIONAL';
  
  const actionLower = action.toLowerCase();
  
  // Check INFORMATIONAL patterns first (most specific)
  for (const pattern of CATEGORIZATION_RULES.INFORMATIONAL) {
    if (actionLower.startsWith(pattern.toLowerCase()) || 
        actionLower.includes(pattern.toLowerCase())) {
      return 'INFORMATIONAL';
    }
  }
  
  // Check ADMINISTRATIVE patterns
  for (const pattern of CATEGORIZATION_RULES.ADMINISTRATIVE) {
    if (actionLower.startsWith(pattern.toLowerCase()) || 
        actionLower.includes(pattern.toLowerCase())) {
      return 'ADMINISTRATIVE';
    }
  }
  
  // Check FUNCTIONAL patterns
  for (const pattern of CATEGORIZATION_RULES.FUNCTIONAL) {
    if (actionLower.startsWith(pattern.toLowerCase()) || 
        actionLower.includes(pattern.toLowerCase())) {
      return 'FUNCTIONAL';
    }
  }
  
  // Default to FUNCTIONAL (safer than INFORMATIONAL)
  return 'FUNCTIONAL';
}

async function migratePermissions() {
  try {
    console.log('🔄 Starting Permission Categorization Migration...\n');
    
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI not found in environment variables');
      process.exit(1);
    }
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Get all permissions
    const permissions = await PermissionModel.find({});
    console.log(`📊 Found ${permissions.length} permissions to categorize\n`);
    
    const updates = {
      INFORMATIONAL: [],
      ADMINISTRATIVE: [],
      FUNCTIONAL: [],
      ALREADY_SET: [],
      ERRORS: []
    };
    
    for (const perm of permissions) {
      try {
        // Skip if already has a non-default actionType
        if (perm.actionType && 
            perm.actionType !== 'INFORMATIONAL' && 
            perm.metadata?.sensitiveAction !== undefined) {
          updates.ALREADY_SET.push(perm.action || perm.name);
          console.log(`⏭️  Skipping ${perm.action}: already categorized as ${perm.actionType}`);
          continue;
        }
        
        const newType = categorizePermission(perm.action || perm.name);
        
        // Update the permission
        await PermissionModel.updateOne(
          { _id: perm._id },
          { 
            $set: { 
              actionType: newType,
              'metadata.bypassHierarchy': false,
              'metadata.sensitiveAction': newType === 'ADMINISTRATIVE',
              'metadata.requiresAuditLog': newType === 'ADMINISTRATIVE'
            }
          }
        );
        
        updates[newType].push(perm.action || perm.name);
        console.log(`✅ ${perm.action}: ${newType}`);
        
      } catch (error) {
        updates.ERRORS.push({ action: perm.action, error: error.message });
        console.error(`❌ Error updating ${perm.action}:`, error.message);
      }
    }
    
    // Print detailed report
    console.log('\n' + '='.repeat(60));
    console.log('📈 MIGRATION REPORT');
    console.log('='.repeat(60) + '\n');
    
    console.log(`✅ INFORMATIONAL (${updates.INFORMATIONAL.length}):`);
    console.log('   Read-only actions that bypass hierarchy checks\n');
    updates.INFORMATIONAL.forEach(a => console.log(`   ✓ ${a}`));
    
    console.log(`\n🔐 ADMINISTRATIVE (${updates.ADMINISTRATIVE.length}):`);
    console.log('   Actions requiring full hierarchy validation\n');
    updates.ADMINISTRATIVE.forEach(a => console.log(`   ✓ ${a}`));
    
    console.log(`\n⚙️  FUNCTIONAL (${updates.FUNCTIONAL.length}):`);
    console.log('   Actions requiring department match only\n');
    updates.FUNCTIONAL.forEach(a => console.log(`   ✓ ${a}`));
    
    if (updates.ALREADY_SET.length > 0) {
      console.log(`\n⏭️  ALREADY SET (${updates.ALREADY_SET.length}):`);
      updates.ALREADY_SET.forEach(a => console.log(`   - ${a}`));
    }
    
    if (updates.ERRORS.length > 0) {
      console.log(`\n❌ ERRORS (${updates.ERRORS.length}):`);
      updates.ERRORS.forEach(e => console.log(`   ✗ ${e.action}: ${e.error}`));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Migration complete!');
    console.log(`   Total Processed: ${permissions.length}`);
    console.log(`   Successfully Updated: ${updates.INFORMATIONAL.length + updates.ADMINISTRATIVE.length + updates.FUNCTIONAL.length}`);
    console.log(`   Already Set: ${updates.ALREADY_SET.length}`);
    console.log(`   Errors: ${updates.ERRORS.length}`);
    console.log('='.repeat(60) + '\n');
    
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB\n');
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run migration
migratePermissions();