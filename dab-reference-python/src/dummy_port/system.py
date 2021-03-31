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
import time


class System:
    def __init__(self):
        self.logger = logging.getLogger('dab.system')

    def restart(self):
        self.logger.info("request: system/restart")
        return {
            "status": 200
        }

    def list_languages(self):
        self.logger.info("request: system/language/list")
        return {
            "languages": ["en-GB",
                          "en-US",
                          "fr"],
            "status": 200
        }

    def get_language(self):
        self.logger.info("request: system/language/get")
        return {
            "language": "en-US",
            "status": 200
        }

    def set_language(self, language):
        self.logger.info(f"request: system/language/set, language={language}")
        return {
            "status": 200
        }

    def key_press(self, key_code):
        self.logger.info(f"request: input/key-press, key_code={key_code}")
        return {
            "status": 200
        }

    def long_key_press(self, key_code, duration_ms):
        self.logger.info(f"request: input/long-key-press, key_code={key_code}, duration_ms={duration_ms}")
        return {
            "status": 200
        }

    def health_check(self):
        self.logger.info("request: health-check/get")
        return {
            "status": 200,
            "healthy": True
        }
