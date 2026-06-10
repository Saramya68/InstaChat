require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const DB = require('./db');
const initializeSocket = require('./socket');

const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');
const groupRoutes = require('./routes/groups');
const aiRoutes = require('./routes/ai');

const app = express();
const server = http.createServer(app);

// Configure Cors
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Initialize Database Adapter
DB.init().then(() => {
  console.log('Database system initialized.');
}).catch(err => {
  console.error('Database system initialization failed:', err);
});

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

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/ai', aiRoutes);

// User retrieval route
app.get('/api/users', authMiddleware, async (req, res) => {
  try {
    const users = await DB.getUsers(req.user.id);
    return res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    return res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// Root ping route
app.get('/ping', (req, res) => {
  res.json({ message: 'Server is running', database: DB.isMongoDB() ? 'MongoDB' : 'Local JSON' });
});

// Configure Socket.io
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Bind Socket.io events
initializeSocket(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
