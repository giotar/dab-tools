# DAB <=> Roku Bridge

The bridge app is a Node.js application that translates DAB request into Roku ECP commands and ECP output into DAB responses. Since DAB is intended to support a single device with multiple clients, a single instance of this app can only manage a single Android device via a single MQTT broker.

## Installation

Make sure you're running node 14 and upgrade if necessary
```bash
node --version
```
NPM install the required dependencies for the bridge app
```bash
cd dab-roku-bridge
npm install
```
Edit the config/default.json file to set the path to the "adb > binary" executable on your computer and replace the "adb > device" string "deviceIpOrSerialHere" with either the ip address or Android serial of the device you wish to automate. The app will automatically handle the connection going forward. If your MQTT broker isn't on your local computer, you'll also need to specify the correct URI to access it at the "mqttBroker" value.

## Usage

To start the DAB<=>ADB Bridge, in a terminal, run:
```bash
cd dab-roku-bridge
npm start
# Logs will print to console indicating connection state and any activities
# the bridge is performing
```

Various DAB sample commands can be run against the bridge from a separate terminal:
```bash
cd dab-roku-bridge
npm test
# Logs will print to console indicating requests and responses received
```

The DAB<=>Roku Bridge can be shut down by giving focus to the terminal running the brdige and sending Ctrl C