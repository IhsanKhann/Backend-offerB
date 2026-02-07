import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { OrgUnitModel } from '../models/HRModals/OrgUnit.js';
import RoleAssignmentModel from '../models/HRModals/RoleAssignment.model.js';

dotenv.config();

/**
 * ==========================================
 * ORG HIERARCHY VERIFICATION SCRIPT (RUN ONCE)
 * ==========================================
 * ❌ Fails HARD if any structural issue exists
 * ✅ Safe: read-only
 */

class OrgHierarchyVerifier {
  constructor() {
    this.errors = [];
  }

  async run() {
    try {
      console.log('\n========================================');
      console.log('🔍 ORG HIERARCHY VERIFICATION STARTED');
      console.log('========================================\n');

      await mongoose.connect(process.env.MONGODB_URI);
      console.log('✅ Connected to MongoDB\n');

      await this.verifyRoot();
      await this.verifyNoOrphans();
      await this.verifyLevels();
      await this.verifyPaths();
      await this.verifyDepartments();
      await this.verifyBranchConsistency();
      await this.verifyDescendants();
      await this.printHierarchy();

      this.finalize();

    } catch (err) {
      console.error('\n❌ VERIFICATION CRASHED:', err);
      process.exit(1);
    }
  }

  fail(message) {
    this.errors.push(message);
    console.error('❌', message);
  }

  /**
   * ===============================
   * ROOT CHECK
   * ===============================
   */
  async verifyRoot() {
    const roots = await OrgUnitModel.find({ parent: null });

    if (roots.length !== 1) {
      this.fail(`Expected exactly 1 root orgUnit, found ${roots.length}`);
      return;
    }

    const root = roots[0];

    if (root.name !== 'CHAIRMAN' || root.level !== 0) {
      this.fail('Root orgUnit must be CHAIRMAN at level 0');
    }

    console.log('✅ Root verified (CHAIRMAN)');
  }

  /**
   * ===============================
   * ORPHAN CHECK
   * ===============================
   */
  async verifyNoOrphans() {
    const orphans = await OrgUnitModel.aggregate([
      { $match: { parent: { $ne: null } } },
      {
        $lookup: {
          from: 'orgunits',
          localField: 'parent',
          foreignField: '_id',
          as: 'parentUnit'
        }
      },
      { $match: { parentUnit: { $size: 0 } } }
    ]);

    if (orphans.length > 0) {
      orphans.forEach(o =>
        this.fail(`Orphan orgUnit detected: ${o.name}`)
      );
    } else {
      console.log('✅ No orphan orgUnits');
    }
  }

  /**
   * ===============================
   * LEVEL CHECK
   * ===============================
   */
  async verifyLevels() {
    const invalidLevels = await OrgUnitModel.aggregate([
      {
        $lookup: {
          from: 'orgunits',
          localField: 'parent',
          foreignField: '_id',
          as: 'parent'
        }
      },
      { $unwind: { path: '$parent', preserveNullAndEmptyArrays: true } },
      {
        $match: {
          parent: { $ne: null },
          $expr: { $ne: ['$level', { $add: ['$parent.level', 1] }] }
        }
      }
    ]);

    if (invalidLevels.length > 0) {
      invalidLevels.forEach(u =>
        this.fail(`Level mismatch: ${u.name}`)
      );
    } else {
      console.log('✅ All levels valid');
    }
  }

  /**
   * ===============================
   * PATH CHECKS
   * ===============================
   */
  async verifyPaths() {
    const invalidRootPath = await OrgUnitModel.find({
      path: { $not: /^CHAIRMAN/ }
    });

    if (invalidRootPath.length > 0) {
      invalidRootPath.forEach(u =>
        this.fail(`Invalid root path: ${u.name}`)
      );
    } else {
      console.log('✅ All paths start from CHAIRMAN');
    }

    const brokenPath = await OrgUnitModel.aggregate([
      {
        $lookup: {
          from: 'orgunits',
          localField: 'parent',
          foreignField: '_id',
          as: 'parent'
        }
      },
      { $unwind: { path: '$parent', preserveNullAndEmptyArrays: true } },
      {
        $match: {
          parent: { $ne: null },
          $expr: {
            $not: {
              $regexMatch: {
                input: '$path',
                regex: '$parent.name'
              }
            }
          }
        }
      }
    ]);

    if (brokenPath.length > 0) {
      brokenPath.forEach(u =>
        this.fail(`Path missing parent: ${u.name}`)
      );
    } else {
      console.log('✅ Path inheritance valid');
    }
  }

  /**
   * ===============================
   * DEPARTMENT GROUPING
   * ===============================
   */
  async verifyDepartments() {
    const hrRoots = await OrgUnitModel.find({
      departmentCode: 'HR',
      level: { $lt: 4 }
    });

    if (hrRoots.length > 1) {
      this.fail('Multiple HR roots detected');
    } else {
      console.log('✅ Department grouping valid');
    }
  }

  /**
   * ===============================
   * BRANCH CONSISTENCY
   * ===============================
   */
  async verifyBranchConsistency() {
    const branches = await OrgUnitModel.distinct('branchId');

    if (branches.length !== 1) {
      this.fail(`Multiple branchIds found (${branches.length})`);
    } else {
      console.log('✅ Branch consistency verified');
    }
  }

  /**
   * ===============================
   * DESCENDANT TRAVERSAL
   * ===============================
   */
  async verifyDescendants() {
    const chairman = await OrgUnitModel.findOne({ name: 'CHAIRMAN' });
    const total = await OrgUnitModel.countDocuments();
    const descendants = await chairman.getDescendants();

    if (descendants.length !== total - 1) {
      this.fail(
        `Descendant mismatch: expected ${total - 1}, got ${descendants.length}`
      );
    } else {
      console.log('✅ Descendant traversal valid');
    }
  }

  /**
   * ===============================
   * TREE PRINT
   * ===============================
   */
  async printHierarchy() {
    console.log('\n🌳 ORG HIERARCHY TREE\n');
    const root = await OrgUnitModel.findOne({ parent: null });
    await this.printNode(root, 0);
    console.log('');
  }

  async printNode(node, indent) {
    const prefix = '  '.repeat(indent);
    const count = await RoleAssignmentModel.countDocuments({
      orgUnit: node._id,
      isActive: true
    });

    console.log(
      `${prefix}├─ [L${node.level}] ${node.name} (${node.departmentCode}) [${count} employees]`
    );

    const children = await OrgUnitModel.find({ parent: node._id }).sort({ name: 1 });
    for (const child of children) {
      await this.printNode(child, indent + 1);
    }
  }

  /**
   * ===============================
   * FINAL RESULT
   * ===============================
   */
  finalize() {
    if (this.errors.length > 0) {
      console.error('\n========================================');
      console.error('❌ ORG HIERARCHY VERIFICATION FAILED');
      console.error(`❌ Total Errors: ${this.errors.length}`);
      console.error('========================================\n');
      process.exit(1);
    }

    console.log('\n========================================');
    console.log('✅ ORG HIERARCHY VERIFIED — SAFE TO USE');
    console.log('========================================\n');
    process.exit(0);
  }
}

/**
 * RUN
 */
new OrgHierarchyVerifier().run();
