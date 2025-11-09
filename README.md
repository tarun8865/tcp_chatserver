# TCP Chat Server

Simple TCP chat server built with Node.js. Uses only the standard library (no npm packages needed). Multiple users can connect, login with a username, and chat in real-time.

# Video link
https://drive.google.com/file/d/1JlR0C5IxTp-pQMCqSv66AFMW8bCcGakN/view?usp=drive_link

## Quick Start

Make sure you have Node.js installed (v14+ should work fine).

```bash
# Start the server
npm start

# Or directly
node src/server.js

# Custom port
PORT=5000 node src/server.js
# or
node src/server.js --port 5000
```

Once the server is running, connect using netcat:

```bash
nc localhost 4000
```

That's it! The server runs on port 4000 by default.

## Commands

### Login
```
LOGIN <username>
```
Returns `OK` if successful, or `ERR username-taken` if the username is already in use.

### Send Message
```
MSG <your message here>
```
Broadcasts to all connected users. They'll see: `MSG <username> <your message here>`

### List Users
```
WHO
```
Returns `USER <username>` for each connected user.

### Private Message
```
DM <username> <message>
```
Sends a private message to a specific user.

### Heartbeat
```
PING
```
Server responds with `PONG`. Useful for keeping connection alive.

### Disconnect
Just close the connection (Ctrl+C). Other users will see: `INFO <username> disconnected`

## Example Session

Here's how a typical chat session looks with two users:

**Terminal 1 - Start server:**
```bash
$ npm start
TCP Chat Server listening on port 4000
Connect using: nc localhost 4000
```

**Terminal 2 - User 1 (Naman):**
```bash
$ nc localhost 4000
LOGIN Naman
OK
MSG hi everyone!
MSG how are you?
```

**Terminal 3 - User 2 (Yudi):**
```bash
$ nc localhost 4000
LOGIN Yudi
OK
MSG hello Naman!
```

**What happens:**
- User 2 (Yudi) sees:
  ```
  MSG Naman hi everyone!
  MSG Naman how are you?
  ```

- User 1 (Naman) sees:
  ```
  MSG Yudi hello Naman!
  ```

**More examples:**

Check who's online:
```bash
WHO
USER Naman
USER Yudi
```

Send a private message:
```bash
DM Yudi Hey, this is private
```

Only Yudi will receive that message.

Keep connection alive:
```bash
PING
PONG
```

## Features

- Multiple concurrent connections (tested with 5-10 users, should handle more)
- Username validation (no duplicates)
- Broadcast messaging
- Private messages (DM)
- List active users (WHO)
- Idle timeout (60 seconds - disconnects inactive users)
- Heartbeat (PING/PONG)
- Graceful disconnect handling

## Error Messages

- `ERR username-taken` - Username already in use
- `ERR user-not-found <username>` - User doesn't exist (for DM)
- `ERR not-logged-in` - Need to login first
- `ERR invalid-command` - Invalid command format
- `ERR cannot-message-self` - Can't DM yourself

## Configuration

Default port is 4000. You can change it via:
- Environment variable: `PORT=5000 node src/server.js`
- Command line: `node src/server.js --port 5000`

Idle timeout is set to 60 seconds. Users who don't send any commands for 60 seconds will be automatically disconnected.

## Notes

- Uses Node.js `net` module (standard library only)
- No database, everything is in-memory
- Messages are normalized (extra spaces/newlines are cleaned up)
- Server handles multiple clients using Node.js event loop
- Line-based protocol (commands end with newline)

## Troubleshooting

**Port already in use:**
```bash
PORT=5000 node src/server.js
```

**Connection refused:**
Make sure the server is running first.

**Client disconnected:**
If you're idle for 60 seconds, the server will disconnect you. Send PING or any command to stay connected.

## Testing

I tested this using `nc` (netcat) on macOS. Should work with telnet too, but nc is easier. You can also write a simple TCP client in any language if needed.
