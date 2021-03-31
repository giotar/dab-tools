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

from dab_client import DabClient
from dab_mqtt_client import DabMqttClient

if __name__ == '__main__':
    dab_mqtt_client = DabMqttClient(client_id="DAB Test Client")
    try:

        dab_mqtt_client.connect('localhost', 1883)
        dab_client = DabClient(dab_mqtt_client=dab_mqtt_client)

        dab_client.health_check()

        list_apps_response = dab_client.list_apps()
        apps = list_apps_response["applications"]

        for app in apps:
            dab_client.launch_app(app_id=app['appId'])
            dab_client.key_press(key_code='KEY_ENTER')
            dab_client.exit_app(app_id=app, force=True)

    finally:
        if dab_mqtt_client.is_connected():
            dab_mqtt_client.disconnect()
