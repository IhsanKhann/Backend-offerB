import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

export const registerEmployeeThunk = createAsyncThunk(
  "employee/register",
  async (formData, { rejectWithValue }) => {
    try {
      if (!formData) return rejectWithValue("No form data provided");

      const response = await axios.post(
        "http://localhost:3000/api/employees/register",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);



const employeeSlice = createSlice({
  name: "employee",
  initialState: {
    formData: null, // store employee form data
    employeeId: null, // store _id returned from backend
    loading: false,
    error: null,
  },
  reducers: {
    setEmployeeFormData: (state, action) => {
      state.formData = action.payload; // save form data
    },
    clearEmployee: (state) => {
      state.formData = null;
      state.employeeId = null;
      state.error = null;
      state.loading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(registerEmployeeThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerEmployeeThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.employeeId = action.payload.employeeId; // store backend id
      })
      .addCase(registerEmployeeThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

// ✅ Actions
export const { setEmployeeFormData, clearEmployee } = employeeSlice.actions;

// ✅ Selectors (instead of reducers)
export const getEmployeeFormData = (state) => state.employee.formData;
export const getEmployeeId = (state) => state.employee.employeeId;

export default employeeSlice.reducer;
