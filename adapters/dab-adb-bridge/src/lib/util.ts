/**
 Copyright 2019 Amazon.com, Inc. or its affiliates.
 Copyright 2019 Netflix Inc.
 Copyright 2019 Google LLC
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import bunyan from 'bunyan';
import {readFileSync} from 'fs';
import {AndroidApplicationStatus} from "./adb/app_status";
import Logger from "bunyan";
import {ApplicationState} from "./dab/dab_constants";

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function adbAppStatusToDabAppState(appStatus: AndroidApplicationStatus) {
  switch (appStatus) {
    case AndroidApplicationStatus.Running:
      return ApplicationState.Foreground;
    case AndroidApplicationStatus.Hidden:
      return ApplicationState.Background;
    case AndroidApplicationStatus.Stopped:
      return ApplicationState.Stopped;
  }
}

// Static logger
let logger: Logger;
export function getLogger() {
  if (!logger) {
    const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));
    logger = bunyan.createLogger({
      name: packageJson.name,
      version: packageJson.version,
      streams: [
        {
          level: 'info',
          stream: process.stdout // log debug and above to stdout
        },
        // {
        //   level: 'info',
        //   path: 'dab_adb_bridge.log' // log ERROR and above to a file
        // }
      ],
      serializers: {err: bunyan.stdSerializers.err},
      src: true
    });
    // This removes the `v` field as its only needed by bunyan cli and useless to us.
    //@ts-ignore
    logger._emit = (rec, noemit) => {
      delete rec.v;
      //@ts-ignore
      bunyan.prototype._emit.call(logger, rec, noemit);
    };
  }

  return logger;
}
