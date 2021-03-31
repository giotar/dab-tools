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

import config from 'config';
import * as APP_STATUS from './app_status.js';
import { KEY_CODES } from './roku/roku_keymap.js';
import { DabDeviceInterface } from './dab/dab_device_interface.js';
import { RokuCommands } from './roku/roku_commands.js';
import { getLogger, sleep } from "./util.js";
const logger = getLogger();

export class DabDevice extends DabDeviceInterface {

    constructor(ipAddress){
        super();
        this.ipAddress = ipAddress;
        this.roku = new RokuCommands(ipAddress);
        this.dialNameMap = config.get("dialNameMap");
        this.appMap = {};
    }

    deviceInfo = async () => {
        const data = await this.roku.getDeviceInfo();
        const deviceInfo = { ...{
            manufacturer: data["device-info"]["vendor-name"],
            model: data["device-info"]["model-name"],
            serialNumber: data["device-info"]["serial-number"],
            firmwareVersion: data["device-info"]["software-version"],
            firmwareBuild: data["device-info"]["build-number"],
            networkInterfaces: {
                connected: true,
                macAddress: data["device-info"][`${data["device-info"]["network-type"]}-mac`],
                ipAddress: this.ipAddress,
                type: data["device-info"]["network-type"],
            },
            screenWidthPixels: data["device-info"]["ui-resolution"],
            isRetail: (data["device-info"]["developer-enabled"] === 'false')
        }, ...data["device-info"] };
        logger.debug(JSON.stringify(deviceInfo));
        return deviceInfo;
    }

    listApps = async () => {
        try {
            const rokuJson = await this.roku.listApps();
            rokuJson.apps.app.forEach((appObj) => {
                if (appObj._attr.type !== "appl") return;
                const friendlyName = appObj["#text"];
                let appId = friendlyName.toLowerCase();
                const dialName = this.dialNameMap[appId];
                if (dialName) appId = dialName.toLowerCase();
                this.appMap[appId] = {
                    id: appId,
                    friendlyName: friendlyName,
                    version: appObj._attr.version,
                    channelId: appObj._attr.id,
                    dialName: dialName
                }
            });
            logger.debug(`Created appMap: ${JSON.stringify(this.appMap)}`);

            return { ...this.dabResponse(), ...{apps: Object.values(this.appMap)} };
        } catch (e) {
            logger.error(e);
            return this.dabResponse(500, e.message);
        }
    }

    launchApp = async (data) => {
        if (typeof data.appId !== "string")
            return this.dabResponse(400, "'appId' must be set as the application id to launch");

        data.appId = data.appId.toLowerCase();
        if (!this.appMap[data.appId])
            return this.dabResponse(404, `Couldn't find data app ${data.appId}`);

        try {
            const status = await this.roku.start(this.appMap[data.appId].channelId);
            if (status === 200) {
                return this.dabResponse();
            } else {
                return this.dabResponse(status, `Failed to launch ${data.appId}`)
            }
        } catch (e) {
            logger.error(e);
            return this.dabResponse(500, e.message);
        }
    }

    launchAppContent = async (data) => {
        if (typeof data.appId !== "string")
            return this.dabResponse(400, "'appId' must be set as the application id to launch");

        if (typeof data.contentId !== "string")
            return this.dabResponse(400, "'contentId' must be set as the content to play");

        data.appId = data.appId.toLowerCase();
        if (!this.appMap[data.appId])
            return this.dabResponse(404, `Couldn't find data app ${data.appId}`);

        try {
            const status = await this.roku.launchAppContent(this.appMap[data.appId].channelId, data.contentId, data.parameters);
            if (status === 200) {
                return this.dabResponse();
            } else {
                return this.dabResponse(status, `Failed to launch ${data.appId}`)
            }
        } catch (e) {
            logger.error(e);
            return this.dabResponse(500, e.message);
        }
    }

    exitApp = async (data) => {
        if (typeof data.appId !== "string")
            return this.dabResponse(400, "'app' must be set as the application id to exit");

        data.appId = data.appId.toLowerCase();
        if (!this.appMap[data.appId])
            return this.dabResponse(404, `Couldn't find data app ${data.appId}`);

        if (!this.appMap[data.appId].dialName)
            return this.dabResponse(500, `Unable to stop ${data.appId}, failed to lookup DIAL name for app`);

        try {
            const status = await this.roku.stop(this.appMap[data.appId].dialName);
            if (status === 200) {
                return this.dabResponse();
            } else {
                return this.dabResponse(status, `Failed to stop ${data.appId}`)
            }
        } catch (e) {
            return this.dabResponse(500, e.message);
        }
    }

    getAppState = async (data) => {
        try {
            const statusJson = await this.roku.status();
            if (!data || !data.appId) {
                if (!statusJson.player.plugin) {
                    return {...this.dabResponse(), ...{appId: "home screen", state: APP_STATUS.FOREGROUND} };
                } else {
                    const channelId = statusJson.player.plugin._attr.id;
                    logger.info(`channelId ${channelId} is running`);
                    let appId;
                    for (let appObj of Object.values(this.appMap)) {
                        if (appObj.channelId === channelId) {
                            appId = appObj.id;
                            logger.info(`appId ${appId} is running`);
                            break;
                        }
                    }
                    return {...this.dabResponse(), ...{appId: appId, state: APP_STATUS.FOREGROUND} };
                }
            } else {
                if (!statusJson.player.plugin) {
                    return {...this.dabResponse(), ...{appId: data.appId, state: APP_STATUS.STOPPED} };
                } else if (this.appMap[data.appId].channelId === statusJson.player.plugin._attr.id) {
                    return {...this.dabResponse(), ...{appId: data.appId, state: APP_STATUS.FOREGROUND} };
                } else {
                    return {...this.dabResponse(), ...{appId: data.appId, state: APP_STATUS.STOPPED} };
                }
            }
        } catch (e) {
            logger.error(e);
            return this.dabResponse(500, e.message);
        }
    }

    keyPress = async (data) => {
        if (typeof data.keyCode !== "string")
            return this.dabResponse(400, "'keyCode' must be set");

        if (!KEY_CODES[data.keyCode])
            return this.dabResponse(400, `${data.keyCode} is not supported on this device`);

        try {
            const status = await this.roku.keyPress(KEY_CODES[data.keyCode]);
            if (status === 200) {
                return this.dabResponse();
            } else {
                return this.dabResponse(status, `Failed to press key ${data.keyCode}`)
            }
        } catch (e) {
            if (e.message.startsWith("Unrecognized keyCode")){
                return this.dabResponse(400, e.message);
            }
            return this.dabResponse(500, e.message);
        }
    }

    keyPressLong = async (data) => {
        if (typeof data.keyCode !== "string")
            return this.dabResponse(400, "'keyCode' must be set");

        if (!KEY_CODES[data.keyCode])
            return this.dabResponse(400, `${data.keyCode} is not supported on this device`);

        if (data.durationMs && typeof data.durationMs !== "number" || data.durationMs < 0) {
            return this.dabResponse(400, "'durationMs' must be a positive number");
        } else if (!data.durationMs) data.durationMs = 5;

        try {
            const status = await this.roku.keyPressLong(KEY_CODES[data.keyCode], data.durationMs);
            if (status === 200) {
                return this.dabResponse();
            } else {
                return this.dabResponse(status, `Failed to long press key ${data.keyCode}`)
            }
        } catch (e) {
            if (e.message.startsWith("Unrecognized keyCode")){
                return this.dabResponse(400, e.message);
            }
            return this.dabResponse(500, e.message);
        }
    }

    restartDevice = async () => {
        //Make sure we are really at the home screen to start
        let atHomeScreen = false;
        do {
            let state = await this.getAppState();
            logger.info(`polled state: ${JSON.stringify(state)}`);
            atHomeScreen = state.appId === "home screen";
            if (!atHomeScreen) {
                await this.roku.keyPress("home");
                await sleep(1000);
            }
        } while (!atHomeScreen);

        logger.info(`Starting restart sequence`);
        const restartSequence = ["home", "home", "home", "up", "right", "up", "right", "up", "up", "up", "up", "right", "select"];
        for (let keyName of restartSequence) {
            await sleep(200);
            await this.roku.keyPress(keyName);
            // const response = await this.roku.keyPress(keyName);
            //     if (response !== 200) return this.dabResponse(response, `Failed to restart device`);
        }
        return this.dabResponse();
    }

    healthCheck = async () => {
        try {
            const deviceInfo = await this.roku.getDeviceInfo();
            return { ...this.dabResponse(), ...{healthy: typeof (deviceInfo) === "object" } };
        } catch (err) {
            return { ...this.dabResponse(), ...{healthy: false } };
        }
    }
}