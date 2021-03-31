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

import { DabDeviceInterface } from './dab_device_interface.js';

export class DabDevice extends DabDeviceInterface {

    #bootTime;
    #fakeAppState = {
        "netflix": this.appState.stopped,
        "amazoninstantvideo": this.appState.stopped,
        "youtube": this.appState.stopped
    }

    #launchAndBackgroundOthers = (appId) => {
        Object.keys(this.#fakeAppState).forEach(app => {
            if (app !== appId && this.#fakeAppState[app] === this.appState.foreground) {
                this.#fakeAppState[app] = this.appState.background;
            }
        });
        this.#fakeAppState[appId] = this.appState.foreground;
    }

    constructor() {
        super();
        this.#bootTime = Date.now();
    }

    deviceInfo = async () => {
        return {
            manufacturer: "DAB Test",
            model: "NodeApp",
            serialNumber: "001",
            chipset: "N/A",
            firmwareVersion: "N/A",
            firmwareBuild: "N/A",
            networkInterfaces: {
                connected: true,
                macAddress: "00:00:00:00:00:00",
                ipAddress: "0.0.0.0",
                type: "ethernet"
            },
            screenWidthPixels: 640,
            screenHeightPixels: 480,
            uptimeSince: this.#bootTime,
            isRetail: true
        };
    }

    listApps = async () => {
        const appsArr = [
            {
                appId: "netflix",
                friendlyName: "Netflix",
                version: "2.0.0"
            },
            {
                appId: "amazoninstantvideo",
                friendlyName: "Amazon Prime Video",
                version: "2.0.0"
            },
            {
                appId: "youtube",
                friendlyName: "YouTube",
                version: "2.0.0"
            }
        ];

        return { ...this.dabResponse(), ...{applications: appsArr} };
    }

    launchApp = async (data) => {
        console.log(`Received launch application request: ${JSON.stringify(data)}`);
        if (this.#fakeAppState[data.appId]) {
            this.#launchAndBackgroundOthers(data.appId);
            return this.dabResponse();
        } else {
            return this.dabResponse(400, `Unable to find application with appId ${data.appId}`)
        }
    }

    launchAppContent = async (data) => {
        console.log(`Received launch application to content request: ${JSON.stringify(data)}`);
        if (this.#fakeAppState[data.appId]) {
            this.#launchAndBackgroundOthers(data.appId);
            return this.dabResponse();
        } else {
            return this.dabResponse(400, `Unable to find application with appId ${data.appId}`)
        }
    }

    exitApp = async (data) => {
        console.log(`Received exit application request: ${JSON.stringify(data)}`);
        if (this.#fakeAppState[data.appId]) {
            this.#fakeAppState[data.appId] = this.appState.stopped;
            return this.dabResponse();
        } else {
            return this.dabResponse(400, `Unable to find application with appId ${data.appId}`)
        }
    }

    getAppState = async (data) => {
        console.log(`Received application state request: ${JSON.stringify(data)}`);
        if (this.#fakeAppState[data.appId]) {
            return {...this.dabResponse(), ...{appId: data.appId, state: this.#fakeAppState[data.appId]} };
        } else {
            return this.dabResponse(400, `Unable to find application with appId ${data.appId}`)
        }
    }

    startDeviceTelemetry = async (data) =>{
        return await this.startDeviceTelemetryImpl(data, () => {
            const metrics = ["cpu", "memory", "frames-dropped", "frames-decoded"];
            return {
                timestamp: Date.now(),
                metric: metrics[Math.floor(Math.random() * Math.floor(4))],
                value: Math.floor(Math.floor(Math.random() * Math.floor(101)))
            }
        });
    }

    stopDeviceTelemetry = async () =>{
        return await this.stopDeviceTelemetryImpl();
    }

    healthCheck = async () => {
        return { ...this.dabResponse(), ...{healthy: true} };
    }
}