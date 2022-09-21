use clap::Parser;
use rumqttc::{MqttOptions, Client, QoS, Event::Incoming, Packet, Publish};
use serde_json::Result;
use std::{time::Duration, collections::HashMap, path::PathBuf};
use tungstenite;

/*
 * The code for this software is split into modules, each corresponding to a level
 * of the MQTT topics hierarchy:
 *   - for dab/level1 we have a level1 "toplevel" module with its own source file (level1.rs)
 *   - for dab/level1/level2 we create a sub-module of level1 named level2, implemented in level1.rs
 *   - for dab/level1/level2/level3 we create a sub-module of level2 named level3, implemented in level1.rs
 *   - and so on
 *
 * Each "leaf" module (ie. each module corresponding to a DAB function) has the following structure:
 *   - optional "rpc" sub-module, holding all the relevant struct definitions for RPC calls
 *   - optional "dab" sub-module, holding all the relevant struct definitions for parsing DAB requests
 *     and creating the corresponding DAB responses
 *   - mandatory "process" function, which uses the raw MQTT packet as a parameter and returns the
 *     appropriate response as a single string (or an error)
 *
 * The "utils" module holds generic but useful function and struct definitions. In particular,
 * its "rpc" sub-module provide strucs for simple requests (without parameters), results (simple
 * success indicator) and responses (using the simple result struct mentioned previously).
 * It also provides helper functions for easier processing of DAB requests/responses and RPC
 * calls.
 * It also implements DAB endpoints which are too simple to deserve their own source files. Those
 * are currently `dab/version` and `dab/health-check/get`.
 */

mod apps;
mod device;
mod input;
mod system;
mod utils;

#[derive(Parser)]
#[clap(author, version, about, long_about = None)]
struct Opt {
    /// The MQTT broker host name or IP (default: localhost)
    #[clap(short, long, value_parser, value_name = "MQTT_HOST")]
    broker: Option<String>,

    /// The MQTT broker port (default: 1883)
    #[clap(short, long, value_parser, value_name = "MQTT_PORT")]
    port: Option<u16>,

    /// The device host name or IP (default: localhost)
    #[clap(short, long, value_parser, value_name = "DEVICE")]
    device: Option<String>,
}

pub fn main() {
    let opt = Opt::parse();
    let mqtt_host = opt.broker.unwrap_or(String::from("localhost"));
    let mqtt_port = opt.port.unwrap_or(1883);
    let device = opt.device.unwrap_or(String::from("localhost"));

    let mut handlers: HashMap<String, Box<dyn FnMut(Publish, &mut utils::WsStream) -> Result<String>>> = HashMap::new();

    // Register handlers for supported DAB endpoints
    // TODO: we could have each module register his own handlers, for example:
    //   - apps::register_handlers(&mut handlers)
    //   - device::register_handlers(&mut handlers)
    //   - system::register_handlers(&mut handlers)
    //   - and so on...
    handlers.insert("dab/applications/list".to_string(), Box::new(apps::list::process));
    handlers.insert("dab/applications/launch".to_string(), Box::new(apps::launch::process));
    handlers.insert("dab/applications/get-state".to_string(), Box::new(apps::get_state::process));
    handlers.insert("dab/applications/exit".to_string(), Box::new(apps::exit::process));
    handlers.insert("dab/device/info".to_string(), Box::new(device::info::process));
    handlers.insert("dab/system/restart".to_string(), Box::new(system::restart::process));
    handlers.insert("dab/input/key-press".to_string(), Box::new(input::key_press::process));
    handlers.insert("dab/health-check/get".to_string(), Box::new(utils::health_check::process));
    handlers.insert("dab/version".to_string(), Box::new(utils::version::process));

    // Connect to the MQTT broker and subscribe to all topics starting with `dab/`
    let mut mqttoptions = MqttOptions::new("rdk-dab-bridge", mqtt_host, mqtt_port);
    mqttoptions.set_keep_alive(Duration::from_secs(5));

    let (mut client, mut connection) = Client::new(mqttoptions, 10);
    if let Err(e) = client.subscribe("dab/#", QoS::AtMostOnce) {
        println!("ERROR: unable to subscribe to DAB topics: {}", e);
    };

    let mut ws = match tungstenite::connect(format!("ws://{}:9998/jsonrpc", device)){
        Ok((ws, _r)) => ws,
        Err(e) => panic!("{}", e),
    };

    // Iterate to poll the eventloop for MQTT events
    for (_i, notification) in connection.iter().enumerate() {
        // Filter on published messages on the subscribed topics
        if let Ok(Incoming(Packet::Publish(p))) = notification {
            let result: String;
            let response_topic = String::from("_response/") + &p.topic;

            // DAB clients append a UUID to the topic to which they post
            // PathBuf is an easy way to strip the last component so we
            // can easily match to the corresponding handler
            let mut function_topic = PathBuf::from(&p.topic);
            function_topic.pop();

            match handlers.get_mut(function_topic.to_str().unwrap()) {
                Some(callback) => {
                    result = match callback(p, &mut ws) {
                        Ok(r) => r,
                        Err(e) => match utils::dab::respond_error(500, e.to_string()) {
                            Ok(r) => r,
                            Err(e) => e.to_string(),
                        },
                    }
                },
                // If we can't get the proper handler, then this function is not implemented (yet)
                _ => {
                    result = match utils::dab::respond_not_implemented() {
                        Ok(r) => r,
                        Err(e) => e.to_string(),
                    }
                }
            }

            if let Err(e) = client.publish(&response_topic, QoS::AtLeastOnce, false, result.as_bytes()) {
                println!("ERROR: unable to publish response on topic {}: {}", response_topic, e);
            };
        }
    }
}
