"use strict";

import config from 'config';
import { getLogger, sleep } from "../util.js";
import axios from 'axios';
import he from 'he';
import xmlParser from 'fast-xml-parser';
const xmlParserOptions = {
  attributeNamePrefix: "",
  attrNodeName: "_attr",
  textNodeName: "#text",
  ignoreAttributes: false,
  ignoreNameSpace: false,
  allowBooleanAttributes: true,
  parseNodeValue: false,
  parseAttributeValue: false,
  trimValues: true,
  cdataTagName: "_cdata",
  cdataPositionChar: "\\c",
  localeRange: "", //To support non english character in tag/attribute values.
  parseTrueNumberOnly: true,
  attrValueProcessor: (a) => he.decode(a, { isAttributeValue: true }), //default is a=>a
  tagValueProcessor: (a) => he.decode(a), //default is a=>a
};

const logger = getLogger();
const clientTimeout = config.get("roku.clientTimeout");

process.on("unhandledRejection", (reason, p) => {
  logger.debug("Unhandled Rejection at: Promise ", p, " reason: ", reason);
});

export class RokuCommands {
  constructor(rokuIp) {
    this.baseUrl = `http://${rokuIp}:8060`;
    this.roku = axios.create({
      baseURL: this.baseUrl,
      timeout: 2000
    });
     logger.info("Waking Roku...");
    this.keyPress("home");
  }

  async listApps() {
    const response = await this.roku.get('/query/apps');
    const jsonData = xmlParser.parse(response.data, xmlParserOptions);
    logger.info(`list apps: ${JSON.stringify(jsonData)}`);
    return jsonData;
  }

  async getDeviceInfo() {
    const response = await this.roku.get('/query/device-info');
    const jsonData = xmlParser.parse(response.data, xmlParserOptions);
    logger.info(`deviceInfo: ${JSON.stringify(jsonData)}`);
    return jsonData;
  }

  async start(channelId) {
    return await this.roku.post(`/launch/${channelId}`).status;
  }

  async launchAppContent(channelId, contentId, options) { //FIXME get the right URL herer
    return await this.roku.post(`/launch/${channelId}?contentID=${contentId}&options=${options}`).status;
  }

  async stop(dialAppName) {
    return await this.roku.delete(`/dial/${dialAppName}/run`).status;
  }

  async status() {
    const response = await this.roku.get('/query/media-player');
    const jsonData = xmlParser.parse(response.data, xmlParserOptions);
    logger.info(`player status: ${JSON.stringify(jsonData)}`);
    return jsonData;
  }

  async keyPress(keyName) {
    logger.info(`Pressing key ${keyName}...`);
    return await this.roku.post(`/keypress/${keyName}`).status;
  }

  async keyPressLong(keyName, durationMs) {
    logger.info(`Long pressing key ${keyName}...`);
    let response = await this.roku.post(`/keydown/${keyName}`);
    if (response.status !== 200) return response.status;
    await sleep(durationMs);
    logger.info(`Releasing key ${keyName}...`);
    return await this.roku.post(`/keyup/${keyName}`).status;
  }
}
