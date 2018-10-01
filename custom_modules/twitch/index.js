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

// Send a chat message via the extension interface
twitch.sendChatMessage = async function (channelID, message) {
    try {
        let devJWT = await createServerJWT(channelID);

        await rpn.post({
            url: `https://api.twitch.tv/extensions/${process.env.EXTENSION_CLIENT_ID}/${process.env.EXTENSION_VERSION}/channels/${channelID}/chat`,
            headers: {
                "Client-ID": process.env.EXTENSION_CLIENT_ID,
                "Authorization": "Bearer " + devJWT
            },
            json: {
                text: message
            }
        });

    } catch (e) {
        wins.error("Failed to send message to chat!");
        wins.error(e);
        // No throw
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

// For processing Twitch OAuth callbacks. Returns the verification data and tokens
twitch.getOAuthTokens = async function (code) {
    try {
        // Ask for tokens
        let tokenUrl = `https://id.twitch.tv/oauth2/token`;

        // Remember this needs to use the other type of secret
        let formData = {
            client_id: process.env.EXTENSION_CLIENT_ID,
            client_secret: process.env.EBS_SECRET,
            code: code,
            grant_type: "authorization_code",
            redirect_uri: process.env.OAUTH_REDIRECT_URI
        };

        // Get the tokens
        let res = await rpn.post({
            url:tokenUrl,
            form: formData
        });
        let tokens = JSON.parse(res)

        // Verify it
        let verificationInfo = await rpn.get({
            url: "https://id.twitch.tv/oauth2/validate",
            headers: {
                Authorization: "OAuth " + tokens.access_token
            },
            json: true
        });
        verificationInfo.tokens = tokens;

        return verificationInfo;
    } catch (e) {
        wins.error("Failed to process and verify Twitch OAuth callback: " + e);
        throw {
            status: 500,
            msg: "Internal server error"
        }
    }
}

// For refreshing Twitch user OAuth tokens
twitch.refreshAccessToken = async function (refresh_token) {
    try {
        // Remember this needs to use the other type of secret
        let formData = {
            client_id: process.env.EXTENSION_CLIENT_ID,
            client_secret: process.env.EBS_SECRET,
            grant_type: "refresh_token",
            refresh_token: refresh_token
        };

        let res = await rpn.post({
            url: "https://id.twitch.tv/oauth2/token",
            form: formData
        });
        let tokens = JSON.parse(res);

        return tokens;

    } catch (e) {
        wins.error("Failed to refresh Twitch OAuth token");
        wins.error(e);
        throw {
            status: 500,
            msg: "Internal Sever Error"
        };
    }
}

// For getting a user's email address, requires the user's ID and OAuth access token
twitch.getUserInfo = async function (userID, access_token) {
    try {
        return await rpn.get({
            url: `https://api.twitch.tv/helix/users?id=${userID}`,
            headers: {
                Authorization: "Bearer " + access_token
            },
            json: true
        });
    } catch (e) {
        wins.error("Failed to get user info for " + userID + " Twitch: " + e);
        throw {
            status: 500,
            msg: "Internal server error"
        }
    }
}

// Recursive helper. Note: may 404 for extensions in test phase
async function loopChannels (cursor) {
    let baseUrl = `https://api.twitch.tv/extensions/${process.env.EXTENSION_CLIENT_ID}/live_activated_channels`;
    if (cursor) {
        baseUrl += "?cursor=" + cursor;
    }

    let parsedList = [];
    let newCursor = null;

    try {
        let body = await rpn.get({
            url: baseUrl,
            json: true,
            headers: {
                "Client-Id": process.env.EXTENSION_CLIENT_ID
            }
        });
        parsedList = body.channels;
        newCursor = body.cursor;
    } catch (e) {
        wins.error("Failed to query twitch for live channels!");
        wins.error(e);
        throw({
            status: 500,
            msg: "Something went wrong"
        });
    }

    if (newCursor) {
        let remainingChannels = await loopChannels(newCursor);
        parsedList = parsedList.concat(remainingChannels);
    }

    return parsedList;
}

// For gettign the full list of currently live channels
twitch.getLiveChannels = async function () {
    return await loopChannels();
}



module.exports = twitch;