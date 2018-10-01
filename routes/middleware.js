const twitch = require('../custom_modules/twitch');
const wins = require('winston');


async function verifyToken (req, res, next) {
    let token = null;
    if (req.method == "GET") {
        token = req.query.token;
    } else if (req.method == "POST") {
        token = req.body.token;
    }

    if (token) {
        // Verify the token
        let decodedJWT = await twitch.verifyJWT(token);
        req.jwt = decodedJWT;
        next();
    } else {
        throw {
            status: 400,
            msg: "Request missing JWT"
        };
    }
}

async function verifyBroadcaster(req, res, next) {
    if (req.jwt.role != "broadcaster") {
        wins.info("Rejecting un-authorised access attempt to " + req.originalUrl);
        throw {
            status: 403,
            msg: "Only the broadcaster may access this resource"
        };
    } else {
        next();
    }
}

async function verifyModerator(req, res, next) {
    if (req.jwt.role != "broadcaster" && req.jwt.role != "moderator") {
        wins.info("Rejecting un-authorised access attempt to " + req.originalUrl);
        throw {
            status: 403,
            msg: "Only broadcasters and moderators may access this resource"
        };
    } else {
        next();
    }
}

// The custom exception catcher app middleware
async function customErrorHandler(err, req, res, next) {
    if (err.status && err.msg) {
        res.status(err.status).send({err: err.msg});
    } else {
        next(err);
    }
}

function errorHandler(asyncFn) {
    return async (req, res, next) => {
        try {
            return await asyncFn(req, res, next);
        } catch (e) {
            // Handle premade errors
            if (e.status && e.msg) {
                res.status(e.status).send({err: e.msg});
            } else {
                if (typeof e == 'object') {
                    wins.error("Caught unknown exception!");
                    wins.error(JSON.stringify(e, null, '  '));
                    wins.error("Rethrowing!!");
                } else {
                    wins.debug("Caught unknown exception: " + e);
                    wins.error("Rethrowing!!");
                }
            throw e;
            }
        }
    }
}

function logError(req) {
    try {
        wins.error("Request body:")
        if (typeof req.body == 'object') {
            wins.error(JSON.stringify(req.body, null, '  '));
        } else {
            wins.error(req.body);
        }
        wins.error("JWT:");
        if (req.jwt) {
            wins.error(JSON.stringify(req.jwt, null, '  '));
        } else {
            wins.error("No JWT!");
        }
    } catch (e) {
        wins.error("Failed to log error: " + e);
    }
}

const genericError = {
    status: 400,
    msg: "Something went wrong!"
};

module.exports = {
    eh: errorHandler,
    logError: logError,
    ge: genericError,
    verifyToken: errorHandler(verifyToken),
    verifyModerator: errorHandler(verifyModerator),
    verifyBroadcaster: errorHandler(verifyBroadcaster),
    customErrorHandler,
};