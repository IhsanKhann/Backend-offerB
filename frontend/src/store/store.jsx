import { configureStore } from "@reduxjs/toolkit";

import DraftReducer from "./sliceDraft.jsx";
import EmployeeReducer from "./sliceEmployee.jsx";
import RolesReducer from "./sliceRoles.jsx";

export const store = configureStore({
  reducer: {
    employee: EmployeeReducer,
    draft: DraftReducer,
    rolesDraft: RolesReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types or paths where you store FormData
        ignoredActions: ["employee/setEmployeeFormData", "draft/addDraft"],
        ignoredPaths: ["employee.formData", "draft.formData"],
      },
    }),
});

export default store;
