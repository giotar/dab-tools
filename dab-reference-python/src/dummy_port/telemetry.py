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

import logging


class Telemetry:

    def __init__(self):
        self.logger = logging.getLogger("dab.telemetry")

    def start_device_telemetry(self, frequency):
        self.logger.info(f"request: device-telemetry/start, frequency: {frequency}")
        return {
            'status': 200
        }

    def stop_device_telemetry(self):
        self.logger.info(f"request: device-telemetry/stop")
        return {
            'status': 200
        }

    def start_app_telemetry(self, app_id, frequency):
        self.logger.info(f"request: app-telemetry/start, app_id: {app_id}, frequency: {frequency}")
        return {
            'status': 200
        }

    def stop_app_telemetry(self, app_id):
        self.logger.info(f"request: app-telemetry/stop, app_id: {app_id}")
        return {
            'status': 200
        }
