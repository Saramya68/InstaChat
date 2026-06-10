const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Middleware to verify JWT token
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  const jwt = require('jsonwebtoken');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

router.post('/chat', authMiddleware, async (req, res) => {
  const { message, history } = req.body;

  if (!message) {
    return res.status(400).json({ message: 'Message is required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    // Graceful mock mode if no API key is provided
    setTimeout(() => {
      const responses = [
        "Hello! I am your Gemini AI Assistant. To enable my real intelligence, please set your `GEMINI_API_KEY` in the server's `.env` file.",
        `You said: "${message}". I'm running in local sandbox mode because the Gemini API Key is not configured yet. Set GEMINI_API_KEY to unlock actual neural network responses!`,
        "I can help you test messaging, group chats, or WebRTC call signaling. Just ask!",
        "WebRTC audio and video calling uses signaling via Socket.io and streams data peer-to-peer! Ready to call someone?"
      ];
      const randomReply = responses[Math.floor(Math.random() * responses.length)];
      return res.json({ reply: randomReply });
    }, 1000);
    return;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Use gemini-1.5-flash for speed and reliability
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    // Construct prompt from conversation history
    let prompt = "You are a helpful, friendly AI assistant inside a real-time chat application. Respond to the user's message below.\n\n";
    
    if (history && Array.isArray(history)) {
      history.slice(-6).forEach(h => {
        prompt += `${h.senderName === 'AI Assistant' ? 'AI' : 'User'}: ${h.content}\n`;
      });
    }
    prompt += `User: ${message}\nAI:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    return res.json({ reply: text });
  } catch (err) {
    console.error('Error generating AI response:', err);
    return res.status(500).json({ 
      message: 'Failed to generate response from Gemini AI API', 
      error: err.message 
    });
  }
});

module.exports = router;
