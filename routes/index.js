var express = require('express');
var router = express.Router();

var pug = require('pug');
var fs = require('fs');

var twitch = require('../custom_modules/twitch');

function renderFrontend() {
	// Re-render the static viewer html
	let viewerRender = pug.renderFile('frontend/viewer.pug');
	fs.writeFileSync('frontend/viewer.html', viewerRender);

	let configRender = pug.renderFile('frontend/config.pug');
	fs.writeFileSync('frontend/config.html', configRender);

	let liveRender = pug.renderFile('frontend/live.pug');
	fs.writeFileSync('frontend/live.html', liveRender);
}

router.renderFrontend = renderFrontend;

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Twitch Extension template'});
});

// Re-render then redirect to index
router.get('/render', (req, res, next) => {
	renderFrontend();

    res.redirect('/');
});

// Test message to all sockets in a channel
router.post('/testChannelSocket', (req, res, next) => {
	console.log("Sending socket broadcast!");
	console.log(req.body);

	twitch.io.to(req.body.channelID).emit('test', req.body.message);
	res.end();
});

// Test to a specific socket
router.post('/testUserSocket', (req, res, next) => {
	console.log("Sending socket whisper!");
	console.log(req.body);

	twitch.io.to(req.body.socketID).emit('whisper', req.body.message);
	res.end();
});

// Test to all viewers in a channel via Twitch PubSub
router.post('/testPubsubBroadcast', (req, res, next) => {
	console.log("Sending PubSub broadcast!");
	console.log(req.body);

	twitch.sendPubSub(req.body.channelID, 'broadcast', 'application/text', req.body.message);
	res.end();
});

// Test whisper to a specific user in a specific channel via Twitch PubSub
router.post('/testPubsubWhisper', (req, res, next) => {
	console.log("Sending PubSub whisper!");
	console.log(req.body);

	twitch.sendPubSub(req.body.channelID, "whisper-"+req.body.opaqueID, 'application/text', req.body.message);
	res.end();
});

module.exports = router;
