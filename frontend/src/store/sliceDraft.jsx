import { createSlice } from "@reduxjs/toolkit";
import { v4 as uuidv4 } from "uuid";

const initialState = {
  drafts: [],
  employeeData: null,   // use null, not {}
  rolesData: null,
  currentDraft: null,
  editingDraft: null,
  currentDraftId: null,
};

const sliceDraft = createSlice({
  name: "draft",
  initialState,
  reducers: {
    addEmployeeData: (state, action) => {
      state.employeeData = action.payload?.employeeData || action.payload || null;
      console.log("Employee data added:", state.employeeData);
    },

    addRolesData: (state, action) => {
      state.rolesData = {
        ...(action.payload?.rolesData || action.payload || {}),
        employeeId: state.employeeData?.employeeId || action.payload?.employeeId || null,
      };
      console.log("Roles data added:", state.rolesData);
    },

    addDraft: (state, action) => {
        const newDraftId = uuidv4();

        const employee = action.payload?.employeeData || state.employeeData || null;
        const roles = action.payload?.rolesData || state.rolesData || null;

        if (!employee) {
          console.warn("Cannot create draft: no employee data");
          return;
        }

        const newDraft = {
          employee,
          roles,
          status: "Draft",
          draftId: newDraftId,
          createdAt: new Date().toISOString(),
        };

        // 🔎 Duplicate check using key fields
        const duplicate = state.drafts.find((draft) => {
          const emp = draft.employee;

          return (
            emp?._id === newDraft.employee?._id || // exact same employee in DB
            (
              emp?.individualName === newDraft.employee?.individualName &&
              emp?.fatherName === newDraft.employee?.fatherName &&
              emp?.dob === newDraft.employee?.dob
            ) || // same personal identity
            emp?.officialEmail === newDraft.employee?.officialEmail || // duplicate email
            emp?.personalEmail === newDraft.employee?.personalEmail ||
            emp?.govtId === newDraft.employee?.govtId ||
            emp?.passportNo === newDraft.employee?.passportNo ||
            emp?.alienRegNo === newDraft.employee?.alienRegNo
          );
        });

        if (duplicate) {
          console.warn("Duplicate draft detected. Skipping add.");
          state.error = "Duplicate draft not allowed.";
          alert("duplicate draft not allowed. Already exists");
          return;
        }

        state.drafts.push(newDraft);
        state.currentDraft = newDraft;
        state.currentDraftId = newDraftId;
        state.error = null;
        console.log("Draft created:", newDraft);
    },

    deleteDraft: (state, action) => {
      const draftId = action.payload.id;
      state.drafts = state.drafts.filter(d => d.draftId !== draftId);

      if (state.currentDraftId === draftId) {
        state.currentDraft = null;
        state.currentDraftId = null;
        state.employeeData = null;
        state.rolesData = null;
      }

      if (state.editingDraft?.draftId === draftId) {
        state.editingDraft = null;
      }
    },

    startEditDraft: (state, action) => {
      const draftId = action.payload.id;
      const draft = state.drafts.find(d => d.draftId === draftId);

      if (draft) {
        state.editingDraft = { ...draft };
        state.employeeData = draft.employee;
        state.rolesData = draft.roles;
        state.currentDraftId = draftId;
      }
    },

    updateDraft: (state, action) => {
      const { draftId, employee, roles } = action.payload;
      const draftIndex = state.drafts.findIndex(d => d.draftId === draftId);

      if (draftIndex !== -1) {
        state.drafts[draftIndex] = {
          ...state.drafts[draftIndex],
          employee: employee || state.drafts[draftIndex].employee,
          roles: roles || state.drafts[draftIndex].roles,
          updatedAt: new Date().toISOString(),
        };
        state.editingDraft = null;
      }
    },

    cancelEdit: (state) => {
      state.editingDraft = null;
      state.employeeData = null;
      state.rolesData = null;
      state.currentDraftId = null;
    },

    submitDraft: (state, action) => {
      const draftId = action.payload.id;
      const draftIndex = state.drafts.findIndex(d => d.draftId === draftId);

      if (draftIndex !== -1) {
        state.drafts[draftIndex].status = "Submitted";
        state.drafts[draftIndex].submittedAt = new Date().toISOString();
      }
    },

    clearCurrentDraft: (state) => {
      state.employeeData = null;
      state.rolesData = null;
      state.currentDraft = null;
      state.currentDraftId = null;
    },

    displayDrafts: (state) => {
      console.log("All drafts:", state.drafts);
    },
  },
});

export const {
  addEmployeeData,
  addRolesData,
  addDraft,
  deleteDraft,
  startEditDraft,
  updateDraft,
  cancelEdit,
  submitDraft,
  clearCurrentDraft,
  displayDrafts,
} = sliceDraft.actions;

export default sliceDraft.reducer;
