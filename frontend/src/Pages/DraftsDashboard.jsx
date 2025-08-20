// DraftDashboard.jsx
import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { deleteDraft } from "../store/sliceDraft.jsx";

const DraftDashboard = () => {
  const drafts = useSelector((state) => state.Draft.drafts);
  const dispatch = useDispatch();

  const handleCancel = (draftId) => {
    dispatch(deleteDraft({ Id: draftId }));
  };

  const handleEdit = (draft) => {
    // Placeholder for Edit Draft logic
    console.log("Edit Draft clicked for:", draft.draftId);
  };

  const handleSubmit = (draft) => {
    // Placeholder for Submit Draft logic
    console.log("Submit Draft clicked for:", draft.draftId);
  };

  if (drafts.length === 0)
    return (
      <h2 className="text-center text-gray-500 mt-10 text-xl font-medium">
        No drafts available.
      </h2>
    );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h2 className="text-3xl font-bold mb-6 text-gray-800">Drafts Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {drafts.map((draft) => (
          <div
            key={draft.draftId}
            className="bg-white shadow-lg rounded-lg p-6 hover:shadow-xl transition duration-300 relative"
          >
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-700">Draft ID:</h3>
              <p className="text-sm text-gray-500 break-words">{draft.draftId}</p>
            </div>

            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-700">Employee Data:</h3>
              <pre className="text-sm text-gray-600 max-h-32 overflow-y-auto bg-gray-50 p-2 rounded">
                {JSON.stringify(draft.employeeData, null, 2)}
              </pre>
            </div>

            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-700">Roles Data:</h3>
              <pre className="text-sm text-gray-600 max-h-32 overflow-y-auto bg-gray-50 p-2 rounded">
                {JSON.stringify(draft.rolesData, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end space-x-2 mt-4">
              <button
                onClick={() => handleEdit(draft)}
                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition"
              >
                Edit
              </button>
              <button
                onClick={() => handleSubmit(draft)}
                className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition"
              >
                Submit
              </button>
              <button
                onClick={() => handleCancel(draft.draftId)}
                className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DraftDashboard;
