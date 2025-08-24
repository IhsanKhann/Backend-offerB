import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";

// submit and creating draft logic....
import { useDispatch, useSelector } from "react-redux";
import { setEmployeeFormData, getEmployeeFormData, registerEmployeeThunk } from "../store/sliceEmployee.jsx";
import { addEmployeeData } from "../store/sliceDraft.jsx";

export default function EmployeeRegistrationForm() {
  const [step, setStep] = useState(1);
  
  const totalSteps = 9;
  const navigate = useNavigate();
  
  const { register, handleSubmit } = useForm({
    shouldUnregister: false, // ✅ keeps values across steps
  });
  const [avatar, setAvatar] = useState(null);
  const [UserId, setUserId] = useState("");
  // const [attachmentSalary, setAttachmentSalary] = useState("");

  const dispatch = useDispatch();

  const stepTitles = [
    "",
    "Employee Personal Details",
    "Address Information",
    "Profile & Employment History",
    "Employment Status",
    "Salary & Benefits",
    "Tenure",
    "Change of Status",
    "Transfers",
    "Final Submission",
  ];

  const nextStep = () => step < totalSteps && setStep(step + 1);
  const prevStep = () => step > 1 && setStep(step - 1);
  
const currentFormData = useSelector(getEmployeeFormData);

const OnSubmit = async (data) => {
  console.log("🚀 Raw form data:", data);

  const employeeFormData = new FormData();

  // Core fields
  employeeFormData.append("UserId", UserId || "");
  employeeFormData.append("individualName", data.individualName);
  employeeFormData.append("fatherName", data.fatherName);
  employeeFormData.append("qualification", data.qualification || "");
  employeeFormData.append("dob", data.dob);
  employeeFormData.append("govtId", data.govtId || "");
  employeeFormData.append("passportNo", data.passportNo || "");
  employeeFormData.append("alienRegNo", data.alienRegNo || "");
  employeeFormData.append("officialEmail", data.officialEmail);
  employeeFormData.append("personalEmail", data.personalEmail);
  employeeFormData.append("previousOrgEmail", data.previousOrgEmail || "");
  employeeFormData.append("employmentStatus", data.employmentStatus);
  // employeeFormData.append("role", data.role);

  // Nested objects (must be stringified for backend JSON.parse)
  if (data.address) {
    employeeFormData.append("address", JSON.stringify(data.address));
  }
  if (data.salary) {
    employeeFormData.append("salary", JSON.stringify(data.salary));
  }
  if (data.tenure) {
    employeeFormData.append("tenure", JSON.stringify(data.tenure));
  }
  if (data.transfers) {
    employeeFormData.append("transfers", JSON.stringify(data.transfers));
  }
  if (data.changeOfStatus) {
    employeeFormData.append("changeOfStatus", JSON.stringify(data.changeOfStatus));
  }
  if (data.employmentHistory) {
    employeeFormData.append("employmentHistory", JSON.stringify(data.employmentHistory));
  }

  // Files
  if (avatar) {
    console.log("📂 Attaching profile image:", avatar.name);
    employeeFormData.append("profileImage", avatar);
  }

  // Debug: log all FormData keys
  for (let [key, val] of employeeFormData.entries()) {
    console.log(`➡️ FormData ${key}:`, val);
  }

  // Save minimal data in Redux (no File object, just metadata)
  dispatch(
    setEmployeeFormData({
      ...data,
      employeeId: data.UserId || UserId,
      avatar: avatar ? { name: avatar.name, type: avatar.type, size: avatar.size } : null,
    })
  );

  try {
    const resultAction = await dispatch(registerEmployeeThunk(employeeFormData));
    console.log("✅ Result from thunk:", resultAction);

    if (registerEmployeeThunk.fulfilled.match(resultAction)) {
      const newId = resultAction.payload.employeeId;
      alert("Employee registered successfully! ID: " + newId);
      // database id..employeeId (employee db id.)
      const employeeId = newId;
      navigate(`/assign-roles/${employeeId}`);
    } else {
      console.warn("❌ Registration failed:", resultAction.payload);
      alert("Failed to register employee: " + (resultAction.payload || "Unknown error"));
    }
  } catch (error) {
    console.error("🔥 Registration error:", error);
    alert("Failed to register employee: " + error.message);
  }
};

const handleAutomatic_ID_Generation = () => {
  const id = Math.random().toString(36).substring(2, 8).toUpperCase();
  setUserId(id);
}

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="bg-white shadow-xl rounded-2xl w-full max-w-4xl p-8">
        <h1 className="text-3xl font-bold text-gray-800 text-center mb-2">
          Employee Registration Form
        </h1>
        <div className="mb-6 text-center">
          <div className="text-gray-800 font-semibold">{stepTitles[step]}</div>
          <span className="text-gray-600 font-medium">
            Step {step} of {totalSteps}
          </span>
        </div>

        <form onSubmit={handleSubmit(OnSubmit)} encType="multipart/form-data">
          {/* STEP 1 */}
          {step === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Individual Name *</label>
                <input placeholder="Enter full name" className="input" {...register("individualName", { required: true })} />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Father's Name *</label>
                <input placeholder="Enter father's name" className="input" {...register("fatherName", { required: true })} />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Qualification</label>
                <input placeholder="Enter qualifications" className="input" {...register("qualification")} />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Date of Birth *</label>
                <input type="date" className="input" {...register("dob", { required: true })} />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Government ID</label>
                <input placeholder="Social Security No / CNIC / Govt. ID" className="input" {...register("govtId")} />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Passport No.</label>
                <input placeholder="Enter passport number" className="input" {...register("passportNo")} />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Alien Registration No.</label>
                <input placeholder="Green Card / Alien Registration No." className="input" {...register("alienRegNo")} />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Official Email *</label>
                <input placeholder="Enter official email" type="email" className="input" {...register("officialEmail", { required: true })} />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Personal Email *</label>
                <input placeholder="Enter personal email" type="email" className="input" {...register("personalEmail", { required: true })} />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="block text-sm font-medium text-gray-700">Previous Organization Email</label>
                <input placeholder="Enter previous organization email" type="email" className="input" {...register("previousOrgEmail")} />
              </div>
              
              {/* File/Image Input */}
              <div className="col-span-2 space-y-1">
                <label className="block text-sm font-medium text-gray-700">Profile Image</label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                  <div className="space-y-1 text-center">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 48 48"
                      aria-hidden="true"
                    >
                      <path
                        d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div className="flex text-sm text-gray-600">
                      <label
                        htmlFor="file-upload"
                        className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none"
                      >
                        <span>Upload a file</span>
                        <input
                          id="file-upload"
                          name="profileImage"
                          type="file"
                          accept="image/*,application/pdf"
                          className="sr-only"
                          onChange={(e) => setAvatar(e.target.files[0])}
                        />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500">
                      PNG, JPG, PDF up to 10MB
                    </p>
                  </div>
                </div>
              </div>
              
              <p className="text-xs text-gray-500 col-span-2">
                * At least one of Govt ID / Passport No / Alien Registration No must be provided.
              </p>
            </div> 
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Suit/Flat/House No.</label>
                <input placeholder="Enter house number" className="input" {...register("address.houseNo")} />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Address Line</label>
                <input placeholder="Enter address line" className="input" {...register("address.addressLine")} />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Street No.</label>
                <input placeholder="Enter street number" className="input" {...register("address.streetNo")} />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Road</label>
                <input placeholder="Enter road name" className="input" {...register("address.road")} />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">City *</label>
                <input placeholder="Enter city" className="input" {...register("address.city", { required: true })} />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">State</label>
                <input placeholder="Enter state" className="input" {...register("address.state")} />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Country *</label>
                <input placeholder="Enter country" className="input" {...register("address.country", { required: true })} />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Contact No. (Cell #) *</label>
                <input placeholder="Enter contact number" className="input" {...register("address.contactNo", { required: true })} />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input placeholder="Enter email" type="email" className="input" {...register("address.email")} />
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">User ID (click to generate) </label>
                <input placeholder="Enter employee ID"
                value={UserId}
                onClick={handleAutomatic_ID_Generation} 
                readOnly
                className="input" 
                {...register("UserId")} 
                // randomly generate id and save it to the database. show that id.
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Organization Name</label>
                <input placeholder="Enter organization name" className="input" {...register("employmentHistory.orgName")} />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Date of Release</label>
                <input type="date" className="input" {...register("employmentHistory.releaseDate")} />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Previous Designation</label>
                <input placeholder="Enter designation" className="input" {...register("employmentHistory.designation")} />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="block text-sm font-medium text-gray-700">Organizations Worked For</label>
                <textarea placeholder="List previous organizations" className="input" {...register("employmentHistory.organizationsWorkedFor")} />
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Select Employment Status *</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {["Permanent", "Contract", "Intern", "Outsourced", "Probation"].map((opt) => (
                  <label key={opt} className="flex items-center space-x-3 bg-gray-50 p-4 rounded-lg hover:bg-gray-100">
                    <input 
                      type="radio" 
                      value={opt} 
                      className="h-5 w-5 text-blue-600" 
                      {...register("employmentStatus", { required: true })} 
                    />
                    <span className="text-gray-700">{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* STEP 5
          {step === 5 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Select Role *</h3>
              <div className="grid grid-cols-1 gap-3">
                {[
                  "Chairman",
                  "BoD Member",
                  "Company Secretary",
                  "Group Head / Division Head / Department Head",
                  "Branch Manager",
                  "Officer / Manager / Senior Manager",
                  "Cell Incharge",
                  "Executive (Contract / Permanent)",
                  "Senior Group Head",
                ].map((role) => (
                  <label key={role} className="flex items-center space-x-3 bg-gray-50 p-4 rounded-lg hover:bg-gray-100">
                    <input 
                      type="radio" 
                      value={role} 
                      className="h-5 w-5 text-blue-600" 
                      {...register("role", { required: true })} 
                    />
                    <span className="text-gray-700">{role}</span>
                  </label>
                ))}
              </div>
            </div>
          )} */}

          {/* STEP 5 */}
       {step === 5 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Start Date of Salary */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  Start Date of Salary *
                </label>
                <input
                  type="date"
                  className="input"
                  {...register("salary.startDate", { required: true })}
                />
              </div>

              {/* Salary Type */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  Salary Type *
                </label>
                <select
                  className="input"
                  {...register("salary.type", { required: true })}
                >
                  <option value="">Select salary type</option>
                  <option value="Initial">Initial</option>
                  <option value="Incremented">Incremented</option>
                  <option value="Special">Special</option>
                  <option value="Fixed">Fixed</option>
                  <option value="Internship">Internship</option>
                </select>
              </div>

              {/* Current Salary Amount */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  Current Salary Amount *
                </label>
                <input
                  placeholder="Enter amount"
                  type="number"
                  step="0.01"
                  className="input"
                  {...register("salary.amount", { required: true })}
                />
              </div>

              {/* No of Increments */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  No of Increments
                </label>
                <input
                  placeholder="Enter the no of increments"
                  type="number"
                  className="input w-[250px]"
                  {...register("salary.noOfIncrements")}
                />
              </div>

              {/* List of Terminal Benefits */}
              <div className="space-y-1 col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  List of Terminal Benefits
                </label>
                <textarea
                  placeholder="Enter terminal benefits"
                  className="input"
                  {...register("salary.terminalBenefits")}
                />
              </div>

              {/* Terminal Benefits Details */}
              <div className="space-y-1 col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Terminal Benefits Details
                </label>
                <textarea
                  placeholder="Enter details"
                  className="input"
                  {...register("salary.terminalBenefitDetails")}
                />
              </div>

              {/* Attach File
              <div className="space-y-1 col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Attach File
                </label>
                <input
                  type="file"
                  className="input"
                  {...register("salary.attachment")}
                />
                <p className="text-xs text-gray-500">
                  Supported formats: PDF, DOCX, JPG, PNG. Max size 10MB.
                </p>
              </div> */}

            </div>
          )}

          {/* STEP 6 */}
          {step === 6 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Date of Joining *</label>
                <input type="date" className="input" {...register("tenure.joining", { required: true })} />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Date of Confirmation</label>
                <input type="date" className="input" {...register("tenure.confirmation")} />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Date of Retirement</label>
                <input type="date" className="input" {...register("tenure.retirement")} />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Date of Contract Expiry/Renewal</label>
                <input type="date" className="input" {...register("tenure.contractExpiryOrRenewal")} />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Date of Promotion</label>
                <input type="date" className="input" {...register("tenure.promotion")} />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="block text-sm font-medium text-gray-700">Other Event Date</label>
                <input type="date" className="input" {...register("tenure.otherEventDate")} />
              </div>
            </div>
          )}

          {/* STEP 7 */}
          {step === 7 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Change of Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {["Suspended → Restored", "Retired → Re-employed", "Terminated → Re-employed", "Dismissed → Re-employed"].map((status) => (
                  <label key={status} className="flex items-center space-x-3 bg-gray-50 p-4 rounded-lg hover:bg-gray-100">
                    <input 
                      type="radio" 
                      value={status} 
                      className="h-5 w-5 text-blue-600" 
                      {...register("changeOfStatus.status")} 
                    />
                    <span className="text-gray-700">{status}</span>
                  </label>
                ))}
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Status Change Date</label>
                <input type="date" className="input" {...register("changeOfStatus.date")} />
              </div>
            </div>
          )}

          {/* STEP 8 */}
          {step === 8 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Department</label>
                <input placeholder="Enter department" className="input" {...register("transfers[0].department")} />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Division</label>
                <input placeholder="Enter division" className="input" {...register("transfers[0].division")} />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Group</label>
                <input placeholder="Enter group" className="input" {...register("transfers[0].group")} />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Branch</label>
                <input placeholder="Enter branch" className="input" {...register("transfers[0].branch")} />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">City</label>
                <input placeholder="Enter city" className="input" {...register("transfers[0].city")} />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Country</label>
                <input placeholder="Enter country" className="input" {...register("transfers[0].country")} />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="block text-sm font-medium text-gray-700">Immediate Boss Name</label>
                <input placeholder="Enter boss name" className="input" {...register("transfers[0].immediateBoss")} />
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-10 pt-6 border-t border-gray-200">
            {step > 1 && (
              <button
                type="button"
                onClick={prevStep}
                className="px-6 py-2 rounded-lg bg-gray-300 text-gray-800 hover:bg-gray-400 transition-colors"
              >
                Back
              </button>
            )}
            {step < totalSteps ? (
              <button
                type="button"
                onClick={nextStep}
                className="ml-auto px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                className="ml-auto px-6 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
              >
                Employee Designation Form 
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}