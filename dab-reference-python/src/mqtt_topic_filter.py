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


def mqtt_matches_filter(topic, topic_filter):

    """
    MQTT topic matching as specified in the MQTT 3.1.1 protocol

    # (multi-level wildcard) matches any number of levels within a topic
    + (single-level wildcard) matches only one topic level

    This method will return True if the provided topic matches the topic_filter, False otherwise
    """

    if topic == topic_filter:
        return True

    if topic_filter == '#':
        return True

    topic_parts = topic.split('/')
    topic_filter_parts = topic_filter.split('/')

    for i in range(0, len(topic_parts)):
        if len(topic_filter_parts) == i:
            return False
        if topic_filter_parts[i] == "+":
            continue
        if topic_filter_parts[i] == "#":
            return True
        if topic_parts[i] != topic_filter_parts[i]:
            return False

    return len(topic_parts) == len(topic_filter_parts)
