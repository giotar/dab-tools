from dab_device import new_dab_0_1_device

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

from dummy_port.applications import Applications
from dummy_port.system import System
from dummy_port.telemetry import Telemetry

if __name__ == '__main__':
    dab_device = new_dab_0_1_device(client_id='DAB reference implementation',
                                    applications=Applications(),
                                    system=System(),
                                    telemetry=Telemetry(),
                                    device_info={"manufacturer": "Amazon, Netflix, Google",
                                                 "model": "DAB Reference Implementation"})
    dab_device.connect(host='localhost', port=1883)
    dab_device.wait()
