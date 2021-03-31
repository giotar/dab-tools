__copyright__ = """
    Copyright 2021 Amazon.com, Inc. or its affiliates.
    Copyright 2021 Netflix Inc.
    Copyright 2021 Google LLC
"""
__license__ = """
    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
"""

import json
import logging

from mqtt_topic_filter import mqtt_matches_filter
from paho.mqtt.client import Client
from threading import Event, Thread
from uuid import uuid4

logging.basicConfig(
    format='%(asctime)s %(name)s %(levelname)s %(message)s',
    level=logging.DEBUG,
    datefmt='%Y-%m-%d %H:%M:%S'
)


class RetainedMessage:
    """A retained message that the device sends once it connects to the broker"""

    def __init__(self, topic, message):
        """
        :param topic: an MQTT topic the retained message will be published to
        :param message: a payload object that will be serialized to JSON
        """
        self.topic = topic
        self.message = message


class RequestHandler:
    """
    Represents a DAB command that conforms to the request / response format.
    """

    def __init__(self, topic, handler):
        """
        :param topic: an DAB MQTT topic that will accept messages in the request format.
                      The topic must not have any wildcards like + or #
        :param handler: a function that accepts 2 parameters, topic: str and payload: object and responds with
                        an object that will be serialized to JSON
        """
        self.topic = topic
        self.handler = handler


class DabMqttException(Exception):
    def __init__(self, message, error_code, *args):
        self.message = message
        self.error_code = error_code
        super(DabMqttException, self).__init__(message, args)


class MessageInFlight:
    """
    Represents a message that has been published to the broker that is awaiting a response
    """

    def __init__(self, response_topic, request_event):
        self.response_topic = response_topic
        self.request_event = request_event
        self.response = None


class DabMqttClient:
    """
    A generic construct that connects to the broker, publishes retained messages
    and handles the request / response commands as defined by the DAB protocol
    """

    def __init__(self, client_id, request_handlers=[], retained_messages=[]):
        self.logger = logging.getLogger('dab.mqtt.client')

        self.messages_in_flight = []
        self.mqtt_connected_event = Event()
        self.thread = None

        def _validate_request_handlers(handlers):
            incorrect_topics = [handler.topic for handler in handlers
                                if '+' in handler.topic or '#' in handler.topic
                                or handler.topic.endswith('/')]
            if len(incorrect_topics) > 0:
                raise DabMqttException(
                    """
                    Incorrect topic. A request topic must not end with /+ to accept requestId
                    and conform to DAB specification
                    """, 400, incorrect_topics)

        _validate_request_handlers(request_handlers)
        self.request_handlers = request_handlers
        self.retained_messages = retained_messages

        self.mqtt_client = Client(client_id=client_id)
        self.mqtt_client.enable_logger(logging.getLogger("paho.mqtt"))
        self.mqtt_client.on_message = self._mqtt_client_on_message
        self.mqtt_client.on_connect = self._mqtt_client_on_connect
        self.mqtt_client.on_disconnect = self._mqtt_client_on_disconnect

    @staticmethod
    def _topic_filter_from_dab_topic(topic):
        return topic + '/+'

    def _mqtt_client_on_message(self, client, user_data, message):
        """
        Callback when the client receives a message to one of the subscribed topics
        - the message could be a response from the client / device to the previous request
        - the message could be a request to the client / device
        """
        del client, user_data

        self.logger.debug(f"Message arrived on topic: {message.topic} with payload {message.payload}")

        matched_messages_in_flight = [message_in_flight for message_in_flight in self.messages_in_flight if
                                      message_in_flight.response_topic == message.topic]

        for matched_message in matched_messages_in_flight:
            matched_message.response = message.payload
            matched_message.request_event.set()

        if len(matched_messages_in_flight) > 0:
            return

        for request_handler in self.request_handlers:
            topic_filter = self._topic_filter_from_dab_topic(request_handler.topic)
            if mqtt_matches_filter(message.topic, topic_filter):
                response_topic = '_response/' + message.topic
                try:
                    payload = json.loads(message.payload)
                    response = request_handler.handler(message.topic, payload)
                except DabMqttException as e:
                    self.logger.error("DAB error", e)
                    response = {
                        "status": e.error_code,
                        "error": e.message,
                    }
                except Exception as e:
                    self.logger.error("Internal DAB error", e)
                    response = {
                        "status": 500,
                        "error": "Internal DAB error",
                    }

                response_json = json.dumps(response)
                self.logger.debug(f"Responding on topic: {response_topic}, payload {response}")
                self.mqtt_client.publish(
                    topic='_response/' + message.topic,
                    payload=response_json,
                    qos=2
                )

    def _mqtt_client_on_connect(self, client, userdata, flags, rc):
        """
        Callback when the client connects to the MQTT broker
        - subscribes to the request topics that this client handles
        - publishes the retained messages
        """
        del client, userdata, flags, rc

        self.logger.info("Connected to the MQTT broker")
        for request_handler in self.request_handlers:
            topic_filter = self._topic_filter_from_dab_topic(request_handler.topic)
            self.mqtt_client.subscribe(
                topic=topic_filter
            )

        for retained_message in self.retained_messages:
            self.mqtt_client.publish(
                topic=retained_message.topic,
                payload=json.dumps(retained_message.message),
                qos=2,
                retain=True
            )

        self.mqtt_connected_event.set()

    def _mqtt_client_on_disconnect(self, client, userdata, rc):
        """
        Callback when the client disconnects from the MQTT broker
        """
        del client, userdata, rc
        self.logger.info("MQTT broker disconnected")

        self.mqtt_connected_event.clear()

    def _mqtt_connect_and_start_loop(self, host, port):
        self.mqtt_client.connect(host, port)
        self.mqtt_client.loop_forever()

    def connect(self, host, port):
        """
        Connects to the MQTT broker on the specified host and port. Times out after 15 seconds
        """
        if self.is_connected():
            raise DabMqttException(
                'DAB MQTT client already connected to the broker, disconnect first before reconnecting', 400)

        self.logger.info(f"Connecting to the MQTT broker at {host}:{port}")

        self.thread = Thread(target=lambda: self._mqtt_connect_and_start_loop(host, port))
        self.thread.start()

        if not self.mqtt_connected_event.wait(15):
            raise DabMqttException("Unable to connect to the broker", 500)

    def disconnect(self):
        """
        Disconnects from the MQTT broker and break the loop
        """
        if not self.is_connected():
            raise DabMqttException("DAB MQTT client is not connected to the broker", 400)

        self.logger.info("Disconnecting...")
        self.mqtt_client.disconnect()

    def is_connected(self):
        """
        Returns True when the client is connected to the MQTT broker, False otherwise
        """
        return self.mqtt_client.is_connected()

    def wait(self):
        """
        Will block the object forever until the disconnect method is called
        """
        if self.thread is None:
            raise DabMqttException("Client needs to connect to the broker before starting the loop", 400)

        self.thread.join()

    def request(self, topic, payload, timeout_s=5):
        """
        Makes a request to the DAB-enabled device, using the request/response convention
        This method will automatically generate the request ID and append it to the request
        Unless the operation times out, this method will deserialize the response and return the object

        :param topic: DAB topic, with no trailing forward slash and without the request_id
        :param payload: an object to be serialized into JSON and sent to the DAB-enabled device
        :param timeout_s: (optional) request timeout, expressed in seconds (default value is 5 seconds)
        """
        self.logger.info(f"Request: topic={topic}, payload={payload}")

        if not self.is_connected():
            raise DabMqttException(f"DAB MQTT client is not connected to the broker", 400)

        if topic.endswith('/'):
            raise DabMqttException(f'Request topic must not end with a forward slash. Topic={topic}', 400)

        request_event = Event()
        request_topic = topic + '/' + str(uuid4())
        mqtt_payload = json.dumps(payload)
        response_topic = "_response/" + request_topic

        message_in_flight = MessageInFlight(response_topic, request_event)
        self.messages_in_flight.append(message_in_flight)

        try:
            self.logger.debug(f"Awaiting response on topic: {response_topic}")
            self.mqtt_client.subscribe(response_topic)
            self.logger.debug(f"Publishing message to topic: {request_topic}")
            self.mqtt_client.publish(request_topic, mqtt_payload)

            if not request_event.wait(timeout_s):
                raise DabMqttException(f"Operation timed out. Topic={topic}", 500)

            response = json.loads(message_in_flight.response)
            self.logger.info(f"response={response}")
            return response
        finally:
            try:
                self.mqtt_client.unsubscribe(response_topic)
                self.messages_in_flight.remove(message_in_flight)
            except Exception:
                pass
