import mongoose from "mongoose";

const AllRolesSchema = new mongoose.Schema({
    role: { type: String, required: true, unique: true },
    description: { type: String },
});

const AllRolesModel = mongoose.model("AllRoles", AllRolesSchema);
export default AllRolesModel;
