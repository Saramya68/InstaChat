const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const DB = require('../db');

// Middleware to verify JWT token
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkey12345!@#$');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Create a new group chat
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, memberIds } = req.body;
    if (!name || !memberIds || !Array.isArray(memberIds)) {
      return res.status(400).json({ message: 'Group name and memberIds array are required' });
    }

    const group = await DB.createGroup({
      name,
      creatorId: req.user.id,
      memberIds
    });

    return res.status(201).json(group);
  } catch (err) {
    console.error('Error creating group:', err);
    return res.status(500).json({ message: 'Failed to create group' });
  }
});

// Fetch groups current user is a member of
router.get('/', authMiddleware, async (req, res) => {
  try {
    const groups = await DB.getGroupsForUser(req.user.id);
    return res.json(groups);
  } catch (err) {
    console.error('Error fetching groups:', err);
    return res.status(500).json({ message: 'Failed to fetch groups' });
  }
});

module.exports = router;
