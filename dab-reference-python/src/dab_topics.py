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

APPLICATIONS_LIST_TOPIC = "dab/applications/list"
APPLICATIONS_LAUNCH_TOPIC = "dab/applications/launch"
APPLICATIONS_LAUNCH_WITH_CONTENT_TOPIC = "dab/applications/launch-with-content"
APPLICATIONS_EXIT_TOPIC = "dab/applications/exit"
APPLICATIONS_GET_STATE_TOPIC = "dab/applications/get-state"

SYSTEM_RESTART_TOPIC = "dab/system/restart"
SYSTEM_LANGUAGE_LIST_TOPIC = "dab/system/language/list"
SYSTEM_LANGUAGE_GET_TOPIC = "dab/system/language/get"
SYSTEM_LANGUAGE_SET_TOPIC = "dab/system/language/set"

DEVICE_TELEMETRY_START_TOPIC = "dab/device-telemetry/start"
DEVICE_TELEMETRY_STOP_TOPIC = "dab/device-telemetry/stop"

APPLICATION_TELEMETRY_START_TOPIC = "dab/app-telemetry/start"
APPLICATION_TELEMETRY_STOP_TOPIC = "dab/app-telemetry/stop"

INPUT_KEY_PRESS_TOPIC = "dab/input/key-press"
INPUT_LONG_KEY_PRESS_TOPIC = "dab/input/long-key-press"

HEALTH_CHECK_TOPIC = "dab/health-check/get"

DEVICE_INFO_TOPIC = "dab/device/info"
DAB_VERSION_TOPIC = "dab/version"
