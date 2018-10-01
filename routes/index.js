const express = require('express');
const router = express.Router();
const wins = require('winston');
const pug = require('pug');
const fs = require('fs');

const twitch = require('../custom_modules/twitch');
const ext_sockets = require('../custom_modules/extension_sockets');
const mw = require('./middleware');

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
    wins.debug("Sending socket broadcast!");
    wins.debug(req.body);

    ext_sockets.io.to(req.body.channelID).emit('test', req.body.message);
    res.end();
});

// Test to a specific socket
router.post('/testUserSocket', (req, res, next) => {
    wins.debug("Sending socket whisper!");
    wins.debug(req.body);

    ext_sockets.io.to(req.body.socketID).emit('whisper', req.body.message);
    res.end();
});

// Test to all viewers in a channel via Twitch PubSub
router.post('/testPubsubBroadcast', async (req, res, next) => {
    wins.debug("Sending PubSub broadcast!");
    wins.debug(req.body);

    await twitch.sendPubSub(req.body.channelID, 'broadcast', 'application/text', req.body.message);
    res.end();
});

// Test whisper to a specific user in a specific channel via Twitch PubSub
router.post('/testPubsubWhisper', async (req, res, next) => {
    wins.debug("Sending PubSub whisper!");
    wins.debug(req.body);

    await twitch.sendPubSub(req.body.channelID, "whisper-"+req.body.opaqueID, 'application/text', req.body.message);
    res.end();
});

module.exports = router;
