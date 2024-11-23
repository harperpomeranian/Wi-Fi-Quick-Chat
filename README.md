# Wi-Fi Quick Chat

Simple local Wi-Fi chat app that uses WebSockets and UDP; Made with [DroidScript](https://droidscript.org/)

## Installation

There are two ways of using this app, using the [DroidScript IDE](#using-droidscript) or by installing the APK.

### Using DroidScript
* Download and install DroidScript from the Google Play Store or from their [website](https://droidscript.org/)
* Download the [SPK](Wi-Fi%20Quick%20Chat.spk) from [releases](https://github.com/harperpomeranian/Wi-Fi-Quick-Chat/releases)
* Run the app in DroidScript

### Installing the APK
* Download the APK from [releases](https://github.com/harperpomeranian/Wi-Fi-Quick-Chat/releases)
* Install the APK on your device
* Run the app

## Usage

It's pretty simple, you just open up the app on two or more devices and start chatting. Make sure both devices are connected to the same Wi-Fi network or Wi-Fi hotspot for it to work.

## How it Works

It finds a websocket server on the local network via UDP, if it doesn't find one in 5 seconds, it creates the server on the device and the device will be the server that every new device connects to.

## Problems and Reflection

1. Early on developing this app, I realized that I should've used NodeJS instead of DroidScript's built-in `app.CreateServer`. It would've made the app support more features.
    - Because I used DroidScript's built-in `app.CreateServer`, I couldn't add support for sending media because there was no control over the max upload size.
2. I should've used an HTML template because I would've been able to style te app more.
    - This would've allowed me to add video/audio calling support via WebRTC.
3. Anyone could make a fake server to break the app.
4. The messages list doesn't scroll to the last message even if I call `msgList.ScrollToItemByIndex`; A problem with DroidScript itself.