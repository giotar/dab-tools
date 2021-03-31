# DeviceAutomationBusPythonSampleImplementation

Python reference implementation for DAB 0.1 version 

## How to use

1. Make sure the MQTT broker is enabled
2. Start the DAB device part by invoking

   `python3 run_dab_device_with_dummy_port.py`

   The Python program will now act act as DAB implementation on the device and await connections

3. In a new terminal window run:

    `python3 dab_scenario_test.py`
    
    This is a sample round robin test script that launches and stops all the applications it discovers on the device  

## DabMqttClient

A class that facilitates the communication between the broker, client and the device using the Device Automation Bus constructs.
It implements a request / response behavior compliant with the specification.

DabMqttClient uses paho-mqtt library for the native communication with the broker

A new instance of DabMqttClient accepts the following parameters:

* host: MQTT broker IP address
* port: MQTT broker port
* client_id: client identifier for the broker
* request_handlers: a list of request handlers this client supports
* retained_messages: a list of messages to be published once the client is connected to the broker

### Request handler

A request handler is a pair of:
* base topic where the requests are send
* a function that accepts a topic and the payload and returns payload to be sent back to the caller
