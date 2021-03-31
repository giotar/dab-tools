/**
 Copyright 2019 Amazon.com, Inc. or its affiliates.
 Copyright 2019 Netflix Inc.
 Copyright 2019 Google LLC
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import { MqttClient } from '../mqtt_client/index.js';
import  * as topics  from './dab_topics.js';
import { readFileSync } from 'fs';

export class DabDeviceInterface {

    /**
     * Constructor for DabDeviceInterface
     * Don't construct this interface directly.
     */
    constructor() {
        if (new.target === DabDeviceInterface) {
            throw new TypeError("Cannot construct Interface instances directly");
        }
        this.telemetry = {};
    }

    appState = {
        foreground: "FOREGROUND",
        stopped: "STOPPED",
        background: "BACKGROUND"
    }

    /**
     * Init to be called once at application startup, unless following stop
     */
    async init(uri) {
        this.client = new MqttClient();

        //Pre-Init Handler Registration
        await Promise.all(
            [
                this.client.handle(topics.APPLICATION_LIST_TOPIC, this.listApps),
                this.client.handle(topics.APPLICATION_LAUNCH_TOPIC, this.launchApp),
                this.client.handle(topics.APPLICATION_LAUNCH_CONTENT_TOPIC, this.launchAppContent),
                this.client.handle(topics.APPLICATION_EXIT_TOPIC, this.exitApp),
                this.client.handle(topics.APPLICATION_STATE_TOPIC, this.getAppState),
                this.client.handle(topics.SYSTEM_RESTART_TOPIC, this.restartDevice),
                this.client.handle(topics.INPUT_KEY_PRESS_TOPIC, this.keyPress),
                this.client.handle(topics.INPUT_LONG_KEY_PRESS_TOPIC, this.keyPressLong),
                this.client.handle(topics.SYSTEM_LANGUAGE_SET_TOPIC, this.setSystemLanguage),
                this.client.handle(topics.SYSTEM_LANGUAGE_GET_TOPIC, this.getSystemLanguage),
                this.client.handle(topics.SYSTEM_LANGUAGE_LIST_TOPIC, this.listSystemLanguages),
                this.client.handle(topics.DEVICE_TELEMETRY_START_TOPIC, this.startDeviceTelemetry),
                this.client.handle(topics.DEVICE_TELEMETRY_STOP_TOPIC, this.stopDeviceTelemetry),
                this.client.handle(topics.APP_TELEMETRY_START_TOPIC, this.startAppTelemetry),
                this.client.handle(topics.APP_TELEMETRY_STOP_TOPIC, this.stopAppTelemetry),
                this.client.handle(topics.HEALTH_CHECK_TOPIC, this.healthCheck)
            ]
        );

        //Start MQTT Client
        await this.client.init(uri);

        //Post-Init publishing of retained messages and inital notifications
        await Promise.all(
            [
                this.client.publishRetained(topics.DAB_VERSION_TOPIC, this.version()),
                this.client.publishRetained(topics.DEVICE_INFO_TOPIC, await this.deviceInfo()),
                this.notify("info", "DAB service is online")
            ]
        );

        return this.client;
    }

    /**
     * Cleanly shuts down the MQTT client, clearing retained messages for version and device info
     */
    async stop() {
        await Promise.all(
            [
                this.notify("info", "DAB service is shutting down"),
                this.client.clearRetained(topics.DEVICE_INFO_TOPIC),
                this.client.clearRetained(topics.DAB_VERSION_TOPIC)
            ]
        );

        return await this.client.stop();
    }

    /**
     * Publishes notifications to the message topic
     */
    async notify(level, message) {
        return await this.client.publish(topics.DAB_MESSAGES,
            {
                timestamp: +new Date(),
                level: level,
                message: message
            });
    }

    /**
     * Publish as retained message to version topic the major version and the minor
     * version delimited by a full stop character . Major and minor versions are
     * non-negative integers.
     * @returns {string[]}
     */
    version() {
        return [JSON.parse(readFileSync('./package.json', 'utf8')).version];
    }

    /**
     * @typedef {Object} DabResponse
     * @property {number} status - Response status code
     * @property {string} [error] - Error message if non 2XX response returned
     */
    dabResponse(status = 200, error) {
        const response = {status: status};
        if (Math.floor(status / 100) !== 2) {
            if (!error) throw new Error("Error message must be returned for non 2XX status results");
            response.error = error;
        }
        return response;
    }

    /**
     * `TelemetryCallback` is an async function which returns generated/collected telemetry.
     * @callback TelemetryCallback
     */

    /**
     * Device telemetry allows the connected clients to gather metrics about the device.
     * Once the telemetry is started the device will start publishing metrics to the assigned
     * telemetry delivery topic until requested to stop. This can be called from the impl of
     * startDeviceTelemetry(data) by forwarding data and passing in a callback function and
     * returning this result.
     * @param {Object} data - request object
     * @param {number} data.frequency - telemetry update frequency in milliseconds
     * @param {TelemetryCallback} cb - callback to generate/collect telemetry
     * @returns {Promise<DabResponse>}
     */
    async startDeviceTelemetryImpl(data, cb) {
        if (typeof cb !== "function")
            return this.dabResponse(400, "Device telemetry callback is not a function");

        if (typeof data.frequency !== "number" || !Number.isInteger(data.frequency))
            return this.dabResponse(400, "'frequency' must be set as number of milliseconds between updates");

        if (this.telemetry.device)
            return this.dabResponse(400, `Device telemetry is already started, stop it first`);

        await this.client.publish(topics.TELEMETRY_METRICS_TOPIC,
            await cb()
        );

        this.telemetry.device = setInterval(async () => {
            await this.client.publish(topics.TELEMETRY_METRICS_TOPIC,
                await cb()
            );
        }, data.frequency);
        return { ...this.dabResponse(), ...{frequency: data.frequency} };
    }

    /**
     * Stops publishing device telemetry. This can be called from the impl of
     * stopDeviceTelemetry().
     * @returns {Promise<DabResponse>}
     */
    stopDeviceTelemetryImpl = async () => {
        if (!this.telemetry.device) {
            return this.dabResponse(400, "Device telemetry not started");
        } else {
            clearInterval(this.telemetry.device);
            delete this.telemetry.device;
            return this.dabResponse();
        }
    }

    /**
     * Application telemetry allows the connected clients to gather metrics about a specific app.
     * Once the telemetry is started the application will start publishing metrics to the assigned
     * telemetry delivery topic until requested to stop. This can be called from the impl of
     * startAppTelemetry(data) by forwarding data and passing in a callback function and returning
     * this result.
     * @param {Object} data - request object
     * @param {string} data.appId - application id to start sending telemetry
     * @param {number} data.frequency - telemetry update frequency in milliseconds
     * @param {TelemetryCallback} cb - callback to generate/collect telemetry
     * @returns {Promise<DabResponse>}
     */
    async startAppTelemetryImpl(data, cb) {
        if (typeof cb !== "function") return this.dabResponse(400, "App telemetry callback is not a function");

        if (typeof data.appId !== "string")
            return this.dabResponse(400, "'appId' must be set as the application id to start sending telemetry");

        if (typeof data.frequency !== "number" || !Number.isInteger(data.frequency))
            return this.dabResponse(400, "'frequency' must be set as number of milliseconds between updates");

        if (this.telemetry[data.appId])
            return this.dabResponse(400, `App telemetry is already started for ${data.appId}, stop it first`);

        await this.client.publish(`${topics.TELEMETRY_METRICS_TOPIC}/${data.appId}`,
            await cb
        );

        this.telemetry[data.appId] = setInterval(async () => {
            await this.client.publish(`${topics.TELEMETRY_METRICS_TOPIC}/${data.appId}`,
                await cb
            );
        }, data.frequency);
        return { ...this.dabResponse(), ...{frequency: data.frequency} };
    }

    /**
     * Stops publishing app telemetry. This can be called from the impl of
     * stopAppTelemetry(data) by forwarding and returning this function.
     * @param {Object} data - request object
     * @param {string} data.appId - application id to stop sending telemetry
     * @returns {Promise<DabResponse>}
     */
    stopAppTelemetryImpl = async (data) => {
        if (typeof data.appId !== "string")
            return this.dabResponse(400, "'appId' must be set as the application id to stop sending telemetry");

        if (!this.telemetry[data.appId]) {
            return this.dabResponse(400, `Device telemetry for ${data.appId} not started`);
        } else {
            clearInterval(this.telemetry[data.appId]);
            delete this.telemetry[data.appId];
            return this.dabResponse();
        }
    }

    // TO BE IMPLEMENTED FOR DEVICE
    //-----------------------------
    /**
     * @typedef {Object} NetworkInterface
     * @property {boolean} connected - Is the interface currently connected
     * @property {string} macAddress - Interface's mac address
     * @property {string} ipAddress? - Interface's ip address, if applicable
     * @property {string} type - Type of interface 'ethernet' | 'wifi' | 'bluetooth' | 'other'
     */

    /**
     * @typedef {Object} DeviceInformation
     * @property {string} manufacturer - The device manufacturer
     * @property {string} model - The device model
     * @property {string} serialNumber - String used by the manufacturer to uniquely identify this device
     * @property {string} chipset - Device chipset
     * @property {string} firmwareVersion - Device OS or firmware version
     * @property {string} firmwareBuild - Device OS or firmware build number
     * @property {NetworkInterface[]} networkInterfaces - One or more network interfaces, indicating the type
     * @property {number} screenWidthPixels - Current screen resolution width measured in pixels
     * @property {number} screenHeightPixels - Current screen resolution height measured in pixels
     * @property {number} uptimeSince - The unix timestamp of when the device was last booted
     * @property {boolean} isRetail - Indicates whether the device is a retail device, or if it is in some other non-retail configuration
     */

    /**
     * Publishes a retained message to the device info topic
     * @abstract
     * @returns {Promise<DabResponse|DeviceInformation>}
     */
    async deviceInfo() {
        return {status: 501, error: "Device info not implemented"};
    }

    /**
     * @typedef {Object} Application
     * @property {string} appId - Application id
     * @property {string} [friendlyName] - Application friendly name
     * @property {string} [version] - Application version
     */

    /**
     * @typedef {Object} AppListResponse
     * @property {number} status - Response status code
     * @property {Array.<Application>} applications - Array of installed application details
     */

    /**
     * Lists all the installed applications on the device.
     * @abstract
     * @returns {Promise<DabResponse|AppListResponse>}
     */
    async listApps() {
        return {status: 501, error: "List apps not implemented"};
    }

    /**
     * Launches an application.
     * @abstract
     * @param {Object} data - request object
     * @param {string} data.appId - application id to launch
     * @param {string []} [data.parameters] - parameters to pass to application
     * @returns {Promise<DabResponse>}
     */
    async launchApp(data) {
        return {status: 501, error: "Launch app not implemented"};
    }

    /**
     * Launches an application to a content deep link.
     * @abstract
     * @param {Object} data - request object
     * @param {string} data.appId - application id to launch
     * @param {string} data.contentId - content id to launch
     * @param {string []} [data.parameters] - parameters to pass to application
     * @returns {Promise<DabResponse>}
     */
    async launchAppContent(data) {
        return {status: 501, error: "Launch app content not implemented"};
    }

    /**
     * Exits the application. If the optional force parameter is set and attempt is made
     * to force stop the application. If the force parameter is omitted or set to false
     * then the OS may decide which state to put the application into (background,
     * suspended, quit, etc.).
     * @abstract
     * @param {Object} data - request object
     * @param {string} data.appId - application id to exit
     * @param {boolean} [data.force] - force exit, default to false
     * @returns {Promise<DabResponse>}
     */
    async exitApp(data) {
        return {status: 501, error: "Exit app not implemented"};
    }

    /**
     * @typedef {Object} ApplicationState
     * @property {string} appId - Application id
     * @property {string} state - Application state [STOPPED | BACKGROUND | FOREGROUND]
     */

    /**
     * Queries the application state
     * @abstract
     * @param {Object} data - request object
     * @param {string} data.appId - application id
     * @returns {Promise<DabResponse|ApplicationState>}
     */
    async getAppState(data) {
        return {status: 501, error: "App state not implemented"};
    }

    /**
     * Request to restart the device.
     * @abstract
     * @returns {Promise<DabResponse>}
     */
    async restartDevice() {
        return {status: 501, error: "Restart not implemented"};
    }

    /**
     * Key press is an action that can be associated with the key press on the remote control.
     * A key code represents button name / function name typically found on the remote control device.
     * @abstract
     * @param {Object} data - request object
     * @param {string} data.keyCode - string literal, prefixed with KEY_ or KEY_CUSTOM_ per spec
     * @returns {Promise<DabResponse>}
     */
    async keyPress(data) {
        return {status: 501, error: "Key press not implemented"};
    }

    /**
     * Long key press is an action that can be associated with an extended key press on the remote control.
     * A key code represents button name / function name typically found on the remote control device.
     * @abstract
     * @param {Object} data - request object
     * @param {string} data.keyCode - string literal, prefixed with KEY_ or KEY_CUSTOM_ per spec
     * @param {number} [data.durationMs] - delay between key down and up events
     * @returns {Promise<DabResponse>}
     */
    async keyPressLong(data) {
        return {status: 501, error: "Long key press not implemented"};
    }

    /**
     * Set the current device's system language.
     * @abstract
     * @param {Object} data - request object
     * @param {string} data.language - rcf_5646_language_tag
     * @returns {Promise<DabResponse>}
     */
    async setSystemLanguage(data) {
        return {status: 501, error: "Set system language not implemented"};
    }

    /**
     * @typedef {Object} GetSystemLanguageResponse
     * @property {number} status - Response status code
     * @property {string} [language] - rcf_5646_language_tag
     */

    /**
     * Get the current device's system language.
     * @abstract
     * @returns {Promise<DabResponse|GetSystemLanguageResponse>}
     */
    async getSystemLanguage() {
        return {status: 501, error: "Get system language not implemented"};
    }

    /**
     * @typedef {Object} ListSystemLanguagesResponse
     * @property {number} status - Response status code
     * @property {string []} [languages] - rcf_5646_language_tag []
     */

    /**
     * List the device's available system languages.
     * @abstract
     * @returns {Promise<DabResponse|ListSystemLanguagesResponse>}
     */
    async listSystemLanguages() {
        return {status: 501, error: "List system languages not implemented"};
    }

    /**
     * Device telemetry allows the connected clients to gather metrics about the device.
     * Once the telemetry is started the device will start publishing metrics to the assigned
     * telemetry delivery topic until requested to stop. Can delegate to default impl by simply
     * "return await this._startDeviceTelemetry(data, cb)" - see _startDeviceTelemetry for details.
     * @abstract
     * @param {Object} data - request object
     * @param {number} data.frequency - telemetry update frequency in milliseconds
     * @returns {Promise<DabResponse>}
     */
    async startDeviceTelemetry(data) {
        return {status: 501, error: "Device telemetry not implemented"};
    }

    /**
     * Stops publishing device telemetry. Can delegate to default impl by simply
     * "return await this._stopDeviceTelemetry();"
     * @abstract
     * @returns {Promise<DabResponse>}
     */
    async stopDeviceTelemetry() {
        return {status: 501, error: "Device telemetry not implemented"};
    }

    /**
     * Application telemetry allows the connected clients to gather metrics about a specific app.
     * Once the telemetry is started the application will start publishing metrics to the assigned
     * telemetry delivery topic until requested to stop. Can delegate to default impl by simply
     * "return await this._startAppTelemetry(data, cb)" - see _startAppTelemetry for details.
     * @abstract
     * @param {Object} data - request object
     * @param {string} data.appId - application id to start sending telemetry
     * @param {number} data.frequency - telemetry update frequency in milliseconds
     * @returns {Promise<DabResponse>}
     */
    async startAppTelemetry(data) {
        return {status: 501, error: "App telemetry not implemented"};
    }

    /**
     * Stops publishing app telemetry. Can delegate to default impl by simply
     * "return await this._stopAppTelemetry(data);"
     * @abstract
     * @param {Object} data - request object
     * @param {string} data.appId - application id to start sending telemetry
     * @returns {Promise<DabResponse>}
     */
    async stopAppTelemetry(data) {
        return {status: 501, error: "App telemetry not implemented"};
    }

    /**
     * @typedef {Object} HealthCheckResponse
     * @property {number} status - Response status code
     * @property {boolean} healthy - True if everything is functioning normally
     */

    /**
     * Returns the health status
     * @abstract
     * @returns {Promise<DabResponse|HealthCheckResponse>}
     */
    async healthCheck() {
        return {status: 501, error: "Health check not implemented"};
    }
}