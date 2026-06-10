const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// File paths for JSON fallback
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

let isMongo = false;
let jsonData = {
  users: [],
  messages: [],
  groups: []
};

// MongoDB Schemas
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  avatarUrl: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const MessageSchema = new mongoose.Schema({
  conversationId: { type: String, required: true, index: true },
  senderId: { type: String, required: true },
  senderName: { type: String, required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  creatorId: { type: String, required: true },
  memberIds: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});

let UserModel, MessageModel, GroupModel;

// Read JSON DB from disk
function readJSON() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      writeJSON();
      return;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    jsonData = JSON.parse(raw);
    // Ensure all tables exist
    if (!jsonData.users) jsonData.users = [];
    if (!jsonData.messages) jsonData.messages = [];
    if (!jsonData.groups) jsonData.groups = [];
  } catch (err) {
    console.error('Error reading local JSON database:', err);
  }
}

// Write JSON DB to disk
function writeJSON() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(jsonData, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing local JSON database:', err);
  }
}

// Database adaptor interface
const DB = {
  async init() {
    const mongoUri = process.env.MONGO_URI;
    if (mongoUri) {
      try {
        console.log('Connecting to MongoDB at:', mongoUri);
        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
        isMongo = true;
        UserModel = mongoose.model('User', UserSchema);
        MessageModel = mongoose.model('Message', MessageSchema);
        GroupModel = mongoose.model('Group', GroupSchema);
        console.log('Successfully connected to MongoDB.');
        return;
      } catch (err) {
        console.error('MongoDB connection failed. Falling back to local JSON database.', err.message);
      }
    }
    
    // JSON Fallback
    isMongo = false;
    console.log('Using local JSON-file Database Fallback.');
    readJSON();
  },

  isMongoDB() {
    return isMongo;
  },

  // USER CRUD
  async findUserByUsername(username) {
    if (isMongo) {
      return await UserModel.findOne({ username: new RegExp(`^${username}$`, 'i') });
    } else {
      return jsonData.users.find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
    }
  },

  async findUserById(userId) {
    if (isMongo) {
      if (!mongoose.Types.ObjectId.isValid(userId)) return null;
      return await UserModel.findById(userId);
    } else {
      return jsonData.users.find(u => u.id === userId) || null;
    }
  },

  async createUser({ username, passwordHash, avatarUrl }) {
    if (isMongo) {
      const user = new UserModel({ username, passwordHash, avatarUrl });
      await user.save();
      return { id: user._id.toString(), username: user.username, avatarUrl: user.avatarUrl, createdAt: user.createdAt };
    } else {
      const newUser = {
        id: Math.random().toString(36).substring(2, 9),
        username,
        passwordHash,
        avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`,
        createdAt: new Date().toISOString()
      };
      jsonData.users.push(newUser);
      writeJSON();
      return { id: newUser.id, username: newUser.username, avatarUrl: newUser.avatarUrl, createdAt: newUser.createdAt };
    }
  },

  async updateUserAvatar(userId, avatarUrl) {
    if (isMongo) {
      if (!mongoose.Types.ObjectId.isValid(userId)) return null;
      const user = await UserModel.findByIdAndUpdate(userId, { avatarUrl }, { new: true });
      return user ? { id: user._id.toString(), username: user.username, avatarUrl: user.avatarUrl } : null;
    } else {
      const user = jsonData.users.find(u => u.id === userId);
      if (user) {
        user.avatarUrl = avatarUrl;
        writeJSON();
        return { id: user.id, username: user.username, avatarUrl: user.avatarUrl };
      }
      return null;
    }
  },

  async getUsers(excludeUserId) {
    if (isMongo) {
      const users = await UserModel.find({ _id: { $ne: excludeUserId } }).select('-passwordHash');
      return users.map(u => ({ id: u._id.toString(), username: u.username, avatarUrl: u.avatarUrl, createdAt: u.createdAt }));
    } else {
      return jsonData.users
        .filter(u => u.id !== excludeUserId)
        .map(u => ({ id: u.id, username: u.username, avatarUrl: u.avatarUrl, createdAt: u.createdAt }));
    }
  },

  // MESSAGES CRUD
  async createMessage({ conversationId, senderId, senderName, content }) {
    if (isMongo) {
      const msg = new MessageModel({ conversationId, senderId, senderName, content });
      await msg.save();
      return {
        id: msg._id.toString(),
        conversationId: msg.conversationId,
        senderId: msg.senderId,
        senderName: msg.senderName,
        content: msg.content,
        createdAt: msg.createdAt
      };
    } else {
      const newMsg = {
        id: Math.random().toString(36).substring(2, 9),
        conversationId,
        senderId,
        senderName,
        content,
        createdAt: new Date().toISOString()
      };
      jsonData.messages.push(newMsg);
      writeJSON();
      return newMsg;
    }
  },

  async getMessages(conversationId) {
    if (isMongo) {
      const msgs = await MessageModel.find({ conversationId }).sort({ createdAt: 1 });
      return msgs.map(msg => ({
        id: msg._id.toString(),
        conversationId: msg.conversationId,
        senderId: msg.senderId,
        senderName: msg.senderName,
        content: msg.content,
        createdAt: msg.createdAt
      }));
    } else {
      return jsonData.messages
        .filter(msg => msg.conversationId === conversationId)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }
  },

  // GROUPS CRUD
  async createGroup({ name, creatorId, memberIds }) {
    // Ensure the creator is in the members list
    const members = Array.from(new Set([creatorId, ...memberIds]));
    if (isMongo) {
      const group = new GroupModel({ name, creatorId, memberIds: members });
      await group.save();
      return {
        id: group._id.toString(),
        name: group.name,
        creatorId: group.creatorId,
        memberIds: group.memberIds,
        createdAt: group.createdAt
      };
    } else {
      const newGroup = {
        id: 'group_' + Math.random().toString(36).substring(2, 9),
        name,
        creatorId,
        memberIds: members,
        createdAt: new Date().toISOString()
      };
      jsonData.groups.push(newGroup);
      writeJSON();
      return newGroup;
    }
  },

  async getGroupsForUser(userId) {
    if (isMongo) {
      const groups = await GroupModel.find({ memberIds: userId });
      return groups.map(g => ({
        id: g._id.toString(),
        name: g.name,
        creatorId: g.creatorId,
        memberIds: g.memberIds,
        createdAt: g.createdAt
      }));
    } else {
      return jsonData.groups
        .filter(g => g.memberIds.includes(userId))
        .map(g => ({
          id: g.id,
          name: g.name,
          creatorId: g.creatorId,
          memberIds: g.memberIds,
          createdAt: g.createdAt
        }));
    }
  },

  async getGroupById(groupId) {
    if (isMongo) {
      if (!mongoose.Types.ObjectId.isValid(groupId)) return null;
      const g = await GroupModel.findById(groupId);
      return g ? { id: g._id.toString(), name: g.name, creatorId: g.creatorId, memberIds: g.memberIds, createdAt: g.createdAt } : null;
    } else {
      return jsonData.groups.find(g => g.id === groupId) || null;
    }
  }
};

module.exports = DB;
