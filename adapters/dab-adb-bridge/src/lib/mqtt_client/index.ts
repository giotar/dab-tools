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

import {Client, connect} from './client.js';
import {IClientPublishOptions} from "mqtt";
import {DabResponse} from "../dab/dab_responses";

export type HandlerFunction = (message: any) => Promise<DabResponse>;
export interface Handler {
    path: string;
    handler: HandlerFunction
}

export interface HandlerSubscription {
    end: () => Promise<void>;
}

export class MqttClient {
    private started: boolean;
    private readonly handlers: Handler[];
    private mqtt!: Client;

    constructor() {
        this.started = false;
        this.handlers = [];
    }

    /**
     * Associates a function to process incoming requests with a specific topic
     */
    public handle(path: string, handler: HandlerFunction): void {
        this.handlers.push({ path, handler });
    }

    /**
     * Publishes a request to a topic and waits for a response or timeout to occur
     */
    public request(topic: string, payload?: any, options?: any): Promise<any> {
        return this.mqtt.request.call(this.mqtt, topic, payload, options);
    }

    /**
     * Subscribes to a topic, invoking callback function on each new message
     * until subscription.end() is called
     */
    public subscribe(topic: string, callback: (message: DabResponse) => Promise<void>): Promise<HandlerSubscription> {
        return this.mqtt.subscribe(topic, callback);
    }

    /**
     * Subscribes to a topic until first message is received or timeout occurs,
     * convenience function for reading a retained message
     * @param  {string} topic
     * @param  {number} [timeoutMs]
     */
    public subscribeOnce(topic: string, timeoutMs = 2000): Promise<any> {
        return new Promise( async (resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`Failed to receive response from ${topic} within ${timeoutMs}ms`)), timeoutMs);
            const subscription = this.subscribe(
                topic, async (message) => {
                    clearTimeout(timer);
                    resolve(message);
                    subscription.then(s => s.end());
                }
            );
        });
    }

    /**
     * Publishes a request to a topic where no response is expected
     */
    public publish(topic: string, payload?: unknown, options?: IClientPublishOptions) {
        return this.mqtt.publish(topic, payload, options);
    }

    /**
     * Publishes a retained message to a topic
     */
    public publishRetained(topic: string, payload: unknown, options: IClientPublishOptions= {}) {
        options = Object.assign(options, { retain: true });
        return this.mqtt.publish(topic, payload, options);
    }

    /**
     * Removes a previously published retained message from a topic
     */
    public clearRetained(topic: string, options: IClientPublishOptions= {}) {
        options = Object.assign(options, { retain: true });
        return this.mqtt.publish(topic, undefined, options);
    }

    /**
     * A single MqttClient should be created per application and init should be called once.
     * It will return once a connection to the MQTT broker is established, and does not time out.
     */
    public async init(uri: string) {
        if (!this.started) {
            this.started = true;
            this.mqtt = await connect(uri);
            await this.attachHandlers(this.handlers);
        } else {
            throw new Error("init can only be called once!");
        }

        this.started = true;
        return this;
    }

    public async stop() {
        if (this.started) {
            await this.mqtt.end();
            this.started = false;
        }
    }

    private async attachHandlers(handlers: Handler[]): Promise<void[]> {
        const handlerRegistrations = handlers.map(({ path, handler }) => {
            return this.mqtt.handle(path, async (message: unknown) => {
                return await handler(message);
            });
        });
        return Promise.all(handlerRegistrations);
    }
}
