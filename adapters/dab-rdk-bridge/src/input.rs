pub mod key_press {
    use rumqttc::Publish;
    use serde_json::Result;
    use crate::utils;

    mod rpc {
        use serde::{Deserialize, Serialize};

        #[allow(non_snake_case)]
        #[derive(Serialize, Deserialize, Debug)]
        pub struct Params {
            pub keyCode: u32,
            pub modifiers: String,
        }

        #[derive(Serialize, Deserialize, Debug)]
        pub struct Request{
            pub jsonrpc: String,
            pub id: u64,
            pub method: String,
            pub params: Params,
        }
    }

    fn keycode_str_to_ui32 (keycode: String) -> u32 {
        use std::collections::HashMap;

        let mut keycode_map = HashMap::new();
        keycode_map.insert(String::from("KEY_POWER"),112);
        keycode_map.insert(String::from("KEY_VOLUME_UP"),175);
        keycode_map.insert(String::from("KEY_VOLUME_DOWN"),174);
        keycode_map.insert(String::from("KEY_MUTE"),173);
        keycode_map.insert(String::from("KEY_CHANNEL_UP"),175);
        keycode_map.insert(String::from("KEY_CHANNEL_DOWN"),174);
        keycode_map.insert(String::from("KEY_MENU"),0);
        keycode_map.insert(String::from("KEY_EXIT"),36);
        keycode_map.insert(String::from("KEY_INFO"),0);
        keycode_map.insert(String::from("KEY_GUIDE"),0);
        keycode_map.insert(String::from("KEY_UP"),38);
        keycode_map.insert(String::from("KEY_PAGE_UP"),0);
        keycode_map.insert(String::from("KEY_PAGE_DOWN"),0);
        keycode_map.insert(String::from("KEY_RIGHT"),39);
        keycode_map.insert(String::from("KEY_DOWN"),40);
        keycode_map.insert(String::from("KEY_LEFT"),37);
        keycode_map.insert(String::from("KEY_ENTER"),13);
        keycode_map.insert(String::from("KEY_BACK"),0);
        keycode_map.insert(String::from("KEY_PLAY"),0);
        keycode_map.insert(String::from("KEY_PLAY_PAUSE"),0);
        keycode_map.insert(String::from("KEY_PAUSE"),0);
        keycode_map.insert(String::from("KEY_RECORD"),0);
        keycode_map.insert(String::from("KEY_STOP"),0);
        keycode_map.insert(String::from("KEY_REWIND"),0);
        keycode_map.insert(String::from("KEY_FAST_FORWARD"),0);
        keycode_map.insert(String::from("KEY_SKIP_REWIND"),0);
        keycode_map.insert(String::from("KEY_SKIP_FAST_FORWARD"),0);
        keycode_map.insert(String::from("KEY_0"),48);
        keycode_map.insert(String::from("KEY_1"),49);
        keycode_map.insert(String::from("KEY_2"),50);
        keycode_map.insert(String::from("KEY_3"),51);
        keycode_map.insert(String::from("KEY_4"),52);
        keycode_map.insert(String::from("KEY_5"),53);
        keycode_map.insert(String::from("KEY_6"),54);
        keycode_map.insert(String::from("KEY_7"),55);
        keycode_map.insert(String::from("KEY_8"),56);
        keycode_map.insert(String::from("KEY_9"),57);

        keycode_map[&keycode]
    }

    pub fn process(packet: Publish, ws: &mut utils::WsStream) -> Result<String> {
        match utils::dab::decode_request(packet) {
            Ok(dab_request) => {
                if dab_request.keyCode.is_none() {
                    utils::dab::respond_error(400, "request missing 'keyCode' parameter".to_string())
                } else {
                    let request = rpc::Request {
                        jsonrpc: "2.0".to_string(),
                        id: utils::get_request_id(),
                        method: "org.rdk.RDKShell.injectKey".to_string(),
                        params: rpc::Params {
                            keyCode: keycode_str_to_ui32(dab_request.keyCode.unwrap()),
                            modifiers: String::new(),
                        },
                    };

                    let mut r = String::new();
                    utils::rpc::call_and_respond::<rpc::Request, utils::rpc::SimpleResponse>(request, &mut r, ws)
                }
            },
            Err(e) => Err(e),
        }
    }
}

