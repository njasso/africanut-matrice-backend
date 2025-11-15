const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Member = mongoose.model('Member');

// simple search: q matches name or bio; optional skill or specialty ids
router.get('/', async (req, res) => {
  try {
    const { q, city } = req.query;
    const filter = {};
    if (q) filter.$or = [
      { firstName: new RegExp(q, 'i') },
      { lastName: new RegExp(q, 'i') },
      { bio: new RegExp(q, 'i') }
    ];
    if (city) filter['location.city'] = city;
    const results = await Member.find(filter).limit(100).lean();
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
