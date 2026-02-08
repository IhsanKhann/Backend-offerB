// DIAGNOSTIC: Test Permission Aggregation

// Test data based on your actual database
const userDepartmentCode = "All";  // Chairman
const permissionObject = {
  _id: "68b2b14bc7ef6031d015c140",
  name: "view_single_employee",
  action: "view_single_employee",
  statusScope: ["HR"],  // ❌ Problem?
  hierarchyScope: "DESCENDANT",
  resourceType: "EMPLOYEE"
};

console.log("=".repeat(60));
console.log("PERMISSION FILTER TEST");
console.log("=".repeat(60));

console.log("\n📋 INPUT:");
console.log("User Department:", userDepartmentCode);
console.log("Permission:", permissionObject.name);
console.log("Permission statusScope:", permissionObject.statusScope);

// Test the filter logic
function testFilter(permissions, userDeptCode) {
  if (!userDeptCode) return [];

  // Executive users (departmentCode: "All") get ALL permissions
  if (userDeptCode === 'All') {
    console.log("\n✅ BRANCH 1: Executive bypass (dept: 'All')");
    console.log("   Result: ALLOW ALL PERMISSIONS");
    return permissions;
  }

  // Filter permissions
  return permissions.filter(perm => {
    if (!perm.statusScope || perm.statusScope.length === 0) {
      return true;
    }

    return perm.statusScope.includes('ALL') || 
           perm.statusScope.includes(userDeptCode);
  });
}

const result = testFilter([permissionObject], userDepartmentCode);

console.log("\n🎯 RESULT:");
console.log("Filtered permissions count:", result.length);
console.log("Permission passed filter:", result.length > 0 ? "YES ✅" : "NO ❌");

if (result.length > 0) {
  console.log("Permitted:", result[0].name);
}

console.log("\n" + "=".repeat(60));
console.log("CONCLUSION:");
console.log("=".repeat(60));

if (userDepartmentCode === "All") {
  console.log("✅ Chairman should have ALL permissions regardless of statusScope");
  console.log("✅ The filter logic SHOULD work correctly");
  console.log("\n⚠️  IF STILL FAILING, CHECK:");
  console.log("   1. Is the permission object being populated correctly?");
  console.log("   2. Is the user's departmentCode actually 'All' in the DB?");
  console.log("   3. Check console logs in authorize() middleware");
}