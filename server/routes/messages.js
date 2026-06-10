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

// Get message history for a conversation
router.get('/:conversationId', authMiddleware, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const messages = await DB.getMessages(conversationId);
    return res.json(messages);
  } catch (err) {
    console.error('Error fetching messages:', err);
    return res.status(500).json({ message: 'Failed to fetch messages' });
  }
});

// Save a new message
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { conversationId, content } = req.body;
    if (!conversationId || !content) {
      return res.status(400).json({ message: 'ConversationId and content are required' });
    }

    const message = await DB.createMessage({
      conversationId,
      senderId: req.user.id,
      senderName: req.user.username,
      content
    });

    return res.status(201).json(message);
  } catch (err) {
    console.error('Error saving message:', err);
    return res.status(500).json({ message: 'Failed to save message' });
  }
});

module.exports = router;
