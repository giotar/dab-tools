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

from dab_mqtt_client import DabMqttClient, DabMqttException, RequestHandler, RetainedMessage
import dab_topics as topics
import logging

logging.basicConfig(
    format='%(asctime)s %(name)s %(levelname)s %(message)s',
    level=logging.DEBUG,
    datefmt='%Y-%m-%d %H:%M:%S'
)


def new_dab_0_1_device(client_id, applications, system, telemetry, device_info):
    """
    Connects to the MQTT broker and wires the ported components conforming with the 0.1 DAB specification
    This method is blocking

    :param client_id: MQTT client identifier, for MQTT diagnostic purposes
    :param applications: ported application lifecycle commands
    :param system: ported system commands
    :param telemetry: ported telemetry commands
    :param device_info: an object with the device information, as defined by the specification
    """

    def parameter_from_payload(key, payload, mandatory=False, default=None):
        if mandatory and key not in payload:
            raise DabMqttException(f"parameter {key} is mandatory", 400)

        return payload.get(key, default)

    dab_mqtt_client = DabMqttClient(
        client_id=client_id,
        request_handlers=[
            RequestHandler(topic=topics.APPLICATIONS_LAUNCH_TOPIC,
                           handler=lambda topic, payload:
                           applications.launch(
                               app_id=parameter_from_payload("appId", payload, mandatory=True),
                               params=parameter_from_payload("parameters", payload, default=None))),
            RequestHandler(topic=topics.APPLICATIONS_LAUNCH_WITH_CONTENT_TOPIC,
                           handler=lambda topic, payload:
                           applications.launch_with_content(
                               app_id=parameter_from_payload("appId", payload, mandatory=True),
                               content_id=parameter_from_payload("contentId", payload, mandatory=True),
                               params=parameter_from_payload("parameters", payload, default=None))),
            RequestHandler(topic=topics.APPLICATIONS_LIST_TOPIC,
                           handler=lambda topic, payload:
                           applications.list()),
            RequestHandler(topic=topics.APPLICATIONS_EXIT_TOPIC,
                           handler=lambda topic, payload:
                           applications.exit(
                               app_id=parameter_from_payload("appId", payload, mandatory=True),
                               force=parameter_from_payload("force", payload, default=False))),
            RequestHandler(topic=topics.APPLICATIONS_GET_STATE_TOPIC,
                           handler=lambda topic, payload:
                           applications.launch(
                               app_id=parameter_from_payload("appId", payload, mandatory=True))),

            RequestHandler(topic=topics.SYSTEM_RESTART_TOPIC,
                           handler=lambda topic, payload:
                           system.restart()),

            RequestHandler(topic=topics.SYSTEM_LANGUAGE_LIST_TOPIC,
                           handler=lambda topic, payload:
                           system.list_languages()),
            RequestHandler(topic=topics.SYSTEM_LANGUAGE_GET_TOPIC,
                           handler=lambda topic, payload:
                           system.get_language()),
            RequestHandler(topic=topics.SYSTEM_LANGUAGE_SET_TOPIC,
                           handler=lambda topic, payload:
                           system.set_lanugage(
                               language=parameter_from_payload("language", payload, True))),

            RequestHandler(topic=topics.INPUT_KEY_PRESS_TOPIC,
                           handler=lambda topic, payload:
                           system.key_press(
                               key_code=parameter_from_payload("keyCode", payload, mandatory=True))),

            RequestHandler(topic=topics.INPUT_LONG_KEY_PRESS_TOPIC,
                           handler=lambda topic, payload:
                           system.long_key_press(
                               key_code=parameter_from_payload("keyCode", payload, mandatory=True),
                               duration_ms=parameter_from_payload("durationMs", payload, mandatory=True))),

            RequestHandler(topic=topics.HEALTH_CHECK_TOPIC,
                           handler=lambda topic, payload:
                           system.health_check()),

            RequestHandler(topic=topics.DEVICE_TELEMETRY_START_TOPIC,
                           handler=lambda topic, payload:
                           telemetry.start_device_telemetry(
                               frequency=parameter_from_payload("frequency", payload, mandatory=True)
                           )),
            RequestHandler(topic=topics.DEVICE_TELEMETRY_STOP_TOPIC,
                           handler=lambda topic, payload:
                           telemetry.stop_device_telemetry()),
            RequestHandler(topic=topics.APPLICATION_TELEMETRY_START_TOPIC,
                           handler=lambda topic, payload:
                           telemetry.start_app_telemetry(
                               app_id=parameter_from_payload("appId", payload, mandatory=True),
                               frequency=parameter_from_payload("frequency", payload, mandatory=True))),
            RequestHandler(topic=topics.APPLICATION_TELEMETRY_STOP_TOPIC,
                           handler=lambda topic, payload:
                           telemetry.stop_app_telemetry(
                               app=parameter_from_payload("appId", payload, mandatory=True)))
        ],

        retained_messages=[
            RetainedMessage(topic=topics.DAB_VERSION_TOPIC, message={"versions": ["0.1"]}),
            RetainedMessage(topic=topics.DEVICE_INFO_TOPIC, message=device_info), ])

    return dab_mqtt_client
