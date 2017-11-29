# Twitch Extension Demo

A simple demonstration of a video overlay extension for Twitch. The demo contains a simple Node.js server as the Extension Backed Service (EBS), which can communicate with the overlay and other panels through either Twitch's PubSub functionality (backend -> viewers only), or websockets (bi-directional, using [socket.io](https://socket.io/)).

## Getting Started

#### Create and configure your extension on Twitch
Follow the [Twitch Onboarding procedure](https://dev.twitch.tv/docs/extensions/onboarding). If you do not already have affiliate/partner status, you will have to go through Amazon tax reviews, which may take some time. Make sure you select the "Video Overlay" extension type.

Once you've created your extension on Twitch, navigate to `Versions -> Manage -> Asset Hosting`
* Set Testing Base URI to `https://localhost:9999/frontend/`
* Set Viewer Path to `viewer.html`
* Set Config Path to `config.html`
* Set Live Config Path to `live.html`

#### Run the demo

* Clone this repo
* Run `npm install`
* Open the `certs` directory
* Generate a self signed certificate using OpenSSL
  * `openssl req -x509 -newkey rsa:4096 -keyout server.key -out server.crt -days 365 -nodes`
  * On Windows, you can either use OpenSSL through Bash for Windows, or install it natively from the community [binaries](https://slproweb.com/products/Win32OpenSSL.html).
  * The filenames must be `server.key` and `server.crt`. If you want to change them, they are hardcoded in `bin/www`
* Set up your environment variables
  * Set `EXTENSION_CLIENT_ID` as the Client ID of your extension, which you can find on your extension Overview page
  * Set `EXTENSION_SECRET_KEY` as your Secret Key, which you can find in `Versions -> Manage -> Settings -> Secret Keys`
* Call `npm start`

#### Test the demo locally

* Visit [https://localhost:9999/](https://localhost:9999/)
  * You should get a certificate warning from Chrome. Click `Advanced -> Proceed to localhost`. It's important you do this before trying to use the extension on Twitch, otherwise Chrome will silently block it from loading into the Twitch iframes.
  * Make sure you're accessing it with http**S** in the URL. The demo Node.js server opens a HTTPS server only.
  * If everything is working, you should see the comms testing page

#### Install and stream with the extension

* In your Twitch Extension dashboard, navigate to `Versions -> Manage -> Version Status` and click the `View on Twitch and Install` button
* Click Install, and then Configure
  * If everthing is working, you should see a **big grey box**!
* Go to `Dashboard -> Extensions`. You should see your extension listed as Installed, click on Activate and select EXTENSION-OVERLAY-1
* Go to `Dashboard -> Live`. You should see **another grey box!**
* Start streaming to your channel
* View your channel page. The video should be covered by **another grey box**. Everything is working!

#### Test communications

* Open your channel with the stream live, then open the browser console in Chrome (`More Tools -> Developer Tools -> Console`)
* Refresh the page. You should see something like this printed in the console:
```
Twitch: onAuthorized called
The channel ID is 12345678
My Twitch opaque user ID is U12345678
Socket connected successfully, my Socket ID is blahblahblahblaAAAA
New socket 'whisper' message: hello from the EBS
```
* Go back to the comms test page at [https://localhost:9999/](https://localhost:9999/)
* Test out each of the different communication methods. The output will be shown in the browser console
* That's it! Start building!

## Extending the demo

#### Folder Structure

Everything inside the `frontend` folder is what you're going to give to Twitch to host on their CDN (minus the .pug files). The demo uses [Pug](https://pugjs.org/api/getting-started.html) templates for the viewer/config/live pages, which are rendered every time you start the demo app, and can be re-rendered while the app is live by clicking the link on the comms test page (or visiting `/render`). If you want to modify names or add more templates to the render function, you can find it in `routes/index.js`.

Everything outside the `frontend` folder is your Extension Backend Service (EBS). The demo follows the standard Express genenator layout. Routing is in `routes`, templates for pages on the EBS are in `views`, and all of your public assests for EBS pages are in `public`.

The `custom_modules` folder contains `twitch_sockets.js`, which does all of the heavy lifting for comms to the viewers on Twitch. You should extend this module with any additional functions you want that involves communication with Twitch, and then require it in your routes, as is demonstrated in `routes/index.js`.

#### Hosting your EBS

When you're ready to publish your extension, you'll need to host your EBS somewhere that's publicly available. If you're just starting out, I'd strongly recommend [Heroku](https://www.heroku.com/), $7/month gives you a 24/7 hosted service with monitoring and https is automatically enabled without you even having to deal with certificates.

## Tips and Troubleshooting

* Read the [extensions docs](https://dev.twitch.tv/docs/extensions) very thoroughly, multiple times. Most questions can be answered there.
* Read the [extensions API reference](https://dev.twitch.tv/docs/extensions/reference) very thoroughly. This covers calls you can make to the API, the JWT schema, and the functionality of the Twitch Javascript Helper that you include in your extension html pages.

Stuff that everyone seems to miss in the docs
* No inline `<script>javascript</script>` in your html pages that go to Twitch
* **ALL** URL's you try to send AJAX requests to, or open websockets on, *must* use https.
* Viewers cannot send messages via PubSub. Twitch is not going to bear *all* of the load of the viewers using your extension. If you want two way communication between viewers and your EBS, you're going to have to do it with another service, and that's why this demo has websockets.
* The console logging in the browser is for demo/test purpose only. You must comment all of it out before attempting to publish your extension, or Twitch will just automatically reject you.





