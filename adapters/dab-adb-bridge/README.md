# DAB <=> ADB Bridge

The bridge app is a Node.js application that translates DAB request into ADB commands and ADB output into DAB responses. Since DAB is intended to support a single device with multiple clients, a single instance of this app can only manage a single Android device via a single MQTT broker.

## Installation

Ensure that ADB Debugging is enabled on the device. If "{} Developer options" isn't currently enabled, you must first enable it by going to Settings > Device Preferences > About > Build and clicking on it 7 times, or until you're notified that you're now a developer.

You'll also need to make sure that ADB is installed and working on your platform.

ADB, and the bridge app, support controlling devices both over TCP or via a USB cable.

To connect via USB, connect a cable from the device to your computer and run the following command, where you should see the Android serial of your device now listed

```bash
adb devices
```
To connect via TCP, you'll need to determine the IP address of your device, then run

```bash
adb connect <ipAddress>
adb devices
```
If your device is not listed or requires acknowledgement of the pairing request, correct any issues before proceeding to next step

Make sure you're running node 14 and upgrade if necessary
```bash
node --version
```
NPM install the required dependencies for the bridge app
```bash
cd dab-adb-bridge
npm install
```
Edit the config/default.json file to set the path to the "adb > binary" executable on your computer and replace the "adb > device" string "deviceIpOrSerialHere" with either the ip address or Android serial of the device you wish to automate. The app will automatically handle the connection going forward. If your MQTT broker isn't on your local computer, you'll also need to specify the correct URI to access it at the "mqttBroker" value.

## Usage

To start the DAB<=>ADB Bridge, in a terminal, run:
```bash
cd dab-adb-bridge
npm start
# Logs will print to console indicating connection state and any activities
# the bridge is performing
```

Various DAB sample commands can be run against the bridge from a separate terminal:
```bash
cd dab-adb-bridge
npm test
# Logs will print to console indicating requests and responses received
```

The DAB<=>ADB Bridge can be shut down by giving focus to the terminal running the brdige and sending Ctrl C