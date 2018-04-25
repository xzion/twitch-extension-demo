const socketIO = require('socket.io');
const wins = require('winston');

const twitch = require('../twitch');

let ext_sockets = {};
const io = socketIO();
ext_sockets.io = io;

// JWT verification middleware
io.use(async (socket, next) => {
    try {
        let token = socket.handshake.query.jwt;
        let decoded = await twitch.verifyJWT(token);
        socket.jwt = decoded;
        next();
    } catch (e) {
        // JWT verification failed
        next(e.msg);
    }
});

// New connection or reconnection
io.on('connection', (socket) => {
    wins.debug("A user connected by socket from channel " + socket.jwt.channel_id + "!");
    wins.debug("Socket ID is", socket.id);

    socket.join(socket.jwt.channel_id);
    socket.emit('whisper', "hello from the EBS");
});

module.exports = ext_sockets;