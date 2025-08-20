import { createSlice } from "@reduxjs/toolkit";
import { v4 as uuidv4 } from "uuid";

const initialState = {
  drafts: [],
  employeeData: {},
  rolesData: {},
  currentDraft: {
    status: "Draft",
    draftId: null,
  },
};

const sliceDraft = createSlice({
  name: "draft",
  initialState,
  reducers: {
    addEmployeeData: (state, action) => {
      state.employeeData = action.payload;
    },

    addRolesData: (state, action) => {
      state.rolesData = {
        ...action.payload,
        employeeId: state.employeeData?.id || null, // link roles to employee
      };
    },

    addDraft: (state) => {
      const newDraft = {
        employee: state.employeeData,
        roles: state.rolesData,
        status: "Draft",
        draftId: uuidv4(),
      };

      state.drafts.push(newDraft);
      state.currentDraft = newDraft;
    },

    deleteDraft: (state, action) => {
      const draftId = action.payload.id;
      state.drafts = state.drafts.filter((draft) => draft.draftId !== draftId);

      if (state.currentDraft.draftId === draftId) {
        state.currentDraft = {
          roles: {},
          employee: {},
          status: "Draft",
          draftId: null,
        };

        state.employeeData = {};
        state.rolesData = {};
      }
    },
  },
});

export const { addEmployeeData, addRolesData, addDraft, deleteDraft } =
  sliceDraft.actions;
export default sliceDraft.reducer;