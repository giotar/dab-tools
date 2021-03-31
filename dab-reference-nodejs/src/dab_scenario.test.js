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

import { MqttClient } from './mqtt_client/index.js';
import { DabClient } from './dab_client.js';
import { DabDevice } from './test_dab_device.js';
import { sleep } from "./util.js";

let sim_device;

// DAB Client making requests to DAB server
const client = new MqttClient();
await client.init('mqtt://localhost');
const dab_client = new DabClient(client);

// Print to console any messages published from the device's DAB implementation
await dab_client.showMessages();

// Set to false to disable the simulated device and use your own DAB implementation
if (true) {
    sim_device = new DabDevice();
    await sim_device.init('mqtt://localhost');
}

try {
    const version = await dab_client.version();
    console.log(`DAB Version: ${JSON.stringify(version)}\n`);

    const deviceInfo = await dab_client.deviceInfo();
    console.log(`Device Info: ${JSON.stringify(deviceInfo, null, 2)}\n`);

    const health_response = await dab_client.healthCheck();
    console.log(`Health Check: ${JSON.stringify(health_response)}\n`);

    const startTelemetry = await dab_client.startDeviceTelemetry(100);
    console.log(`Start telemetry: ${JSON.stringify(startTelemetry)}\n`);

    await dab_client.showDeviceTelemetry();

    await sleep(1000);

    await dab_client.hideDeviceTelemetry();

    const stopTelemetry = await dab_client.stopDeviceTelemetry();
    console.log(`Stop telemetry: ${JSON.stringify(stopTelemetry)}\n`);

    let list_apps_response = await dab_client.listApps();
    console.log(`list apps: ${JSON.stringify(list_apps_response, null, 2)}\n`);
    let apps = list_apps_response.applications;
    for (let app of apps){
        const launch_response = await dab_client.launchApp(app.appId);
        console.log(`launch app: ${app.friendlyName}, response: ${JSON.stringify(launch_response)}\n`);

        let state_response = await dab_client.getAppState(app.appId);
        console.log(`app state: ${app.friendlyName}, response: ${JSON.stringify(state_response)}\n`);

        try {
            const key_response = await dab_client.pressKey('Enter');
            console.log(`press app: ${app.friendlyName}, response: ${JSON.stringify(key_response)}\n`);
        } catch (e) {
            console.error(e);
        }
        const exit_response = await dab_client.exitApp(app.appId, true);
        console.log(`exit app: ${app.friendlyName}, response: ${JSON.stringify(exit_response)}\n`);

        state_response = await dab_client.getAppState(app.appId);
        console.log(`app state: ${app.friendlyName}, response: ${JSON.stringify(state_response)}\n`);
    }

} catch (e) {
    console.log(e);
}
finally{
    if (sim_device) {
        try {
            await sim_device.stop();
        }
        catch (e) {}

        try {
            console.log("Health check will now timeout now since sim_device is stopped...");
            await dab_client.healthCheck();
        }
        catch (e) {
            console.log(e);
        }
    }

    try {
        await client.stop();
    }
    catch (e) {}
}
