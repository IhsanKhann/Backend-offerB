import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  roles: {
    employeeId: null,
    data: {},
  },
};

const rolesDraftSlice = createSlice({
  name: "rolesDraft",
  initialState,
  reducers: {
    assignRolesDraft: (state, action) => {
      state.roles = {
        employeeId: action.payload.employeeId,
        data: action.payload.role, // ✅ match your form payload
      };
    },
    clearRolesDraft: (state) => {
      state.roles = { employeeId: null, data: {} };
    },
  },
});

export const { assignRolesDraft, clearRolesDraft } = rolesDraftSlice.actions;

export default rolesDraftSlice.reducer;
