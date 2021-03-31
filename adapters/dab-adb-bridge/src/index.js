import config from 'config';
import {DabDevice} from "./lib/dab_adb_bridge.js";

const adbBridge = new DabDevice(config.get("adb.device"));
await adbBridge.init(config.get("mqttBroker"));

/**
 * Handle Node termination cleanly
 */
process.on("SIGTERM", async () => {
    console.log("Caught SIGTERM...");
    await adbBridge.stop();
    process.exit(0);
});

// catch ctrl+c event and exit normally
process.on("SIGINT", async () => {
    console.log("Caught SIGTINT...");
    await adbBridge.stop();
    process.exit(0);
});

//catch uncaught exceptions, trace, then exit normally
process.on("uncaughtException", async (e) => {
    console.log("Uncaught Exception...");
    console.log(e.stack);
    await adbBridge.stop();
    process.exit(0);
});
