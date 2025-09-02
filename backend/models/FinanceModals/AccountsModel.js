import mongoose from "mongooose";

const AccountsSchema = new mongoose.Schema({
    account_number: {
        type: Number,
        required: true,
    },
    account_name: {
        type: String,
        required: true,
    },
    account_type: {
        type: String,
        required: true,
    },
    parent_id: {
        type: Number,
        required: true,
    },
    is_group: {
        type: Boolean,
        required: true,
    },
});

const AccountsModel = mongoose.model("Accounts", AccountsSchema);
export default AccountsModel;