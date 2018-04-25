const jwt = require('jsonwebtoken');
const rpn = require('request-promise-native');
const wins = require('winston');
const {promisify} = require('util');

// Promisified goodies
const verifyAsync = promisify(jwt.verify);
const signAsync = promisify(jwt.sign);


if (!process.env.EXTENSION_SECRET_KEY ||
    !process.env.EXTENSION_CLIENT_ID ||
    !process.env.DEVELOPER_USER_ID) {
    throw Error("Missing environment variables! Read the docs!");
}

// JWT needs the secret as a buffer
const BINARY_SECRET = Buffer.from(process.env.EXTENSION_SECRET_KEY, 'base64');

// Our export object
let twitch = {};

// Create JWT's to go with requests
async function createServerJWT (channel) {
    // 60min expiry
    let timeNow = new Date();
    timeNow.setMinutes(timeNow.getMinutes() + 60);

    // Create and sign JWT. Role must be 'external'
    let rawJWT = {
        exp: Math.floor(timeNow/1000),
        user_id: process.env.DEVELOPER_USER_ID, // the account that owns the extension
        channel_id: channel,
        role: 'external',
        pubsub_perms: {
            send: ["*"]
        }
    }
    return await signAsync(rawJWT, BINARY_SECRET);
}


// Twitch PubSub messaging
twitch.sendPubSub = async (channel, target, contentType, message) => {
    try {
        let devJWT = await createServerJWT(channel);

        // Target has to be a list. Turn strings into one element lists
        if (typeof target == 'string') {
            target = [target];
        }

        await rpn.post({
            url: "https://api.twitch.tv/extensions/message/"+channel,
            headers: {
                "Client-ID": process.env.EXTENSION_CLIENT_ID,
                "Authorization": "Bearer " + devJWT
            },
            json: {
                content_type: contentType,
                targets: target,
                message: message
            }
        });
    } catch (e) {
        wins.error("Failed to send Twitch PubSub message: " + e);
        throw {
            status: 500,
            msg: "Failed to send PubSub message"
        }
    }
}

// For external functions to verify JWT's
twitch.verifyJWT = async (token) => {
    try {
        return await verifyAsync(token, BINARY_SECRET);
    } catch (e) {
        wins.debug("Failed to verify JWT: " + e);
        throw {
            status: 400,
            msg: "Failed to verify Twitch JWT"
        };
    }
}


module.exports = twitch;