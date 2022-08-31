pub mod restart {
    use rumqttc::Publish;
    use serde_json::Result;
    use crate::utils;

    mod rpc {
        use serde::{Deserialize, Serialize};
        use crate::utils;

        #[derive(Serialize, Deserialize, Debug)]
        pub struct Params {
            pub reason: String,
        }

        #[derive(Serialize, Deserialize, Debug)]
        pub struct Request{
            pub jsonrpc: String,
            pub id: u64,
            pub method: String,
            pub params: Params,
        }

        #[allow(non_snake_case)]
        #[derive(Serialize, Deserialize, Debug)]
        pub struct Result {
            pub IARM_Bus_Call_STATUS: Option<u64>,
            pub success: bool,
        }

        #[derive(Serialize, Deserialize, Debug)]
        pub struct Response {
            pub jsonrpc: String,
            pub id: u64,
            pub result: Option<Result>,
            pub error: Option<utils::rpc::SimpleError>,
        }
        
        impl utils::Response for Response {
            fn is_success(&self) -> bool {
                match &self.result {
                    Some(r) => r.success,
                    _ => false,
                }
            }

            fn error_message(&self) -> String {
                match &self.error {
                    Some(e) => e.message.clone(),
                    _ => "unknown error".to_string(),
                }
            }
        }
    }

    pub fn process(_packet: Publish, ws: &mut utils::WsStream) -> Result<String> {
        let request = rpc::Request {
            jsonrpc: "2.0".to_string(),
            id: utils::get_request_id(),
            method: "org.rdk.System.reboot".to_string(),
            params: rpc::Params {
                reason: "DAB_RESTART_REQUEST".to_string(),
            },
        };

        let mut r = String::new();
        utils::rpc::call_and_respond::<rpc::Request, rpc::Response>(request, &mut r, ws)
    }
}
