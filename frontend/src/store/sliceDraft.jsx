
import { createSlice } from "@reduxjs/toolkit";
import { v4 as uuidv4 } from "uuid";

const initialState = {
  drafts: [],
  employeeData: {},
  rolesData: {},
  currentDraft: null,
  editingDraft: null,
  currentDraftId: null,
};

const sliceDraft = createSlice({
  name: "draft",
  initialState,
  reducers: {
    addEmployeeData: (state, action) => {
      console.log("Adding employee data:", action.payload);
      state.employeeData = action.payload;
    },

    addRolesData: (state, action) => {
      console.log("Adding roles data:", action.payload);
      state.rolesData = {
        ...action.payload,
        employeeId: state.employeeData?.employeeId || action.payload.employeeId,
      };
    },

    addDraft: (state) => {
      const newDraftId = uuidv4();
      const newDraft = {
        employee: state.employeeData,
        roles: state.rolesData,
        status: "Draft",
        draftId: newDraftId,
        createdAt: new Date().toISOString(),
      };

      console.log("Creating new draft:", newDraft);
      state.drafts.push(newDraft);
      state.currentDraft = newDraft;
      state.currentDraftId = newDraftId;
    },

    deleteDraft: (state, action) => {
      const draftId = action.payload.id;
      console.log("Deleting draft:", draftId);
      
      state.drafts = state.drafts.filter((draft) => draft.draftId !== draftId);

      if (state.currentDraftId === draftId) {
        state.currentDraft = null;
        state.currentDraftId = null;
        state.employeeData = {};
        state.rolesData = {};
      }

      if (state.editingDraft?.draftId === draftId) {
        state.editingDraft = null;
      }
    },

    // to study.
    startEditDraft: (state, action) => {
      const draftId = action.payload.id;
      const draft = state.drafts.find(d => d.draftId === draftId);
      
      // if draft found..
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
      state.employeeData = {};
      state.rolesData = {};
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
      state.employeeData = {};
      state.rolesData = {};
      state.currentDraft = null;
      state.currentDraftId = null;
    },

    displayDrafts : (state) => {
        console.log(state.drafts) ;
    }
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
} = sliceDraft.actions;

export default sliceDraft.reducer;

