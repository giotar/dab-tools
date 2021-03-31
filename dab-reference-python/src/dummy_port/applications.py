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


class Applications:
    def __init__(self):
        self.logger = logging.getLogger('dab.applications')
        pass

    def launch(self, app_id, params):
        self.logger.info(f"request: applications/launch, app_id={app_id}, params={params}")
        return {
            "status": 200
        }

    def launch_with_content(self, app_id, content_id, params):
        self.logger.info(f"request: applications/launch-with-content, app_id={app_id}, content_id={content_id} params={params}")
        return {
            "status": 200
        }

    def get_state(self, app_id):
        self.logger.info(f"request: applications/get_state, app_id={app_id}")
        return {
            "status": 200,
            "state": "STOPPED"
        }

    def list(self):
        self.logger.info(f"request: applications/list")
        return {
            "status": 200,
            "applications": [
                {
                    "appId": "Netflix",
                    "friendlyName": "Netflix",
                    "version": "1.0"
                },
                {
                    "appId": "AmazonInstantVideo",
                    "friendlyName": "Prime Video",
                    "version": "1.0"
                },
                {
                    "appId": "YouTube",
                    "friendlyName": "YouTube",
                    "version": "1.0"
                }
            ]
        }

    def exit(self, app_id, force):
        self.logger.info(f"request: launch, app_id={app_id}, force={force}")
        return {
            "status": 200,
            "state": "STOPPED"
        }
