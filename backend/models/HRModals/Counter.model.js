import mongoose from "mongoose";

const CounterSchema = new mongoose.Schema(
  {
    _id: { type: String },
    seq: { type: Number, default: 0 },
  },
  {
    // Disable the default _id ObjectId so our String _id is used as-is
    _id: false,
    versionKey: false,
  }
);

const Counter =
  mongoose.models.Counter || mongoose.model("Counter", CounterSchema);

// ---------------------------------------------------------------------------
export async function getNextSequence(key, session = null) {
 
  if (!key || typeof key !== "string" || !key.trim()) {
    throw new Error(
      `[Counter] getNextSequence received an invalid key: ${JSON.stringify(key)}. ` +
      `Key must be a non-empty string. ` +
      `Check that the caller's split/rule object is fully resolved before calling getNextSequence.`
    );
  }

  const normalizedKey = key.trim().toLowerCase();

  const options = {
    new: true,    // return the document AFTER the increment
    upsert: true, // create atomically if it doesn't exist — no race condition
  };

  if (session) options.session = session;

  const result = await Counter.findOneAndUpdate(
    { _id: normalizedKey },
    { $inc: { seq: 1 } },
    options
  );

  return result.seq;
}

export default Counter;