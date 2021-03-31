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

import dab_topics as topics


class DabClient:
    """
    Sample DAB client based on the DabMqttClient implementation

    """
    def __init__(self, dab_mqtt_client):
        self.dab_mqtt_client = dab_mqtt_client

    def list_apps(self):
        return self.dab_mqtt_client.request(
            topics.APPLICATIONS_LIST_TOPIC,
            {}
        )

    def exit_app(self, app_id, force=False):
        return self.dab_mqtt_client.request(
            topics.APPLICATIONS_EXIT_TOPIC,
            {
                "appId": app_id,
                "force": force
            }
        )

    def launch_app(self, app_id, parameters=None):
        request = {
            "appId": app_id,
        }

        if parameters is not None:
            request["parameters"] = parameters

        return self.dab_mqtt_client.request(
            topics.APPLICATIONS_LAUNCH_TOPIC,
            request
        )

    def launch_app_with_content(self, app_id, content_id, parameters=None):
        request = {
            "appId": app_id,
            "contentId": content_id
        }

        if parameters is not None:
            request["parameters"] = parameters

        return self.dab_mqtt_client.request(
            topics.APPLICATIONS_LAUNCH_WITH_CONTENT_TOPIC,
            request
        )

    def key_press(self, key_code):
        return self.dab_mqtt_client.request(
            topics.INPUT_KEY_PRESS_TOPIC,
            {
                "keyCode": key_code
            }
        )

    def long_key_press(self, key_code, duration_ms):
        return self.dab_mqtt_client.request(
            topics.INPUT_KEY_PRESS_TOPIC,
            {
                "keyCode": key_code,
                "durationMs": duration_ms

            }
        )

    def health_check(self):
        return self.dab_mqtt_client.request(
            topics.HEALTH_CHECK_TOPIC,
            {}
        )
