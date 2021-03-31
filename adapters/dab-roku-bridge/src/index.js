import config from 'config';
import {DabDevice} from "./lib/dab_roku_bridge.js";

const rokuBridge = new DabDevice(config.get("roku.ipAddress"));
await rokuBridge.init(config.get("mqttBroker"));

/**
 * Handle Node termination cleanly
 */
process.on("SIGTERM", async () => {
    console.log("Caught SIGTERM...");
    await rokuBridge.stop();
    process.exit(0);
});

// catch ctrl+c event and exit normally
process.on("SIGINT", async () => {
    console.log("Caught SIGTINT...");
    await rokuBridge.stop();
    process.exit(0);
});

//catch uncaught exceptions, trace, then exit normally
process.on("uncaughtException", async (e) => {
    console.log("Uncaught Exception...");
    console.log(e.stack);
    await rokuBridge.stop();
    process.exit(0);
});
