const jwt = require('jsonwebtoken');
const rpn = require('request-promise-native');
const wins = require('winston');
const {promisify} = require('util');

// Promisified goodies
const verifyAsync = promisify(jwt.verify);
const signAsync = promisify(jwt.sign);


if (!process.env.EXTENSION_SECRET_KEY ||
    !process.env.DEVELOPER_USER_ID ||
    //!process.env.EXTENSION_VERSION ||
    //!process.env.EXTENSION_CONFIG_STRING ||
    //!process.env.EBS_SECRET ||
    //!process.env.OAUTH_REDIRECT_URI ||
    !process.env.EXTENSION_CLIENT_ID) {
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
twitch.sendPubSub = async function (channel, target, contentType, message) {
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
twitch.verifyJWT = async function (token) {
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

// Sets the channel required config to the correct value
twitch.approveChannel = async function (channelID) {
    await twitch.setChannelConfigString(channelID, process.env.EXTENSION_CONFIG_STRING);
}

// Available for developer testing and/or disabling channels
twitch.setChannelConfigString = async function (channelID, configString) {
    try {
        let devJWT = await createServerJWT(channelID);
        let safeURL = encodeURI("https://api.twitch.tv/extensions/" + process.env.EXTENSION_CLIENT_ID + "/" + process.env.EXTENSION_VERSION + "/required_configuration?channel_id=" + channelID);

        await rpn.put({
            url: safeURL,
            headers: {
                "Client-Id": process.env.EXTENSION_CLIENT_ID,
                "Authorization": "Bearer " + devJWT
            },
            json: {
                required_configuration: configString
            }
        });
    } catch (e) {
        wins.error("Failed to set required channel config string for channel " + channelID + ": " + e);
        throw {
            status: 500,
            msg: "Internal server error"
        }
    }
}


module.exports = twitch;