

// Get the party started
$(function() {

	// Socket connection to EBS
	var socket = io('https://localhost:9999', {
		autoConnect: false
	});

	// WebSocket Handlers
	socket.on('connect', () => {
		console.log("Socket connected successfully, my Socket ID is " + socket.id);
	});
	socket.on('connect_error', (err) => {
		console.log("Failed to connect to socket:", err);
	});
	socket.on('connect_timeout', (timeout) => {
		console.log("Socket connection timed out:", timeout);
	});
	socket.on('error', (err) => {
		console.log("Socket error:", err);
	});
	socket.on('disconnect', (reason) => {
		console.log("Socket disconnected:", reason);
	});
	socket.on('reconnect', (attemptNumber) => {
		console.log("Successfully reconnected to socket after " + attemptNumber + " attempts");
	});
	socket.on('reconnect_attempt', (attemptNumber) => {
		console.log("Attempting reconnect... " + attemptNumber);
	});
	socket.on('reconnect_error', (err) => {
		console.log("Failed to reconnect to socket:", err);
	});
	socket.on('test', (msg) => {
		console.log("New socket 'test' message:", msg);
	});
	socket.on('whisper', (msg) => {
		console.log("New socket 'whisper' message:", msg);
	});


	// Twitch function handlers
	var twitch = window.Twitch.ext;
	var firstTimeOnly = true;
	var latestAuth = {};

	// This bit of disgustingness is to deal with a bug (28/11/2017) in the Twitch JS Helper.
	// Normally you would call listen for the whisper channel inside onAuthorized when you get
	// your opaque ID, however, calling twitch.listen inside onAuthorise causes the listen
	// function to be registered more than one time for some reason. So we wait for onAuth to
	// be called and then register the listener here.
	function whisperHack() {
		if (!firstTimeOnly) {
			// Listen to this viewer's private PubSub whisper channel
			twitch.listen('whisper-'+latestAuth.userId, (target, type, msg) => {
				console.log("New Twitch PubSub whisper:", msg);
			});
		} else {
			setTimeout(whisperHack, 1000);
		}
	}
	whisperHack();

	// onAuth handler. Gives us JWT and the viewer's opaque ID
	twitch.onAuthorized((auth) => {
		console.log("Twitch: onAuthorized called");
		console.log("The channel ID is", auth.channelId);
		// console.log("The extension clientId is", auth.clientId);
		console.log("My Twitch opaque user id is", auth.userId);
		// console.log("The JWT token is", auth.token);

		latestAuth = auth;

		// Update the socket query with new JWT
		socket.io.opts.query = {
			jwt: auth.token
		};

		if (firstTimeOnly) {
			firstTimeOnly = false;

			// Open the websocket
			socket.open();
		}
	});

	// Sub all viewers to the broadcast channel
	twitch.listen('broadcast', (target, type, msg) => {
		console.log("New Twitch PubSub broadcast message:", msg);
	});

	// Error handler
	twitch.onError((err) => {
		console.log("Twitch: onError called");
		console.log("The error was", err);
	});

	// onContext handler. Providers viewer mode, resolution, delay and other stuff
	// This can be very spammy, commented out by default
	twitch.onContext((context, diff) => {
		// console.log("Twitch: onContext called");
		// console.log(context);
		// console.log(diff);
	});

});