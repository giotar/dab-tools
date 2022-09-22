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
import {AndroidKeyCode, DabKey, DabKeysToAndroidKeyCodes} from './adb_keymap.js';
import {Output, spawn} from 'promisify-child-process';
import { getLogger, sleep } from "../util.js";
import {AndroidApplicationStatus} from "./app_status";
const logger = getLogger();

process.on("unhandledRejection", (reason, p) => {
    logger.debug("Unhandled Rejection at: Promise ", p, " reason: ", reason);
});

interface Device {
    id: string,
    state: string,
    connection?: string,
    ip?: string | string[],
    mac?: string | string[],
    networkType: NetworkInterfaceType,
    serial?: string,
    resolution: {
        x?: number,
        y?: number
    },
    message?: string,
    properties?: Record<string, any>,
    useStatus2?: boolean,
}
export enum NetworkInterfaceType {
    Wifi = "wifi",
    Ethernet = "ethernet",
    Other = "other",
    Unknown = "unknown"
}

export class AdbCommands {
    private static readonly VALID_IP_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(:\d+)?$/
    private readonly adb: string;
    private readonly device: Device;
    constructor(deviceId: string) {
        //Latest Linux ADB app is downloaded from https://developer.android.com/studio/releases/platform-tools.html
        this.adb = config.get("adb.binary");

        this.device = {
            id: deviceId,
            state: "unreachable",
            connection: undefined,
            ip: undefined,
            mac: undefined,
            networkType: NetworkInterfaceType.Unknown,
            serial: undefined,
            resolution: {
                x: undefined,
                y: undefined
            },
            message: "ADB debugging is not available"
        };
        if (AdbCommands.VALID_IP_REGEX.test(this.device.id)) {
            if (this.device.id.includes(":")) {
                this.device.ip = this.device.id.substring(0, this.device.id.indexOf(":"));
            } else {
                this.device.ip = this.device.id;
                this.device.id = `${this.device.ip}:5555`;
            }
            this.device.connection = "tcp";
        } else {
            this.device.serial = this.device.id;
            this.device.connection = "usb";
        }
    }

    public async init(): Promise<void> {
        await this.devices();
        if (this.device.connection === "tcp") await this.connect();
    }

    public async getDeviceDetails(): Promise<Device> {
        await this.init();
        return this.device;
    }

    public async killServer() {
        logger.info("Terminating ADB Server");
        await spawn(this.adb, ["kill-server"]);
        return { message: `Killed adb at ${config.get("adb.binary")}` };
    }

    public async disconnect(): Promise<void> {
        logger.info(`Disconnecting: ${this.device.ip}`);
        await spawn(this.adb, ["disconnect", this.device.id], {
            encoding: "utf8",
        });
    }

    private async connect(): Promise<void> {
        if (!AdbCommands.VALID_IP_REGEX.test(this.device.id)) {
            throw new Error(`ADB connect request appears to be an invalid address: ${this.device.id}`);
        }

        logger.info(`Trying to TCP connect to ${this.device.id}`);
        const spawnOutput = await spawn(this.adb, ["connect", this.device.id], {
            encoding: "utf8",
        });
        if (!this.isProcessOutputPresent(spawnOutput)) {
            throw new Error("Spawned ADB process but could not read stdout/stderr");
        }
        const { stdout, stderr } = spawnOutput;
        if (stderr.toString() !== "") {
            throw new Error("ADB connect output to stderr: " + stderr.toString());
        }

        let output = stdout
            .toString()
            .trim()
            .replace(/\r?\n|\r/, "");

        if (new RegExp("connected to " + this.device.ip).test(output)) {
            //Gives a device a chance to get its status right, before giving up
            for (let i = 0; i < 2; i++) {
                await this.devices();
                if (this.device.state === "ready") {
                    logger.info(`ADB connected: ${this.device.id}`);
                    return;
                }
                await sleep(1000);
            }
            logger.info(
                `ADB connected to ${this.device.id} but device not ready: ${JSON.stringify(this.device)}`
            );
        } else if (new RegExp("unable to connect").test(output)
            || new RegExp("failed to connect").test(output)
            || new RegExp("Connection refused").test(output)) {
            logger.info(`ADB unable to connect: ${this.device.id}`);
            throw new Error("ADB debugging is disabled or it is not an Android device");
        } else {
            logger.error(`Unrecognized command output: ${output}`);
            throw new Error(`Unrecognized command output connecting: ${output}`);
        }
    }

    private async devices(): Promise<void> {
        let foundDevice = false;
        try {
            const output = await spawn(this.adb, ["devices", "-l"], { encoding: "utf8" });
            if (!this.isProcessOutputPresent(output)) {
                throw new Error("Spawned ADB process but could not read stdout/stderr");
            }
            const { stdout, stderr } = output;
            if (stderr.toString() !== "") {
                throw new Error(`adb devices output to stderr: ${stderr.toString()}`);
            }

            let outputArr = stdout.toString().split("\n");
            let promises = outputArr.map(async (line) => {
                //If the line is static output, ignore it
                if (new RegExp(/List of devices attached/).test(line)) return;

                //If this isn't the device we're interested in, ignore it
                if (!new RegExp(this.device.id).test(line)) return;

                foundDevice = true;

                line = line
                    .trim()
                    .replace(/\s+/, " ")
                    .replace(/\r?\n|\r/, "");

                let columns = line.split(" ");

                if (columns.length < 1) return;

                if (columns.length >= 2) {
                    this.device.state = columns[1];
                    switch (this.device.state) {
                        case "device":
                            this.device.state = "ready";
                            this.device.message = undefined;
                            this.device.properties = await this.getDeviceProps();
                            if (!this.device.serial) {
                                this.device.serial = this.device.properties["ro.boot.serialno"];
                            }
                            if (!Array.isArray(this.device.ip) && this.device.ip && this.device.id.startsWith(this.device.ip)) {
                                this.device.networkType = await this.getNetworkType();
                            } else {
                                this.device.networkType = NetworkInterfaceType.Other;
                            }
                            if (!this.device.ip) {
                                try {
                                    const ipArr = await this.getDeviceIpsFromSerial();
                                    if (ipArr.length === 1) {
                                        this.device.ip = ipArr[0];
                                    } else {
                                        this.device.ip = ipArr;
                                    }
                                } catch (e) {}
                            }
                            if (this.device.ip && !this.device.mac) {
                                if (Array.isArray(this.device.ip)) {
                                    const macArr = [];
                                    for (const ipAddress of this.device.ip) {
                                        macArr.push(await this.getDeviceMacFromIp(ipAddress));
                                    }
                                    this.device.mac = macArr;
                                } else {
                                    this.device.mac = await this.getDeviceMacFromIp(this.device.ip);
                                }
                            }
                            if (this.device.properties["vendor.display-size"]) {
                                const resolutionArr = this.device.properties["vendor.display-size"].split("x");
                                this.device.resolution.x = Number.parseInt(resolutionArr[0]);
                                this.device.resolution.y = Number.parseInt(resolutionArr[1]);
                            }
                            break;
                        case "authorizing":
                            this.device.message = "Connection is being authorized";
                            break;
                        case "unauthorized":
                            this.device.message = "Please grant ADB debug permission on the device";
                            break;
                        case "offline":
                            this.device.message =
                                "ADB reports offline, try toggling ADB debugging on/off, revoking ADB permissions or power cycling the device";
                            break;
                        default:
                            logger.warn(`ADB devices reported unhandled state: ${this.device.state}`);
                    }
                }
            });

            await Promise.all(promises);
            if (!foundDevice) {
                this.device.state = "unknown";
                this.device.message = "Device details are currently unavailable";
            }
        } catch (err) {
            logger.error(err, "An exception occurred getting adb devices details");
            throw err;
        }
    }

    private async getDeviceProps(): Promise<Record<string, unknown>> {
        logger.info(`Getting device properties for ${this.device.id}`);
        try {
            const output = await spawn(
                this.adb,
                ["-s", this.device.id, "shell", "getprop"],
                { encoding: "utf8" }
            );
            if (!this.isProcessOutputPresent(output)) {
                throw new Error("Spawned ADB process but could not read stdout/stderr");
            }
            const { stdout, stderr } = output;
            if (stderr.toString() !== "") {
                throw new Error(`getDeviceProps output to stderr: ${stderr.toString()}`);
            }
            const outputArr = stdout
                .toString()
                .replace(/\r?\n|\r/g, "%%") // replace newlines with '%%' to fix multi-line properties
                .replace(/]%%\[/g, "]\n[") // re-add newline between different properties
                .split("\n");
            const propObj: Record<string, unknown> = {};
            for (let line of outputArr) {
                line = line.trim().replace(/\s+/, " ").replace(/\r?\n|\r/, "");
                if (line.length === 0) continue;
                const match = line.match(/\[(.*)]:\s\[(.*)]/);
                if (match && match.length >= 3) {
                    propObj[match[1]] = match[2];
                }
            }
            return propObj;
        } catch (err) {
            logger.error(
                `An exception occurred determining device properties for ${this.device.id}: ${err.message}`
            );
            throw err;
        }
    }

    public async getDeviceUptimeSeconds(): Promise<number> {
        logger.info(`Getting device uptime for ${this.device.id}`);
        try {
            const output = await spawn(
                this.adb,
                ["-s", this.device.id, "shell", "cat", "/proc/uptime"],
                { encoding: "utf8" }
            );
            if (!this.isProcessOutputPresent(output)) {
                throw new Error("Spawned ADB process but could not read stdout/stderr");
            }
            const { stdout, stderr } = output;
            if (stderr.toString() !== "") {
                throw new Error(`getDeviceUptimeSeconds output to stderr: ${stderr.toString()}`);
            }

            return Number.parseFloat(stdout.toString().substring(0, stdout.indexOf(" ")));
        } catch (err) {
            logger.error(
                `An exception occurred getting device uptime for ${this.device.id}: ${err.message}`
            );
            throw err;
        }
    }

    private async getNetworkType(): Promise<NetworkInterfaceType> {
        logger.info(`Getting device active NIC type for ${this.device.id}`);
        try {
            const output = await spawn(
                this.adb,
                ["-s", this.device.id, "shell", "ip", "addr"],
                { encoding: "utf8" }
            );
            if (!this.isProcessOutputPresent(output)) {
                throw new Error("Spawned ADB process but could not read stdout/stderr");
            }
            const { stdout, stderr } = output;
            if (stderr.toString() !== "") {
                throw new Error(`getActiveNicType output to stderr: ${stderr.toString()}`);
            }
            let outputArr = stdout.toString().split("\n");
            for (let line of outputArr) {
                if (/wlan.*state UP/.test(line) ) {
                    return NetworkInterfaceType.Wifi;
                } else if (/eth.*state UP/.test(line) ) {
                    return NetworkInterfaceType.Ethernet;
                }
            }
            return NetworkInterfaceType.Unknown;
        } catch (err) {
            logger.error(
                `An exception occurred determining device active NIC type for ${this.device.id}: ${err.message}`
            );
            throw err;
        }
    }

    private async getDeviceIpsFromSerial(): Promise<string[]> {
        logger.info(`Getting IPs for ${this.device.serial}`);
        try {
            const output = await spawn(this.adb, ["-s", this.device.id, "shell", "ifconfig"], {
                encoding: "utf8",
            });
            if (!this.isProcessOutputPresent(output)) {
                throw new Error("Spawned ADB process but could not read stdout/stderr");
            }
            const { stdout, stderr } = output;
            if (stderr.toString() !== "") {
                throw new Error(`getDeviceIpFromSerial output to stderr: ${stderr.toString()}`);
            }
            const ipRegex = /addr:(\b(?:\d{1,3}\.){3}\d{1,3}\b)/g;
            let matches: RegExpExecArray | null
            let addresses: string[] = [];
            while (matches = ipRegex.exec(stdout.toString())) {
                if (matches[1] !== "127.0.0.1") addresses.push(matches[1]);
            }
            return addresses;
        } catch (err) {
            logger.error(`An exception occurred getting device IPs for ${this.device.serial}`);
            throw err;
        }
    }

    private async getDeviceMacFromIp(ipAddress: string): Promise<string> {
        logger.info(`Getting MAC for ${ipAddress}`);
        try {
            const output: Output = await spawn(this.adb, ["-s", this.device.id, "shell", "ip", "address"], {
                encoding: "utf8",
            });
            if (!this.isProcessOutputPresent(output)) {
                throw new Error("Spawned ADB process but could not read stdout/stderr");
            }
            const { stdout, stderr } = output;
            if (stderr.toString() !== "") {
                throw new Error(`getDeviceMacFromIp output to stderr: ${stderr.toString()}`);
            }
            const interfaceRegex = /^\d+: ((?:(?!^\d).)*)/gms;
            let matches: RegExpExecArray | null;
            while (matches = interfaceRegex.exec(stdout.toString())) {
                //Only looking for MAC of the specified IP
                if (!matches[1].includes(ipAddress)) continue;

                //Extract the MACs
                let macAddress = matches[1].match(/\s([a-fA-F0-9:]{17}|[a-fA-F0-9]{12})\s\w+/);
                if (!macAddress || macAddress.length < 2) {
                    throw new Error(`Could not extract mac address for ${ipAddress}`);
                }
                return macAddress[1];
            }
            throw new Error(`Could not find mac address for ${ipAddress}`);
        } catch (err) {
            logger.error(err, `An exception occurred getting MAC for ${ipAddress}`);
            throw err;
        }
    }

    public async getPackages(): Promise<string[]> {
        logger.info(`Retrieve package list on ${this.device.id}`);
        const output = await spawn(
            this.adb,
            ["-s", this.device.id, "shell", "pm", "list", "packages"],
            { encoding: "utf8" }
        );
        if (!this.isProcessOutputPresent(output)) {
            throw new Error("Spawned ADB process but could not read stdout/stderr");
        }
        const { stdout, stderr } = output;

        if (stderr.toString() !== "") {
            throw new Error(`ADB list packages output to stderr: ${stderr.toString()}`);
        }

        return stdout
            .toString()
            .trim()
            .replace(/package:/g, "")
            .replace(/\r?\n|\r/, "")
            .split("\n");
    }

    public async start(intentArr: string[]): Promise<void> {
        if (!intentArr) throw new Error("Intent to start was not specified");

        let startArgs = [ ...["-s", this.device.id, "shell", "am", "start"], ...intentArr ];

        logger.info(`Starting intent on ${this.device.id} w/ args: ${startArgs}`);
        const spawnOutput = await spawn(this.adb, startArgs, { encoding: "utf8" });
        if (!this.isProcessOutputPresent(spawnOutput)) {
            throw new Error("Spawned ADB process but could not read stdout/stderr");
        }
        const { stdout, stderr } = spawnOutput;

        if (stderr.toString() !== "") {
            //Catching the warning here due to app is already running condition
            //What is printed on stderr is different in Android P, the second condition matches it
            if (
                new RegExp("current task has been brought to the front").test(stderr.toString()) ||
                new RegExp("intent has been delivered to currently running top-most instance").test(
                    stderr.toString()
                )
            ) {
                logger.warn(`ADB start resumed current instance with message: ${stderr.toString()}`);
                return;
            } else {
                throw new Error(`ADB start output to stderr: ${stderr.toString()}`);
            }
        }

        let output = stdout
            .toString()
            .trim()
            .replace(/\r?\n|\r/, "");

        if (!new RegExp("Starting: Intent { ").test(output)) {
            throw new Error(`Failed to start ${intentArr} on ${this.device.id}: ${stdout}`);
        }
    }

    public async stop(appPackage: string): Promise<void> {
         if (appPackage.trim() === "") {
            throw new Error("App package to stop was not specified");
        }

        logger.debug(`Stopping ${appPackage} on ${this.device.id}`);
        const spawnOutput = await spawn(
            this.adb,
            ["-s", this.device.id, "shell", "am", "force-stop", appPackage],
            { encoding: "utf8" }
        );
        if (!this.isProcessOutputPresent(spawnOutput)) {
            throw new Error("Spawned ADB process but could not read stdout/stderr");
        }
        const { stdout, stderr } = spawnOutput;

        if (stderr.toString() !== "") {
            throw new Error(`ADB stop output to stderr: ${stderr.toString()}`);
        }

        let output = stdout
            .toString()
            .trim()
            .replace(/\r?\n|\r/, "");

        if (new RegExp(appPackage).test(output)) {
            throw new Error(`Failed to stop ${appPackage} on ${this.device.id}`);
        }
    }

    public async backgroundApp(appPackage: string): Promise<void> {
        logger.debug(`Backgrounding current app on ${this.device.id}`);
        const {stderr } = await spawn(
            this.adb,
            ["-s", this.device.id, "shell", "input", "keyevent", AndroidKeyCode.KEYCODE_HOME.toString()],
            { encoding: "utf8" }
        );
        if (!stderr) {
            throw new Error("Spawned ADB process but could not read stdout/stderr");
        }

        if (stderr.toString() !== "") {
            throw new Error(`ADB backgroundApp output to stderr: ${stderr.toString()}`);
        }
        await this.expectStatus(appPackage, AndroidApplicationStatus.Hidden, 10);
    }

    async expectStatus(appPackage: string, expectedState: AndroidApplicationStatus, timeoutSeconds: number) {
        if (appPackage.trim() === "") {
            throw new Error("App package to stop was not specified");
        }


        if (timeoutSeconds && typeof timeoutSeconds !== "number") {
            throw new Error(`Timeout seconds was not parsable: ${timeoutSeconds}`);
        }
        if (!timeoutSeconds) {
            timeoutSeconds = 10;
        }

        let timeout = Date.now() + timeoutSeconds * 1000;

        const waitStatus: () => Promise<{package: string, state: AndroidApplicationStatus}>  = async () => {
            let currentStatus = await this.status(appPackage);
            if (currentStatus.state === expectedState) {
                //resolve(true) here because we found we have a match!
                return currentStatus;
            } else {
                if (Date.now() > timeout) {
                    //We've timed out, so reject
                    throw new Error(
                        `Expected status ${expectedState} was not detected within ${timeoutSeconds} seconds`
                    );
                } else {
                    await sleep(500);
                    //Haven't timed out, so should re-poll status now
                    return await waitStatus();
                }
            }
        };

        logger.info(`Awaiting ADB ${expectedState} confirmation`);
        return await waitStatus();
    }

    async status(appPackage: string): Promise<{package: string, state: AndroidApplicationStatus}> {
        if (appPackage.trim() === "") {
            throw new Error("App package to stop was not specified");
        }

        this.device.useStatus2 = false;

        const callStatus: () => Promise<AndroidApplicationStatus> = async () => {
            if (this.device.useStatus2) {
                logger.debug("Calling status2 impl");
                return await this.#status2(appPackage);
            } else {
                try {
                    return await this.#status1(appPackage);
                } catch (e) {
                    logger.debug("status1 impl failed, switching to status2 impl");
                    this.device.useStatus2 = true;
                    return await callStatus();
                }
            }
        };

        return {
            package: appPackage,
            state: await callStatus(),
        };
    }

    async #status1(appPackage: string): Promise<AndroidApplicationStatus> {
        logger.info(`Checking app ${appPackage} on ${this.device.id}`);
        const spawnOutput = await spawn(this.adb,
            ["-s", this.device.id, "shell", "am", "stack", "list"], {
            encoding: "utf8",
        });
        if (!this.isProcessOutputPresent(spawnOutput)) {
            throw new Error("Spawned ADB process but could not read stdout/stderr");
        }
        const { stdout, stderr } = spawnOutput;

        if (stderr.toString() !== "") {
            throw new Error(`ADB status1 output to stderr: ${stderr.toString()}`);
        }

        logger.debug(stdout);

        let state = AndroidApplicationStatus.Stopped;
        let output = stdout.toString().split(/[\r\n]+/);

        if (new RegExp("Exception").test(output.toString()) || new RegExp("Error:").test(output.toString())) {
            throw new Error(`Failed to get app status for ${appPackage} on ${this.device.id}: ${stdout}`);
        }

        output.forEach((line) => {
            if (new RegExp(appPackage).test(line)) {
                //Netflix package is in the stack, so lets see if running or hidden
                if (new RegExp("visible=true").test(line)) {
                    state = AndroidApplicationStatus.Running;
                } else if (new RegExp("visible=false").test(line)) {
                    state = AndroidApplicationStatus.Hidden;
                }
            }
        });
        logger.info(`Package ${appPackage} on ${this.device.id} status: ${state}`);
        return state;
    }

    async #status2(appPackage: string): Promise<AndroidApplicationStatus> {
        logger.info(`Checking app ${appPackage} on ${this.device.id}`);
        const output = await spawn(
            this.adb,
            ["-s", this.device.id, "shell", "dumpsys", "window", "windows"],
            {
                encoding: "utf8",
            }
        );
        if (!this.isProcessOutputPresent(output)) {
            throw new Error("Spawned ADB process but could not read stdout/stderr");
        }
        const { stdout, stderr } = output;

        if (stderr.toString() !== "") {
            throw new Error(`ADB status2 output to stderr: ${stderr.toString()}`);
        }

        logger.debug(stdout);

        if (new RegExp("Exception").test(stdout.toString())) {
            throw new Error(`Failed to get app status for ${appPackage} on ${this.device.id}: ${stdout}`);
        }

        let packageRegex = new RegExp(
            "package=" + appPackage + ".+([\\s\\S]*?)+?isReadyForDisplay\\(\\)=(\\w+)"
        );
        let match = packageRegex.exec(stdout.toString());

        let state;
        if (match === null || match[2] === undefined) {
            state = AndroidApplicationStatus.Stopped;
        } else if (match[2] === "true") {
            state = AndroidApplicationStatus.Running;
        } else if (match[2] === "false") {
            state = AndroidApplicationStatus.Hidden;
        } else {
            throw new Error(`Failed to parse app status for ${appPackage} on ${this.device.id}: ${stdout}`);
        }
        logger.info(`Package ${appPackage} on ${this.device.id} status: ${state}`);
        return state;
    }

    public async sendKey(keyCode: DabKey) {
        let keyVal = DabKeysToAndroidKeyCodes[keyCode];
        if (isNaN(keyVal)) {
            throw new Error(
                "Unrecognized keyCode was specified, no event code could be located: " + keyCode
            );
        }

        logger.debug(`Typing key event ${keyCode} as input on ${this.device.id}`);
        const output = await spawn(
            this.adb,
            ["-s", this.device.id, "shell", "input", "keyevent", keyVal.toString()],
            {
                encoding: "utf8",
            }
        );
        if (!this.isProcessOutputPresent(output)) {
            throw new Error("Spawned ADB process but could not read stdout/stderr");
        }
        const { stdout, stderr } = output;

        if (stderr.toString() !== "") {
            throw new Error(`ADB sendKey output to stderr: ${stderr.toString()}`);
        }

        logger.info(`Typed key on ${this.device.id}: ${stdout}`);
    }

    public async reboot() {
        return new Promise<void>(async (resolve, reject) => {
            logger.info(`Rebooting ${this.device.id}`);
            spawn(this.adb, ["-s", this.device.id, "reboot"], {
                encoding: "utf8",
            });

            const timer = setTimeout(()=> {
                return reject(new Error("Reconnection timeout following reboot"));
            }, config.get("adb.rebootTimeoutMs"));

            if (this.device.connection === "tcp") await this.disconnect();

            this.device.state = "rebooting";

            while(this.device.state !== "ready") {
                await sleep(5000);
                try {
                    await this.init();
                } catch (e) {
                    //Expected on reboot }
                }
            }
            clearTimeout(timer);
            logger.info(`Rebooted ${this.device.id}`);
            resolve();
        })
    }

    public async top() {
        logger.debug(`Running top on ${this.device.id}`);
        const output = await spawn(this.adb, ["-s", this.device.id, "shell", "top", "-n", "1"], {
            encoding: "utf8",
        });
        if (!this.isProcessOutputPresent(output)) {
            throw new Error("Spawned ADB process but could not read stdout/stderr");
        }
        const { stdout, stderr } = output;

        if (stderr.toString() !== "") {
            throw new Error(`ADB top output to stderr: ${stderr.toString()}`);
        }

        const matchedData = stdout.toString().match(/Tasks:([\s\S]+)Mem:([\s\S]+)Swap:([\s\S]+cached)/);
        const processData = [];
        if (matchedData) {
            for (let i=1; i<matchedData.length; i++) {
                processData[i] = matchedData[i].trim()
                    .replace(/\r\n/g, ",")
                    .replace(/\s+/g, " ")
                    .split(",")
            }
        }

        return {
            tasks: processData[1],
            memory: processData[2],
            swap: processData[3],
        };
    }

    private isProcessOutputPresent(output: Output): output is { stderr: string | Buffer; stdout: string | Buffer } {
        const { stdout, stderr } = output;
        return stdout !== null && stdout !== undefined && stderr !== null && stderr !== undefined;
    }
}
