import mongoose from "mongoose";
import BreakupRule from "../../models/FinanceModals/BreakupRules.js";

// ---------------- Breakup Rules (existing) ----------------
export const getBreakupRules = async (req, res) => {
  try {
    const rules = await BreakupRule.find();
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getBreakupRuleById = async (req, res) => {
  try {
    const rule = await BreakupRule.findById(req.params.id);
    if (!rule) return res.status(404).json({ error: "Rule not found" });
    res.json(rule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createBusinessBreakupRule = async (req, res) => {
  try {
    const newRule = new BreakupRule(req.body);
    await newRule.save();
    res.status(201).json(newRule);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const updateBreakupRule = async (req, res) => {
  try {
    const updated = await BreakupRule.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: "Rule not found" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const deleteBreakupRule = async (req, res) => {
  try {
    const deleted = await BreakupRule.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Rule not found" });
    res.json({ message: "Rule deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ---------------- Splits ----------------
export const addSplit = async (req, res) => {
  const { id } = req.params;
  const splitData = req.body;

  try {
    const rule = await BreakupRule.findById(id);
    if (!rule) return res.status(404).json({ message: "Rule not found" });

    rule.splits.push({
      ...splitData,
      instanceId: new mongoose.Types.ObjectId(),
      mirrors: [],
    });

    await rule.save();
    res.status(201).json(rule);
  } catch (err) {
    console.error("[Add Split Error]", err);
    res.status(500).json({ message: "Error adding split" });
  }
};

export const updateSplit = async (req, res) => {
  const { id, splitId } = req.params;

  try {
    const rule = await BreakupRule.findById(id);
    if (!rule) return res.status(404).json({ message: "Rule not found" });

    const split = rule.splits.id(splitId);
    if (!split) return res.status(404).json({ message: "Split not found" });

    Object.assign(split, req.body);
    await rule.save();

    res.status(200).json(rule);
  } catch (err) {
    console.error("[Update Split Error]", err);
    res.status(500).json({ message: "Error updating split" });
  }
};

export const deleteSplit = async (req, res) => {
  const { id, splitId } = req.params;

  try {
    const rule = await BreakupRule.findById(id);
    if (!rule) return res.status(404).json({ message: "Rule not found" });

    const split = rule.splits.id(splitId);
    if (!split) return res.status(404).json({ message: "Split not found" });

    split.deleteOne();
    await rule.save();

    res.status(200).json({ message: "Split deleted successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting split" });
  }
};

// ---------------- Mirrors ----------------
export const addMirror = async (req, res) => {
  const { id, splitId } = req.params;
  const mirrorData = req.body;

  try {
    const rule = await BreakupRule.findById(id);
    if (!rule) return res.status(404).json({ message: "Rule not found" });

    const split = rule.splits.id(splitId);
    if (!split) return res.status(404).json({ message: "Split not found" });

    split.mirrors.push({
      ...mirrorData,
      instanceId: new mongoose.Types.ObjectId(),
    });

    await rule.save();
    res.status(201).json(rule);
  } catch (err) {
    console.error("[Add Mirror Error]", err);
    res.status(500).json({ message: "Error adding mirror" });
  }
};

export const updateMirror = async (req, res) => {
  const { id, splitId, mirrorId } = req.params;

  try {
    const rule = await BreakupRule.findById(id);
    if (!rule) return res.status(404).json({ message: "Rule not found" });

    const split = rule.splits.id(splitId);
    if (!split) return res.status(404).json({ message: "Split not found" });

    const mirror = split.mirrors.id(mirrorId);
    if (!mirror) return res.status(404).json({ message: "Mirror not found" });

    Object.assign(mirror, req.body);
    await rule.save();

    res.status(200).json(rule);
  } catch (err) {
    console.error("[Update Mirror Error]", err);
    res.status(500).json({ message: "Error updating mirror" });
  }
};

export const deleteMirror = async (req, res) => {
  const { id, splitId, mirrorId } = req.params;

  try {
    const rule = await BreakupRule.findById(id);
    if (!rule) return res.status(404).json({ message: "Rule not found" });

    const split = rule.splits.id(splitId);
    if (!split) return res.status(404).json({ message: "Split not found" });

    const mirror = split.mirrors.id(mirrorId);
    if (!mirror) return res.status(404).json({ message: "Mirror not found" });

    mirror.deleteOne();
    await rule.save();

    res.status(200).json({ message: "Mirror deleted successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting mirror" });
  }
};
