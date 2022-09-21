use std::net::TcpStream;
use tungstenite::{WebSocket, stream::MaybeTlsStream};

pub type WsStream = WebSocket<MaybeTlsStream<TcpStream>>;

// This trait allows us to provide a standard way to
// query the state and (if applicable) error message of
// an RPC request, as all response structs have different
// structures and cannot be used/extended as we do with C
// pointers.
pub trait Response {
    fn is_success(&self) -> bool;
    fn error_message(&self) -> String;
}

// We need a unique ID for each request, this is the simple
// (and probably bad) way to do so
// TODO: implement this the "right" way
static mut ID: u64 = 0;

pub fn get_request_id() -> u64 {
    unsafe {
        ID = ID + 1;
        ID
    }
}

pub mod rpc {
    use serde::{Serialize, Deserialize, de::Error};
    use serde_json::Result;
    use tungstenite::protocol::Message;

    #[derive(Serialize, Deserialize, Debug)]
    pub struct SimpleRequest{
        pub jsonrpc: String,
        pub id: u64,
        pub method: String,
    }

    #[derive(Serialize, Deserialize, Debug)]
    pub struct SimpleError {
        pub success: bool,
        pub code: u32,
        pub message: String,
    }

    #[derive(Serialize, Deserialize, Debug)]
    pub struct SimpleResult {
        pub success: bool,
    }

    #[derive(Serialize, Deserialize, Debug)]
    pub struct SimpleResponse {
        pub jsonrpc: String,
        pub id: u64,
        pub result: Option<SimpleResult>,
        pub error: Option<SimpleError>,
    }

    // TODO: we should probably use a "blanket" implementation or allowing
    // to derive from the trait: this would avoid having to reimplement
    // this trait in the same exact way for all relevant structures.
    // I just don't know how to do it (yet).
    impl super::Response for SimpleResponse {
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

    // Send the RPC request and return the response as a string
    // This function is generic, with T being the request struct type
    pub fn call_raw<T>(request: T, ws: &mut super::WsStream) -> Result<String>
        where T: Serialize
    {
        let message = Message::Text(serde_json::to_string(&request).unwrap());
        if ws.write_message(message).is_err()
        {
            return Err(serde_json::Error::custom("unable to send RPC request to device"));
        }

        match ws.read_message() {
            Ok(Message::Text(m)) => Ok(m),
            Ok(_) => Err(serde_json::Error::custom("non-text response received")),
            Err(e) => Err(serde_json::Error::custom(format!("WebSocket error: {}", e))),
        }
    }

    // Send the RPC request and return the response as a struct
    // This function is generic:
    //   * T is the request struct type
    //   * U is the response struct type
    pub fn call<'a, T, U>(request: T, response: &'a mut String, ws: &mut super::WsStream) -> Result<U>
        where T: Serialize,
              U: Deserialize<'a> + super::Response
    {
        match call_raw(request, ws) {
            Ok(m) => {
                response.clear();
                response.push_str(m.as_str());
                match serde_json::from_str::<U>(response.as_str()) {
                    Ok(result) => {
                        if result.is_success() {
                            Ok(result)
                        } else {
                            Err(serde_json::Error::custom(format!("RPC request failed: {}", result.error_message())))
                        }
                    },
                    Err(e) => Err(e),
                }
            },
            Err(e) => Err(e),
        }
    }

    // Send the RPC request and return a simple DAB "success" (or error) message
    // This function is generic:
    //   * T is the request struct type
    //   * U is the response struct type
    pub fn call_and_respond<'a, T, U>(request: T, response: &'a mut String, ws: &mut super::WsStream) -> Result<String>
        where T: Serialize,
              U: Deserialize<'a> + super::Response
    {
        match call::<T, U>(request, response, ws) {
            Ok(_) => super::dab::respond_success(),
            Err(e) => Err(e),
        }
    }
}

pub mod dab {
    use serde::{Serialize, Deserialize, de::Error};
    use serde_json::Result;
    use rumqttc::Publish;

    #[allow(non_snake_case)]
    #[derive(Serialize, Deserialize, Debug)]
    pub struct Request {
        pub appId: Option<String>,
        pub force: Option<bool>,
        pub keyCode:Option<String>,
    }

    #[derive(Serialize, Deserialize, Debug)]
    pub struct SimpleResponse {
        pub status: u16,
    }

    #[derive(Serialize, Deserialize, Debug)]
    pub struct ErrorResponse {
        pub status: u16,
        pub error: String,
    }

    pub fn decode_request(packet: Publish) -> Result<Request> {
        if let Ok(payload) = String::from_utf8(packet.payload.to_vec()) {
            serde_json::from_str(payload.as_str())
        } else {
            Err(serde_json::Error::custom("unable to decode DAB request"))
        }
    }

    pub fn respond_with_code(status: u16) -> Result<String> {
        serde_json::to_string(&SimpleResponse { status })
    }

    pub fn respond_success() -> Result<String> {
        respond_with_code(200)
    }

    pub fn respond_error(status: u16, error: String) -> Result<String> {
        serde_json::to_string(&ErrorResponse { status, error })
    }

    pub fn respond_not_implemented() -> Result<String> {
        respond_with_code(501)
    }
}

pub mod health_check {
    use rumqttc::Publish;
    use serde_json::Result;

    pub fn process(_packet: Publish, _ws: &mut super::WsStream) -> Result<String> {
        // Simple health check, nothing expected but a "success" response
        super::dab::respond_success()
    }
}

pub mod version {
    use rumqttc::Publish;
    use serde_json::Result;

    mod dab {
        use serde::{Serialize, Deserialize};

        #[derive(Serialize, Deserialize, Debug)]
        pub struct Response {
            pub versions: Vec<String>,
        }
    }

    pub fn process(_packet: Publish, _ws: &mut super::WsStream) -> Result<String> {
        // We only support DAB 1.0 for now
        serde_json::to_string(&dab::Response { versions: vec![String::from("1.0")] })
    }
}
