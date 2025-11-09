/**
 * TCP Chat Server
 * 
 * A simple TCP chat server implementation using only Node.js standard library.
 * Uses the 'net' module for TCP socket programming - no external dependencies.
 * 
 * Features:
 * - Multiple client connections
 * - Login with username validation
 * - Real-time messaging and broadcasting
 * - Graceful disconnect handling
 * - WHO command (list active users)
 * - DM command (private messages)
 * - Idle timeout (60 seconds)
 * - Heartbeat (PING/PONG)
 */

const net = require('net');

// Configuration
const DEFAULT_PORT = 4000;
const IDLE_TIMEOUT = 60000; // 60 seconds in milliseconds

// Parse command-line arguments
const args = process.argv.slice(2);
let port = process.env.PORT || DEFAULT_PORT;

if (args.includes('--port')) {
  const portIndex = args.indexOf('--port');
  if (args[portIndex + 1]) {
    port = parseInt(args[portIndex + 1], 10);
  }
}

// Client management
const clients = new Map(); // Map of socket to client info
const usernames = new Set(); // Set of active usernames

// Client info structure
class ClientInfo {
  constructor(socket) {
    this.socket = socket;
    this.username = null;
    this.connected = false;
    this.lastActivity = Date.now();
    this.idleTimeout = null;
  }

  updateActivity() {
    this.lastActivity = Date.now();
    this.resetIdleTimeout();
  }

  resetIdleTimeout() {
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
    }
    this.idleTimeout = setTimeout(() => {
      if (this.socket && !this.socket.destroyed) {
        console.log(`Client ${this.username || 'unknown'} timed out due to inactivity`);
        this.socket.end();
      }
    }, IDLE_TIMEOUT);
  }

  clearIdleTimeout() {
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
      this.idleTimeout = null;
    }
  }
}

// Helper function to normalize message text
function normalizeText(text) {
  return text
    .split(/\s+/)
    .filter(word => word.length > 0)
    .join(' ')
    .trim();
}

// Broadcast message to all connected clients
function broadcast(message, excludeSocket = null) {
  const normalizedMessage = normalizeText(message);
  if (!normalizedMessage) return;

  clients.forEach((clientInfo, socket) => {
    if (socket !== excludeSocket && clientInfo.connected && clientInfo.username) {
      try {
        socket.write(normalizedMessage + '\n');
      } catch (error) {
        console.error(`Error broadcasting to ${clientInfo.username}:`, error.message);
      }
    }
  });
}

// Send message to a specific client
function sendToClient(socket, message) {
  if (socket && !socket.destroyed) {
    try {
      socket.write(message + '\n');
    } catch (error) {
      console.error('Error sending message to client:', error.message);
    }
  }
}

// Handle client disconnect
function handleDisconnect(socket) {
  const clientInfo = clients.get(socket);
  
  if (clientInfo) {
    clientInfo.clearIdleTimeout();
    
    if (clientInfo.username && clientInfo.connected) {
      usernames.delete(clientInfo.username);
      broadcast(`INFO ${clientInfo.username} disconnected`, socket);
      console.log(`User ${clientInfo.username} disconnected`);
    }
    
    clients.delete(socket);
  }
}

// Handle login command
function handleLogin(socket, clientInfo, command) {
  const parts = command.trim().split(/\s+/);
  
  if (parts.length < 2) {
    sendToClient(socket, 'ERR invalid-command');
    return;
  }

  const username = normalizeText(parts.slice(1).join(' '));
  
  if (!username || username.length === 0) {
    sendToClient(socket, 'ERR invalid-username');
    return;
  }

  if (usernames.has(username)) {
    sendToClient(socket, 'ERR username-taken');
    return;
  }

  // Login successful
  clientInfo.username = username;
  clientInfo.connected = true;
  usernames.add(username);
  clientInfo.updateActivity();
  
  sendToClient(socket, 'OK');
  console.log(`User ${username} logged in`);
}

// Handle MSG command
function handleMessage(socket, clientInfo, command) {
  if (!clientInfo.connected || !clientInfo.username) {
    sendToClient(socket, 'ERR not-logged-in');
    return;
  }

  const parts = command.trim().split(/\s+/);
  
  if (parts.length < 2) {
    sendToClient(socket, 'ERR invalid-command');
    return;
  }

  const message = parts.slice(1).join(' ');
  const normalizedMessage = normalizeText(message);
  
  if (!normalizedMessage) {
    sendToClient(socket, 'ERR empty-message');
    return;
  }

  clientInfo.updateActivity();
  broadcast(`MSG ${clientInfo.username} ${normalizedMessage}`, socket);
}

// Handle WHO command
function handleWho(socket, clientInfo) {
  if (!clientInfo.connected || !clientInfo.username) {
    sendToClient(socket, 'ERR not-logged-in');
    return;
  }

  clientInfo.updateActivity();
  
  clients.forEach((info) => {
    if (info.connected && info.username) {
      sendToClient(socket, `USER ${info.username}`);
    }
  });
}

// Handle DM (Direct Message) command
function handleDirectMessage(socket, clientInfo, command) {
  if (!clientInfo.connected || !clientInfo.username) {
    sendToClient(socket, 'ERR not-logged-in');
    return;
  }

  const parts = command.trim().split(/\s+/);
  
  if (parts.length < 3) {
    sendToClient(socket, 'ERR invalid-command');
    return;
  }

  const targetUsername = parts[1];
  const message = parts.slice(2).join(' ');
  const normalizedMessage = normalizeText(message);
  
  if (!normalizedMessage) {
    sendToClient(socket, 'ERR empty-message');
    return;
  }

  if (!usernames.has(targetUsername)) {
    sendToClient(socket, `ERR user-not-found ${targetUsername}`);
    return;
  }

  if (targetUsername === clientInfo.username) {
    sendToClient(socket, 'ERR cannot-message-self');
    return;
  }

  clientInfo.updateActivity();
  
  // Find the target client and send the message
  let messageSent = false;
  clients.forEach((info, targetSocket) => {
    if (info.username === targetUsername && info.connected) {
      sendToClient(targetSocket, `DM ${clientInfo.username} ${normalizedMessage}`);
      messageSent = true;
    }
  });

  if (!messageSent) {
    sendToClient(socket, `ERR user-not-found ${targetUsername}`);
  }
}

// Handle PING command
function handlePing(socket, clientInfo) {
  clientInfo.updateActivity();
  sendToClient(socket, 'PONG');
}

// Process incoming data from client
function processCommand(socket, clientInfo, data) {
  const command = data.toString().trim();
  
  if (!command) {
    return;
  }

  const upperCommand = command.toUpperCase();
  
  if (upperCommand.startsWith('LOGIN')) {
    handleLogin(socket, clientInfo, command);
  } else if (upperCommand.startsWith('MSG')) {
    handleMessage(socket, clientInfo, command);
  } else if (upperCommand === 'WHO') {
    handleWho(socket, clientInfo);
  } else if (upperCommand.startsWith('DM')) {
    handleDirectMessage(socket, clientInfo, command);
  } else if (upperCommand === 'PING') {
    handlePing(socket, clientInfo);
  } else {
    sendToClient(socket, 'ERR unknown-command');
  }
}

// Create TCP server
const server = net.createServer((socket) => {
  console.log('New client connected');
  
  const clientInfo = new ClientInfo(socket);
  clients.set(socket, clientInfo);
  
  // Handle incoming data
  let buffer = '';
  
  socket.on('data', (data) => {
    buffer += data.toString();
    
    // Process complete lines (commands ending with newline)
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line in buffer
    
    lines.forEach(line => {
      if (line.trim()) {
        processCommand(socket, clientInfo, line);
      }
    });
  });
  
  // Handle client disconnect
  socket.on('end', () => {
    handleDisconnect(socket);
  });
  
  socket.on('close', () => {
    handleDisconnect(socket);
  });
  
  socket.on('error', (error) => {
    console.error('Socket error:', error.message);
    handleDisconnect(socket);
  });
  
  // Set initial idle timeout
  clientInfo.resetIdleTimeout();
});

// Start server
server.listen(port, () => {
  console.log(`TCP Chat Server listening on port ${port}`);
  console.log(`Connect using: nc localhost ${port}`);
});

// Handle server errors
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Please choose a different port.`);
  } else {
    console.error('Server error:', error.message);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  
  clients.forEach((clientInfo, socket) => {
    if (clientInfo.username && clientInfo.connected) {
      sendToClient(socket, 'INFO Server is shutting down');
    }
    socket.end();
  });
  
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\nShutting down server...');
  
  clients.forEach((clientInfo, socket) => {
    if (clientInfo.username && clientInfo.connected) {
      sendToClient(socket, 'INFO Server is shutting down');
    }
    socket.end();
  });
  
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

