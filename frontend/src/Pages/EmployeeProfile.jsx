// src/pages/ProfilePage.jsx
import React, { useState, useEffect } from "react";
import {
  FiUser,
  FiCreditCard,
  FiBriefcase,
  FiCalendar,
  FiFileText,
} from "react-icons/fi";
import api from "../api/axios"; // <-- make sure this points to your axios instance

// Dummy Components (replace with real forms later)
const Allowance = () => <p>This is the <strong>Apply Allowance</strong> section.</p>;
const Leave = () => <p>This is the <strong>Apply Leave</strong> section.</p>;
const Retirement = () => <p>This is the <strong>Apply Retirement</strong> section.</p>;
const Loan = () => <p>This is the <strong>Apply Loan</strong> section.</p>;
const Training = () => <p>This is the <strong>Apply Training</strong> section.</p>;

const ProfilePage = () => {
  const [activeSection, setActiveSection] = useState("about"); // default section
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  // Fetch user profile from backend
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get("/auth/me"); // <-- calls your backend route
        if (res.data.success) {
          setProfile(res.data.employee);
        }
      } catch (err) {
        console.error("Error fetching profile", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleSectionChange = (section) => {
    setLoading(true);
    setTimeout(() => {
      setActiveSection(section);
      setLoading(false);
    }, 400); // short transition loader
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-gray-500">No profile data found.</p>
      </div>
    );
  }

  // Render section content
  const renderSection = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center py-6">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    switch (activeSection) {
      case "about":
        return (
          <div className="space-y-6">
            {/* Profile Details */}
            <div className="flex flex-col md:flex-row items-start gap-6 bg-white p-6 rounded-lg shadow">
              <div className="flex-1 space-y-2 text-gray-700">
                <h1 className="text-3xl font-bold">{profile.individualName}</h1>
                <p className="text-gray-600">{profile.personalEmail}</p>
                <p><strong>User ID:</strong> {profile.UserId}</p>
                <p><strong>Organization ID:</strong> {profile.OrganizationId}</p>
                <p><strong>Role:</strong> {profile.role?.roleName}</p>
                <p><strong>Father Name:</strong> {profile.fatherName}</p>
                <p><strong>Qualification:</strong> {profile.qualification}</p>
                <p><strong>DOB:</strong> {profile.dob ? new Date(profile.dob).toLocaleDateString() : "-"}</p>
                <p><strong>Government ID:</strong> {profile.govtId}</p>
                <p><strong>Contact:</strong> {profile.address?.contactNo}</p>
                <p><strong>Address:</strong> {`${profile.address?.city || ""}, ${profile.address?.state || ""}, ${profile.address?.country || ""}`}</p>
              </div>
              <div className="flex-shrink-0">
                <img
                  src={profile.avatar?.url || "https://via.placeholder.com/200"}
                  alt="Profile"
                  className="w-48 h-48 rounded-full object-cover border border-gray-300 shadow"
                />
              </div>
            </div>

            {/* Employment History */}
            <div className="bg-white p-6 rounded-lg shadow space-y-4">
              <h2 className="font-semibold text-lg">Employment History</h2>
              <p><strong>Organization Name:</strong> {profile.employmentHistory?.orgName}</p>
              <p><strong>Designation:</strong> {profile.employmentHistory?.designation}</p>
              <p>
                <strong>Release Date:</strong>{" "}
                {profile.employmentHistory?.releaseDate
                  ? new Date(profile.employmentHistory.releaseDate).toLocaleDateString()
                  : "-"}
              </p>
              <p><strong>Organizations Worked For:</strong> {profile.employmentHistory?.organizationsWorkedFor}</p>

              <h2 className="font-semibold text-lg mt-4">Employment Status</h2>
              <p>{profile.employmentStatus}</p>
            </div>
          </div>
        );
      case "allowance":
        return <Allowance />;
      case "leave":
        return <Leave />;
      case "retirement":
        return <Retirement />;
      case "loan":
        return <Loan />;
    case "training":
        return <Training />
      default:
        return <p>Select a section</p>;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-72 bg-gray-900 shadow-md p-6 space-y-4 text-white">
        <h2 className="text-xl font-bold mb-4">My Profile</h2>
        <nav className="space-y-2">
          <button
            onClick={() => handleSectionChange("about")}
            className={`flex items-center gap-2 w-full px-4 py-2 rounded-lg text-left font-medium transition-colors ${
              activeSection === "about" ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-800"
            }`}
          >
            <FiUser /> About Me
          </button>
          <button
            onClick={() => handleSectionChange("allowance")}
            className={`flex items-center gap-2 w-full px-4 py-2 rounded-lg text-left font-medium transition-colors ${
              activeSection === "allowance" ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-800"
            }`}
          >
            <FiCreditCard /> Apply Allowance
          </button>
          <button
            onClick={() => handleSectionChange("leave")}
            className={`flex items-center gap-2 w-full px-4 py-2 rounded-lg text-left font-medium transition-colors ${
              activeSection === "leave" ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-800"
            }`}
          >
            <FiBriefcase /> Apply Leave
          </button>
          <button
            onClick={() => handleSectionChange("retirement")}
            className={`flex items-center gap-2 w-full px-4 py-2 rounded-lg text-left font-medium transition-colors ${
              activeSection === "retirement" ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-800"
            }`}
          >
            <FiCalendar /> Apply Retirement
          </button>
          <button
            onClick={() => handleSectionChange("loan")}
            className={`flex items-center gap-2 w-full px-4 py-2 rounded-lg text-left font-medium transition-colors ${
              activeSection === "loan" ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-800"
            }`}
          >
            <FiFileText /> Apply Loan
          </button>

          <button 
            className={`flex items-center gap-2 w-full px-4 py-2 rounded-lg text-left font-medium transition-colors ${
              activeSection === "training" ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-800"
            }`
          }
            onClick={() => handleSectionChange("training")}
          >
            <FiFileText /> Apply Training
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        <div className="bg-white p-6 rounded-lg shadow">{renderSection()}</div>
      </div>
    </div>
  );
};

export default ProfilePage;
