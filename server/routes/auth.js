const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const DB = require('../db');

// Sign JWT Token helper
const signToken = (userId, username) => {
  return jwt.sign(
    { id: userId, username },
    process.env.JWT_SECRET || 'supersecretjwtkey12345!@#$',
    { expiresIn: '30d' }
  );
};

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const existingUser = await DB.findUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ message: 'Username already taken' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await DB.createUser({ username, passwordHash });
    const token = signToken(user.id, user.username);

    return res.status(201).json({
      user,
      token
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ message: 'Server error during registration' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const user = await DB.findUserByUsername(username);
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const userId = DB.isMongoDB() ? user._id.toString() : user.id;
    const token = signToken(userId, user.username);

    return res.json({
      user: {
        id: userId,
        username: user.username,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt
      },
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Server error during login' });
  }
});

// Get Current User Session
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkey12345!@#$');
    const user = await DB.findUserById(decoded.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userId = DB.isMongoDB() ? user._id.toString() : user.id;
    return res.json({
      id: userId,
      username: user.username,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt
    });
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
});

// Update Profile
router.put('/profile', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkey12345!@#$');
    const { avatarUrl } = req.body;
    if (!avatarUrl) {
      return res.status(400).json({ message: 'Avatar URL is required' });
    }

    const updatedUser = await DB.updateUserAvatar(decoded.id, avatarUrl);
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json(updatedUser);
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
});

module.exports = router;
