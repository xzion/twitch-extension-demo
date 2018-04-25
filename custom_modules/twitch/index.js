const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const request = require('request');

if (!process.env.EXTENSION_SECRET_KEY || !process.env.EXTENSION_CLIENT_ID) {
	throw Error("Missing environment variables! Read the docs!");
}

const io = socketIO();
var twitch = {};
twitch.io = io;

var SECRET = Buffer.from(process.env.EXTENSION_SECRET_KEY, 'base64');
var CLIENTID = process.env.EXTENSION_CLIENT_ID;

// JWT verification middleware
io.use((socket, next) => {
	let token = socket.handshake.query.jwt;

	jwt.verify(token, SECRET, (err, decoded) => {
		if (err) {
			console.log("Failed to verify JWT for connection");
			next(new Error('authentication err'));
		} else {
			console.log("Verified socket connection");
			console.log(JSON.stringify(decoded, null, '  '));
			socket.jwt = decoded;
			next();
		}
	});
});

// New connection or reconnection
io.on('connection', (socket) => {
	console.log("A user connected by socket from channel " + socket.jwt.channel_id + "!");
	console.log("Socket ID is", socket.id);

	socket.join(socket.jwt.channel_id);
	socket.emit('whisper', "hello from the EBS");
});

// Twitch PubSub infrastructure
twitch.sendPubSub = (channel, target, contentType, message) => {
	let timeNow = new Date();
	timeNow.setMinutes(timeNow.getMinutes() + 60);

	// Create and sign JWT. Role must be 'external'
	let rawJWT = {
		exp: Math.floor(timeNow/1000),
		channel_id: channel,
		role: 'external',
		pubsub_perms: {
			send: ["*"]
		}
	}
	let signedJWT = jwt.sign(rawJWT, SECRET);

	// Push to twitch, JWT is auth bearer
	request.post({
		url: "https://api.twitch.tv/extensions/message/"+channel,
		headers: {
			"Client-ID": CLIENTID,
			"Authorization": "Bearer " + signedJWT
		},
		json: {
			content_type: contentType,
			targets: [target], // Must be an array
			message: message
		}
	}, (err, httpResponse, body) => {
		if (err) {
			console.log("Pubsub send failed: " + err);
		} else if (httpResponse.statusCode != 204) {
			console.log("Pubsub send failed, error code: " + httpResponse.statusCode);
		}

		console.log("Successfully sent pubsub message");
	});
}


module.exports = twitch;