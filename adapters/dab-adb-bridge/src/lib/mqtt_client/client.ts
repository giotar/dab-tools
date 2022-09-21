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

import mqtt, {
    AsyncMqttClient,
    IClientOptions,
    ISubscriptionGrant,
    OnErrorCallback,
    OnMessageCallback
} from 'async-mqtt';
import { serializeError } from 'serialize-error';
import { v4 as uuidv4 } from 'uuid';
import { TimeoutError } from './error.js';
import { convertPattern } from './util.js';
import {EventEmitter2, ListenerFn} from 'eventemitter2';
import {IClientPublishOptions} from "mqtt";
import {IPublishPacket} from "mqtt-packet";
import {HandlerFunction, HandlerSubscription} from "./index";



export class Client {

    #client: WrappedMqttClient;
    #emitter: EventEmitter2;
    #handlerSubscriptions: HandlerSubscription[];

  /**
   *  A generic construct that takes in an async mqtt client.
   */
  constructor(mqttClient: WrappedMqttClient) {
    this.#client = mqttClient;
    this.#emitter = new EventEmitter2({
      wildcard: true,
      delimiter: "/",
      verboseMemoryLeak: true,
    });

    this.#handlerSubscriptions = [];

    this.#client.setOnMessage(this.#handleMessage.bind(this));
  }

  /**
   * Callback when the client receives a message to one of the subscribed topics
   * - the message could be a response from the client / device to the previous request
   * - the message could be a request to the client / device
   * @private
   * @param  {string} topic
   * @param  {MqttPayload} [msg]
   * @param  {MqttPacket} pkt
   */
  #handleMessage(topic: string, msg: Buffer, pkt: IPublishPacket) {
    let response = {};

    if (msg && msg.length) {
      try {
        response = JSON.parse(msg.toString());
      } catch (error) {
        response = {
          status: 500,
          error: "failed to parse msg",
          msg: msg.toString(),
          packet: pkt
        };
      }
    }
    this.#emitter.emit(topic, response, pkt);
  }

  async publish(topic: string, msg?: unknown, options: IClientPublishOptions = {}) {
    const defaultOptions = { qos: 2, retain: false };
    options = Object.assign(defaultOptions, options);

    return this.#client.publish(topic, msg, options);
  }

  subscribe(topic: string, callback: ListenerFn): HandlerSubscription {
    const event = convertPattern(topic);
    this.#emitter.on(event, callback);
    this.#client.subscribe(topic);

    return {
      end: () => {
        this.#emitter.removeListener(event, callback);
        if (this.#emitter.listeners(event).length === 0) {
          this.#client.unsubscribe(topic);
        }
      },
    };
  }

  /**
   * Makes a request to the DAB-enabled device, using the request/response convention
   * This method will automatically generate the request ID and append it to the request
   * If operation timed-out, it will throw a error.
   * @param  {string} topic
   * @param  {Object} payload
   * @param  {MqttOptions} options
   */
  async request(topic: string, payload = {}, options: IClientPublishOptions & { timeoutMs?: number } = { qos: 2, timeoutMs: 5000 }) {
    const requestId = uuidv4();
    const requestTopic = `${topic}/${requestId}`;

    const timeout = options.timeoutMs || 5000;

    return new Promise((resolve, reject) => {
      let timer: NodeJS.Timeout;
      const subscription = this.subscribe(`_response/${requestTopic}`, async function (msg) {
        subscription.end();
        clearTimeout(timer);

        if (msg.status > 299) {
          reject(msg);
        } else {
          resolve(msg);
        }
      });

      timer = setTimeout(async function () {
        subscription.end();
        reject(new TimeoutError(`Failed to receive response from ${topic} within ${timeout}ms`));
      }, timeout);

      this.publish(requestTopic, payload, options).catch(reject);
    });
  }

  /**
   * Handles topic response from broker.
   * @param  {string} topic
   * @param  {Function} handler
   */
  handle(topic: string, handler: HandlerFunction) {
    const subscription = this.subscribe(`${topic}/+`, async (msg, { topic: requestTopic }) => {
      if (!requestTopic) {
        return Promise.reject(
          new Error(`FATAL: Handler for topic (${topic}) failed to receive request topic.`)
        );
      } else {
        const responseTopic = `_response/${requestTopic}`;
        try {
          const resultMsg = await handler(
            msg,
            requestTopic.substring(0, requestTopic.lastIndexOf("/"))
          );
          return this.publish(responseTopic, resultMsg);
        } catch (error) {
          const status = error.status || 500;
          return this.publish(responseTopic, {
            status: status,
            error: JSON.stringify(serializeError(error)),
            request: msg
          });
        }
      }
    });

    this.#handlerSubscriptions.push(subscription);
  }

  async end() {
    await Promise.all(this.#handlerSubscriptions.map((handler) => handler.end()));
    await this.#client.end();
  }
}

interface WrappedMqttClient {
    setOnMessage: (onMessage: OnMessageCallback) => void;
    subscribe: (topic: string) => Promise<ISubscriptionGrant[]>;
    unsubscribe: (topic: string) => void;
    publish: (topic: string, payload?: unknown, options?: IClientPublishOptions) => void;
    end: () => Promise<void>;
}
function wrap(mqttClient: AsyncMqttClient): WrappedMqttClient {
    return {
        setOnMessage: function (onMessage: OnMessageCallback) {
            mqttClient.on("message", onMessage);
        },
        subscribe: function (topic: string) {
            return mqttClient.subscribe(topic);
        },
        unsubscribe: function (topic: string) {
            return mqttClient.unsubscribe(topic);
        },
        publish: function (topic: string, payload: unknown, options: IClientPublishOptions) {
            return mqttClient.publish(topic, JSON.stringify(payload), options);
        },
        end: function () {
            return mqttClient.end();
        }
    };
}

/**
 * Makes a mqtt connection and returns a async mqtt client.
 */
export function connect(uri: string, options: IClientOptions & { onConnected?: () => unknown} = {}): Promise<Client> {
    return new Promise((resolve, reject) => {
        const { keepalive = 10, ...otherOptions } = options;
        options = Object.assign(
            {
                keepalive: keepalive,
                connectTimeout: 2000,
                resubscribe: true,
                onConnected: () => {},
                onConnectionLost: () => {},
            },
            otherOptions
        );

        const mqttClient = mqtt.connect(uri, options);
        let connected = false;
        let initialized = false;

        const onError: OnErrorCallback = (error) => {
            if (!connected && !initialized) {
                mqttClient.end()
                    .finally(() => reject(error));
            }
            mqttClient.removeListener("error", onError);
        };

        mqttClient.on("error", onError);
        mqttClient.on("connect", () => {
            if (!initialized) {
                connected = true;
                mqttClient.removeListener("error", onError);
                resolve(new Client(wrap(mqttClient)));
                if (options.onConnected) {
                    options.onConnected();
                }
            }

            initialized = true;
        });
    });
}
