const ProfileModal = ({ emp, onClose, setStatus }) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-[700px] max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Employee Profile</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Profile Info */}
        <div className="px-8 py-6 flex items-center space-x-6">
          {emp.avatar ? (
            <img
              src={emp.avatar?.url || "https://via.placeholder.com/150"}
              alt="Employee Avatar"
              className="w-20 h-20 rounded-full object-cover shadow"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gray-300 flex items-center justify-center text-gray-500">
              N/A
            </div>
          )}
          <div>
            <p className="text-xl font-semibold text-gray-900">
              {emp.individualName}
            </p>
            <p className="text-sm text-gray-600">{emp.officialEmail}</p>
            <p className="text-xs text-gray-400">ID: {emp.employeeId}</p>
          </div>
        </div>

        {/* Sections */}
        <div className="px-8 py-6 space-y-6">

          {/* Personal Info */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-1">
              Personal Information
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-500">Phone Number</p>
                <p className="text-base text-gray-900">{emp.phoneNumber || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Address</p>
                <p className="text-base text-gray-900">{emp.address || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Date of Birth</p>
                <p className="text-base text-gray-900">{emp.dateOfBirth || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">CNIC</p>
                <p className="text-base text-gray-900">{emp.cnic || "-"}</p>
              </div>
            </div>
          </div>

          {/* Official Info */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-1">
              Official Information
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-500">Department</p>
                <p className="text-base text-gray-900">{emp.department || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Designation</p>
                <p className="text-base text-gray-900">{emp.designation || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Joining Date</p>
                <p className="text-base text-gray-900">{emp.joiningDate || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Salary</p>
                <p className="text-base text-gray-900">{emp.salary || "-"}</p>
              </div>
            </div>
          </div>

          {/* Account Info */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-1">
              Account Information
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-500">Username</p>
                <p className="text-base text-gray-900">{emp.username || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Password</p>
                <p className="text-base text-gray-900">
                  {emp.password ? "••••••••" : "-"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end items-center gap-3 px-8 py-4 border-t">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition"
          >
            Close
          </button>
          <button className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow transition">
            Edit Profile
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;